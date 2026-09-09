package ai.univs.vca.admin.status;

import java.nio.charset.StandardCharsets;
import java.time.Instant;

import ai.univs.vca.admin.AdminProperties;
import jakarta.annotation.PreDestroy;
import org.eclipse.paho.client.mqttv3.IMqttDeliveryToken;
import org.eclipse.paho.client.mqttv3.MqttCallbackExtended;
import org.eclipse.paho.client.mqttv3.MqttClient;
import org.eclipse.paho.client.mqttv3.MqttConnectOptions;
import org.eclipse.paho.client.mqttv3.MqttException;
import org.eclipse.paho.client.mqttv3.MqttMessage;
import org.eclipse.paho.client.mqttv3.persist.MemoryPersistence;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.stereotype.Component;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * EMQX 구독자 (UV-53) — `vca/v1/{siteId}/cameras/+/status` (SPEC §3.1, retained).
 * RUNNING → online, STOPPED → offline, 빈 페이로드 → retained 삭제(카메라 제거) → 캐시 해제.
 * 접속 실패는 치명이 아니다 — 자동 재접속, 그동안 상태는 unknown. 재접속 시 retained로 전 카메라 현재값을 즉시 받는다.
 */
@Component
public class MqttStatusSubscriber implements ApplicationRunner {

	private static final Logger log = LoggerFactory.getLogger(MqttStatusSubscriber.class);

	private final AdminProperties props;
	private final CameraStatusService statuses;
	private final ObjectMapper mapper;
	private MqttClient client;

	public MqttStatusSubscriber(AdminProperties props, CameraStatusService statuses, ObjectMapper mapper) {
		this.props = props;
		this.statuses = statuses;
		this.mapper = mapper;
	}

	@Override
	public void run(ApplicationArguments args) {
		if (props.mqttBrokerUrl() == null || props.mqttBrokerUrl().isBlank()) {
			log.info("mqtt-broker-url 미설정 — 카메라 상태 구독 생략 (연결 집계는 unknown)");
			return;
		}
		String topic = "vca/v1/" + props.mqttSiteId() + "/cameras/+/status";
		try {
			client = new MqttClient(props.mqttBrokerUrl(), "vca-admin-" + Long.toHexString(System.nanoTime()),
					new MemoryPersistence());
			MqttConnectOptions opts = new MqttConnectOptions();
			opts.setAutomaticReconnect(true);
			opts.setCleanSession(true);
			opts.setConnectionTimeout(5);
			client.setCallback(new MqttCallbackExtended() {
				@Override
				public void connectComplete(boolean reconnect, String serverURI) {
					try {
						client.subscribe(topic, 1);
						log.info("EMQX {} 구독: {} (reconnect={})", serverURI, topic, reconnect);
					}
					catch (MqttException e) {
						log.warn("status 토픽 구독 실패: {}", e.getMessage());
					}
				}

				@Override
				public void connectionLost(Throwable cause) {
					log.warn("EMQX 연결 끊김 — 자동 재접속 대기: {}", cause == null ? "" : cause.getMessage());
				}

				@Override
				public void messageArrived(String t, MqttMessage message) {
					handle(t, message.getPayload());
				}

				@Override
				public void deliveryComplete(IMqttDeliveryToken token) {
				}
			});
			client.connect(opts);
		}
		catch (MqttException e) {
			log.warn("EMQX 접속 실패({}) — 자동 재접속 대기, 그동안 카메라 상태 unknown", e.getMessage());
		}
	}

	void handle(String topic, byte[] payload) {
		String[] parts = topic.split("/");
		if (parts.length < 6) {
			return;
		}
		String cameraId = parts[4];
		if (payload == null || payload.length == 0) {
			statuses.forget(cameraId);
			return;
		}
		try {
			JsonNode node = mapper.readTree(new String(payload, StandardCharsets.UTF_8));
			String raw = node.path("status").asString("");
			String status = switch (raw) {
				case "RUNNING" -> CameraStatusService.ONLINE;
				case "STOPPED" -> CameraStatusService.OFFLINE;
				default -> null;
			};
			if (status == null) {
				return;
			}
			Instant at = Instant.now();
			String ts = node.path("ts").asString("");
			if (!ts.isEmpty()) {
				try {
					at = Instant.parse(ts);
				}
				catch (Exception ignored) {
					// 모듈이 잘못된 ts를 보내도 수신 시각으로 적재
				}
			}
			statuses.record(cameraId, status, at);
		}
		catch (Exception e) {
			log.debug("status 페이로드 파싱 실패 {}: {}", topic, e.getMessage());
		}
	}

	@PreDestroy
	void close() {
		if (client != null) {
			try {
				client.disconnectForcibly(1000);
				client.close();
			}
			catch (MqttException ignored) {
			}
		}
	}
}
