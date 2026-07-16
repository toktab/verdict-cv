import test from 'node:test';
import assert from 'node:assert/strict';
import { routeFromPath, pathForRoute } from '../src/navigation.js';
import { auditScoreLevel } from '../src/utils/auditScore.js';
import { normaliseCandidate, normaliseProject } from '../src/api.js';

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
        memory_history: [{ projectTitle: 'Backend', score: 71 }],
        audit_phrase_matches: [{ keyword: 'expert' }],
    });
    assert.equal(candidate.score, 82);
    assert.equal(candidate.memory, 'Returning candidate');
    assert.equal(candidate.memoryHistory.length, 1);
    assert.equal(candidate.auditPhraseMatches[0].keyword, 'expert');
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
