package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.UserAdminRequest;
import dev.toktab.brainhack.ats.AtsKeywordCatalog;
import dev.toktab.brainhack.audit.AuditService;
import dev.toktab.brainhack.audit.AnalyzedVerdict;
import dev.toktab.brainhack.audit.AuditAnalysisResult;
import dev.toktab.brainhack.audit.AuditPromptCatalog;
import dev.toktab.brainhack.audit.CheckStateIds;
import dev.toktab.brainhack.audit.FingerprintService;
import dev.toktab.brainhack.audit.StateAnalysisOrchestrator;
import dev.toktab.brainhack.audit.VerdictStatus;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidatePageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateAnalysisStateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateStatusRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateWorkflowResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ImportResponse;
import dev.toktab.brainhack.hiring.HiringDtos.InviteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.InviteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.MemberRoleRequest;
import dev.toktab.brainhack.hiring.HiringDtos.NoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.NoteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ActivityResponse;
import dev.toktab.brainhack.hiring.HiringDtos.GithubLanguageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.GithubJobMatchResponse;
import dev.toktab.brainhack.hiring.HiringDtos.GithubProfileResponse;
import dev.toktab.brainhack.hiring.HiringDtos.GithubRepositoryResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunRequest;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintSourceResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectMemberResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectPageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import dev.toktab.brainhack.hiring.HiringDtos.VoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.VoteSummaryResponse;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectActivityRequest;
import dev.toktab.brainhack.messaging.MessageService;
import dev.toktab.brainhack.messaging.MessageDtos.CandidateAttachment;
import dev.toktab.brainhack.messaging.MessageDtos.MessageRequest;
import dev.toktab.brainhack.realtime.RealtimeService;
import jakarta.transaction.Transactional;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.io.IOException;
import java.io.InputStream;
import java.security.SecureRandom;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Base64;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.apache.poi.xwpf.extractor.XWPFWordExtractor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class HiringService {
    private static final long MAX_RESUME_BYTES = 8L * 1024L * 1024L;
    private static final int MAX_CANDIDATE_AI_EVIDENCE_CHARS = 120_000;
    private static final Set<String> STOP_WORDS = Set.of(
            "with", "from", "into", "that", "this", "they", "them", "have", "will", "your", "and", "the", "for", "are",
            "using", "use", "basic", "basics", "knowledge", "understanding", "experience", "familiarity", "ability",
            "develop", "maintain", "build", "improve", "work", "works", "working", "help", "assist", "follow",
            "principles", "tools", "similar", "good", "code", "clear", "role", "candidate"
    );
    private static final Set<String> REQUIREMENT_SECTIONS = Set.of("RESPONSIBILITIES", "REQUIRED QUALIFICATIONS", "NICE TO HAVE", "TECH STACK", "IDEAL CANDIDATE PROFILE");
    private static final Set<String> STOP_REQUIREMENT_SECTIONS = Set.of("WHAT WE OFFER", "ABOUT THE ROLE", "LOCATION", "EMPLOYMENT TYPE", "LEVEL");
    private static final Pattern SENTENCE = Pattern.compile("(?<=[.!?])\\s+|\\R+");
    private static final Pattern URL = Pattern.compile(
            "(?:https?://[^\\s)>,|]+|(?<![\\w@.-])(?:www\\.)?(?:github\\.com|linkedin\\.com|stackoverflow\\.com|medium\\.com|x\\.com|twitter\\.com)/[^\\s)>,|]+)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern HANDLE = Pattern.compile("(?<![\\w.])@([a-zA-Z0-9][a-zA-Z0-9_.-]{2,38})");
    private static final Pattern EMAIL = Pattern.compile("(?i)(?<![a-z0-9._%+-])([a-z0-9._%+-]+@[a-z0-9.-]+\\.[a-z]{2,})(?![a-z0-9._%+-])");
    private static final Pattern GITHUB_URL = Pattern.compile("https?://(?:www\\.)?github\\.com/([a-zA-Z0-9-]{1,39})(?:[/\\s?#]|$)", Pattern.CASE_INSENSITIVE);

    private final HiringProjectRepository projectRepository;
    private final HiringCandidateRepository candidateRepository;
    private final CandidateAnalysisRunRepository analysisRunRepository;
    private final HiringMapper mapper;
    private final OrganizationRepository organizationRepository;
    private final TeamMembershipRepository membershipRepository;
    private final ProjectInviteRepository inviteRepository;
    private final CandidateReviewNoteRepository noteRepository;
    private final MessageService messageService;
    private final UserAccountService userAccountService;
    private final AtsKeywordCatalog atsKeywordCatalog;
    private final RealtimeService realtimeService;
    private final ProjectStateService projectStateService;
    private final ProjectPermissionService permissionService;
    private final ProjectActivityLogRepository activityRepository;
    private final AuditService auditService;
    private final StateAnalysisOrchestrator stateAnalysisOrchestrator;
    private final FingerprintService fingerprintService;
    private final String githubToken;
    private final SecureRandom secureRandom = new SecureRandom();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(4))
            .build();

    public HiringService(
            HiringProjectRepository projectRepository,
            HiringCandidateRepository candidateRepository,
            CandidateAnalysisRunRepository analysisRunRepository,
            HiringMapper mapper,
            OrganizationRepository organizationRepository,
            TeamMembershipRepository membershipRepository,
            ProjectInviteRepository inviteRepository,
            CandidateReviewNoteRepository noteRepository,
            MessageService messageService,
            UserAccountService userAccountService,
            AtsKeywordCatalog atsKeywordCatalog,
            RealtimeService realtimeService,
            ProjectStateService projectStateService,
            ProjectPermissionService permissionService,
            ProjectActivityLogRepository activityRepository,
            AuditService auditService,
            StateAnalysisOrchestrator stateAnalysisOrchestrator,
            FingerprintService fingerprintService,
            @Value("${verdict.github.token:}") String githubToken) {
        this.projectRepository = projectRepository;
        this.candidateRepository = candidateRepository;
        this.analysisRunRepository = analysisRunRepository;
        this.mapper = mapper;
        this.organizationRepository = organizationRepository;
        this.membershipRepository = membershipRepository;
        this.inviteRepository = inviteRepository;
        this.noteRepository = noteRepository;
        this.messageService = messageService;
        this.userAccountService = userAccountService;
        this.atsKeywordCatalog = atsKeywordCatalog;
        this.realtimeService = realtimeService;
        this.projectStateService = projectStateService;
        this.permissionService = permissionService;
        this.activityRepository = activityRepository;
        this.auditService = auditService;
        this.stateAnalysisOrchestrator = stateAnalysisOrchestrator;
        this.fingerprintService = fingerprintService;
        this.githubToken = githubToken == null ? "" : githubToken.trim();
    }

    @Transactional
    public List<ProjectResponse> projects(UserAccount owner) {
        ensureOrganization(owner);
        return projectRepository.findAccessible(owner.getId(), owner.getEmail()).stream()
                .map(project -> mapper.project(project, actorRole(owner, project), permissionsFor(owner, project)))
                .toList();
    }

    @Transactional
    public ProjectPageResponse projectPage(UserAccount owner, int page, int size, String search) {
        ensureOrganization(owner);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        String safeSearch = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Page<HiringProject> result = projectRepository.findAccessiblePage(
                owner.getId(), owner.getEmail(), safeSearch,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<ProjectResponse> items = result.getContent().stream()
                .map(project -> mapper.project(project, actorRole(owner, project), permissionsFor(owner, project)))
                .toList();
        return new ProjectPageResponse(items, safePage, safeSize, result.getTotalElements(), result.getTotalPages());
    }

    @Transactional
    public ProjectResponse project(UserAccount owner, Long id) {
        HiringProject project = projectEntity(owner, id);
        return mapper.project(project, actorRole(owner, project), permissionsFor(owner, project));
    }

    @Transactional
    public ProjectResponse createProject(UserAccount owner, ProjectRequest request) {
        HiringProject project = new HiringProject();
        project.setOwner(owner);
        project.setOrganization(ensureOrganization(owner));
        project.setTitle(defaulted(request.title(), "Untitled role"));
        project.setDepartment(defaulted(request.department(), "Hiring"));
        project.setLocation(defaulted(request.location(), "Remote"));
        project.setDescription(defaulted(request.description(), ""));
        List<String> requirements = cleanRequirements(request.requirements());
        if (requirements.isEmpty()) {
            requirements = extractRequirements(request.description());
        }
        project.setRequirementsText(String.join("\n", requirements));
        project.setRubricJson(mapper.json(request.rubric() == null ? Map.of() : request.rubric()));
        project.setState(defaulted(request.state(), "WAR+AI State"));
        project.setStatus(defaulted(request.status(), "Screening"));
        HiringProject saved = projectRepository.save(project);
        recordActivity(saved, owner, "project_create", "Created project", "good", "Project workspace was created.");
        publishProjectChange(saved);
        return mapper.project(saved, actorRole(owner, saved), permissionsFor(owner, saved));
    }

    @Transactional
    public ImportResponse importSamples(UserAccount owner) {
        int imported = 0;
        int skipped = 0;
        int candidateCount = 0;
        int memberCount = 0;
        int messageCount = 0;
        int auditCount = 0;
        List<UserAccount> demoMembers = demoMembers();
        for (ProjectRequest sample : sampleProjects()) {
            if (projectRepository.existsByOwnerIdAndTitleIgnoreCaseAndDeletedAtIsNull(owner.getId(), sample.title())) {
                skipped++;
            } else {
                ProjectResponse project = createProject(owner, sample);
                HiringProject demoProject = projectRepository.findById(project.id())
                        .orElseThrow(() -> new IllegalStateException("Seeded project could not be loaded."));
                demoProject.setDemoData(true);
                projectRepository.save(demoProject);
                List<CandidateResponse> candidates = new ArrayList<>();
                for (CandidateRequest candidate : sampleCandidates(sample.title())) {
                    candidates.add(addCandidate(owner, project.id(), candidate));
                    candidateCount++;
                }
                for (int index = 0; index < demoMembers.size(); index++) {
                    UserAccount member = demoMembers.get(index);
                    String role = index == 0 ? "REVIEWER" : "COORDINATOR";
                    InviteResponse invite = invite(owner, project.id(), new InviteRequest(member.getEmail(), role));
                    acceptInvite(member, invite.token());
                    memberCount++;
                }
                if (!candidates.isEmpty()) {
                    CandidateResponse lead = candidates.get(0);
                    addNote(owner, project.id(), lead.id(), new NoteRequest(
                            "NOTE",
                            "INTERVIEW",
                            "Demo review: evidence is concrete enough for interview, with targeted follow-up on ownership and production scope."
                    ));
                    updateCandidateStatus(owner, project.id(), lead.id(), new CandidateStatusRequest(
                            "OnInterview",
                            "Seeded demo reviewer advanced the candidate after evidence review."));
                    vote(owner, project.id(), lead.id(), new VoteRequest("UPVOTE", 4.5));
                    for (UserAccount member : demoMembers) {
                        messageService.send(owner, new MessageRequest(
                                member.getEmail(),
                                "Demo shortlist review: " + sample.title(),
                                "Please review the attached lead candidate before the team calibration meeting. Focus on direct project evidence and remaining verification pressure.",
                                null,
                                null,
                                List.of(new CandidateAttachment(lead.id(), project.id(), lead.name(), lead.role(), sample.title(), lead.score()))
                        ));
                        messageCount++;
                    }
                    messageService.send(demoMembers.get(0), new MessageRequest(
                            owner.getEmail(),
                            "Reviewer note: " + lead.name(),
                            "I reviewed the demo candidate package. The technical evidence is strong; I would verify the exact production ownership and team contribution during interview.",
                            null,
                            null,
                            List.of(new CandidateAttachment(lead.id(), project.id(), lead.name(), lead.role(), sample.title(), lead.score()))
                    ));
                    messageCount++;
                }
                auditService.run(demoAuditRequest(sample, candidates), null, owner).setDemoData(true);
                auditCount++;
                if (candidates.size() > 1) {
                    auditService.run(demoRiskAuditRequest(sample, candidates.get(1)), null, owner).setDemoData(true);
                    auditCount++;
                }
                imported++;
            }
        }
        return new ImportResponse(imported, skipped, candidateCount, memberCount, messageCount, auditCount);
    }

    private List<UserAccount> demoMembers() {
        return List.of(
                ensureDemoUser("demo.reviewer", "demo.reviewer@verdict.example", "Maya Reviewer", "Senior Reviewer"),
                ensureDemoUser("demo.coordinator", "demo.coordinator@verdict.example", "Levan Coordinator", "Hiring Coordinator")
        );
    }

    private UserAccount ensureDemoUser(String username, String email, String fullName, String role) {
        return userAccountService.findActiveByUsernameOrEmail(email).orElseGet(() -> userAccountService.create(new UserAdminRequest(
                fullName,
                username,
                email,
                "Georgia",
                "VERDICT demo workspace",
                "VERDICT Demo",
                role,
                "DemoWorkspace123!",
                true
        )));
    }

    private AuditRunRequest demoAuditRequest(ProjectRequest project, List<CandidateResponse> candidates) {
        String claimText = candidates.isEmpty()
                ? project.description()
                : candidates.get(0).name() + " is the current lead candidate for " + project.title()
                + ". The application includes measurable outcomes, role-relevant technical evidence, and a review-ready portfolio.";
        return new AuditRunRequest(
                "Demo shortlist: " + project.title(),
                "Demo hiring evidence",
                claimText,
                project.description() + "\nRequirements:\n" + String.join("\n", project.requirements()),
                "cv",
                "",
                CheckStateIds.LIGHT
        );
    }

    private AuditRunRequest demoRiskAuditRequest(ProjectRequest project, CandidateResponse candidate) {
        return new AuditRunRequest(
                "Demo risk review: " + candidate.name(),
                "Demo role requirements",
                candidate.name() + " claims exceptional ownership, world-class execution, and broad production impact without complete supporting artifacts.",
                project.description() + "\nThe supplied application has partial technical evidence but requires direct verification of seniority, metrics, and ownership.",
                "cv",
                "",
                CheckStateIds.WAR
        );
    }

    @Transactional
    public void deleteProject(UserAccount owner, Long id) {
        HiringProject project = projectEntity(owner, id);
        if (!hasHeadAdminAccess(owner, project)) {
            throw new IllegalArgumentException("Project Head Admin permissions required");
        }
        project.setDeletedAt(Instant.now());
        projectRepository.save(project);
        recordActivity(project, owner, "project_delete", "Deleted project " + project.getTitle(), "danger", "Project was deleted from active lists.");
        publishProjectChange(project);
    }

    @Transactional
    public CandidateResponse addCandidate(UserAccount owner, Long projectId, CandidateRequest request) {
        HiringProject project = projectEntity(owner, projectId);
        requireCandidateIntake(project, false);
        HiringCandidate candidate = buildCandidate(project, defaulted(request.name(), "Unnamed candidate"), defaulted(request.role(), project.getTitle()), defaulted(request.cvText(), ""), "");
        HiringCandidate saved = saveAnalyzedCandidate(candidate);
        recordAnalysisRun(saved, owner);
        CandidateResponse response = mapper.candidate(saved);
        recordCandidateActivity(candidate, owner, "candidate_create", "Added candidate " + candidate.getName(), "good", "Candidate was added to the project.");
        publishProjectChange(project);
        return response;
    }

    @Transactional
    public CandidateResponse uploadCandidate(UserAccount owner, Long projectId, String name, String role, MultipartFile resume) {
        HiringProject project = projectEntity(owner, projectId);
        requireCandidateIntake(project, true);
        String cvText = extractResumeText(resume);
        HiringCandidate candidate = buildCandidate(project, defaulted(name, "Unnamed candidate"), defaulted(role, project.getTitle()), cvText, resume == null ? "" : resume.getOriginalFilename());
        HiringCandidate saved = saveAnalyzedCandidate(candidate);
        recordAnalysisRun(saved, owner);
        CandidateResponse response = mapper.candidate(saved);
        recordCandidateActivity(candidate, owner, "candidate_upload", "Uploaded candidate " + candidate.getName(), "good", "Candidate resume was uploaded and analyzed.");
        publishProjectChange(project);
        return response;
    }

    @Transactional
    public CandidateResponse candidate(UserAccount owner, Long projectId, Long candidateId) {
        return mapper.candidate(candidateEntity(owner, projectId, candidateId));
    }

    @Transactional
    public CandidatePageResponse candidates(UserAccount owner, Long projectId, int offset, int limit) {
        projectEntity(owner, projectId);
        int safeOffset = Math.max(0, offset);
        int safeLimit = Math.max(1, Math.min(100, limit));
        Pageable pageable = new OffsetLimitPageable(safeOffset, safeLimit, Sort.by(Sort.Direction.DESC, "createdAt"));
        List<CandidateResponse> items = candidateRepository.findAccessibleByProjectId(projectId, owner.getId(), owner.getEmail(), pageable).stream()
                .map(mapper::candidate)
                .toList();
        long total = candidateRepository.countAccessibleByProjectId(projectId, owner.getId(), owner.getEmail());
        return new CandidatePageResponse(items, safeOffset, safeLimit, total);
    }

    @Transactional
    public CandidateResponse reanalyzeCandidate(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        HiringCandidate refreshed = buildCandidate(candidate.getProject(), candidate.getName(), candidate.getRole(),
                candidate.getCvText(), candidate.getResumeFilename(), candidate.getId(), candidate.getAnalysisState());
        applyCandidateAnalysis(candidate, refreshed);
        HiringCandidate saved = saveAnalyzedCandidate(candidate);
        recordAnalysisRun(saved, owner);
        CandidateResponse response = mapper.candidate(saved);
        recordCandidateActivity(candidate, owner, "candidate_reanalyze", "Reanalyzed candidate " + candidate.getName(), "info", "Candidate scoring and phrase checks were refreshed.");
        publishProjectChange(candidate.getProject());
        return response;
    }

    @Transactional
    public CandidateResponse updateCandidateAnalysisState(UserAccount actor, Long projectId, Long candidateId,
                                                          CandidateAnalysisStateRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        requirePermission(actor, candidate.getProject(), "canAddNote");
        String state = normalizeAnalysisState(request.state());
        String previous = candidate.getAnalysisState();
        List<String> initialized = new ArrayList<>(mapper.strings(candidate.getInitializedAnalysisStatesJson()));
        boolean newlyInitialized = request.initialize() && !initialized.contains(state);
        boolean analyzeForState = request.initialize();

        candidate.setAnalysisState(state);
        if (newlyInitialized) {
            initialized.add(state);
            candidate.setInitializedAnalysisStatesJson(mapper.json(initialized));
        }
        if (analyzeForState) {
            HiringCandidate refreshed = buildCandidate(candidate.getProject(), candidate.getName(), candidate.getRole(),
                    candidate.getCvText(), candidate.getResumeFilename(), candidate.getId(), state);
            applyCandidateAnalysis(candidate, refreshed);
        } else if (initialized.contains(state)) {
            CandidateAnalysisRun existing =
                    analysisRunRepository.findFirstByCandidateIdAndStateIdOrderByCreatedAtDesc(candidate.getId(), state)
                            .orElse(null);
            if (existing != null) {
                restoreAnalysisRun(candidate, existing);
            } else {
                HiringCandidate refreshed = buildCandidate(candidate.getProject(), candidate.getName(), candidate.getRole(),
                        candidate.getCvText(), candidate.getResumeFilename(), candidate.getId(), state);
                applyCandidateAnalysis(candidate, refreshed);
                analyzeForState = true;
            }
        }
        candidateRepository.save(candidate);
        if (analyzeForState) {
            recordAnalysisRun(candidate, actor);
        }

        if (!state.equals(previous) || newlyInitialized) {
            String action = newlyInitialized
                    ? "Initialized " + analysisStateLabel(state) + " for " + candidate.getName()
                    : "Selected " + analysisStateLabel(state) + " for " + candidate.getName();
            recordCandidateActivity(candidate, actor, "candidate_analysis_state", action, "info",
                    "Candidate analysis state changed from " + analysisStateLabel(previous) + " to " + analysisStateLabel(state) + ".");
            publishProjectChange(candidate.getProject());
        }
        return mapper.candidate(candidate);
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
                .map(String::trim)
                .distinct()
                .sorted()
                .toList();
        Instant checkedAt = Instant.now();

        String cvText = defaulted(candidate.getCvText(), "");
        List<String> links = discoveredLinks(cvText);
        List<String> usernames = discoveredUsernames(cvText, links);
        List<OsintSourceResponse> sources = new ArrayList<>();
        sources.add(new OsintSourceResponse(
                "CV link extraction",
                links.isEmpty() ? "No public profile or portfolio URLs were found in the uploaded CV." : "Found " + links.size() + " public URL(s) in the uploaded CV.",
                links.isEmpty() ? 18 : 72,
                links.isEmpty() ? "0" : "+6",
                links.isEmpty() ? "warn" : "good",
                links.isEmpty() ? "" : links.get(0)
        ));
        if (!usernames.isEmpty()) {
            sources.add(new OsintSourceResponse(
                    "Username extraction",
                    "Found likely public handle(s): " + String.join(", ", usernames.stream().limit(5).toList()) + ".",
                    62,
                    "+4",
                    "good",
                    ""
            ));
        }
        GithubInvestigation githubInvestigation = githubInvestigation(links);
        sources.addAll(githubInvestigation.sources());
        GithubJobMatchResponse githubJobMatch = githubJobMatch(candidate.getProject(), githubInvestigation.profile());
        sources.add(new OsintSourceResponse(
                "Claim cross-check",
                candidate.getSupported() + " supported, " + candidate.getStretched() + " stretched, and " + candidate.getUnsupported() + " unsupported CV claims are ready for source attachment.",
                Math.max(30, Math.min(92, candidate.getScore())),
                candidate.getScore() >= 70 ? "+8" : "-4",
                candidate.getScore() >= 70 ? "good" : "warn",
                ""
        ));

        int corroborated = (int) sources.stream().filter(source -> source.confidence() >= 55).count();
        int identityConfidence = Math.min(96, Math.max(24, 35 + corroborated * 14 - candidate.getUnsupported() * 4));
        candidate.setOsint(corroborated >= 3 ? "Ready" : corroborated >= 1 ? "Partial" : "Escalate");
        OsintRunResponse response = new OsintRunResponse(
                state,
                candidate.getOsint(),
                checkedAt,
                consentedChecks,
                identityConfidence,
                corroborated,
                candidate.getUnsupported(),
                links,
                usernames,
                sources,
                githubInvestigation.profile(),
                githubJobMatch
        );
        candidate.setOsintReportJson(mapper.json(response));
        candidate.setOsintCheckedAt(checkedAt);
        candidate.setGithubMatchScore(githubJobMatch.score());
        candidate.setEvidenceScore(githubInvestigation.profile() == null
                ? 0
                : Math.min(100, Math.round(identityConfidence * 0.35f + githubJobMatch.score() * 0.65f)));
        candidateRepository.save(candidate);
        recordAnalysisRun(candidate, owner);
        recordActivity(candidate.getProject(), owner, "candidate_osint", "Ran evidence scan for " + candidate.getName(), "info", "SignalTrace evidence cards were refreshed.");
        publishProjectChange(candidate.getProject());

        return response;
    }

    @Transactional
    public OsintRunResponse latestOsint(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        OsintRunResponse report = mapper.osintReport(candidate.getOsintReportJson());
        if (report == null || report.github() == null) {
            return report;
        }

        // Older persisted reports predate job-specific GitHub matching. Upgrade them
        // when read so completed evidence never appears as a missing/fresh scan.
        GithubJobMatchResponse githubJobMatch = githubJobMatch(candidate.getProject(), report.github());
        OsintRunResponse refreshed = new OsintRunResponse(
                report.state(),
                report.status(),
                report.checkedAt(),
                report.consentedChecks(),
                report.identityConfidence(),
                report.corroboratedSources(),
                report.contradictions(),
                report.discoveredLinks(),
                report.discoveredUsernames(),
                report.sources(),
                report.github(),
                githubJobMatch
        );
        int evidenceScore = Math.min(100,
                Math.round(report.identityConfidence() * 0.35f + githubJobMatch.score() * 0.65f));
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

    @Transactional
    public void deleteCandidate(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        candidate.setDeletedAt(Instant.now());
        candidateRepository.save(candidate);
        recordCandidateActivity(candidate, owner, "candidate_delete", "Deleted candidate " + candidate.getName(), "danger", "Candidate was removed from active review lists.");
        publishProjectChange(candidate.getProject());
    }

    @Transactional
    public List<InviteResponse> invites(UserAccount actor, Long projectId) {
        HiringProject project = projectEntity(actor, projectId);
        requirePermission(actor, project, "canInvite");
        return inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId).stream().map(mapper::invite).toList();
    }

    @Transactional
    public List<ProjectMemberResponse> members(UserAccount actor, Long projectId) {
        HiringProject project = projectEntity(actor, projectId);
        List<ProjectMemberResponse> rows = new ArrayList<>();
        UserAccount owner = project.getOwner();
        rows.add(new ProjectMemberResponse(
                owner.getId(),
                displayName(owner),
                owner.getEmail(),
                "Head Admin",
                rolePermissions("Head Admin"),
                "ACTIVE",
                "OWNER",
                true
        ));
        Set<String> knownEmails = new HashSet<>();
        rows.forEach(row -> knownEmails.add(row.email().toLowerCase(Locale.ROOT)));
        for (ProjectInvite invite : inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId)) {
            String email = invite.getInvitedEmail().toLowerCase(Locale.ROOT);
            if (knownEmails.contains(email)) {
                continue;
            }
            UserAccount member = userAccountService.findActiveByUsernameOrEmail(email).orElse(null);
            boolean active = "ACCEPTED".equals(invite.getStatus()) && member != null;
            String role = active ? actorRole(member, project) : displayRole(invite.getRole());
            List<String> permissions = active ? permissionsFor(member, project) : rolePermissions(role);
            rows.add(new ProjectMemberResponse(
                    member == null ? invite.getId() : member.getId(),
                    member == null ? invite.getInvitedEmail().split("@")[0] : displayName(member),
                    invite.getInvitedEmail(),
                    role,
                    permissions,
                    active ? "ACTIVE" : invite.getStatus(),
                    active ? "MEMBERSHIP" : "INVITE",
                    permissions.contains("protectedAccount")
            ));
            knownEmails.add(email);
        }
        for (ProjectMemberPermission override : permissionService.overrides(projectId)) {
            String email = override.getMemberEmail().toLowerCase(Locale.ROOT);
            if (knownEmails.contains(email)) continue;
            UserAccount member = userAccountService.findActiveByUsernameOrEmail(email).orElse(null);
            if (member == null) continue;
            List<String> permissions = permissionsFor(member, project);
            rows.add(new ProjectMemberResponse(
                    member.getId(), displayName(member), member.getEmail(), actorRole(member, project), permissions,
                    "ACTIVE", "MEMBERSHIP", permissions.contains("protectedAccount")
            ));
            knownEmails.add(email);
        }
        return rows;
    }

    @Transactional
    public List<ProjectMemberResponse> updateMemberRole(UserAccount actor, Long projectId, MemberRoleRequest request) {
        HiringProject project = projectEntity(actor, projectId);
        requirePermission(actor, project, "canChangePermissions");
        String role = canonicalRole(request.role());
        String targetEmail = defaulted(request.email(), "").trim().toLowerCase(Locale.ROOT);
        UserAccount target = userAccountService.findActiveByUsernameOrEmail(targetEmail)
                .orElseThrow(() -> new IllegalArgumentException("Member user not found"));
        if (project.getOrganization() == null) {
            throw new IllegalArgumentException("Project organization not found");
        }
        TeamMembership targetMembership = membershipRepository.findByOrganizationIdAndUserId(project.getOrganization().getId(), target.getId())
                .orElseGet(() -> {
                    TeamMembership membership = new TeamMembership();
                    membership.setOrganization(project.getOrganization());
                    membership.setUser(target);
                    return membership;
                });

        if ("ORGANIZATION_ADMIN".equals(role)) {
            UserAccount previousOwner = project.getOwner();
            project.setOwner(target);
            if (!previousOwner.getId().equals(target.getId())) {
                TeamMembership previousMembership = membershipRepository.findByOrganizationIdAndUserId(project.getOrganization().getId(), previousOwner.getId())
                        .orElseGet(() -> {
                            TeamMembership membership = new TeamMembership();
                            membership.setOrganization(project.getOrganization());
                            membership.setUser(previousOwner);
                            return membership;
                        });
                previousMembership.setRole("ADMIN");
                membershipRepository.save(previousMembership);
                permissionService.saveRole(project, previousOwner, "ADMIN", actor);
            }
        }

        targetMembership.setRole(role);
        membershipRepository.save(targetMembership);
        permissionService.saveRole(project, target, role, actor);
        inviteRepository.findFirstByProjectIdAndInvitedEmailIgnoreCaseAndStatusOrderByCreatedAtDesc(projectId, target.getEmail(), "ACCEPTED")
                .ifPresent(invite -> {
                    invite.setRole(role);
                    inviteRepository.save(invite);
                });
        projectRepository.save(project);
        recordActivity(project, actor, "rank_change", "Changed member role", "warn", request.email() + " is now " + displayRole(role) + ".");
        publishProjectChange(project);
        return members(actor, projectId);
    }

    @Transactional
    public List<ProjectMemberResponse> removeMember(UserAccount actor, Long projectId, String email) {
        HiringProject project = projectEntity(actor, projectId);
        requirePermission(actor, project, "canKickMembers");
        String targetEmail = defaulted(email, "").trim().toLowerCase(Locale.ROOT);
        if (targetEmail.isBlank()) {
            throw new IllegalArgumentException("Member email required");
        }
        if (project.getOwner().getEmail().equalsIgnoreCase(targetEmail)) {
            throw new IllegalArgumentException("Protected owner cannot be kicked");
        }
        boolean removed = false;
        for (ProjectInvite invite : inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId)) {
            if (invite.getInvitedEmail().equalsIgnoreCase(targetEmail) && Set.of("PENDING", "ACCEPTED").contains(invite.getStatus())) {
                invite.setStatus("REVOKED");
                inviteRepository.save(invite);
                removed = true;
            }
        }
        removed = permissionService.removeOverrides(projectId, targetEmail) || removed;
        if (!removed) {
            throw new IllegalArgumentException("Project member not found");
        }
        recordActivity(project, actor, "kick", "Kicked " + targetEmail + " from project", "danger", targetEmail + " was removed from " + project.getTitle() + ".");
        publishProjectChange(project);
        return members(actor, projectId);
    }

    @Transactional
    public InviteResponse invite(UserAccount actor, Long projectId, InviteRequest request) {
        HiringProject project = projectEntity(actor, projectId);
        requirePermission(actor, project, "canInvite");
        ProjectInvite invite = new ProjectInvite();
        String rawInvitee = defaulted(request.email(), "").toLowerCase(Locale.ROOT);
        UserAccount invitedUser = userAccountService.findActiveByUsernameOrEmail(rawInvitee).orElse(null);
        if (invitedUser == null && !rawInvitee.contains("@")) {
            throw new IllegalArgumentException("Invite user not found");
        }
        invite.setProject(project);
        invite.setInvitedBy(actor);
        invite.setInvitedEmail(invitedUser != null ? invitedUser.getEmail() : rawInvitee);
        String defaultRole = projectSetting(project, "defaultRole", "Reviewer");
        invite.setRole(defaulted(request.role(), defaultRole).toUpperCase(Locale.ROOT));
        invite.setToken(randomToken());
        ProjectInvite saved = inviteRepository.save(invite);
        messageService.createInviteMessage(actor, saved.getInvitedEmail(), project.getTitle(), project.getId(), saved.getToken());
        recordActivity(project, actor, "invite_create", "Invited " + saved.getInvitedEmail(), "good", "Role: " + saved.getRole());
        publishProjectChange(project);
        return mapper.invite(saved);
    }

    @Transactional
    public InviteResponse acceptInvite(UserAccount actor, String token) {
        ProjectInvite invite = inviteRepository.findByTokenAndStatus(token, "PENDING")
                .orElseThrow(() -> new IllegalArgumentException("Invite not found"));
        if (!actor.getEmail().equalsIgnoreCase(invite.getInvitedEmail())) {
            throw new IllegalArgumentException("Invite belongs to a different account");
        }
        Organization organization = invite.getProject().getOrganization();
        if (organization == null) {
            organization = ensureOrganization(invite.getProject().getOwner());
            invite.getProject().setOrganization(organization);
        }
        if (!membershipRepository.existsByOrganizationIdAndUserId(organization.getId(), actor.getId())) {
            TeamMembership membership = new TeamMembership();
            membership.setOrganization(organization);
            membership.setUser(actor);
            membership.setRole(invite.getRole());
            membershipRepository.save(membership);
        }
        invite.setStatus("ACCEPTED");
        invite.setAcceptedAt(Instant.now());
        ProjectInvite saved = inviteRepository.save(invite);
        messageService.markInviteAccepted(saved.getToken(), actor);
        recordActivity(saved.getProject(), actor, "invite_accept", "Accepted invite", "good", actor.getEmail() + " joined the project.");
        publishProjectChange(saved.getProject());
        return mapper.invite(saved);
    }

    @Transactional
    public List<NoteResponse> notes(UserAccount actor, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        return noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId()).stream()
                .filter(note -> !Set.of("VOTE", "STATUS", "ACTIVITY").contains(defaulted(note.getType(), "").toUpperCase(Locale.ROOT)))
                .map(mapper::note)
                .toList();
    }

    @Transactional
    public NoteResponse addNote(UserAccount actor, Long projectId, Long candidateId, NoteRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        requirePermission(actor, candidate.getProject(), "canAddNote");
        CandidateReviewNote note = new CandidateReviewNote();
        note.setCandidate(candidate);
        note.setAuthor(actor);
        note.setType(defaulted(request.type(), "NOTE").toUpperCase(Locale.ROOT));
        note.setDecision(defaulted(request.decision(), "NONE").toUpperCase(Locale.ROOT));
        note.setBody(defaulted(request.body(), ""));
        CandidateReviewNote saved = noteRepository.save(note);
        recordCandidateActivity(candidate, actor, "candidate_note", "Added candidate note", "info", candidate.getName() + ": " + note.getDecision());
        publishProjectChange(candidate.getProject());
        return mapper.note(saved);
    }

    @Transactional
    public CandidateWorkflowResponse workflow(UserAccount actor, Long projectId, Long candidateId) {
        return workflowResponse(actor, candidateEntity(actor, projectId, candidateId));
    }

    @Transactional
    public CandidateWorkflowResponse vote(UserAccount actor, Long projectId, Long candidateId, VoteRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        requirePermission(actor, candidate.getProject(), "canVote");
        String action = defaulted(request.action(), "").toUpperCase(Locale.ROOT);
        if (!Set.of("UPVOTE", "DOWNVOTE", "STAR", "UNSTAR").contains(action)) {
            throw new IllegalArgumentException("Unsupported vote action");
        }
        double score = request.score() == null ? 0.0 : request.score();
        if ("UPVOTE".equals(action) && (score < 0.5 || score > 5.0 || Math.abs(score * 2 - Math.rint(score * 2)) > 0.0001)) {
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
        recordCandidateActivity(candidate, actor, "candidate_vote", activityLabel(note), "info", candidate.getName() + ": " + action);
        publishProjectChange(candidate.getProject());
        return workflowResponse(actor, candidate);
    }

    @Transactional
    public CandidateWorkflowResponse updateCandidateStatus(UserAccount actor, Long projectId, Long candidateId, CandidateStatusRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        String status = normalizeCandidateStatus(request.status());
        requireStatusPermission(actor, candidate.getProject(), status);
        String currentStatus = workflowStatus(defaulted(candidate.getState(), "Unreviewed"));
        if (status.equals(currentStatus)) {
            return workflowResponse(actor, candidate);
        }
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
        recordCandidateActivity(candidate, actor, "candidate_status", activityLabel(note), "warn", candidate.getName() + " moved to " + status + ".");
        publishProjectChange(candidate.getProject());
        return workflowResponse(actor, candidate);
    }

    private void requireWorkflowGate(HiringCandidate candidate, String targetStatus, String reason) {
        if (Set.of("OnInterview", "Hired", "Closed").contains(targetStatus) && reason.length() < 12) {
            throw new IllegalArgumentException("Add a decision reason of at least 12 characters");
        }
        if (!"Hired".equals(targetStatus)) {
            return;
        }
        String currentStatus = workflowStatus(defaulted(candidate.getState(), "Unreviewed"));
        if (!"OnInterview".equals(currentStatus)) {
            throw new IllegalArgumentException("Move the candidate to OnInterview before marking them Hired");
        }
        boolean hasReviewerDecision = noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId()).stream()
                .anyMatch(note -> "VOTE".equalsIgnoreCase(note.getType())
                        && Set.of("UPVOTE", "DOWNVOTE").contains(defaulted(note.getDecision(), "").toUpperCase(Locale.ROOT)));
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

    private HiringCandidate buildCandidate(HiringProject project, String name, String role, String cvText, String filename) {
        return buildCandidate(project, name, role, cvText, filename, null, analysisStateFromProject(project));
    }

    private HiringCandidate buildCandidate(HiringProject project, String name, String role, String cvText, String filename, Long excludedCandidateId) {
        return buildCandidate(project, name, role, cvText, filename, excludedCandidateId, analysisStateFromProject(project));
    }

    private HiringCandidate buildCandidate(HiringProject project, String name, String role, String cvText, String filename,
                                           Long excludedCandidateId, String analysisState) {
        CandidateAnalysisPolicy policy = analysisPolicy(analysisState);
        List<String> requirements = splitLines(project.getRequirementsText());
        if (requirements.isEmpty()) {
            requirements = extractRequirements(project.getDescription());
        }
        if (requirements.isEmpty()) {
            requirements = List.of(project.getTitle() + " role requirements");
        }
        requirements = weightedRubricRequirements(project, requirements);
        List<String> techTerms = analysisTechTerms(project);
        List<List<String>> baselineClaims = claims(cvText, requirements, techTerms);
        AuditAnalysisResult stateAnalysis =
                stateAnalysisOrchestrator.analyze(
                        policy.stateId(),
                        baselineClaims.stream().map(row -> row.get(0)).toList(),
                        trimCandidateEvidence(cvText));
        List<List<String>> claims = candidateClaims(baselineClaims, stateAnalysis);
        int supported = (int) claims.stream().filter(row -> "Supported".equals(row.get(1))).count();
        int stretched = (int) claims.stream().filter(row -> "Stretched".equals(row.get(1))).count();
        int unsupported = (int) claims.stream().filter(row -> "Unsupported".equals(row.get(1))).count();
        int total = Math.max(1, supported + stretched + unsupported);
        int match = Math.max(requirementMatch(requirements, cvText, techTerms),
                Math.round((supported * 100f + stretched * policy.stretchedMatchWeight()) / total));
        match = Math.min(98, Math.max(12, match));
        int flags = unsupported * policy.unsupportedFlagWeight()
                + stretched * policy.stretchedFlagWeight()
                + riskyMatches(project, cvText).size() * policy.riskyPhraseWeight();
        int positiveEvidence = Math.min(policy.positiveEvidenceCap(), supported / 2);
        int score = Math.max(8, Math.min(99,
                match + positiveEvidence
                        - unsupported * policy.unsupportedScorePenalty()
                        - stretched * policy.stretchedScorePenalty()
                        - Math.min(policy.flagPenaltyCap(), flags)));

        HiringCandidate candidate = new HiringCandidate();
        String candidateEmail = extractCandidateEmail(cvText);
        List<HiringCandidate> priorApplications = priorApplications(project, name, candidateEmail, excludedCandidateId);
        candidate.setProject(project);
        candidate.setName(name);
        candidate.setCandidateEmail(candidateEmail);
        candidate.setRole(role);
        candidate.setCvText(cvText);
        candidate.setResumeFilename(defaulted(filename, "manual-entry.txt"));
        candidate.setSupported(supported);
        candidate.setStretched(stretched);
        candidate.setUnsupported(unsupported);
        candidate.setMatchScore(match);
        candidate.setEvidenceScore(0);
        candidate.setGithubMatchScore(0);
        candidate.setReviewerScore(0);
        candidate.setScore(score);
        candidate.setRisk(score < policy.highRiskScore() || unsupported >= policy.highRiskUnsupported()
                ? "High"
                : score < policy.mediumRiskScore() || stretched >= policy.mediumRiskStretched() ? "Medium" : "Low");
        candidate.setState("Unreviewed");
        candidate.setOsint("Partial");
        candidate.setMemory(memoryStatus(priorApplications, unsupported));
        candidate.setAnalysisState(policy.stateId());
        candidate.setAnalysisEngine(stateAnalysis.engine());
        candidate.setAnalysisPromptVersion(
                stateAnalysis.engine().contains("LLM_")
                        ? AuditPromptCatalog.VERSION
                        : "local-state-policy-v2");
        candidate.setAnalysisCompletedAt(Instant.now());
        candidate.setPromptTokens(stateAnalysis.usage().promptTokens());
        candidate.setCompletionTokens(stateAnalysis.usage().completionTokens());
        candidate.setTotalTokens(stateAnalysis.usage().totalTokens());
        candidate.setEstimatedCostUsd(stateAnalysis.usage().estimatedCostUsd());
        candidate.setInitializedAnalysisStatesJson(mapper.json(List.of(policy.stateId())));
        candidate.setMemoryHistoryJson(mapper.json(priorApplications.stream().map(prior -> Map.<String, Object>of(
                "candidateId", prior.getId(),
                "projectId", prior.getProject().getId(),
                "projectTitle", prior.getProject().getTitle(),
                "score", prior.getScore(),
                "risk", prior.getRisk(),
                "unsupported", prior.getUnsupported(),
                "submittedAt", prior.getCreatedAt().toString()
        )).toList()));
        candidate.setFlags(flags);
        candidate.setSummary(summary(candidate, project));
        candidate.setClaimsJson(mapper.json(claims));
        candidate.setAuditPhraseMatchesJson(mapper.json(riskyMatches(project, cvText)));
        return candidate;
    }

    private void applyCandidateAnalysis(HiringCandidate candidate, HiringCandidate refreshed) {
        candidate.setScore(refreshed.getScore());
        candidate.setMatchScore(refreshed.getMatchScore());
        candidate.setRisk(refreshed.getRisk());
        candidate.setCandidateEmail(refreshed.getCandidateEmail());
        candidate.setMemory(refreshed.getMemory());
        candidate.setMemoryHistoryJson(refreshed.getMemoryHistoryJson());
        candidate.setFlags(refreshed.getFlags());
        candidate.setSupported(refreshed.getSupported());
        candidate.setStretched(refreshed.getStretched());
        candidate.setUnsupported(refreshed.getUnsupported());
        candidate.setSummary(refreshed.getSummary());
        candidate.setClaimsJson(refreshed.getClaimsJson());
        candidate.setAuditPhraseMatchesJson(refreshed.getAuditPhraseMatchesJson());
        candidate.setAnalysisEngine(refreshed.getAnalysisEngine());
        candidate.setAnalysisPromptVersion(refreshed.getAnalysisPromptVersion());
        candidate.setAnalysisCompletedAt(refreshed.getAnalysisCompletedAt());
        candidate.setPromptTokens(refreshed.getPromptTokens());
        candidate.setCompletionTokens(refreshed.getCompletionTokens());
        candidate.setTotalTokens(refreshed.getTotalTokens());
        candidate.setEstimatedCostUsd(refreshed.getEstimatedCostUsd());
    }

    private List<List<String>> candidateClaims(
            List<List<String>> baselineClaims,
            AuditAnalysisResult analysis) {
        boolean aiCompleted = analysis.engine().contains("LLM_");
        Map<Integer, AnalyzedVerdict> verdicts = analysis.verdicts().stream()
                .collect(java.util.stream.Collectors.toMap(
                        AnalyzedVerdict::sentenceIndex,
                        verdict -> verdict,
                        (first, ignored) -> first));
        List<List<String>> rows = new ArrayList<>();
        for (int index = 0; index < baselineClaims.size(); index++) {
            List<String> baseline = baselineClaims.get(index);
            AnalyzedVerdict verdict = verdicts.get(index);
            if (!aiCompleted || verdict == null || verdict.status() == VerdictStatus.NOT_A_CLAIM) {
                rows.add(baseline);
                continue;
            }
            rows.add(List.of(
                    baseline.get(0),
                    candidateStatus(verdict.status()),
                    verdict.explanation()
                            + ("No evidence found.".equals(verdict.evidencePointer())
                            ? ""
                            : " Evidence: " + verdict.evidencePointer())));
        }
        return rows.stream().limit(120).toList();
    }

    private String trimCandidateEvidence(String cvText) {
        String evidence = defaulted(cvText, "");
        return evidence.length() <= MAX_CANDIDATE_AI_EVIDENCE_CHARS
                ? evidence
                : evidence.substring(0, MAX_CANDIDATE_AI_EVIDENCE_CHARS);
    }

    private String candidateStatus(VerdictStatus status) {
        return switch (status) {
            case SUPPORTED -> "Supported";
            case STRETCHED -> "Stretched";
            case UNSUPPORTED -> "Unsupported";
            case GAP -> "Gap";
            case NOT_A_CLAIM -> "Gap";
        };
    }

    private String normalizeAnalysisState(String state) {
        String normalized = defaulted(state, "").trim().toLowerCase(Locale.ROOT);
        if (!Set.of(CheckStateIds.LIGHT, CheckStateIds.WAR, CheckStateIds.PERSON, CheckStateIds.STRICT_WAR_AI).contains(normalized)) {
            throw new IllegalArgumentException("Unsupported candidate analysis state");
        }
        return normalized;
    }

    private String analysisStateFromProject(HiringProject project) {
        String configuredState = projectSetting(project, "defaultAuditState", project.getState());
        return analysisStateFromProjectValue(configuredState);
    }

    private String projectSetting(HiringProject project, String key, String fallback) {
        Object value = projectStateService.effectiveSettings(project).get(key);
        String clean = value == null ? "" : String.valueOf(value).trim();
        return clean.isBlank() ? fallback : clean;
    }

    private void requireCandidateIntake(HiringProject project, boolean fileUpload) {
        String mode = projectSetting(project, "candidateIntake", "Manual + resume upload");
        if (fileUpload && "Manual only".equalsIgnoreCase(mode)) {
            throw new IllegalArgumentException("This project accepts manually pasted candidate text only.");
        }
        if (!fileUpload && "Resume upload only".equalsIgnoreCase(mode)) {
            throw new IllegalArgumentException("This project requires a PDF, DOCX, or TXT resume upload.");
        }
    }

    private List<String> analysisTechTerms(HiringProject project) {
        LinkedHashMap<String, String> terms = new LinkedHashMap<>();
        atsKeywordCatalog.techTerms().forEach(term -> terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        projectStateService.activeAnalysisTemplate(project).techTerms()
                .forEach(term -> terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        return List.copyOf(terms.values());
    }

    private List<String> analysisRiskyWords(HiringProject project) {
        LinkedHashMap<String, String> terms = new LinkedHashMap<>();
        atsKeywordCatalog.riskyWords().forEach(term -> terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        projectStateService.activeAnalysisTemplate(project).riskyWords()
                .forEach(term -> terms.putIfAbsent(term.toLowerCase(Locale.ROOT), term.toLowerCase(Locale.ROOT)));
        return List.copyOf(terms.values());
    }

    private String analysisStateFromProjectValue(String projectState) {
        String normalized = defaulted(projectState, "").toLowerCase(Locale.ROOT);
        if (normalized.contains("light")) return CheckStateIds.LIGHT;
        if (normalized.contains("person")) return CheckStateIds.PERSON;
        if (normalized.contains("war+ai") || normalized.contains("war_ai") || normalized.contains("strict")) {
            return CheckStateIds.STRICT_WAR_AI;
        }
        if (normalized.contains("war")) return CheckStateIds.WAR;
        return CheckStateIds.STRICT_WAR_AI;
    }

    private String analysisStateLabel(String state) {
        return switch (defaulted(state, "")) {
            case CheckStateIds.LIGHT -> "Light State";
            case CheckStateIds.WAR -> "WAR State";
            case CheckStateIds.PERSON -> "Person_AI State";
            case CheckStateIds.STRICT_WAR_AI -> "WAR_AI State";
            default -> "default state";
        };
    }

    private CandidateAnalysisPolicy analysisPolicy(String state) {
        return switch (normalizeAnalysisState(state)) {
            case CheckStateIds.LIGHT -> new CandidateAnalysisPolicy(
                    CheckStateIds.LIGHT, 72, 1, 0, 0, 3, 1, 16, 8, 35, 4, 62, 5);
            case CheckStateIds.WAR -> new CandidateAnalysisPolicy(
                    CheckStateIds.WAR, 52, 2, 1, 1, 7, 3, 16, 15, 52, 2, 76, 2);
            case CheckStateIds.PERSON -> new CandidateAnalysisPolicy(
                    CheckStateIds.PERSON, 64, 1, 1, 1, 5, 2, 20, 12, 44, 3, 70, 3);
            case CheckStateIds.STRICT_WAR_AI -> new CandidateAnalysisPolicy(
                    CheckStateIds.STRICT_WAR_AI, 45, 3, 1, 2, 8, 3, 14, 18, 58, 2, 80, 2);
            default -> throw new IllegalArgumentException("Unsupported candidate analysis state");
        };
    }

    private record CandidateAnalysisPolicy(
            String stateId,
            int stretchedMatchWeight,
            int unsupportedFlagWeight,
            int stretchedFlagWeight,
            int riskyPhraseWeight,
            int unsupportedScorePenalty,
            int stretchedScorePenalty,
            int positiveEvidenceCap,
            int flagPenaltyCap,
            int highRiskScore,
            int highRiskUnsupported,
            int mediumRiskScore,
            int mediumRiskStretched
    ) {
    }

    private List<HiringCandidate> priorApplications(HiringProject project, String name, String email, Long excludedCandidateId) {
        if (project.getOrganization() == null) {
            return List.of();
        }
        return candidateRepository.findPriorApplications(
                        project.getOrganization().getId(),
                        defaulted(name, ""),
                        defaulted(email, ""),
                        new OffsetLimitPageable(0, 6, Sort.by(Sort.Direction.DESC, "createdAt")))
                .stream()
                .filter(candidate -> excludedCandidateId == null || !excludedCandidateId.equals(candidate.getId()))
                .limit(5)
                .toList();
    }

    private String memoryStatus(List<HiringCandidate> priorApplications, int unsupported) {
        if (priorApplications.isEmpty()) {
            return "No prior record";
        }
        boolean mismatch = priorApplications.stream().anyMatch(prior ->
                "High".equalsIgnoreCase(prior.getRisk()) || Math.abs(prior.getUnsupported() - unsupported) >= 2);
        return mismatch ? "Previous mismatch" : "Returning candidate";
    }

    private String extractCandidateEmail(String cvText) {
        var matcher = EMAIL.matcher(defaulted(cvText, ""));
        return matcher.find() ? matcher.group(1).toLowerCase(Locale.ROOT) : "";
    }

    private HiringCandidate saveAnalyzedCandidate(HiringCandidate candidate) {
        if (candidate.getScore() <= 0 || candidate.getMatchScore() <= 0 || candidate.getRisk() == null || candidate.getRisk().isBlank()) {
            throw new IllegalStateException("Candidate scoring must run before saving");
        }
        return candidateRepository.saveAndFlush(candidate);
    }

    private void recordAnalysisRun(HiringCandidate candidate, UserAccount actor) {
        ProjectStateService.AnalysisTemplate template = projectStateService.activeAnalysisTemplate(candidate.getProject());
        CandidateAnalysisRun run = new CandidateAnalysisRun();
        run.setCandidate(candidate);
        run.setProject(candidate.getProject());
        run.setTriggeredBy(actor);
        run.setStateId(candidate.getAnalysisState());
        run.setEngine(candidate.getAnalysisEngine());
        run.setPromptVersion(candidate.getAnalysisPromptVersion());
        run.setResumeFingerprint(fingerprintService.sha256(defaulted(candidate.getCvText(), "")));
        run.setTemplateFingerprint(fingerprintService.sha256(
                template.name() + "\n" + defaulted(template.sourceJson(), "bundled-default")));
        run.setRecommendationScore(candidate.getScore());
        run.setFitScore(candidate.getMatchScore());
        run.setEvidenceScore(candidate.getEvidenceScore());
        run.setGithubMatchScore(candidate.getGithubMatchScore());
        run.setReviewerScore(candidate.getReviewerScore());
        run.setSupported(candidate.getSupported());
        run.setStretched(candidate.getStretched());
        run.setUnsupported(candidate.getUnsupported());
        run.setPromptTokens(candidate.getPromptTokens());
        run.setCompletionTokens(candidate.getCompletionTokens());
        run.setEstimatedCostUsd(candidate.getEstimatedCostUsd());
        run.setClaimsJson(candidate.getClaimsJson());
        analysisRunRepository.save(run);
    }

    private void restoreAnalysisRun(HiringCandidate candidate, CandidateAnalysisRun run) {
        candidate.setScore(run.getRecommendationScore());
        candidate.setMatchScore(run.getFitScore());
        candidate.setSupported(run.getSupported());
        candidate.setStretched(run.getStretched());
        candidate.setUnsupported(run.getUnsupported());
        candidate.setAnalysisEngine(run.getEngine());
        candidate.setAnalysisPromptVersion(run.getPromptVersion());
        candidate.setAnalysisCompletedAt(run.getCreatedAt());
        candidate.setPromptTokens(run.getPromptTokens());
        candidate.setCompletionTokens(run.getCompletionTokens());
        candidate.setTotalTokens(run.getPromptTokens() + run.getCompletionTokens());
        candidate.setEstimatedCostUsd(run.getEstimatedCostUsd());
        candidate.setClaimsJson(run.getClaimsJson());
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

    private List<List<String>> claims(String cvText, List<String> requirements, List<String> techTerms) {
        List<List<String>> rows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String normalizedCv = normalize(cvText);
        String normalizedRequirements = normalize(String.join(" ", requirements));
        for (String requirement : requirements) {
            String status = requirementStatus(requirement, normalizedCv, techTerms);
            String reason = "Supported".equals(status)
                    ? "The CV mentions multiple terms aligned with this requirement. This is resume alignment, not independent verification."
                    : "Stretched".equals(status)
                    ? "The CV partially overlaps this requirement. Depth and ownership still need independent evidence."
                    : "The CV does not clearly mention this requirement.";
            addClaim(rows, seen, requirement, status, reason);
        }
        for (String sentence : SENTENCE.split(defaulted(cvText, ""))) {
            String clean = sentence.trim();
            if (clean.length() < 18) {
                continue;
            }
            String lower = normalize(clean);
            boolean risky = atsKeywordCatalog.riskyWords().stream().anyMatch(lower::contains);
            int requirementHits = keywordHits(clean, normalizedRequirements);
            if (risky) {
                addClaim(rows, seen, clean, "Stretched", "The wording raises the proof burden and should be backed by concrete project, duration, team, or production evidence.");
            } else if (requirementHits >= 2) {
                addClaim(rows, seen, clean, "Supported", "This self-reported CV sentence overlaps multiple job terms; it is not independently verified.");
            } else if (hasConcreteTechnicalSignal(lower, techTerms)) {
                addClaim(rows, seen, clean, "Supported", "This CV sentence contains a concrete technical or measurable statement that still requires independent verification.");
            } else if (requirementHits == 1) {
                addClaim(rows, seen, clean, "Stretched", "This CV sentence has partial job overlap but needs stronger proof.");
            } else if (isNeutralCvLine(clean)) {
                addClaim(rows, seen, clean, "Gap", "This CV line is neutral context and is not counted as negative evidence for the job match.");
            } else {
                addClaim(rows, seen, clean, "Gap", "This CV sentence is shown for review but does not contain enough concrete job-specific evidence by itself.");
            }
        }
        if (rows.isEmpty()) {
            addClaim(rows, seen, "Candidate CV", "Unsupported", "No readable CV text was available for analysis.");
        }
        return rows.stream().limit(120).toList();
    }

    private List<String> discoveredLinks(String text) {
        return discoverPublicLinks(text);
    }

    static List<String> discoverPublicLinks(String text) {
        List<String> links = new ArrayList<>();
        var matcher = URL.matcher(text == null ? "" : text);
        while (matcher.find()) {
            String link = matcher.group().replaceAll("[.,;:]+$", "");
            if (!link.toLowerCase(Locale.ROOT).startsWith("http://")
                    && !link.toLowerCase(Locale.ROOT).startsWith("https://")) {
                link = "https://" + link;
            }
            if (!links.contains(link)) {
                links.add(link);
            }
        }
        return links.stream().limit(25).toList();
    }

    private List<String> discoveredUsernames(String text, List<String> links) {
        List<String> usernames = new ArrayList<>();
        var handleMatcher = HANDLE.matcher(defaulted(text, ""));
        while (handleMatcher.find()) {
            addUnique(usernames, handleMatcher.group(1));
        }
        for (String link : links) {
            var githubMatcher = GITHUB_URL.matcher(link);
            if (githubMatcher.find()) {
                addUnique(usernames, githubMatcher.group(1));
            }
        }
        return usernames.stream().limit(25).toList();
    }

    private GithubInvestigation githubInvestigation(List<String> links) {
        String githubLink = "";
        String username = "";
        for (String link : links) {
            var matcher = GITHUB_URL.matcher(link);
            if (!matcher.find()) {
                continue;
            }
            String candidateUsername = matcher.group(1);
            if (Set.of("topics", "marketplace", "features", "settings", "orgs").contains(candidateUsername.toLowerCase(Locale.ROOT))) {
                continue;
            }
            githubLink = link;
            username = candidateUsername;
            break;
        }

        if (username.isBlank()) {
            return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                    "GitHub",
                    "No GitHub profile URL was found in the CV, so repository language evidence could not be checked automatically.",
                    24,
                    "0",
                    "warn",
                    ""
            )));
        }

        try {
            HttpResponse<String> profileResponse = httpClient.send(githubRequest(
                    URI.create("https://api.github.com/users/" + username),
                    java.time.Duration.ofSeconds(6)), HttpResponse.BodyHandlers.ofString());
            if (profileResponse.statusCode() == 404) {
                return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                        "GitHub", "GitHub URL was found, but the profile did not resolve through the public API.",
                        18, "-4", "bad", githubLink)));
            }
            if (profileResponse.statusCode() != 200) {
                return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                        "GitHub", "GitHub public API returned status " + profileResponse.statusCode() + " for @" + username + ".",
                        30, "0", "warn", githubLink)));
            }

            Map<String, Object> profilePayload = mapper.map(profileResponse.body());
            HttpResponse<String> repositoriesResponse = httpClient.send(githubRequest(
                    URI.create("https://api.github.com/users/" + username + "/repos?sort=pushed&direction=desc&per_page=30"),
                    java.time.Duration.ofSeconds(8)), HttpResponse.BodyHandlers.ofString());
            List<Map<String, Object>> repositoryPayloads = repositoriesResponse.statusCode() == 200
                    ? mapper.maps(repositoriesResponse.body())
                    : List.of();
            List<GithubRepositoryResponse> repositories = new ArrayList<>();
            for (int index = 0; index < repositoryPayloads.size(); index++) {
                repositories.add(githubRepository(repositoryPayloads.get(index), username, index));
            }

            int original = (int) repositories.stream().filter(repository -> !repository.fork()).count();
            int forked = repositories.size() - original;
            int substantial = (int) repositories.stream()
                    .filter(repository -> repository.sizeKb() >= 80 && !repository.fork())
                    .count();
            int recent = (int) repositories.stream()
                    .filter(repository -> repository.pushedAt() != null
                            && repository.pushedAt().isAfter(Instant.now().minus(365, java.time.temporal.ChronoUnit.DAYS)))
                    .count();
            int depthScore = repositories.isEmpty()
                    ? 0
                    : Math.min(100, 18 + original * 4 + substantial * 7 + recent * 4 - forked * 2);
            List<GithubLanguageResponse> languages = githubLanguages(repositories);
            Instant latestActivity = repositories.stream()
                    .map(GithubRepositoryResponse::pushedAt)
                    .filter(java.util.Objects::nonNull)
                    .max(Comparator.naturalOrder())
                    .orElse(parseInstant(profilePayload.get("updated_at")));
            int publicRepos = number(profilePayload.get("public_repos"));
            int followers = number(profilePayload.get("followers"));
            GithubProfileResponse profile = new GithubProfileResponse(
                    username,
                    cleanApiText(profilePayload.get("name")),
                    cleanApiText(profilePayload.get("avatar_url")),
                    defaulted(cleanApiText(profilePayload.get("html_url")), githubLink),
                    cleanApiText(profilePayload.get("bio")),
                    cleanApiText(profilePayload.get("company")),
                    cleanApiText(profilePayload.get("location")),
                    cleanApiText(profilePayload.get("blog")),
                    publicRepos,
                    followers,
                    number(profilePayload.get("following")),
                    parseInstant(profilePayload.get("created_at")),
                    parseInstant(profilePayload.get("updated_at")),
                    latestActivity,
                    depthScore,
                    languages,
                    repositories
            );

            String profileFinding = "GitHub profile @" + username + " is public with "
                    + publicRepos + " repositories and " + followers + " followers.";
            String depthFinding = repositories.isEmpty()
                    ? "No public repositories were returned for depth analysis."
                    : "Depth " + depthScore + "/100 across " + repositories.size() + " recent repositories: "
                    + original + " original, " + forked + " forked, " + substantial + " substantial, and "
                    + recent + " active in the last year.";
            List<OsintSourceResponse> sources = List.of(
                    new OsintSourceResponse("GitHub profile", profileFinding,
                            publicRepos > 0 ? 78 : 42, publicRepos > 0 ? "+12" : "+2",
                            publicRepos > 0 ? "good" : "warn", githubLink),
                    new OsintSourceResponse("GitHub repository depth", depthFinding,
                            repositories.isEmpty() ? 34 : Math.max(40, Math.min(92, depthScore)),
                            depthScore >= 65 ? "+14" : depthScore >= 40 ? "+5" : "0",
                            depthScore >= 65 ? "good" : "warn", githubLink),
                    new OsintSourceResponse("LinkedIn",
                            "Not checked. SignalTrace detected public profile text where present, but LinkedIn verification requires an approved provider or candidate-supplied evidence.",
                            0, "0", "neutral", firstLinkForHost(links, "linkedin.com"))
            );
            return new GithubInvestigation(profile, sources);
        } catch (IOException exception) {
            return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                    "GitHub", "GitHub check failed because the public API could not be reached.",
                    26, "0", "warn", githubLink)));
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return new GithubInvestigation(null, List.of(new OsintSourceResponse(
                    "GitHub", "GitHub check was interrupted before completion.",
                    20, "0", "warn", githubLink)));
        }
    }

    private GithubRepositoryResponse githubRepository(Map<String, Object> payload, String username, int index) {
        String name = cleanApiText(payload.get("name"));
        Map<String, Long> languageBytes = index < 10
                ? githubLanguageBytes(username, name)
                : Map.of();
        String readmeExcerpt = index < 5
                ? githubReadmeExcerpt(username, name)
                : "";
        return new GithubRepositoryResponse(
                name,
                cleanApiText(payload.get("description")),
                cleanApiText(payload.get("html_url")),
                cleanApiText(payload.get("language")),
                number(payload.get("stargazers_count")),
                number(payload.get("forks_count")),
                number(payload.get("open_issues_count")),
                number(payload.get("size")),
                Boolean.TRUE.equals(payload.get("fork")),
                Boolean.TRUE.equals(payload.get("archived")),
                cleanApiText(payload.get("default_branch")),
                nestedText(payload.get("owner"), "login"),
                languageBytes,
                readmeExcerpt,
                parseInstant(payload.get("created_at")),
                parseInstant(payload.get("updated_at")),
                parseInstant(payload.get("pushed_at")),
                stringValues(payload.get("topics"))
        );
    }

    private List<GithubLanguageResponse> githubLanguages(List<GithubRepositoryResponse> repositories) {
        Map<String, Long> bytes = new LinkedHashMap<>();
        Map<String, Integer> repositoriesByLanguage = new LinkedHashMap<>();
        for (GithubRepositoryResponse repository : repositories) {
            if (!repository.languageBytes().isEmpty()) {
                repository.languageBytes().forEach((language, count) -> {
                    bytes.merge(language, count, Long::sum);
                    repositoriesByLanguage.merge(language, 1, Integer::sum);
                });
            } else if (repository.language() != null && !repository.language().isBlank()) {
                bytes.merge(repository.language(), Math.max(1L, repository.sizeKb() * 1024L), Long::sum);
                repositoriesByLanguage.merge(repository.language(), 1, Integer::sum);
            }
        }
        long total = bytes.values().stream().mapToLong(Long::longValue).sum();
        if (total <= 0) {
            return List.of();
        }
        return bytes.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .map(entry -> new GithubLanguageResponse(
                        entry.getKey(),
                        repositoriesByLanguage.getOrDefault(entry.getKey(), 0),
                        entry.getValue(),
                        (int) Math.round(entry.getValue() * 100.0 / total)))
                .toList();
    }

    private Map<String, Long> githubLanguageBytes(String username, String repository) {
        if (username.isBlank() || repository.isBlank()) {
            return Map.of();
        }
        try {
            HttpResponse<String> response = httpClient.send(githubRequest(
                    URI.create("https://api.github.com/repos/" + username + "/" + repository + "/languages"),
                    java.time.Duration.ofSeconds(5)), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return Map.of();
            }
            Map<String, Object> payload = mapper.map(response.body());
            Map<String, Long> result = new LinkedHashMap<>();
            payload.forEach((language, value) -> {
                if (value instanceof Number number) {
                    result.put(language, Math.max(0L, number.longValue()));
                }
            });
            return result;
        } catch (IOException exception) {
            return Map.of();
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return Map.of();
        }
    }

    private String githubReadmeExcerpt(String username, String repository) {
        if (username.isBlank() || repository.isBlank()) {
            return "";
        }
        try {
            HttpResponse<String> response = httpClient.send(githubRequest(
                    URI.create("https://api.github.com/repos/" + username + "/" + repository + "/readme"),
                    java.time.Duration.ofSeconds(5)), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() != 200) {
                return "";
            }
            String encoded = cleanApiText(mapper.map(response.body()).get("content")).replaceAll("\\s+", "");
            if (encoded.isBlank()) {
                return "";
            }
            String decoded = new String(Base64.getDecoder().decode(encoded), java.nio.charset.StandardCharsets.UTF_8)
                    .replaceAll("(?s)```.*?```", " ")
                    .replaceAll("[#>*_`\\[\\]()!]", " ")
                    .replaceAll("\\s+", " ")
                    .trim();
            return decoded.substring(0, Math.min(900, decoded.length()));
        } catch (IllegalArgumentException | IOException exception) {
            return "";
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return "";
        }
    }

    private GithubJobMatchResponse githubJobMatch(HiringProject project, GithubProfileResponse profile) {
        if (profile == null) {
            return new GithubJobMatchResponse(
                    0,
                    "Not available",
                    "No GitHub profile was verified, so public repository evidence could not be compared with this job.",
                    List.of(),
                    List.of()
            );
        }

        String jobText = normalize(project.getTitle() + " " + project.getRequirementsText() + " " + project.getDescription());
        List<String> requiredTerms = atsKeywordCatalog.techTerms().stream()
                .filter(term -> containsNormalizedTerm(jobText, term))
                .distinct()
                .limit(30)
                .toList();
        if (requiredTerms.isEmpty()) {
            requiredTerms = List.of(project.getTitle()).stream()
                    .flatMap(value -> java.util.Arrays.stream(normalize(value).split(" ")))
                    .filter(value -> value.length() >= 4 && !STOP_WORDS.contains(value))
                    .distinct()
                    .limit(12)
                    .toList();
        }

        List<GithubLanguageResponse> profileLanguages = profile.languages() == null ? List.of() : profile.languages();
        List<GithubRepositoryResponse> profileRepositories = profile.repositories() == null ? List.of() : profile.repositories();
        String repositoryEvidence = normalize(
                profileLanguages.stream().map(GithubLanguageResponse::name).reduce("", (left, right) -> left + " " + right)
                        + " "
                        + profileRepositories.stream()
                        .map(repository -> repository.name() + " " + repository.description() + " "
                                + String.join(" ", repository.topics() == null ? List.of() : repository.topics())
                                + " " + repository.readmeExcerpt())
                        .reduce("", (left, right) -> left + " " + right)
        );
        List<String> matched = requiredTerms.stream()
                .filter(term -> containsNormalizedTerm(repositoryEvidence, term))
                .toList();
        List<String> missing = requiredTerms.stream()
                .filter(term -> !containsNormalizedTerm(repositoryEvidence, term))
                .toList();
        int coverageScore = requiredTerms.isEmpty()
                ? 0
                : (int) Math.round(matched.size() * 100.0 / requiredTerms.size());
        int score = requiredTerms.isEmpty()
                ? 0
                : Math.min(100, Math.round(coverageScore * 0.85f + Math.min(15, profile.repositoryDepthScore() * 0.15f)));
        String label = score >= 75 ? "Strong GitHub match"
                : score >= 50 ? "Partial GitHub match"
                : score > 0 ? "Weak GitHub match"
                : "No GitHub match";
        String summary = matched.isEmpty()
                ? "The recent public repositories do not expose the job's required technology terms."
                : "Public repositories expose " + matched.size() + " of " + requiredTerms.size()
                + " job-related technology signals.";
        return new GithubJobMatchResponse(score, label, summary, matched, missing);
    }

    private boolean containsNormalizedTerm(String normalizedCorpus, String term) {
        String normalizedTerm = normalize(term);
        return !normalizedTerm.isBlank()
                && (" " + normalizedCorpus + " ").contains(" " + normalizedTerm + " ");
    }

    private List<String> stringValues(Object value) {
        if (!(value instanceof List<?> values)) {
            return List.of();
        }
        return values.stream()
                .map(this::cleanApiText)
                .filter(item -> !item.isBlank())
                .limit(20)
                .toList();
    }

    private String cleanApiText(Object value) {
        if (value == null) {
            return "";
        }
        String text = String.valueOf(value).trim();
        return "null".equalsIgnoreCase(text) ? "" : text;
    }

    private String nestedText(Object value, String key) {
        if (!(value instanceof Map<?, ?> values)) {
            return "";
        }
        return cleanApiText(values.get(key));
    }

    private String firstLinkForHost(List<String> links, String host) {
        return links.stream()
                .filter(link -> link.toLowerCase(Locale.ROOT).contains(host.toLowerCase(Locale.ROOT)))
                .findFirst()
                .orElse("");
    }

    private Instant parseInstant(Object value) {
        String text = cleanApiText(value);
        if (text.isBlank()) {
            return null;
        }
        try {
            return Instant.parse(text);
        } catch (RuntimeException exception) {
            return null;
        }
    }

    // Extracted to public record GithubInvestigation in same package

    private void addUnique(List<String> values, String value) {
        String clean = defaulted(value, "").replaceAll("^[^a-zA-Z0-9]+|[^a-zA-Z0-9_-]+$", "");
        if (!clean.isBlank() && !values.contains(clean)) {
            values.add(clean);
        }
    }

    private int number(Object value) {
        if (value instanceof Number number) {
            return number.intValue();
        }
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (NumberFormatException exception) {
            return 0;
        }
    }

    private void addClaim(List<List<String>> rows, Set<String> seen, String claim, String status, String reason) {
        String clean = defaulted(claim, "");
        if (clean.isBlank() || !seen.add(normalize(clean))) {
            return;
        }
        rows.add(List.of(clean, status, reason));
    }

    private boolean hasConcreteTechnicalSignal(String normalizedText) {
        return hasConcreteTechnicalSignal(normalizedText, atsKeywordCatalog.techTerms());
    }

    private boolean hasConcreteTechnicalSignal(String normalizedText, List<String> techTerms) {
        if (isContactOrLinkLine(normalizedText)) {
            return false;
        }
        if (normalizedText.matches(".*\\b\\d+\\b.*")) {
            return true;
        }
        return techTerms.stream().anyMatch(term -> normalizedText.matches(".*\\b" + Pattern.quote(term) + "\\b.*"));
    }

    private boolean isNeutralCvLine(String text) {
        String clean = defaulted(text, "").trim();
        String normalized = normalize(clean);
        if (normalized.isBlank()) {
            return true;
        }
        if (isContactOrLinkLine(normalized)) {
            return true;
        }
        if (Set.of(
                "contact", "profile", "technical skills", "soft skills", "education", "projects",
                "certifications and awards", "languages"
        ).contains(normalized)) {
            return true;
        }
        if (normalized.matches(".*\\b(native|fluent|intermediate|conversational)\\b.*")) {
            return true;
        }
        if (normalized.matches("^[a-z ]+(university|academy|center|school|institute)[a-z ]*$")) {
            return true;
        }
        return normalized.matches(".*\\b(email|phone|linkedin|github|mailto|http|https)\\b.*");
    }

    private boolean isContactOrLinkLine(String normalizedText) {
        return normalizedText.matches(".*\\b(phone|email|linkedin|github|mailto|contact)\\b.*")
                || normalizedText.contains("http")
                || normalizedText.contains("@");
    }

    private List<Map<String, Object>> riskyMatches(HiringProject project, String text) {
        List<Map<String, Object>> matches = new ArrayList<>();
        String lower = defaulted(text, "").toLowerCase(Locale.ROOT);
        for (String word : analysisRiskyWords(project)) {
            int index = lower.indexOf(word);
            if (index >= 0) {
                Map<String, Object> match = new LinkedHashMap<>();
                match.put("id", "server-" + word + "-" + index);
                match.put("text", text.substring(index, Math.min(text.length(), index + word.length())));
                match.put("start", index);
                match.put("end", index + word.length());
                match.put("label", "Inflated wording");
                match.put("category", "claim-risk");
                match.put("risk", word.equals("senior") || word.equals("expert") || word.equals("led") ? "High" : "Medium");
                match.put("severity", word.equals("senior") || word.equals("expert") || word.equals("led") ? "high" : "medium");
                match.put("why", "This phrase needs concrete project, duration, team, or production evidence.");
                match.put("safer", "Replace broad wording with specific scope and evidence.");
                matches.add(match);
            }
        }
        return matches;
    }

    private int keywordHits(String requirement, String normalizedCv) {
        int hits = 0;
        for (String word : normalize(requirement).split(" ")) {
            if (word.length() >= 4 && !STOP_WORDS.contains(word) && normalizedCv.contains(word)) {
                hits++;
            }
        }
        return hits;
    }

    private List<String> weightedRubricRequirements(HiringProject project, List<String> fallback) {
        if (project.getRubricJson() == null || project.getRubricJson().isBlank()) {
            return fallback;
        }
        Map<String, Object> rubric = mapper.map(project.getRubricJson());
        List<String> weighted = new ArrayList<>();
        for (String section : List.of("mustHave", "niceToHave", "outcomes")) {
            Object rawRows = rubric.get(section);
            if (!(rawRows instanceof List<?> rows)) {
                continue;
            }
            for (Object rawRow : rows) {
                if (!(rawRow instanceof Map<?, ?> row)) {
                    continue;
                }
                String label = cleanApiText(row.get("label"));
                int weight = Math.max(1, Math.min(5, number(row.get("weight"))));
                if (label.isBlank()) {
                    continue;
                }
                for (int index = 0; index < weight; index++) {
                    weighted.add(label);
                }
            }
        }
        return weighted.isEmpty() ? fallback : weighted;
    }

    private int requirementMatch(List<String> requirements, String cvText, List<String> techTerms) {
        if (requirements.isEmpty()) {
            return 12;
        }
        String normalizedCv = normalize(cvText);
        int covered = 0;
        int partial = 0;
        for (String requirement : requirements) {
            String status = requirementStatus(requirement, normalizedCv, techTerms);
            if ("Supported".equals(status)) {
                covered++;
            } else if ("Stretched".equals(status)) {
                partial++;
            }
        }
        return Math.round(((covered * 100f) + (partial * 45f)) / requirements.size());
    }

    private String requirementStatus(String requirement, String normalizedCv, List<String> techTerms) {
        String normalizedRequirement = normalize(requirement);
        if (containsAll(normalizedRequirement, "java", "spring") || containsAll(normalizedRequirement, "java", "boot")) {
            return contains(normalizedCv, "java") && (contains(normalizedCv, "spring") || contains(normalizedCv, "boot"))
                    ? "Supported"
                    : contains(normalizedCv, "java") || contains(normalizedCv, "spring") || contains(normalizedCv, "boot") ? "Stretched" : "Unsupported";
        }
        if (contains(normalizedRequirement, "spring") || contains(normalizedRequirement, "boot")) {
            return contains(normalizedCv, "spring") || contains(normalizedCv, "boot") ? "Supported" : "Unsupported";
        }
        if (contains(normalizedRequirement, "controller") || contains(normalizedRequirement, "repository")) {
            return contains(normalizedCv, "controller") && contains(normalizedCv, "service") && contains(normalizedCv, "repository")
                    ? "Supported"
                    : contains(normalizedCv, "service") || contains(normalizedCv, "repository") ? "Stretched" : "Unsupported";
        }
        if (contains(normalizedRequirement, "mysql") || contains(normalizedRequirement, "postgresql") || contains(normalizedRequirement, "postgres")) {
            return contains(normalizedCv, "mysql") || contains(normalizedCv, "postgresql") || contains(normalizedCv, "postgres")
                    ? "Supported"
                    : contains(normalizedCv, "sql") || contains(normalizedCv, "database") ? "Stretched" : "Unsupported";
        }
        if (contains(normalizedRequirement, "jpa") || contains(normalizedRequirement, "hibernate")) {
            return contains(normalizedCv, "jpa") || contains(normalizedCv, "hibernate") ? "Supported" : "Unsupported";
        }
        if (contains(normalizedRequirement, "docker")) {
            return contains(normalizedCv, "docker") || contains(normalizedCv, "compose") ? "Supported" : "Unsupported";
        }
        if (contains(normalizedRequirement, "ci/cd") || contains(normalizedRequirement, "pipeline")) {
            return contains(normalizedCv, "ci/cd") || contains(normalizedCv, "pipeline") || contains(normalizedCv, "actions") || contains(normalizedCv, "jenkins")
                    ? "Supported" : "Unsupported";
        }
        if (contains(normalizedRequirement, "kafka") || contains(normalizedRequirement, "websocket") || contains(normalizedRequirement, "messaging") || contains(normalizedRequirement, "distributed")) {
            return contains(normalizedCv, "kafka") || contains(normalizedCv, "websocket") || contains(normalizedCv, "websockets") || contains(normalizedCv, "distributed")
                    ? "Supported" : "Stretched";
        }
        if (contains(normalizedRequirement, "linux")) {
            return contains(normalizedCv, "linux") ? "Supported" : "Unsupported";
        }
        if (contains(normalizedRequirement, "object-oriented") || contains(normalizedRequirement, "object oriented")) {
            return contains(normalizedCv, "object-oriented") || contains(normalizedCv, "object oriented") || contains(normalizedCv, "oop")
                    ? "Supported"
                    : contains(normalizedCv, "page object") || contains(normalizedCv, "java") ? "Stretched" : "Unsupported";
        }
        if (contains(normalizedRequirement, "collaborate") || contains(normalizedRequirement, "frontend") || contains(normalizedRequirement, "qa engineers")) {
            return contains(normalizedCv, "collaboration") || contains(normalizedCv, "team") || contains(normalizedCv, "frontend") || contains(normalizedCv, "qa")
                    ? "Stretched" : "Unsupported";
        }
        if (contains(normalizedRequirement, "feedback") || contains(normalizedRequirement, "learn")) {
            return contains(normalizedCv, "feedback") || contains(normalizedCv, "learner") || contains(normalizedCv, "learn")
                    ? "Supported" : "Stretched";
        }
        if (contains(normalizedRequirement, "cloud") || contains(normalizedRequirement, "deploy")) {
            return contains(normalizedCv, "cloud") || contains(normalizedCv, "deploy") || contains(normalizedCv, "deployed")
                    ? "Supported" : "Unsupported";
        }

        int hits = keywordHits(requirement, normalizedCv);
        long requiredTechTerms = techTerms.stream().filter(normalizedRequirement::contains).count();
        long matchedTechTerms = techTerms.stream()
                .filter(normalizedRequirement::contains)
                .filter(term -> normalizedCv.matches(".*\\b" + Pattern.quote(term) + "\\b.*"))
                .count();
        if (requiredTechTerms > 0) {
            if (matchedTechTerms >= Math.min(2, requiredTechTerms) || shortTechRequirementCovered(requirement, normalizedCv, techTerms)) {
                return "Supported";
            }
            return matchedTechTerms == 1 || hits >= 1 ? "Stretched" : "Unsupported";
        }
        return hits >= 2 ? "Supported" : hits == 1 ? "Stretched" : "Unsupported";
    }

    private boolean containsAll(String text, String left, String right) {
        return contains(text, left) && contains(text, right);
    }

    private boolean contains(String text, String term) {
        return text.matches(".*\\b" + Pattern.quote(term) + "\\b.*");
    }

    private boolean shortTechRequirementCovered(String requirement, String normalizedCv, List<String> techTerms) {
        String normalizedRequirement = normalize(requirement);
        if (normalizedRequirement.length() < 4) {
            return false;
        }
        return techTerms.stream()
                .filter(normalizedRequirement::contains)
                .anyMatch(term -> normalizedCv.matches(".*\\b" + Pattern.quote(term) + "\\b.*"));
    }

    private String extractResumeText(MultipartFile resume) {
        if (resume == null || resume.isEmpty()) {
            throw new IllegalArgumentException("Resume file is required");
        }
        if (resume.getSize() > MAX_RESUME_BYTES) {
            throw new IllegalArgumentException("Resume is too large. Upload a PDF, DOCX, or TXT file no larger than 8 MB.");
        }
        String name = defaulted(resume.getOriginalFilename(), "").toLowerCase(Locale.ROOT);
        try {
            if (name.endsWith(".pdf")) {
                try (InputStream input = resume.getInputStream(); PDDocument document = PDDocument.load(input)) {
                    return new PDFTextStripper().getText(document);
                }
            }
            if (name.endsWith(".txt")) {
                return new String(resume.getBytes());
            }
            if (name.endsWith(".docx")) {
                try (InputStream input = resume.getInputStream();
                     XWPFDocument document = new XWPFDocument(input);
                     XWPFWordExtractor extractor = new XWPFWordExtractor(document)) {
                    return extractor.getText();
                }
            }
            throw new IllegalArgumentException("Upload a PDF, DOCX, or TXT resume.");
        } catch (IOException exception) {
            throw new IllegalArgumentException("Could not read resume file");
        }
    }

    private HiringProject projectEntity(UserAccount owner, Long id) {
        return projectRepository.findAccessibleById(id, owner.getId(), owner.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private HttpRequest githubRequest(URI uri, java.time.Duration timeout) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(uri)
                .timeout(timeout)
                .header("Accept", "application/vnd.github+json")
                .header("X-GitHub-Api-Version", "2022-11-28")
                .header("User-Agent", "BrainHack-SignalTrace");
        if (!githubToken.isBlank()) {
            builder.header("Authorization", "Bearer " + githubToken);
        }
        return builder.GET().build();
    }

    private HiringCandidate candidateEntity(UserAccount owner, Long projectId, Long candidateId) {
        return candidateRepository.findAccessibleById(candidateId, projectId, owner.getId(), owner.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
    }

    private Organization ensureOrganization(UserAccount owner) {
        return organizationRepository.findFirstByOwnerIdOrderByCreatedAtAsc(owner.getId())
                .orElseGet(() -> {
                    Organization organization = new Organization();
                    organization.setOwner(owner);
                    organization.setName(defaulted(owner.getOrganization(), owner.getUsername() + " Team"));
                    Organization saved = organizationRepository.save(organization);
                    TeamMembership membership = new TeamMembership();
                    membership.setOrganization(saved);
                    membership.setUser(owner);
                    membership.setRole("ORGANIZATION_ADMIN");
                    membershipRepository.save(membership);
                    return saved;
                });
    }

    private void requireProjectOwner(UserAccount actor, HiringProject project) {
        if (!project.getOwner().getId().equals(actor.getId())) {
            throw new IllegalArgumentException("Project owner permissions required");
        }
    }

    private boolean hasHeadAdminAccess(UserAccount actor, HiringProject project) {
        return project.getOwner().getId().equals(actor.getId()) || permissionsFor(actor, project).contains("protectedAccount");
    }

    private void publishProjectChange(HiringProject project) {
        if (project == null) {
            return;
        }
        List<UserAccount> users = new ArrayList<>();
        users.add(project.getOwner());
        if (project.getOrganization() != null) {
            membershipRepository.findByOrganizationId(project.getOrganization().getId()).stream()
                    .map(TeamMembership::getUser)
                    .filter(user -> users.stream().noneMatch(existing -> existing.getId().equals(user.getId())))
                    .forEach(users::add);
        }
        realtimeService.publishProject(users);
    }

    private void recordActivity(HiringProject project, UserAccount actor, String type, String action, String severity, String detail) {
        projectStateService.record(project, actor, new ProjectActivityRequest(type, action, "", "", null, "", severity, detail));
    }

    private void requirePermission(UserAccount actor, HiringProject project, String permission) {
        if (!permissionsFor(actor, project).contains(permission)) {
            throw new IllegalArgumentException("Project permission required: " + permission);
        }
    }

    private void requireStatusPermission(UserAccount actor, HiringProject project, String status) {
        String permission = switch (status) {
            case "Unreviewed", "OnCheck" -> "canMarkOnCheck";
            case "OnInterview" -> "canSetInterview";
            case "Hired" -> "canHire";
            case "Closed" -> "canClose";
            default -> "canMarkOnCheck";
        };
        requirePermission(actor, project, permission);
    }

    private String normalizeCandidateStatus(String status) {
        String clean = defaulted(status, "Unreviewed").replace("_", "").replace("-", "").replace(" ", "").toLowerCase(Locale.ROOT);
        return switch (clean) {
            case "oncheck" -> "OnCheck";
            case "oninterview" -> "OnInterview";
            case "hired" -> "Hired";
            case "closed" -> "Closed";
            case "unreviewed" -> "Unreviewed";
            default -> throw new IllegalArgumentException("Unsupported candidate status");
        };
    }

    private CandidateWorkflowResponse workflowResponse(UserAccount actor, HiringCandidate candidate) {
        List<CandidateReviewNote> events = noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId());
        List<ActivityResponse> activity = new ArrayList<>(events.stream()
                .map(note -> new ActivityResponse(
                        note.getId(), activityLabel(note), candidate.getName(), displayName(note.getAuthor()),
                        note.getAuthor().getEmail(), note.getCreatedAt()))
                .toList());
        activity.addAll(activityRepository.findTop200ByProjectIdAndCandidateIdOrderByCreatedAtDesc(candidate.getProject().getId(), candidate.getId()).stream()
                .filter(log -> Set.of("candidate_view", "candidate_message").contains(defaulted(log.getType(), "").toLowerCase(Locale.ROOT)))
                .map(log -> new ActivityResponse(
                        -log.getId(), log.getAction(), candidate.getName(), log.getActorName(), log.getActorEmail(), log.getCreatedAt()))
                .toList());
        activity.sort(Comparator.comparing(ActivityResponse::createdAt).reversed());
        return new CandidateWorkflowResponse(
                workflowStatus(defaulted(candidate.getState(), "Unreviewed")),
                voteSummary(actor, events),
                activity.stream().limit(80).toList()
        );
    }

    private VoteSummaryResponse voteSummary(UserAccount actor, List<CandidateReviewNote> events) {
        Map<String, CandidateReviewNote> latestVoteByAuthor = new LinkedHashMap<>();
        Map<String, CandidateReviewNote> latestStarByAuthor = new LinkedHashMap<>();
        for (CandidateReviewNote event : events) {
            if (!"VOTE".equalsIgnoreCase(event.getType())) {
                continue;
            }
            String email = event.getAuthor().getEmail().toLowerCase(Locale.ROOT);
            if (Set.of("UPVOTE", "DOWNVOTE").contains(event.getDecision())) {
                latestVoteByAuthor.putIfAbsent(email, event);
            }
            if (Set.of("STAR", "UNSTAR").contains(event.getDecision())) {
                latestStarByAuthor.putIfAbsent(email, event);
            }
        }

        List<Double> scores = new ArrayList<>();
        int downvotes = 0;
        List<String> attribution = new ArrayList<>();
        String actorEmail = actor.getEmail().toLowerCase(Locale.ROOT);
        String myVote = "";
        Double myScore = null;
        for (CandidateReviewNote event : latestVoteByAuthor.values()) {
            String email = event.getAuthor().getEmail().toLowerCase(Locale.ROOT);
            if ("UPVOTE".equals(event.getDecision())) {
                double score = scoreFromBody(event.getBody());
                scores.add(score);
                attribution.add(displayName(event.getAuthor()) + ": upvote " + score + "/5");
                if (email.equals(actorEmail)) {
                    myVote = "UPVOTE";
                    myScore = score;
                }
            } else if ("DOWNVOTE".equals(event.getDecision())) {
                downvotes++;
                attribution.add(displayName(event.getAuthor()) + ": downvote");
                if (email.equals(actorEmail)) {
                    myVote = "DOWNVOTE";
                }
            }
        }

        int stars = 0;
        boolean starredByMe = false;
        for (CandidateReviewNote event : latestStarByAuthor.values()) {
            if ("STAR".equals(event.getDecision())) {
                stars++;
                attribution.add(displayName(event.getAuthor()) + ": starred");
                if (event.getAuthor().getEmail().equalsIgnoreCase(actor.getEmail())) {
                    starredByMe = true;
                }
            }
        }

        double average = scores.stream().mapToDouble(Double::doubleValue).average().orElse(0.0);
        return new VoteSummaryResponse(String.format(Locale.ROOT, "%.1f", average), downvotes, stars, starredByMe, myVote, myScore, attribution);
    }

    private String workflowStatus(String status) {
        try {
            return normalizeCandidateStatus(status);
        } catch (IllegalArgumentException exception) {
            return "Unreviewed";
        }
    }

    private String activityLabel(CandidateReviewNote note) {
        if ("STATUS".equalsIgnoreCase(note.getType())) {
            return "changed status to " + displayRoleish(note.getDecision());
        }
        if ("VOTE".equalsIgnoreCase(note.getType())) {
            if ("UPVOTE".equals(note.getDecision())) {
                return "upvoted with " + scoreFromBody(note.getBody()) + "/5";
            }
            if ("DOWNVOTE".equals(note.getDecision())) {
                return "downvoted";
            }
            if ("STAR".equals(note.getDecision())) {
                return "starred candidate";
            }
            if ("UNSTAR".equals(note.getDecision())) {
                return "unstarred candidate";
            }
        }
        if (!Set.of("VOTE", "STATUS", "ACTIVITY").contains(defaulted(note.getType(), "").toUpperCase(Locale.ROOT))) {
            return "added reviewer note: " + displayRoleish(defaulted(note.getDecision(), "NOTE"));
        }
        return defaulted(note.getBody(), note.getDecision());
    }

    private void recordCandidateActivity(HiringCandidate candidate, UserAccount actor, String type, String action, String severity, String detail) {
        projectStateService.record(candidate.getProject(), actor, new ProjectActivityRequest(
                type, action, "", "", candidate.getId(), candidate.getName(), severity, detail));
    }

    private String displayRoleish(String value) {
        String clean = defaulted(value, "").toLowerCase(Locale.ROOT);
        return switch (clean) {
            case "oncheck" -> "OnCheck";
            case "oninterview" -> "OnInterview";
            case "hired" -> "Hired";
            case "closed" -> "Closed";
            case "unreviewed" -> "Unreviewed";
            default -> value;
        };
    }

    private double scoreFromBody(String body) {
        if (body == null) {
            return 0.0;
        }
        for (String part : body.split(";")) {
            String[] bits = part.split("=", 2);
            if (bits.length == 2 && "score".equalsIgnoreCase(bits[0].trim())) {
                try {
                    return Double.parseDouble(bits[1].trim());
                } catch (NumberFormatException ignored) {
                    return 0.0;
                }
            }
        }
        return 0.0;
    }

    private String actorRole(UserAccount actor, HiringProject project) {
        return permissionService.roleFor(actor, project);
    }

    private List<String> permissionsFor(UserAccount actor, HiringProject project) {
        return permissionService.permissionsFor(actor, project);
    }

    private String canonicalRole(String role) {
        return permissionService.canonicalRole(role);
    }

    private List<String> rolePermissions(String role) {
        return permissionService.permissionsForRole(role);
    }

    private String displayName(UserAccount account) {
        return account.getFullName() == null || account.getFullName().isBlank() ? account.getUsername() : account.getFullName();
    }

    private String displayRole(String role) {
        return permissionService.displayRole(role);
    }

    private String randomToken() {
        byte[] bytes = new byte[36];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private List<ProjectRequest> sampleProjects() {
        return List.of(
                new ProjectRequest(
                        "Backend Java Engineer",
                        "Platform",
                        "Tbilisi / Remote",
                        "Build secure Spring Boot APIs for a claim-audit product.\nResponsibilities:\n- Own REST API design\n- Maintain SQL-backed services\nRequirements:\n- Java and Spring Boot\n- SQL and authentication\n- Docker basics\nPreferred Qualifications:\n- GitHub portfolio with backend projects",
                        List.of("Java and Spring Boot", "SQL and authentication", "REST API design", "Docker basics", "Public project evidence"),
                        "WAR+AI State",
                        "Screening"),
                new ProjectRequest(
                        "Frontend Verification Analyst",
                        "Trust",
                        "Remote",
                        "Review candidate portfolios and produce structured verification reports.\nRequirements:\n- React\n- Evidence review\n- Clear technical writing",
                        List.of("React", "Evidence review", "Technical writing", "Portfolio analysis"),
                        "Person State",
                        "Screening")
        );
    }

    private List<CandidateRequest> sampleCandidates(String projectTitle) {
        if (projectTitle.toLowerCase(Locale.ROOT).contains("backend")) {
            return List.of(
                    new CandidateRequest(
                            "Nino Kapanadze",
                            "Java Backend Engineer",
                            "Nino Kapanadze nino.kapanadze@example.com. Built Spring Boot REST APIs with Java, PostgreSQL, JWT authentication, Docker, and integration tests. Reduced API latency by 31% across three production services. Portfolio: https://github.com/octocat"),
                    new CandidateRequest(
                            "Giorgi Maisuradze",
                            "Backend Developer",
                            "Giorgi Maisuradze giorgi.maisuradze@example.com. Experienced with Java and SQL. World-class architect who single-handedly transformed enterprise systems. Familiar with REST and Docker but no public repository or production metrics supplied."),
                    new CandidateRequest(
                            "Mariam Beridze",
                            "Junior Java Developer",
                            "Mariam Beridze mariam.beridze@example.com. University projects using Java, Spring Boot, MySQL, JUnit, Git, and Docker Compose. Built an authenticated task API and documented it with OpenAPI."));
        }
        return List.of(
                new CandidateRequest(
                        "Ana Gelashvili",
                        "Verification Analyst",
                        "Ana Gelashvili ana.gelashvili@example.com. Reviewed technical portfolios, wrote evidence-based reports, and built React dashboards. Improved review turnaround by 24% while maintaining a documented quality checklist."),
                new CandidateRequest(
                        "Luka Chikovani",
                        "Frontend Analyst",
                        "Luka Chikovani luka.chikovani@example.com. React and JavaScript experience with candidate research and technical writing. Claims unmatched attention to detail without samples or measurable review outcomes."));
    }

    private List<String> extractRequirements(String description) {
        if (description == null || description.isBlank()) {
            return List.of();
        }
        List<String> requirements = new ArrayList<>();
        boolean inRelevantSection = false;
        for (String rawLine : description.split("\\R+")) {
            String line = rawLine.trim();
            if (line.isBlank()) {
                continue;
            }
            String heading = line.replace(":", "").trim().toUpperCase(Locale.ROOT);
            if (REQUIREMENT_SECTIONS.contains(heading)) {
                inRelevantSection = true;
                continue;
            }
            if (STOP_REQUIREMENT_SECTIONS.contains(heading)) {
                inRelevantSection = false;
                continue;
            }
            boolean bullet = line.startsWith("-") || line.startsWith("*");
            String clean = line.replaceFirst("^[-*]\\s*", "").trim();
            if (inRelevantSection && bullet && clean.length() >= 4 && !"requirements".equalsIgnoreCase(clean)) {
                requirements.add(clean);
            }
        }
        if (requirements.isEmpty()) {
            for (String line : splitLines(description)) {
                String normalized = normalize(line);
                if (hasConcreteTechnicalSignal(normalized) && line.length() <= 140) {
                    requirements.add(line);
                }
            }
        }
        return requirements.stream().distinct().limit(30).toList();
    }

    private List<String> cleanRequirements(List<String> requirements) {
        if (requirements == null) {
            return List.of();
        }
        return requirements.stream()
                .map(value -> value == null ? "" : value.trim().replaceFirst("^[-*]\\s*", "").trim())
                .filter(value -> value.length() >= 4)
                .filter(value -> !Set.of("requirements", "required qualifications", "nice to have").contains(value.toLowerCase(Locale.ROOT)))
                .distinct()
                .toList();
    }

    private List<String> splitLines(String text) {
        if (text == null || text.isBlank()) {
            return List.of();
        }
        List<String> lines = new ArrayList<>();
        for (String line : text.split("\\R+")) {
            String clean = line.trim().replaceFirst("^[-*]\\s*", "");
            if (!clean.isBlank() && !clean.endsWith(":")) {
                lines.add(clean);
            }
        }
        return lines;
    }

    private String summary(HiringCandidate candidate, HiringProject project) {
        return candidate.getName() + " has a strict analysis recommendation score of " + candidate.getScore()
                + "% for " + project.getTitle()
                + " and " + candidate.getMatchScore() + "% ATS requirement coverage"
                + " with " + candidate.getSupported() + " supported, " + candidate.getStretched()
                + " stretched, and " + candidate.getUnsupported() + " unsupported signals.";
    }

    private String normalize(String value) {
        return defaulted(value, "").toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9+#/\\- ]", " ").replaceAll("\\s+", " ").trim();
    }

    private String defaulted(String value, String fallback) {
        String clean = value == null ? "" : value.trim();
        return clean.isBlank() ? fallback : clean;
    }
}
