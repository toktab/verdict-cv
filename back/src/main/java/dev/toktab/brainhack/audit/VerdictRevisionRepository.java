package dev.toktab.brainhack.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VerdictRevisionRepository extends JpaRepository<VerdictRevision, Long> {
    List<VerdictRevision> findByVerdictIdOrderByCreatedAtAsc(Long verdictId);
}

