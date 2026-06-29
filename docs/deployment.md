# Deployment Notes

This stack is for free local testing or a small VPS-style host. It builds the React app first, copies the generated static files into the Spring Boot resources folder, then packages one Java service.

## Local container run

1. Copy the example environment file:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Edit `.env` and replace every `change_me_*` value.

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
- Put the app behind HTTPS using a reverse proxy such as Caddy, Nginx, or a platform proxy.
- Do not expose MySQL or RabbitMQ ports publicly.
- Turn on real route-level security before public deployment.
- Replace `spring.jpa.hibernate.ddl-auto=update` with migrations before serious use.
- Persist full OSINT run results before running long or expensive investigations.
