package dev.toktab.brainhack.qa;

import static org.junit.platform.engine.discovery.DiscoverySelectors.selectClass;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.stream.Collectors;
import org.junit.platform.launcher.Launcher;
import org.junit.platform.launcher.LauncherDiscoveryRequest;
import org.junit.platform.launcher.TestExecutionListener;
import org.junit.platform.launcher.TestPlan;
import org.junit.platform.launcher.core.LauncherDiscoveryRequestBuilder;
import org.junit.platform.launcher.core.LauncherFactory;
import org.junit.platform.launcher.listeners.SummaryGeneratingListener;
import org.junit.platform.launcher.listeners.TestExecutionSummary;
import org.testng.Assert;
import org.testng.annotations.Test;

public class FullAutomationTestNgSuite {
    private static final Duration COMMAND_TIMEOUT = Duration.ofMinutes(15);
    private static final List<String> JUNIT_TEST_CLASSES = List.of(
            "dev.toktab.brainhack.BrainhackApplicationTests",
            "dev.toktab.brainhack.api.AuthAuditAdminFlowTest",
            "dev.toktab.brainhack.api.HiringFlowTest",
            "dev.toktab.brainhack.audit.CheckStateAnalyzerRoutingTest",
            "dev.toktab.brainhack.audit.LlmAuditAnalyzerSchemaTest",
            "dev.toktab.brainhack.audit.ScoringServiceTest",
            "dev.toktab.brainhack.audit.SentenceSplitterTest",
            "dev.toktab.brainhack.audit.ServiceLayerBehaviorTest"
    );

    @Test(description = "Runs all backend JUnit/Spring regression tests")
    public void runBackendJUnitRegressionTests() {
        SummaryGeneratingListener listener = new SummaryGeneratingListener();
        LauncherDiscoveryRequest request = LauncherDiscoveryRequestBuilder.request()
                .selectors(JUNIT_TEST_CLASSES.stream().map(FullAutomationTestNgSuite::loadTestClass).map(testClass -> selectClass(testClass)).toList())
                .build();

        Launcher launcher = LauncherFactory.create();
        launcher.registerTestExecutionListeners(listener, new ConsoleJUnitProgressListener());
        launcher.execute(request);

        TestExecutionSummary summary = listener.getSummary();
        System.out.printf(
                "[VERDICT TESTNG] Backend JUnit summary: found=%d, succeeded=%d, failed=%d, skipped=%d%n",
                summary.getTestsFoundCount(),
                summary.getTestsSucceededCount(),
                summary.getTestsFailedCount(),
                summary.getTestsSkippedCount()
        );
        if (summary.getTestsFailedCount() > 0) {
            String failures = summary.getFailures().stream()
                    .map(failure -> failure.getTestIdentifier().getDisplayName() + ": " + failure.getException())
                    .collect(Collectors.joining(System.lineSeparator()));
            Assert.fail("Backend JUnit regression failed:" + System.lineSeparator() + failures);
        }
        Assert.assertTrue(summary.getTestsSucceededCount() > 0, "Expected backend JUnit tests to run.");
    }

    @Test(
            description = "Runs all Playwright browser/API automation and generates Allure report",
            dependsOnMethods = "runBackendJUnitRegressionTests"
    )
    public void runPlaywrightAutomationWithAllure() throws IOException, InterruptedException {
        Path frontDir = Path.of("front").toAbsolutePath().normalize();
        Assert.assertTrue(Files.isDirectory(frontDir), "front directory should exist at " + frontDir);

        runCommand(frontDir, List.of("npm.cmd", "run", "e2e:allure"));
        runCommand(frontDir, List.of("npm.cmd", "run", "allure:generate"));

        Path allureReport = frontDir.resolve("allure-report").resolve("index.html");
        Assert.assertTrue(Files.exists(allureReport), "Expected Allure report at " + allureReport);
        System.out.println("[VERDICT TESTNG] Allure report generated: " + allureReport);
    }

    private static void runCommand(Path workingDirectory, List<String> command) throws IOException, InterruptedException {
        System.out.println("[VERDICT TESTNG] Running: " + String.join(" ", command));
        ProcessBuilder builder = new ProcessBuilder(command)
                .directory(workingDirectory.toFile())
                .redirectErrorStream(true);
        Process process = builder.start();
        String output;
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
            output = reader.lines().peek(System.out::println).collect(Collectors.joining(System.lineSeparator()));
        }
        boolean finished = process.waitFor(COMMAND_TIMEOUT.toSeconds(), TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            Assert.fail("Command timed out after " + COMMAND_TIMEOUT.toMinutes() + " minutes: " + String.join(" ", command));
        }
        if (process.exitValue() != 0) {
            Assert.fail("Command failed with exit code " + process.exitValue()
                    + ": " + String.join(" ", command)
                    + System.lineSeparator()
                    + output);
        }
    }

    private static Class<?> loadTestClass(String className) {
        try {
            return Class.forName(className);
        } catch (ClassNotFoundException exception) {
            throw new IllegalStateException("JUnit test class not found: " + className, exception);
        }
    }

    private static class ConsoleJUnitProgressListener implements TestExecutionListener {
        @Override
        public void testPlanExecutionStarted(TestPlan testPlan) {
            System.out.println("[VERDICT TESTNG] Starting backend JUnit tests: " + testPlan.countTestIdentifiers(identifier -> identifier.isTest()));
        }
    }
}
