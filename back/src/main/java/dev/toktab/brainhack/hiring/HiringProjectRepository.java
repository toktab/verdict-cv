package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface HiringProjectRepository extends JpaRepository<HiringProject, Long> {
    List<HiringProject> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId);
    Optional<HiringProject> findByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);
    boolean existsByOwnerIdAndTitleIgnoreCaseAndDeletedAtIsNull(Long ownerId, String title);

    @Query("""
            select distinct project from HiringProject project
            left join TeamMembership membership on membership.organization = project.organization
            where project.deletedAt is null
              and (project.owner.id = :userId or membership.user.id = :userId)
            order by project.createdAt desc
            """)
    List<HiringProject> findAccessible(@Param("userId") Long userId);

    @Query("""
            select distinct project from HiringProject project
            left join TeamMembership membership on membership.organization = project.organization
            where project.id = :projectId
              and project.deletedAt is null
              and (project.owner.id = :userId or membership.user.id = :userId)
            """)
    Optional<HiringProject> findAccessibleById(@Param("projectId") Long projectId, @Param("userId") Long userId);
}
