package dev.toktab.brainhack.hiring;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectAnnouncementRepository extends JpaRepository<ProjectAnnouncement, Long> {
    List<ProjectAnnouncement> findTop100ByProjectIdAndDeletedAtIsNullOrderByPinnedDescCreatedAtDesc(Long projectId);
}
