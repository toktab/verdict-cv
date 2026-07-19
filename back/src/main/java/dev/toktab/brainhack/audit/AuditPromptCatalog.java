package dev.toktab.brainhack.audit;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Component;

@Component
public class AuditPromptCatalog {
    public static final String VERSION = "verdict-state-audit-v2";

    private final String baseSystem = read("prompts/audit/base-system-v2.txt");
    private final String personInstructions = read("prompts/audit/person-v2.txt");
    private final String strictInstructions = read("prompts/audit/strict-war-ai-v2.txt");
    private final String outputContract = read("prompts/audit/output-contract-v2.txt");

    public String systemPrompt(String stateId) {
        String posture = CheckStateIds.PERSON.equals(stateId)
                ? "Review context like a careful human evaluator. Recognize reasonable paraphrases and transferable evidence, but never invent facts."
                : "Apply a high proof burden. Strong, numeric, superlative, leadership, and outcome claims require direct evidence.";
        return baseSystem + "\n\n" + posture;
    }

    public String stateInstructions(String stateId) {
        return CheckStateIds.PERSON.equals(stateId) ? personInstructions : strictInstructions;
    }

    public String outputContract() {
        return outputContract;
    }

    private String read(String path) {
        try {
            return new ClassPathResource(path).getContentAsString(StandardCharsets.UTF_8).trim();
        } catch (IOException exception) {
            throw new IllegalStateException("Required audit prompt is missing: " + path, exception);
        }
    }
}
