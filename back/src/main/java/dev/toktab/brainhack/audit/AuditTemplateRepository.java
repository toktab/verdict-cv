package dev.toktab.brainhack.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AuditTemplateRepository extends JpaRepository<AuditTemplate, Long> {
    List<AuditTemplate> findByOwnerIdAndDeletedAtIsNullOrderByCreatedAtDesc(Long ownerId);
}
