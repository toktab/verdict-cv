package dev.toktab.brainhack.hiring;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CandidateOsintSourceRepository extends JpaRepository<CandidateOsintSource, Long> {
    List<CandidateOsintSource> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);
    void deleteByCandidateId(Long candidateId);
}
