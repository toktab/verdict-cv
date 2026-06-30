package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface TeamMembershipRepository extends JpaRepository<TeamMembership, Long> {
    List<TeamMembership> findByUserId(Long userId);
    boolean existsByOrganizationIdAndUserId(Long organizationId, Long userId);
    Optional<TeamMembership> findByOrganizationIdAndUserId(Long organizationId, Long userId);
}
