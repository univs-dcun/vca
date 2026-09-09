package ai.univs.vca.admin.roster;

import java.util.List;
import java.util.Optional;

import org.springframework.data.jpa.repository.JpaRepository;

public interface RosterRepository extends JpaRepository<RosterEntryEntity, String> {

	List<RosterEntryEntity> findByProjectIdOrderByNameAsc(String projectId);

	List<RosterEntryEntity> findByProjectIdInOrderByNameAsc(java.util.Collection<String> projectIds);

	List<RosterEntryEntity> findAllByOrderByNameAsc();

	Optional<RosterEntryEntity> findByCodeHash(String codeHash);
}
