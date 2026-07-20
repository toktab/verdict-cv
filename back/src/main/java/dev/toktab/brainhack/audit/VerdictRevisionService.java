package dev.toktab.brainhack.audit;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class VerdictRevisionService {
    private static final TypeReference<Map<String, Object>> MAP_TYPE = new TypeReference<>() {};
    private final VerdictRevisionRepository revisionRepository;
    private final VerdictOverrideRepository overrideRepository;
    private final ObjectMapper objectMapper;

    public VerdictRevisionService(
            VerdictRevisionRepository revisionRepository,
            VerdictOverrideRepository overrideRepository,
            ObjectMapper objectMapper) {
        this.revisionRepository = revisionRepository;
        this.overrideRepository = overrideRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public EffectiveVerdict effective(Verdict verdict) {
        VerdictStatus status = verdict.getStatus();
        Confidence confidence = verdict.getConfidence();
        String reasonCategory = verdict.getReasonCategory();
        String explanation = verdict.getExplanation();
        String evidencePointer = verdict.getEvidencePointer();
        String overrideReason = verdict.getManualOverrideReason();
        boolean deleted = false;
        Instant latestStatusAt = Instant.EPOCH;

        List<VerdictOverride> overrides = overrideRepository.findByVerdictIdOrderByCreatedAtDesc(verdict.getId());
        if (!overrides.isEmpty()) {
            VerdictOverride latest = overrides.get(0);
            status = latest.getNewStatus();
            overrideReason = latest.getReason();
            reasonCategory = "reviewer override";
            latestStatusAt = latest.getCreatedAt();
        }

        for (VerdictRevision revision : revisionRepository.findByVerdictIdOrderByCreatedAtAsc(verdict.getId())) {
            Map<String, Object> patch = read(revision.getPatchJson());
            if (patch.get("status") != null && !revision.getCreatedAt().isBefore(latestStatusAt)) {
                status = enumValue(VerdictStatus.class, patch.get("status"), status);
                latestStatusAt = revision.getCreatedAt();
            }
            confidence = enumValue(Confidence.class, patch.get("confidence"), confidence);
            reasonCategory = text(patch.get("reasonCategory"), reasonCategory);
            explanation = text(patch.get("explanation"), explanation);
            evidencePointer = text(patch.get("evidencePointer"), evidencePointer);
            if (patch.containsKey("deleted")) {
                deleted = Boolean.parseBoolean(String.valueOf(patch.get("deleted")));
            }
            overrideReason = revision.getReason();
        }
        return new EffectiveVerdict(status, confidence, reasonCategory, explanation, evidencePointer, overrideReason, deleted);
    }

    @Transactional
    public void appendAdminPatch(Verdict verdict, String actorName, Map<String, Object> patch, String reason) {
        VerdictRevision revision = new VerdictRevision();
        revision.setVerdict(verdict);
        revision.setActorType("ADMIN");
        revision.setActorName(actorName == null || actorName.isBlank() ? "admin" : actorName);
        revision.setPatchJson(write(new LinkedHashMap<>(patch)));
        revision.setReason(reason == null || reason.isBlank() ? "Administrative correction" : reason.trim());
        revisionRepository.save(revision);
    }

    private Map<String, Object> read(String json) {
        try {
            return objectMapper.readValue(json, MAP_TYPE);
        } catch (Exception exception) {
            return Map.of();
        }
    }

    private String write(Map<String, Object> value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception exception) {
            throw new IllegalArgumentException("Could not persist verdict revision");
        }
    }

    private String text(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value);
    }

    private <T extends Enum<T>> T enumValue(Class<T> type, Object value, T fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return Enum.valueOf(type, String.valueOf(value));
        } catch (IllegalArgumentException exception) {
            return fallback;
        }
    }

    public record EffectiveVerdict(
            VerdictStatus status,
            Confidence confidence,
            String reasonCategory,
            String explanation,
            String evidencePointer,
            String overrideReason,
            boolean deleted) {
    }
}
