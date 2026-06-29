export function projectTotals(projects) {
    const candidates = projects.reduce((sum, project) => sum + project.candidates.length, 0);
    const shortlisted = projects.reduce((sum, project) => sum + project.candidates.filter((candidate) => candidate.score >= 80).length, 0);
    const highRisk = projects.reduce((sum, project) => sum + project.candidates.filter((candidate) => candidate.risk === 'High').length, 0);
    return {
        candidates,
        shortlistRate: Math.round((shortlisted / Math.max(1, candidates)) * 100),
        highRisk,
    };
}

export function candidateTotals(candidates) {
    const averageScore = Math.round(candidates.reduce((sum, candidate) => sum + candidate.score, 0) / Math.max(1, candidates.length));
    const shortlistRate = Math.round((candidates.filter((candidate) => candidate.score >= 80).length / Math.max(1, candidates.length)) * 100);
    const highRisk = candidates.filter((candidate) => candidate.risk === 'High').length;
    return { averageScore, shortlistRate, highRisk };
}

export function bestCandidate(candidates) {
    return [...candidates].sort((a, b) => b.score - a.score)[0] || candidates[0];
}

export function findProjectFromPath(projects) {
    const match = window.location.pathname.match(/^\/projects\/([^/]+)/);
    return (projects || []).find((project) => sameId(project.id, match?.[1]));
}

export function findCandidateFromPath(projects) {
    const match = window.location.pathname.match(/^\/projects\/([^/]+)\/candidates\/([^/]+)(?:\/(?:signaltrace|profile))?$/);
    const project = (projects || []).find((item) => sameId(item.id, match?.[1]));
    const candidate = project?.candidates.find((item) => sameId(item.id, match?.[2]));
    return { project, candidate };
}

function sameId(left, right) {
    return String(left ?? '') === String(right ?? '');
}

export function formatShortDate(value) {
    return new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function scoreTone(score) {
    if (score >= 80) return 'scoreGood';
    if (score >= 55) return 'scoreWarn';
    return 'scoreBad';
}

export function workModeInfo(project, t) {
    const location = `${project.location || ''}`.toLowerCase();
    if (location.includes('remote')) {
        return { key: 'remote', label: t('remote'), description: t('remoteText') };
    }
    if (location.includes('hybrid')) {
        return { key: 'hybrid', label: t('hybrid'), description: t('hybridText') };
    }
    return { key: 'onsite', label: t('onsite'), description: t('onsiteText') };
}

export function scorePercent(value, candidate) {
    return (value / Math.max(1, candidate.supported + candidate.stretched + candidate.unsupported)) * 100;
}

export const PAGE_SIZE = 10;

export function pageCount(items, pageSize = PAGE_SIZE) {
    return Math.max(1, Math.ceil(items.length / pageSize));
}

export function pageItems(items, page, pageSize = PAGE_SIZE) {
    const start = (page - 1) * pageSize;
    return items.slice(start, start + pageSize);
}

export function clampPage(page, items, pageSize = PAGE_SIZE) {
    return Math.min(Math.max(1, page), pageCount(items, pageSize));
}
