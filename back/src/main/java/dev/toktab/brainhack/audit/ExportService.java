package dev.toktab.brainhack.audit;

import java.awt.Color;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.common.PDRectangle;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.springframework.stereotype.Service;

@Service
public class ExportService {
    private static final Color INK = new Color(22, 28, 44);
    private static final Color MUTED = new Color(100, 116, 139);
    private static final Color PAPER = new Color(250, 252, 255);
    private static final Color SUPPORTED = new Color(16, 185, 129);
    private static final Color STRETCHED = new Color(245, 158, 11);
    private static final Color UNSUPPORTED = new Color(239, 68, 68);
    private static final Color GAP = new Color(99, 102, 241);
    private static final Color NOT_CLAIM = new Color(148, 163, 184);

    public ExportFile export(Audit audit, String format) {
        return switch (normalizedFormat(format)) {
            case "pdf" -> new ExportFile(pdf(audit), "application/pdf", filename(audit, "pdf"));
            case "word", "doc" -> new ExportFile(word(audit), "application/msword", filename(audit, "doc"));
            case "excel", "csv", "xlsx" -> new ExportFile(csv(audit), "text/csv; charset=UTF-8", filename(audit, "csv"));
            default -> new ExportFile(txt(audit), "text/plain; charset=UTF-8", filename(audit, "txt"));
        };
    }

    public String export(Audit audit) {
        return text(audit);
    }

    private byte[] txt(Audit audit) {
        return text(audit).getBytes(StandardCharsets.UTF_8);
    }

    private String text(Audit audit) {
        StringBuilder builder = new StringBuilder();
        builder.append("VERDICT AUDIT REPORT\n");
        builder.append("====================\n\n");
        builder.append("Audit ID: ").append(audit.getId()).append('\n');
        builder.append("Created: ").append(audit.getCreatedAt()).append('\n');
        builder.append("Claim: ").append(audit.getClaimTitle()).append('\n');
        builder.append("Evidence: ").append(audit.getEvidenceTitle()).append('\n');
        builder.append("Engine: ").append(audit.getEngine()).append('\n');
        builder.append("Template: ").append(orDefault(audit.getTemplateName(), "None")).append('\n');
        builder.append("State: ").append(orDefault(audit.getCheckStateName(), "Default")).append('\n');
        builder.append("Credibility Score: ").append(audit.getCredibilityScore()).append("%\n");
        builder.append("Counts: ").append(audit.getSupportedCount()).append(" supported, ")
                .append(audit.getStretchedCount()).append(" stretched, ")
                .append(audit.getUnsupportedCount()).append(" unsupported, ")
                .append(audit.getGapCount()).append(" gaps, ")
                .append(audit.getNotClaimCount()).append(" not-a-claim\n");
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

    private byte[] word(Audit audit) {
        StringBuilder builder = new StringBuilder();
        builder.append("<html><head><meta charset=\"UTF-8\"><style>");
        builder.append("body{font-family:Arial,sans-serif;color:#111827}h1{color:#0f172a}table{border-collapse:collapse;width:100%}");
        builder.append("td,th{border:1px solid #cbd5e1;padding:7px;text-align:left;vertical-align:top}.score{font-size:34px;color:#ef4444;font-weight:bold}");
        builder.append("</style></head><body>");
        builder.append("<h1>VERDICT Audit Report</h1>");
        builder.append("<p class=\"score\">Credibility ").append(audit.getCredibilityScore()).append("%</p>");
        builder.append("<p><b>Claim:</b> ").append(html(audit.getClaimTitle())).append("<br>");
        builder.append("<b>Evidence:</b> ").append(html(audit.getEvidenceTitle())).append("<br>");
        builder.append("<b>Template:</b> ").append(html(orDefault(audit.getTemplateName(), "None"))).append("<br>");
        builder.append("<b>State:</b> ").append(html(orDefault(audit.getCheckStateName(), "Default"))).append("</p>");
        builder.append("<table><thead><tr><th>#</th><th>Status</th><th>Confidence</th><th>Claim</th><th>Reason</th><th>Evidence</th></tr></thead><tbody>");
        for (Verdict verdict : audit.getVerdicts()) {
            builder.append("<tr><td>").append(verdict.getSentenceIndex() + 1).append("</td><td>").append(verdict.getStatus())
                    .append("</td><td>").append(verdict.getConfidence()).append("</td><td>").append(html(verdict.getSentence()))
                    .append("</td><td>").append(html(verdict.getExplanation())).append("</td><td>").append(html(verdict.getEvidencePointer())).append("</td></tr>");
        }
        builder.append("</tbody></table></body></html>");
        return builder.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] csv(Audit audit) {
        StringBuilder builder = new StringBuilder();
        builder.append("audit_id,created,claim_title,evidence_title,engine,template,state,credibility_score,supported,stretched,unsupported,gap,not_a_claim,claim_hash,evidence_hash\n");
        builder.append(csvValue(audit.getId())).append(',').append(csvValue(audit.getCreatedAt())).append(',').append(csvValue(audit.getClaimTitle())).append(',')
                .append(csvValue(audit.getEvidenceTitle())).append(',').append(csvValue(audit.getEngine())).append(',').append(csvValue(audit.getTemplateName())).append(',')
                .append(csvValue(audit.getCheckStateName())).append(',').append(audit.getCredibilityScore()).append(',').append(audit.getSupportedCount()).append(',')
                .append(audit.getStretchedCount()).append(',').append(audit.getUnsupportedCount()).append(',').append(audit.getGapCount()).append(',')
                .append(audit.getNotClaimCount()).append(',').append(csvValue(audit.getClaimFingerprint())).append(',').append(csvValue(audit.getEvidenceFingerprint())).append("\n\n");
        builder.append("sentence_index,status,confidence,reason_category,claim,explanation,evidence_pointer\n");
        for (Verdict verdict : audit.getVerdicts()) {
            builder.append(verdict.getSentenceIndex() + 1).append(',').append(csvValue(verdict.getStatus())).append(',').append(csvValue(verdict.getConfidence())).append(',')
                    .append(csvValue(verdict.getReasonCategory())).append(',').append(csvValue(verdict.getSentence())).append(',')
                    .append(csvValue(verdict.getExplanation())).append(',').append(csvValue(verdict.getEvidencePointer())).append('\n');
        }
        return builder.toString().getBytes(StandardCharsets.UTF_8);
    }

    private byte[] pdf(Audit audit) {
        try (PDDocument document = new PDDocument(); ByteArrayOutputStream output = new ByteArrayOutputStream()) {
            PDPage page = new PDPage(PDRectangle.LETTER);
            document.addPage(page);
            try (PDPageContentStream content = new PDPageContentStream(document, page)) {
                drawBackground(content);
                drawHeader(content, audit);
                drawScoreCard(content, audit);
                drawStatusChart(content, audit);
                drawMetadata(content, audit);
                drawVerdictPreview(content, audit);
            }
            document.save(output);
            return output.toByteArray();
        } catch (IOException ex) {
            throw new IllegalStateException("Could not render PDF export", ex);
        }
    }

    private void drawBackground(PDPageContentStream content) throws IOException {
        content.setNonStrokingColor(PAPER);
        content.addRect(0, 0, PDRectangle.LETTER.getWidth(), PDRectangle.LETTER.getHeight());
        content.fill();
        content.setNonStrokingColor(new Color(239, 68, 68));
        content.addRect(0, 742, 612, 50);
        content.fill();
        content.setNonStrokingColor(new Color(99, 102, 241));
        content.addRect(390, 742, 222, 50);
        content.fill();
        content.setNonStrokingColor(new Color(16, 185, 129));
        content.addRect(510, 742, 102, 50);
        content.fill();
    }

    private void drawHeader(PDPageContentStream content, Audit audit) throws IOException {
        text(content, "VERDICT", 42, 754, 24, PDType1Font.HELVETICA_BOLD, Color.WHITE);
        text(content, "Presentation Audit Report", 172, 761, 12, PDType1Font.HELVETICA_BOLD, Color.WHITE);
        text(content, "Audit #" + audit.getId() + " / " + orDefault(audit.getStatus(), AuditStatus.COMPLETED), 42, 706, 12, PDType1Font.HELVETICA_BOLD, MUTED);
        text(content, pdfText(audit.getClaimTitle()), 42, 680, 24, PDType1Font.HELVETICA_BOLD, INK);
        text(content, pdfText(audit.getEvidenceTitle()), 42, 660, 12, PDType1Font.HELVETICA, MUTED);
    }

    private void drawScoreCard(PDPageContentStream content, Audit audit) throws IOException {
        float x = 42;
        float y = 540;
        roundedBox(content, x, y, 238, 94, Color.WHITE, new Color(226, 232, 240));
        text(content, "Credibility score", x + 18, y + 66, 12, PDType1Font.HELVETICA_BOLD, MUTED);
        text(content, audit.getCredibilityScore() + "%", x + 18, y + 24, 38, PDType1Font.HELVETICA_BOLD, scoreColor(audit.getCredibilityScore()));
        content.setNonStrokingColor(new Color(226, 232, 240));
        content.addRect(x + 118, y + 30, 96, 14);
        content.fill();
        content.setNonStrokingColor(scoreColor(audit.getCredibilityScore()));
        content.addRect(x + 118, y + 30, Math.max(2, audit.getCredibilityScore() * 0.96f), 14);
        content.fill();

        roundedBox(content, 304, y, 266, 94, Color.WHITE, new Color(226, 232, 240));
        text(content, "Export lens", 322, y + 66, 12, PDType1Font.HELVETICA_BOLD, MUTED);
        text(content, trim(orDefault(audit.getTemplateName(), "Default template"), 30), 322, y + 43, 16, PDType1Font.HELVETICA_BOLD, INK);
        text(content, trim(orDefault(audit.getCheckStateName(), "Default state"), 30), 322, y + 23, 12, PDType1Font.HELVETICA, MUTED);
    }

    private void drawStatusChart(PDPageContentStream content, Audit audit) throws IOException {
        float x = 42;
        float y = 368;
        roundedBox(content, x, y, 528, 142, Color.WHITE, new Color(226, 232, 240));
        text(content, "Verdict mix", x + 18, y + 112, 15, PDType1Font.HELVETICA_BOLD, INK);
        ChartRow[] rows = {
                new ChartRow("SUPPORTED", audit.getSupportedCount(), SUPPORTED),
                new ChartRow("STRETCHED", audit.getStretchedCount(), STRETCHED),
                new ChartRow("UNSUPPORTED", audit.getUnsupportedCount(), UNSUPPORTED),
                new ChartRow("GAP", audit.getGapCount(), GAP),
                new ChartRow("NOT A CLAIM", audit.getNotClaimCount(), NOT_CLAIM)
        };
        int max = 1;
        for (ChartRow row : rows) {
            max = Math.max(max, row.value());
        }
        for (int i = 0; i < rows.length; i++) {
            ChartRow row = rows[i];
            float rowY = y + 86 - i * 20;
            text(content, row.label(), x + 18, rowY, 9, PDType1Font.HELVETICA_BOLD, MUTED);
            content.setNonStrokingColor(new Color(241, 245, 249));
            content.addRect(x + 120, rowY - 3, 330, 10);
            content.fill();
            content.setNonStrokingColor(row.color());
            content.addRect(x + 120, rowY - 3, Math.max(row.value() == 0 ? 0 : 3, row.value() * 330f / max), 10);
            content.fill();
            text(content, String.valueOf(row.value()), x + 464, rowY - 1, 10, PDType1Font.HELVETICA_BOLD, INK);
        }
    }

    private void drawMetadata(PDPageContentStream content, Audit audit) throws IOException {
        float x = 42;
        float y = 262;
        roundedBox(content, x, y, 528, 78, Color.WHITE, new Color(226, 232, 240));
        text(content, "Audit metadata", x + 18, y + 54, 13, PDType1Font.HELVETICA_BOLD, INK);
        text(content, "Created: " + audit.getCreatedAt(), x + 18, y + 34, 9, PDType1Font.HELVETICA, MUTED);
        text(content, "Engine: " + audit.getEngine() + " / Runtime: " + audit.getProcessingMillis() + "ms", x + 18, y + 18, 9, PDType1Font.HELVETICA, MUTED);
        text(content, "Claim hash: " + shortHash(audit.getClaimFingerprint()), x + 304, y + 34, 9, PDType1Font.HELVETICA, MUTED);
        text(content, "Evidence hash: " + shortHash(audit.getEvidenceFingerprint()), x + 304, y + 18, 9, PDType1Font.HELVETICA, MUTED);
    }

    private void drawVerdictPreview(PDPageContentStream content, Audit audit) throws IOException {
        float y = 220;
        text(content, "Claim preview", 42, y, 14, PDType1Font.HELVETICA_BOLD, INK);
        int rendered = 0;
        for (Verdict verdict : audit.getVerdicts()) {
            if (rendered >= 5) {
                text(content, "+" + (audit.getVerdicts().size() - rendered) + " more rows in Word/Excel exports", 42, y - 10, 9, PDType1Font.HELVETICA_BOLD, MUTED);
                break;
            }
            y -= 36;
            content.setNonStrokingColor(statusColor(verdict));
            content.addRect(42, y + 10, 8, 24);
            content.fill();
            text(content, "#" + (verdict.getSentenceIndex() + 1) + " " + verdict.getStatus() + " / " + verdict.getConfidence(), 60, y + 25, 9, PDType1Font.HELVETICA_BOLD, statusColor(verdict));
            text(content, trim(verdict.getSentence(), 92), 60, y + 10, 9, PDType1Font.HELVETICA, INK);
            rendered++;
        }
    }

    private void roundedBox(PDPageContentStream content, float x, float y, float width, float height, Color fill, Color stroke) throws IOException {
        content.setNonStrokingColor(fill);
        content.addRect(x, y, width, height);
        content.fill();
        content.setStrokingColor(stroke);
        content.addRect(x, y, width, height);
        content.stroke();
    }

    private void text(PDPageContentStream content, Object value, float x, float y, int size, PDType1Font font, Color color) throws IOException {
        content.beginText();
        content.setFont(font, size);
        content.setNonStrokingColor(color);
        content.newLineAtOffset(x, y);
        content.showText(pdfText(String.valueOf(value)));
        content.endText();
    }

    private Color statusColor(Verdict verdict) {
        return switch (verdict.getStatus()) {
            case SUPPORTED -> SUPPORTED;
            case STRETCHED -> STRETCHED;
            case UNSUPPORTED -> UNSUPPORTED;
            case GAP -> GAP;
            case NOT_A_CLAIM -> NOT_CLAIM;
        };
    }

    private Color scoreColor(int score) {
        if (score >= 80) {
            return SUPPORTED;
        }
        if (score >= 50) {
            return STRETCHED;
        }
        return UNSUPPORTED;
    }

    private String normalizedFormat(String format) {
        return format == null ? "txt" : format.trim().toLowerCase(Locale.ROOT);
    }

    private String filename(Audit audit, String extension) {
        return "verdict-audit-" + audit.getId() + "." + extension;
    }

    private String html(String value) {
        return orDefault(value, "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private String csvValue(Object value) {
        String raw = String.valueOf(value == null ? "" : value);
        return "\"" + raw.replace("\"", "\"\"") + "\"";
    }

    private String pdfText(String value) {
        return orDefault(value, "").replaceAll("[^\\x20-\\x7E]", " ");
    }

    private String trim(String value, int length) {
        String safe = orDefault(value, "");
        return safe.length() <= length ? safe : safe.substring(0, Math.max(0, length - 3)) + "...";
    }

    private String shortHash(String value) {
        return value == null || value.length() <= 12 ? orDefault(value, "None") : value.substring(0, 12) + "...";
    }

    private <T> T orDefault(T value, T fallback) {
        return value == null ? fallback : value;
    }

    public record ExportFile(byte[] body, String contentType, String filename) {
    }

    private record ChartRow(String label, int value, Color color) {
    }
}
