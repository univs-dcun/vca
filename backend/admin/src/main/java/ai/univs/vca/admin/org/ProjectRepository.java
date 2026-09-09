package ai.univs.vca.admin.org;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectRepository extends JpaRepository<ProjectEntity, String> {

	List<ProjectEntity> findByTeamIdOrderByCreatedAt(String teamId);

	List<ProjectEntity> findByIdInOrderByCreatedAt(java.util.Collection<String> ids);
}
