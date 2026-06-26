package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import jakarta.transaction.Transactional;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@SpringBootTest
@Transactional
class CheckStateAnalyzerRoutingTest {
    @Autowired
    private UserSessionService sessionService;

    @Autowired
    private AuditService auditService;

    @MockBean
    private LlmAuditAnalyzer llmAuditAnalyzer;

    @Test
    void warStateAlwaysUsesLocalAnalyzerEvenWhenLlmIsConfigured() {
        when(llmAuditAnalyzer.configured()).thenReturn(true);
        UserAccount owner = sessionService.register(user("war_state_user", "war-state@example.com")).account();

        Audit audit = auditService.run(request("war"), new MockHttpServletRequest(), owner);

        assertThat(audit.getEngine()).isEqualTo("LOCAL_HEURISTIC");
        verify(llmAuditAnalyzer, never()).analyze(anyList(), anyString());
    }

    @Test
    void lightStateAlwaysUsesLocalAnalyzerEvenWhenLlmIsConfigured() {
        when(llmAuditAnalyzer.configured()).thenReturn(true);
        UserAccount owner = sessionService.register(user("light_state_user", "light-state@example.com")).account();

        Audit audit = auditService.run(request("light"), new MockHttpServletRequest(), owner);

        assertThat(audit.getEngine()).isEqualTo("LOCAL_HEURISTIC_LIGHT");
        verify(llmAuditAnalyzer, never()).analyze(anyList(), anyString());
    }

    @Test
    void personStateUsesLlmWhenConfigured() {
        when(llmAuditAnalyzer.configured()).thenReturn(true);
        when(llmAuditAnalyzer.analyze(anyList(), anyString())).thenReturn(new AuditAnalysisResult(
                "LLM_TEST_MODEL",
                List.of(new AnalyzedVerdict(
                        0,
                        "Built Spring Boot APIs with MySQL.",
                        VerdictStatus.SUPPORTED,
                        Confidence.HIGH,
                        "model judgment",
                        "The model matched the sentence to the evidence.",
                        "Spring Boot APIs with MySQL."))));
        UserAccount owner = sessionService.register(user("person_state_user", "person-state@example.com")).account();

        Audit audit = auditService.run(request("person"), new MockHttpServletRequest(), owner);

        assertThat(audit.getEngine()).isEqualTo("LLM_TEST_MODEL");
        verify(llmAuditAnalyzer).analyze(anyList(), anyString());
    }

    @Test
    void strictWarAiRunsLocalAndLlmWhenConfigured() {
        when(llmAuditAnalyzer.configured()).thenReturn(true);
        when(llmAuditAnalyzer.analyze(anyList(), anyString())).thenReturn(new AuditAnalysisResult(
                "LLM_TEST_MODEL",
                List.of(new AnalyzedVerdict(
                        0,
                        "Built Spring Boot APIs with MySQL.",
                        VerdictStatus.UNSUPPORTED,
                        Confidence.HIGH,
                        "model judgment",
                        "The model requires stronger evidence.",
                        "No evidence found."))));
        UserAccount owner = sessionService.register(user("strict_state_user", "strict-state@example.com")).account();

        Audit audit = auditService.run(request("strict-war-ai"), new MockHttpServletRequest(), owner);

        assertThat(audit.getEngine()).isEqualTo("LOCAL_HEURISTIC+LLM_TEST_MODEL");
        assertThat(audit.getVerdicts()).first().satisfies(verdict -> {
            assertThat(verdict.getStatus()).isEqualTo(VerdictStatus.UNSUPPORTED);
            assertThat(verdict.getReasonCategory()).isEqualTo("strict local + ai");
        });
        verify(llmAuditAnalyzer).analyze(anyList(), anyString());
    }

    @Test
    void warStateIsLimitedToFiveRunsPerAccountPerWeek() {
        UserAccount owner = sessionService.register(user("war_limit_user", "war-limit@example.com")).account();
        for (int i = 0; i < 5; i++) {
            Audit audit = auditService.run(request("war"), new MockHttpServletRequest(), owner);
            assertThat(audit.getStatus()).isEqualTo(AuditStatus.COMPLETED);
        }

        assertThatThrownBy(() -> auditService.run(request("war"), new MockHttpServletRequest(), owner))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("5 times per week");
    }

    private RegisterRequest user(String username, String email) {
        return new RegisterRequest("State User", username, email, "Georgia", "12 Test Street", "VERDICT", "Analyst", "password1");
    }

    private AuditRunRequest request(String stateId) {
        return new AuditRunRequest(
                "Candidate CV",
                "Job Evidence",
                "Built Spring Boot APIs with MySQL.",
                "The candidate built Spring Boot APIs with MySQL.",
                "default-cv",
                stateId);
    }
}
