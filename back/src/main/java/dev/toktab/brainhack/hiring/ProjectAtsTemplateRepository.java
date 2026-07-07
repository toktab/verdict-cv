package dev.toktab.brainhack.hiring;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectAtsTemplateRepository extends JpaRepository<ProjectAtsTemplate, Long> {
    List<ProjectAtsTemplate> findByProjectIdAndDeletedAtIsNullOrderByUpdatedAtDesc(Long projectId);
}
