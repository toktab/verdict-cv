package dev.toktab.brainhack.audit;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditRepository extends JpaRepository<Audit, Long> {
    List<Audit> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    Optional<Audit> findByIdAndOwnerId(Long id, Long ownerId);
}
