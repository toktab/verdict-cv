package dev.toktab.brainhack.audit;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class AuditTextExtractionService {
    public ExtractedText extract(MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Audit file is required.");
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
            return new ExtractedText(filename, file.getContentType(), text.trim());
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

    public record ExtractedText(String filename, String contentType, String text) {
    }
}
