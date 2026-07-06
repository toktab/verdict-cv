package dev.toktab.brainhack.hiring;

import java.util.Optional;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HiringCandidateRepository extends JpaRepository<HiringCandidate, Long> {
    Optional<HiringCandidate> findByIdAndProjectIdAndProjectOwnerIdAndDeletedAtIsNull(Long id, Long projectId, Long ownerId);

    @Query("""
            select distinct candidate from HiringCandidate candidate
            left join TeamMembership membership on membership.organization = candidate.project.organization
            where candidate.id = :candidateId
              and candidate.project.id = :projectId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (candidate.project.owner.id = :userId or membership.user.id = :userId)
            """)
    Optional<HiringCandidate> findAccessibleById(@Param("candidateId") Long candidateId, @Param("projectId") Long projectId, @Param("userId") Long userId);

    @Query("""
            select candidate from HiringCandidate candidate
            left join TeamMembership membership on membership.organization = candidate.project.organization
            where candidate.project.id = :projectId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (candidate.project.owner.id = :userId or membership.user.id = :userId)
            order by candidate.createdAt desc
            """)
    List<HiringCandidate> findAccessibleByProjectId(@Param("projectId") Long projectId, @Param("userId") Long userId, Pageable pageable);

    @Query("""
            select count(distinct candidate.id) from HiringCandidate candidate
            left join TeamMembership membership on membership.organization = candidate.project.organization
            where candidate.project.id = :projectId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (candidate.project.owner.id = :userId or membership.user.id = :userId)
            """)
    long countAccessibleByProjectId(@Param("projectId") Long projectId, @Param("userId") Long userId);
}
