package ai.univs.vca.admin;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * VCA Admin 백엔드 — 카메라 원장의 단일 원천 (docs/design-vca-admin.md, UV-41/UV-42).
 *
 * 책임: 카메라 원장 CRUD·자격증명 보관, 원장 변경 시 분석 모듈 provisioning
 * (PUT {module}/provision/cameras — 전체 목록 선언적 멱등 교체, 계약 v1.9).
 * P2에서 미디어 서버 경로 동기화, P3에서 업로드 수신·모듈 ingest가 추가된다.
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class VcaAdminApplication {

	public static void main(String[] args) {
		SpringApplication.run(VcaAdminApplication.class, args);
	}
}
