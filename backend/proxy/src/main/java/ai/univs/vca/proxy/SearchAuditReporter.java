package ai.univs.vca.proxy;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.ResolvableType;
import org.springframework.core.io.buffer.DataBuffer;
import org.springframework.core.io.buffer.DataBufferUtils;
import org.springframework.core.io.buffer.DefaultDataBufferFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.http.ReactiveHttpInputMessage;
import org.springframework.http.codec.multipart.DefaultPartHttpMessageReader;
import org.springframework.http.codec.multipart.FilePart;
import org.springframework.http.codec.multipart.FormFieldPart;
import org.springframework.http.codec.multipart.Part;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.stereotype.Component;
import org.springframework.web.util.UriComponentsBuilder;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;
import tools.jackson.databind.node.ObjectNode;

/**
 * 인물 검색 감사 기록 (UV-59) — 프록시는 앱의 모든 검색 호출이 지나는 유일한 자리다. 중계가 끝나면 Admin의
 * POST /audit/search로 "누가·언제·무엇으로·결과 몇 건"을 보낸다. 행위자는 세션 쿠키를 그대로 넘겨 Admin이 확정한다.
 *
 * 기획 확정(2026-09-09 8번): 대상 이미지 원본은 보관하지 않는다 — 파일 파트는 SHA-256·크기·개수만 남기고,
 * 텍스트 파트(필터·유사도·기간)와 쿼리, JSON 본문(대상 참조)은 criteria로 남긴다. 기록 실패는 검색 결과에 영향을 주지 않는다.
 */
@Component
public class SearchAuditReporter {

	private static final Logger log = LoggerFactory.getLogger(SearchAuditReporter.class);
	private static final List<String> RESULT_ARRAYS = List.of("hits", "matches", "associates", "items", "frames",
			"results", "content");

	/** 본문에서 뽑아낸 기록용 재료 */
	public record Extract(String criteria, String imageSha256, Long imageBytes, int imageCount) {
	}

	private final AdminForwarder forwarder;
	private final SearchAuditProperties props;
	private final ObjectMapper mapper;

	public SearchAuditReporter(AdminForwarder forwarder, SearchAuditProperties props, ObjectMapper mapper) {
		this.forwarder = forwarder;
		this.props = props;
		this.mapper = mapper;
	}

	public int maxBodyBytes() {
		return (int) props.maxBody().toBytes();
	}

	/** 요청 본문을 상한 내에서 한 번 모은다 — 초과 시 DataBufferLimitException */
	public Mono<byte[]> readBody(ServerHttpRequest request) {
		return DataBufferUtils.join(request.getBody(), maxBodyBytes())
			.map(db -> {
				byte[] bytes = new byte[db.readableByteCount()];
				db.read(bytes);
				DataBufferUtils.release(db);
				return bytes;
			})
			.defaultIfEmpty(new byte[0]);
	}

	/** 모듈 응답에서 결과 건수 — 알려진 배열 필드 중 첫 번째의 길이, 없으면 null */
	public static Integer resultCount(JsonNode body) {
		if (body == null || !body.isObject()) {
			return null;
		}
		for (String key : RESULT_ARRAYS) {
			JsonNode n = body.get(key);
			if (n != null && n.isArray()) {
				return n.size();
			}
		}
		return null;
	}

	/** 비동기 기록 — 검색 응답을 기다리게 하지 않는다 */
	public void report(ServerHttpRequest request, String feature, byte[] body, MediaType contentType,
			Integer resultCount, long startNanos, String status, String errorCode) {
		if (!props.enabled()) {
			return;
		}
		int durationMs = (int) Math.min(Integer.MAX_VALUE, (System.nanoTime() - startNanos) / 1_000_000);
		extract(request, body, contentType)
			.onErrorResume(e -> {
				log.warn("search audit: body extract failed ({}), recording without criteria", e.toString());
				return Mono.just(new Extract(null, null, null, 0));
			})
			.flatMap(ex -> {
				ObjectNode event = mapper.createObjectNode();
				event.put("feature", feature);
				event.put("endpoint", request.getPath().value());
				event.put("criteria", ex.criteria());
				event.put("imageSha256", ex.imageSha256());
				if (ex.imageBytes() != null) {
					event.put("imageBytes", ex.imageBytes());
				}
				event.put("imageCount", ex.imageCount());
				if (resultCount != null) {
					event.put("resultCount", resultCount);
				}
				event.put("durationMs", durationMs);
				event.put("status", status);
				event.put("errorCode", errorCode);
				return forwarder.forward(HttpMethod.POST, "/audit/search", request, event.toString());
			})
			.subscribe(res -> {
				if (!res.getStatusCode().is2xxSuccessful()) {
					log.warn("search audit: admin answered {} for {} {}", res.getStatusCode().value(), feature,
							request.getPath().value());
				}
			}, e -> log.warn("search audit: report failed for {} {}: {}", feature, request.getPath().value(),
					e.toString()));
	}

	private Mono<Extract> extract(ServerHttpRequest request, byte[] body, MediaType contentType) {
		ObjectNode criteria = mapper.createObjectNode();
		Map<String, List<String>> query = UriComponentsBuilder.fromUri(request.getURI()).build().getQueryParams();
		if (!query.isEmpty()) {
			ObjectNode q = criteria.putObject("query");
			query.forEach((k, v) -> q.put(k, v.size() == 1 ? v.get(0) : String.join(",", v)));
		}
		if (body.length == 0) {
			return Mono.just(new Extract(criteria.isEmpty() ? null : criteria.toString(), null, null, 0));
		}
		if (contentType != null && MediaType.MULTIPART_FORM_DATA.isCompatibleWith(contentType)) {
			return multipart(body, contentType).map(parts -> {
				ObjectNode fields = criteria.putObject("fields");
				String sha = null;
				long bytes = 0;
				int images = 0;
				for (PartInfo p : parts) {
					if (p.fileSha256() != null) {
						images++;
						bytes += p.size();
						if (sha == null) {
							sha = p.fileSha256();
						}
					}
					else {
						fields.put(p.name(), p.value());
					}
				}
				return new Extract(criteria.toString(), sha, images == 0 ? null : bytes, images);
			});
		}
		if (contentType == null || MediaType.APPLICATION_JSON.isCompatibleWith(contentType)) {
			try {
				criteria.set("body", mapper.readTree(body));
			}
			catch (RuntimeException e) {
				criteria.put("body", new String(body, 0, Math.min(body.length, 1000), StandardCharsets.UTF_8));
			}
			return Mono.just(new Extract(criteria.toString(), null, null, 0));
		}
		criteria.put("contentType", contentType.toString());
		return Mono.just(new Extract(criteria.toString(), sha256(body), (long) body.length, 1));
	}

	private record PartInfo(String name, String value, String fileSha256, long size) {
	}

	/** 모인 바이트를 다시 스트림으로 읽어 파트 분리 — 파일 파트는 해시만 계산하고 버린다 */
	private Mono<List<PartInfo>> multipart(byte[] body, MediaType contentType) {
		DefaultPartHttpMessageReader reader = new DefaultPartHttpMessageReader();
		reader.setMaxInMemorySize(maxBodyBytes());
		reader.setMaxParts(64);
		ReactiveHttpInputMessage message = new ReactiveHttpInputMessage() {
			@Override
			public HttpHeaders getHeaders() {
				HttpHeaders h = new HttpHeaders();
				h.setContentType(contentType);
				h.setContentLength(body.length);
				return h;
			}

			@Override
			public Flux<DataBuffer> getBody() {
				return Flux.just(DefaultDataBufferFactory.sharedInstance.wrap(body));
			}
		};
		return reader.read(ResolvableType.forClass(Part.class), message, Map.of())
			.concatMap(part -> {
				if (part instanceof FilePart file) {
					return DataBufferUtils.join(file.content()).map(db -> {
						byte[] bytes = new byte[db.readableByteCount()];
						db.read(bytes);
						DataBufferUtils.release(db);
						return new PartInfo(file.name(), file.filename(), sha256(bytes), bytes.length);
					}).defaultIfEmpty(new PartInfo(file.name(), file.filename(), sha256(new byte[0]), 0));
				}
				if (part instanceof FormFieldPart field) {
					return Mono.just(new PartInfo(field.name(), field.value(), null, 0));
				}
				return DataBufferUtils.join(part.content()).map(db -> {
					byte[] bytes = new byte[db.readableByteCount()];
					db.read(bytes);
					DataBufferUtils.release(db);
					return new PartInfo(part.name(), null, sha256(bytes), bytes.length);
				});
			})
			.collectList();
	}

	static String sha256(byte[] bytes) {
		try {
			return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
		}
		catch (NoSuchAlgorithmException e) {
			throw new IllegalStateException(e);
		}
	}
}
