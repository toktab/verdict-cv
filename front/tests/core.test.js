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
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'));
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
    const source = await import('node:fs/promises').then((fs) => fs.readFile(new URL('../src/App.jsx', import.meta.url), 'utf8'));
    assert.doesNotMatch(source, /catch \(err\) \{\s*setHistory\(\[\]\)/);
    assert.match(source, /PROJECT_DATA_ROUTES\.has\(route\).*projectsError/s);
    assert.match(source, /Audit detail failed to load\./);
    assert.match(source, /Profiling mode failed to load\./);
});

function memoryStorage(initial = {}) {
    const rows = new Map(Object.entries(initial));
    return {
        getItem: (key) => rows.has(key) ? rows.get(key) : null,
        setItem: (key, value) => rows.set(key, String(value)),
        removeItem: (key) => rows.delete(key),
    };
}
