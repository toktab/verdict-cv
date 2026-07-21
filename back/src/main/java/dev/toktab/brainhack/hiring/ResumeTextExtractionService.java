package dev.toktab.brainhack.hiring;

import java.io.IOException;
import java.io.InputStream;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class ResumeTextExtractionService {
    private static final long MAX_RESUME_BYTES = 8L * 1024L * 1024L;

    public String extract(MultipartFile resume) {
        if (resume == null || resume.isEmpty()) {
            return "";
        }
        if (resume.getSize() > MAX_RESUME_BYTES) {
            throw new IllegalArgumentException("Resume exceeds the 8 MB limit");
        }
        String filename = resume.getOriginalFilename();
        try (InputStream stream = resume.getInputStream()) {
            if (filename != null && filename.toLowerCase().endsWith(".pdf")) {
                return extractPdf(stream);
            }
            if (filename != null && (filename.toLowerCase().endsWith(".docx"))) {
                return extractDocx(stream);
            }
            return new String(stream.readAllBytes());
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read the uploaded resume: " + exception.getMessage(), exception);
        }
    }

    private String extractPdf(InputStream stream) throws IOException {
        try (PDDocument document = PDDocument.load(stream)) {
            PDFTextStripper stripper = new PDFTextStripper();
            return stripper.getText(document);
        }
    }

    private String extractDocx(InputStream stream) throws IOException {
        try (XWPFDocument document = new XWPFDocument(stream);
             XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
            return extractor.getText();
        }
    }
}
