package dev.toktab.brainhack.api;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.account.AccountSettingsService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class AuthAuditAdminFlowTest {
    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Autowired
    AccountSettingsService settingsService;

    @BeforeEach
    void resetSettings() {
        settingsService.setRequireEmailVerification(false);
    }

    @Test
    void notificationPreferencesPersistWithTheUserAccount() throws Exception {
        String token = register("notification_owner");

        mockMvc.perform(get("/api/auth/me").header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageNotificationsEnabled").value(true))
                .andExpect(jsonPath("$.messageNotificationsMutedUntil").value(blankOrNullString()));

        mockMvc.perform(patch("/api/auth/me/notifications")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "enabled":true,
                                  "mutedUntil":"2099-01-01T00:00:00Z"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageNotificationsEnabled").value(true))
                .andExpect(jsonPath("$.messageNotificationsMutedUntil").value("2099-01-01T00:00:00Z"));

        mockMvc.perform(patch("/api/auth/me/notifications")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"enabled\":false,\"mutedUntil\":null}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageNotificationsEnabled").value(false))
                .andExpect(jsonPath("$.messageNotificationsMutedUntil").value(blankOrNullString()));

        mockMvc.perform(get("/api/auth/me").header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.messageNotificationsEnabled").value(false));
    }

    @Test
    void cmdSessionsRecordAccessDetailsAndCanBeRevokedFromProfile() throws Exception {
        String username = "cmd_access_user";
        String webToken = register(username);
        MvcResult login = mockMvc.perform(post("/api/auth/cli/login")
                        .header("User-Agent", "VERDICT-CLI/1.0 Windows")
                        .header("X-Forwarded-For", "203.0.113.42")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "identifier":"cmd_access_user",
                                  "password":"password123",
                                  "clientName":"Office workstation"
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", not(blankOrNullString())))
                .andReturn();
        String cliToken = token(login);
        String refreshToken = objectMapper.readTree(login.getResponse().getContentAsString()).get("refresh_token").asText();

        MvcResult refreshed = mockMvc.perform(post("/api/auth/refresh")
                        .header("User-Agent", "VERDICT-CLI/1.0 Windows")
                        .header("X-Forwarded-For", "203.0.113.42")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refresh_token\":\"" + refreshToken + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        cliToken = token(refreshed);

        MvcResult sessions = mockMvc.perform(get("/api/auth/me/cmd-sessions")
                        .header("X-User-Token", webToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].client_name").value("Office workstation"))
                .andExpect(jsonPath("$[0].ip_address").value("203.0.113.42"))
                .andExpect(jsonPath("$[0].user_agent").value("VERDICT-CLI/1.0 Windows"))
                .andExpect(jsonPath("$[0].active").value(true))
                .andReturn();
        String sessionId = objectMapper.readTree(sessions.getResponse().getContentAsString()).get(0).get("id").asText();

        mockMvc.perform(delete("/api/auth/me/cmd-sessions/" + sessionId)
                        .header("X-User-Token", webToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me").header("X-User-Token", cliToken))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me/cmd-sessions").header("X-User-Token", webToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(false))
                .andExpect(jsonPath("$[0].revocation_reason").value("revoked from profile"));
    }

    @Test
    void cmdPairingCodeIsOneTimeAndCreatesTrackedPasswordlessSession() throws Exception {
        String webToken = register("cmd_pairing_user");
        MvcResult generated = mockMvc.perform(post("/api/auth/me/cmd-pairing-code")
                        .header("X-User-Token", webToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.code").value(org.hamcrest.Matchers.matchesPattern("[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}")))
                .andExpect(jsonPath("$.expires_in_seconds").value(300))
                .andReturn();
        String code = objectMapper.readTree(generated.getResponse().getContentAsString()).get("code").asText();
        String payload = """
                {
                  "code":"%s",
                  "clientName":"QA terminal"
                }
                """.formatted(code);

        mockMvc.perform(post("/api/auth/cli/pair")
                        .header("User-Agent", "VERDICT-CLI/1.1 Windows")
                        .header("X-Forwarded-For", "198.51.100.17")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", not(blankOrNullString())))
                .andExpect(jsonPath("$.user.username").value("cmd_pairing_user"));

        mockMvc.perform(post("/api/auth/cli/pair")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/auth/me/cmd-sessions").header("X-User-Token", webToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].client_name").value("QA terminal"))
                .andExpect(jsonPath("$[0].ip_address").value("198.51.100.17"))
                .andExpect(jsonPath("$[0].active").value(true));

        mockMvc.perform(get("/api/system/cli/installer"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("install-verdict.cmd")))
                .andExpect(content().string(containsString("install-verdict.ps1")));

        mockMvc.perform(get("/api/system/cli/files/verdict.mjs"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString("attachment")))
                .andExpect(header().string("Content-Disposition", containsString("verdict.mjs")))
                .andExpect(header().string("X-Content-Type-Options", "nosniff"))
                .andExpect(content().string(containsString("VERDICT CLI")));
    }

    @Test
    void auditApisRequireUserTokenAndOnlyReturnOwnedAudits() throws Exception {
        String firstToken = register("ownerone");
        String secondToken = register("ownertwo");

        mockMvc.perform(get("/api/audit/history"))
                .andExpect(status().isUnauthorized());

        MvcResult auditResult = mockMvc.perform(post("/api/audit/run")
                        .header("X-User-Token", firstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "claimTitle":"Owner One CV",
                                  "evidenceTitle":"Owner One Evidence",
                                  "claimText":"Built Spring Boot APIs with MySQL. Led a small backend project.",
                                  "evidenceText":"Portfolio states Spring Boot APIs with MySQL and backend project ownership."
                                }
                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.failureType").value("NONE"))
                .andExpect(jsonPath("$.analyzerVersion").value("local-state-policy-v2"))
                .andExpect(jsonPath("$.promptVersion").value("none-local-deterministic"))
                .andExpect(jsonPath("$.verdicts", hasSize(2)))
                .andReturn();

        long auditId = objectMapper.readTree(auditResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/audit/" + auditId).header("X-User-Token", firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(auditId));

        mockMvc.perform(get("/api/audit/" + auditId + "/progress").header("X-User-Token", firstToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(auditId))
                .andExpect(jsonPath("$.status").value("COMPLETED"))
                .andExpect(jsonPath("$.failureType").value("NONE"))
                .andExpect(jsonPath("$.stage").value("completed"))
                .andExpect(jsonPath("$.percent").value(100))
                .andExpect(jsonPath("$.message").value("Audit completed."));

        mockMvc.perform(get("/api/audit/" + auditId + "/progress").header("X-User-Token", secondToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/audit/" + auditId).header("X-User-Token", secondToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/audit/history").header("X-User-Token", secondToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void userCanExportAuditInMultipleFormats() throws Exception {
        String token = register("export_user");

        MvcResult auditResult = mockMvc.perform(post("/api/audit/run")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "claimTitle":"Export CV",
                                  "evidenceTitle":"Export Evidence",
                                  "claimText":"Built Spring Boot APIs with MySQL. Reduced costs by 40%.",
                                  "evidenceText":"Portfolio confirms Spring Boot APIs with MySQL."
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long auditId = objectMapper.readTree(auditResult.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/audit/" + auditId + "/export")
                        .header("X-User-Token", token)
                        .param("format", "pdf"))
                .andExpect(status().isOk())
                .andExpect(content().contentType(MediaType.APPLICATION_PDF))
                .andExpect(header().string("Content-Disposition", containsString(".pdf")));

        mockMvc.perform(get("/api/audit/" + auditId + "/export")
                        .header("X-User-Token", token)
                        .param("format", "excel"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString(".csv")));

        mockMvc.perform(get("/api/audit/" + auditId + "/export")
                        .header("X-User-Token", token)
                        .param("format", "word"))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Disposition", containsString(".doc")));
    }

    @Test
    void userCanExtractGenericAuditTextFile() throws Exception {
        String token = register("extract_user");
        MockMultipartFile file = new MockMultipartFile(
                "file",
                "claim.txt",
                MediaType.TEXT_PLAIN_VALUE,
                "Built Java APIs from uploaded text.".getBytes());

        mockMvc.perform(multipart("/api/audit/extract-file")
                        .file(file)
                        .header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.filename").value("claim.txt"))
                .andExpect(jsonPath("$.text").value("Built Java APIs from uploaded text."))
                .andExpect(jsonPath("$.warnings[0]").value("Extraction returned very little text. Confirm the document content before auditing."));

        MockMultipartFile oversized = new MockMultipartFile(
                "file",
                "too-large.txt",
                MediaType.TEXT_PLAIN_VALUE,
                new byte[(8 * 1024 * 1024) + 1]);
        mockMvc.perform(multipart("/api/audit/extract-file")
                        .file(oversized)
                        .header("X-User-Token", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Audit file is too large. Upload a PDF, DOCX, or TXT file no larger than 8 MB."));
    }

    @Test
      void adminCanManageUsersAndEmailVerificationSetting() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(patch("/api/admin/settings")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requireEmailVerification\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requireEmailVerification").value(true));

        MvcResult created = mockMvc.perform(post("/api/admin/users")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName":"Managed User",
                                  "username":"manageduser",
                                  "email":"managed@example.com",
                                  "country":"Georgia",
                                  "address":"Test address",
                                  "organization":"QA",
                                  "role":"Tester",
                                  "password":"password123",
                                  "emailVerified":false
      }

      @Test
      void adminHealthReportsLiveInfrastructureAndRuntimeDetails() throws Exception {
          String adminToken = adminToken();

          mockMvc.perform(get("/api/admin/health").header("X-Admin-Token", adminToken))
                  .andExpect(status().isOk())
                  .andExpect(jsonPath("$.overallStatus").value("HEALTHY"))
                  .andExpect(jsonPath("$.db.ok").value(true))
                  .andExpect(jsonPath("$.llm.status").value("local-fallback"))
                  .andExpect(jsonPath("$.rabbitmq.enabled").value(false))
                  .andExpect(jsonPath("$.rabbitmq.connected").value(false))
                  .andExpect(jsonPath("$.runtime.uptimeSeconds").isNumber())
                  .andExpect(jsonPath("$.runtime.heapMaxMb").isNumber())
                  .andExpect(jsonPath("$.audits.available").value(true))
                  .andExpect(jsonPath("$.audits.completed").isNumber())
                  .andExpect(jsonPath("$.audits.averageProcessingMillis").isNumber())
                  .andExpect(jsonPath("$.buildVersion").isString());
      }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.emailVerified").value(false))
                .andReturn();

        long userId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(patch("/api/admin/users/" + userId)
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName":"Managed User Edited",
                                  "username":"manageduser",
                                  "email":"managed@example.com",
                                  "country":"Georgia",
                                  "address":"Changed",
                                  "organization":"QA",
                                  "role":"Lead Tester",
                                  "password":"",
                                  "emailVerified":true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fullName").value("Managed User Edited"))
                .andExpect(jsonPath("$.emailVerified").value(true));

        mockMvc.perform(delete("/api/admin/users/" + userId).header("X-Admin-Token", adminToken))
                .andExpect(status().isOk());
    }

    @Test
    void adminCanSelectAndClearAllowedTableGroups() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(get("/api/admin/table-clear-targets").header("X-Admin-Token", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].key").value("demo_workspace"))
                .andExpect(jsonPath("$[0].demoPreset").value(true))
                .andExpect(jsonPath("$[1].key").value("messages"));

        mockMvc.perform(patch("/api/admin/settings")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"requireEmailVerification\":true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requireEmailVerification").value(true));

        mockMvc.perform(post("/api/admin/clear-tables")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targets\":[\"settings\"]}"))
                .andExpect(status().isBadRequest());

        mockMvc.perform(post("/api/admin/clear-tables")
                        .header("X-Admin-Token", adminToken)
                        .header("X-Request-Id", "admin-clear-settings-test")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"targets\":[\"settings\"],\"confirmation\":\"settings\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].key").value("settings"))
                .andExpect(jsonPath("$[0].deletedRows").value(1));

        mockMvc.perform(get("/api/admin/settings").header("X-Admin-Token", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requireEmailVerification").value(false));

        mockMvc.perform(get("/api/admin/logs")
                .header("X-Admin-Token", adminToken)
                        .param("search", "ADMIN_CLEAR_TABLES"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.eventType == 'ADMIN_CLEAR_TABLES')].actor", hasItem("admin")))
                .andExpect(jsonPath("$[?(@.eventType == 'ADMIN_CLEAR_TABLES')].detail", hasItem(containsString("affectedRowsBefore=1"))))
                .andExpect(jsonPath("$[?(@.eventType == 'ADMIN_CLEAR_TABLES')].detail", hasItem(containsString("deletedRows=1"))))
                .andExpect(jsonPath("$[?(@.eventType == 'ADMIN_CLEAR_TABLES')].requestId", hasItem("admin-clear-settings-test")));
    }

    @Test
    void adminCanPublishAndRestoreValidatedOfficialAtsVersions() throws Exception {
        String adminToken = adminToken();

        MvcResult initial = mockMvc.perform(get("/api/admin/ats-templates").header("X-Admin-Token", adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].active").value(true))
                .andReturn();
        JsonNode initialVersion = objectMapper.readTree(initial.getResponse().getContentAsString()).get(0);
        long initialId = initialVersion.get("id").asLong();
        JsonNode catalog = objectMapper.readTree(initialVersion.get("catalogJson").asText());
        ((com.fasterxml.jackson.databind.node.ArrayNode) catalog.path("analyzers").path("techTerms")).add("ats-governance-test");

        String publishBody = objectMapper.writeValueAsString(java.util.Map.of(
                "catalogJson", objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(catalog),
                "changeNote", "Add governed ATS test term"));
        mockMvc.perform(post("/api/admin/ats-templates")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(publishBody))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.changeNote").value("Add governed ATS test term"));

        mockMvc.perform(post("/api/admin/ats-templates")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"catalogJson\":\"{bad-json\",\"changeNote\":\"invalid\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message", containsString("not valid JSON")));

        mockMvc.perform(post("/api/admin/ats-templates/" + initialId + "/rollback")
                        .header("X-Admin-Token", adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"changeNote\":\"Restore bundled catalog\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.active").value(true))
                .andExpect(jsonPath("$.changeNote").value("Restore bundled catalog"));

        mockMvc.perform(get("/api/admin/ats-templates"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void userCanLoadDefaultsAndCreatePrivateAuditTemplate() throws Exception {
        String token = register("template_user");

        mockMvc.perform(get("/api/audit/templates").header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].source").value("default"));

        mockMvc.perform(post("/api/audit/templates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "mode":"cv",
                                  "name":"Private CV Template",
                                  "description":"Treat links and email as context.",
                                  "instructions":"Ignore plain contact fields and only score evidence-backed CV claims."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.source").value("custom"))
                .andExpect(jsonPath("$.name").value("Private CV Template"));
    }

    @Test
    void adminListSearchFiltersPagedResults() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(get("/api/admin/users")
                        .header("X-Admin-Token", adminToken)
                        .param("search", "missing-user-name"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(0)));
    }

    @Test
    void requestIdIsReturnedOnResponsesAndErrorBodies() throws Exception {
        String requestId = "test-request-123";

        mockMvc.perform(get("/api/audit/history").header("X-Request-Id", requestId))
                .andExpect(status().isUnauthorized())
                .andExpect(header().string("X-Request-Id", requestId))
                .andExpect(jsonPath("$.code").value("UNAUTHORIZED"))
                .andExpect(jsonPath("$.requestId").value(requestId));
    }

    @Test
    void publicHealthStaysAvailableButEvaluationDatasetRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/system/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UP"));

        mockMvc.perform(get("/api/system/evaluation-dataset"))
                .andExpect(status().isUnauthorized());

        String token = register("dataset_reviewer");
        mockMvc.perform(get("/api/system/evaluation-dataset").header("X-User-Token", token))
                .andExpect(status().isOk());
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName":"Test User",
                                  "username":"%s",
                                  "email":"%s@example.com",
                                  "country":"Georgia",
                                  "address":"Test address",
                                  "organization":"QA",
                                  "role":"Tester",
                                  "password":"password123"
                                }
                                """.formatted(username, username)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", not(blankOrNullString())))
                .andReturn();
        return token(result);
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return token(result);
    }

    private String token(MvcResult result) throws Exception {
        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.get("token").asText();
    }
}
