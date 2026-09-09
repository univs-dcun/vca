package ai.univs.vca.admin.server;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;

public interface ServerRepository extends JpaRepository<ServerEntity, String> {

	List<ServerEntity> findByProjectIdOrderByNameAsc(String projectId);

	List<ServerEntity> findByProjectIdInOrderByNameAsc(java.util.Collection<String> projectIds);

	List<ServerEntity> findAllByOrderByNameAsc();
}
