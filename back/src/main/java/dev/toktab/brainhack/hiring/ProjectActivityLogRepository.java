package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectActivityLogRepository extends JpaRepository<ProjectActivityLog, Long> {
    List<ProjectActivityLog> findTop500ByProjectIdOrderByCreatedAtDesc(Long projectId);
    List<ProjectActivityLog> findTop200ByProjectIdAndCandidateIdOrderByCreatedAtDesc(Long projectId, Long candidateId);
    Optional<ProjectActivityLog> findFirstByProjectIdAndCandidateIdAndActorIdAndTypeOrderByCreatedAtDesc(Long projectId, Long candidateId, Long actorId, String type);
}
