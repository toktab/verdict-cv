import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        sessionStorage.setItem('verdictIntroSeen', 'true');
        class MockEventSource {
            addEventListener() {}
            removeEventListener() {}
            close() {}
        }
        window.EventSource = MockEventSource;
    });
    await page.route('**/api/**', async (route) => {
        const request = route.request();
        const path = new URL(request.url()).pathname;
        if (path === '/api/auth/login') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    token: 'smoke-token',
                    user: {
                        id: 1,
                        username: 'smoke-user',
                        email: 'smoke@example.com',
                        fullName: 'Smoke User',
                        role: 'Analyst',
                    },
                }),
            });
            return;
        }
        if (path === '/api/auth/me') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 1,
                    username: 'smoke-user',
                    email: 'smoke@example.com',
                    fullName: 'Smoke User',
                    role: 'Analyst',
                }),
            });
            return;
        }
        if (path === '/api/audit/42') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify({
                    id: 42,
                    claimTitle: 'Backend candidate',
                    claimText: 'Java developer with Spring Boot and PostgreSQL experience.',
                    evidenceTitle: 'Backend role',
                    evidenceText: 'The role requires Java, Spring Boot, SQL, and testing.',
                    credibilityScore: 84,
                    supportedCount: 1,
                    stretchedCount: 0,
                    unsupportedCount: 0,
                    gapCount: 0,
                    status: 'COMPLETED',
                    engine: 'LOCAL',
                    analyzerVersion: 'smoke-1',
                    promptVersion: 'smoke-1',
                    processingMillis: 125,
                    verdicts: [{
                        id: 1,
                        sentenceIndex: 0,
                        sentence: 'Java developer with Spring Boot experience.',
                        status: 'SUPPORTED',
                        confidence: 'HIGH',
                        explanation: 'The supplied role evidence supports this skill.',
                    }],
                }),
            });
            return;
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
    });
});

test('unknown direct route renders recovery instead of a blank screen', async ({ page }) => {
    await page.goto('/route-that-does-not-exist');
    await expect(page.getByRole('heading', { name: 'This page does not exist anymore.' })).toBeVisible();
    await expect(page.getByRole('main').getByRole('button', { name: /home/i })).toBeVisible();
});

test('login submits with Enter and opens the authenticated workspace', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/username or email/i).fill('smoke-user');
    await page.getByLabel(/^password$/i).fill('StrongPass123');
    await page.getByLabel(/^password$/i).press('Enter');
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByText('Smoke User', { exact: false }).first()).toBeVisible();
});

test('registration Enter flow reaches the improved final review', async ({ page }) => {
    await page.goto('/register');
    await page.getByRole('textbox', { name: /^first name$/i }).fill('Nino');
    await page.getByRole('textbox', { name: /^last name$/i }).fill('Tester');
    await page.getByRole('textbox', { name: /^last name$/i }).press('Enter');

    await page.getByRole('textbox', { name: /^username$/i }).fill('nino-tester');
    await page.getByRole('textbox', { name: /^username$/i }).press('Enter');

    await page.getByRole('textbox', { name: /^email$/i }).fill('nino@example.com');
    await page.getByRole('textbox', { name: /^email$/i }).press('Enter');

    await page.getByRole('textbox', { name: /^country$/i }).fill('Georgia');
    await page.getByRole('textbox', { name: /^address$/i }).fill('12 Rustaveli Avenue');
    await page.getByRole('textbox', { name: /^address$/i }).press('Enter');

    await page.getByRole('textbox', { name: /^organization$/i }).fill('VERDICT QA');
    await page.getByRole('textbox', { name: /^role$/i }).fill('QA Engineer');
    await page.getByRole('textbox', { name: /^role$/i }).press('Enter');

    await page.getByLabel(/^password$/i).fill('StrongPass123');
    await page.getByLabel(/^password$/i).press('Enter');

    await expect(page.getByText('Ready to create this workspace account?')).toBeVisible();
    await expect(page.getByText('Nino Tester', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('nino@example.com', { exact: true }).first()).toBeVisible();
    await expect(page.locator('.registerStepPanel button.primary')).toBeDisabled();
});

test('audit detail and profiling routes render directly for an authenticated session', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));

    await page.goto('/audit/42');
    await expect(page.getByRole('heading', { name: 'Backend candidate' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Verdicts' })).toBeVisible();

    await page.goto('/audit/42/profile');
    await expect(page.getByText('Profiling mode', { exact: true })).toBeVisible();
    await expect(page.locator('.profileDocumentHead').getByText('Candidate CV', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Select a highlight' })).toBeVisible();
});
