import defaultAts from '../../data/default-ats.json';

const STOP_WORDS = new Set(['and', 'the', 'for', 'with', 'from', 'this', 'that', 'you', 'your', 'are', 'was', 'have', 'has', 'into', 'will', 'can', 'our']);

export function candidateSourceText(candidate = {}) {
    return candidate.cvText?.trim() || candidate.summary || 'No original CV text was stored for this candidate.';
}

export function projectDescriptionText(project = {}) {
    const sections = [
        project.description,
        project.requirements?.length ? `What we are looking for:\n${project.requirements.map((item) => `- ${item}`).join('\n')}` : '',
        project.location ? `Location: ${project.location}` : '',
        project.state ? `Audit mode: ${project.state}` : '',
    ];
    return sections.filter(Boolean).join('\n\n') || 'No job description was stored for this project.';
}

export function atsMatchRate(candidate = {}) {
    const score = Number(candidate.match ?? candidate.score ?? 0);
    return Math.max(0, Math.min(100, Math.round(score)));
}

export function buildAtsSkillRows(project = {}, candidate = {}) {
    const resume = normalizeText(candidateSourceText(candidate));
    const job = normalizeText(projectDescriptionText(project));
    const terms = new Map();

    function addTerm(value, source = 'template') {
        const label = String(value || '').trim();
        const normalized = normalizeTerm(label);
        if (!normalized || normalized.length < 2 || STOP_WORDS.has(normalized)) return;
        const display = label.length <= 3 ? label.toUpperCase() : label.replace(/\s+/g, ' ');
        if (!terms.has(normalized)) {
            terms.set(normalized, { label: display, source });
        }
    }

    (project.requirements || []).forEach((requirement) => addTerm(requirement, 'job'));
    (candidate.claims || []).forEach(([claim]) => addTerm(claim, 'resume'));
    (defaultAts.analyzers?.techTerms || []).forEach((term) => addTerm(term, 'template'));
    (defaultAts.rules || []).forEach((rule) => {
        (rule.keywords || []).forEach((keyword) => addTerm(keyword, rule.category || 'template'));
    });

    return [...terms.values()]
        .map((term) => {
            const resumeCount = countTerm(resume, term.label);
            const jobCount = countTerm(job, term.label);
            const status = resumeCount && jobCount ? 'matching' : jobCount ? 'missing' : resumeCount ? 'variation' : 'hidden';
            return {
                ...term,
                resumeCount,
                jobCount,
                status,
                impact: term.source === 'job' || jobCount > 0 ? 'High' : 'Medium',
            };
        })
        .filter((row) => row.status !== 'hidden')
        .sort((left, right) => {
            const order = { missing: 0, matching: 1, variation: 2 };
            return order[left.status] - order[right.status]
                || (right.jobCount + right.resumeCount) - (left.jobCount + left.resumeCount)
                || left.label.localeCompare(right.label);
        })
        .slice(0, 42);
}

export function buildAtsReport(project = {}, candidate = {}) {
    const skills = buildAtsSkillRows(project, candidate);
    const missingSkills = skills.filter((row) => row.status === 'missing');
    const matchedSkills = skills.filter((row) => row.status === 'matching');
    const resumeText = candidateSourceText(candidate);
    const wordCount = (resumeText.match(/\b[\w+#.]+\b/g) || []).length;
    const hasEmail = /[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(resumeText);
    const hasPhone = /(\+?\d[\d\s().-]{7,}\d)/.test(resumeText);
    const hasLink = /https?:\/\/|linkedin\.com|github\.com/i.test(resumeText);
    const score = atsMatchRate(candidate);
    const searchabilityRows = [
        tipRow('Contact Information', hasEmail && hasPhone, hasEmail && hasPhone
            ? 'Email and phone evidence are visible for recruiter contact.'
            : 'Add both email and phone so the ATS record is complete.'),
        tipRow('Summary', /\b(summary|profile|objective)\b/i.test(resumeText), 'A concise summary section helps reviewers understand the candidate quickly.'),
        tipRow('Section Headings', /\b(experience|education|skills|projects)\b/i.test(resumeText), 'Standard sections make resume parsing more reliable.'),
        tipRow('Job Title Match', mentionsAny(resumeText, [project.title, candidate.role]), `Resume should mirror the target role: ${project.title || candidate.role || 'target role'}.`),
        tipRow('Web Presence', hasLink, hasLink ? 'Public profile or portfolio link is present.' : 'Add GitHub, LinkedIn, portfolio, or certificate links when available.'),
    ];
    const recruiterRows = [
        tipRow('Measurable Results', /\b\d+%|\b\d+\s*(users|clients|projects|apis|tests|services)\b/i.test(resumeText), 'Numbers and measurable outcomes make the resume stronger.'),
        tipRow('Resume Tone', (candidate.flags || 0) <= 2, (candidate.flags || 0) <= 2 ? 'Tone is mostly direct and low-risk.' : 'Reduce broad claims and add proof behind strong wording.'),
        tipRow('Proof Coverage', matchedSkills.length >= Math.max(1, missingSkills.length), `${matchedSkills.length} matched skill signal(s), ${missingSkills.length} missing signal(s).`),
        tipRow('Word Count', wordCount >= 180 && wordCount <= 1100, `${wordCount} words detected. Keep resumes focused and scannable.`),
    ];
    const formattingRows = [
        tipRow('File Type', true, 'PDF or DOCX exports are preferred for most ATS workflows.'),
        tipRow('Layout', !/\t{2,}| {8,}/.test(resumeText), 'Avoid complex tables or spacing that can break parsers.'),
        tipRow('Readable Text', wordCount > 40, 'Text extraction returned readable content for this candidate.'),
    ];
    return {
        score,
        skills,
        categories: [
            category('Searchability', searchabilityRows),
            category('Skills', skillsToTipRows(skills)),
            category('Recruiter Tips', recruiterRows),
            category('Formatting', formattingRows),
        ],
        searchabilityRows,
        recruiterRows,
        formattingRows,
        missingSkills,
        matchedSkills,
    };
}

export function splitTextByTerms(text, skills) {
    const terms = skills
        .filter((row) => row.status !== 'hidden')
        .map((row) => ({ ...row, key: normalizeTerm(row.label) }))
        .filter((row) => row.key.length >= 2)
        .sort((left, right) => right.key.length - left.key.length)
        .slice(0, 80);
    if (!terms.length) return [{ text, match: null }];
    const escaped = terms.map((row) => escapeRegExp(row.label)).join('|');
    const regex = new RegExp(`\\b(${escaped})\\b`, 'gi');
    const chunks = [];
    let cursor = 0;
    let match;
    while ((match = regex.exec(text)) !== null) {
        if (match.index > cursor) chunks.push({ text: text.slice(cursor, match.index), match: null });
        const key = normalizeTerm(match[0]);
        const term = terms.find((row) => row.key === key);
        chunks.push({ text: match[0], match: term || null });
        cursor = regex.lastIndex;
    }
    if (cursor < text.length) chunks.push({ text: text.slice(cursor), match: null });
    return chunks;
}

function skillsToTipRows(skills) {
    const missing = skills.filter((row) => row.status === 'missing').length;
    const matched = skills.filter((row) => row.status === 'matching').length;
    const variations = skills.filter((row) => row.status === 'variation').length;
    return [
        tipRow('Matching Skills', matched > 0, `${matched} skill(s) appear in both resume and job description.`),
        tipRow('Missing Skills', missing === 0, missing ? `${missing} job skill(s) were not found in the resume.` : 'No missing job skills detected.'),
        tipRow('Skill Variations', variations <= 4, `${variations} resume-only skill signal(s) may be useful but not requested directly.`),
    ];
}

function category(label, rows) {
    const issues = rows.filter((row) => !row.ok).length;
    return {
        label,
        issues,
        progress: Math.round(((rows.length - issues) / Math.max(1, rows.length)) * 100),
    };
}

function tipRow(label, ok, text) {
    return { label, ok: Boolean(ok), text };
}

function mentionsAny(text, values) {
    return values.filter(Boolean).some((value) => normalizeText(text).includes(normalizeTerm(value)));
}

function countTerm(text, term) {
    const normalized = normalizeTerm(term);
    if (!normalized) return 0;
    const escaped = escapeRegExp(normalized);
    return (text.match(new RegExp(`\\b${escaped}\\b`, 'g')) || []).length;
}

function normalizeText(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9+#.]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeTerm(value) {
    return normalizeText(value).trim();
}

function escapeRegExp(value) {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
