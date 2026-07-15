package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface ProjectInviteRepository extends JpaRepository<ProjectInvite, Long> {
    List<ProjectInvite> findByProjectIdOrderByCreatedAtDesc(Long projectId);
    Optional<ProjectInvite> findByTokenAndStatus(String token, String status);
    Optional<ProjectInvite> findFirstByProjectIdAndInvitedEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(Long projectId, String email, String status);
}
