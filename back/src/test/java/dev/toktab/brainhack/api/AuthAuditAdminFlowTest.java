package dev.toktab.brainhack.api;

import static org.hamcrest.Matchers.hasSize;
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
                .andExpect(jsonPath("$.analyzerVersion").value("local-heuristic-v2"))
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
