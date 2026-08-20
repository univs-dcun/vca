package ai.univs.vca.proxy;

import java.time.Duration;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** 모듈 API 연결 설정 (application.yml의 vca.module-api.*) */
@ConfigurationProperties(prefix = "vca.module-api")
public record ModuleApiProperties(String baseUrl, Duration timeout, Duration searchTimeout) {}
