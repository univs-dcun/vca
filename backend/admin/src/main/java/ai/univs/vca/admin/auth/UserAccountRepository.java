package ai.univs.vca.admin.auth;

import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAccountRepository extends JpaRepository<UserAccountEntity, Long> {

	Optional<UserAccountEntity> findByEmail(String email);
}
