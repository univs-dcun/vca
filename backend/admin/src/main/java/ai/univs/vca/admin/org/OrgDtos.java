package ai.univs.vca.admin.org;

import java.time.Instant;
import java.time.LocalDate;

/** 팀·프로젝트 계약 DTO (admin-api.json teams/projects 그룹, UV-50) */
public final class OrgDtos {

	private OrgDtos() {
	}

	/** SMTP 요청 — password는 쓰기 전용(생략 시 기존 값 유지) */
	public record MailRequest(String mailDomain, String host, Integer port, String fromAddress, String username,
			String password, Boolean useTls) {
	}

	/** SMTP 응답 — 비밀번호 대신 hasPassword */
	public record MailView(String mailDomain, String host, Integer port, String fromAddress, String username,
			boolean hasPassword, Boolean useTls) {

		static MailView of(String mailDomain, MailConfig c) {
			if (c == null || !c.isConfigured()) {
				return new MailView(mailDomain, null, null, null, null, false, null);
			}
			return new MailView(mailDomain, c.getHost(), c.getPort(), c.getFromAddress(), c.getUsername(),
					c.getPasswordEnc() != null, c.getUseTls());
		}
	}

	public record TeamRequest(String name, String region, String accountManagerName, String accountManagerEmail) {
	}

	public record TeamResponse(String id, String name, String region, MailView mail, String accountManagerName,
			String accountManagerEmail, Instant createdAt) {

		static TeamResponse of(TeamEntity t) {
			return new TeamResponse(t.getId(), t.getName(), t.getRegion(), MailView.of(t.getMailDomain(), t.getSmtp()),
					t.getAccountManagerName(), t.getAccountManagerEmail(), t.getCreatedAt());
		}
	}

	public record ProjectRequest(String teamId, String name, String type, String timeZone, String computeInstance,
			Integer gpuCount, String modelVersion, String regionName) {
	}

	public record LicenseRequest(String plan, Integer channelLimit, LocalDate expiresAt) {
	}

	public record TimeZoneRequest(String timeZone) {
	}

	public record NetworkIsolationRequest(Boolean override) {
	}

	public record ProjectResponse(String id, String teamId, String name, String type, String timeZone,
			String licensePlan, Integer licenseChannelLimit, LocalDate licenseExpiresAt, MailView mail,
			boolean networkIsolated, boolean networkIsolatedDetected, Boolean networkIsolatedOverride,
			String computeInstance, Integer gpuCount, String modelVersion, String regionName, Instant createdAt) {

		static ProjectResponse of(ProjectEntity p) {
			return new ProjectResponse(p.getId(), p.getTeamId(), p.getName(), p.getType().json(), p.getTimeZone(),
					p.getLicensePlan(), p.getLicenseChannelLimit(), p.getLicenseExpiresAt(),
					MailView.of(p.getMailDomain(), p.getSmtp()), p.isNetworkIsolated(), p.isNetworkIsolatedDetected(),
					p.getNetworkIsolatedOverride(), p.getComputeInstance(), p.getGpuCount(), p.getModelVersion(),
					p.getRegionName(), p.getCreatedAt());
		}
	}
}
