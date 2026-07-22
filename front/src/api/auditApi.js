import { get, post, multipart } from '../http';

export async function apiAuditHistory(token) {
    return get('/audit/history', token);
}

export async function apiAuditTemplates(token) {
    return get('/audit/templates', token);
}

export async function apiAuditStates(token) {
    return get('/audit/states', token);
}

export async function apiCreateAuditTemplate(token, template) {
    return post('/audit/templates', template, token);
}

export async function apiRunAudit(payload, token) {
    return post('/audit/run-async', payload, token);
}

export async function apiExtractAuditFile(file, token) {
    const formData = new FormData();
    formData.append('file', file);
    return multipart('/audit/extract-file', formData, token);
}

export async function apiGetAudit(id, token) {
    return get(`/audit/${id}`, token);
}
