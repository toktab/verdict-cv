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
