package dev.toktab.brainhack.audit;

public record AnalyzedVerdict(
        int sentenceIndex,
        String sentence,
        VerdictStatus status,
        Confidence confidence,
        String reasonCategory,
        String explanation,
        String evidencePointer
) {
}
