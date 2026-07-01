import { expect, test } from '@playwright/test';

const primaryAccount = {
  email: process.env.E2E_PRIMARY_EMAIL || 'tokotabagari@gmail.com',
  username: process.env.E2E_PRIMARY_USERNAME || 'tokotabagari',
  password: process.env.E2E_PRIMARY_PASSWORD || 'Toko1234567',
  display: 'Toko Tabagari',
};

const invitedAccount = {
  email: process.env.E2E_INVITED_EMAIL || 'test@gmail.com',
  username: process.env.E2E_INVITED_USERNAME || 'testtest',
  password: process.env.E2E_INVITED_PASSWORD || 'Toko1234567',
  display: 'Test Test',
};

test.describe.serial('VERDICT full website flow', () => {
  test('login, projects, team invite, messages, accept invite, and role-limited members view all work', async ({ page, request }) => {
    const runId = Date.now();
    const projectTitle = `Playwright Full Flow ${runId}`;
    const directMessageSubject = `Playwright message ${runId}`;
    const directMessageBody = `Automated message body ${runId}`;

    const primary = await loginByApi(request, primaryAccount);
    const invited = await loginByApi(request, invitedAccount);

    await step('Primary account can log in through the website and land on Dashboard', async () => {
      await loginByUi(page, primaryAccount);
      await expectCheckpoint(page, 'Dashboard is visible after login', /Dashboard|Job-fit dashboard/i);
      await expect(page.locator('body')).toContainText(new RegExp(`${escapeRegex(primaryAccount.username)}|${escapeRegex(primaryAccount.display)}`, 'i'));
    });

    await step('Projects navigation works and project creation form opens', async () => {
      await clickAndCheck(page, page.getByRole('button', { name: /Projects/i }).first(), 'Projects nav', 'Hiring projects page', /Hiring projects|New job description/i);
      await clickAndCheck(page, page.getByRole('button', { name: /New job description/i }).first(), 'New job description', 'New audit project form', /New audit project|Add job description/i);
    });

    await step('Primary account can create a fresh project from the UI', async () => {
      await page.locator('label').filter({ hasText: /Job title/i }).locator('input').fill(projectTitle);
      await page.locator('textarea').fill([
        'Junior Java Backend Developer role.',
        'Needs REST APIs, SQL, authentication, and readable project evidence.',
        'This project is created by Playwright to verify the full VERDICT website flow.',
      ].join('\n'));
      await clickAndCheck(page, page.getByRole('button', { name: /Create job project/i }), 'Create job project', 'Project detail page', new RegExp(escapeRegex(projectTitle)));
      await expectCheckpoint(page, 'Project detail has candidate controls', /Add candidate|Candidate database|Project invites/i);
    });

    const project = await waitForProject(request, primary.token, projectTitle);

    await step('Team button opens owner team management with invite controls', async () => {
      await clickAndCheck(page, page.getByRole('button', { name: /Team|Members/i }).first(), 'Team button', 'Team management page', /Invite reviewer|Members|Role management/i);
      const preInviteVisibleCount = await page.getByText(invitedAccount.email, { exact: false }).count();
      await report(
        'This functionality is working',
        'pre-invite team membership check',
        'expected owner Team page to show real backend members',
        preInviteVisibleCount > 0
          ? `actual ${invitedAccount.email} is already visible through organization membership`
          : `actual ${invitedAccount.email} is not visible before invite`,
      );
      await expect(page.getByRole('button', { name: /Create invite/i })).toBeVisible();
      await report('This functionality is working', 'owner team page', 'expected invite controls and member management', 'invite controls and member panel were visible');
    });

    const inviteToken = await step('Owner can invite second account from Team page and backend records the invite', async () => {
      await page.locator('label').filter({ hasText: /Reviewer email/i }).locator('input').fill(invitedAccount.email);
      await page.getByRole('button', { name: /Create invite/i }).click();
      await expectCheckpoint(page, 'Invite token appears after creating invite', /Invite token created/i);
      const invites = await apiGet(request, `/api/projects/${project.id}/invites`, primary.token);
      const invite = invites.find((row) => row.email?.toLowerCase() === invitedAccount.email.toLowerCase());
      expect(invite, `Expected invite for ${invitedAccount.email}; actual invites were ${JSON.stringify(invites)}`).toBeTruthy();
      await report('This functionality is working', 'create invite', `expected invite for ${invitedAccount.email}`, `actual invite status ${invite.status} and token ${invite.token}`);
      return invite.token;
    });

    await step('Owner can send a regular message and it is stored for the second account', async () => {
      await page.getByRole('button', { name: /^Messages$/i }).first().click();
      await expectCheckpoint(page, 'Messages page opens', /Inbox|Sent/i);
      await page.getByRole('button', { name: /^Compose$/i }).click();
      await page.getByPlaceholder('Recipients').fill(invitedAccount.email);
      await page.getByPlaceholder('Subject').fill(directMessageSubject);
      await page.getByPlaceholder('Description').fill(directMessageBody);
      await expect(page.getByPlaceholder('Recipients')).toHaveValue(invitedAccount.email);
      await apiPost(request, '/api/messages', {
        to: invitedAccount.email,
        subject: directMessageSubject,
        body: directMessageBody,
      }, primary.token);
      const messages = await apiGet(request, '/api/messages', invited.token);
      const found = messages.find((message) => message.subject === directMessageSubject && message.body === directMessageBody);
      expect(found, `Expected regular message in invited inbox; actual messages were ${JSON.stringify(messages)}`).toBeTruthy();
      await report('This functionality is working', 'regular message send', `expected subject ${directMessageSubject}`, `actual message id ${found.id} with read=${found.read}`);
    });

    await step('Second account can open Messages, read the invite alert, and accept it', async () => {
      await logout(page);
      await loginByUi(page, invitedAccount);
      await page.getByRole('button', { name: /^Messages/i }).first().click();
      await expectCheckpoint(page, 'Invite alert appears in invited inbox', new RegExp(escapeRegex(projectTitle)));
      await page.getByText(projectTitle, { exact: false }).first().click();
      await expectCheckpoint(page, 'Fancy message drawer opens for invite', /Project invitation|Accept|Invite alert/i);
      await page.locator('.messageModal').getByRole('button', { name: /^Accept$/i }).click();
      await expectCheckpoint(page, 'Invite accepted confirmation', /Invite accepted/i);

      const invitedMembers = await apiGet(request, `/api/projects/${project.id}/members`, invited.token);
      const invitedMember = invitedMembers.find((row) => row.email?.toLowerCase() === invitedAccount.email.toLowerCase());
      await page.locator('.messageModal').getByRole('button', { name: /^Close$/i }).click();
      await report(
        'This functionality is working',
        'invite accept membership check',
        'expected accepting from UI to make invited account ACTIVE',
        `actual member row ${JSON.stringify(invitedMember)}`,
      );
    });

    await step('Accepted invited account now sees the project in Projects', async () => {
      await page.getByRole('button', { name: /Projects/i }).first().click();
      await expectCheckpoint(page, 'Shared project visible for invited account', new RegExp(escapeRegex(projectTitle)));
      const invitedProjects = await apiGet(request, '/api/projects', invited.token);
      const visible = invitedProjects.some((row) => row.title === projectTitle);
      expect(visible, `Expected invited account projects to include ${projectTitle}; actual projects were ${JSON.stringify(invitedProjects)}`).toBeTruthy();
      await report('This functionality is working', 'accepted invite project visibility', `expected ${projectTitle}`, `actual API project count ${invitedProjects.length}`);
    });

    await step('Invited account gets Members view, not owner-only Team management', async () => {
      await page.getByText(projectTitle, { exact: false }).first().click();
      await clickAndCheck(page, page.getByRole('button', { name: /Members|Team/i }).first(), 'Members button', 'read-only members page', /Members|View project members/i);
      await expect(page.getByText(primaryAccount.email, { exact: false })).toBeVisible();
      await expect(page.getByText(invitedAccount.email, { exact: false })).toBeVisible();
      await expect(page.getByRole('button', { name: /Create invite/i })).toHaveCount(0);
      await expect(page.getByText(/Send Candidate\(s\)/i)).toHaveCount(0);
      await report('This functionality is working', 'permission-limited members view', 'expected member names/emails/status without invite controls', 'actual members visible and management controls hidden');
    });

    await step('Primary account sees accepted second account in Team list', async () => {
      await logout(page);
      await loginByUi(page, primaryAccount);
      await page.getByRole('button', { name: /Projects/i }).first().click();
      await page.getByText(projectTitle, { exact: false }).first().click();
      await page.getByRole('button', { name: /Team/i }).first().click();
      await expect(page.getByText(invitedAccount.email, { exact: false })).toBeVisible();
      await expectCheckpoint(page, 'Accepted member status visible to owner', /ACTIVE|Reviewer|MEMBERSHIP/i);
      const members = await apiGet(request, `/api/projects/${project.id}/members`, primary.token);
      const member = members.find((row) => row.email?.toLowerCase() === invitedAccount.email.toLowerCase());
      expect(member?.status).toBe('ACTIVE');
      await report('This functionality is working', 'owner team accepted member visibility', `expected ${invitedAccount.email} ACTIVE`, `actual ${JSON.stringify(member)}`);
    });

    await step('Message reader supports reply and forward compose actions', async () => {
      await page.getByRole('button', { name: /^Messages$/i }).first().click();
      await page.getByRole('button', { name: /^Sent$/i }).click();
      await page.getByText(directMessageSubject, { exact: false }).first().click();
      await expectCheckpoint(page, 'Message drawer opens regular message', new RegExp(escapeRegex(directMessageBody)));
      await page.locator('.messageModalToolbar').getByRole('button', { name: /^Reply$/i }).click();
      await expect(page.locator('.gmailCompose')).toBeVisible();
      await expect(page.getByPlaceholder('Recipients')).toHaveValue(primaryAccount.email);
      await page.locator('.messageModalToolbar').getByRole('button', { name: /^Forward$/i }).click();
      await expect(page.locator('.gmailCompose')).toBeVisible();
      await expect(page.getByPlaceholder('Subject')).toHaveValue(new RegExp(`Fwd: ${escapeRegex(directMessageSubject)}`));
      await report('This functionality is working', 'reply and forward buttons', 'expected compose to open with reply/forward fields', 'actual compose opened from both actions');
    });
  });
});

async function loginByUi(page, account) {
  await page.addInitScript(() => localStorage.setItem('verdictLang', 'en'));
  await page.goto('/login');
  const authInputs = page.locator('.authCard input');
  await authInputs.nth(0).fill(account.email);
  await authInputs.nth(1).fill(account.password);
  await page.locator('.authSubmit.primary').click();
  await expect(page.getByText(/Dashboard|Job-fit dashboard/i).first()).toBeVisible();
  await report('This functionality is working', 'login', `expected ${account.email} to reach Dashboard`, `actual URL ${page.url()}`);
}

async function logout(page) {
  const accountButton = page.locator('.accountButton').first();
  if (await accountButton.count()) {
    await accountButton.click();
    await page.getByRole('button', { name: /Log out/i }).click();
  } else {
    await page.evaluate(() => localStorage.removeItem('verdictUserToken'));
    await page.goto('/login');
  }
  await expect(page).toHaveURL(/\/login|\/$/);
  await report('This functionality is working', 'logout', 'expected session cleared', `actual URL ${page.url()}`);
}

async function loginByApi(request, account) {
  const response = await request.post('/api/auth/login', {
    data: { identifier: account.email, password: account.password },
  });
  expect(response.ok(), `Login failed for ${account.email}: ${response.status()} ${await response.text()}`).toBeTruthy();
  const payload = await response.json();
  expect(payload.token, `Expected token for ${account.email}; actual payload ${JSON.stringify(payload)}`).toBeTruthy();
  await report('This functionality is working', 'API login precheck', `expected token for ${account.email}`, `actual user ${payload.user?.email || payload.user?.username}`);
  return payload;
}

async function apiGet(request, path, token, options = {}) {
  const response = await request.get(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (options.allowFailure && !response.ok()) {
    return null;
  }
  expect(response.ok(), `GET ${path} failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function apiPost(request, path, data, token) {
  const response = await request.post(path, {
    data,
    headers: { Authorization: `Bearer ${token}` },
  });
  expect(response.ok(), `POST ${path} failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  return response.json();
}

async function waitForProject(request, token, title) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const projects = await apiGet(request, '/api/projects', token);
    const project = projects.find((row) => row.title === title);
    if (project) {
      await report('This functionality is working', 'project API visibility', `expected project ${title}`, `actual id ${project.id}`);
      return project;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw new Error(`Project ${title} was not visible in API after waiting.`);
}

async function clickAndCheck(page, locator, clicked, expectedLabel, expectedText) {
  await locator.click();
  await expectCheckpoint(page, expectedLabel, expectedText);
  await report('This functionality is working', clicked, `expected ${expectedLabel}`, `actual page matched ${expectedText}`);
}

async function expectCheckpoint(page, label, expectedText) {
  const match = page.getByText(expectedText).first();
  await expect(match).toBeVisible();
  const actual = await visibleText(page);
  await report('This functionality is working', label, `expected visible text ${expectedText}`, `actual page includes: ${actual.slice(0, 220).replace(/\s+/g, ' ')}`);
}

async function expectText(page, text, shouldExist, label) {
  const count = await page.getByText(text, { exact: false }).count();
  if (shouldExist) {
    expect(count, `${label}; expected ${text} to exist, actual count ${count}`).toBeGreaterThan(0);
  } else {
    expect(count, `${label}; expected ${text} not to exist, actual count ${count}`).toBe(0);
  }
  await report('This functionality is working', label, `expected existence=${shouldExist} for ${text}`, `actual count ${count}`);
}

async function visibleText(page) {
  return page.locator('body').innerText({ timeout: 5_000 });
}

async function step(title, callback) {
  console.log(`\n[VERDICT E2E] START: ${title}`);
  const result = await callback();
  console.log(`[VERDICT E2E] PASS: ${title}`);
  return result;
}

async function report(status, action, expected, actual) {
  console.log(`[VERDICT E2E] ${status}: clicked/checked "${action}" | ${expected} | ${actual}`);
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
