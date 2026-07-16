import { candidateSourceText, projectDescriptionText } from './atsReportUtils';

export function buildRequirementRows(project = {}, candidate = {}) {
    const claims = candidate.claims || [];
    return (project.requirements || []).map((requirement) => {
        const normalizedRequirement = normalize(requirement);
        const direct = claims.find(([claim]) => {
            const normalizedClaim = normalize(claim);
            return normalizedClaim.includes(normalizedRequirement) || normalizedRequirement.includes(normalizedClaim);
        });
        if (direct) {
            return {
                requirement,
                status: direct[1] || 'Needs review',
                evidence: direct[2] || 'Candidate claim is present without attached evidence.',
            };
        }
        const resumeHasRequirement = normalize(candidateSourceText(candidate)).includes(normalizedRequirement);
        return {
            requirement,
            status: resumeHasRequirement ? 'Mentioned' : 'Gap',
            evidence: resumeHasRequirement
                ? 'The requirement appears in the resume text but has no structured proof verdict.'
                : 'No direct matching evidence was found in the stored resume or candidate claims.',
        };
    });
}

export function buildExecutiveSummary(project = {}, candidate = {}, report = {}) {
    const requirements = buildRequirementRows(project, candidate);
    const supported = requirements.filter((row) => ['Supported', 'Mentioned'].includes(row.status)).length;
    const risks = Number(candidate.unsupported || 0) + Number(candidate.stretched || 0);
    return `${candidate.name} has a ${report.score || 0}% match for ${project.title}. `
        + `${supported} of ${requirements.length} role requirements have visible evidence or a resume mention. `
        + `${report.matchedSkills?.length || 0} requested skill signals match, ${report.missingSkills?.length || 0} are missing, `
        + `and ${risks} candidate claims need stronger proof or review.`;
}

export function downloadCandidateReportText(project, candidate, report) {
    const requirements = buildRequirementRows(project, candidate);
    const lines = [
        'VERDICT CANDIDATE MATCH REPORT',
        `Project: ${project.title}`,
        `Candidate: ${candidate.name}`,
        `Role: ${candidate.role || project.title}`,
        `Match score: ${report.score}%`,
        `Generated: ${new Date().toISOString()}`,
        '',
        'EXECUTIVE SUMMARY',
        buildExecutiveSummary(project, candidate, report),
        '',
        'REQUIREMENT COVERAGE',
        ...requirements.map((row) => `[${row.status}] ${row.requirement} - ${row.evidence}`),
        '',
        'SKILL COMPARISON',
        ...report.skills.map((row) => `${row.label}: resume=${row.resumeCount}, job=${row.jobCount}, status=${row.status}`),
        '',
        'RECRUITER TIPS',
        ...report.recruiterRows.map((row) => `[${row.ok ? 'PASS' : 'ACTION'}] ${row.label}: ${row.text}`),
        '',
        'RESUME TEXT',
        candidateSourceText(candidate),
        '',
        'JOB DESCRIPTION',
        projectDescriptionText(project),
    ];
    downloadFile(`${fileStem(project, candidate)}.txt`, lines.join('\n'), 'text/plain;charset=utf-8');
}

export function downloadCandidateReportCsv(project, candidate, report) {
    const rows = [
        ['section', 'item', 'status', 'resume_count', 'job_count', 'detail'],
        ...buildRequirementRows(project, candidate).map((row) => ['requirement', row.requirement, row.status, '', '', row.evidence]),
        ...report.skills.map((row) => ['skill', row.label, row.status, row.resumeCount, row.jobCount, '']),
        ...report.searchabilityRows.map((row) => ['searchability', row.label, row.ok ? 'pass' : 'action', '', '', row.text]),
        ...report.recruiterRows.map((row) => ['recruiter_tip', row.label, row.ok ? 'pass' : 'action', '', '', row.text]),
        ...report.formattingRows.map((row) => ['formatting', row.label, row.ok ? 'pass' : 'action', '', '', row.text]),
    ];
    downloadFile(`${fileStem(project, candidate)}.csv`, rows.map((row) => row.map(csvCell).join(',')).join('\n'), 'text/csv;charset=utf-8');
}

function fileStem(project, candidate) {
    return `${project.title}-${candidate.name}-match-report`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function downloadFile(name, content, type) {
    const url = URL.createObjectURL(new Blob([content], { type }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = name;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
}

function csvCell(value) {
    const text = String(value ?? '');
    return `"${text.replaceAll('"', '""')}"`;
}

function normalize(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();
}
