package ai.univs.vca.admin.auth;

/** 계정 상태 — 로그인 시 임시 비밀번호 분기보다 먼저 검사한다 (정지된 계정이 임시 비밀번호를 들고 있어도 거부) */
public enum AccountStatus {

	ACTIVE,
	/** 코드/초대를 받았으나 비밀번호 미설정 — 로그인 시 ADM-4017 notActivated */
	INVITED,
	/** 관리자가 정지 — 로그인 시 ADM-4016 suspended */
	SUSPENDED;

	public String json() {
		return name().toLowerCase();
	}

	public static AccountStatus fromJson(String value) {
		if (value == null) {
			return null;
		}
		return valueOf(value.trim().toUpperCase());
	}
}
