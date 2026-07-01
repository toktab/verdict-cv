import { expect, test } from '@playwright/test';
import {
  adminAccount,
  apiGet,
  createCandidateViaApi,
  createProjectViaApi,
  escapeRegex,
  expectPageText,
  loginByApi,
  loginByUi,
  primaryAccount,
  qaReport,
  qaStep,
} from './qa-utils';

test.describe.serial('VERDICT browser surface regression', () => {
  test('profile, candidate review, SignalTrace, audit and admin surfaces behave as expected', async ({ page, request }) => {
    const runId = Date.now();
    const primary = await loginByApi(request, primaryAccount);
    const project = await createProjectViaApi(request, primary.token, `QA Browser Project ${runId}`);
    const candidate = await createCandidateViaApi(request, primary.token, project.id, `QA Browser Candidate ${runId}`);

    await qaStep('Profile page opens from account menu and shows signed-in identity', async () => {
      await loginByUi(page, primaryAccount);
      await page.locator('.accountChip').click();
      await page.locator('.accountDropdown').getByRole('button', { name: /Profile/i }).click();
      await expectPageText(page, 'profile page opens', /Profile|Role/i);
      await expect(page.getByText(primaryAccount.email, { exact: false })).toBeVisible();
      await expect(page.getByText(primaryAccount.display, { exact: false })).toBeVisible();
      const { body: me } = await apiGet(request, '/api/auth/me', primary.token);
      expect(me.email).toBe(primaryAccount.email);
      await qaReport('profile page identity', 'expected signed-in name/email/role visible', `actual profile email ${me.email}, role ${me.role}`);
    });

    await qaStep('Candidate detail supports voting, pipeline status, reviewer notes and state initialization', async () => {
      await page.getByRole('button', { name: /Projects/i }).first().click();
      await page.getByText(project.title, { exact: false }).first().click();
      await page.locator('.candidateTableRow').filter({ hasText: candidate.name }).click();
      await expectPageText(page, 'candidate detail opens', new RegExp(escapeRegex(candidate.name)));
      await expect(page.getByText(/Candidate score and pipeline/i)).toBeVisible();
      await page.locator('.candidateVotingPanel select').first().selectOption('4.5');
      await page.getByRole('button', { name: /Upvote/i }).click();
      await expect(page.getByText(/upvote 4.5\/5/i)).toBeVisible();
      await page.locator('.candidateVotingPanel select').nth(1).selectOption('OnInterview');
      await expect(page.locator('.candidateVotingPanel select').nth(1)).toHaveValue('OnInterview');
      await page.locator('.reviewNoteForm textarea').fill(`QA reviewer note ${runId}`);
      await page.getByRole('button', { name: /Save note/i }).click();
      await expect(page.getByText(`QA reviewer note ${runId}`)).toBeVisible();
      await page.getByRole('button', { name: /Light State/i }).click();
      await expect(page.getByText(/Analysis not initialized/i)).toBeVisible();
      await page.getByRole('button', { name: /Initialize Analysis with State/i }).click();
      await expect(page.getByText(/Claim|Verdicts|Evidence/i).first()).toBeVisible();
      await qaReport('candidate review controls', 'expected vote/status/note/state controls to update UI', 'actual vote attribution, status select, note row and initialized analysis were visible');
    });

    await qaStep('SignalTrace shows consent gate and locked-state behavior outside WAR+AI', async () => {
      await page.getByRole('button', { name: /SignalTrace/i }).first().click();
      await expectPageText(page, 'SignalTrace page opens', /SignalTrace|Consent|Trace directory/i);
      await expect(page.getByText(/Consent|Candidate consent/i).first()).toBeVisible();
      const startTrace = page.getByRole('button', { name: /Start trace/i });
      await expect(startTrace).toBeDisabled();
      await expect(page.getByText(/Switch to WAR_AI State to unlock SignalTrace OSINT/i).first()).toBeVisible();
      await page.locator('.consentConfirmRow input').check();
      await expect(startTrace).toBeDisabled();
      await qaReport('SignalTrace locked surface', 'expected consent gate visible and trace disabled outside WAR+AI', 'actual locked copy visible and Start trace disabled');
    });

    await qaStep('Audit workspace validates short input and runs a valid candidate audit from the browser', async () => {
      await page.goto('/dashboard');
      await page.getByRole('button', { name: /New audit|Run private audit|Private audit/i }).first().click();
      await expectPageText(page, 'audit workspace opens', /Candidate CV|Run audit|Evidence/i);
      const textareas = page.locator('textarea');
      await textareas.nth(0).fill('too short');
      await textareas.nth(1).fill('too short');
      await page.getByRole('button', { name: /Audit candidate/i }).scrollIntoViewIfNeeded();
      await page.getByRole('button', { name: /Audit candidate/i }).click();
      await expect(page.locator('body')).toContainText(/20|required|short|evidence|claim/i);
      await textareas.nth(0).fill('Candidate says they built Java APIs, authentication, SQL schemas, and senior architecture for production hiring systems.');
      await textareas.nth(1).fill('Evidence shows a junior Java API, a token authentication demo, SQL coursework, and no confirmed senior architecture ownership.');
      await page.getByRole('button', { name: /Audit candidate/i }).click();
      await expect(page.getByText(/Supported|Stretched|Unsupported|Credibility|verdict/i).first()).toBeVisible({ timeout: 30_000 });
      await qaReport('audit browser run', 'expected validation then valid verdict output', 'actual invalid copy appeared and valid run rendered verdict language');
    });

    await qaStep('Admin browser surface protects login and exposes non-destructive maintenance controls', async () => {
      await page.goto('/admin');
      await expectPageText(page, 'admin login opens', /Admin login|Username|Password/i);
      await page.locator('.adminLogin label').filter({ hasText: /Username/i }).locator('input').fill(adminAccount.username);
      await page.locator('.adminLogin label').filter({ hasText: /Password/i }).locator('input').fill('wrong-password');
      await page.getByRole('button', { name: /Authenticate/i }).click();
      await expect(page.locator('body')).toContainText(/403|Forbidden|Invalid/i);
      await page.locator('.adminLogin label').filter({ hasText: /Password/i }).locator('input').fill(adminAccount.password);
      await page.getByRole('button', { name: /Authenticate/i }).click();
      await expectPageText(page, 'admin dashboard opens', /Danger zone|Clear tables|Audits|Users|Logs/i);
      await expect(page.getByText(/Clear tables/i)).toBeVisible();
      await expect(page.getByText(/Type CLEAR/i)).toBeVisible();
      await expect(page.getByRole('button', { name: /Clear selected/i })).toBeDisabled();
      await qaReport('admin safety UI', 'expected bad login rejected and clear tables guarded', 'actual admin dashboard exposed danger zone with disabled clear button until selection/confirmation');
    });
  });
});
