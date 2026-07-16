import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFromPath, pathForRoute } from '../src/navigation.js';
import { auditScoreLevel } from '../src/utils/auditScore.js';
import { normaliseCandidate, normaliseProject, normaliseUser } from '../src/api.js';
import { clearAdminToken, clearUserToken, readAdminToken, readUserToken, writeAdminToken, writeUserToken } from '../src/sessionAuth.js';

test('direct routes resolve to the expected application view', () => {
    assert.deepEqual(routeFromPath('/projects/12/candidates/9/report'), { route: 'candidateReport' });
    assert.deepEqual(routeFromPath('/audit/42/profile'), { route: 'auditProfile', auditId: 42 });
    assert.deepEqual(routeFromPath('/does-not-exist'), { route: 'notFound', pathname: '/does-not-exist' });
    assert.equal(pathForRoute('candidateDetail', 12, 9), '/projects/12/candidates/9');
});

test('audit scores map to bounded ten-level explanations', () => {
    assert.equal(auditScoreLevel(0), 1);
    assert.equal(auditScoreLevel(20), 2);
    assert.equal(auditScoreLevel(79), 8);
    assert.equal(auditScoreLevel(100), 10);
    assert.equal(auditScoreLevel(500), 10);
});

test('candidate API payloads keep server memory and evidence fields', () => {
    const candidate = normaliseCandidate({
        id: 7,
        name: 'Nino',
        candidate_email: 'nino@example.com',
        score: 82,
        match: 76,
        memory: 'Returning candidate',
        analysis_state: 'war',
        initialized_analysis_states: ['strict-war-ai', 'war'],
        memory_history: [{ projectTitle: 'Backend', score: 71 }],
        audit_phrase_matches: [{ keyword: 'expert' }],
    });
    assert.equal(candidate.score, 82);
    assert.equal(candidate.memory, 'Returning candidate');
    assert.equal(candidate.analysisState, 'war');
    assert.deepEqual(candidate.initializedAnalysisStates, ['strict-war-ai', 'war']);
    assert.equal(candidate.memoryHistory.length, 1);
    assert.equal(candidate.auditPhraseMatches[0].keyword, 'expert');
});

test('user normalization keeps server notification preferences', () => {
    const user = normaliseUser({
        id: 4,
        username: 'nino',
        email: 'nino@example.com',
        messageNotificationsEnabled: false,
        messageNotificationsMutedUntil: null,
    });
    assert.equal(user.messageNotificationsEnabled, false);
    assert.equal(user.messageNotificationsMutedUntil, null);
});

test('message normalization preserves explicit unread state', async () => {
    const { normaliseMessage } = await import('../src/api.js');
    const message = normaliseMessage({ id: 8, from: 'a@example.com', to: 'b@example.com', read: false, manual_unread: true });
    assert.equal(message.read, false);
    assert.equal(message.manualUnread, true);
});

test('message rows expose separate keyboard controls for open, star, and read state', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/MessagesPage.jsx', import.meta.url), 'utf8'));
    assert.match(source, /className="messageRowOpen"/);
    assert.match(source, /className="messageStarButton"/);
    assert.match(source, /aria-pressed=\{message\.starred\}/);
    assert.match(source, /aria-label=\{`Mark \$\{message\.subject\} as/);
});

test('message folders search and paginate large mailboxes', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/MessagesPage.jsx', import.meta.url), 'utf8'));
    assert.match(source, /MESSAGE_PAGE_SIZE = 30/);
    assert.match(source, /type="search"/);
    assert.match(source, /pagedMessages\.map/);
    assert.match(source, /Page \{page\} of \{pageCount\}/);
});

test('team loading failures preserve the last successful member state', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/projects/ProjectTeamPage.jsx', import.meta.url), 'utf8'));
    assert.doesNotMatch(source, /apiListProjectMembers\(project\.id, userToken\)\.catch\(\(\) => \[\]\)/);
    assert.match(source, /The last successfully loaded member list is still shown\./);
    assert.match(source, /Team sync failed\./);
});

test('registration API accepts the reviewed profile fields', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/api.js', import.meta.url), 'utf8'));
    assert.match(source, /country:\s*country \|\| 'Unspecified'/);
    assert.match(source, /address:\s*address \|\| 'Unspecified'/);
    assert.match(source, /role:\s*role \|\| 'Analyst'/);
});

test('project normalization preserves server permissions and candidates', () => {
    const project = normaliseProject({
        id: 3,
        title: 'Platform',
        owner_id: 1,
        my_role: 'Reviewer',
        my_permissions: ['canView', 'canVote'],
        candidates: [{ id: 5, name: 'Ana' }],
    });
    assert.equal(project.ownerId, 1);
    assert.deepEqual(project.myPermissions, ['canView', 'canVote']);
    assert.equal(project.candidates[0].name, 'Ana');
});

test('authentication tokens stay tab scoped and purge legacy persistent copies', () => {
    const previousWindow = globalThis.window;
    const localStorage = memoryStorage({ verdictUserToken: 'legacy-user', verdictAdminToken: 'legacy-admin' });
    const sessionStorage = memoryStorage();
    globalThis.window = { localStorage, sessionStorage };
    try {
        assert.equal(readUserToken(), '');
        assert.equal(readAdminToken(), '');
        assert.equal(localStorage.getItem('verdictUserToken'), null);
        assert.equal(localStorage.getItem('verdictAdminToken'), null);

        writeUserToken('tab-user');
        writeAdminToken('tab-admin');
        assert.equal(readUserToken(), 'tab-user');
        assert.equal(readAdminToken(), 'tab-admin');
        assert.equal(localStorage.getItem('verdictUserToken'), null);

        clearUserToken();
        clearAdminToken();
        assert.equal(sessionStorage.getItem('verdictUserToken'), null);
        assert.equal(sessionStorage.getItem('verdictAdminToken'), null);
    } finally {
        globalThis.window = previousWindow;
    }
});

test('audit detail exposes persisted LLM usage and estimated cost', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/AuditAnalysisPages.jsx', import.meta.url), 'utf8'));
    assert.match(source, /label="Prompt tokens" value=\{audit\.promptTokens \|\| 0\}/);
    assert.match(source, /label="Completion tokens" value=\{audit\.completionTokens \|\| 0\}/);
    assert.match(source, /label="Total tokens" value=\{audit\.totalTokens \|\| 0\}/);
    assert.match(source, /label="Estimated cost" value=\{formatAuditCost\(audit\.estimatedCostUsd\)\}/);
});

test('admin destructive maintenance separates demo data from real table groups', async () => {
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/AdminPage.jsx', import.meta.url), 'utf8'));
    assert.match(source, /Demo data preset/);
    assert.match(source, /Regular user work is preserved\./);
    assert.match(source, /regularClearTargets\.map/);
    assert.match(source, /target\?\.demoPreset/);
});

test('logged-in messages never fall back to persistent browser authority', async () => {
    const [storeSource, pageSource] = await Promise.all([
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/messageStore.js', import.meta.url), 'utf8')),
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/MessagesPage.jsx', import.meta.url), 'utf8')),
    ]);
    assert.match(storeSource, /sessionStorage\.getItem/);
    assert.match(storeSource, /sessionStorage\.setItem/);
    assert.doesNotMatch(storeSource, /localStorage\.setItem/);
    assert.match(pageSource, /if \(userToken\) \{\s*apiUpdateMessage/);
});

test('project and audit route failures expose retry actions without clearing saved data', async () => {
    const [appSource, auditSource] = await Promise.all([
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')),
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/AuditAnalysisPages.jsx', import.meta.url), 'utf8')),
    ]);
    assert.doesNotMatch(appSource, /catch \(err\) \{\s*setHistory\(\[\]\)/);
    assert.match(appSource, /PROJECT_DATA_ROUTES\.has\(route\).*projectsError/s);
    assert.match(auditSource, /Audit detail failed to load\./);
    assert.match(auditSource, /Profiling mode failed to load\./);
});

test('SignalTrace exposes backend provenance, check time, and retry recovery', async () => {
    const [pageSource, translations] = await Promise.all([
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/projects/SignalTracePage.jsx', import.meta.url), 'utf8')),
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/i18n.jsx', import.meta.url), 'utf8')),
    ]);
    assert.match(pageSource, /Open public source/);
    assert.match(pageSource, /checked_at/);
    assert.match(pageSource, /onClick=\{runOsintCheck\}/);
    assert.match(pageSource, /Not checked/);
    assert.doesNotMatch(translations, /visual only until the backend SignalTrace engine is connected/);
});

test('candidate match report includes requirement coverage and independent exports', async () => {
    const [pageSource, exportSource] = await Promise.all([
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/projects/CandidateMatchReportPage.jsx', import.meta.url), 'utf8')),
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/projects/candidateReportExports.js', import.meta.url), 'utf8')),
    ]);
    assert.match(pageSource, /Executive Summary/);
    assert.match(pageSource, /Requirement Coverage/);
    assert.match(pageSource, /Print \/ PDF/);
    assert.match(exportSource, /downloadCandidateReportCsv/);
    assert.match(exportSource, /downloadCandidateReportText/);
    assert.match(exportSource, /URL\.createObjectURL/);
});

test('global compose behavior is isolated from the application router', async () => {
    const [appSource, composeSource] = await Promise.all([
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')),
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/components/GlobalCompose.jsx', import.meta.url), 'utf8')),
    ]);
    assert.match(appSource, /import \{ GlobalCompose \}/);
    assert.doesNotMatch(appSource, /function GlobalCompose/);
    assert.match(composeSource, /apiLookupUser/);
    assert.match(composeSource, /apiSendMessage/);
    assert.match(composeSource, /role="dialog"/);
});

test('authentication wizard is isolated as a lazy route page', async () => {
    const [appSource, authSource] = await Promise.all([
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')),
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/AuthPage.jsx', import.meta.url), 'utf8')),
    ]);
    assert.match(appSource, /lazyNamed\(\(\) => import\('\.\/pages\/AuthPage'\)/);
    assert.doesNotMatch(appSource, /function AuthPage/);
    assert.match(authSource, /apiLogin/);
    assert.match(authSource, /apiRegister/);
    assert.match(authSource, /Ready to create this workspace account/);
});

test('audit detail and profiling presentation are isolated from the app router', async () => {
    const [appSource, auditSource] = await Promise.all([
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8')),
        import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/pages/AuditAnalysisPages.jsx', import.meta.url), 'utf8')),
    ]);
    assert.doesNotMatch(appSource, /function AuditDetailPage/);
    assert.doesNotMatch(appSource, /function ProfilingModePage/);
    assert.match(auditSource, /export function AuditDetailPage/);
    assert.match(auditSource, /export function ProfilingModePage/);
    assert.match(auditSource, /export function AuditResult/);
});

function memoryStorage(initial = {}) {
    const rows = new Map(Object.entries(initial));
    return {
        getItem: (key) => rows.has(key) ? rows.get(key) : null,
        setItem: (key, value) => rows.set(key, String(value)),
        removeItem: (key) => rows.delete(key),
    };
}
