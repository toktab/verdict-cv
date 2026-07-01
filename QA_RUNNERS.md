# VERDICT QA Automation Runners

## Playwright browser/API automation

The main QA automation pack is JavaScript Playwright under `front/tests`.

Run all Playwright tests:

```powershell
cd front
npm run e2e
```

Generate Allure results while running:

```powershell
cd front
npm run e2e:allure
npm run allure:generate
npm run allure:open
```

Failure artifacts are enabled in `front/playwright.config.js`:

- screenshots: `only-on-failure`
- videos: `retain-on-failure`
- traces: `retain-on-failure`
- Allure result files: `front/allure-results`

## Backend Java tests

The backend tests are JUnit/Spring tests, not TestNG tests.

Run backend tests:

```powershell
.\mvnw.cmd test
```

## About `testng.xml`

`testng.xml` lists the current backend Java test classes, but it does not run the JavaScript Playwright tests. This project is not currently configured as a TestNG project, so use the commands above for the working automation suites.
