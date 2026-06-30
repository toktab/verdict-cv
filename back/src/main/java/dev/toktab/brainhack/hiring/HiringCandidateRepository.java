package dev.toktab.brainhack.hiring;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HiringCandidateRepository extends JpaRepository<HiringCandidate, Long> {
    Optional<HiringCandidate> findByIdAndProjectIdAndProjectOwnerIdAndDeletedAtIsNull(Long id, Long projectId, Long ownerId);

    @Query("""
            select candidate from HiringCandidate candidate
            left join TeamMembership membership on membership.organization = candidate.project.organization
            where candidate.id = :candidateId
              and candidate.project.id = :projectId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (candidate.project.owner.id = :userId or membership.user.id = :userId)
            """)
    Optional<HiringCandidate> findAccessibleById(@Param("candidateId") Long candidateId, @Param("projectId") Long projectId, @Param("userId") Long userId);
}
