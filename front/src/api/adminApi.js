import { get, post, patch, del, request } from '../http';

const BASE = '/api';

export async function apiAdminLogin(payload) {
    return request('POST', '/admin/login', payload);
}

export async function apiAdminAudits(token, offset = 0, limit = 20, search = '') {
    return adminRequest('GET', `/admin/audits?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, undefined, token);
}

export async function apiAdminAudit(token, id) {
    return adminRequest('GET', `/admin/audits/${id}`, undefined, token);
}

export async function apiAdminLogs(token, offset = 0, limit = 20, search = '') {
    return adminRequest('GET', `/admin/logs?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, undefined, token);
}

export async function apiAdminUsers(token, offset = 0, limit = 20, search = '') {
    return adminRequest('GET', `/admin/users?offset=${offset}&limit=${limit}&search=${encodeURIComponent(search)}`, undefined, token);
}

export async function apiAdminSettings(token) {
    return adminRequest('GET', '/admin/settings', undefined, token);
}

export async function apiAdminHealth(token) {
    return adminRequest('GET', '/admin/health', undefined, token);
}

export async function apiAdminAtsTemplates(token) {
    return adminRequest('GET', '/admin/ats-templates', undefined, token);
}

export async function apiPublishAdminAtsTemplate(token, catalogJson, changeNote) {
    return adminRequest('POST', '/admin/ats-templates', { catalogJson, changeNote }, token);
}

export async function apiRollbackAdminAtsTemplate(token, id, changeNote) {
    return adminRequest('POST', `/admin/ats-templates/${id}/rollback`, { changeNote }, token);
}

export async function apiUpdateAdminSettings(token, payload) {
    return adminRequest('PATCH', '/admin/settings', payload, token);
}

export async function apiAdminTableClearTargets(token) {
    return adminRequest('GET', '/admin/table-clear-targets', undefined, token);
}

export async function apiClearAdminTables(token, targets, confirmation) {
    return adminRequest('POST', '/admin/clear-tables', { targets, confirmation }, token);
}

export async function apiAdminCreateUser(token, payload) {
    return adminRequest('POST', '/admin/users', payload, token);
}

export async function apiAdminUpdateUser(token, id, payload) {
    return adminRequest('PATCH', `/admin/users/${id}`, payload, token);
}

export async function apiAdminDeleteUser(token, id) {
    return adminRequest('DELETE', `/admin/users/${id}`, undefined, token);
}

export async function apiAdminDeleteAudit(token, id) {
    return adminRequest('DELETE', `/admin/audits/${id}`, undefined, token);
}

export async function apiAdminDeleteLog(token, id) {
    return adminRequest('DELETE', `/admin/logs/${id}`, undefined, token);
}

export async function apiAdminUpdateVerdict(token, id, payload) {
    return adminRequest('PATCH', `/admin/verdicts/${id}`, payload, token);
}

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
        if (res.status === 401 && typeof window !== 'undefined') {
            window.dispatchEvent(new Event('verdictAdminAuthProblem'));
        }
        throw new Error(msg);
    }
    if (res.status === 204) return null;
    const contentType = res.headers.get('content-type') || '';
    return contentType.includes('application/json') ? res.json() : res.text();
}
