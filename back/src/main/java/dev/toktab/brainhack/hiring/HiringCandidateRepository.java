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
            left join ProjectInvite invite on invite.project = candidate.project
            left join ProjectMemberPermission permission on permission.project = candidate.project
            where candidate.id = :candidateId
              and candidate.project.id = :projectId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (candidate.project.owner.id = :userId
                or (lower(invite.invitedEmail) = lower(:email) and invite.status = 'ACCEPTED')
                or lower(permission.memberEmail) = lower(:email))
            """)
    Optional<HiringCandidate> findAccessibleById(@Param("candidateId") Long candidateId, @Param("projectId") Long projectId, @Param("userId") Long userId, @Param("email") String email);

    @Query("""
            select candidate from HiringCandidate candidate
            left join ProjectInvite invite on invite.project = candidate.project
            left join ProjectMemberPermission permission on permission.project = candidate.project
            where candidate.project.id = :projectId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (candidate.project.owner.id = :userId
                or (lower(invite.invitedEmail) = lower(:email) and invite.status = 'ACCEPTED')
                or lower(permission.memberEmail) = lower(:email))
            order by candidate.createdAt desc
            """)
    List<HiringCandidate> findAccessibleByProjectId(@Param("projectId") Long projectId, @Param("userId") Long userId, @Param("email") String email, Pageable pageable);

    @Query("""
            select count(distinct candidate.id) from HiringCandidate candidate
            left join ProjectInvite invite on invite.project = candidate.project
            left join ProjectMemberPermission permission on permission.project = candidate.project
            where candidate.project.id = :projectId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (candidate.project.owner.id = :userId
                or (lower(invite.invitedEmail) = lower(:email) and invite.status = 'ACCEPTED')
                or lower(permission.memberEmail) = lower(:email))
            """)
    long countAccessibleByProjectId(@Param("projectId") Long projectId, @Param("userId") Long userId, @Param("email") String email);

    @Query("""
            select candidate from HiringCandidate candidate
            where candidate.project.organization.id = :organizationId
              and candidate.deletedAt is null
              and candidate.project.deletedAt is null
              and (lower(candidate.name) = lower(:name)
                or (:email <> '' and lower(candidate.candidateEmail) = lower(:email)))
            order by candidate.createdAt desc
            """)
    List<HiringCandidate> findPriorApplications(
            @Param("organizationId") Long organizationId,
            @Param("name") String name,
            @Param("email") String email,
            Pageable pageable);
}
