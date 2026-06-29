package dev.toktab.brainhack.hiring;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface HiringCandidateRepository extends JpaRepository<HiringCandidate, Long> {
    Optional<HiringCandidate> findByIdAndProjectIdAndProjectOwnerIdAndDeletedAtIsNull(Long id, Long projectId, Long ownerId);
}
