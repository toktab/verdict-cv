package dev.toktab.brainhack.audit;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditRepository extends JpaRepository<Audit, Long> {
    List<Audit> findByDeletedAtIsNullOrderByCreatedAtDesc();

    List<Audit> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId);

    Optional<Audit> findByIdAndDeletedAtIsNull(Long id);

    Optional<Audit> findByIdAndOwnerIdAndDeletedAtIsNull(Long id, Long ownerId);
}
