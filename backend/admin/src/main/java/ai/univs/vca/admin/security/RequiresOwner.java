package ai.univs.vca.admin.security;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * 접근 권한 관리(계정 발급·권한/상태 변경·삭제·임시 비밀번호)는 owner 전용 — "역할 부여는 스스로를
 * 더 만들어내는 유일한 권력" (design-vca-portal.md §3.2). SessionInterceptor가 검사한다.
 */
@Target(ElementType.METHOD)
@Retention(RetentionPolicy.RUNTIME)
public @interface RequiresOwner {
}
