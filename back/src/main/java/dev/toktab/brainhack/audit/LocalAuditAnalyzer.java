package dev.toktab.brainhack.audit;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Component;

@Component
public class LocalAuditAnalyzer {
    public AuditAnalysisResult analyze(List<String> sentences, String evidenceText) {
        String evidence = normalize(evidenceText);
        List<AnalyzedVerdict> verdicts = new ArrayList<>();
        for (int i = 0; i < sentences.size(); i++) {
            String sentence = sentences.get(i);
            verdicts.add(classify(i, sentence, evidence));
        }
        return new AuditAnalysisResult("LOCAL_HEURISTIC", verdicts);
    }

    private AnalyzedVerdict classify(int index, String sentence, String evidence) {
        String normalized = normalize(sentence);
        if (isMetadata(normalized)) {
            return verdict(index, sentence, VerdictStatus.NOT_A_CLAIM, Confidence.HIGH, "metadata", "This line is document structure, not an auditable factual claim.", "No evidence required.");
        }
        boolean risky = containsAny(normalized, "expert", "advanced", "proven", "led", "optimized", "guaranteed", "best", "senior");
        boolean numeric = normalized.matches(".*\\d+.*");
        int overlap = overlapScore(normalized, evidence);
        if (overlap >= 4 && !risky) {
            return verdict(index, sentence, VerdictStatus.SUPPORTED, Confidence.MEDIUM, "matched evidence", "The evidence contains enough matching terms to support this claim.", excerpt(sentence, evidence));
        }
        if (overlap >= 2) {
            String reason = risky ? "The wording creates a higher proof burden than the evidence fully satisfies." : "The evidence partially matches the claim but does not fully prove it as written.";
            return verdict(index, sentence, VerdictStatus.STRETCHED, Confidence.MEDIUM, "overstated", reason, excerpt(sentence, evidence));
        }
        if (numeric || risky || normalized.length() > 20) {
            return verdict(index, sentence, VerdictStatus.UNSUPPORTED, Confidence.HIGH, "missing evidence", "The evidence document does not provide clear support for this claim.", "No evidence found.");
        }
        return verdict(index, sentence, VerdictStatus.NOT_A_CLAIM, Confidence.LOW, "too vague", "This text is too vague to audit as a concrete factual claim.", "No evidence required.");
    }

    private boolean isMetadata(String text) {
        return text.length() < 4
                || text.matches("^(education|skills|experience|projects|summary|contact|languages|certifications)[: ]*$")
                || text.matches("^[\\w .-]+@[\\w .-]+$")
                || text.matches("^[+\\d ()-]{7,}$");
    }

    private AnalyzedVerdict verdict(int index, String sentence, VerdictStatus status, Confidence confidence, String reason, String explanation, String pointer) {
        return new AnalyzedVerdict(index, sentence, status, confidence, reason, explanation, pointer);
    }

    private String normalize(String text) {
        return text.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9+#. ]", " ").replaceAll("\\s+", " ").trim();
    }

    private boolean containsAny(String text, String... needles) {
        for (String needle : needles) {
            if (text.contains(needle)) {
                return true;
            }
        }
        return false;
    }

    private int overlapScore(String sentence, String evidence) {
        int score = 0;
        for (String word : sentence.split(" ")) {
            if (word.length() >= 4 && evidence.contains(word)) {
                score++;
            }
        }
        return score;
    }

    private String excerpt(String sentence, String evidence) {
        for (String word : normalize(sentence).split(" ")) {
            if (word.length() >= 5) {
                int index = evidence.indexOf(word);
                if (index >= 0) {
                    int start = Math.max(0, index - 55);
                    int end = Math.min(evidence.length(), index + 120);
                    return evidence.substring(start, end).trim();
                }
            }
        }
        return "Related terms found in evidence.";
    }
}
