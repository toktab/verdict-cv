package dev.toktab.brainhack.audit;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface VerdictOverrideRepository extends JpaRepository<VerdictOverride, Long> {
    List<VerdictOverride> findByVerdictIdOrderByCreatedAtDesc(Long verdictId);
}
