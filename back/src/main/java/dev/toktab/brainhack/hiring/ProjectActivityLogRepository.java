package dev.toktab.brainhack.hiring;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectActivityLogRepository extends JpaRepository<ProjectActivityLog, Long> {
    List<ProjectActivityLog> findTop500ByProjectIdOrderByCreatedAtDesc(Long projectId);
}
