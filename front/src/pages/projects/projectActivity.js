export function readProjectActivity(projectId) {
    if (!projectId) return [];
    try {
        return JSON.parse(localStorage.getItem(activityKey(projectId)) || '[]');
    } catch {
        return [];
    }
}

export function recordProjectActivity(projectId, user, details = {}) {
    if (!projectId) return null;
    const actorEmail = user?.email || user?.username || details.actorEmail || 'unknown';
    const entry = {
        id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
        type: details.type || 'activity',
        action: details.action || 'updated project',
        actorEmail,
        actorName: user?.fullName || user?.username || details.actorName || actorEmail,
        targetEmail: details.targetEmail || '',
        targetName: details.targetName || '',
        candidateId: details.candidateId || '',
        candidateName: details.candidateName || '',
        projectTitle: details.projectTitle || '',
        severity: details.severity || severityFor(details.type || details.action),
        detail: details.detail || '',
        createdAt: new Date().toISOString(),
    };
    const rows = readProjectActivity(projectId);
    const last = rows[0];
    if (
        last?.actorEmail === entry.actorEmail
        && last?.targetEmail === entry.targetEmail
        && last?.candidateId === entry.candidateId
        && last?.action === entry.action
        && Date.now() - Date.parse(last.createdAt) < 5000
    ) {
        return last;
    }
    localStorage.setItem(activityKey(projectId), JSON.stringify([entry, ...rows].slice(0, 500)));
    return entry;
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

function activityKey(projectId) {
    return `projectActivity:${projectId}`;
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
