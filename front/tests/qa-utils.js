import { expect } from '@playwright/test';

export const primaryAccount = {
  email: process.env.E2E_PRIMARY_EMAIL || 'tokotabagari@gmail.com',
  username: process.env.E2E_PRIMARY_USERNAME || 'tokotabagari',
  password: process.env.E2E_PRIMARY_PASSWORD || 'Toko1234567',
  display: 'Toko Tabagari',
};

export const invitedAccount = {
  email: process.env.E2E_INVITED_EMAIL || 'test@gmail.com',
  username: process.env.E2E_INVITED_USERNAME || 'testtest',
  password: process.env.E2E_INVITED_PASSWORD || 'Toko1234567',
  display: 'Test Test',
};

export const adminAccount = {
  username: process.env.E2E_ADMIN_USERNAME || 'admin',
  password: process.env.E2E_ADMIN_PASSWORD || 'admin',
};

export async function qaStep(title, callback) {
  console.log(`\n[VERDICT QA] START: ${title}`);
  const result = await callback();
  console.log(`[VERDICT QA] PASS: ${title}`);
  return result;
}

export async function qaReport(action, expected, actual, status = 'This functionality is working') {
  console.log(`[VERDICT QA] ${status}: clicked/checked "${action}" | ${expected} | ${actual}`);
}

export async function expectPageText(page, label, expectedText) {
  await expect(page.getByText(expectedText).first()).toBeVisible();
  const actual = await page.locator('body').innerText({ timeout: 5_000 });
  await qaReport(label, `expected visible text ${expectedText}`, `actual page includes: ${oneLine(actual).slice(0, 260)}`);
}

export async function clickAndExpect(page, locator, action, expectedLabel, expectedText) {
  await locator.click();
  await expectPageText(page, expectedLabel, expectedText);
  await qaReport(action, `expected ${expectedLabel}`, `actual page matched ${expectedText}`);
}

export async function loginByUi(page, account = primaryAccount) {
  await page.addInitScript(() => localStorage.setItem('verdictLang', 'en'));
  await page.goto('/login');
  const authInputs = page.locator('.authCard input');
  await authInputs.nth(0).fill(account.email);
  await authInputs.nth(1).fill(account.password);
  await page.locator('.authSubmit.primary').click();
  await expect(page.getByText(/Dashboard|Job-fit dashboard/i).first()).toBeVisible();
  await qaReport('login', `expected ${account.email} to reach Dashboard`, `actual URL ${page.url()}`);
}

export async function logout(page) {
  const accountButton = page.locator('.accountButton').first();
  if (await accountButton.count()) {
    await accountButton.click();
    await page.getByRole('button', { name: /Log out/i }).click();
  } else {
    await page.evaluate(() => localStorage.removeItem('verdictUserToken'));
    await page.goto('/login');
  }
  await expect(page).toHaveURL(/\/login|\/$/);
  await qaReport('logout', 'expected session cleared', `actual URL ${page.url()}`);
}

export async function loginByApi(request, account = primaryAccount) {
  const response = await request.post('/api/auth/login', {
    data: { identifier: account.email || account.username, password: account.password },
  });
  expect(response.ok(), `Login failed for ${account.email || account.username}: ${response.status()} ${await response.text()}`).toBeTruthy();
  const payload = await response.json();
  expect(payload.token, `Expected token; actual payload ${JSON.stringify(payload)}`).toBeTruthy();
  await qaReport('API login precheck', `expected token for ${account.email || account.username}`, `actual user ${payload.user?.email || payload.user?.username}`);
  return payload;
}

export async function adminLoginByApi(request) {
  const response = await request.post('/api/admin/login', {
    data: { username: adminAccount.username, password: adminAccount.password },
  });
  expect(response.ok(), `Admin login failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  const payload = await response.json();
  expect(payload.token, `Expected admin token; actual payload ${JSON.stringify(payload)}`).toBeTruthy();
  await qaReport('admin API login', 'expected admin token', `actual token length ${payload.token.length}`);
  return payload.token;
}

export async function apiGet(request, path, token, headers = {}) {
  return apiRequest(request, 'get', path, { token, headers });
}

export async function apiPost(request, path, data, token, headers = {}) {
  return apiRequest(request, 'post', path, { data, token, headers });
}

export async function apiPatch(request, path, data, token, headers = {}) {
  return apiRequest(request, 'patch', path, { data, token, headers });
}

export async function apiDelete(request, path, token, headers = {}) {
  return apiRequest(request, 'delete', path, { token, headers });
}

export async function apiRequest(request, method, path, { data, token, headers = {}, ok = true } = {}) {
  const response = await request[method](path, {
    data,
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });
  if (ok) {
    expect(response.ok(), `${method.toUpperCase()} ${path} failed: ${response.status()} ${await response.text()}`).toBeTruthy();
  }
  const text = await response.text();
  const contentType = response.headers()['content-type'] || '';
  const body = contentType.includes('application/json') && text ? JSON.parse(text) : text;
  return { response, body };
}

export async function createProjectViaApi(request, token, title) {
  const { body } = await apiPost(request, '/api/projects', {
    title,
    department: 'QA Automation',
    location: 'Remote',
    description: 'QA-created project for full regression testing. Requires Java, REST, SQL, authentication, and evidence.',
    requirements: ['Java', 'REST APIs', 'SQL', 'Authentication'],
    state: 'WAR+AI State',
    status: 'Screening',
  }, token);
  await qaReport('create project API', `expected project ${title}`, `actual id ${body.id}`);
  return body;
}

export async function createCandidateViaApi(request, token, projectId, name) {
  const { body } = await apiPost(request, `/api/projects/${projectId}/candidates`, {
    name,
    role: 'Junior Java Backend Developer',
    cv_text: [
      `${name} is a Junior Java Backend Developer.`,
      'Built a Spring Boot REST API with SQL persistence and token authentication.',
      'Claims senior leadership and production ownership without evidence.',
      'GitHub has one API project and one auth demo.',
    ].join('\n'),
  }, token);
  await qaReport('create candidate API', `expected candidate ${name}`, `actual id ${body.id} score ${body.score}`);
  return body;
}

export function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function oneLine(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}
