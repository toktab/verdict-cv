package dev.toktab.brainhack.hiring;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface CandidateReviewNoteRepository extends JpaRepository<CandidateReviewNote, Long> {
    List<CandidateReviewNote> findByCandidateIdOrderByCreatedAtDesc(Long candidateId);
}
