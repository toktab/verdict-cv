package dev.toktab.brainhack.audit;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

public interface AuditRepository extends JpaRepository<Audit, Long> {
    List<Audit> findByDeletedAtIsNullOrderByCreatedAtDesc();

    List<Audit> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId);

    List<Audit> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId, Pageable pageable);

    List<Audit> findByDeletedAtIsNullOrderByCreatedAtDesc(Pageable pageable);

    Optional<Audit> findByIdAndDeletedAtIsNull(Long id);

    Optional<Audit> findByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);

    @Query("""
            select distinct audit from Audit audit
            left join fetch audit.verdicts
            where audit.id = :id
              and audit.deletedAt is null
            """)
    Optional<Audit> findWithVerdictsByIdAndDeletedAtIsNull(@Param("id") Long id);

    @Query("""
            select distinct audit from Audit audit
            left join fetch audit.verdicts
            where audit.id = :id
              and audit.owner.id = :ownerId
              and audit.deletedAt is null
            """)
    Optional<Audit> findWithVerdictsByIdAndOwnerIdAndDeletedAtIsNull(@Param("id") Long id, @Param("ownerId") Long ownerId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select audit from Audit audit
            where audit.id = :id
              and audit.owner.id = :ownerId
              and audit.deletedAt is null
            """)
    Optional<Audit> findByIdAndOwnerIdAndDeletedAtIsNullForUpdate(@Param("id") Long id, @Param("ownerId") Long ownerId);

    long countByOwnerIdAndCheckStateIdAndCreatedAtAfterAndDeletedAtIsNull(Long ownerId, String checkStateId, Instant createdAt);
    long countByStatusAndDeletedAtIsNull(AuditStatus status);
    long countByDeletedAtIsNull();

    List<Audit> findByStatusAndDeletedAtIsNull(AuditStatus status);

    @Query("""
            select audit from Audit audit
            where audit.deletedAt is null
              and (
                lower(audit.claimTitle) like lower(concat('%', :search, '%'))
                or lower(audit.evidenceTitle) like lower(concat('%', :search, '%'))
                or lower(audit.engine) like lower(concat('%', :search, '%'))
                or lower(str(audit.status)) like lower(concat('%', :search, '%'))
                or lower(audit.templateName) like lower(concat('%', :search, '%'))
              )
            order by audit.createdAt desc
            """)
    List<Audit> search(@Param("search") String search, Pageable pageable);

}
