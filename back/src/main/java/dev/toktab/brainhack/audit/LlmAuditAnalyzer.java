package dev.toktab.brainhack.audit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.log.AuditLogService;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClientException;
import org.springframework.web.client.RestClient;
import org.springframework.http.client.SimpleClientHttpRequestFactory;

@Component
public class LlmAuditAnalyzer implements ClaimAnalyzer {
    private final String apiKey;
    private final String model;
    private final double temperature;
    private final String url;
    private final int timeoutSeconds;
    private final int maxAttempts;
    private final int backoffMillis;
    private final BigDecimal inputCostPerMillion;
    private final BigDecimal outputCostPerMillion;
    private final ObjectMapper objectMapper;
    private final RestClient restClient;
    private final AuditLogService logService;

    public LlmAuditAnalyzer(
            @Value("${verdict.llm.api-key}") String apiKey,
            @Value("${verdict.llm.model}") String model,
            @Value("${verdict.llm.temperature}") double temperature,
            @Value("${verdict.llm.url}") String url,
            @Value("${verdict.llm.timeout-seconds}") int timeoutSeconds,
            @Value("${verdict.llm.max-attempts}") int maxAttempts,
            @Value("${verdict.llm.backoff-millis}") int backoffMillis,
            @Value("${verdict.llm.input-cost-per-million}") BigDecimal inputCostPerMillion,
            @Value("${verdict.llm.output-cost-per-million}") BigDecimal outputCostPerMillion,
            ObjectMapper objectMapper,
            RestClient.Builder restClientBuilder,
            AuditLogService logService) {
        this.apiKey = apiKey;
        this.model = model;
        this.temperature = temperature;
        this.url = url;
        this.timeoutSeconds = Math.max(1, timeoutSeconds);
        this.maxAttempts = Math.max(1, maxAttempts);
        this.backoffMillis = Math.max(0, backoffMillis);
        this.inputCostPerMillion = inputCostPerMillion == null ? BigDecimal.ZERO : inputCostPerMillion;
        this.outputCostPerMillion = outputCostPerMillion == null ? BigDecimal.ZERO : outputCostPerMillion;
        this.objectMapper = objectMapper;
        this.logService = logService;
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(java.time.Duration.ofSeconds(this.timeoutSeconds));
        requestFactory.setReadTimeout(java.time.Duration.ofSeconds(this.timeoutSeconds));
        this.restClient = restClientBuilder.requestFactory(requestFactory).build();
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
        String response = requestWithRetry(body);
        return new AuditAnalysisResult("LLM_" + model, parse(response, sentences), usage(response));
    }

    private String requestWithRetry(Map<String, Object> body) {
        RuntimeException last = null;
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            long started = System.currentTimeMillis();
            try {
                String response = restClient.post()
                        .uri(url)
                        .header(HttpHeaders.AUTHORIZATION, "Bearer " + apiKey)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(body)
                        .retrieve()
                        .body(String.class);
                recordLlmEvent("LLM_REQUEST_SUCCEEDED",
                        "model=" + model
                                + "; attempt=" + attempt
                                + "; durationMillis=" + (System.currentTimeMillis() - started));
                return response;
            } catch (RestClientException exception) {
                last = exception;
                long retryDelayMillis = retryDelayMillis(attempt);
                recordLlmEvent("LLM_REQUEST_FAILED",
                        "model=" + model
                                + "; attempt=" + attempt
                                + "; maxAttempts=" + maxAttempts
                                + "; durationMillis=" + (System.currentTimeMillis() - started)
                                + "; retryDelayMillis=" + retryDelayMillis
                                + "; error=" + exception.getClass().getSimpleName());
                sleepBeforeRetry(attempt);
            }
        }
        recordLlmEvent("LLM_REQUEST_EXHAUSTED",
                "model=" + model
                        + "; maxAttempts=" + maxAttempts
                        + "; error=" + (last == null ? "unknown" : last.getClass().getSimpleName()));
        throw new IllegalStateException("LLM request failed after " + maxAttempts + " attempt(s)", last);
    }

    private void sleepBeforeRetry(int attempt) {
        if (attempt >= maxAttempts || backoffMillis <= 0) {
            return;
        }
        try {
            Thread.sleep(retryDelayMillis(attempt));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("LLM request retry interrupted", exception);
        }
    }

    long retryDelayMillis(int attempt) {
        if (attempt >= maxAttempts || backoffMillis <= 0) {
            return 0;
        }
        return (long) backoffMillis * Math.max(1, attempt);
    }

    LlmRuntimeConfiguration runtimeConfiguration() {
        return new LlmRuntimeConfiguration(timeoutSeconds, maxAttempts, backoffMillis);
    }

    private void recordLlmEvent(String eventType, String detail) {
        if (logService == null) {
            return;
        }
        try {
            logService.recordSystem(eventType, detail);
        } catch (RuntimeException ignored) {
            // Observability must never turn a recoverable LLM request into an audit failure.
        }
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

    LlmUsage usage(String response) {
        try {
            JsonNode usage = objectMapper.readTree(response).path("usage");
            int promptTokens = usage.path("prompt_tokens").asInt(0);
            int completionTokens = usage.path("completion_tokens").asInt(0);
            int totalTokens = usage.path("total_tokens").asInt(promptTokens + completionTokens);
            BigDecimal cost = estimateCost(promptTokens, completionTokens);
            return new LlmUsage(promptTokens, completionTokens, totalTokens, cost);
        } catch (Exception exception) {
            return LlmUsage.zero();
        }
    }

    private BigDecimal estimateCost(int promptTokens, int completionTokens) {
        BigDecimal inputCost = BigDecimal.valueOf(promptTokens)
                .multiply(inputCostPerMillion)
                .divide(BigDecimal.valueOf(1_000_000), 12, RoundingMode.HALF_UP);
        BigDecimal outputCost = BigDecimal.valueOf(completionTokens)
                .multiply(outputCostPerMillion)
                .divide(BigDecimal.valueOf(1_000_000), 12, RoundingMode.HALF_UP);
        return inputCost.add(outputCost).setScale(6, RoundingMode.HALF_UP);
    }

    record LlmRuntimeConfiguration(int timeoutSeconds, int maxAttempts, int backoffMillis) {
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
