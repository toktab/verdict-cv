package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.audit.CheckStateIds;
import dev.toktab.brainhack.hiring.HiringDtos.GithubJobMatchResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunRequest;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintSourceResponse;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class CandidateOsintService {
    private final HiringCandidateRepository candidateRepository;
    private final CandidateOsintSourceRepository osintSourceRepository;
    private final HiringMapper mapper;
    private final GithubEvidenceService githubEvidenceService;
    private final CandidateAnalysisService candidateAnalysisService;
    private final HiringProjectService projectService;

    public CandidateOsintService(
            HiringCandidateRepository candidateRepository,
            CandidateOsintSourceRepository osintSourceRepository,
            HiringMapper mapper,
            GithubEvidenceService githubEvidenceService,
            CandidateAnalysisService candidateAnalysisService,
            HiringProjectService projectService) {
        this.candidateRepository = candidateRepository;
        this.osintSourceRepository = osintSourceRepository;
        this.mapper = mapper;
        this.githubEvidenceService = githubEvidenceService;
        this.candidateAnalysisService = candidateAnalysisService;
        this.projectService = projectService;
    }

    @Transactional
    public OsintRunResponse runOsint(UserAccount owner, Long projectId, Long candidateId, OsintRunRequest request) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        String state = defaulted(request == null ? "" : request.state(), CheckStateIds.STRICT_WAR_AI);
        if (!CheckStateIds.STRICT_WAR_AI.equals(state)) {
            throw new IllegalArgumentException("SignalTrace OSINT is only available in WAR_AI State.");
        }
        if (request == null || !request.consent()) {
            throw new IllegalArgumentException("Explicit consent is required before SignalTrace can check public sources.");
        }
        List<String> consentedChecks = request.checks() == null ? List.of() : request.checks().stream()
                .filter(check -> check != null && !check.isBlank())
                .map(String::trim).distinct().sorted().toList();
        Instant checkedAt = Instant.now();

        String cvText = defaulted(candidate.getCvText(), "");
        List<String> links = CandidateAnalysisService.discoverPublicLinks(cvText);
        List<String> usernames = new ArrayList<>();
        List<OsintSourceResponse> sources = new ArrayList<>();
        sources.add(new OsintSourceResponse("CV link extraction",
                links.isEmpty() ? "No public profile or portfolio URLs were found in the uploaded CV."
                        : "Found " + links.size() + " public URL(s) in the uploaded CV.",
                links.isEmpty() ? 18 : 72, links.isEmpty() ? "0" : "+6",
                links.isEmpty() ? "warn" : "good", links.isEmpty() ? "" : links.get(0)));

        GithubInvestigation githubInvestigation = githubEvidenceService.investigate(links);
        sources.addAll(githubInvestigation.sources());
        GithubJobMatchResponse githubJobMatch = githubEvidenceService.jobMatch(
                candidate.getProject(), githubInvestigation.profile());
        sources.add(new OsintSourceResponse("Claim cross-check",
                candidate.getSupported() + " supported, " + candidate.getStretched() + " stretched, and "
                        + candidate.getUnsupported() + " unsupported CV claims are ready for source attachment.",
                Math.max(30, Math.min(92, candidate.getScore())),
                candidate.getScore() >= 70 ? "+8" : "-4",
                candidate.getScore() >= 70 ? "good" : "warn", ""));

        int corroborated = (int) sources.stream().filter(source -> source.confidence() >= 55).count();
        int identityConfidence = Math.min(96, Math.max(24,
                35 + corroborated * 14 - candidate.getUnsupported() * 4));
        candidate.setOsint(corroborated >= 3 ? "Ready" : corroborated >= 1 ? "Partial" : "Escalate");

        OsintRunResponse response = new OsintRunResponse(state, candidate.getOsint(), checkedAt, consentedChecks,
                identityConfidence, corroborated, candidate.getUnsupported(), links, usernames, sources,
                githubInvestigation.profile(), githubJobMatch);
        candidate.setOsintReportJson(mapper.json(response));
        candidate.setOsintCheckedAt(checkedAt);
        candidate.setGithubMatchScore(githubJobMatch.score());
        candidate.setEvidenceScore(githubInvestigation.profile() == null
                ? 0
                : Math.min(100, Math.round(identityConfidence * 0.35f + githubJobMatch.score() * 0.65f)));
        candidateRepository.save(candidate);
        candidateAnalysisService.recordAnalysisRun(candidate, owner);
        saveOsintSources(candidate, sources);
        projectService.recordActivity(candidate.getProject(), owner, "candidate_osint",
                "Ran evidence scan for " + candidate.getName(), "info",
                "SignalTrace evidence cards were refreshed.");
        return response;
    }

    @Transactional
    public OsintRunResponse latestOsint(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        OsintRunResponse report = mapper.osintReport(candidate.getOsintReportJson());
        if (report == null || report.github() == null) return report;

        GithubJobMatchResponse githubJobMatch = githubEvidenceService.jobMatch(
                candidate.getProject(), report.github());
        OsintRunResponse refreshed = new OsintRunResponse(
                report.state(), report.status(), report.checkedAt(), report.consentedChecks(),
                report.identityConfidence(), report.corroboratedSources(), report.contradictions(),
                report.discoveredLinks(), report.discoveredUsernames(), report.sources(),
                report.github(), githubJobMatch);
        int evidenceScore = Math.min(100, Math.round(
                report.identityConfidence() * 0.35f + githubJobMatch.score() * 0.65f));
        if (candidate.getGithubMatchScore() != githubJobMatch.score()
                || candidate.getEvidenceScore() != evidenceScore
                || report.githubJobMatch() == null
                || report.githubJobMatch().score() != githubJobMatch.score()) {
            candidate.setGithubMatchScore(githubJobMatch.score());
            candidate.setEvidenceScore(evidenceScore);
            candidate.setOsintReportJson(mapper.json(refreshed));
            candidateRepository.save(candidate);
        }
        return refreshed;
    }

    private HiringCandidate candidateEntity(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateRepository.findByIdAndDeletedAtIsNull(candidateId)
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
        if (!candidate.getProject().getId().equals(projectId)) {
            throw new IllegalArgumentException("Candidate not found in this project");
        }
        return candidate;
    }

    private void saveOsintSources(HiringCandidate candidate, List<OsintSourceResponse> sources) {
        osintSourceRepository.deleteByCandidateId(candidate.getId());
        if (sources == null || sources.isEmpty()) return;
        List<CandidateOsintSource> entities = new ArrayList<>();
        for (OsintSourceResponse src : sources) {
            CandidateOsintSource entity = new CandidateOsintSource();
            entity.setCandidate(candidate);
            entity.setSourceType(src.source());
            entity.setSourceUrl(src.url());
            entity.setFinding(src.finding());
            entity.setConfidence(Math.max(0, Math.min(100, src.confidence())));
            entity.setImpact(src.impact());
            entity.setTone(src.tone());
            entity.setCheckedAt(Instant.now());
            entities.add(entity);
        }
        osintSourceRepository.saveAll(entities);
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
