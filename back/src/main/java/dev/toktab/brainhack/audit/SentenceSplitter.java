package dev.toktab.brainhack.audit;

import java.util.ArrayList;
import java.util.List;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

@Component
public class SentenceSplitter {
    private final int maxSentences;

    public SentenceSplitter(@Value("${verdict.audit.max-sentences}") int maxSentences) {
        this.maxSentences = maxSentences;
    }

    public List<String> split(String text) {
        List<String> result = new ArrayList<>();
        String normalized = text.replace("\r\n", "\n").replace('\r', '\n');
        for (String line : normalized.split("\\n+")) {
            String cleaned = line.replaceFirst("^\\s*[-*•\\d.)]+\\s*", "").trim();
            if (cleaned.isBlank()) {
                continue;
            }
            if (cleaned.split("(?<=[.!?])\\s+").length <= 1) {
                add(result, cleaned);
            } else {
                for (String part : cleaned.split("(?<=[.!?])\\s+")) {
                    add(result, part.trim());
                }
            }
            if (result.size() >= maxSentences) {
                break;
            }
        }
        return result;
    }

    private void add(List<String> result, String sentence) {
        if (!sentence.isBlank() && result.size() < maxSentences) {
            result.add(sentence);
        }
    }
}
