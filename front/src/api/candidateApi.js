import { get, post, patch, del, multipart } from '../http';
import { normaliseCandidate, normaliseWorkflow } from '../normalizers';

export async function apiAddCandidate(projectId, { name, role, cvText }, token) {
    return post(`/projects/${projectId}/candidates`, { name, role, cv_text: cvText || '' }, token);
}

export async function apiListCandidates(projectId, token, { offset = 0, limit = 25 } = {}) {
    const page = await get(`/projects/${projectId}/candidates?offset=${offset}&limit=${limit}`, token);
    return {
        ...page,
        items: (page.items || []).map(normaliseCandidate),
    };
}

export async function apiUploadCandidateResume(projectId, { name, role, resume }, token) {
    const formData = new FormData();
    formData.append('name', name || '');
    formData.append('role', role || '');
    formData.append('resume', resume);
    return multipart(`/projects/${projectId}/candidates/upload`, formData, token);
}

export async function apiGetCandidate(projectId, candidateId, token) {
    return get(`/projects/${projectId}/candidates/${candidateId}`, token);
}

export async function apiReanalyzeCandidate(projectId, candidateId, token) {
    return post(`/projects/${projectId}/candidates/${candidateId}/reanalyze`, {}, token);
}

export async function apiUpdateCandidateAnalysisState(projectId, candidateId, { state, initialize = false }, token) {
    return patch(`/projects/${projectId}/candidates/${candidateId}/analysis-state`, { state, initialize }, token);
}

export async function apiDeleteCandidate(projectId, candidateId, token) {
    return del(`/projects/${projectId}/candidates/${candidateId}`, token);
}

export async function apiRunCandidateOsint(projectId, candidateId, { state, checks, consent = false } = {}, token) {
    return post(`/projects/${projectId}/candidates/${candidateId}/osint/run`, { state, checks: checks || [], consent }, token);
}

export async function apiGetLatestCandidateOsint(projectId, candidateId, token) {
    return get(`/projects/${projectId}/candidates/${candidateId}/osint/latest`, token);
}

export async function apiListCandidateNotes(projectId, candidateId, token) {
    return get(`/projects/${projectId}/candidates/${candidateId}/notes`, token);
}

export async function apiCreateCandidateNote(projectId, candidateId, { type, decision, body }, token) {
    return post(`/projects/${projectId}/candidates/${candidateId}/notes`, { type, decision, body }, token);
}

export async function apiGetCandidateWorkflow(projectId, candidateId, token) {
    return normaliseWorkflow(await get(`/projects/${projectId}/candidates/${candidateId}/workflow`, token));
}

export async function apiVoteCandidate(projectId, candidateId, { action, score }, token) {
    return normaliseWorkflow(await post(`/projects/${projectId}/candidates/${candidateId}/votes`, { action, score }, token));
}

export async function apiUpdateCandidateStatus(projectId, candidateId, { status, reason = '' }, token) {
    return normaliseWorkflow(await patch(`/projects/${projectId}/candidates/${candidateId}/status`, { status, reason }, token));
}
