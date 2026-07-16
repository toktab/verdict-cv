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
        return TARGETS.values().stream()
                .map(target -> new TableClearResult(target.key(), target.label(), countRows(target)))
                .toList();
    }

    @Transactional
    public List<TableClearResult> clear(List<String> requestedTargets) {
        if (requestedTargets == null || requestedTargets.isEmpty()) {
            throw new IllegalArgumentException("Select at least one table to clear.");
        }
        List<TableClearResult> results = new ArrayList<>();
        for (String requested : requestedTargets) {
            ClearTarget target = TARGETS.get(normalize(requested));
            if (target == null) {
                throw new IllegalArgumentException("Unknown clear target: " + requested);
            }
            int deleted = 0;
            for (String table : target.tablesInDeleteOrder()) {
                deleted += entityManager.createNativeQuery("DELETE FROM " + table).executeUpdate();
            }
            results.add(new TableClearResult(target.key(), target.label(), deleted));
        }
        return results;
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

    public record TableClearResult(String key, String label, int deletedRows) {
    }
}
