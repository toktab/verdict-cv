package dev.toktab.brainhack.audit;

import java.util.List;
import org.springframework.stereotype.Service;

@Service
public class ScoringService {
    public int score(List<AnalyzedVerdict> verdicts) {
        double points = 0;
        int claims = 0;
        for (AnalyzedVerdict verdict : verdicts) {
            if (verdict.status() == VerdictStatus.NOT_A_CLAIM || verdict.status() == VerdictStatus.GAP) {
                continue;
            }
            claims++;
            if (verdict.status() == VerdictStatus.SUPPORTED) {
                points += 1.0;
            } else if (verdict.status() == VerdictStatus.STRETCHED) {
                points += 0.4;
            }
        }
        if (claims == 0) {
            return 0;
        }
        return (int) Math.round(points / claims * 100);
    }
}
