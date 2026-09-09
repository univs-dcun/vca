package ai.univs.vca.admin.security;

import ai.univs.vca.admin.auth.UserAccountEntity;

/**
 * 요청 스레드의 세션 사용자 (UV-50). SessionInterceptor가 설정·해제한다.
 * 서비스 계층(감사 로그 actor 등)이 컨트롤러 인자 전달 없이 읽는 용도 — 세션 밖(시더·스케줄러)에서는 null.
 */
public final class CurrentUser {

	private static final ThreadLocal<UserAccountEntity> HOLDER = new ThreadLocal<>();

	private CurrentUser() {
	}

	static void set(UserAccountEntity user) {
		HOLDER.set(user);
	}

	static void clear() {
		HOLDER.remove();
	}

	public static UserAccountEntity get() {
		return HOLDER.get();
	}

	public static String actorName() {
		UserAccountEntity u = HOLDER.get();
		return u == null ? "system" : u.getName();
	}

	public static Long actorId() {
		UserAccountEntity u = HOLDER.get();
		return u == null ? null : u.getId();
	}
}
