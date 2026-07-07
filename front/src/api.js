const BASE = '/api';

async function request(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        const msg = await errorMessage(res);
        maybeReportAuthProblem(res.status, msg, path, token);
        throw new Error(msg);
    }
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('application/json') ? res.json() : res.text();
}

async function multipart(path, formData, token) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers,
        body: formData,
    });
    if (!res.ok) {
        const msg = await errorMessage(res);
        maybeReportAuthProblem(res.status, msg, path, token);
        throw new Error(msg);
    }
    return res.json();
}

async function errorMessage(res) {
    let msg = `${res.status} ${res.statusText}`;
    try {
        const payload = await res.json();
        msg = payload.message || payload.detail || msg;
    } catch {
        // Keep HTTP fallback.
    }
    return msg;
}

function maybeReportAuthProblem(status, message, path = '', token = '') {
    const authRoute = path.startsWith('/auth/login') || path.startsWith('/auth/register') || path.startsWith('/auth/refresh');
    if ((status === 401 || status === 403) && token && !authRoute && typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('verdictAuthProblem', { detail: { status, message } }));
    }
}

const get = (path, token) => request('GET', path, undefined, token);
const post = (path, body, token) => request('POST', path, body, token);
const patch = (path, body, token) => request('PATCH', path, body, token);
const del = (path, token) => request('DELETE', path, undefined, token);

export async function apiRegister({ username, email, password, fullName, organization }) {
    return post('/auth/register', {
        username,
        email,
        password,
        fullName: fullName || username,
        country: 'Unspecified',
        address: 'Unspecified',
        organization: organization || 'Independent',
        role: 'Analyst',
    });
}

export async function apiLogin({ identifier, password }) {
    return post('/auth/login', { identifier, password });
}

export async function apiMe(token) {
    return get('/auth/me', token);
}

export async function apiLogout(token) {
    return post('/auth/logout', {}, token);
}

export async function apiLookupUser(query, token) {
    return normaliseUser(await get(`/auth/users/lookup?q=${encodeURIComponent(query)}`, token));
}

export async function apiListProjects(token) {
    return get('/projects', token);
}

export async function apiGetProject(id, token) {
    return get(`/projects/${id}`, token);
}

export async function apiCreateProject({ title, department, location, description, requirements, state, status }, token) {
    return post('/projects', { title, department, location, description, requirements, state, status }, token);
}

export async function apiImportJobPostings(token) {
    return post('/projects/import-job-postings', {}, token);
}

export async function apiDeleteProject(id, token) {
    return del(`/projects/${id}`, token);
}

export async function apiGetProjectSettings(id, token) {
    return get(`/projects/${id}/settings`, token);
}

export async function apiSaveProjectSettings(id, settings, token) {
    return patch(`/projects/${id}/settings`, { settings }, token);
}

export async function apiListProjectActivity(id, token) {
    return get(`/projects/${id}/activity`, token);
}

export async function apiRecordProjectActivity(id, details, token) {
    return post(`/projects/${id}/activity`, details, token);
}

export async function apiListProjectAtsTemplates(id, token) {
    return get(`/projects/${id}/ats-templates`, token);
}

export async function apiSaveProjectAtsTemplates(id, templates, token) {
    return post(`/projects/${id}/ats-templates`, templates, token);
}

export async function apiListProjectMemberPermissions(id, token) {
    return get(`/projects/${id}/members/permissions`, token);
}

export async function apiSaveProjectMemberPermissions(id, payload, token) {
    return patch(`/projects/${id}/members/permissions`, payload, token);
}

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

export async function apiDeleteCandidate(projectId, candidateId, token) {
    return del(`/projects/${projectId}/candidates/${candidateId}`, token);
}

export async function apiRunCandidateOsint(projectId, candidateId, { state, checks } = {}, token) {
    return post(`/projects/${projectId}/candidates/${candidateId}/osint/run`, { state, checks: checks || [] }, token);
}

export async function apiListProjectInvites(projectId, token) {
    return get(`/projects/${projectId}/invites`, token);
}

export async function apiListProjectMembers(projectId, token) {
    return get(`/projects/${projectId}/members`, token);
}

export async function apiUpdateProjectMemberRole(projectId, { email, role }, token) {
    return patch(`/projects/${projectId}/members/role`, { email, role }, token);
}

export async function apiRemoveProjectMember(projectId, email, token) {
    return del(`/projects/${projectId}/members?email=${encodeURIComponent(email)}`, token);
}

export async function apiCreateProjectInvite(projectId, { email, role }, token) {
    return post(`/projects/${projectId}/invites`, { email, role }, token);
}

export async function apiAcceptProjectInvite(inviteToken, token) {
    return post(`/projects/invites/accept?token=${encodeURIComponent(inviteToken)}`, {}, token);
}

export async function apiListMessages(token) {
    const rows = await get('/messages', token);
    return rows.map(normaliseMessage);
}

export function apiRealtimeUrl(token) {
    return `${BASE}/realtime?token=${encodeURIComponent(token || '')}`;
}

export async function apiSendMessage({ to, subject, body, replyToMessageId, forwardedFromMessageId }, token) {
    return normaliseMessage(await post('/messages', {
        to,
        subject,
        body,
        reply_to_message_id: replyToMessageId || null,
        forwarded_from_message_id: forwardedFromMessageId || null,
    }, token));
}

export async function apiUpdateMessage(id, payload, token) {
    return normaliseMessage(await patch(`/messages/${id}`, payload, token));
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

export async function apiUpdateCandidateStatus(projectId, candidateId, { status }, token) {
    return normaliseWorkflow(await patch(`/projects/${projectId}/candidates/${candidateId}/status`, { status }, token));
}

export const javaApi = {
    history(token) {
        return get('/audit/history', token);
    },
    templates(token) {
        return get('/audit/templates', token);
    },
    states(token) {
        return get('/audit/states', token);
    },
    createTemplate(token, template) {
        return post('/audit/templates', template, token);
    },
    runAudit(payload, token) {
        return post('/audit/run-async', payload, token);
    },
    extractAuditFile(file, token) {
        const formData = new FormData();
        formData.append('file', file);
        return multipart('/audit/extract-file', formData, token);
    },
    getAudit(id, token) {
        return get(`/audit/${id}`, token);
    },
    updateMe(token, payload) {
        return patch('/auth/me', payload, token);
    },
    adminLogin(payload) {
        return request('POST', '/admin/login', payload);
    },
    adminAudits(token, offset = 0, limit = 20, search = '') {
        return adminRequest('GET', `/admin/audits?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, undefined, token);
    },
    adminAudit(token, id) {
        return adminRequest('GET', `/admin/audits/${id}`, undefined, token);
    },
    adminLogs(token, offset = 0, limit = 20, search = '') {
        return adminRequest('GET', `/admin/logs?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, undefined, token);
    },
    adminUsers(token, offset = 0, limit = 20, search = '') {
        return adminRequest('GET', `/admin/users?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, undefined, token);
    },
    adminSettings(token) {
        return adminRequest('GET', '/admin/settings', undefined, token);
    },
    adminHealth(token) {
        return adminRequest('GET', '/admin/health', undefined, token);
    },
    updateAdminSettings(token, payload) {
        return adminRequest('PATCH', '/admin/settings', payload, token);
    },
    adminTableClearTargets(token) {
        return adminRequest('GET', '/admin/table-clear-targets', undefined, token);
    },
    clearAdminTables(token, targets) {
        return adminRequest('POST', '/admin/clear-tables', { targets }, token);
    },
    createUser(token, payload) {
        return adminRequest('POST', '/admin/users', payload, token);
    },
    updateUser(token, id, payload) {
        return adminRequest('PATCH', `/admin/users/${id}`, payload, token);
    },
    deleteUser(token, id) {
        return adminRequest('DELETE', `/admin/users/${id}`, undefined, token);
    },
    deleteAudit(token, id) {
        return adminRequest('DELETE', `/admin/audits/${id}`, undefined, token);
    },
    deleteLog(token, id) {
        return adminRequest('DELETE', `/admin/logs/${id}`, undefined, token);
    },
    updateVerdict(token, id, payload) {
        return adminRequest('PATCH', `/admin/verdicts/${id}`, payload, token);
    },
};

async function adminRequest(method, path, body, token) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['X-Admin-Token'] = token;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
        let msg = `${res.status} ${res.statusText}`;
        try {
            const payload = await res.json();
            msg = payload.message || payload.detail || msg;
        } catch {
            // Keep HTTP fallback.
        }
        throw new Error(msg);
    }
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('application/json') ? res.json() : res.text();
}

export function normaliseProject(raw) {
    return {
        id: raw.id,
        title: raw.title,
        department: raw.department || '',
        location: raw.location || '',
        description: raw.description || '',
        requirements: raw.requirements || [],
        state: raw.state || 'WAR State',
        status: raw.status || 'Screening',
        ownerId: raw.owner_id || raw.ownerId || null,
        myRole: raw.my_role || raw.myRole || '',
        myPermissions: raw.my_permissions || raw.myPermissions || [],
        openedAt: raw.opened_at ? raw.opened_at.slice(0, 10) : (raw.created_at ? raw.created_at.slice(0, 10) : ''),
        candidates: (raw.candidates || []).map(normaliseCandidate),
    };
}

export function normaliseCandidate(raw) {
    return {
        id: raw.id,
        name: raw.name,
        role: raw.role || '',
        score: raw.score || 0,
        match: raw.match || 0,
        risk: raw.risk || 'Low',
        state: raw.state || 'Pending',
        osint: raw.osint || 'Not started',
        memory: raw.memory || 'No prior record',
        cvText: raw.cv_text || raw.cvText || '',
        resumeFilename: raw.resume_filename || '',
        coreCandidateId: raw.core_candidate_id || '',
        cvId: raw.cv_id || '',
        verificationCaseId: raw.verification_case_id || '',
        submittedAt: raw.submitted_at ? raw.submitted_at.slice(0, 10) : '',
        flags: raw.flags || 0,
        supported: raw.supported || 0,
        stretched: raw.stretched || 0,
        unsupported: raw.unsupported || 0,
        summary: raw.summary || '',
        claims: raw.claims || [],
        auditPhraseMatches: raw.audit_phrase_matches || raw.auditPhraseMatches || [],
    };
}

export function normaliseUser(raw) {
    return {
        id: raw.id,
        username: raw.username,
        email: raw.email,
        fullName: raw.full_name || raw.fullName || '',
        organization: raw.organization || '',
        role: raw.role || 'user',
        emailVerified: raw.email_verified ?? raw.emailVerified ?? true,
    };
}

export function normaliseWorkflow(raw = {}) {
    const summary = raw.vote_summary || raw.voteSummary || {};
    return {
        status: raw.status || 'Unreviewed',
        voteSummary: {
            average: summary.average || '0.0',
            downvotes: summary.downvotes || 0,
            stars: summary.stars || 0,
            starredByMe: Boolean(summary.starred_by_me ?? summary.starredByMe),
            myVote: summary.my_vote || summary.myVote || '',
            myScore: summary.my_score ?? summary.myScore ?? null,
            attribution: summary.attribution || [],
        },
        activity: raw.activity || [],
    };
}

export function normaliseMessage(raw) {
    return {
        id: String(raw.id),
        from: raw.from,
        fromName: raw.from_name || raw.fromName || '',
        to: raw.to,
        subject: raw.subject || 'No subject',
        body: raw.body || '',
        type: raw.type === 'PROJECT_INVITE' ? 'projectInvite' : 'message',
        meta: {
            inviteToken: raw.invite_token || raw.inviteToken || '',
            inviteStatus: raw.invite_status || raw.inviteStatus || '',
            projectId: raw.project_id || raw.projectId || null,
            projectTitle: raw.project_title || raw.projectTitle || '',
        },
        read: Boolean(raw.read),
        starred: Boolean(raw.starred),
        replyToMessageId: raw.reply_to_message_id || raw.replyToMessageId || null,
        forwardedFromMessageId: raw.forwarded_from_message_id || raw.forwardedFromMessageId || null,
        createdAt: raw.created_at || raw.createdAt || new Date().toISOString(),
        serverBacked: true,
    };
}
