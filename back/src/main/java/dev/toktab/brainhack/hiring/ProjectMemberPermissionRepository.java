package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectMemberPermissionRepository extends JpaRepository<ProjectMemberPermission, Long> {
    List<ProjectMemberPermission> findByProjectId(Long projectId);
    Optional<ProjectMemberPermission> findByProjectIdAndMemberEmailIgnoreCase(Long projectId, String memberEmail);
}
