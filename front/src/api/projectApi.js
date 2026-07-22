import { get, post, patch, del } from '../http';
import { normaliseProject } from '../normalizers';

export async function apiListProjects(token) {
    return get('/projects', token);
}

export async function apiListProjectsPage({ page = 0, size = 25, search = '' } = {}, token) {
    const params = new URLSearchParams({ page: String(page), size: String(size), search });
    return get(`/projects/page?${params}`, token);
}

export async function apiGetProject(id, token) {
    return get(`/projects/${id}`, token);
}

export async function apiCreateProject({ title, department, location, description, requirements, rubric, state, status }, token) {
    return post('/projects', { title, department, location, description, requirements, rubric, state, status }, token);
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

export async function apiListProjectAnnouncements(id, token) {
    return get(`/projects/${id}/announcements`, token);
}

export async function apiCreateProjectAnnouncement(id, body, pinned, token) {
    return post(`/projects/${id}/announcements`, { body, pinned }, token);
}

export async function apiPinProjectAnnouncement(id, announcementId, pinned, token) {
    return patch(`/projects/${id}/announcements/${announcementId}`, { pinned }, token);
}

export async function apiDeleteProjectAnnouncement(id, announcementId, token) {
    return del(`/projects/${id}/announcements/${announcementId}`, token);
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
