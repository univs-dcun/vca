package ai.univs.vca.admin.auth;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface UserSessionRepository extends JpaRepository<UserSessionEntity, String> {

	/** 비밀번호 변경 시 현재 세션만 남기고 정리 (탈취 세션 무효화) */
	@Modifying
	@Query("delete from UserSessionEntity s where s.userId = :userId and s.tokenHash <> :keepTokenHash")
	void deleteOtherSessions(@Param("userId") Long userId, @Param("keepTokenHash") String keepTokenHash);
}
