package dev.toktab.brainhack.audit;

import java.util.List;

public record AuditAnalysisResult(String engine, List<AnalyzedVerdict> verdicts) {
}
