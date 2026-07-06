package dev.toktab.brainhack.audit;

import java.util.List;

public interface ClaimAnalyzer {
    AuditAnalysisResult analyze(List<String> sentences, String evidenceText);
}
