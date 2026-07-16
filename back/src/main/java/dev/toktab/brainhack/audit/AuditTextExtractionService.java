package dev.toktab.brainhack.audit;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AuditTextExtractionService {
    private static final long MAX_UPLOAD_BYTES = 8L * 1024L * 1024L;

    public ExtractedText extract(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Audit file is required.");
        }
        if (file.getSize() > MAX_UPLOAD_BYTES) {
            throw new IllegalArgumentException("Audit file is too large. Upload a PDF, DOCX, or TXT file no larger than 8 MB.");
        }
        String filename = file.getOriginalFilename() == null ? "" : file.getOriginalFilename();
        String normalized = filename.toLowerCase(Locale.ROOT);
        try {
            String text;
            if (normalized.endsWith(".pdf")) {
                text = pdf(file);
            } else if (normalized.endsWith(".docx")) {
                text = docx(file);
            } else if (normalized.endsWith(".txt")) {
                text = new String(file.getBytes(), StandardCharsets.UTF_8);
            } else {
                throw new IllegalArgumentException("Unsupported file format. Upload PDF, DOCX, or TXT.");
            }
            String cleaned = text.trim();
            return new ExtractedText(filename, file.getContentType(), cleaned, warnings(cleaned, file.getSize()));
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read audit file.");
        }
    }

    private String pdf(MultipartFile file) throws IOException {
        try (InputStream input = file.getInputStream(); PDDocument document = PDDocument.load(input)) {
            return new PDFTextStripper().getText(document);
        }
    }

    private String docx(MultipartFile file) throws IOException {
        try (InputStream input = file.getInputStream();
             XWPFDocument document = new XWPFDocument(input);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }

    private List<String> warnings(String text, long size) {
        List<String> warnings = new ArrayList<>();
        if (text.isBlank()) {
            warnings.add("No readable text was extracted. The file may be scanned, image-only, or protected.");
            return warnings;
        }
        if (text.length() < 80) {
            warnings.add("Extraction returned very little text. Confirm the document content before auditing.");
        }
        if (size > 0 && text.length() > 0 && size > 250_000 && text.length() < 500) {
            warnings.add("Extraction looks truncated for the uploaded file size.");
        }
        long printable = text.chars().filter(ch -> ch == '\n' || ch == '\r' || ch == '\t' || (ch >= 32 && ch < 127)).count();
        if (printable < text.length() * 0.75) {
            warnings.add("Extraction may be garbled. Review unusual characters before running the audit.");
        }
        long metadataLines = text.lines()
                .map(String::trim)
                .filter(line -> line.matches("(?i)^(page \\d+|confidential|copyright|header|footer|table of contents|\\d+)$"))
                .count();
        long totalLines = Math.max(1, text.lines().count());
        if (metadataLines > 0 && metadataLines >= totalLines / 2) {
            warnings.add("Extraction appears mostly metadata, headers, footers, or page markers.");
        }
        return warnings;
    }

    public record ExtractedText(String filename, String contentType, String text, List<String> warnings) {
    }
}
