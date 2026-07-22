package dev.toktab.brainhack.api;

import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.blankOrNullString;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import dev.toktab.brainhack.account.AccountSettingsService;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
class SecurityBoundariesTest {
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
    void adminEndpointsRejectRegularUserTokens() throws Exception {
        String token = register("normal_user_only");

        mockMvc.perform(get("/api/admin/users").header("X-User-Token", token))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/health").header("X-User-Token", token))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/settings").header("X-User-Token", token))
                .andExpect(status().isForbidden());

        mockMvc.perform(get("/api/admin/table-clear-targets").header("X-User-Token", token))
                .andExpect(status().isForbidden());
    }

    @Test
    void adminEndpointsRejectRequestsWithoutAnyToken() throws Exception {
        mockMvc.perform(get("/api/admin/users"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/admin/health"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/admin/settings"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"\",\"password\":\"\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void regularUserEndpointsRequireValidToken() throws Exception {
        mockMvc.perform(get("/api/auth/me"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/audit/history"))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/auth/me/cmd-sessions"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletedUserTokenIsRejected() throws Exception {
        String token = register("temporary_user");
        String adminToken = adminToken();

        JsonNode userNode = objectMapper.readTree(
                mockMvc.perform(get("/api/auth/me").header("X-User-Token", token))
                        .andExpect(status().isOk())
                        .andReturn().getResponse().getContentAsString());
        long userId = userNode.get("id").asLong();

        mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete("/api/admin/users/" + userId)
                                .header("X-Admin-Token", adminToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me").header("X-User-Token", token))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/projects").header("X-User-Token", token))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void expiredAccessTokenIsRejected() throws Exception {
        String username = "expiry_check_user";
        String token = register(username);

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"" + username + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String freshToken = objectMapper.readTree(loginResult.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(get("/api/auth/me").header("X-User-Token", freshToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/auth/me").header("Authorization", "Bearer " + freshToken))
                .andExpect(status().isOk());

        String expiredToken = simulateExpiredToken(username);

        mockMvc.perform(get("/api/auth/me").header("X-User-Token", expiredToken))
                .andExpect(status().isUnauthorized());

        mockMvc.perform(get("/api/projects").header("X-User-Token", expiredToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void refreshTokenCannotBeUsedAsAccessToken() throws Exception {
        String username = "refresh_mixup_user";
        String token = register(username);

        MvcResult loginResult = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"identifier\":\"" + username + "\",\"password\":\"password123\"}"))
                .andExpect(status().isOk())
                .andReturn();
        String refreshToken = objectMapper.readTree(loginResult.getResponse().getContentAsString())
                .get("refresh_token").asText();

        mockMvc.perform(get("/api/auth/me").header("X-User-Token", refreshToken))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void userCannotAccessAnotherUsersData() throws Exception {
        String firstToken = register("data_owner_a");
        String secondToken = register("data_owner_b");

        MvcResult firstAudit = mockMvc.perform(post("/api/audit/run")
                        .header("X-User-Token", firstToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "claimTitle":"Owner A",
                                  "evidenceTitle":"Evidence A",
                                  "claimText":"Built Java APIs.",
                                  "evidenceText":"Portfolio confirms Java APIs."
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        long auditId = objectMapper.readTree(firstAudit.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/audit/" + auditId).header("X-User-Token", secondToken))
                .andExpect(status().isBadRequest());

        mockMvc.perform(get("/api/audit/" + auditId + "/progress").header("X-User-Token", secondToken))
                .andExpect(status().isBadRequest());
    }

    @Test
    void corsHeadersArePresentOnOptionsRequests() throws Exception {
        mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/auth/login")
                                .header("Origin", "http://localhost:5173")
                                .header("Access-Control-Request-Method", "POST"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .string("Access-Control-Allow-Origin", org.hamcrest.Matchers.anyOf(
                                org.hamcrest.Matchers.containsString("localhost:5173"),
                                org.hamcrest.Matchers.containsString("*"))));

        mockMvc.perform(
                        org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options("/api/projects")
                                .header("Origin", "http://localhost:5173")
                                .header("Access-Control-Request-Method", "GET"))
                .andExpect(status().isOk())
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header()
                        .exists("Access-Control-Allow-Origin"));
    }

    @Test
    void unauthenticatedAccessToProtectedEndpointsReturnsProperErrorMessage() throws Exception {
        mockMvc.perform(get("/api/audit/history"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").isString());
    }

    @Test
    void adminRejectsInvalidCredentials() throws Exception {
        mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"wrong_password\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void adminLoginSucceedsWithDefaultCredentials() throws Exception {
        mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token", not(blankOrNullString())));
    }

    private String register(String username) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName":"Security Test",
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
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    private String adminToken() throws Exception {
        MvcResult result = mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"admin\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("token").asText();
    }

    private String simulateExpiredToken(String username) {
        java.util.Base64.Encoder encoder = java.util.Base64.getUrlEncoder().withoutPadding();
        String header = encoder.encodeToString("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes());
        long expired = System.currentTimeMillis() / 1000 - 86400;
        String payload = encoder.encodeToString(("{\"sub\":\"" + username + "\",\"exp\":" + expired + "}").getBytes());
        return header + "." + payload + ".";
    }
}
