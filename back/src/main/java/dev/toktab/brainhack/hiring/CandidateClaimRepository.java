package dev.toktab.brainhack.hiring;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CandidateClaimRepository extends JpaRepository<CandidateClaim, Long> {
    List<CandidateClaim> findByCandidateIdOrderBySentenceIndexAsc(Long candidateId);
    List<CandidateClaim> findByCandidateIdAndStatusOrderBySentenceIndexAsc(Long candidateId, String status);
    void deleteByCandidateId(Long candidateId);
}
