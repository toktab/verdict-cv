package dev.toktab.brainhack.api;

import dev.toktab.brainhack.audit.EvaluationDatasetService;
import dev.toktab.brainhack.audit.EvaluationDatasetService.EvaluationDatasetResponse;
import dev.toktab.brainhack.log.AuditLogService;
import jakarta.servlet.http.HttpServletRequest;
import java.sql.Connection;
import java.util.Map;
import javax.sql.DataSource;
import java.nio.charset.StandardCharsets;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;
import java.security.MessageDigest;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/system")
public class SystemController {
    private final DataSource dataSource;
    private final AuditLogService logService;
    private final EvaluationDatasetService evaluationDatasetService;

    public SystemController(DataSource dataSource, AuditLogService logService, EvaluationDatasetService evaluationDatasetService) {
        this.dataSource = dataSource;
        this.logService = logService;
        this.evaluationDatasetService = evaluationDatasetService;
    }

    @GetMapping("/health")
    public Map<String, Object> health(HttpServletRequest request) throws Exception {
        long started = System.currentTimeMillis();
        try (Connection connection = dataSource.getConnection()) {
            boolean valid = connection.isValid(2);
            String database = connection.getMetaData().getDatabaseProductName();
            logService.record("DB_HEALTH_CHECK", request, 200, System.currentTimeMillis() - started, "visitor", "database=" + database + "; valid=" + valid);
            return Map.of("status", "UP", "database", database, "valid", valid);
        }
    }

    @GetMapping("/evaluation-dataset")
    public EvaluationDatasetResponse evaluationDataset() {
        return evaluationDatasetService.dataset();
    }

    @GetMapping("/cli/installer")
    public ResponseEntity<byte[]> cliInstaller() {
        String server = ServletUriComponentsBuilder.fromCurrentContextPath().build().toUriString();
        String script = """
                @echo off
                setlocal
                title VERDICT CLI Installer
                set "LOG_DIR=%%LOCALAPPDATA%%\\VERDICT\\logs"
                if not exist "%%LOG_DIR%%" mkdir "%%LOG_DIR%%" >nul 2>&1
                set "BOOT_LOG=%%LOG_DIR%%\\setup-bootstrap.log"
                set "INSTALL_PS1=%%TEMP%%\\verdict-cli-install-%%RANDOM%%.ps1"
                echo [%%date%% %%time%%] Download installer started.>>"%%BOOT_LOG%%"
                powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Invoke-WebRequest '%s/api/system/cli/files/install-verdict.ps1' -UseBasicParsing -OutFile '%%INSTALL_PS1%%'"
                if errorlevel 1 (
                  echo Could not download the VERDICT installer.
                  echo Log: %%BOOT_LOG%%
                  echo [%%date%% %%time%%] Could not download install-verdict.ps1.>>"%%BOOT_LOG%%"
                  pause
                  exit /b 1
                )
                powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%%INSTALL_PS1%%" -Server "%s" -DownloadBase "%s/api/system/cli/files" -LogFile "%%LOG_DIR%%\\installer-latest.log" -Quiet
                set "RESULT=%%errorlevel%%"
                del "%%INSTALL_PS1%%" >nul 2>&1
                echo.
                if not "%%RESULT%%"=="0" (
                  echo VERDICT CLI installation failed with code %%RESULT%%.
                  echo Installer log: %%LOG_DIR%%\\installer-latest.log
                  echo [%%date%% %%time%%] Installation failed with code %%RESULT%%.>>"%%BOOT_LOG%%"
                ) else (
                  echo VERDICT CLI installed successfully.
                  echo Installer log: %%LOG_DIR%%\\installer-latest.log
                  echo [%%date%% %%time%%] Installation completed.>>"%%BOOT_LOG%%"
                )
                echo.
                pause
                exit /b %%RESULT%%
                """.formatted(server, server, server);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType("application/x-msdownload"));
        headers.setContentDisposition(ContentDisposition.attachment().filename("install-verdict.cmd").build());
        return ResponseEntity.ok().headers(headers).body(script.getBytes(StandardCharsets.US_ASCII));
    }

    @GetMapping("/cli/version")
    public ResponseEntity<Map<String, Object>> cliVersion() throws Exception {
        String sha256 = "";
        try {
            Resource exeResource = new ClassPathResource("cli/verdict.exe.sha256");
            if (exeResource.exists()) {
                String manifest = new String(exeResource.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
                String[] parts = manifest.split("\\s+");
                if (parts.length > 0) sha256 = parts[0];
            }
        } catch (Exception ignored) {}
        String version = "1.1.0";
        return ResponseEntity.ok(Map.of(
                "version", version,
                "exe_sha256", sha256,
                "download_url", "/api/system/cli/files/verdict.exe",
                "installer_download_url", "/api/system/cli/files/VERDICT-Setup-Windows-x64.exe"
        ));
    }

    @GetMapping("/cli/files/{filename}")
    public ResponseEntity<Resource> cliFile(@org.springframework.web.bind.annotation.PathVariable String filename) {
        if (!filename.matches("verdict\\.mjs|verdict\\.exe|verdict\\.exe\\.sha256|README\\.txt|install-verdict\\.ps1|VERDICT-Setup-Windows-x64\\.exe|VERDICT-Setup-Windows-x64\\.exe\\.sha256")) {
            return ResponseEntity.notFound().build();
        }
        ClassPathResource resource = new ClassPathResource("cli/" + filename);
        if (!resource.exists()) {
            return ResponseEntity.notFound().build();
        }
        MediaType type;
        if (filename.endsWith(".txt")) {
            type = MediaType.TEXT_PLAIN;
        } else if (filename.endsWith(".exe")) {
            type = MediaType.parseMediaType("application/x-msdownload");
        } else if (filename.endsWith(".sha256")) {
            type = MediaType.TEXT_PLAIN;
        } else {
            type = MediaType.APPLICATION_OCTET_STREAM;
        }
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(type);
        headers.setContentDisposition(ContentDisposition.attachment()
                .filename(filename, StandardCharsets.UTF_8)
                .build());
        headers.set("X-Content-Type-Options", "nosniff");
        return ResponseEntity.ok().headers(headers).body(resource);
    }
}
