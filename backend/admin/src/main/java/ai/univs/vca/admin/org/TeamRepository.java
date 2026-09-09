package ai.univs.vca.admin.org;

import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamRepository extends JpaRepository<TeamEntity, String> {

	java.util.List<TeamEntity> findByIdIn(java.util.Collection<String> ids);
}
