package ai.univs.vca.admin.auth;

/**
 * Portal 콘솔 역할 (design-vca-portal.md §3.2). 앱 접근(appAccess)은 별개 플래그.
 * JSON은 소문자(owner/admin/auditor/none) — 기획자 프론트 타입 {@code PortalPermission}과 동일 문자열.
 */
public enum PortalPermission {

	/** 최고관리자 — 권한 부여/회수와 계정 삭제가 가능한 유일한 역할. 활성 owner 0명은 거부 */
	OWNER,
	/** 관리자 — 설치 설정(카메라·VIP·명부·라이선스) 변경, 접근 권한은 못 바꿈 */
	ADMIN,
	/** 읽기 전용 관리자 — 모든 Portal 화면 + 감사 로그 조회, 변경 없음 */
	AUDITOR,
	/** 콘솔 접근 없음 (앱 전용 계정) */
	NONE;

	public boolean canEnterPortal() {
		return this != NONE;
	}

	public boolean canEditPortal() {
		return this == OWNER || this == ADMIN;
	}

	/** 역할 부여는 "스스로를 더 만들어내는 유일한 권력" — owner 전용 */
	public boolean canManageAccess() {
		return this == OWNER;
	}

	public String json() {
		return name().toLowerCase();
	}

	public static PortalPermission fromJson(String value) {
		if (value == null) {
			return null;
		}
		return valueOf(value.trim().toUpperCase());
	}
}
