package dev.toktab.brainhack.audit;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.math.BigDecimal;
import java.time.Instant;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.junit.jupiter.api.Test;

class ExportServiceTest {
    private final ExportService exportService = new ExportService();

    @Test
    void pdfExportIncludesAllVerdictsBeyondTheOldPreviewLimit() throws IOException {
        Audit audit = auditWithVerdicts(9);

        byte[] pdf = exportService.export(audit, "pdf").body();

        String text;
        try (PDDocument document = PDDocument.load(new ByteArrayInputStream(pdf))) {
            text = new PDFTextStripper().getText(document);
        }
        assertThat(text).contains("#7 SUPPORTED / HIGH");
        assertThat(text).contains("Claim row 7");
        assertThat(text).doesNotContain("more rows in Word/Excel exports");
    }

    private Audit auditWithVerdicts(int count) {
        Audit audit = new Audit();
        audit.setId(42L);
        audit.setClaimTitle("Candidate CV");
        audit.setEvidenceTitle("Portfolio evidence");
        audit.setClaimText("Claim text");
        audit.setEvidenceText("Evidence text");
        audit.setCredibilityScore(88);
        audit.setSupportedCount(count);
        audit.setStretchedCount(0);
        audit.setUnsupportedCount(0);
        audit.setNotClaimCount(0);
        audit.setGapCount(0);
        audit.setClaimFingerprint("claim-fingerprint");
        audit.setEvidenceFingerprint("evidence-fingerprint");
        audit.setProcessingMillis(1234);
        audit.setEngine("LOCAL");
        audit.setPromptTokens(0);
        audit.setCompletionTokens(0);
        audit.setTotalTokens(0);
        audit.setEstimatedCostUsd(BigDecimal.ZERO);
        audit.setStatus(AuditStatus.COMPLETED);
        audit.setProgressStage("completed");
        audit.setProgressPercent(100);
        audit.setProgressMessage("Done");
        audit.setTemplateName("Default ATS");
        audit.setCheckStateName("WAR State");
        audit.setCreatedAt(Instant.parse("2026-07-06T00:00:00Z"));
        for (int i = 0; i < count; i++) {
            Verdict verdict = new Verdict();
            verdict.setSentenceIndex(i);
            verdict.setSentence("Claim row " + (i + 1));
            verdict.setStatus(VerdictStatus.SUPPORTED);
            verdict.setConfidence(Confidence.HIGH);
            verdict.setReasonCategory("matched evidence");
            verdict.setExplanation("Explanation row " + (i + 1));
            verdict.setEvidencePointer("Evidence row " + (i + 1));
            audit.addVerdict(verdict);
        }
        return audit;
    }
}
