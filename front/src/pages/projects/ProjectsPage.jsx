import { BriefcaseBusiness, Copy, Database, Plus, RefreshCcw, Save, ShieldCheck, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { apiImportJobPostings, apiListProjectAtsTemplates, apiSaveProjectAtsTemplates } from '../../api';
import defaultAts from '../../data/default-ats.json';
import { useLanguage } from '../../i18n';
import { ProjectScoreStrip } from './components/ProjectScoreStrip';
import { formatShortDate, pageCount, pageItems, projectTotals, workModeInfo } from './projectPageUtils';

export function ProjectsPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false, projectsError = '', onProjectsChange }) {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [importing, setImporting] = useState(false);
    const [importMessage, setImportMessage] = useState('');
    const [importError, setImportError] = useState('');
    const [atsOpen, setAtsOpen] = useState(false);
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
            setImportMessage(result.imported
                ? `Demo workspace ready: ${result.imported} projects, ${result.candidates || 0} candidates, ${result.members || 0} memberships, ${result.messages || 0} messages, and ${result.audits || 0} audits.`
                : `Demo workspace already exists. ${result.skipped} projects were left unchanged.`);
            setPage(1);
        } catch (err) {
            setImportError(err.message);
        } finally {
            setImporting(false);
        }
    }

    async function refreshProjects() {
        setImportError('');
        setImportMessage('');
        try {
            await onProjectsChange?.();
            setPage(1);
        } catch (err) {
            setImportError(err.message || 'Could not refresh projects.');
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
                        <button className="secondary" disabled={projectsLoading || importing} onClick={refreshProjects}>
                            <RefreshCcw size={18} /> {projectsLoading ? 'Refreshing...' : 'Refresh'}
                        </button>
                        <button className="secondary" disabled={importing} onClick={importListings}>
                            <Database size={18} /> {importing ? 'Building demo...' : 'Load demo workspace'}
                        </button>
                        <button className="secondary" onClick={() => setAtsOpen(true)} type="button">
                            <ShieldCheck size={18} /> ATS
                        </button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'newProject')}><BriefcaseBusiness size={18} /> {t('newJobDescription')}</button>
                    </div>
                </section>
                {(importMessage || importError) && (
                    <section className={importError ? 'error' : 'success'}>
                        {importError || importMessage}
                    </section>
                )}
                {projectsError && (
                    <section className="retryNotice error compact">
                        <div>
                            <strong>Could not load projects.</strong>
                            <span>{projectsError}</span>
                        </div>
                        <div className="retryActions">
                            <button className="secondary" disabled={projectsLoading} onClick={refreshProjects} type="button"><RefreshCcw size={15} /> Retry</button>
                        </div>
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
                    {projectsLoading && Array.from({ length: 3 }, (_, index) => (
                        <article className="projectCard projectCardSkeleton" key={index}>
                            <span />
                            <strong />
                            <small />
                            <div />
                        </article>
                    ))}
                    {!projectsLoading && visibleProjects.length === 0 && (
                        <div className="emptyState projectEmptyState">
                            <strong>No projects yet.</strong>
                            <span>Create a job description or load the complete demo workspace with candidates, reviewers, messages, and audit history.</span>
                            <button className="primary" onClick={() => navigateTo(setRoute, 'newProject')} type="button">
                                <BriefcaseBusiness size={16} /> New job description
                            </button>
                            <button className="secondary" disabled={importing} onClick={importListings} type="button">
                                <Database size={16} /> {importing ? 'Building demo...' : 'Load demo workspace'}
                            </button>
                        </div>
                    )}
                    {!projectsLoading && visibleProjects.map((project) => (
                        <button className="projectCard" key={project.id} onClick={() => navigateTo(setRoute, 'projectDetail', project.id)}>
                            {(() => {
                                const mode = workModeInfo(project, t);
                                const access = projectAccessLabel(project, user);
                                return (
                                    <div className="projectCardBadges">
                                        <span className={`workModeBadge ${mode.key}`}>{mode.label}</span>
                                        <span className={`projectAccessBadge ${access.kind}`}>{access.label}</span>
                                    </div>
                                );
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
                {!projectsLoading && <Pagination page={currentPage} totalPages={pageCount(filteredProjects)} onPage={setPage} t={t} />}
            </main>
            {atsOpen && <AtsTemplateModal projectId={projects[0]?.id} userToken={userToken} onClose={() => setAtsOpen(false)} />}
        </div>
    );
}

function AtsTemplateModal({ projectId, userToken, onClose }) {
    const [templates, setTemplates] = useState(() => readAtsTemplates());
    const [activeId, setActiveId] = useState(() => readAtsTemplates()[0]?.id || defaultAtsTemplate().id);
    const [saveState, setSaveState] = useState('');
    const active = templates.find((template) => template.id === activeId) || templates[0] || defaultAtsTemplate();

    useEffect(() => {
        if (!projectId || !userToken) return undefined;
        let cancelled = false;
        apiListProjectAtsTemplates(projectId, userToken)
            .then((rows) => {
                if (cancelled) return;
                const serverTemplates = rows.map((row) => ({ ...row.template, id: row.id, name: row.name, visibility: row.visibility, verified: row.verified }));
                setTemplates([defaultAtsTemplate(), ...serverTemplates.filter((template) => template.id !== defaultAtsTemplate().id)]);
                setActiveId(serverTemplates[0]?.id || defaultAtsTemplate().id);
            })
            .catch((error) => setSaveState(error.message || 'Could not load ATS templates.'));
        return () => {
            cancelled = true;
        };
    }, [projectId, userToken]);

    function saveTemplates(next, nextActiveId = activeId) {
        setTemplates(next);
        setActiveId(nextActiveId);
    }

    function updateActive(patch) {
        saveTemplates(templates.map((template) => template.id === active.id ? { ...template, ...patch, verified: template.verified && template.id === defaultAtsTemplate().id } : template));
    }

    function addRule() {
        updateActive({ rules: [...active.rules, { keyword: '', tone: 'Bad', severity: 'Medium', info: '' }] });
    }

    function updateRule(index, patch) {
        updateActive({ rules: active.rules.map((rule, rowIndex) => rowIndex === index ? { ...rule, ...patch } : rule) });
    }

    function createTemplate(copyFrom = null) {
        const source = copyFrom || { rules: [] };
        const next = {
            id: `ats-${Date.now()}`,
            name: copyFrom ? `${copyFrom.name} copy` : 'New ATS template',
            description: copyFrom?.description || '',
            usage: copyFrom?.usage || 'Candidate screening',
            role: copyFrom?.role || 'General role',
            visibility: 'Private',
            accessPeople: '',
            verified: false,
            rules: (source.rules || []).map((rule) => ({ ...rule })),
        };
        saveTemplates([next, ...templates], next.id);
    }

    return (
        <div className="atsModalBackdrop" role="dialog" aria-modal="true">
            <section className="atsModal">
                <div className="modalHead">
                    <div>
                        <span className="eyebrow">ATS templates</span>
                        <h2>Keyword detection builder</h2>
                    </div>
                    <button type="button" onClick={onClose}><X size={16} /> Close</button>
                </div>
                <aside className="atsTemplateRail">
                    <button className="primary" type="button" onClick={() => createTemplate()}><Plus size={16} /> New template</button>
                    {templates.map((template) => (
                        <button className={template.id === active.id ? 'active' : ''} key={template.id} onClick={() => setActiveId(template.id)} type="button">
                            <strong>{template.name}</strong>
                            <span>{template.visibility}{template.verified ? ' / Verified' : ''}</span>
                        </button>
                    ))}
                </aside>
                <main className="atsEditor">
                    <div className="atsEditorTop">
                        <div>
                            <span className="eyebrow">{active.verified ? 'Verified default' : active.visibility}</span>
                            <h3>{active.name}</h3>
                            <p>{active.description}</p>
                        </div>
                        <div className="heroActions">
                            <button className="secondary" type="button" onClick={() => createTemplate(active)}><Copy size={16} /> Copy template</button>
                            <button className="primary" disabled={!projectId} type="button" onClick={async () => {
                                setSaveState('');
                                try {
                                    const rows = await apiSaveProjectAtsTemplates(projectId, templates.map((template) => ({
                                        id: template.id,
                                        name: template.name,
                                        visibility: template.visibility,
                                        verified: Boolean(template.verified),
                                        template,
                                    })), userToken);
                                    const serverTemplates = rows.map((row) => ({ ...row.template, id: row.id, name: row.name, visibility: row.visibility, verified: row.verified }));
                                    setTemplates([defaultAtsTemplate(), ...serverTemplates.filter((template) => template.id !== defaultAtsTemplate().id)]);
                                    setSaveState('ATS templates saved to this project.');
                                } catch (error) {
                                    setSaveState(error.message || 'Could not save ATS templates.');
                                }
                            }}><Save size={16} /> Save template</button>
                        </div>
                    </div>
                    {saveState && <div className={saveState.includes('Could not') ? 'error compact' : 'success compact'}>{saveState}</div>}
                    {!projectId && <div className="error compact">Create or import a project before saving ATS templates.</div>}
                    <div className="atsFormGrid">
                        <label>Name<input disabled={active.verified} value={active.name} onChange={(event) => updateActive({ name: event.target.value })} /></label>
                        <label>Description<input disabled={active.verified} value={active.description} onChange={(event) => updateActive({ description: event.target.value })} /></label>
                        <label>Usage<input disabled={active.verified} value={active.usage} onChange={(event) => updateActive({ usage: event.target.value })} /></label>
                        <label>Role<input disabled={active.verified} value={active.role} onChange={(event) => updateActive({ role: event.target.value })} /></label>
                        <label>Visibility<select disabled={active.verified} value={active.visibility} onChange={(event) => updateActive({ visibility: event.target.value })}>
                            <option>Private</option>
                            <option>Protected</option>
                            <option>Project</option>
                            <option>Public</option>
                        </select></label>
                        <label>Specific people<input disabled={active.verified || active.visibility !== 'Private'} value={active.accessPeople} onChange={(event) => updateActive({ accessPeople: event.target.value })} placeholder="email or username, comma separated" /></label>
                    </div>
                    <div className="atsRulesHead">
                        <div>
                            <span className="eyebrow">Words and evidence meanings</span>
                            <strong>{active.rules.length} detection rules</strong>
                        </div>
                        <button className="secondary" disabled={active.verified} type="button" onClick={addRule}><Plus size={16} /> Add word</button>
                    </div>
                    <div className="atsRuleRows">
                        {active.rules.map((rule, index) => (
                            <article key={`${rule.keyword}-${index}`}>
                                <input disabled={active.verified} value={rule.keyword} onChange={(event) => updateRule(index, { keyword: event.target.value })} placeholder="word or phrase" />
                                <select disabled={active.verified} value={rule.tone} onChange={(event) => updateRule(index, { tone: event.target.value })}><option>Good</option><option>Bad</option><option>Neutral</option></select>
                                <select disabled={active.verified} value={rule.severity} onChange={(event) => updateRule(index, { severity: event.target.value })}><option>Low</option><option>Medium</option><option>High</option></select>
                                <textarea disabled={active.verified} value={rule.info} onChange={(event) => updateRule(index, { info: event.target.value })} placeholder="What does this word mean when detected?" />
                            </article>
                        ))}
                    </div>
                </main>
            </section>
        </div>
    );
}

function projectAccessLabel(project, user) {
    if (project.ownerId && user?.id && Number(project.ownerId) === Number(user.id)) {
        return { kind: 'owner', label: 'Owner / Head Admin' };
    }
    const role = project.myRole || 'Member';
    if (role.toLowerCase().includes('head admin')) {
        return { kind: 'owner', label: 'Owner / Head Admin' };
    }
    return { kind: 'invited', label: `Invited / ${role}` };
}

function readAtsTemplates() {
    return [defaultAtsTemplate()];
}

function defaultAtsTemplate() {
    return {
        id: defaultAts.id,
        name: defaultAts.name,
        description: defaultAts.description,
        usage: defaultAts.usage,
        role: defaultAts.role,
        visibility: defaultAts.visibility,
        accessPeople: defaultAts.accessPeople || '',
        verified: Boolean(defaultAts.verified),
        rules: defaultAtsTemplateRules(),
    };
}

function defaultAtsTemplateRules() {
    return defaultAts.rules.flatMap((rule) => [
        ...(rule.keywords || []).map((keyword) => ({
            keyword,
            tone: rule.risk === 'Low' || rule.label === 'EVIDENCE_FIELD' ? 'Good' : rule.risk === 'Medium' ? 'Neutral' : 'Bad',
            severity: rule.risk || 'Medium',
            info: `${rule.category}: ${rule.why} ${rule.safer}`,
        })),
        ...(rule.patterns || []).map((pattern) => ({
            keyword: `Pattern: ${pattern}`,
            tone: 'Bad',
            severity: rule.risk || 'High',
            info: `${rule.category}: ${rule.why} ${rule.safer}`,
        })),
    ]);
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
