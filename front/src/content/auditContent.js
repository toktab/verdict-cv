export const demoCase = {
  auditMode: 'cv',
  claimTitle: 'Candidate CV',
  evidenceTitle: 'Senior Backend Engineer Job Posting',
  claimText:
    'Expert in distributed systems.\nLed a team of 10 engineers.\nImplemented CI/CD pipelines for 5 microservices.\nBuilt REST APIs with Spring Boot and MySQL.\nOptimized cloud costs by 60% in one quarter.',
  evidenceText:
    'Senior Backend Engineer role. Requirements: Java, Spring Boot, REST APIs, MySQL, CI/CD experience, Docker, and distributed systems exposure. Team lead experience preferred. No mention of cloud cost optimization. Candidate portfolio shows one university distributed systems project and a Spring Boot API with MySQL. Deployment notes mention CI/CD pipeline work for microservices.',
};

export const demoCases = [
  {
    id: 'cv-senior-backend',
    name: 'Senior backend CV',
    description: 'Balanced CV example with supported technical claims and one unsupported metric.',
    ...demoCase,
  },
  {
    id: 'sales-ai-platform',
    name: 'AI sales page',
    description: 'Marketing claims with a mix of measurable proof, hype, and missing evidence.',
    auditMode: 'sales',
    claimTitle: 'AI Platform Landing Page',
    evidenceTitle: 'Product Spec and Release Notes',
    claimText:
      'Our platform reduces review time by 70%.\nSOC 2 controls are built into every workflow.\nCustomers can export PDF, Word, Excel, and TXT reports.\nBest-in-class AI understands every document instantly.\nIntegrates with Slack and Jira.',
    evidenceText:
      'Release notes confirm PDF, Word-compatible, Excel-compatible, and TXT exports. Product spec lists Slack integration as planned and Jira integration as unavailable. Internal benchmark shows review time improved by 31% on a 20-document sample. Security roadmap mentions SOC 2 preparation, but no completed SOC 2 audit is provided.',
  },
  {
    id: 'pitch-traction',
    name: 'Investor traction deck',
    description: 'Pitch claims focused on growth, customers, integrations, and team proof.',
    auditMode: 'pitch',
    claimTitle: 'Seed Pitch Deck Claims',
    evidenceTitle: 'Founder Evidence Pack',
    claimText:
      'Revenue grew 3x in the last quarter.\nFive enterprise pilots are active.\nThe team has deep healthcare compliance expertise.\nThe product is production-ready for hospitals.\nThe waitlist includes 1,200 verified buyers.',
    evidenceText:
      'Evidence pack shows two active enterprise pilots and one signed LOI. Revenue spreadsheet shows 42% quarter-over-quarter growth. Founder bios include one healthcare operations advisor and two software engineers. Product readiness checklist marks hospital deployment, SSO, and audit logging as incomplete. Waitlist export contains 1,204 emails but only 312 verified business domains.',
  },
  {
    id: 'report-citations',
    name: 'Research report',
    description: 'Report-style audit with claims, references, numbers, and citation gaps.',
    auditMode: 'report',
    claimTitle: 'Market Research Summary',
    evidenceTitle: 'Reference Notes',
    claimText:
      'Remote hiring increased by 44% across mid-market companies.\nInterview fraud risk is highest in technical roles.\nMost hiring teams now require portfolio verification.\nThe report appendix includes all survey questions.\nThe sample size was 800 respondents.',
    evidenceText:
      'Reference notes cite a 2025 survey of 420 respondents. The survey found 44% of mid-market respondents increased remote hiring. Technical roles were mentioned as a high-risk fraud area, but no ranking by highest risk is included. Appendix includes summary tables but not the full survey questionnaire. Portfolio verification was used by 38% of hiring teams.',
  },
];

export const auditModes = {
  cv: {
    name: 'CV vs job posting',
    claimTitle: 'Candidate document',
    claimSubtitle: 'CV, resume, or profile claims',
    evidenceTitle: 'Job posting',
    evidenceSubtitle: 'Requirements and supporting proof',
    actionCopy: 'Audit CV claims',
  },
  sales: {
    name: 'Sales claim vs source docs',
    claimTitle: 'Sales claim',
    claimSubtitle: 'Marketing, landing page, or pitch claim',
    evidenceTitle: 'Source documents',
    evidenceSubtitle: 'Specs, studies, contracts, or proof',
    actionCopy: 'Audit sales claims',
  },
  pitch: {
    name: 'Pitch deck vs evidence',
    claimTitle: 'Pitch deck claims',
    claimSubtitle: 'Investor-facing assertions',
    evidenceTitle: 'Evidence pack',
    evidenceSubtitle: 'Metrics, research, and source material',
    actionCopy: 'Audit pitch claims',
  },
  report: {
    name: 'Report vs references',
    claimTitle: 'Report claims',
    claimSubtitle: 'Report statements to verify',
    evidenceTitle: 'References',
    evidenceSubtitle: 'Citations, appendices, or datasets',
    actionCopy: 'Audit report claims',
  },
};
