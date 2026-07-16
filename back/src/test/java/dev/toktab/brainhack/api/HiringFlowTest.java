package dev.toktab.brainhack.api;

import static org.hamcrest.Matchers.blankOrNullString;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.greaterThan;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.lessThan;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.charset.StandardCharsets;
import java.util.Map;
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

        mockMvc.perform(get("/api/projects")
                        .header("Authorization", "Bearer fake-session-token"))
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

        MvcResult created = mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
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
                .andExpect(jsonPath("$.unsupported").value(0))
                .andReturn();

        JsonNode saved = objectMapper.readTree(created.getResponse().getContentAsString());
        long candidateId = saved.get("id").asLong();
        int savedScore = saved.get("score").asInt();
        int savedMatch = saved.get("match").asInt();

        mockMvc.perform(get("/api/projects/" + projectId + "/candidates/" + candidateId)
                        .header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(savedScore))
                .andExpect(jsonPath("$.match").value(savedMatch))
                .andExpect(jsonPath("$.risk").value(saved.get("risk").asText()))
                .andExpect(jsonPath("$.claims.length()", greaterThan(8)));
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

        MvcResult uploadResult = mockMvc.perform(multipart("/api/projects/" + projectId + "/candidates/upload")
                        .file(resume)
                        .param("name", "Upload Candidate")
                        .param("role", "Full Stack Engineer")
                        .header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.resume_filename").value("candidate.txt"))
                .andExpect(jsonPath("$.cv_text").value(containsString("Spring Boot")))
                .andExpect(jsonPath("$.score", greaterThan(8)))
                .andExpect(jsonPath("$.match", greaterThan(12)))
                .andReturn();

        JsonNode uploaded = objectMapper.readTree(uploadResult.getResponse().getContentAsString());
        mockMvc.perform(get("/api/projects/" + projectId + "/candidates/" + uploaded.get("id").asLong())
                        .header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.score").value(uploaded.get("score").asInt()))
                .andExpect(jsonPath("$.match").value(uploaded.get("match").asInt()))
                .andExpect(jsonPath("$.risk").value(uploaded.get("risk").asText()))
                .andExpect(jsonPath("$.supported").value(uploaded.get("supported").asInt()))
                .andExpect(jsonPath("$.claims.length()", greaterThan(0)));

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
    void oversizedCandidateResumeIsRejectedBeforeDocumentParsing() throws Exception {
        String token = register("hiring_large_resume");
        long projectId = createProject(token, "Upload Limit Role", "Requirements:\n- Java", "[\"Java\"]");
        MockMultipartFile oversized = new MockMultipartFile(
                "resume",
                "oversized.txt",
                MediaType.TEXT_PLAIN_VALUE,
                new byte[(8 * 1024 * 1024) + 1]);

        mockMvc.perform(multipart("/api/projects/" + projectId + "/candidates/upload")
                        .file(oversized)
                        .param("name", "Oversized Candidate")
                        .param("role", "Engineer")
                        .header("X-User-Token", token))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Resume is too large. Upload a PDF, DOCX, or TXT file no larger than 8 MB."));
    }

    @Test
    void candidatesCanBeListedWithOffsetLimitAndTotal() throws Exception {
        String token = register("hiring_candidate_page");
        long projectId = createProject(token, "Paged Candidate Role", "Requirements:\n- Java", "[\"Java\"]");

        for (int i = 1; i <= 3; i++) {
            mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                            .header("X-User-Token", token)
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""
                                    {
                                      "name":"Candidate %s",
                                      "role":"Engineer",
                                      "cv_text":"Java backend work."
                                    }
                                    """.formatted(i)))
                    .andExpect(status().isOk());
        }

        mockMvc.perform(get("/api/projects/" + projectId + "/candidates")
                        .param("offset", "1")
                        .param("limit", "1")
                        .header("X-User-Token", token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.offset").value(1))
                .andExpect(jsonPath("$.limit").value(1))
                .andExpect(jsonPath("$.total").value(3))
                .andExpect(jsonPath("$.items.length()").value(1));
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
    void projectInvitesGrantTeamAccessAndReviewerNotesKeepDecisionHistory() throws Exception {
        Path messageLog = Path.of("target/test-message-log.txt");
        Files.deleteIfExists(messageLog);
        String ownerToken = register("invite_owner");
        String reviewerEmail = "reviewer_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "@example.com";
        String reviewerToken = registerWithEmail("invite_reviewer", reviewerEmail);
        long projectId = createProject(ownerToken, "Shared Role", "Requirements:\n- Java", "[\"Java\"]");

        MvcResult invite = mockMvc.perform(post("/api/projects/" + projectId + "/invites")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":%s,
                                  "role":"REVIEWER"
                                }
                                """.formatted(objectMapper.writeValueAsString(reviewerEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("PENDING"))
                .andReturn();
        String inviteToken = objectMapper.readTree(invite.getResponse().getContentAsString()).get("token").asText();

        mockMvc.perform(get("/api/messages").header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("PROJECT_INVITE"))
                .andExpect(jsonPath("$[0].to").value(reviewerEmail))
                .andExpect(jsonPath("$[0].invite_status").value("PENDING"))
                .andExpect(jsonPath("$[0].invite_token").value(inviteToken));

        mockMvc.perform(post("/api/projects/invites/accept")
                        .header("X-User-Token", reviewerToken)
                        .param("token", inviteToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ACCEPTED"));

        mockMvc.perform(get("/api/projects").header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value((int) projectId))
                .andExpect(jsonPath("$[0].title").value("Shared Role"))
                .andExpect(jsonPath("$[0].my_role").value("Reviewer"))
                .andExpect(jsonPath("$[0].my_permissions", hasItem("canAddNote")))
                .andExpect(jsonPath("$[0].my_permissions", not(hasItem("canInvite"))));

        mockMvc.perform(post("/api/projects/" + projectId + "/invites")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":"blocked-reviewer-invite@example.com",
                                  "role":"REVIEWER"
                                }
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Project permission required: canInvite"));

        mockMvc.perform(get("/api/projects/" + projectId + "/members").header("X-User-Token", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.source == 'OWNER')].permissions").exists())
                .andExpect(jsonPath("$[?(@.email == '" + reviewerEmail + "')]").exists())
                .andExpect(jsonPath("$[?(@.email == '" + reviewerEmail + "')].status").value(hasItem("ACTIVE")))
                .andExpect(jsonPath("$[?(@.email == '" + reviewerEmail + "')].permissions").exists());

        MvcResult candidate = mockMvc.perform(post("/api/projects/" + projectId + "/candidates")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name":"Shared Candidate",
                                  "role":"Engineer",
                                  "cv_text":"Java and Spring Boot"
                                }
                                """))
                .andExpect(status().isOk())
                .andReturn();
        long candidateId = objectMapper.readTree(candidate.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(post("/api/projects/" + projectId + "/candidates/" + candidateId + "/votes")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "action":"UPVOTE",
                                  "score":4.5
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.vote_summary.average").value("4.5"))
                .andExpect(jsonPath("$.vote_summary.attribution", hasItem(containsString("upvote 4.5/5"))));

        mockMvc.perform(post("/api/projects/" + projectId + "/candidates/" + candidateId + "/votes")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"action\":\"UPVOTE\",\"score\":4.3}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Upvote score must be between 0.5 and 5 in 0.5 increments"));

        mockMvc.perform(patch("/api/projects/" + projectId + "/candidates/" + candidateId + "/status")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"OnInterview\"}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Project permission required: canSetInterview"));

        mockMvc.perform(patch("/api/projects/" + projectId + "/candidates/" + candidateId + "/status")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"status\":\"OnInterview\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OnInterview"))
                .andExpect(jsonPath("$.activity[0].action").value("changed status to OnInterview"));

        mockMvc.perform(get("/api/projects/" + projectId + "/candidates/" + candidateId + "/workflow")
                        .header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("OnInterview"))
                .andExpect(jsonPath("$.vote_summary.my_vote").value("UPVOTE"))
                .andExpect(jsonPath("$.vote_summary.my_score").value(4.5));

        mockMvc.perform(post("/api/projects/" + projectId + "/candidates/" + candidateId + "/notes")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type":"DECISION",
                                  "decision":"INTERVIEW",
                                  "body":"Move forward after manual reviewer check."
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.decision").value("INTERVIEW"));

        mockMvc.perform(get("/api/projects/" + projectId + "/candidates/" + candidateId + "/notes")
                        .header("X-User-Token", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].body").value(containsString("Move forward")));

        mockMvc.perform(post("/api/messages")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "to":%s,
                                  "subject":"Manual message",
                                  "body":"Hi from owner"
                                }
                                """.formatted(objectMapper.writeValueAsString(reviewerEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.to").value(reviewerEmail));

        mockMvc.perform(get("/api/messages").header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].subject").value("Manual message"))
                .andExpect(jsonPath("$[0].body").value("Hi from owner"))
                .andExpect(jsonPath("$[0].read").value(false))
                .andExpect(jsonPath("$[0].starred").value(false));

        long messageId = objectMapper.readTree(mockMvc.perform(get("/api/messages").header("X-User-Token", reviewerToken))
                        .andReturn().getResponse().getContentAsString()).get(0).get("id").asLong();

        mockMvc.perform(patch("/api/messages/" + messageId)
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "read":true,
                                  "starred":true
                                }
                                """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.read").value(true))
                .andExpect(jsonPath("$.starred").value(true))
                .andExpect(jsonPath("$.read_at").isNotEmpty());

        mockMvc.perform(post("/api/messages")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "to":%s,
                                  "subject":"Re: Manual message",
                                  "body":"Reply with candidate package",
                                  "reply_to_message_id":%d,
                                  "forwarded_from_message_id":%d,
                                  "candidate_attachments":[{
                                    "candidate_id":%d,
                                    "project_id":%d,
                                    "name":"Shared Candidate",
                                    "role":"Engineer",
                                    "project_title":"Shared Role",
                                    "score":75
                                  }]
                                }
                                """.formatted(objectMapper.writeValueAsString(reviewerEmail), messageId, messageId, candidateId, projectId)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.reply_to_message_id").value((int) messageId))
                .andExpect(jsonPath("$.forwarded_from_message_id").value((int) messageId))
                .andExpect(jsonPath("$.delivery_status").value("SENT"))
                .andExpect(jsonPath("$.candidate_attachments[0].candidate_id").value((int) candidateId));

        mockMvc.perform(get("/api/messages").header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.subject == 'Manual message')].read").value(hasItem(true)))
                .andExpect(jsonPath("$[?(@.subject == 'Manual message')].starred").value(hasItem(true)))
                .andExpect(jsonPath("$[?(@.subject == 'Re: Manual message')].reply_to_message_id").value(hasItem((int) messageId)))
                .andExpect(jsonPath("$[?(@.subject == 'Re: Manual message')].candidate_attachments[0].name").value(hasItem("Shared Candidate")));

        mockMvc.perform(post("/api/projects/" + projectId + "/activity")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type":"candidate_view",
                                  "action":"opened candidate profile",
                                  "candidate_id":%d,
                                  "candidate_name":"Shared Candidate",
                                  "severity":"info",
                                  "detail":"Candidate detail viewed"
                                }
                                """.formatted(candidateId)))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + projectId + "/candidates/" + candidateId + "/workflow")
                        .header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.activity[?(@.action == 'added reviewer note: INTERVIEW')]").exists())
                .andExpect(jsonPath("$.activity[?(@.action == 'Sent candidate package to " + reviewerEmail + "')]").exists())
                .andExpect(jsonPath("$.activity[?(@.action == 'opened candidate profile')]").exists());

        String log = Files.readString(messageLog);
        org.assertj.core.api.Assertions.assertThat(log)
                .contains("type=PROJECT_INVITE")
                .contains("to_email=" + reviewerEmail)
                .contains("subject=Invitation to Shared Role")
                .contains("project_title=Shared Role")
                .contains("invite_status=PENDING")
                .contains("type=MESSAGE")
                .contains("subject=Manual message")
                .contains("body=Hi from owner")
                .contains("from_username=invite_owner")
                .contains("--- MESSAGE UPDATED ---")
                .contains("read=true")
                .contains("starred=true");
    }

    @Test
    void transferredHeadAdminCanDeleteProject() throws Exception {
        String ownerToken = register("transfer_owner");
        String reviewerEmail = "transfer_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "@example.com";
        String reviewerToken = registerWithEmail("transfer_reviewer", reviewerEmail);
        long projectId = createProject(ownerToken, "Transfer Delete Role", "Requirements:\n- Java", "[\"Java\"]");

        MvcResult invite = mockMvc.perform(post("/api/projects/" + projectId + "/invites")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":%s,
                                  "role":"REVIEWER"
                                }
                                """.formatted(objectMapper.writeValueAsString(reviewerEmail))))
                .andExpect(status().isOk())
                .andReturn();

        mockMvc.perform(post("/api/projects/invites/accept")
                        .header("X-User-Token", reviewerToken)
                        .param("token", objectMapper.readTree(invite.getResponse().getContentAsString()).get("token").asText()))
                .andExpect(status().isOk());

        mockMvc.perform(delete("/api/projects/" + projectId)
                        .header("X-User-Token", reviewerToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Project Head Admin permissions required"));

        mockMvc.perform(patch("/api/projects/" + projectId + "/members/role")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":%s,
                                  "role":"Head Admin"
                                }
                                """.formatted(objectMapper.writeValueAsString(reviewerEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.email == '" + reviewerEmail + "')].role").value(hasItem("Head Admin")))
                .andExpect(jsonPath("$[?(@.email == '" + reviewerEmail + "')].protected_member").value(hasItem(true)));

        mockMvc.perform(get("/api/projects").header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value((int) projectId))
                .andExpect(jsonPath("$[0].my_role").value("Head Admin"))
                .andExpect(jsonPath("$[0].my_permissions", hasItem("protectedAccount")));

        mockMvc.perform(delete("/api/projects/" + projectId)
                        .header("X-User-Token", reviewerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + projectId).header("X-User-Token", reviewerToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Project not found"));
    }

    @Test
    void acceptedInviteIsProjectScopedAndCustomPermissionsAreAuthoritative() throws Exception {
        String ownerToken = register("permission_owner");
        String memberEmail = "permission_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10) + "@example.com";
        String memberToken = registerWithEmail("permission_member", memberEmail);
        long sharedProjectId = createProject(ownerToken, "Scoped Shared Role", "Requirements:\n- Java", "[\"Java\"]");
        long privateProjectId = createProject(ownerToken, "Owner Only Role", "Requirements:\n- SQL", "[\"SQL\"]");

        MvcResult invite = mockMvc.perform(post("/api/projects/" + sharedProjectId + "/invites")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"email":%s,"role":"REVIEWER"}
                                """.formatted(objectMapper.writeValueAsString(memberEmail))))
                .andExpect(status().isOk())
                .andReturn();

        mockMvc.perform(post("/api/projects/invites/accept")
                        .header("X-User-Token", memberToken)
                        .param("token", objectMapper.readTree(invite.getResponse().getContentAsString()).get("token").asText()))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects").header("X-User-Token", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$", hasSize(1)))
                .andExpect(jsonPath("$[0].id").value((int) sharedProjectId));

        mockMvc.perform(get("/api/projects/" + privateProjectId).header("X-User-Token", memberToken))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Project not found"));

        mockMvc.perform(patch("/api/projects/" + sharedProjectId + "/members/permissions")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "email":%s,
                                  "role":"Custom",
                                  "permissions":["canView","canInvite","canTeamManage"]
                                }
                                """.formatted(objectMapper.writeValueAsString(memberEmail))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$['" + memberEmail + "']", hasItem("canInvite")));

        mockMvc.perform(get("/api/projects").header("X-User-Token", memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].my_role").value("Custom"))
                .andExpect(jsonPath("$[0].my_permissions", hasItem("canInvite")))
                .andExpect(jsonPath("$[0].my_permissions", hasItem("canTeamManage")));

        mockMvc.perform(post("/api/projects/" + sharedProjectId + "/invites")
                        .header("X-User-Token", memberToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\":\"custom-invite@example.com\",\"role\":\"VIEWER\"}"))
                .andExpect(status().isOk());
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
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Explicit consent is required before SignalTrace can check public sources."));

        mockMvc.perform(post("/api/projects/" + projectId + "/candidates/" + candidateId + "/osint/run")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"state\":\"strict-war-ai\",\"consent\":true,\"checks\":[\"profile-search\",\"project-scan\"]}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.state").value("strict-war-ai"))
                .andExpect(jsonPath("$.checked_at").isNotEmpty())
                .andExpect(jsonPath("$.consented_checks", hasItem("profile-search")))
                .andExpect(jsonPath("$.consented_checks", hasItem("project-scan")))
                .andExpect(jsonPath("$.discoveredLinks", hasItem("https://example.com/osint")))
                .andExpect(jsonPath("$.discoveredUsernames", hasItem("osint_candidate")))
                .andExpect(jsonPath("$.sources", hasSize(greaterThan(1))));
    }

    @Test
    void candidateMemoryUsesPriorApplicationsFromTheSameOrganization() throws Exception {
        String token = register("hiring_memory");
        long firstProjectId = createProject(token, "Backend Engineer", "Java and Spring", "[\"Java\",\"Spring\"]");
        long secondProjectId = createProject(token, "Platform Engineer", "Java and APIs", "[\"Java\",\"REST APIs\"]");
        String cv = "Memory Candidate memory.candidate@example.com built Java Spring REST APIs in production.";

        mockMvc.perform(post("/api/projects/" + firstProjectId + "/candidates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Memory Candidate", "role", "Engineer", "cv_text", cv))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.email").value("memory.candidate@example.com"))
                .andExpect(jsonPath("$.memory").value("No prior record"))
                .andExpect(jsonPath("$.memory_history", hasSize(0)));

        mockMvc.perform(post("/api/projects/" + secondProjectId + "/candidates")
                        .header("X-User-Token", token)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("name", "Memory Candidate", "role", "Engineer", "cv_text", cv))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.memory").value("Returning candidate"))
                .andExpect(jsonPath("$.memory_history", hasSize(1)))
                .andExpect(jsonPath("$.memory_history[0].projectTitle").value("Backend Engineer"));
    }

    @Test
    void projectAnnouncementsResolveMentionsAndEnforcePinDeletePermissions() throws Exception {
        String ownerToken = register("announcement_owner");
        String reviewerEmail = "announcement_reviewer_" + UUID.randomUUID().toString().replace("-", "").substring(0, 8) + "@example.com";
        String reviewerToken = registerWithEmail("announcement_reviewer", reviewerEmail);
        JsonNode reviewer = objectMapper.readTree(mockMvc.perform(get("/api/auth/me").header("X-User-Token", reviewerToken))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString());
        String reviewerUsername = reviewer.get("username").asText();
        long projectId = createProject(ownerToken, "Announcement Role", "Requirements:\n- Java", "[\"Java\"]");

        MvcResult invite = mockMvc.perform(post("/api/projects/" + projectId + "/invites")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("email", reviewerEmail, "role", "REVIEWER"))))
                .andExpect(status().isOk())
                .andReturn();
        String inviteToken = objectMapper.readTree(invite.getResponse().getContentAsString()).get("token").asText();
        mockMvc.perform(post("/api/projects/invites/accept").header("X-User-Token", reviewerToken).param("token", inviteToken))
                .andExpect(status().isOk());

        MvcResult created = mockMvc.perform(post("/api/projects/" + projectId + "/announcements")
                        .header("X-User-Token", ownerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of(
                                "body", "@" + reviewerUsername + " please review the shortlist before Friday.",
                                "pinned", true))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinned").value(true))
                .andExpect(jsonPath("$.mentions", hasItem("@" + reviewerUsername)))
                .andReturn();
        long announcementId = objectMapper.readTree(created.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/projects/" + projectId + "/announcements").header("X-User-Token", reviewerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value((int) announcementId))
                .andExpect(jsonPath("$[0].pinned").value(true));

        mockMvc.perform(patch("/api/projects/" + projectId + "/announcements/" + announcementId)
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"pinned\":false}"))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.message").value("Project Head Admin permissions required"));

        MvcResult reviewerPost = mockMvc.perform(post("/api/projects/" + projectId + "/announcements")
                        .header("X-User-Token", reviewerToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"body\":\"Review complete. Two candidates need evidence follow-up.\",\"pinned\":false}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.pinned").value(false))
                .andReturn();
        long reviewerAnnouncementId = objectMapper.readTree(reviewerPost.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(delete("/api/projects/" + projectId + "/announcements/" + reviewerAnnouncementId)
                        .header("X-User-Token", ownerToken))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/projects/" + projectId + "/activity").header("X-User-Token", ownerToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.type == 'announcement')]").exists())
                .andExpect(jsonPath("$[?(@.type == 'announcement_delete')]").exists());
    }

    private String register(String label) throws Exception {
        String username = label + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        return registerWithEmail(username, username + "@example.com");
    }

    private String registerWithEmail(String label, String email) throws Exception {
        String username = label + "_" + UUID.randomUUID().toString().replace("-", "").substring(0, 10);
        MvcResult result = mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "fullName":"Hiring Test User",
                                  "username":"%s",
                                  "email":"%s",
                                  "country":"Georgia",
                                  "address":"Test address",
                                  "organization":"QA",
                                  "role":"Tester",
                                  "password":"password123"
                                }
                                """.formatted(username, email)))
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
