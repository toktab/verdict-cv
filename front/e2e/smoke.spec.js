import { expect, test } from '@playwright/test';

function projectFixture(overrides = {}) {
    return {
        id: 7,
        title: 'Platform Backend Engineer',
        description: 'Build secure Java services.\nRequirements:\n- Java\n- Spring Boot\n- PostgreSQL',
        requirements: ['Java', 'Spring Boot', 'PostgreSQL'],
        state: 'WAR+AI State',
        status: 'Screening',
        ownerId: 1,
        myRole: 'Head Admin',
        myPermissions: ['canView', 'canInvite', 'canTeamManage', 'canAddNote', 'protectedAccount'],
        candidates: [],
        ...overrides,
    };
}

test.beforeEach(async ({ page }) => {
    const projects = [projectFixture()];
    const messages = [];
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
        const method = request.method();
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
        if (path === '/api/auth/me/cmd-sessions' && method === 'GET') {
            await route.fulfill({
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify([{
                    id: 'cmd-session-1',
                    client_name: 'Office workstation',
                    ip_address: '203.0.113.42',
                    user_agent: 'VERDICT-CLI/1.0 Windows',
                    created_at: '2026-07-17T08:00:00Z',
                    last_used_at: '2026-07-17T08:05:00Z',
                    active: true,
                }]),
            });
            return;
        }
        if (path === '/api/auth/me/cmd-sessions/cmd-session-1' && method === 'DELETE') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '' });
            return;
        }
        if (path === '/api/auth/users/lookup') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 2, username: 'reviewer', email: 'reviewer@example.com', fullName: 'Review User', role: 'Reviewer' }) });
            return;
        }
        if (path === '/api/projects' && method === 'GET') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(projects) });
            return;
        }
        if (path === '/api/projects' && method === 'POST') {
            const payload = request.postDataJSON();
            const created = projectFixture({ id: 8, title: payload.title, description: payload.description, requirements: payload.requirements || [] });
            projects.push(created);
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(created) });
            return;
        }
        if (path === '/api/projects/7/candidates' && method === 'POST') {
            const payload = request.postDataJSON();
            const candidate = { id: 71, name: payload.name, role: payload.role || 'Candidate', cv_text: payload.cv_text, summary: 'Candidate analysis saved.', audit_phrase_matches: [] };
            projects[0].candidates.push(candidate);
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(candidate) });
            return;
        }
        if (path === '/api/projects/invites/accept' && method === 'POST') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 81, projectId: 7, email: 'smoke@example.com', role: 'REVIEWER', token: 'invite-smoke-123', status: 'ACCEPTED', createdAt: new Date().toISOString() }) });
            return;
        }
        if (path === '/api/messages' && method === 'GET') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(messages) });
            return;
        }
        if (path === '/api/messages' && method === 'POST') {
            const payload = request.postDataJSON();
            const message = { id: 91, from: 'smoke@example.com', fromName: 'Smoke User', to: payload.to, subject: payload.subject, body: payload.body, folder: 'sent', read: true, starred: false, sentAt: new Date().toISOString() };
            messages.push(message);
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(message) });
            return;
        }
        if (path === '/api/admin/login') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ token: 'admin-smoke-token' }) });
            return;
        }
        if (path === '/api/admin/table-clear-targets') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ key: 'demo-data', label: 'Seeded demo workspace', deletedRows: 12, demoPreset: true }, { key: 'messages', label: 'Messages', deletedRows: 4, demoPreset: false }]) });
            return;
        }
        if (path === '/api/admin/health') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ status: 'UP', database: { status: 'UP' }, llm: { status: 'UP' }, rabbitmq: { status: 'UP' }, build: { version: 'smoke', commit: 'test' } }) });
            return;
        }
        if (path === '/api/admin/settings') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ requireEmailVerification: false }) });
            return;
        }
        if (['/api/admin/audits', '/api/admin/logs', '/api/admin/users', '/api/admin/ats-templates'].includes(path)) {
            await route.fulfill({ status: 200, contentType: 'application/json', body: '[]' });
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
        if (path === '/api/audit/run-async' && method === 'POST') {
            await route.fulfill({ status: 202, contentType: 'application/json', body: JSON.stringify({ id: 43, status: 'QUEUED' }) });
            return;
        }
        if (path === '/api/audit/43') {
            await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 43, claimTitle: 'Backend developer applicant', evidenceTitle: 'Role requirements and public evidence', claimText: 'Java and Spring Boot candidate.', evidenceText: 'Java role evidence.', credibilityScore: 88, supportedCount: 2, stretchedCount: 0, unsupportedCount: 0, gapCount: 0, status: 'COMPLETED', engine: 'LOCAL', processingMillis: 90, verdicts: [] }) });
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

test('project creation persists through the API and opens the project workspace', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));
    await page.goto('/projects/new');
    await page.getByPlaceholder('Backend Java Developer').fill('Security Platform Engineer');
    await page.locator('main textarea').fill('Own secure Java APIs and PostgreSQL services.');
    await page.getByRole('button', { name: /create job project/i }).click();
    await expect(page).toHaveURL(/\/projects\/8$/);
    await expect(page.getByRole('heading', { name: 'Security Platform Engineer' })).toBeVisible();
});

test('candidate intake posts CV text and confirms server analysis', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));
    await page.goto('/projects/7/candidates/new');
    await page.getByPlaceholder('Candidate name').fill('Nino Backend');
    await page.getByPlaceholder(/paste the candidate cv/i).fill('Java developer with Spring Boot, PostgreSQL, JUnit, and secure API experience.');
    await page.getByRole('button', { name: /analyze candidate/i }).click();
    await expect(page.getByText('Candidate analysis saved.')).toBeVisible();
    await expect(page.getByRole('button', { name: /return to candidate table/i })).toBeVisible();
});

test('compose resolves a platform user and reports successful delivery', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));
    await page.goto('/messages');
    await page.getByRole('button', { name: /compose/i }).click();
    await page.getByPlaceholder('Username or email').fill('reviewer');
    await expect(page.getByText('Review User')).toBeVisible();
    await page.getByPlaceholder('Subject').fill('Candidate review');
    await page.getByPlaceholder('Description').fill('Please review the new backend candidate.');
    const delivery = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/messages' && request.method() === 'POST');
    await page.getByRole('button', { name: /^send$/i }).click();
    const request = await delivery;
    expect(request.postDataJSON()).toMatchObject({ to: 'reviewer@example.com', subject: 'Candidate review', body: 'Please review the new backend candidate.' });
    await expect(page.getByRole('dialog', { name: /new message|message sent/i })).toBeHidden();
});

test('dialogs receive focus, close with Escape, and restore the trigger focus', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));
    await page.goto('/messages');
    const compose = page.getByRole('button', { name: /compose/i });
    await compose.focus();
    await compose.click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByPlaceholder('Username or email')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(compose).toBeFocused();
});

test('profile shows CMD access details and confirms immediate revocation', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: 'CMD access' })).toBeVisible();
    await expect(page.getByText('Office workstation')).toBeVisible();
    await expect(page.getByText('203.0.113.42')).toBeVisible();
    await expect(page.getByText('Active', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Revoke' }).click();
    await expect(page.getByRole('heading', { name: 'Disconnect Office workstation?' })).toBeVisible();
    const revocation = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/auth/me/cmd-sessions/cmd-session-1' && request.method() === 'DELETE');
    await page.getByRole('button', { name: /revoke cmd access/i }).click();
    await revocation;
});

test('admin table clearing remains locked until the generated phrase is typed', async ({ page }) => {
    await page.goto('/admin');
    await page.getByLabel('Password').fill('admin-secret');
    await page.getByRole('button', { name: /authenticate/i }).click();
    await expect(page.getByText('Clear only the seeded demo workspace')).toBeVisible();
    await page.getByRole('button', { name: /select demo preset/i }).click();
    const clearButton = page.getByRole('button', { name: /clear selected tables/i });
    await expect(clearButton).toBeDisabled();
    await page.getByLabel(/type demo-data to confirm/i).fill('demo-data');
    await expect(clearButton).toBeEnabled();
    await clearButton.click();
    await expect(page.getByRole('heading', { name: 'Clear selected tables' })).toBeVisible();
});

test('invite acceptance posts the token and refreshes project membership', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));
    await page.goto('/projects/7');
    await page.getByPlaceholder('Paste invite token').fill('invite-smoke-123');
    const acceptance = page.waitForRequest((request) => new URL(request.url()).pathname === '/api/projects/invites/accept' && request.method() === 'POST');
    await page.getByRole('button', { name: /accept invite/i }).click();
    const request = await acceptance;
    expect(new URL(request.url()).searchParams.get('token')).toBe('invite-smoke-123');
    await expect(page.getByText('Invite accepted. Refresh projects if the shared role is not visible yet.')).toBeVisible();
});

test('audit submission completes from the realtime event and renders the result', async ({ page }) => {
    await page.addInitScript(() => sessionStorage.setItem('verdictUserToken', 'smoke-token'));
    await page.goto('/audit');
    const submission = page.waitForResponse((response) => new URL(response.url()).pathname === '/api/audit/run-async' && response.request().method() === 'POST');
    await page.getByRole('button', { name: /audit candidate/i }).click();
    await submission;
    await page.evaluate(() => setTimeout(() => window.dispatchEvent(new CustomEvent('verdictAuditChanged', { detail: { auditId: 43, status: 'COMPLETED' } })), 100));
    await expect(page.getByText('88%').first()).toBeVisible();
    await expect(page.getByText(/Top risk count: 0/)).toBeVisible();
});
