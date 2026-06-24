const jsonHeaders = { 'Content-Type': 'application/json' };

async function request(path, options = {}) {
  const response = await fetch(path, options);
  if (!response.ok) {
    let message = `Request failed with ${response.status}`;
    try {
      const body = await response.json();
      message = body.message || message;
    } catch {
      // Keep fallback message.
    }
    throw new Error(message);
  }
  if (response.status === 204) {
    return null;
  }
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json') ? response.json() : response.text();
}

export const api = {
  runAudit(payload) {
    return request('/api/audit/run', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },
  history() {
    return request('/api/audit/history');
  },
  getAudit(id) {
    return request(`/api/audit/${id}`);
  },
  exportAudit(id) {
    return request(`/api/audit/${id}/export`);
  },
  adminLogin(payload) {
    return request('/api/admin/login', {
      method: 'POST',
      headers: jsonHeaders,
      body: JSON.stringify(payload),
    });
  },
  adminAudits(token) {
    return request('/api/admin/audits', { headers: { 'X-Admin-Token': token } });
  },
  adminLogs(token) {
    return request('/api/admin/logs', { headers: { 'X-Admin-Token': token } });
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
};
