package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HiringProjectRepository extends JpaRepository<HiringProject, Long> {
    List<HiringProject> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId);
    Optional<HiringProject> findByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);
    boolean existsByOwnerIdAndTitleIgnoreCaseAndDeletedAtIsNull(Long ownerId, String title);

    @Query("""
            select distinct project from HiringProject project
            left join ProjectInvite invite on invite.project = project
            left join ProjectMemberPermission permission on permission.project = project
            where project.deletedAt is null
              and (project.owner.id = :userId
                or (lower(invite.invitedEmail) = lower(:email) and invite.status = 'ACCEPTED')
                or lower(permission.memberEmail) = lower(:email))
            order by project.createdAt desc
            """)
    List<HiringProject> findAccessible(@Param("userId") Long userId, @Param("email") String email);

    @Query(value = """
            select distinct project from HiringProject project
            left join ProjectInvite invite on invite.project = project
            left join ProjectMemberPermission permission on permission.project = project
            where project.deletedAt is null
              and (project.owner.id = :userId
                or (lower(invite.invitedEmail) = lower(:email) and invite.status = 'ACCEPTED')
                or lower(permission.memberEmail) = lower(:email))
              and (:search = ''
                or lower(project.title) like concat('%', :search, '%')
                or lower(project.department) like concat('%', :search, '%')
                or lower(project.location) like concat('%', :search, '%')
                or lower(project.status) like concat('%', :search, '%'))
            """, countQuery = """
            select count(distinct project.id) from HiringProject project
            left join ProjectInvite invite on invite.project = project
            left join ProjectMemberPermission permission on permission.project = project
            where project.deletedAt is null
              and (project.owner.id = :userId
                or (lower(invite.invitedEmail) = lower(:email) and invite.status = 'ACCEPTED')
                or lower(permission.memberEmail) = lower(:email))
              and (:search = ''
                or lower(project.title) like concat('%', :search, '%')
                or lower(project.department) like concat('%', :search, '%')
                or lower(project.location) like concat('%', :search, '%')
                or lower(project.status) like concat('%', :search, '%'))
            """)
    Page<HiringProject> findAccessiblePage(@Param("userId") Long userId, @Param("email") String email,
                                           @Param("search") String search, Pageable pageable);

    @Query("""
            select distinct project from HiringProject project
            left join ProjectInvite invite on invite.project = project
            left join ProjectMemberPermission permission on permission.project = project
            where project.id = :projectId
              and project.deletedAt is null
              and (project.owner.id = :userId
                or (lower(invite.invitedEmail) = lower(:email) and invite.status = 'ACCEPTED')
                or lower(permission.memberEmail) = lower(:email))
            """)
    Optional<HiringProject> findAccessibleById(@Param("projectId") Long projectId, @Param("userId") Long userId, @Param("email") String email);
}
