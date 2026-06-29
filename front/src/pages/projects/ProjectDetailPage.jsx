import { Activity, ArrowRight, CheckCircle2, FileSearch, ShieldCheck, UserPlus } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { CandidateTable } from './components/CandidateTable';
import { ProjectScoreStrip } from './components/ProjectScoreStrip';
import { bestCandidate, candidateTotals, findProjectFromPath, workModeInfo } from './projectPageUtils';

export function ProjectDetailPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [] }) {
    const { t } = useLanguage();
    const project = findProjectFromPath(projects) || projects[0];
    if (!project) {
        return (
            <div className="shell">
                <div className="pageGlow contentFadeIn" />
                <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
                <main className="workspace contentFadeIn">
                    <div className="loading"><strong>Loading project…</strong></div>
                </main>
            </div>
        );
    }
    const totals = candidateTotals(project.candidates);
    const workMode = workModeInfo(project, t);
    const requirements = project.requirements?.length ? project.requirements : extractJobBullets(project.description, 'Requirements');
    const responsibilities = extractJobBullets(project.description, 'Responsibilities');
    const preferred = extractJobBullets(project.description, 'Preferred Qualifications');
    const best = bestCandidate(project.candidates);
    const reviewSteps = [
        ['01', t('jobDescription'), t('jobDescriptionFixed')],
        ['02', t('addCvs'), t('addCandidateText')],
        ['03', t('warAiReady'), t('candidateAuditSummary')],
    ];

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="detailPage contentFadeIn">
                <section className="detailHero">
                    <div>
                        <span className="eyebrow">{t('projectJob')}</span>
                        <h1>{project.title}</h1>
                        <p>{introParagraph(project.description) || project.description}</p>
                        <div className="workModeDetail">
                            <span className={`workModeBadge ${workMode.key}`}>{workMode.label}</span>
                            <small>{workMode.description}</small>
                        </div>
                    </div>
                    <button className="secondary" onClick={() => navigateTo(setRoute, 'projects')}><ArrowRight size={16} /> {t('allProjects')}</button>
                    <button className="primary" onClick={() => navigateTo(setRoute, 'addCandidate', project.id)}><UserPlus size={18} /> {t('addCandidate')}</button>
                </section>
                <section className="detailMeta">
                    <Metric label={t('candidates')} value={project.candidates.length} />
                    <Metric label={t('averageScore')} value={`${totals.averageScore}%`} />
                    <Metric label={t('interviewReady')} value={`${totals.shortlistRate}%`} />
                    <Metric label={t('highRisk')} value={totals.highRisk} />
                    <Metric label={t('state')} value={project.state} />
                    <Metric label={t('status')} value={project.status} />
                    <Metric label={t('workMode')} value={workMode.label} />
                </section>
                <section className="dashboardGrid">
                    <div className="dashboardPanel">
                        <h2><ShieldCheck size={18} /> {t('roleRequirements')}</h2>
                        <div className="requirementList">
                            {requirements.map((requirement) => <span key={requirement}>{requirement}</span>)}
                            {requirements.length === 0 && <p className="mutedPanelText">No requirements have been separated from this job description yet.</p>}
                        </div>
                    </div>
                    <div className="dashboardPanel">
                        <h2><Activity size={18} /> {t('candidateDistribution')}</h2>
                        <ProjectScoreStrip project={project} large />
                        <div className="healthLine"><span>{t('bestCandidate')}</span><strong>{best?.name || 'No candidates yet'}</strong></div>
                        <div className="healthLine"><span>{t('needsHumanReview')}</span><strong>{project.candidates.filter((candidate) => candidate.state === 'Needs review').length}</strong></div>
                    </div>
                </section>
                <section className="jobListingGrid">
                    <article className="jobListingPanel jobListingPanelWide">
                        <h2><FileSearch size={18} /> {t('jobDescription')}</h2>
                        <p>{introParagraph(project.description) || project.description || 'No job description has been added yet.'}</p>
                    </article>
                    <JobBulletPanel title="Responsibilities" items={responsibilities} fallback="Responsibilities will appear here when the job description includes them." />
                    <JobBulletPanel title={t('requirements')} items={requirements} fallback="Requirements will appear here when the job description includes them." />
                    <JobBulletPanel title="Preferred qualifications" items={preferred} fallback="Preferred qualifications are optional for this role." />
                    <article className="jobListingPanel">
                        <h2><CheckCircle2 size={18} /> Review workflow</h2>
                        <div className="reviewStepList">
                            {reviewSteps.map(([step, title, description]) => (
                                <div className="reviewStep" key={step}>
                                    <b>{step}</b>
                                    <span>
                                        <strong>{title}</strong>
                                        <small>{description}</small>
                                    </span>
                                </div>
                            ))}
                        </div>
                    </article>
                </section>
                <CandidateTable project={project} setRoute={setRoute} navigateTo={navigateTo} />
            </main>
        </div>
    );
}

function JobBulletPanel({ title, items, fallback }) {
    return (
        <article className="jobListingPanel">
            <h2><ShieldCheck size={18} /> {title}</h2>
            {items.length > 0 ? (
                <ul className="jobBulletList">
                    {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
            ) : (
                <p className="mutedPanelText">{fallback}</p>
            )}
        </article>
    );
}

function introParagraph(description = '') {
    return description.split(/\n+/).map((line) => line.trim()).find((line) => line && !line.endsWith(':')) || '';
}

function extractJobBullets(description = '', heading = '') {
    const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const start = lines.findIndex((line) => normalizeHeading(line) === normalizeHeading(heading));
    if (start === -1) return [];
    const items = [];
    for (const line of lines.slice(start + 1)) {
        if (line.endsWith(':')) break;
        items.push(line.replace(/^[-*]\s*/, ''));
    }
    return items;
}

function normalizeHeading(value = '') {
    return value.toLowerCase().replace(/:$/, '').trim();
}
