package dev.toktab.brainhack.audit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;

@Component
public class LlmAuditAnalyzer {
    private final String apiKey;
    private final String model;
    private final double temperature;
    private final String url;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;

    public LlmAuditAnalyzer(
            @Value("${verdict.llm.api-key}") String apiKey,
            @Value("${verdict.llm.model}") String model,
            @Value("${verdict.llm.temperature}") double temperature,
            @Value("${verdict.llm.url}") String url,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder) {
        this.apiKey = apiKey;
        this.model = model;
        this.temperature = temperature;
        this.url = url;
        this.objectMapper = objectMapper;
        this.restClient = restClientBuilder.build();
    }

    public boolean configured() {
        return apiKey != null && !apiKey.isBlank();
    }

    public AuditAnalysisResult analyze(List<String> sentences, String evidenceText) {
        if (!configured()) {
            throw new IllegalStateException("LLM API key is not configured");
        }
        String prompt = buildPrompt(sentences, evidenceText);
        Map<String, Object> body = Map.of(
                "model", model,
                "temperature", temperature,
                "response_format", Map.of("type", "json_object"),
                "messages", List.of(
                        Map.of("role", "system", "content", "You are VERDICT, a strict claim-audit engine. Return only valid JSON."),
                        Map.of("role", "user", "content", prompt)
                )
        );
        String response = restClient.post()
                .uri(url)
                .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                .contentType(MediaType.APPLICATION_JSON)
                .body(body)
                .retrieve()
                .body(String.class);
        return new AuditAnalysisResult("LLM_" + model, parse(response, sentences));
    }

    private String buildPrompt(List<String> sentences, String evidenceText) {
        StringBuilder builder = new StringBuilder();
        builder.append("""
                Audit each sentence against the evidence document.
                Status must be one of: SUPPORTED, STRETCHED, UNSUPPORTED, NOT_A_CLAIM.
                Use UNSUPPORTED when evidence is missing. Do not call it false unless contradicted.
                Return JSON exactly like:
                {"verdicts":[{"sentenceIndex":0,"sentence":"...","status":"SUPPORTED","confidence":"HIGH","reasonCategory":"matched evidence","explanation":"one sentence","evidencePointer":"short exact excerpt or No evidence found"}]}

                CLAIM SENTENCES:
                """);
        for (int i = 0; i < sentences.size(); i++) {
            builder.append(i).append(". ").append(sentences.get(i)).append("\n");
        }
        builder.append("\nEVIDENCE DOCUMENT:\n").append(evidenceText);
        return builder.toString();
    }

    List<AnalyzedVerdict> parse(String response, List<String> originalSentences) {
        try {
            JsonNode root = objectMapper.readTree(response);
            String content = root.at("/choices/0/message/content").asText();
            JsonNode verdicts = parseModelContent(content).path("verdicts");
            if (!verdicts.isArray()) {
                throw new IllegalStateException("LLM response did not contain verdicts array");
            }
            List<Map<String, Object>> rows = verdicts.isArray()
                    ? objectMapper.convertValue(verdicts, new TypeReference<>() {})
                    : List.of();
            if (rows.isEmpty() && !originalSentences.isEmpty()) {
                throw new IllegalStateException("LLM response verdicts array was empty");
            }
            List<AnalyzedVerdict> parsed = fallbackVerdicts(originalSentences);
            for (Map<String, Object> row : rows) {
                int index = boundedIndex(row.get("sentenceIndex"), originalSentences.size());
                if (validRow(row, originalSentences.size())) {
                    parsed.set(index, new AnalyzedVerdict(
                            index,
                            originalSentences.get(index),
                            verdictStatus(row.get("status")),
                            confidence(row.get("confidence")),
                            string(row.get("reasonCategory"), "model judgment"),
                            string(row.get("explanation"), "The model did not provide a detailed explanation."),
                            string(row.get("evidencePointer"), "No evidence found.")
                    ));
                }
            }
            return parsed;
        } catch (Exception exception) {
            throw new IllegalStateException("Could not parse LLM audit response", exception);
        }
    }

    private JsonNode parseModelContent(String content) throws Exception {
        try {
            return objectMapper.readTree(content);
        } catch (Exception ignored) {
            return objectMapper.readTree(repairJsonObject(content));
        }
    }

    private String repairJsonObject(String content) {
        String cleaned = content == null ? "" : content.trim();
        if (cleaned.startsWith("```")) {
            cleaned = cleaned.replaceFirst("^```(?:json)?\\s*", "").replaceFirst("\\s*```$", "");
        }
        int start = cleaned.indexOf('{');
        int end = cleaned.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new IllegalStateException("LLM response did not contain a JSON object");
        }
        return cleaned.substring(start, end + 1);
    }

    private boolean validRow(Map<String, Object> row, int sentenceCount) {
        if (row == null || sentenceCount <= 0) {
            return false;
        }
        int index = boundedIndex(row.get("sentenceIndex"), sentenceCount);
        return index >= 0
                && row.containsKey("status")
                && row.containsKey("confidence")
                && !string(row.get("explanation"), "").isBlank()
                && !string(row.get("evidencePointer"), "").isBlank();
    }

    private List<AnalyzedVerdict> fallbackVerdicts(List<String> originalSentences) {
        List<AnalyzedVerdict> verdicts = new ArrayList<>();
        for (int i = 0; i < originalSentences.size(); i++) {
            verdicts.add(new AnalyzedVerdict(
                    i,
                    originalSentences.get(i),
                    VerdictStatus.UNSUPPORTED,
                    Confidence.MEDIUM,
                    "model fallback",
                    "The model response did not include a reliable verdict for this sentence.",
                    "No evidence found."));
        }
        return verdicts;
    }

    private int boundedIndex(Object value, int size) {
        if (size <= 0) {
            return 0;
        }
        if (value instanceof Number number) {
            return Math.min(Math.max(number.intValue(), 0), size - 1);
        }
        try {
            return Math.min(Math.max(Integer.parseInt(String.valueOf(value)), 0), size - 1);
        } catch (RuntimeException exception) {
            return 0;
        }
    }

    private VerdictStatus verdictStatus(Object value) {
        try {
            return VerdictStatus.valueOf(string(value, "UNSUPPORTED").trim().toUpperCase());
        } catch (RuntimeException exception) {
            return VerdictStatus.UNSUPPORTED;
        }
    }

    private Confidence confidence(Object value) {
        try {
            return Confidence.valueOf(string(value, "MEDIUM").trim().toUpperCase());
        } catch (RuntimeException exception) {
            return Confidence.MEDIUM;
        }
    }

    private String string(Object value, String fallback) {
        if (value == null || value.toString().isBlank()) {
            return fallback;
        }
        return value.toString();
    }
}
