package dev.toktab.brainhack.api;

import static org.hamcrest.Matchers.blankOrNullString;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThan;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.charset.StandardCharsets;
import java.util.UUID;
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
class HiringFlowTest {
    @Autowired
    MockMvc mockMvc;

    @Autowired
    ObjectMapper objectMapper;

    @Test
    void hiringApisRequireAuthenticationAndAcceptBearerTokens() throws Exception {
        mockMvc.perform(get("/api/projects"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.message").value("User authentication required"));

        String token = register("hiring_bearer");

        mockMvc.perform(post("/api/projects")
                        .header("Authorization", "Bearer " + token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(projectPayload("Bearer Backend Engineer", "Build Java APIs.",
                                "[\"Java\", \"Spring Boot\", \"REST API\"]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Bearer Backend Engineer"));
    }

    @Test
    void projectDescriptionStoresLongTextAndExpandsCandidateClaimsFromFullCv() throws Exception {
        String token = register("hiring_long_text");
        String longDescription = "Java platform role. ".repeat(500)
                + "\nRequirements:\n- Java and Spring Boot\n- SQL authentication\n- Docker deployment";

        long projectId = createProject(token, "Long Description Role", longDescription,
                "[\"Java and Spring Boot\", \"SQL authentication\", \"Docker deployment\"]");

        String cvText = """
                Senior Java engineer with Spring Boot APIs, SQL authentication, Docker deployment,
                GitHub portfolio https://example.com/profile and measurable REST API ownership.
                Led migration work and built production monitoring for backend services.
                """;

        MvcResult candidate = mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"Full Text Candidate",
                                  "role":"Backend Engineer",
                                  "cv_text":%s
                                }
                                """.formatted(objectMapper.writeValueAsString(cvText))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cv_text").value(containsString("Spring Boot APIs")))
                .andExpect(jsonPath("$.claims.length()", greaterThan(3)))
                .andExpect(jsonPath("$.audit_phrase_matches.length()", greaterThan(0)))
                .andReturn();

        long candidateId = objectMapper.readTree(candidate.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/projects/" + projectId + "/candidates/" + candidateId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.cv_text").value(containsString("Led migration work")))
                .andExpect(jsonPath("$.claims.length()", greaterThan(3)));
    }

    @Test
    void blankManualRequirementsFallBackToStructuredJobDescriptionExtraction() throws Exception {
        String token = register("hiring_requirement_fallback");
        String description = """
                JOB TITLE: Junior Java Backend Developer

                REQUIRED QUALIFICATIONS
                - Basic to intermediate knowledge of Java.
                - Practical experience with Spring Boot.
                - Understanding of REST API design and backend service development.
                - Knowledge of SQL and relational databases.
                - Basic knowledge of Spring Security or JWT authentication.
                - Experience using Git and GitHub.
                - Ability to test APIs using Postman, Swagger, JUnit, or similar tools.

                NICE TO HAVE
                - Experience with Docker.
                - Familiarity with JPA / Hibernate.
                - Basic understanding of CI/CD pipelines.
                - Understanding of distributed systems, messaging, Kafka, or WebSockets.
                """;

        MvcResult projectResult = mockMvc.perform(post("/api/projects")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(projectPayload("Junior Java Backend Developer", description, "[\"\"]")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.requirements.length()", greaterThan(8)))
                .andExpect(jsonPath("$.requirements", hasItem("Practical experience with Spring Boot.")))
                .andReturn();
        long projectId = objectMapper.readTree(projectResult.getResponse().getContentAsString()).get("id").asLong();

        String cvText = """
                Junior Java Backend Developer with Java, Spring Boot, REST APIs, SQL databases, MySQL, PostgreSQL,
                Spring Security, JWT authentication, Git, GitHub, Postman, Swagger, JUnit, RestAssured, Docker,
                JPA, Hibernate, CI/CD basics, Kafka, WebSockets, backend service development, and debugging.
                Built Spring Boot REST APIs with controller-service-repository structure and SQL persistence.
                """;

        mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"High Match Java Candidate",
                                  "role":"Junior Java Backend Developer",
                                  "cv_text":%s
                                }
                                """.formatted(objectMapper.writeValueAsString(cvText))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score", greaterThan(75)))
                .andExpect(jsonPath("$.match", greaterThan(85)))
                .andExpect(jsonPath("$.supported", greaterThan(8)))
                .andExpect(jsonPath("$.unsupported").value(0));
    }

    @Test
    void qaAutomationCvDoesNotReceiveStrongBackendProofForMissingJavaBackendStack() throws Exception {
        String token = register("hiring_qa_vs_backend");
        String description = """
                REQUIRED QUALIFICATIONS
                - Develop and maintain backend services using Java and Spring Boot.
                - Practical experience with Spring Boot.
                - Familiarity with JPA / Hibernate.
                - Collaborate with frontend developers, QA engineers, and senior backend developers.
                - Ability to test APIs using Postman, Swagger, JUnit, or similar tools.
                - Basic understanding of CI/CD pipelines.
                """;

        long projectId = createProject(token, "Junior Java Backend Developer", description, "[\"\"]");

        String cvText = """
                Test Automation Engineer with Java basics, Selenium, Playwright, RestAssured, Postman, Jira,
                GitHub Actions, SQL basics, bug reporting, test case design, and API testing experience.
                Built automated UI tests and API test scenarios for web and banking applications.
                """;

        MvcResult result = mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"QA Candidate",
                                  "role":"Test Automation Engineer",
                                  "cv_text":%s
                                }
                                """.formatted(objectMapper.writeValueAsString(cvText))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.match", lessThan(80)))
                .andReturn();

        JsonNode candidate = objectMapper.readTree(result.getResponse().getContentAsString());
        assertEquals("Stretched", claimStatus(candidate, "Develop and maintain backend services using Java and Spring Boot."));
        assertEquals("Unsupported", claimStatus(candidate, "Practical experience with Spring Boot."));
        assertEquals("Unsupported", claimStatus(candidate, "Familiarity with JPA / Hibernate."));
        assertEquals("Supported", claimStatus(candidate, "Ability to test APIs using Postman, Swagger, JUnit, or similar tools."));
    }

    @Test
    void candidateCanBeReanalyzedInPlaceWithCurrentScoringRules() throws Exception {
        String token = register("hiring_reanalyze");
        long projectId = createProject(token, "Backend Refresh Role", "Requirements:\n- Practical experience with Spring Boot.\n- Familiarity with JPA / Hibernate.", "[\"\"]");

        MvcResult created = mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"Refresh Candidate",
                                  "role":"QA Engineer",
                                  "cv_text":"QA automation with Java basics, Postman, RestAssured, and GitHub Actions."
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        JsonNode before = objectMapper.readTree(created.getResponse().getContentAsString());
        long candidateId = before.get("id").asLong();

        MvcResult refreshed = mockMvc.perform(post("/api/projects/" + projectId + "/candidates/" + candidateId + "/reanalyze")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value((int) candidateId))
                .andReturn();

        JsonNode after = objectMapper.readTree(refreshed.getResponse().getContentAsString());
        assertEquals("Unsupported", claimStatus(after, "Practical experience with Spring Boot."));
        assertEquals("Unsupported", claimStatus(after, "Familiarity with JPA / Hibernate."));
    }


    @Test
    void candidateUploadAcceptsTextFilesAndRejectsUnsupportedResumeTypes() throws Exception {
        String token = register("hiring_upload");
        long projectId = createProject(token, "Upload Role", "Requirements:\n- Java\n- React",
                "[\"Java\", \"React\"]");

        MockMultipartFile resume = new MockMultipartFile(
                "resume",
                "candidate.txt",
                MediaType.TEXT_PLAIN_VALUE,
                "Java Spring Boot React GitHub @candidate_handle".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/projects/" + projectId + "/candidates/upload")
                        .file(resume)
                        .param("name", "Upload Candidate")
                        .param("role", "Full Stack Engineer")
                        .header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resume_filename").value("candidate.txt"))
                .andExpect(jsonPath("$.cv_text").value(containsString("Spring Boot")));

        MockMultipartFile unsupported = new MockMultipartFile(
                "resume",
                "candidate.html",
                MediaType.TEXT_HTML_VALUE,
                "<html>no</html>".getBytes(StandardCharsets.UTF_8));

        mockMvc.perform(multipart("/api/projects/" + projectId + "/candidates/upload")
                        .file(unsupported)
                        .header("X-User-Token", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Upload a PDF, DOCX, or TXT resume."));
    }

    @Test
    void projectAndCandidateReadsAreScopedToOwner() throws Exception {
        String ownerToken = register("hiring_owner");
        String otherToken = register("hiring_other");
        long projectId = createProject(ownerToken, "Private Role", "Requirements:\n- Java", "[\"Java\"]");

        MvcResult candidate = mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"Private Candidate",
                                  "role":"Engineer",
                                  "cv_text":"Java and Spring Boot"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long candidateId = objectMapper.readTree(candidate.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/projects/" + projectId).header("X-User-Token", otherToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Project not found"));

        mockMvc.perform(get("/api/projects/" + projectId + "/candidates/" + candidateId)
                        .header("X-User-Token", otherToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Candidate not found"));
    }

    @Test
    void signalTraceOnlyRunsForStrictWarAiAndReturnsExtractedEvidence() throws Exception {
        String token = register("hiring_osint");
        long projectId = createProject(token, "OSINT Role", "Requirements:\n- GitHub portfolio", "[\"GitHub portfolio\"]");

        MvcResult candidate = mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"OSINT Candidate",
                                  "role":"Engineer",
                                  "cv_text":"Portfolio https://example.com/osint and public handle @osint_candidate."
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();

        long candidateId = objectMapper.readTree(candidate.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/projects/" + projectId + "/candidates/" + candidateId + "/osint/run")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"person-ai\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("SignalTrace OSINT is only available in WAR_AI State."));

        mockMvc.perform(post("/api/projects/" + projectId + "/candidates/" + candidateId + "/osint/run")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"strict-war-ai\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("strict-war-ai"))
                .andExpect(jsonPath("$.discoveredLinks", hasItem("https://example.com/osint")))
                .andExpect(jsonPath("$.discoveredUsernames", hasItem("osint_candidate")))
                .andExpect(jsonPath("$.sources", hasSize(greaterThan(1))));
    }

    private String register(String label) throws Exception {
        String username = label + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName":"Hiring Test User",
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

    private long createProject(String token, String title, String description, String requirementsJson) throws Exception {
        MvcResult result = mockMvc.perform(post("/api/projects")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(projectPayload(title, description, requirementsJson)))
                .andExpect(status().isOk())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private String projectPayload(String title, String description, String requirementsJson) throws Exception {
        return """
                {
                  "title":%s,
                  "department":"Engineering",
                  "location":"Remote",
                  "description":%s,
                  "requirements":%s,
                  "state":"WAR+AI State",
                  "status":"Screening"
                }
                """.formatted(objectMapper.writeValueAsString(title), objectMapper.writeValueAsString(description), requirementsJson);
    }

    private String token(MvcResult result) throws Exception {
        JsonNode node = objectMapper.readTree(result.getResponse().getContentAsString());
        return node.get("token").asText();
    }

    private String claimStatus(JsonNode candidate, String claim) {
        for (JsonNode row : candidate.get("claims")) {
            if (claim.equals(row.get(0).asText())) {
                return row.get(1).asText();
            }
        }
        throw new AssertionError("Claim not found: " + claim);
    }
}
