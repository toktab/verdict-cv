package dev.toktab.brainhack.api.dto;

import dev.toktab.brainhack.audit.Confidence;
import dev.toktab.brainhack.audit.VerdictStatus;

public record VerdictResponse(
        Long id,
        int sentenceIndex,
        String sentence,
        VerdictStatus status,
        Confidence confidence,
        String reasonCategory,
        String explanation,
        String evidencePointer
) {
}
