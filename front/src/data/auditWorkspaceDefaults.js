export const auditModes = {
    cv: {
        name: 'Job / CV audit',
        claimTitle: 'Candidate CV',
        claimSubtitle: 'Paste the CV, application answers, portfolio summary, or interview notes submitted by the candidate.',
        evidenceTitle: 'Job application evidence',
        evidenceSubtitle: 'Paste the job requirements, consented profile links, portfolio notes, references, GitHub or LinkedIn evidence, and organizer comments.',
        actionCopy: 'Audit candidate',
    },
};

export const demoCase = {
    id: 'cv-demo',
    name: 'Job candidate demo',
    auditMode: 'cv',
    claimTitle: 'Backend developer applicant',
    evidenceTitle: 'Role requirements and public evidence',
    claimText: 'Senior backend developer with deep Java experience. Led a team of six engineers. Built production authentication systems and advanced REST APIs. Strong GitHub portfolio with several real projects.',
    evidenceText: 'The job requires backend Java, SQL, authentication, API design, and clear project evidence. Candidate portfolio contains two Java API projects and one authentication demo. LinkedIn lists junior backend developer, not senior lead. GitHub is public but has limited recent activity.',
};

export const demoCases = [
    demoCase,
    {
        id: 'cv-junior-java-demo',
        name: 'Junior Java applicant',
        auditMode: 'cv',
        claimTitle: 'Junior Java backend applicant',
        evidenceTitle: 'Junior Java backend role evidence',
        claimText: 'Junior Java backend developer with Spring Boot, REST API, SQL, JWT authentication, and testing experience. Built a student management API, documented endpoints in Postman, and wrote JUnit tests. Familiar with Docker and CI/CD basics. Fast learner with strong communication skills.',
        evidenceText: 'The role asks for Java, Spring Boot, SQL, REST APIs, authentication basics, JUnit, Git, and clear documentation. Candidate GitHub shows a student management API using Spring Boot, PostgreSQL, JWT login, and 18 JUnit tests. README includes setup steps and Postman examples. No Dockerfile or CI pipeline was found.',
    },
    {
        id: 'cv-leadership-risk-demo',
        name: 'Leadership-risk applicant',
        auditMode: 'cv',
        claimTitle: 'Backend lead applicant',
        evidenceTitle: 'Backend lead role evidence',
        claimText: 'Senior backend lead who owned production architecture, led eight engineers, optimized platform performance by 300%, and delivered world-class authentication infrastructure. Expert in Java, cloud systems, observability, and security.',
        evidenceText: 'The role requires senior backend leadership, production architecture, incident ownership, cloud deployment, observability, and security reviews. Candidate portfolio includes two Java services and a small authentication demo. LinkedIn lists backend developer, not lead. No team-size evidence, production metrics, incident documents, cloud deployment proof, or observability dashboards were supplied.',
    },
];

export const demoTemplates = [
    { id: 'template-cv', mode: 'cv', name: 'Verified CV hiring template', description: 'Checks candidate claims against role needs, profile evidence, and consented public signals.', instructions: 'Flag inflated seniority, unsupported leadership, vague deep-experience claims, missing project proof, weak GitHub evidence, and contradictions between CV, LinkedIn, and portfolio links.', shared: true },
];

export const demoStates = [
    { id: 'state-light', name: 'Light State', description: 'Fast template review for obvious CV contradictions and low-effort exaggeration.' },
    { id: 'state-war', name: 'WAR State', description: 'Strict template review that expects every serious skill or leadership claim to be backed inside the application.' },
    { id: 'state-person', name: 'Person State', description: 'AI-assisted reviewer judgment for polish, tone, credibility, and whether the CV feels genuinely substantiated.' },
    { id: 'state-war-ai', name: 'WAR+AI State', description: 'Highest scrutiny with AI, deterministic rules, optional OSINT escalation, and full claim-by-claim report scoring.' },
];

export function currentAuditMode(form) {
    return auditModes[form.auditMode] || auditModes.cv;
}

export function auditPayload(form) {
    return {
        claimTitle: form.claimTitle,
        evidenceTitle: form.evidenceTitle,
        claimText: form.claimText,
        evidenceText: form.evidenceText,
        auditMode: form.auditMode || 'cv',
        templateId: form.templateId || '',
        checkStateId: form.checkStateId || '',
    };
}

export function emptyTemplateForm(mode = 'cv') {
    return {
        mode,
        name: '',
        description: '',
        instructions: '',
        markUnimportant: 'email, phone, linkedin, github, website, contact',
        shared: false,
    };
}
