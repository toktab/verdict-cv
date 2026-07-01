package dev.toktab.brainhack.audit;

import dev.toktab.brainhack.account.UserAccount;
import dev.toktab.brainhack.account.UserSessionService;
import dev.toktab.brainhack.api.dto.AuditRunRequest;
import dev.toktab.brainhack.api.dto.LoginRequest;
import dev.toktab.brainhack.api.dto.RegisterRequest;
import dev.toktab.brainhack.api.dto.VerdictOverrideRequest;
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

    @Autowired
    private AuditRepository auditRepository;

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
    void refreshRotatesAccessTokenAndRevokesOldSession() {
        UserSessionService.SessionResult registered = sessionService.register(user("refresh_user", "refresh@example.com"));

        UserSessionService.SessionResult refreshed = sessionService.refresh(registered.refreshToken(), new MockHttpServletRequest());

        assertThat(refreshed.token()).isNotBlank().isNotEqualTo(registered.token());
        assertThat(refreshed.refreshToken()).isNotBlank().isNotEqualTo(registered.refreshToken());
        assertThat(sessionService.me(refreshed.token()).getEmail()).isEqualTo("refresh@example.com");
        assertThatThrownBy(() -> sessionService.me(registered.token()))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("User authentication required");
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
    void cancelRunningAuditMarksItCancelledForOwnerOnly() {
        UserAccount owner = sessionService.register(user("cancel_owner", "cancel-owner@example.com")).account();
        UserAccount other = sessionService.register(user("cancel_other", "cancel-other@example.com")).account();
        Audit audit = runningAudit(owner);
        audit = auditRepository.saveAndFlush(audit);
        Long auditId = audit.getId();

        Audit cancelled = auditService.cancel(auditId, owner);

        assertThat(cancelled.getStatus()).isEqualTo(AuditStatus.CANCELLED);
        assertThat(cancelled.isCancellationRequested()).isTrue();
        assertThat(cancelled.getProgressStage()).isEqualTo("cancelled");
        assertThat(cancelled.getProgressPercent()).isEqualTo(100);
        assertThatThrownBy(() -> auditService.cancel(auditId, other))
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
    void manualOverrideCreatesSnapshotAndVerdictProvenance() {
        UserAccount owner = sessionService.register(user("override_user", "override@example.com")).account();
        Audit audit = auditService.run(auditRequest(), new MockHttpServletRequest(), owner);
        Verdict target = audit.getVerdicts().stream()
                .filter(verdict -> verdict.getStatus() == VerdictStatus.UNSUPPORTED || verdict.getStatus() == VerdictStatus.STRETCHED)
                .findFirst()
                .orElse(audit.getVerdicts().get(0));

        Audit overridden = auditService.overrideVerdict(audit.getId(), target.getId(), owner,
                new VerdictOverrideRequest(VerdictStatus.SUPPORTED, "Reviewer verified this claim from a reference call."));

        assertThat(overridden.getVerdicts())
                .filteredOn(verdict -> verdict.getId().equals(target.getId()))
                .singleElement()
                .satisfies(verdict -> {
                    assertThat(verdict.getStatus()).isEqualTo(VerdictStatus.SUPPORTED);
                    assertThat(verdict.getManualOverrideReason()).contains("Reviewer verified");
                    assertThat(verdict.getPromptVersion()).isNotBlank();
                    assertThat(verdict.getAnalyzerVersion()).isNotBlank();
                });
        assertThat(auditService.latestSnapshot(audit.getId(), owner).payloadJson()).contains("Reviewer verified");
    }

    @Test
    void fixedCvJobPromptRegressionKeepsExpectedStatusDistribution() {
        UserAccount owner = sessionService.register(user("prompt_regression_user", "prompt-regression@example.com")).account();
        Audit audit = auditService.run(new AuditRunRequest(
                "Fixed CV",
                "Fixed Job",
                "Built REST APIs with Spring Boot and MySQL. Expert in Kubernetes production recovery. Led payment migration.",
                "The candidate built REST APIs with Spring Boot and MySQL. The reference does not mention Kubernetes or payment migration leadership.",
                "cv",
                "default-cv",
                "war"), new MockHttpServletRequest(), owner);

        assertThat(audit.getSupportedCount()).isGreaterThanOrEqualTo(1);
        assertThat(audit.getStretchedCount() + audit.getUnsupportedCount()).isGreaterThanOrEqualTo(1);
        assertThat(audit.getVerdicts()).allSatisfy(verdict -> {
            assertThat(verdict.getEngine()).isNotBlank();
            assertThat(verdict.getAnalyzerVersion()).isNotBlank();
            assertThat(verdict.getPromptVersion()).isNotBlank();
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

    private Audit runningAudit(UserAccount owner) {
        Audit audit = new Audit();
        audit.setClaimTitle("Queued CV");
        audit.setEvidenceTitle("Queued Evidence");
        audit.setClaimText("Built APIs.");
        audit.setEvidenceText("Evidence pending.");
        audit.setCredibilityScore(0);
        audit.setSupportedCount(0);
        audit.setStretchedCount(0);
        audit.setUnsupportedCount(0);
        audit.setNotClaimCount(0);
        audit.setGapCount(0);
        audit.setClaimFingerprint("claim-fingerprint");
        audit.setEvidenceFingerprint("evidence-fingerprint");
        audit.setProcessingMillis(0);
        audit.setEngine("queued");
        audit.setStatus(AuditStatus.RUNNING);
        audit.setProgressStage("queued");
        audit.setProgressPercent(0);
        audit.setProgressMessage("Queued for analysis.");
        audit.setAnalyzerVersion("test");
        audit.setPromptVersion("test");
        audit.setOwner(owner);
        return audit;
    }
}
