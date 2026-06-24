package dev.toktab.brainhack.audit;

import org.springframework.stereotype.Service;

@Service
public class ExportService {
    public String export(Audit audit) {
        StringBuilder builder = new StringBuilder();
        builder.append("VERDICT AUDIT REPORT\n");
        builder.append("====================\n\n");
        builder.append("Audit ID: ").append(audit.getId()).append('\n');
        builder.append("Created: ").append(audit.getCreatedAt()).append('\n');
        builder.append("Claim: ").append(audit.getClaimTitle()).append('\n');
        builder.append("Evidence: ").append(audit.getEvidenceTitle()).append('\n');
        builder.append("Engine: ").append(audit.getEngine()).append('\n');
        builder.append("Credibility Score: ").append(audit.getCredibilityScore()).append("%\n");
        builder.append("Claim SHA-256: ").append(audit.getClaimFingerprint()).append('\n');
        builder.append("Evidence SHA-256: ").append(audit.getEvidenceFingerprint()).append("\n\n");
        builder.append("Formula: (SUPPORTED * 1.0 + STRETCHED * 0.4 + UNSUPPORTED * 0) / real claims * 100\n\n");
        for (Verdict verdict : audit.getVerdicts()) {
            builder.append("#").append(verdict.getSentenceIndex() + 1).append(" [").append(verdict.getStatus()).append("]\n");
            builder.append("Claim: ").append(verdict.getSentence()).append('\n');
            builder.append("Reason: ").append(verdict.getExplanation()).append('\n');
            builder.append("Evidence: ").append(verdict.getEvidencePointer()).append("\n\n");
        }
        return builder.toString();
    }
}
