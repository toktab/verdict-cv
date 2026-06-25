export const demoCase = {
  auditMode: 'cv',
  claimTitle: 'Candidate CV',
  evidenceTitle: 'Senior Backend Engineer Job Posting',
  claimText:
    'Expert in distributed systems.\nLed a team of 10 engineers.\nImplemented CI/CD pipelines for 5 microservices.\nBuilt REST APIs with Spring Boot and MySQL.\nOptimized cloud costs by 60% in one quarter.',
  evidenceText:
    'Senior Backend Engineer role. Requirements: Java, Spring Boot, REST APIs, MySQL, CI/CD experience, Docker, and distributed systems exposure. Team lead experience preferred. No mention of cloud cost optimization. Candidate portfolio shows one university distributed systems project and a Spring Boot API with MySQL. Deployment notes mention CI/CD pipeline work for microservices.',
};

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
