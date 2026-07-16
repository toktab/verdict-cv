import { apiListProjectActivity, apiRecordProjectActivity } from '../../api';

export async function readProjectActivityFromServer(projectId, token) {
    requireServerContext(projectId, token);
    return apiListProjectActivity(projectId, token);
}

export async function recordProjectActivityOnServer(projectId, user, details = {}, token = '') {
    requireServerContext(projectId, token);
    return apiRecordProjectActivity(projectId, {
            type: details.type || 'activity',
            action: details.action || 'updated project',
            target_email: details.targetEmail || '',
            target_name: details.targetName || '',
            candidate_id: details.candidateId || null,
            candidate_name: details.candidateName || '',
            severity: details.severity || severityFor(details.type || details.action),
            detail: details.detail || '',
        }, token);
}

export function projectActivityText(project, rows) {
    const title = project?.title || 'Project';
    const lines = [
        `VERDICT project log: ${title}`,
        `Generated: ${new Date().toLocaleString()}`,
        '',
        ...rows.map((row) => [
            `[${formatActivityDate(row.createdAt)}] ${row.action}`,
            `Actor: ${row.actorName || row.actorEmail || 'unknown'} <${row.actorEmail || 'unknown'}>`,
            row.targetEmail ? `Target: ${row.targetName || row.targetEmail} <${row.targetEmail}>` : '',
            row.candidateName ? `Candidate: ${row.candidateName}${row.candidateId ? ` (#${row.candidateId})` : ''}` : '',
            row.detail ? `Detail: ${row.detail}` : '',
        ].filter(Boolean).join('\n')),
    ];
    return lines.join('\n\n');
}

export function downloadProjectActivity(project, rows) {
    const text = projectActivityText(project, rows);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${slug(project?.title || 'project')}-activity-log.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
}

export function formatActivityDate(value) {
    if (!value) return 'Unknown time';
    return new Date(value).toLocaleString();
}

function severityFor(value = '') {
    const normalized = String(value).toLowerCase();
    if (normalized.includes('delete') || normalized.includes('kick') || normalized.includes('remove')) return 'danger';
    if (normalized.includes('invite') || normalized.includes('create')) return 'good';
    if (normalized.includes('rank') || normalized.includes('role') || normalized.includes('permission')) return 'warn';
    return 'info';
}

function slug(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'project';
}

function requireServerContext(projectId, token) {
    if (!projectId) throw new Error('Project activity requires a project.');
    if (!token) throw new Error('Project activity requires an authenticated session.');
}
