# Deployment Notes

This stack is for free local testing or a small VPS-style host. It builds the React app first, copies the generated static files into the Spring Boot resources folder, then packages one Java service.

## Local container run

1. Copy the example environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` and replace every `change_me_*` value. Compose refuses to start
   when database, root database, or RabbitMQ passwords are missing.

3. Build and run the app, MySQL, and RabbitMQ:

   ```powershell
   docker compose up --build
   ```

4. Open:

   ```text
   http://localhost:8080
   ```

## OSINT workspace

The optional `osint-tools` service gives you a Linux Python container with the repo `OSINT/` and `tools/` folders mounted. It does not automatically run tools yet; the Java backend currently performs only the built-in SignalTrace checks.

Start it when you want a safe install/test shell:

```powershell
docker compose --profile osint up -d osint-tools
docker compose exec osint-tools sh
```

Inside that shell, install OSINT tools only from your allowlist and keep outputs inside `/workspace/OSINT`.

## Production checklist

- Change all values in `.env`.
- Never pass production database or RabbitMQ credentials on the command line or commit `.env`.
- Put the app behind HTTPS using a reverse proxy such as Caddy, Nginx, or a platform proxy.
- Do not expose MySQL or RabbitMQ ports publicly.
- Turn on real route-level security before public deployment.
- Keep `spring.jpa.hibernate.ddl-auto=validate`; Flyway owns schema changes.
- Persist full OSINT run results before running long or expensive investigations.
# Required admin credentials

Production disables the built-in `admin/admin` login. Set `VERDICT_ADMIN_USERNAME` and a strong `VERDICT_ADMIN_PASSWORD`. The unsafe fallback can only be enabled deliberately with `VERDICT_ALLOW_DEFAULT_ADMIN=true` for isolated local development.
