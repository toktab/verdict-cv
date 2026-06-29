package dev.toktab.brainhack.hiring;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Component;

@Component
public class HiringMapper {
    private static final TypeReference<List<List<String>>> CLAIMS = new TypeReference<>() {};
    private static final TypeReference<List<Map<String, Object>>> MATCHES = new TypeReference<>() {};
    private final ObjectMapper objectMapper;

    public HiringMapper(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public ProjectResponse project(HiringProject project) {
        return new ProjectResponse(
                project.getId(),
                project.getTitle(),
                project.getDepartment(),
                project.getLocation(),
                project.getDescription(),
                lines(project.getRequirementsText()),
                project.getState(),
                project.getStatus(),
                project.getCreatedAt(),
                project.getCreatedAt(),
                project.getCandidates().stream()
                        .filter(candidate -> candidate.getDeletedAt() == null)
                        .map(this::candidate)
                        .toList()
        );
    }

    public CandidateResponse candidate(HiringCandidate candidate) {
        return new CandidateResponse(
                candidate.getId(),
                candidate.getName(),
                candidate.getRole(),
                candidate.getScore(),
                candidate.getMatchScore(),
                candidate.getRisk(),
                candidate.getState(),
                candidate.getOsint(),
                candidate.getMemory(),
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
                read(candidate.getAuditPhraseMatchesJson(), MATCHES, List.of())
        );
    }

    public String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException exception) {
            throw new IllegalArgumentException("Could not serialize hiring data");
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
