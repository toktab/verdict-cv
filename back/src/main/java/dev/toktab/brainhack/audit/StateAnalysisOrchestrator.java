package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.log.AuditLogService;
import java.util.List;
import org.springframework.stereotype.Component;

@Component
public class StateAnalysisOrchestrator {
    private final LocalAuditAnalyzer localAnalyzer;
    private final LlmAuditAnalyzer llmAnalyzer;
    private final AuditLogService logService;

    public StateAnalysisOrchestrator(
            LocalAuditAnalyzer localAnalyzer,
            LlmAuditAnalyzer llmAnalyzer,
            AuditLogService logService) {
        this.localAnalyzer = localAnalyzer;
        this.llmAnalyzer = llmAnalyzer;
        this.logService = logService;
    }

    public AuditAnalysisResult analyze(String stateId, List<String> sentences, String evidenceText) {
        String normalized = normalize(stateId);
        return switch (normalized) {
            case CheckStateIds.LIGHT, CheckStateIds.WAR ->
                    localAnalyzer.analyzeForState(normalized, sentences, evidenceText);
            case CheckStateIds.PERSON -> person(sentences, evidenceText);
            case CheckStateIds.STRICT_WAR_AI -> strict(sentences, evidenceText);
            default -> throw new IllegalArgumentException("Unsupported check state: " + stateId);
        };
    }

    private AuditAnalysisResult person(List<String> sentences, String evidenceText) {
        if (!llmAnalyzer.configured()) {
            recordFallback("PERSON_STATE_LOCAL_FALLBACK", "llm_not_configured");
            return localAnalyzer.analyzeForState(CheckStateIds.PERSON, sentences, evidenceText);
        }
        try {
            return llmAnalyzer.analyzeForState(CheckStateIds.PERSON, sentences, evidenceText);
        } catch (RuntimeException exception) {
            recordFallback("PERSON_STATE_LLM_FALLBACK", exception.getClass().getSimpleName());
            return localAnalyzer.analyzeForState(CheckStateIds.PERSON, sentences, evidenceText);
        }
    }

    private AuditAnalysisResult strict(List<String> sentences, String evidenceText) {
        AuditAnalysisResult local =
                localAnalyzer.analyzeForState(CheckStateIds.STRICT_WAR_AI, sentences, evidenceText);
        if (!llmAnalyzer.configured()) {
            recordFallback("STRICT_WAR_AI_LOCAL_FALLBACK", "llm_not_configured");
            return local;
        }
        try {
            AuditAnalysisResult llm =
                    llmAnalyzer.analyzeForState(CheckStateIds.STRICT_WAR_AI, sentences, evidenceText);
            return new AuditAnalysisResult(
                    local.engine() + "+" + llm.engine(),
                    combineStrict(local.verdicts(), llm.verdicts()),
                    llm.usage());
        } catch (RuntimeException exception) {
            recordFallback("STRICT_WAR_AI_LLM_FALLBACK", exception.getClass().getSimpleName());
            return local;
        }
    }

    private List<AnalyzedVerdict> combineStrict(
            List<AnalyzedVerdict> local,
            List<AnalyzedVerdict> llm) {
        return local.stream()
                .map(localVerdict -> stricter(
                        localVerdict,
                        llm.stream()
                                .filter(row -> row.sentenceIndex() == localVerdict.sentenceIndex())
                                .findFirst()
                                .orElse(localVerdict)))
                .toList();
    }

    private AnalyzedVerdict stricter(AnalyzedVerdict local, AnalyzedVerdict llm) {
        AnalyzedVerdict selected =
                severity(llm.status()) > severity(local.status()) ? llm : local;
        if (selected == local && severity(local.status()) == severity(llm.status())) {
            selected = confidenceSeverity(llm.confidence()) > confidenceSeverity(local.confidence())
                    ? llm
                    : local;
        }
        if (selected == local) {
            return new AnalyzedVerdict(
                    local.sentenceIndex(),
                    local.sentence(),
                    local.status(),
                    local.confidence(),
                    "strict local + ai",
                    local.explanation() + " AI cross-check: " + llm.explanation(),
                    local.evidencePointer());
        }
        return new AnalyzedVerdict(
                selected.sentenceIndex(),
                selected.sentence(),
                selected.status(),
                selected.confidence(),
                "strict local + ai",
                "Local WAR: " + local.explanation() + " AI cross-check: " + llm.explanation(),
                selected.evidencePointer());
    }

    private int severity(VerdictStatus status) {
        return switch (status) {
            case UNSUPPORTED -> 5;
            case GAP -> 4;
            case STRETCHED -> 3;
            case SUPPORTED -> 2;
            case NOT_A_CLAIM -> 1;
        };
    }

    private int confidenceSeverity(Confidence confidence) {
        return switch (confidence) {
            case HIGH -> 3;
            case MEDIUM -> 2;
            case LOW -> 1;
        };
    }

    private String normalize(String stateId) {
        if (stateId == null || stateId.isBlank()) {
            return CheckStateIds.WAR;
        }
        return stateId.trim().toLowerCase();
    }

    private void recordFallback(String event, String reason) {
        logService.recordSystem(event, "reason=" + reason);
    }
}
