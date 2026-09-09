package ai.univs.vca.admin.auth;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface PasswordResetRepository extends JpaRepository<PasswordResetEntity, Long> {

	Optional<PasswordResetEntity> findByUserId(Long userId);

	Optional<PasswordResetEntity> findByVerifiedTokenHash(String verifiedTokenHash);
}
