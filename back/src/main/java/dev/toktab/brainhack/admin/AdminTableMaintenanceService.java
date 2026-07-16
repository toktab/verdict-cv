package dev.toktab.brainhack.admin;

import jakarta.persistence.EntityManager;
import jakarta.transaction.Transactional;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;

@Service
public class AdminTableMaintenanceService {
    private final EntityManager entityManager;

    public AdminTableMaintenanceService(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    public List<TableClearResult> targets() {
        List<TableClearResult> results = new ArrayList<>();
        results.add(new TableClearResult("demo_workspace", "Seeded demo workspace only", countDemoRows(), true));
        results.addAll(TARGETS.values().stream()
                .map(target -> new TableClearResult(target.key(), target.label(), countRows(target), false))
                .toList());
        return results;
    }

    @Transactional
    public List<TableClearResult> clear(List<String> requestedTargets) {
        if (requestedTargets == null || requestedTargets.isEmpty()) {
            throw new IllegalArgumentException("Select at least one table to clear.");
        }
        List<TableClearResult> results = new ArrayList<>();
        for (String requested : requestedTargets) {
            String key = normalize(requested);
            if ("demo_workspace".equals(key)) {
                results.add(new TableClearResult(key, "Seeded demo workspace only", clearDemoWorkspace(), true));
                continue;
            }
            ClearTarget target = TARGETS.get(key);
            if (target == null) {
                throw new IllegalArgumentException("Unknown clear target: " + requested);
            }
            int deleted = 0;
            for (String table : target.tablesInDeleteOrder()) {
                deleted += entityManager.createNativeQuery("DELETE FROM " + table).executeUpdate();
            }
            results.add(new TableClearResult(target.key(), target.label(), deleted, false));
        }
        return results;
    }

    private int countDemoRows() {
        return DEMO_COUNT_QUERIES.stream().mapToInt(this::countQuery).sum();
    }

    private int clearDemoWorkspace() {
        int deleted = 0;
        for (String statement : DEMO_DELETE_QUERIES) {
            deleted += entityManager.createNativeQuery(statement).executeUpdate();
        }
        return deleted;
    }

    private int countQuery(String query) {
        Number count = (Number) entityManager.createNativeQuery(query).getSingleResult();
        return count.intValue();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim().toLowerCase(Locale.ROOT);
    }

    private int countRows(ClearTarget target) {
        int count = 0;
        for (String table : target.tablesInDeleteOrder()) {
            Number tableCount = (Number) entityManager.createNativeQuery("SELECT COUNT(*) FROM " + table).getSingleResult();
            count += tableCount.intValue();
        }
        return count;
    }

    private static final Map<String, ClearTarget> TARGETS = targetsByKey();
    private static final String DEMO_PROJECT_IDS = "SELECT id FROM hiring_projects WHERE demo_data = TRUE";
    private static final String DEMO_CANDIDATE_IDS = "SELECT id FROM hiring_candidates WHERE project_id IN (" + DEMO_PROJECT_IDS + ")";
    private static final String DEMO_AUDIT_IDS = "SELECT id FROM audits WHERE demo_data = TRUE";
    private static final String DEMO_USER_IDS = "SELECT id FROM user_accounts WHERE email IN ('demo.reviewer@verdict.example', 'demo.coordinator@verdict.example')";
    private static final List<String> DEMO_COUNT_QUERIES = List.of(
            "SELECT COUNT(*) FROM app_messages WHERE project_id IN (" + DEMO_PROJECT_IDS + ") OR sender_id IN (" + DEMO_USER_IDS + ") OR recipient_email IN ('demo.reviewer@verdict.example', 'demo.coordinator@verdict.example') OR subject LIKE 'Demo shortlist review:%' OR subject LIKE 'Reviewer note:%'",
            "SELECT COUNT(*) FROM project_announcements WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "SELECT COUNT(*) FROM project_activity_logs WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "SELECT COUNT(*) FROM project_ats_templates WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "SELECT COUNT(*) FROM project_member_permissions WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "SELECT COUNT(*) FROM project_settings WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "SELECT COUNT(*) FROM candidate_review_notes WHERE candidate_id IN (" + DEMO_CANDIDATE_IDS + ")",
            "SELECT COUNT(*) FROM hiring_candidates WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "SELECT COUNT(*) FROM project_invites WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "SELECT COUNT(*) FROM team_memberships WHERE user_id IN (" + DEMO_USER_IDS + ")",
            "SELECT COUNT(*) FROM verdict_overrides WHERE verdict_id IN (SELECT id FROM verdicts WHERE audit_id IN (" + DEMO_AUDIT_IDS + "))",
            "SELECT COUNT(*) FROM audit_snapshots WHERE audit_id IN (" + DEMO_AUDIT_IDS + ")",
            "SELECT COUNT(*) FROM verdicts WHERE audit_id IN (" + DEMO_AUDIT_IDS + ")",
            "SELECT COUNT(*) FROM audits WHERE id IN (" + DEMO_AUDIT_IDS + ")",
            "SELECT COUNT(*) FROM hiring_projects WHERE demo_data = TRUE"
    );
    private static final List<String> DEMO_DELETE_QUERIES = List.of(
            "DELETE FROM app_messages WHERE project_id IN (" + DEMO_PROJECT_IDS + ") OR sender_id IN (" + DEMO_USER_IDS + ") OR recipient_email IN ('demo.reviewer@verdict.example', 'demo.coordinator@verdict.example') OR subject LIKE 'Demo shortlist review:%' OR subject LIKE 'Reviewer note:%'",
            "DELETE FROM project_announcements WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "DELETE FROM project_activity_logs WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "DELETE FROM project_ats_templates WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "DELETE FROM project_member_permissions WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "DELETE FROM project_settings WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "DELETE FROM candidate_review_notes WHERE candidate_id IN (" + DEMO_CANDIDATE_IDS + ")",
            "DELETE FROM hiring_candidates WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "DELETE FROM project_invites WHERE project_id IN (" + DEMO_PROJECT_IDS + ")",
            "DELETE FROM team_memberships WHERE user_id IN (" + DEMO_USER_IDS + ")",
            "DELETE FROM verdict_overrides WHERE verdict_id IN (SELECT id FROM verdicts WHERE audit_id IN (" + DEMO_AUDIT_IDS + "))",
            "DELETE FROM audit_snapshots WHERE audit_id IN (" + DEMO_AUDIT_IDS + ")",
            "DELETE FROM verdicts WHERE audit_id IN (" + DEMO_AUDIT_IDS + ")",
            "DELETE FROM audits WHERE id IN (" + DEMO_AUDIT_IDS + ")",
            "DELETE FROM hiring_projects WHERE demo_data = TRUE"
    );

    private static Map<String, ClearTarget> targetsByKey() {
        Map<String, ClearTarget> targets = new LinkedHashMap<>();
        add(targets, new ClearTarget("messages", "Messages", List.of("app_messages")));
        add(targets, new ClearTarget("event_logs", "Event logs", List.of("app_event_logs")));
        add(targets, new ClearTarget("audits", "Audits, verdicts, snapshots, overrides", List.of(
                "verdict_overrides",
                "audit_snapshots",
                "verdicts",
                "audits"
        )));
        add(targets, new ClearTarget("hiring", "Hiring projects, candidates, invites, notes, teams", List.of(
                "project_announcements",
                "project_activity_logs",
                "project_ats_templates",
                "project_member_permissions",
                "project_settings",
                "candidate_review_notes",
                "hiring_candidates",
                "project_invites",
                "hiring_projects",
                "team_memberships",
                "organizations"
        )));
        add(targets, new ClearTarget("templates", "Audit templates", List.of("audit_templates")));
        add(targets, new ClearTarget("sessions", "User sessions", List.of("user_sessions")));
        add(targets, new ClearTarget("settings", "App settings", List.of("app_settings")));
        add(targets, new ClearTarget("users", "Users and all user-owned data", List.of(
                "app_messages",
                "project_announcements",
                "project_activity_logs",
                "project_ats_templates",
                "project_member_permissions",
                "project_settings",
                "candidate_review_notes",
                "hiring_candidates",
                "project_invites",
                "hiring_projects",
                "team_memberships",
                "organizations",
                "verdict_overrides",
                "audit_snapshots",
                "verdicts",
                "audits",
                "audit_templates",
                "user_sessions",
                "user_accounts"
        )));
        return targets;
    }

    private static void add(Map<String, ClearTarget> targets, ClearTarget target) {
        targets.put(target.key(), target);
    }

    private record ClearTarget(String key, String label, List<String> tablesInDeleteOrder) {
    }

    public record TableClearResult(String key, String label, int deletedRows, boolean demoPreset) {
    }
}
