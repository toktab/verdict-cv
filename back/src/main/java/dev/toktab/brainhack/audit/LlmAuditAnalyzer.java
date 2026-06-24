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

    private List<AnalyzedVerdict> parse(String response, List<String> originalSentences) {
        try {
            JsonNode root = objectMapper.readTree(response);
            String content = root.at("/choices/0/message/content").asText();
            JsonNode verdicts = objectMapper.readTree(content).get("verdicts");
            List<Map<String, Object>> rows = objectMapper.convertValue(verdicts, new TypeReference<>() {});
            List<AnalyzedVerdict> parsed = new ArrayList<>();
            for (Map<String, Object> row : rows) {
                int index = ((Number) row.getOrDefault("sentenceIndex", parsed.size())).intValue();
                parsed.add(new AnalyzedVerdict(
                        index,
                        string(row.get("sentence"), originalSentences.get(Math.min(index, originalSentences.size() - 1))),
                        VerdictStatus.valueOf(string(row.get("status"), "UNSUPPORTED")),
                        Confidence.valueOf(string(row.get("confidence"), "MEDIUM")),
                        string(row.get("reasonCategory"), "model judgment"),
                        string(row.get("explanation"), "The model did not provide a detailed explanation."),
                        string(row.get("evidencePointer"), "No evidence found.")
                ));
            }
            return parsed;
        } catch (Exception exception) {
            throw new IllegalStateException("Could not parse LLM audit response", exception);
        }
    }

    private String string(Object value, String fallback) {
        if (value == null || value.toString().isBlank()) {
            return fallback;
        }
        return value.toString();
    }
}
