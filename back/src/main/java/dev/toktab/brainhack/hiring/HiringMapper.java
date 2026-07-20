package dev.toktab.brainhack.hiring;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateAnalysisRunResponse;
import dev.toktab.brainhack.hiring.HiringDtos.InviteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.NoteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Component;

@Component
public class HiringMapper {
    private static final TypeReference<List<List<String>>> CLAIMS = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> MATCHES = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> MEMORY_HISTORY = new TypeReference<>() {};
    private static final TypeReference<List<String>> STRINGS = new TypeReference<>() {};
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> MAPS = new TypeReference<>() {};
    private final ObjectMapper objectMapper;
    private final CandidateAnalysisRunRepository analysisRunRepository;
    private final ProjectStateService projectStateService;

    public HiringMapper(
            ObjectMapper objectMapper,
            CandidateAnalysisRunRepository analysisRunRepository,
            ProjectStateService projectStateService) {
        this.objectMapper = objectMapper;
        this.analysisRunRepository = analysisRunRepository;
        this.projectStateService = projectStateService;
    }

    public ProjectResponse project(HiringProject project) {
        return project(project, null, List.of());
    }

    public ProjectResponse project(HiringProject project, String myRole, List<String> myPermissions) {
        return new ProjectResponse(
                project.getId(),
                project.getOrganization() == null ? null : project.getOrganization().getId(),
                project.getTitle(),
                project.getDepartment(),
                project.getLocation(),
                project.getDescription(),
                lines(project.getRequirementsText()),
                project.getRubricJson() == null || project.getRubricJson().isBlank()
                        ? Map.of()
                        : map(project.getRubricJson()),
                project.getState(),
                project.getStatus(),
                project.getCreatedAt(),
                project.getCreatedAt(),
                project.getOwner().getId(),
                myRole,
                myPermissions,
                projectStateService.effectiveSettings(project),
                project.getCandidates().stream()
                        .filter(candidate -> candidate.getDeletedAt() == null)
                        .map(this::candidate)
                        .toList()
        );
    }

    public InviteResponse invite(ProjectInvite invite) {
        return new InviteResponse(
                invite.getId(),
                invite.getProject().getId(),
                invite.getInvitedEmail(),
                invite.getRole(),
                invite.getToken(),
                invite.getStatus(),
                invite.getCreatedAt(),
                invite.getAcceptedAt()
        );
    }

    public NoteResponse note(CandidateReviewNote note) {
        return new NoteResponse(
                note.getId(),
                note.getType(),
                note.getDecision(),
                note.getBody(),
                note.getAuthor().getId(),
                note.getAuthor().getFullName(),
                note.getAuthor().getEmail(),
                note.getCreatedAt()
        );
    }

    public CandidateResponse candidate(HiringCandidate candidate) {
        return new CandidateResponse(
                candidate.getId(),
                candidate.getName(),
                candidate.getCandidateEmail(),
                candidate.getRole(),
                candidate.getScore(),
                candidate.getMatchScore(),
                candidate.getMatchScore(),
                candidate.getEvidenceScore(),
                candidate.getGithubMatchScore(),
                candidate.getReviewerScore(),
                candidate.getRisk(),
                candidate.getState(),
                candidate.getOsint(),
                candidate.getMemory(),
                candidate.getAnalysisState(),
                candidate.getAnalysisEngine(),
                candidate.getAnalysisPromptVersion(),
                candidate.getAnalysisCompletedAt(),
                candidate.getPromptTokens(),
                candidate.getCompletionTokens(),
                candidate.getTotalTokens(),
                candidate.getEstimatedCostUsd(),
                read(candidate.getInitializedAnalysisStatesJson(), STRINGS, List.of(candidate.getAnalysisState())),
                read(candidate.getMemoryHistoryJson(), MEMORY_HISTORY, List.of()),
                candidate.getCvText(),
                candidate.getResumeFilename(),
                "core-" + candidate.getId(),
                "cv-" + candidate.getId(),
                "case-" + candidate.getId(),
                candidate.getCreatedAt(),
                candidate.getFlags(),
                candidate.getSupported(),
                candidate.getStretched(),
                candidate.getUnsupported(),
                candidate.getSummary(),
                read(candidate.getClaimsJson(), CLAIMS, List.of()),
                read(candidate.getAuditPhraseMatchesJson(), MATCHES, List.of()),
                analysisRunRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId(), PageRequest.of(0, 8)).stream()
                        .map(this::analysisRun)
                        .toList()
        );
    }

    private CandidateAnalysisRunResponse analysisRun(CandidateAnalysisRun run) {
        String actor = run.getTriggeredBy() == null
                ? "System"
                : run.getTriggeredBy().getFullName() == null || run.getTriggeredBy().getFullName().isBlank()
                ? run.getTriggeredBy().getUsername()
                : run.getTriggeredBy().getFullName();
        return new CandidateAnalysisRunResponse(
                run.getId(),
                run.getStateId(),
                run.getEngine(),
                run.getPromptVersion(),
                run.getResumeFingerprint(),
                run.getTemplateFingerprint(),
                run.getRecommendationScore(),
                run.getFitScore(),
                run.getEvidenceScore(),
                run.getGithubMatchScore(),
                run.getReviewerScore(),
                run.getSupported(),
                run.getStretched(),
                run.getUnsupported(),
                run.getPromptTokens(),
                run.getCompletionTokens(),
                run.getEstimatedCostUsd(),
                actor,
                run.getCreatedAt()
        );
    }

    public String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not serialize hiring data");
        }
    }

    public Map<String, Object> map(String json) {
        return read(json, MAP, Map.of());
    }

    public List<Map<String, Object>> maps(String json) {
        return read(json, MAPS, List.of());
    }

    public List<String> strings(String json) {
        return read(json, STRINGS, List.of());
    }

    public OsintRunResponse osintReport(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        try {
            return objectMapper.readValue(json, OsintRunResponse.class);
        } catch (JsonProcessingException exception) {
            return null;
        }
    }

    private <T> T read(String json, TypeReference<T> type, T fallback) {
        if (json == null || json.isBlank()) {
            return fallback;
        }
        try {
            return objectMapper.readValue(json, type);
        } catch (JsonProcessingException exception) {
            return fallback;
        }
    }

    private List<String> lines(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\\R+")) {
            String clean = line.trim();
            if (!clean.isBlank()) {
                lines.add(clean);
            }
        }
        return lines;
    }
}
