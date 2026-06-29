import { BriefcaseBusiness, Database } from 'lucide-react';
import { useMemo, useState } from 'react';
import { apiImportJobPostings } from '../../api';
import { useLanguage } from '../../i18n';
import { ProjectScoreStrip } from './components/ProjectScoreStrip';
import { formatShortDate, pageCount, pageItems, projectTotals, workModeInfo } from './projectPageUtils';

export function ProjectsPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], onProjectsChange }) {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState('');
    const [importError, setImportError] = useState('');
    const totals = projectTotals(projects);
    const filteredProjects = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return projects;
        return projects.filter((project) => [project.id, project.title, project.department, project.location, project.status, project.state]
            .some((value) => String(value).toLowerCase().includes(needle)));
    }, [search, projects]);
    const currentPage = Math.min(page, pageCount(filteredProjects));
    const visibleProjects = pageItems(filteredProjects, currentPage);
    const states = stateComparisonRows(t);

    async function importListings() {
        setImporting(true);
        setImportMessage('');
        setImportError('');
        try {
            const result = await apiImportJobPostings(userToken);
            if (onProjectsChange) await onProjectsChange();
            setImportMessage(`Imported ${result.imported} listings. ${result.skipped} already existed.`);
            setPage(1);
        } catch (err) {
            setImportError(err.message);
        } finally {
            setImporting(false);
        }
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="dashboard contentFadeIn">
                <section className="dashboardHero">
                    <div>
                        <span className="eyebrow">{t('hiringProjects')}</span>
                        <h1>{t('jobsUnderReview')}</h1>
                        <p>{t('jobsUnderReviewText')}</p>
                    </div>
                    <div className="heroActions">
                        <button className="secondary" disabled={importing} onClick={importListings}>
                            <Database size={18} /> {importing ? 'Importing...' : 'Import listings'}
                        </button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'newProject')}><BriefcaseBusiness size={18} /> {t('newJobDescription')}</button>
                    </div>
                </section>
                {(importMessage || importError) && (
                    <section className={importError ? 'error' : 'success'}>
                        {importError || importMessage}
                    </section>
                )}
                <section className="dashboardStats">
                    <Metric label={t('openJobs')} value={projects.length} />
                    <Metric label={t('candidates')} value={totals.candidates} />
                    <Metric label={t('shortlistRate')} value={`${totals.shortlistRate}%`} />
                    <Metric label={t('highRisk')} value={totals.highRisk} />
                </section>
                <section className="stateComparePanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">{t('stateComparison')}</span>
                            <h2>{t('stateComparisonSubtitle')}</h2>
                        </div>
                    </div>
                    <div className="stateCompareGrid">
                        {states.map((state) => (
                            <article className="stateCompareCard" key={state.name}>
                                <strong>{state.name}</strong>
                                <div><span>{t('strictness')}</span><b>{state.strictness}</b></div>
                                <div><span>{t('aiUse')}</span><b>{state.ai}</b></div>
                                <div><span>{t('osintUse')}</span><b>{state.osint}</b></div>
                                <small>{state.bestFor}</small>
                            </article>
                        ))}
                    </div>
                </section>
                <section className="directoryToolbar">
                    <label>
                        <span>{t('searchProjects')}</span>
                        <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('searchProjectsPlaceholder')} />
                    </label>
                    <span>{t('showingOf', { shown: visibleProjects.length, total: filteredProjects.length })}</span>
                </section>
                <section className="projectGrid">
                    {visibleProjects.map((project) => (
                        <button className="projectCard" key={project.id} onClick={() => navigateTo(setRoute, 'projectDetail', project.id)}>
                            {(() => {
                                const mode = workModeInfo(project, t);
                                return <span className={`workModeBadge ${mode.key}`}>{mode.label}</span>;
                            })()}
                            <div className="projectCardHead">
                                <span className="eyebrow">{project.id} / {project.department}</span>
                                <strong>{project.title}</strong>
                                <small>{project.location} / {project.status}</small>
                            </div>
                            <ProjectScoreStrip project={project} />
                            <div className="projectMeta">
                                <span>{project.candidates.length} {t('candidates')}</span>
                                <span>{project.state}</span>
                                <span>{t('opened')} {formatShortDate(project.openedAt)}</span>
                            </div>
                        </button>
                    ))}
                </section>
                <Pagination page={currentPage} totalPages={pageCount(filteredProjects)} onPage={setPage} t={t} />
            </main>
        </div>
    );
}

function stateComparisonRows(t) {
    return [
        { name: 'Light State', strictness: '2/10', ai: t('noAi'), osint: 'No', bestFor: t('firstPass') },
        { name: 'WAR State', strictness: '7/10', ai: t('noAi'), osint: t('optional'), bestFor: t('strictCvReview') },
        { name: 'Person State', strictness: '6/10', ai: 'Yes', osint: t('optional'), bestFor: t('humanStyleReview') },
        { name: 'WAR+AI State', strictness: '10/10', ai: 'Yes', osint: t('requiredDeep'), bestFor: t('highStakesRoles') },
    ];
}

function Pagination({ page, totalPages, onPage, t }) {
    return (
        <div className="paginationControls">
            <span>{t('pageOf', { page, total: totalPages })}</span>
            <button disabled={page <= 1} onClick={() => onPage(page - 1)}>{t('prev')}</button>
            {Array.from({ length: totalPages }, (_, index) => (
                <button key={index + 1} className={page === index + 1 ? 'active' : ''} onClick={() => onPage(index + 1)}>{index + 1}</button>
            ))}
            <button disabled={page >= totalPages} onClick={() => onPage(page + 1)}>{t('next')}</button>
        </div>
    );
}
