package dev.toktab.brainhack.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AuditRunRequest(
        @Size(max = 160) String claimTitle,
        @Size(max = 160) String evidenceTitle,
        @NotBlank @Size(min = 20, max = 12000) String claimText,
        @NotBlank @Size(min = 20, max = 20000) String evidenceText,
        @Size(max = 40) String auditMode,
        @Size(max = 80) String templateId,
        @Size(max = 80) String checkStateId,
        Long projectId,
        Long candidateId,
        Long candidateAnalysisRunId
) {
    public AuditRunRequest(
            String claimTitle,
            String evidenceTitle,
            String claimText,
            String evidenceText,
            String auditMode,
            String templateId,
            String checkStateId) {
        this(claimTitle, evidenceTitle, claimText, evidenceText, auditMode, templateId, checkStateId, null, null, null);
    }
}
