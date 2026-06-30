package dev.toktab.brainhack.audit;

import java.util.List;

public record AuditAnalysisResult(String engine, List<AnalyzedVerdict> verdicts, LlmUsage usage) {
    public AuditAnalysisResult(String engine, List<AnalyzedVerdict> verdicts) {
        this(engine, verdicts, LlmUsage.zero());
    }
}
