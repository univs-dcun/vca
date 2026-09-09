package ai.univs.vca.admin;

import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableScheduling;

/** 서버 도달성 주기 검사(ServerService.checkAll) 등 스케줄 작업 활성화 (UV-53) */
@Configuration
@EnableScheduling
public class SchedulingConfig {
}
