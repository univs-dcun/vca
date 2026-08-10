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
		return WebClient.builder().baseUrl(props.baseUrl()).build();
	}
}
