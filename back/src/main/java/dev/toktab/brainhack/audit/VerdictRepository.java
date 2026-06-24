package dev.toktab.brainhack.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VerdictRepository extends JpaRepository<Verdict, Long> {
    List<Verdict> findByAuditIdOrderBySentenceIndexAsc(Long auditId);
}
