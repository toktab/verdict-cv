package dev.toktab.brainhack.audit;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditSnapshotRepository extends JpaRepository<AuditSnapshot, Long> {
    Optional<AuditSnapshot> findFirstByAuditIdOrderByCreatedAtDesc(Long auditId);
}
