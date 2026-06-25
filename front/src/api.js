const jsonHeaders = { 'Content-Type': 'application/json' };

async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    let code = 'REQUEST_FAILED';
    try {
      const body = await response.json();
      message = body.message || message;
      code = body.code || code;
    } catch {
      // Keep fallback message.
    }
    const error = new Error(message);
    error.code = code;
    throw error;
  }
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export const api = {
  register(payload) {
    return request('/api/auth/register', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },
  login(payload) {
    return request('/api/auth/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },
  me(token) {
    return request('/api/auth/me', { headers: { 'X-User-Token': token } });
  },
  updateMe(token, payload) {
    return request('/api/auth/me', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'X-User-Token': token },
      body: JSON.stringify(payload),
    });
  },
  logout(token) {
    return request('/api/auth/logout', { method: 'POST', headers: { 'X-User-Token': token } });
  },
  runAudit(payload, token) {
    return request('/api/audit/run', {
      method: 'POST',
      headers: { ...jsonHeaders, 'X-User-Token': token },
      body: JSON.stringify(payload),
    });
  },
  history(token) {
    return request('/api/audit/history', { headers: { 'X-User-Token': token } });
  },
  getAudit(id, token) {
    return request(`/api/audit/${id}`, { headers: { 'X-User-Token': token } });
  },
  exportAudit(id, token) {
    return request(`/api/audit/${id}/export`, { headers: { 'X-User-Token': token } });
  },
  adminLogin(payload) {
    return request('/api/admin/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },
  adminAudits(token, offset = 0, limit = 20) {
    return request(`/api/admin/audits?offset=${offset}&limit=${limit}`, { headers: { 'X-Admin-Token': token } });
  },
  adminAudit(token, id) {
    return request(`/api/admin/audits/${id}`, { headers: { 'X-Admin-Token': token } });
  },
  adminLogs(token, offset = 0, limit = 20) {
    return request(`/api/admin/logs?offset=${offset}&limit=${limit}`, { headers: { 'X-Admin-Token': token } });
  },
  adminUsers(token, offset = 0, limit = 20) {
    return request(`/api/admin/users?offset=${offset}&limit=${limit}`, { headers: { 'X-Admin-Token': token } });
  },
  createUser(token, payload) {
    return request('/api/admin/users', {
      method: 'POST',
      headers: { ...jsonHeaders, 'X-Admin-Token': token },
      body: JSON.stringify(payload),
    });
  },
  updateUser(token, id, payload) {
    return request(`/api/admin/users/${id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'X-Admin-Token': token },
      body: JSON.stringify(payload),
    });
  },
  deleteUser(token, id) {
    return request(`/api/admin/users/${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
  },
  adminSettings(token) {
    return request('/api/admin/settings', { headers: { 'X-Admin-Token': token } });
  },
  updateAdminSettings(token, payload) {
    return request('/api/admin/settings', {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'X-Admin-Token': token },
      body: JSON.stringify(payload),
    });
  },
  deleteAudit(token, id) {
    return request(`/api/admin/audits/${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
  },
  deleteLog(token, id) {
    return request(`/api/admin/logs/${id}`, { method: 'DELETE', headers: { 'X-Admin-Token': token } });
  },
  updateVerdict(token, id, payload) {
    return request(`/api/admin/verdicts/${id}`, {
      method: 'PATCH',
      headers: { ...jsonHeaders, 'X-Admin-Token': token },
      body: JSON.stringify(payload),
    });
  },
  telemetry(payload) {
    return request('/api/telemetry', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    }).catch(() => null);
  },
  health() {
    return request('/api/system/health');
  },
};
