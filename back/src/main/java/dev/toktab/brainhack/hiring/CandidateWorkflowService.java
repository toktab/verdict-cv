package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateStatusRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateWorkflowResponse;
import dev.toktab.brainhack.hiring.HiringDtos.NoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.NoteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.VoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.VoteSummaryResponse;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

@Service
public class CandidateWorkflowService {
    private static final Set<String> VALID_CANDIDATE_STATUSES = Set.of(
            "Unreviewed", "OnCheck", "OnInterview", "Hired", "Closed");
    private static final Map<String, Set<String>> STATUS_TRANSITIONS = Map.of(
            "Unreviewed", Set.of("OnCheck"),
            "OnCheck", Set.of("OnInterview", "Closed"),
            "OnInterview", Set.of("Hired", "Closed"),
            "Hired", Set.of(),
            "Closed", Set.of());
    private static final Map<String, String> STATUS_LABELS = Map.of(
            "Unreviewed", "Unreviewed",
            "OnCheck", "OnCheck",
            "OnInterview", "OnInterview",
            "Hired", "Hired",
            "Closed", "Closed");

    private final HiringCandidateRepository candidateRepository;
    private final CandidateReviewNoteRepository noteRepository;
    private final HiringProjectService projectService;
    private final CandidateIntakeService candidateService;
    private final ProjectStateService projectStateService;
    private final HiringMapper mapper;

    public CandidateWorkflowService(
            HiringCandidateRepository candidateRepository,
            CandidateReviewNoteRepository noteRepository,
            HiringProjectService projectService,
            CandidateIntakeService candidateService,
            ProjectStateService projectStateService,
            HiringMapper mapper) {
        this.candidateRepository = candidateRepository;
        this.noteRepository = noteRepository;
        this.projectService = projectService;
        this.candidateService = candidateService;
        this.projectStateService = projectStateService;
        this.mapper = mapper;
    }

    @Transactional
    public CandidateWorkflowResponse workflow(UserAccount actor, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        return workflowResponse(candidate);
    }

    @Transactional
    public CandidateWorkflowResponse vote(UserAccount actor, Long projectId, Long candidateId, VoteRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        String action = defaulted(request.action(), "").toUpperCase(Locale.ROOT);
        if (!Set.of("UPVOTE", "DOWNVOTE", "STAR", "UNSTAR").contains(action)) {
            throw new IllegalArgumentException("Unsupported vote action");
        }
        double score = request.score() == null ? 0.0 : request.score();
        if ("UPVOTE".equals(action) && (score < 0.5 || score > 5.0
                || Math.abs(score * 2 - Math.rint(score * 2)) > 0.0001)) {
            throw new IllegalArgumentException("Upvote score must be between 0.5 and 5 in 0.5 increments");
        }
        CandidateReviewNote note = new CandidateReviewNote();
        note.setCandidate(candidate);
        note.setAuthor(actor);
        note.setType("VOTE");
        note.setDecision(action);
        note.setBody(action.equals("UPVOTE") ? "score=" + score : "");
        noteRepository.save(note);
        updateReviewerScore(candidate);
        candidateRepository.save(candidate);
        candidateAnalysisService.recordCandidateActivity(candidate, actor, "candidate_vote",
                activityLabel(note), "info", candidate.getName() + ": " + action);
        return workflowResponse(candidate);
    }

    @Transactional
    public CandidateWorkflowResponse updateStatus(UserAccount actor, Long projectId, Long candidateId,
                                                   CandidateStatusRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        String status = normalizeStatus(request.status());
        String currentStatus = workflowStatus(defaulted(candidate.getState(), "Unreviewed"));
        if (status.equals(currentStatus)) return workflowResponse(candidate);
        String reason = defaulted(request.reason(), "").trim();
        requireWorkflowGate(candidate, status, reason);
        candidate.setState(status);
        candidateRepository.save(candidate);
        CandidateReviewNote note = new CandidateReviewNote();
        note.setCandidate(candidate);
        note.setAuthor(actor);
        note.setType("STATUS");
        note.setDecision(status.toUpperCase(Locale.ROOT));
        note.setBody(reason.isBlank() ? "Changed candidate status to " + status : reason);
        noteRepository.save(note);
        candidateAnalysisService.recordCandidateActivity(candidate, actor, "candidate_status",
                activityLabel(note), "warn", candidate.getName() + " moved to " + status + ".");
        return workflowResponse(candidate);
    }

    @Transactional
    public List<NoteResponse> notes(UserAccount actor, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        return noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId()).stream()
                .filter(note -> !Set.of("VOTE", "STATUS", "ACTIVITY")
                        .contains(defaulted(note.getType(), "").toUpperCase(Locale.ROOT)))
                .map(mapper::note)
                .toList();
    }

    @Transactional
    public NoteResponse addNote(UserAccount actor, Long projectId, Long candidateId, NoteRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        CandidateReviewNote note = new CandidateReviewNote();
        note.setCandidate(candidate);
        note.setAuthor(actor);
        note.setType(defaulted(request.type(), "NOTE").toUpperCase(Locale.ROOT));
        note.setDecision(defaulted(request.decision(), "NONE").toUpperCase(Locale.ROOT));
        note.setBody(defaulted(request.body(), ""));
        CandidateReviewNote saved = noteRepository.save(note);
        candidateAnalysisService.recordCandidateActivity(candidate, actor, "candidate_note",
                "Added candidate note", "info", candidate.getName() + ": " + note.getDecision());
        return mapper.note(saved);
    }

    private void requireWorkflowGate(HiringCandidate candidate, String targetStatus, String reason) {
        if (Set.of("OnInterview", "Hired", "Closed").contains(targetStatus) && reason.length() < 12) {
            throw new IllegalArgumentException("Add a decision reason of at least 12 characters");
        }
        if (!"Hired".equals(targetStatus)) return;
        String currentStatus = workflowStatus(defaulted(candidate.getState(), "Unreviewed"));
        if (!"OnInterview".equals(currentStatus)) {
            throw new IllegalArgumentException("Move the candidate to OnInterview before marking them Hired");
        }
        boolean hasReviewerDecision = noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId()).stream()
                .anyMatch(note -> "VOTE".equalsIgnoreCase(note.getType())
                        && Set.of("UPVOTE", "DOWNVOTE")
                        .contains(defaulted(note.getDecision(), "").toUpperCase(Locale.ROOT)));
        if (!hasReviewerDecision) {
            throw new IllegalArgumentException("At least one reviewer vote is required before hiring");
        }
        String evidenceRequirement = String.valueOf(projectStateService.effectiveSettings(candidate.getProject())
                .getOrDefault("evidenceRequirement", "Require project/source evidence"));
        if (evidenceRequirement.toLowerCase(Locale.ROOT).contains("require")
                && candidate.getEvidenceScore() <= 0) {
            throw new IllegalArgumentException("Run SignalTrace or attach independent evidence before hiring");
        }
    }

    private void updateReviewerScore(HiringCandidate candidate) {
        Map<String, CandidateReviewNote> latest = new LinkedHashMap<>();
        for (CandidateReviewNote note : noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId())) {
            if ("VOTE".equalsIgnoreCase(note.getType())
                    && Set.of("UPVOTE", "DOWNVOTE").contains(note.getDecision())) {
                latest.putIfAbsent(note.getAuthor().getEmail().toLowerCase(Locale.ROOT), note);
            }
        }
        if (latest.isEmpty()) {
            candidate.setReviewerScore(0);
            return;
        }
        double total = latest.values().stream()
                .mapToDouble(note -> "UPVOTE".equals(note.getDecision()) ? scoreFromBody(note.getBody()) : 0.0)
                .sum();
        candidate.setReviewerScore((int) Math.round(total / latest.size() * 20.0));
    }

    private double scoreFromBody(String body) {
        if (body == null || !body.startsWith("score=")) return 2.5;
        try {
            return Double.parseDouble(body.substring(6).trim());
        } catch (NumberFormatException e) {
            return 2.5;
        }
    }

    private CandidateWorkflowResponse workflowResponse(HiringCandidate candidate) {
        boolean hasVote = noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId()).stream()
                .anyMatch(n -> "VOTE".equalsIgnoreCase(n.getType())
                        && Set.of("UPVOTE", "DOWNVOTE").contains(n.getDecision()));
        return new CandidateWorkflowResponse(
                workflowStatus(defaulted(candidate.getState(), "Unreviewed")),
                getValidTransitions(candidate),
                hasVote,
                candidate.getReviewerScore(),
                timeInCurrent(candidate));
    }

    private String workflowStatus(String state) {
        String clean = defaulted(state, "");
        for (String valid : VALID_CANDIDATE_STATUSES) {
            if (valid.equalsIgnoreCase(clean)) return valid;
        }
        return "Unreviewed";
    }

    private List<String> getValidTransitions(HiringCandidate candidate) {
        String current = workflowStatus(defaulted(candidate.getState(), "Unreviewed"));
        Set<String> transitions = STATUS_TRANSITIONS.getOrDefault(current, Set.of());
        return transitions.stream().toList();
    }

    private long timeInCurrent(HiringCandidate candidate) {
        if (candidate.getCreatedAt() == null) return 0;
        return java.time.Duration.between(candidate.getCreatedAt(), Instant.now()).toHours();
    }

    public String normalizeStatus(String status) {
        if (status == null) throw new IllegalArgumentException("Status is required");
        for (String valid : VALID_CANDIDATE_STATUSES) {
            if (valid.equalsIgnoreCase(status.trim())) return valid;
        }
        throw new IllegalArgumentException("Unsupported candidate status: " + status
                + ". Valid: " + String.join(", ", VALID_CANDIDATE_STATUSES));
    }

    public String activityLabel(CandidateReviewNote note) {
        if ("VOTE".equalsIgnoreCase(note.getType())) {
            return switch (defaulted(note.getDecision(), "").toUpperCase(Locale.ROOT)) {
                case "UPVOTE" -> "Upvoted candidate";
                case "DOWNVOTE" -> "Downvoted candidate";
                case "STAR" -> "Starred candidate";
                case "UNSTAR" -> "Unstarred candidate";
                default -> "Voted on candidate";
            };
        }
        if ("STATUS".equalsIgnoreCase(note.getType())) {
            return "Moved candidate to " + defaulted(note.getDecision(), "new status");
        }
        return "Added candidate note";
    }

    private HiringCandidate candidateEntity(UserAccount owner, Long projectId, Long candidateId) {
        return candidateService.candidateEntity(owner, projectId, candidateId);
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
