package dev.toktab.brainhack.hiring;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserAccountService;
import dev.toktab.brainhack.hiring.HiringDtos.ImportResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectPageResponse;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectRequest;
import dev.toktab.brainhack.hiring.HiringDtos.ProjectResponse;
import jakarta.transaction.Transactional;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Pattern;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

@Service
public class HiringProjectService {
    private static final Set<String> REQUIREMENT_SECTIONS = Set.of(
            "RESPONSIBILITIES", "REQUIRED QUALIFICATIONS", "NICE TO HAVE", "TECH STACK", "IDEAL CANDIDATE PROFILE");
    private static final Set<String> STOP_REQUIREMENT_SECTIONS = Set.of(
            "WHAT WE OFFER", "ABOUT THE ROLE", "LOCATION", "EMPLOYMENT TYPE", "LEVEL");
    private static final Pattern REQUIREMENT_LINE = Pattern.compile(
            "^([A-Z][A-Z\\s]+):\\s*(.+)$", Pattern.MULTILINE);

    private final HiringProjectRepository projectRepository;
    private final HiringMapper mapper;
    private final OrganizationRepository organizationRepository;
    private final ProjectActivityLogRepository activityRepository;

    public HiringProjectService(
            HiringProjectRepository projectRepository,
            HiringMapper mapper,
            OrganizationRepository organizationRepository,
            ProjectActivityLogRepository activityRepository) {
        this.projectRepository = projectRepository;
        this.mapper = mapper;
        this.organizationRepository = organizationRepository;
        this.activityRepository = activityRepository;
    }

    public Organization ensureOrganization(UserAccount owner) {
        return organizationRepository.findFirstByOwnerIdOrderByCreatedAtAsc(owner.getId())
                .orElseGet(() -> {
                    Organization organization = new Organization();
                    organization.setOwner(owner);
                    organization.setName(defaulted(owner.getOrganization(), owner.getUsername() + " Team"));
                    return organizationRepository.save(organization);
                });
    }

    @Transactional
    public ProjectResponse project(UserAccount owner, Long id) {
        return mapper.project(entity(owner, id), "owner", List.of("all"));
    }

    @Transactional
    public List<ProjectResponse> accessible(UserAccount owner) {
        ensureOrganization(owner);
        return projectRepository.findAccessible(owner.getId(), owner.getEmail()).stream()
                .map(project -> mapper.project(project, "owner", List.of("all")))
                .toList();
    }

    @Transactional
    public ProjectPageResponse page(UserAccount owner, int page, int size, String search) {
        ensureOrganization(owner);
        int safePage = Math.max(0, page);
        int safeSize = Math.max(1, Math.min(100, size));
        String safeSearch = search == null ? "" : search.trim().toLowerCase(Locale.ROOT);
        Page<HiringProject> result = projectRepository.findAccessiblePage(
                owner.getId(), owner.getEmail(), safeSearch,
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "createdAt")));
        List<ProjectResponse> items = result.getContent().stream()
                .map(project -> mapper.project(project, "owner", List.of("all")))
                .toList();
        return new ProjectPageResponse(items, safePage, safeSize, result.getTotalElements(), result.getTotalPages());
    }

    public HiringProject entity(UserAccount owner, Long id) {
        return projectRepository.findAccessibleById(id, owner.getId(), owner.getEmail())
                .orElseThrow(() -> new IllegalArgumentException("Project not found"));
    }

    @Transactional
    public ProjectResponse create(UserAccount owner, ProjectRequest request) {
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
        return mapper.project(saved, "owner", List.of("all"));
    }

    @Transactional
    public void delete(UserAccount owner, Long id) {
        HiringProject project = entity(owner, id);
        project.setDeletedAt(Instant.now());
        projectRepository.save(project);
        recordActivity(project, owner, "project_delete", "Deleted project " + project.getTitle(), "danger",
                "Project was deleted from active lists.");
    }

    public List<String> extractRequirements(String text) {
        if (text == null || text.isBlank()) return List.of();
        List<String> requirements = new ArrayList<>();
        String[] lines = text.split("\\R");
        boolean inSection = false;
        for (String line : lines) {
            String upper = line.trim().toUpperCase(Locale.ROOT);
            if (STOP_REQUIREMENT_SECTIONS.contains(upper)) {
                inSection = false;
            } else if (REQUIREMENT_SECTIONS.contains(upper)) {
                inSection = true;
            } else if (inSection && !line.trim().isBlank()) {
                String clean = line.trim().replaceAll("^[-•*]\\s*", "");
                if (clean.length() > 3) requirements.add(clean);
            }
        }
        return requirements;
    }

    public List<String> cleanRequirements(List<String> raw) {
        if (raw == null || raw.isEmpty()) return List.of();
        return raw.stream()
                .map(r -> r == null ? "" : r.trim())
                .filter(r -> !r.isBlank())
                .map(r -> r.replaceAll("^[-•*]\\s*", ""))
                .filter(r -> r.length() > 3)
                .toList();
    }

    public void recordActivity(HiringProject project, UserAccount actor, String action, String label,
                               String severity, String description) {
        ProjectActivityLog log = new ProjectActivityLog();
        log.setProject(project);
        log.setActor(actor);
        log.setType(action);
        log.setAction(defaulted(label, action));
        log.setActorName(displayName(actor));
        log.setActorEmail(actor.getEmail());
        log.setProjectTitle(project.getTitle());
        log.setDetail(description);
        log.setSeverity(severity);
        activityRepository.save(log);
    }

    private String defaulted(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private String displayName(UserAccount user) {
        String name = user.getFullName();
        return name != null && !name.isBlank() ? name.trim() : user.getUsername();
    }
}
