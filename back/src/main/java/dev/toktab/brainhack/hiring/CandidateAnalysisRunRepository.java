package dev.toktab.brainhack.hiring;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CandidateAnalysisRunRepository extends JpaRepository<CandidateAnalysisRun, Long> {
    List<CandidateAnalysisRun> findByCandidateIdOrderByCreatedAtDesc(Long candidateId, Pageable pageable);
    Optional<CandidateAnalysisRun> findFirstByCandidateIdAndStateIdOrderByCreatedAtDesc(Long candidateId, String stateId);
}
