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

export const get = (path, token) => request('GET', path, undefined, token);
export const post = (path, body, token) => request('POST', path, body, token);
export const patch = (path, body, token) => request('PATCH', path, body, token);
export const del = (path, token) => request('DELETE', path, undefined, token);
export { request, multipart, errorMessage };
