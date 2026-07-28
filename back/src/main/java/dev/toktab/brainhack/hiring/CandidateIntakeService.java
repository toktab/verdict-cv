package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.hiring.HiringDtos.CandidatePageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateRequest;
import dev.toktab.brainhack.hiring.HiringDtos.CandidateResponse;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@Service
public class CandidateIntakeService {
    private final HiringProjectRepository projectRepository;
    private final HiringCandidateRepository candidateRepository;
    private final HiringMapper mapper;
    private final HiringProjectService projectService;
    private final ResumeTextExtractionService resumeExtractionService;
    private final CandidateAnalysisService candidateAnalysisService;
    private final ProjectStateService projectStateService;

    public CandidateIntakeService(
            HiringProjectRepository projectRepository,
            HiringCandidateRepository candidateRepository,
            HiringMapper mapper,
            HiringProjectService projectService,
            ResumeTextExtractionService resumeExtractionService,
            CandidateAnalysisService candidateAnalysisService,
            ProjectStateService projectStateService) {
        this.projectRepository = projectRepository;
        this.candidateRepository = candidateRepository;
        this.mapper = mapper;
        this.projectService = projectService;
        this.resumeExtractionService = resumeExtractionService;
        this.candidateAnalysisService = candidateAnalysisService;
        this.projectStateService = projectStateService;
    }

    @Transactional
    public CandidateResponse addCandidate(UserAccount owner, Long projectId, CandidateRequest request) {
        HiringProject project = projectService.entity(owner, projectId);
        requireCandidateIntake(project, false);
        HiringCandidate candidate = candidateAnalysisService.buildCandidate(project,
                defaulted(request.name(), "Unnamed candidate"),
                defaulted(request.role(), project.getTitle()),
                defaulted(request.cvText(), ""), "");
        HiringCandidate saved = candidateAnalysisService.saveAndRecord(candidate, owner);
        CandidateResponse response = mapper.candidate(saved);
        candidateAnalysisService.recordCandidateActivity(candidate, owner, "candidate_create",
                "Added candidate " + candidate.getName(), "good", "Candidate was added to the project.");
        return response;
    }

    @Transactional
    public CandidateResponse uploadCandidate(UserAccount owner, Long projectId, String name, String role, MultipartFile resume) {
        HiringProject project = projectService.entity(owner, projectId);
        requireCandidateIntake(project, true);
        String cvText = resumeExtractionService.extract(resume);
        HiringCandidate candidate = candidateAnalysisService.buildCandidate(project,
                defaulted(name, "Unnamed candidate"),
                defaulted(role, project.getTitle()),
                cvText, resume == null ? "" : resume.getOriginalFilename());
        HiringCandidate saved = candidateAnalysisService.saveAndRecord(candidate, owner);
        CandidateResponse response = mapper.candidate(saved);
        candidateAnalysisService.recordCandidateActivity(candidate, owner, "candidate_upload",
                "Uploaded candidate " + candidate.getName(), "good", "Candidate resume was uploaded and analyzed.");
        return response;
    }

    @Transactional
    public CandidateResponse candidate(UserAccount owner, Long projectId, Long candidateId) {
        return mapper.candidate(candidateEntity(owner, projectId, candidateId));
    }

    @Transactional
    public CandidatePageResponse candidates(UserAccount owner, Long projectId, int offset, int limit) {
        projectService.entity(owner, projectId);
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
    public void deleteCandidate(UserAccount owner, Long projectId, Long candidateId) {
        HiringCandidate candidate = candidateEntity(owner, projectId, candidateId);
        candidate.setDeletedAt(Instant.now());
        candidateRepository.save(candidate);
        candidateAnalysisService.recordCandidateActivity(candidate, owner, "candidate_delete",
                "Deleted candidate " + candidate.getName(), "danger", "Candidate was removed from active review lists.");
    }

    public HiringCandidate candidateEntity(UserAccount owner, Long projectId, Long candidateId) {
        return candidateRepository.findAccessibleById(candidateId, projectId, owner.getId(), owner.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Candidate not found"));
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

    private String projectSetting(HiringProject project, String key, String fallback) {
        Object value = projectStateService.effectiveSettings(project).get(key);
        String clean = value == null ? "" : String.valueOf(value).trim();
        return clean.isBlank() ? fallback : clean;
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }
}
