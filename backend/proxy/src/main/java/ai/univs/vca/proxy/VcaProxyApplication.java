package ai.univs.vca.proxy;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.web.reactive.function.client.WebClient;

@SpringBootApplication
@EnableConfigurationProperties(ModuleApiProperties.class)
public class VcaProxyApplication {

	public static void main(String[] args) {
		SpringApplication.run(VcaProxyApplication.class, args);
	}

	@Bean
	WebClient moduleApiClient(ModuleApiProperties props) {
		return WebClient.builder()
				.baseUrl(props.baseUrl())
				// 기본 256KB — 감지 이력이 많은 날의 live-analytics나 이미지 바이너리가 초과하면
				// DataBufferLimitException으로 전 요청이 500이 된다
				.codecs(c -> c.defaultCodecs().maxInMemorySize((int) props.maxResponseSize().toBytes()))
				.build();
	}
}
