package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.ats.AtsKeywordCatalog;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.stereotype.Component;

@Component
public class LocalAuditAnalyzer {
    private static final Set<String> STOP_WORDS = Set.of(
            "this", "that", "with", "from", "into", "about", "have", "has", "had", "were", "will", "would",
            "could", "should", "their", "there", "than", "then", "they", "them", "your", "ours", "also",
            "and", "the", "for", "are", "was", "but", "not", "you", "our", "can", "all", "any");
    private static final Pattern NUMBER = Pattern.compile("\\b\\d+(?:[.,]\\d+)?%?\\b");
    private final AtsKeywordCatalog atsKeywordCatalog;

    public LocalAuditAnalyzer(AtsKeywordCatalog atsKeywordCatalog) {
        this.atsKeywordCatalog = atsKeywordCatalog;
    }

    public AuditAnalysisResult analyze(List<String> sentences, String evidenceText) {
        List<EvidenceChunk> evidenceChunks = chunks(evidenceText);
        String evidence = evidenceChunks.stream().map(EvidenceChunk::normalized).reduce("", (left, right) -> left + " " + right);
        List<AnalyzedVerdict> verdicts = new ArrayList<>();
        for (int i = 0; i < sentences.size(); i++) {
            String sentence = sentences.get(i);
            verdicts.add(classify(i, sentence, evidence, evidenceChunks));
        }
        return new AuditAnalysisResult("LOCAL_HEURISTIC", verdicts);
    }

    private AnalyzedVerdict classify(int index, String sentence, String evidence, List<EvidenceChunk> evidenceChunks) {
        String normalized = normalize(sentence);
        if (isMetadata(normalized)) {
            return verdict(index, sentence, VerdictStatus.NOT_A_CLAIM, Confidence.HIGH, "metadata", "This line is document structure, not an auditable factual claim.", "No evidence required.");
        }
        boolean risky = atsKeywordCatalog.localAuditRiskyWords().stream().anyMatch(normalized::contains);
        boolean numeric = NUMBER.matcher(normalized).find();
        EvidenceMatch match = bestMatch(normalized, evidenceChunks);
        boolean exactNumber = !numeric || numbers(normalized).stream().allMatch(number -> evidence.contains(number));
        boolean contradiction = contradicts(normalized, match.normalized());
        if (match.score() >= 4 && exactNumber && !risky && !contradiction) {
            return verdict(index, sentence, VerdictStatus.SUPPORTED, Confidence.MEDIUM, "matched evidence", "The evidence contains enough matching terms to support this claim.", match.original());
        }
        if (match.score() >= 2) {
            String reason = risky
                    ? "The wording creates a higher proof burden than the evidence fully satisfies."
                    : contradiction
                    ? "The evidence uses related terms but appears to qualify or contradict the claim."
                    : !exactNumber
                    ? "The evidence partially matches the claim but does not confirm the same number."
                    : "The evidence partially matches the claim but does not fully prove it as written.";
            return verdict(index, sentence, VerdictStatus.STRETCHED, Confidence.MEDIUM, "overstated", reason, match.original());
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

    private EvidenceMatch bestMatch(String sentence, List<EvidenceChunk> chunks) {
        Set<String> words = keywords(sentence);
        EvidenceMatch best = new EvidenceMatch("", "", 0);
        for (EvidenceChunk chunk : chunks) {
            int score = 0;
            for (String word : words) {
                if (chunk.normalized().contains(word)) {
                    score++;
                }
            }
            if (score > best.score()) {
                best = new EvidenceMatch(chunk.original(), chunk.normalized(), score);
            }
        }
        return best.score() == 0 ? new EvidenceMatch("No evidence found.", "", 0) : best;
    }

    private Set<String> keywords(String text) {
        Set<String> words = new HashSet<>();
        for (String word : text.split(" ")) {
            if (word.length() >= 4 && !STOP_WORDS.contains(word)) {
                words.add(word);
            }
        }
        return words;
    }

    private List<String> numbers(String text) {
        return NUMBER.matcher(text).results().map(match -> match.group().replace(",", ".")).toList();
    }

    private boolean contradicts(String claim, String evidence) {
        if (evidence.isBlank()) {
            return false;
        }
        boolean claimPositive = !containsAny(claim, " no ", " not ", " never ", "without", "failed", "lack");
        boolean evidenceNegative = containsAny(evidence, " no ", " not ", " never ", "without", "failed", "lack", "does not", "did not");
        return claimPositive && evidenceNegative;
    }

    private List<EvidenceChunk> chunks(String evidenceText) {
        return Arrays.stream((evidenceText == null ? "" : evidenceText).split("(?<=[.!?])\\s+|\\n+"))
                .map(String::trim)
                .filter(chunk -> !chunk.isBlank())
                .map(chunk -> new EvidenceChunk(chunk, normalize(chunk)))
                .toList();
    }

    private record EvidenceChunk(String original, String normalized) {
    }

    private record EvidenceMatch(String original, String normalized, int score) {
    }
}
