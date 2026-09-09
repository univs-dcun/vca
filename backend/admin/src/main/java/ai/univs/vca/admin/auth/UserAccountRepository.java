package ai.univs.vca.admin.auth;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAccountRepository extends JpaRepository<UserAccountEntity, Long> {

	Optional<UserAccountEntity> findByEmail(String email);

	Optional<UserAccountEntity> findByEmployeeId(String employeeId);

	/** last-owner 가드 — 활성 owner 수 */
	long countByPermissionAndStatus(PortalPermission permission, AccountStatus status);

	long countByPermission(PortalPermission permission);

	Optional<UserAccountEntity> findBySetupCodeHash(String setupCodeHash);

	Optional<UserAccountEntity> findByInviteTokenHash(String inviteTokenHash);
}
