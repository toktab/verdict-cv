package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.ats.AtsKeywordCatalog;
import dev.toktab.brainhack.audit.CheckStateIds;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidatePageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateStatusRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateWorkflowResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ImportResponse;
import dev.toktab.brainhack.hiring.HiringDtos.InviteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.InviteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.MemberRoleRequest;
import dev.toktab.brainhack.hiring.HiringDtos.NoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.NoteResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ActivityResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunRequest;
import dev.toktab.brainhack.hiring.HiringDtos.OsintRunResponse;
import dev.toktab.brainhack.hiring.HiringDtos.OsintSourceResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectMemberResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import dev.toktab.brainhack.hiring.HiringDtos.VoteRequest;
import dev.toktab.brainhack.hiring.HiringDtos.VoteSummaryResponse;
import dev.toktab.brainhack.hiring.ProjectStateDtos.ProjectActivityRequest;
import dev.toktab.brainhack.messaging.MessageService;
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
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class HiringService {
    private static final Set<String> STOP_WORDS = Set.of(
            "with", "from", "into", "that", "this", "they", "them", "have", "will", "your", "and", "the", "for", "are",
            "using", "use", "basic", "basics", "knowledge", "understanding", "experience", "familiarity", "ability",
            "develop", "maintain", "build", "improve", "work", "works", "working", "help", "assist", "follow",
            "principles", "tools", "similar", "good", "code", "clear", "role", "candidate"
    );
    private static final Set<String> REQUIREMENT_SECTIONS = Set.of("RESPONSIBILITIES", "REQUIRED QUALIFICATIONS", "NICE TO HAVE", "TECH STACK", "IDEAL CANDIDATE PROFILE");
    private static final Set<String> STOP_REQUIREMENT_SECTIONS = Set.of("WHAT WE OFFER", "ABOUT THE ROLE", "LOCATION", "EMPLOYMENT TYPE", "LEVEL");
    private static final Pattern SENTENCE = Pattern.compile("(?<=[.!?])\\s+|\\R+");
    private static final Pattern URL = Pattern.compile("https?://[^\\s)>,]+", Pattern.CASE_INSENSITIVE);
    private static final Pattern HANDLE = Pattern.compile("(?<![\\w.])@([a-zA-Z0-9][a-zA-Z0-9_.-]{2,38})");
    private static final Pattern GITHUB_URL = Pattern.compile("https?://(?:www\\.)?github\\.com/([a-zA-Z0-9-]{1,39})(?:[/\\s?#]|$)", Pattern.CASE_INSENSITIVE);

    private final HiringProjectRepository projectRepository;
    private final HiringCandidateRepository candidateRepository;
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
    private final SecureRandom secureRandom = new SecureRandom();
    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(4))
            .build();

    public HiringService(
            HiringProjectRepository projectRepository,
            HiringCandidateRepository candidateRepository,
            HiringMapper mapper,
            OrganizationRepository organizationRepository,
            TeamMembershipRepository membershipRepository,
            ProjectInviteRepository inviteRepository,
            CandidateReviewNoteRepository noteRepository,
            MessageService messageService,
            UserAccountService userAccountService,
            AtsKeywordCatalog atsKeywordCatalog,
            RealtimeService realtimeService,
            ProjectStateService projectStateService) {
        this.projectRepository = projectRepository;
        this.candidateRepository = candidateRepository;
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
    }

    @Transactional
    public List<ProjectResponse> projects(UserAccount owner) {
        ensureOrganization(owner);
        return projectRepository.findAccessible(owner.getId()).stream()
                .map(project -> mapper.project(project, actorRole(owner, project), permissionsFor(owner, project)))
                .toList();
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
        for (ProjectRequest sample : sampleProjects()) {
            if (projectRepository.existsByOwnerIdAndTitleIgnoreCaseAndDeletedAtIsNull(owner.getId(), sample.title())) {
                skipped++;
            } else {
                createProject(owner, sample);
                imported++;
            }
        }
        return new ImportResponse(imported, skipped);
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
        HiringCandidate candidate = buildCandidate(project, defaulted(request.name(), "Unnamed candidate"), defaulted(request.role(), project.getTitle()), defaulted(request.cvText(), ""), "");
        CandidateResponse response = mapper.candidate(saveAnalyzedCandidate(candidate));
        recordActivity(project, owner, "candidate_create", "Added candidate " + candidate.getName(), "good", "Candidate was added to the project.");
        publishProjectChange(project);
        return response;
    }

    @Transactional
    public CandidateResponse uploadCandidate(UserAccount owner, Long projectId, String name, String role, MultipartFile resume) {
        HiringProject project = projectEntity(owner, projectId);
        String cvText = extractResumeText(resume);
        HiringCandidate candidate = buildCandidate(project, defaulted(name, "Unnamed candidate"), defaulted(role, project.getTitle()), cvText, resume == null ? "" : resume.getOriginalFilename());
        CandidateResponse response = mapper.candidate(saveAnalyzedCandidate(candidate));
        recordActivity(project, owner, "candidate_upload", "Uploaded candidate " + candidate.getName(), "good", "Candidate resume was uploaded and analyzed.");
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
        List<CandidateResponse> items = candidateRepository.findAccessibleByProjectId(projectId, owner.getId(), pageable).stream()
                .map(mapper::candidate)
                .toList();
        long total = candidateRepository.countAccessibleByProjectId(projectId, owner.getId());
        return new CandidatePageResponse(items, safeOffset, safeLimit, total);
    }

    @Transactional
    public CandidateResponse reanalyzeCandidate(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        HiringCandidate refreshed = buildCandidate(candidate.getProject(), candidate.getName(), candidate.getRole(), candidate.getCvText(), candidate.getResumeFilename());
        candidate.setScore(refreshed.getScore());
        candidate.setMatchScore(refreshed.getMatchScore());
        candidate.setRisk(refreshed.getRisk());
        candidate.setState(refreshed.getState());
        candidate.setFlags(refreshed.getFlags());
        candidate.setSupported(refreshed.getSupported());
        candidate.setStretched(refreshed.getStretched());
        candidate.setUnsupported(refreshed.getUnsupported());
        candidate.setSummary(refreshed.getSummary());
        candidate.setClaimsJson(refreshed.getClaimsJson());
        candidate.setAuditPhraseMatchesJson(refreshed.getAuditPhraseMatchesJson());
        CandidateResponse response = mapper.candidate(saveAnalyzedCandidate(candidate));
        recordActivity(candidate.getProject(), owner, "candidate_reanalyze", "Reanalyzed candidate " + candidate.getName(), "info", "Candidate scoring and phrase checks were refreshed.");
        publishProjectChange(candidate.getProject());
        return response;
    }

    @Transactional
    public OsintRunResponse runOsint(UserAccount owner, Long projectId, Long candidateId, OsintRunRequest request) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        String state = defaulted(request == null ? "" : request.state(), CheckStateIds.STRICT_WAR_AI);
        if (!CheckStateIds.STRICT_WAR_AI.equals(state)) {
            throw new IllegalArgumentException("SignalTrace OSINT is only available in WAR_AI State.");
        }

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
        githubEvidence(links).forEach(sources::add);
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
        candidateRepository.save(candidate);
        recordActivity(candidate.getProject(), owner, "candidate_osint", "Ran evidence scan for " + candidate.getName(), "info", "SignalTrace evidence cards were refreshed.");
        publishProjectChange(candidate.getProject());

        return new OsintRunResponse(
                state,
                candidate.getOsint(),
                identityConfidence,
                corroborated,
                candidate.getUnsupported(),
                links,
                usernames,
                sources
        );
    }

    @Transactional
    public void deleteCandidate(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        candidate.setDeletedAt(Instant.now());
        candidateRepository.save(candidate);
        recordActivity(candidate.getProject(), owner, "candidate_delete", "Deleted candidate " + candidate.getName(), "danger", "Candidate was removed from active review lists.");
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
        if (project.getOrganization() != null) {
            for (TeamMembership membership : membershipRepository.findByOrganizationId(project.getOrganization().getId())) {
                UserAccount member = membership.getUser();
                if (member.getId().equals(owner.getId())) {
                    continue;
                }
                rows.add(new ProjectMemberResponse(
                        member.getId(),
                        displayName(member),
                        member.getEmail(),
                        displayRole(membership.getRole()),
                        rolePermissions(membership.getRole()),
                        "ACTIVE",
                        "MEMBERSHIP",
                        false
                ));
            }
        }
        Set<String> knownEmails = new HashSet<>();
        rows.forEach(row -> knownEmails.add(row.email().toLowerCase(Locale.ROOT)));
        for (ProjectInvite invite : inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId)) {
            String email = invite.getInvitedEmail().toLowerCase(Locale.ROOT);
            if (knownEmails.contains(email)) {
                continue;
            }
            rows.add(new ProjectMemberResponse(
                    invite.getId(),
                    invite.getInvitedEmail().split("@")[0],
                    invite.getInvitedEmail(),
                    displayRole(invite.getRole()),
                    rolePermissions(invite.getRole()),
                    invite.getStatus(),
                    "INVITE",
                    false
            ));
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
            }
        }

        targetMembership.setRole(role);
        membershipRepository.save(targetMembership);
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
        UserAccount target = userAccountService.findActiveByUsernameOrEmail(targetEmail).orElse(null);
        if (target != null && project.getOrganization() != null) {
            removed = membershipRepository.findByOrganizationIdAndUserId(project.getOrganization().getId(), target.getId())
                    .map(membership -> {
                        membershipRepository.delete(membership);
                        return true;
                    })
                    .orElse(false);
        }
        for (ProjectInvite invite : inviteRepository.findByProjectIdOrderByCreatedAtDesc(projectId)) {
            if (invite.getInvitedEmail().equalsIgnoreCase(targetEmail) && "PENDING".equals(invite.getStatus())) {
                invite.setStatus("REVOKED");
                inviteRepository.save(invite);
                removed = true;
            }
        }
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
        invite.setRole(defaulted(request.role(), "REVIEWER").toUpperCase(Locale.ROOT));
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
        CandidateReviewNote note = new CandidateReviewNote();
        note.setCandidate(candidate);
        note.setAuthor(actor);
        note.setType(defaulted(request.type(), "NOTE").toUpperCase(Locale.ROOT));
        note.setDecision(defaulted(request.decision(), "NONE").toUpperCase(Locale.ROOT));
        note.setBody(defaulted(request.body(), ""));
        CandidateReviewNote saved = noteRepository.save(note);
        recordActivity(candidate.getProject(), actor, "candidate_note", "Added candidate note", "info", candidate.getName() + ": " + note.getDecision());
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
        double score = request.score() == null ? 0.0 : Math.max(0.0, Math.min(5.0, request.score()));
        CandidateReviewNote note = new CandidateReviewNote();
        note.setCandidate(candidate);
        note.setAuthor(actor);
        note.setType("VOTE");
        note.setDecision(action);
        note.setBody(action.equals("UPVOTE") ? "score=" + score : "");
        noteRepository.save(note);
        recordActivity(candidate.getProject(), actor, "candidate_vote", "Recorded candidate vote", "info", candidate.getName() + ": " + action);
        publishProjectChange(candidate.getProject());
        return workflowResponse(actor, candidate);
    }

    @Transactional
    public CandidateWorkflowResponse updateCandidateStatus(UserAccount actor, Long projectId, Long candidateId, CandidateStatusRequest request) {
        HiringCandidate candidate = candidateEntity(actor, projectId, candidateId);
        String status = normalizeCandidateStatus(request.status());
        requireStatusPermission(actor, candidate.getProject(), status);
        candidate.setState(status);
        candidateRepository.save(candidate);

        CandidateReviewNote note = new CandidateReviewNote();
        note.setCandidate(candidate);
        note.setAuthor(actor);
        note.setType("STATUS");
        note.setDecision(status.toUpperCase(Locale.ROOT));
        note.setBody("Changed candidate status to " + status);
        noteRepository.save(note);
        recordActivity(candidate.getProject(), actor, "candidate_status", "Changed candidate status", "warn", candidate.getName() + " moved to " + status + ".");
        publishProjectChange(candidate.getProject());
        return workflowResponse(actor, candidate);
    }

    private HiringCandidate buildCandidate(HiringProject project, String name, String role, String cvText, String filename) {
        List<String> requirements = splitLines(project.getRequirementsText());
        if (requirements.isEmpty()) {
            requirements = extractRequirements(project.getDescription());
        }
        List<List<String>> claims = claims(cvText, requirements);
        int supported = (int) claims.stream().filter(row -> "Supported".equals(row.get(1))).count();
        int stretched = (int) claims.stream().filter(row -> "Stretched".equals(row.get(1))).count();
        int unsupported = (int) claims.stream().filter(row -> "Unsupported".equals(row.get(1))).count();
        int total = Math.max(1, supported + stretched + unsupported);
        int match = Math.max(requirementMatch(requirements, cvText), Math.round((supported * 100f + stretched * 55f) / total));
        match = Math.min(98, Math.max(12, match));
        int flags = unsupported * 2 + stretched + riskyMatches(cvText).size();
        int positiveEvidence = Math.min(18, supported / 2);
        int score = Math.max(8, Math.min(99, match + positiveEvidence - unsupported * 6 - stretched * 2 - Math.min(12, flags)));

        HiringCandidate candidate = new HiringCandidate();
        candidate.setProject(project);
        candidate.setName(name);
        candidate.setRole(role);
        candidate.setCvText(cvText);
        candidate.setResumeFilename(defaulted(filename, "manual-entry.txt"));
        candidate.setSupported(supported);
        candidate.setStretched(stretched);
        candidate.setUnsupported(unsupported);
        candidate.setMatchScore(match);
        candidate.setScore(score);
        candidate.setRisk(score < 45 || unsupported >= 3 ? "High" : score < 70 || stretched >= 3 ? "Medium" : "Low");
        candidate.setState("Unreviewed");
        candidate.setOsint("Partial");
        candidate.setMemory("No prior record");
        candidate.setFlags(flags);
        candidate.setSummary(summary(candidate, project));
        candidate.setClaimsJson(mapper.json(claims));
        candidate.setAuditPhraseMatchesJson(mapper.json(riskyMatches(cvText)));
        return candidate;
    }

    private HiringCandidate saveAnalyzedCandidate(HiringCandidate candidate) {
        if (candidate.getScore() <= 0 || candidate.getMatchScore() <= 0 || candidate.getRisk() == null || candidate.getRisk().isBlank()) {
            throw new IllegalStateException("Candidate scoring must run before saving");
        }
        return candidateRepository.saveAndFlush(candidate);
    }

    private List<List<String>> claims(String cvText, List<String> requirements) {
        List<List<String>> rows = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        String normalizedCv = normalize(cvText);
        String normalizedRequirements = normalize(String.join(" ", requirements));
        for (String requirement : requirements) {
            String status = requirementStatus(requirement, normalizedCv);
            String reason = "Supported".equals(status)
                    ? "The CV contains multiple terms aligned with this job requirement."
                    : "Stretched".equals(status)
                    ? "The CV partially overlaps this requirement but does not prove depth."
                    : "The CV does not provide clear evidence for this requirement.";
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
                addClaim(rows, seen, clean, "Supported", "This CV sentence directly overlaps multiple job requirement terms.");
            } else if (hasConcreteTechnicalSignal(lower)) {
                addClaim(rows, seen, clean, "Supported", "This CV sentence contains concrete technical or measurable evidence.");
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
        List<String> links = new ArrayList<>();
        var matcher = URL.matcher(defaulted(text, ""));
        while (matcher.find()) {
            String link = matcher.group().replaceAll("[.,;:]+$", "");
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

    private List<OsintSourceResponse> githubEvidence(List<String> links) {
        List<OsintSourceResponse> rows = new ArrayList<>();
        for (String link : links) {
            var matcher = GITHUB_URL.matcher(link);
            if (!matcher.find()) {
                continue;
            }
            String username = matcher.group(1);
            if (Set.of("topics", "marketplace", "features", "settings", "orgs").contains(username.toLowerCase(Locale.ROOT))) {
                continue;
            }
            rows.add(githubProfile(username, link));
            break;
        }
        if (rows.isEmpty()) {
            rows.add(new OsintSourceResponse(
                    "GitHub",
                    "No GitHub profile URL was found in the CV, so repository language evidence could not be checked automatically.",
                    24,
                    "0",
                    "warn",
                    ""
            ));
        }
        return rows;
    }

    private OsintSourceResponse githubProfile(String username, String link) {
        try {
            HttpRequest request = HttpRequest.newBuilder(URI.create("https://api.github.com/users/" + username))
                    .timeout(java.time.Duration.ofSeconds(6))
                    .header("Accept", "application/vnd.github+json")
                    .header("User-Agent", "BrainHack-SignalTrace")
                    .GET()
                    .build();
            HttpResponse<String> response = httpClient.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 200) {
                Map<String, Object> payload = mapper.map(response.body());
                int publicRepos = number(payload.get("public_repos"));
                int followers = number(payload.get("followers"));
                String blog = defaulted(String.valueOf(payload.getOrDefault("blog", "")), "");
                String finding = "GitHub profile @" + username + " is public with " + publicRepos + " repos and " + followers + " followers.";
                if (!blog.isBlank() && !"null".equals(blog)) {
                    finding += " Portfolio/blog field is present.";
                }
                return new OsintSourceResponse("GitHub", finding, publicRepos > 0 ? 78 : 42, publicRepos > 0 ? "+12" : "+2", publicRepos > 0 ? "good" : "warn", link);
            }
            if (response.statusCode() == 404) {
                return new OsintSourceResponse("GitHub", "GitHub URL was found, but the profile did not resolve through the public API.", 18, "-4", "bad", link);
            }
            return new OsintSourceResponse("GitHub", "GitHub public API returned status " + response.statusCode() + " for @" + username + ".", 30, "0", "warn", link);
        } catch (IOException exception) {
            return new OsintSourceResponse("GitHub", "GitHub check failed because the public API could not be reached.", 26, "0", "warn", link);
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            return new OsintSourceResponse("GitHub", "GitHub check was interrupted before completion.", 20, "0", "warn", link);
        }
    }

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
        if (isContactOrLinkLine(normalizedText)) {
            return false;
        }
        if (normalizedText.matches(".*\\b\\d+\\b.*")) {
            return true;
        }
        return atsKeywordCatalog.techTerms().stream().anyMatch(term -> normalizedText.matches(".*\\b" + Pattern.quote(term) + "\\b.*"));
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

    private List<Map<String, Object>> riskyMatches(String text) {
        List<Map<String, Object>> matches = new ArrayList<>();
        String lower = defaulted(text, "").toLowerCase(Locale.ROOT);
        for (String word : atsKeywordCatalog.riskyWords()) {
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

    private int requirementMatch(List<String> requirements, String cvText) {
        if (requirements.isEmpty()) {
            return 12;
        }
        String normalizedCv = normalize(cvText);
        int covered = 0;
        int partial = 0;
        for (String requirement : requirements) {
            String status = requirementStatus(requirement, normalizedCv);
            if ("Supported".equals(status)) {
                covered++;
            } else if ("Stretched".equals(status)) {
                partial++;
            }
        }
        return Math.round(((covered * 100f) + (partial * 45f)) / requirements.size());
    }

    private String requirementStatus(String requirement, String normalizedCv) {
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
        long requiredTechTerms = atsKeywordCatalog.techTerms().stream().filter(normalizedRequirement::contains).count();
        long matchedTechTerms = atsKeywordCatalog.techTerms().stream()
                .filter(normalizedRequirement::contains)
                .filter(term -> normalizedCv.matches(".*\\b" + Pattern.quote(term) + "\\b.*"))
                .count();
        if (requiredTechTerms > 0) {
            if (matchedTechTerms >= Math.min(2, requiredTechTerms) || shortTechRequirementCovered(requirement, normalizedCv)) {
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

    private boolean shortTechRequirementCovered(String requirement, String normalizedCv) {
        String normalizedRequirement = normalize(requirement);
        if (normalizedRequirement.length() < 4) {
            return false;
        }
        return atsKeywordCatalog.techTerms().stream()
                .filter(normalizedRequirement::contains)
                .anyMatch(term -> normalizedCv.matches(".*\\b" + Pattern.quote(term) + "\\b.*"));
    }

    private String extractResumeText(MultipartFile resume) {
        if (resume == null || resume.isEmpty()) {
            throw new IllegalArgumentException("Resume file is required");
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
        return projectRepository.findAccessibleById(id, owner.getId())
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    private HiringCandidate candidateEntity(UserAccount owner, Long projectId, Long candidateId) {
        return candidateRepository.findAccessibleById(candidateId, projectId, owner.getId())
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
        List<CandidateReviewNote> events = noteRepository.findByCandidateIdOrderByCreatedAtDesc(candidate.getId()).stream()
                .filter(note -> Set.of("VOTE", "STATUS", "ACTIVITY").contains(defaulted(note.getType(), "").toUpperCase(Locale.ROOT)))
                .toList();
        return new CandidateWorkflowResponse(
                workflowStatus(defaulted(candidate.getState(), "Unreviewed")),
                voteSummary(actor, events),
                events.stream()
                        .limit(80)
                        .map(note -> new ActivityResponse(
                                note.getId(),
                                activityLabel(note),
                                candidate.getName(),
                                displayName(note.getAuthor()),
                                note.getAuthor().getEmail(),
                                note.getCreatedAt()
                        ))
                        .toList()
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
        return defaulted(note.getBody(), note.getDecision());
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
        if (project.getOwner().getId().equals(actor.getId())) {
            return "Head Admin";
        }
        if (project.getOrganization() == null) {
            return "Viewer";
        }
        return membershipRepository.findByOrganizationIdAndUserId(project.getOrganization().getId(), actor.getId())
                .map(TeamMembership::getRole)
                .map(this::displayRole)
                .orElse("Viewer");
    }

    private List<String> permissionsFor(UserAccount actor, HiringProject project) {
        return rolePermissions(actorRole(actor, project));
    }

    private String canonicalRole(String role) {
        String normalized = defaulted(role, "Reviewer").replace('_', ' ').replace('-', ' ').trim().toLowerCase(Locale.ROOT);
        return switch (normalized) {
            case "viewer" -> "VIEWER";
            case "voter" -> "VOTER";
            case "reviewer" -> "REVIEWER";
            case "screener" -> "SCREENER";
            case "coordinator" -> "COORDINATOR";
            case "admin" -> "ADMIN";
            case "head admin", "organization admin" -> "ORGANIZATION_ADMIN";
            default -> throw new IllegalArgumentException("Unsupported member role");
        };
    }

    private List<String> rolePermissions(String role) {
        String normalized = displayRole(role).toLowerCase(Locale.ROOT);
        List<String> permissions = new ArrayList<>();
        permissions.add("canView");
        if (normalized.contains("voter")) {
            permissions.add("canVote");
        } else if (normalized.contains("reviewer")) {
            permissions.addAll(List.of("canVote", "canAddNote"));
        } else if (normalized.contains("screener")) {
            permissions.addAll(List.of("canVote", "canAddNote", "canMarkOnCheck"));
        } else if (normalized.contains("coordinator")) {
            permissions.addAll(List.of(
                    "canVote", "canAddNote", "canMarkOnCheck", "canSetInterview", "canHire", "canClose",
                    "canInvite", "canTeamManage", "canKickMembers", "canPromoteMembers", "canDemoteMembers",
                    "canChangePermissions", "canMessage", "canViewActivityLog"
            ));
        } else if (normalized.contains("admin")) {
            permissions.addAll(List.of(
                    "canVote", "canAddNote", "canMarkOnCheck", "canSetInterview", "canHire", "canClose",
                    "canInvite", "canTeamManage", "canKickMembers", "canPromoteMembers", "canDemoteMembers",
                    "canChangePermissions", "canMessage", "canViewActivityLog"
            ));
            if (normalized.contains("head")) {
                permissions.add("protectedAccount");
            }
        }
        return permissions.stream().distinct().toList();
    }

    private String displayName(UserAccount account) {
        return account.getFullName() == null || account.getFullName().isBlank() ? account.getUsername() : account.getFullName();
    }

    private String displayRole(String role) {
        String normalized = defaulted(role, "Reviewer").replace('_', ' ').replace('-', ' ').toLowerCase(Locale.ROOT);
        if (normalized.contains("head admin")) {
            return "Head Admin";
        }
        if (normalized.contains("organization admin")) {
            return "Head Admin";
        }
        if (normalized.contains("reviewer")) {
            return "Reviewer";
        }
        if (normalized.contains("coordinator")) {
            return "Coordinator";
        }
        if (normalized.contains("admin")) {
            return "Admin";
        }
        return normalized.isBlank()
                ? "Reviewer"
                : normalized.substring(0, 1).toUpperCase(Locale.ROOT) + normalized.substring(1);
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
        return candidate.getName() + " scored " + candidate.getScore() + "% for " + project.getTitle()
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
