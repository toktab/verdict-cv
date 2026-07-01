import { expect, test } from '@playwright/test';
import {
  adminLoginByApi,
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiRequest,
  createCandidateViaApi,
  createProjectViaApi,
  loginByApi,
  primaryAccount,
  qaReport,
  qaStep,
} from './qa-utils';

test.describe.serial('VERDICT API contract regression', () => {
  test('system, auth, audit, admin, projects, messages, telemetry contracts work and reject bad input', async ({ request }) => {
    const runId = Date.now();
    const primary = await loginByApi(request, primaryAccount);
    const adminToken = await adminLoginByApi(request);

    await qaStep('Public and system endpoints are reachable', async () => {
      const root = await request.get('/');
      expect(root.ok(), `Expected root SPA to load; actual ${root.status()}`).toBeTruthy();
      const { body: health } = await apiGet(request, '/api/system/health');
      expect(String(health.status || '')).toMatch(/UP/i);
      const { body: dataset } = await apiGet(request, '/api/system/evaluation-dataset');
      expect(Array.isArray(dataset) || typeof dataset === 'object').toBeTruthy();
      await qaReport('system endpoints', 'expected SPA + health + dataset', `actual health ${JSON.stringify(health).slice(0, 180)}`);
    });

    await qaStep('Auth validates wrong credentials and returns profile for valid token', async () => {
      const wrong = await apiRequest(request, 'post', '/api/auth/login', {
        data: { identifier: primaryAccount.email, password: 'wrong-password' },
        ok: false,
      });
      expect(wrong.response.status()).toBeGreaterThanOrEqual(400);
      const { body: me } = await apiGet(request, '/api/auth/me', primary.token);
      expect(me.email).toBe(primaryAccount.email);
      await qaReport('auth contract', 'expected bad login rejected and /me profile returned', `actual /me email ${me.email}`);
    });

    let audit;
    await qaStep('Audit endpoint rejects invalid input and creates verdict rows for valid input', async () => {
      const empty = await apiRequest(request, 'post', '/api/audit/run', { data: {}, token: primary.token, ok: false });
      expect(empty.response.status()).toBeGreaterThanOrEqual(400);
      const tooShort = await apiRequest(request, 'post', '/api/audit/run', {
        data: { claimText: 'too short', evidenceText: 'too short' },
        token: primary.token,
        ok: false,
      });
      expect(tooShort.response.status()).toBeGreaterThanOrEqual(400);
      const { body } = await apiPost(request, '/api/audit/run', auditPayload(runId), primary.token);
      audit = body;
      expect(audit.id).toBeTruthy();
      expect(audit.verdicts.length).toBeGreaterThan(0);
      await qaReport('audit run', 'expected valid audit with verdicts', `actual id ${audit.id}, verdicts ${audit.verdicts.length}, score ${audit.score}`);
    });

    await qaStep('Audit detail, summary, progress, snapshot, history, export, templates and states respond', async () => {
      const { body: detail } = await apiGet(request, `/api/audit/${audit.id}`, primary.token);
      const { body: summary } = await apiGet(request, `/api/audit/${audit.id}/summary`, primary.token);
      const { body: progress } = await apiGet(request, `/api/audit/${audit.id}/progress`, primary.token);
      const { body: snapshot } = await apiGet(request, `/api/audit/${audit.id}/snapshot`, primary.token);
      const { body: history } = await apiGet(request, '/api/audit/history', primary.token);
      const { body: templates } = await apiGet(request, '/api/audit/templates', primary.token);
      const { body: states } = await apiGet(request, '/api/audit/states', primary.token);
      const exported = await apiRequest(request, 'get', `/api/audit/${audit.id}/export`, { token: primary.token });
      expect(detail.id).toBe(audit.id);
      expect(Object.keys(summary).length).toBeGreaterThan(0);
      expect(progress).toBeTruthy();
      expect(snapshot).toBeTruthy();
      expect(Array.isArray(history)).toBeTruthy();
      expect(Array.isArray(templates)).toBeTruthy();
      expect(Array.isArray(states)).toBeTruthy();
      expect(String(exported.body).length).toBeGreaterThan(50);
      await qaReport('audit read endpoints', 'expected all audit reads/export to respond', `actual history ${history.length}, templates ${templates.length}, states ${states.length}`);
    });

    await qaStep('Admin rejects missing/wrong auth and supports lists, settings, table targets, verdict edit and soft deletes', async () => {
      const badAdmin = await apiRequest(request, 'post', '/api/admin/login', {
        data: { username: 'admin', password: 'bad-password' },
        ok: false,
      });
      expect(badAdmin.response.status()).toBeGreaterThanOrEqual(400);
      const missingToken = await apiRequest(request, 'get', '/api/admin/audits', { ok: false });
      expect(missingToken.response.status()).toBeGreaterThanOrEqual(401);
      const adminHeaders = { 'X-Admin-Token': adminToken };
      const audits = await apiRequest(request, 'get', '/api/admin/audits?limit=10', { headers: adminHeaders });
      const logs = await apiRequest(request, 'get', '/api/admin/logs?limit=10', { headers: adminHeaders });
      const users = await apiRequest(request, 'get', '/api/admin/users?limit=10', { headers: adminHeaders });
      const settings = await apiRequest(request, 'get', '/api/admin/settings', { headers: adminHeaders });
      const targets = await apiRequest(request, 'get', '/api/admin/table-clear-targets', { headers: adminHeaders });
      expect(Array.isArray(audits.body)).toBeTruthy();
      expect(Array.isArray(logs.body)).toBeTruthy();
      expect(Array.isArray(users.body)).toBeTruthy();
      expect(settings.body.requireEmailVerification).toBeDefined();
      expect(Array.isArray(targets.body)).toBeTruthy();
      if (audit.verdicts[0]?.id) {
        const verdict = await apiRequest(request, 'patch', `/api/admin/verdicts/${audit.verdicts[0].id}`, {
          headers: adminHeaders,
          data: { status: 'SUPPORTED', confidence: 'HIGH', reasonCategory: 'QA override', explanation: 'QA verified override path.' },
        });
        expect(verdict.body.status).toBe('SUPPORTED');
      }
      await qaReport('admin contract', 'expected admin security, lists, settings, targets, verdict update', `actual audits ${audits.body.length}, logs ${logs.body.length}, users ${users.body.length}, clear targets ${targets.body.length}`);
    });

    await qaStep('Projects, candidates, notes, OSINT and messages contracts work', async () => {
      const project = await createProjectViaApi(request, primary.token, `QA API Project ${runId}`);
      const candidate = await createCandidateViaApi(request, primary.token, project.id, `QA Candidate ${runId}`);
      const { body: fetchedCandidate } = await apiGet(request, `/api/projects/${project.id}/candidates/${candidate.id}`, primary.token);
      expect(fetchedCandidate.name).toBe(candidate.name);
      const { body: reanalyzed } = await apiPost(request, `/api/projects/${project.id}/candidates/${candidate.id}/reanalyze`, {}, primary.token);
      expect(reanalyzed.id).toBe(candidate.id);
      const { body: osint } = await apiPost(request, `/api/projects/${project.id}/candidates/${candidate.id}/osint/run`, {
        state: 'strict-war-ai',
        checks: ['profile-search', 'project-scan'],
      }, primary.token);
      expect(osint.sources.length).toBeGreaterThan(0);
      const { body: note } = await apiPost(request, `/api/projects/${project.id}/candidates/${candidate.id}/notes`, {
        type: 'QA',
        decision: 'INTERVIEW',
        body: 'QA automation note verifies reviewer note persistence.',
      }, primary.token);
      expect(note.body).toContain('QA automation note');
      const { body: notes } = await apiGet(request, `/api/projects/${project.id}/candidates/${candidate.id}/notes`, primary.token);
      expect(notes.some((row) => row.id === note.id)).toBeTruthy();
      const { body: message } = await apiPost(request, '/api/messages', {
        to: primaryAccount.email,
        subject: `QA self message ${runId}`,
        body: 'QA automation verifies message creation and patch.',
      }, primary.token);
      expect(message.subject).toContain('QA self message');
      const { body: patched } = await apiPatch(request, `/api/messages/${message.id}`, { read: true, starred: true }, primary.token);
      expect(patched.read).toBe(true);
      expect(patched.starred).toBe(true);
      await apiDelete(request, `/api/projects/${project.id}/candidates/${candidate.id}`, primary.token);
      await qaReport('project/candidate/message contracts', 'expected create/read/update/delete paths', `actual project ${project.id}, candidate ${candidate.id}, note ${note.id}, message ${message.id}`);
    });

    await qaStep('Telemetry accepts valid event and rejects invalid event', async () => {
      const valid = await apiRequest(request, 'post', '/api/telemetry', {
        data: { action: 'QA_PLAYWRIGHT', target: 'api-contract', detail: `run=${runId}` },
      });
      expect(valid.response.ok()).toBeTruthy();
      const invalid = await apiRequest(request, 'post', '/api/telemetry', {
        data: { action: '', target: 'api-contract' },
        ok: false,
      });
      expect(invalid.response.status()).toBeGreaterThanOrEqual(400);
      await qaReport('telemetry contract', 'expected valid logged and invalid rejected', `actual invalid status ${invalid.response.status()}`);
    });
  });
});

function auditPayload(runId) {
  return {
    claimTitle: `QA Audit ${runId}`,
    evidenceTitle: 'QA Evidence',
    claimText: 'Candidate claims five years of Java backend experience, production authentication ownership, SQL schema design, and senior-level leadership on multiple APIs.',
    evidenceText: 'Evidence shows one junior Java API project, a small authentication demo, SQL coursework, and no confirmed senior leadership ownership. GitHub activity is limited but relevant.',
    auditMode: 'job-cv',
    templateId: '',
    checkStateId: 'strict-war-ai',
  };
}
