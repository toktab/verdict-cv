package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.LoginRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import jakarta.transaction.Transactional;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpServletRequest;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@SpringBootTest
@Transactional
class ServiceLayerBehaviorTest {
    @Autowired
    private UserSessionService sessionService;

    @Autowired
    private AuditService auditService;

    @Test
    void authSessionLoginAndMeReturnsRegisteredUser() {
        RegisterRequest request = new RegisterRequest(
                "Service Tester",
                "service_tester",
                "service@example.com",
                "Georgia",
                "12 Test Street",
                "VERDICT",
                "Analyst",
                "password1");

        UserSessionService.SessionResult registered = sessionService.register(request);
        UserSessionService.SessionResult loggedIn = sessionService.login(new LoginRequest("service_tester", "password1"));

        assertThat(registered.token()).isNotBlank();
        assertThat(loggedIn.token()).isNotBlank();
        assertThat(sessionService.me(loggedIn.token()).getEmail()).isEqualTo("service@example.com");
    }

    @Test
    void auditOwnershipPreventsOtherUsersFromOpeningAudit() {
        UserAccount owner = sessionService.register(user("owner_user", "owner@example.com")).account();
        UserAccount other = sessionService.register(user("other_user", "other@example.com")).account();
        Audit audit = auditService.run(auditRequest(), new MockHttpServletRequest(), owner);

        assertThat(auditService.getForUser(audit.getId(), owner).getId()).isEqualTo(audit.getId());
        assertThat(audit.getStatus()).isEqualTo(AuditStatus.COMPLETED);
        assertThatThrownBy(() -> auditService.getForUser(audit.getId(), other))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("Audit not found");
    }

    @Test
    void auditServiceNormalizesEvidencePointersToAvailableEvidence() {
        UserAccount owner = sessionService.register(user("evidence_user", "evidence@example.com")).account();
        Audit audit = auditService.run(auditRequest(), new MockHttpServletRequest(), owner);

        assertThat(audit.getStatus()).isEqualTo(AuditStatus.COMPLETED);
        assertThat(audit.getVerdicts()).isNotEmpty();
        assertThat(audit.getVerdicts())
                .anySatisfy(verdict -> {
                    assertThat(verdict.getSentence()).contains("Spring Boot");
                    assertThat(verdict.getEvidencePointer()).containsIgnoringCase("Spring Boot");
                });
    }

    @Test
    void templateUnimportantRulesMarkContactRowsAsNotClaims() {
        UserAccount owner = sessionService.register(user("template_rules_user", "template-rules@example.com")).account();
        Audit audit = auditService.run(new AuditRunRequest(
                "Candidate CV",
                "Job Evidence",
                "toktabbusiness@gmail.com. https://linkedin.com/in/toktab. Built REST APIs with Spring Boot and MySQL.",
                "The candidate built REST APIs with Spring Boot and MySQL.",
                "cv",
                "default-cv",
                "war"), new MockHttpServletRequest(), owner);

        assertThat(audit.getVerdicts())
                .filteredOn(verdict -> verdict.getSentence().contains("@") || verdict.getSentence().contains("linkedin"))
                .allSatisfy(verdict -> assertThat(verdict.getStatus()).isEqualTo(VerdictStatus.NOT_A_CLAIM));
    }

    @Test
    void blankTemplateIdFallsBackToDefaultForAuditMode() {
        UserAccount owner = sessionService.register(user("sales_template_user", "sales-template@example.com")).account();
        Audit audit = auditService.run(new AuditRunRequest(
                "Sales Page",
                "Sales Evidence",
                "The platform reduces intake time by 30 percent. Contact sales@example.com for a demo.",
                "The product case study says intake time fell by 30 percent.",
                "sales",
                "",
                "light"), new MockHttpServletRequest(), owner);

        assertThat(audit.getTemplateId()).isEqualTo("default-sales");
        assertThat(audit.getTemplateName()).isEqualTo("Sales Claim Whitezone");
    }

    @Test
    void localAnalyzerTreatsMismatchedNumbersAsStretched() {
        UserAccount owner = sessionService.register(user("number_match_user", "number-match@example.com")).account();
        Audit audit = auditService.run(new AuditRunRequest(
                "Sales Proof",
                "Case Study",
                "The platform reduced intake time by 40 percent.",
                "The case study says the platform reduced intake time by 30 percent.",
                "sales",
                "",
                "war"), new MockHttpServletRequest(), owner);

        assertThat(audit.getVerdicts())
                .first()
                .satisfies(verdict -> {
                    assertThat(verdict.getStatus()).isEqualTo(VerdictStatus.STRETCHED);
                    assertThat(verdict.getExplanation()).contains("same number");
                });
    }

    @Test
    void localAnalyzerTreatsContradictoryEvidenceAsStretched() {
        UserAccount owner = sessionService.register(user("contradiction_user", "contradiction@example.com")).account();
        Audit audit = auditService.run(new AuditRunRequest(
                "Delivery Proof",
                "Reference",
                "The team delivered the migration in March.",
                "The reference says the team did not deliver the migration in March.",
                "report",
                "",
                "war"), new MockHttpServletRequest(), owner);

        assertThat(audit.getVerdicts())
                .first()
                .satisfies(verdict -> {
                    assertThat(verdict.getStatus()).isEqualTo(VerdictStatus.STRETCHED);
                    assertThat(verdict.getExplanation()).contains("contradict");
                });
    }

    private RegisterRequest user(String username, String email) {
        return new RegisterRequest("Service User", username, email, "Georgia", "12 Test Street", "VERDICT", "Analyst", "password1");
    }

    private AuditRunRequest auditRequest() {
        return new AuditRunRequest(
                "Candidate CV",
                "Job Evidence",
                "Built REST APIs with Spring Boot and MySQL. Optimized cloud costs by 60 percent.",
                "The candidate built REST APIs with Spring Boot and MySQL. No evidence mentions cloud cost optimization.",
                "cv",
                "default-cv",
                "war");
    }
}
