import { ArrowRight, History, RefreshCcw, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useLanguage } from '../i18n';

export function HistoryPage({
    Header,
    Metric,
    navigateTo,
    setRoute,
    user,
    userToken,
    setUser,
    setUserToken,
    history = [],
    historyLoading = false,
    historyError = '',
    onRefreshHistory,
    projects = [],
    projectsLoading = false,
    projectsError = '',
    onRefreshProjects,
    openAudit,
}) {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [kind, setKind] = useState('all');
    const rows = useMemo(() => buildHistoryRows(history, projects), [history, projects]);
    const filteredRows = rows.filter((row) => {
        const kindMatch = kind === 'all' || row.kind === kind;
        const needle = search.trim().toLowerCase();
        if (!needle) return kindMatch;
        return kindMatch && [row.title, row.projectTitle, row.candidateName, row.role, row.status, row.state, row.source]
            .some((value) => String(value || '').toLowerCase().includes(needle));
    });
    const stats = historyStats(rows);
    const loading = historyLoading || projectsLoading;

    async function refreshAll() {
        await Promise.all([
            onRefreshHistory?.(),
            onRefreshProjects?.(),
        ]);
    }

    function openRow(row) {
        if (row.kind === 'audit') {
            openAudit?.(row.auditId);
            return;
        }
        navigateTo(setRoute, 'candidateDetail', row.projectId, row.candidateId);
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="dashboard historyPage contentFadeIn">
                <section className="dashboardHero">
                    <div>
                        <span className="eyebrow">{t('history')}</span>
                        <h1>Check history</h1>
                        <p>Every private audit and project candidate check, connected back to the project, candidate, score, state, and review result.</p>
                    </div>
                    <button className="primary" disabled={loading} onClick={refreshAll} type="button">
                        <RefreshCcw size={18} /> {loading ? 'Refreshing...' : 'Refresh history'}
                    </button>
                </section>

                {(historyError || projectsError) && (
                    <section className="retryNotice error compact">
                        <div>
                            <strong>History sync failed.</strong>
                            <span>{[historyError && `Audit history: ${historyError}`, projectsError && `Projects: ${projectsError}`].filter(Boolean).join(' / ')}</span>
                        </div>
                        <div className="retryActions">
                            <button className="secondary" disabled={loading} onClick={refreshAll} type="button"><RefreshCcw size={15} /> Retry</button>
                        </div>
                    </section>
                )}

                <section className="dashboardStats">
                    <Metric label="Checks" value={rows.length} />
                    <Metric label="Project checks" value={stats.candidateChecks} />
                    <Metric label="Private audits" value={stats.auditChecks} />
                    <Metric label="Average score" value={`${stats.averageScore}%`} />
                </section>

                <section className="historyControlPanel">
                    <label>
                        <span><Search size={15} /> Search history</span>
                        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Project, candidate, role, status..." />
                    </label>
                    <div className="historyKindTabs">
                        {[
                            ['all', 'All'],
                            ['candidate', 'Project checks'],
                            ['audit', 'Private audits'],
                        ].map(([value, label]) => (
                            <button className={kind === value ? 'active' : ''} key={value} onClick={() => setKind(value)} type="button">{label}</button>
                        ))}
                    </div>
                </section>

                <section className="historyIndexPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Timeline</span>
                            <h2><History size={18} /> Checked records</h2>
                        </div>
                        <span>{filteredRows.length} shown</span>
                    </div>
                    {loading && <HistorySkeleton />}
                    {!loading && filteredRows.length === 0 && (
                        <div className="emptyState historyEmptyState">
                            <strong>No checks found.</strong>
                            <span>Run a project candidate analysis or private audit, then it will appear here with its project and candidate context.</span>
                        </div>
                    )}
                    {!loading && filteredRows.map((row) => (
                        <button className="historyIndexRow" key={row.id} onClick={() => openRow(row)} type="button">
                            <span className={`historyKindBadge ${row.kind}`}>{row.source}</span>
                            <div className="historyMainText">
                                <strong>{row.title}</strong>
                                <small>{row.projectTitle} / {row.candidateName} / {row.role}</small>
                            </div>
                            <div className="historyScoreBlock">
                                <span>Score</span>
                                <strong>{row.score}%</strong>
                            </div>
                            <div className="historyCounts">
                                <span>{row.supported} supported</span>
                                <span>{row.stretched} stretched</span>
                                <span>{row.unsupported} unsupported</span>
                            </div>
                            <div className="historyMetaText">
                                <span>{row.state}</span>
                                <small>{row.status} / {formatHistoryDate(row.createdAt)}</small>
                            </div>
                            <ArrowRight size={18} />
                        </button>
                    ))}
                </section>
            </main>
        </div>
    );
}

function HistorySkeleton() {
    return (
        <div className="historySkeletonList">
            {Array.from({ length: 5 }, (_, index) => (
                <div className="historyIndexSkeleton" key={index}>
                    <span />
                    <strong />
                    <small />
                    <em />
                </div>
            ))}
        </div>
    );
}

function buildHistoryRows(audits, projects) {
    const candidateRows = projects.flatMap((project) => (project.candidates || []).map((candidate) => ({
        id: `candidate-${project.id}-${candidate.id}`,
        kind: 'candidate',
        source: 'Project check',
        projectId: project.id,
        candidateId: candidate.id,
        projectTitle: project.title || 'Untitled project',
        candidateName: candidate.name || 'Unnamed candidate',
        role: candidate.role || project.title || 'Candidate',
        title: `${candidate.name || 'Candidate'} checked for ${project.title || 'project'}`,
        score: candidate.score || 0,
        supported: candidate.supported || 0,
        stretched: candidate.stretched || 0,
        unsupported: candidate.unsupported || 0,
        state: candidate.state || project.state || 'Pending',
        status: candidate.osint || project.status || 'Saved',
        createdAt: candidate.submittedAt || project.openedAt || '',
    })));

    const auditRows = audits.map((audit) => {
        const match = findAuditCandidateMatch(audit, projects);
        return {
            id: `audit-${audit.id}`,
            kind: 'audit',
            source: 'Private audit',
            auditId: audit.id,
            projectId: match?.project?.id || null,
            candidateId: match?.candidate?.id || null,
            projectTitle: match?.project?.title || audit.evidenceTitle || 'Private workspace',
            candidateName: match?.candidate?.name || inferCandidateName(audit.claimTitle),
            role: match?.candidate?.role || audit.templateName || 'Audit',
            title: audit.claimTitle || `Audit #${audit.id}`,
            score: audit.credibilityScore || 0,
            supported: audit.supportedCount || 0,
            stretched: audit.stretchedCount || 0,
            unsupported: audit.unsupportedCount || 0,
            state: audit.checkStateName || audit.templateName || 'Default state',
            status: audit.status || 'COMPLETED',
            createdAt: audit.createdAt || '',
        };
    });

    return [...auditRows, ...candidateRows].sort((a, b) => dateValue(b.createdAt) - dateValue(a.createdAt));
}

function findAuditCandidateMatch(audit, projects) {
    const haystack = `${audit.claimTitle || ''} ${audit.evidenceTitle || ''}`.toLowerCase();
    for (const project of projects) {
        for (const candidate of project.candidates || []) {
            const name = String(candidate.name || '').toLowerCase();
            const role = String(candidate.role || '').toLowerCase();
            const projectTitle = String(project.title || '').toLowerCase();
            if ((name && haystack.includes(name)) || (role && haystack.includes(role) && projectTitle && haystack.includes(projectTitle))) {
                return { project, candidate };
            }
        }
    }
    return null;
}

function inferCandidateName(title = '') {
    const cleaned = title.replace(/^candidate\s+/i, '').replace(/\s+cv.*$/i, '').trim();
    return cleaned || 'Private audit';
}

function historyStats(rows) {
    if (!rows.length) {
        return { candidateChecks: 0, auditChecks: 0, averageScore: 0 };
    }
    const total = rows.reduce((sum, row) => sum + Number(row.score || 0), 0);
    return {
        candidateChecks: rows.filter((row) => row.kind === 'candidate').length,
        auditChecks: rows.filter((row) => row.kind === 'audit').length,
        averageScore: Math.round(total / rows.length),
    };
}

function formatHistoryDate(value) {
    if (!value) return 'Unknown date';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);
    return date.toLocaleString();
}

function dateValue(value) {
    const parsed = new Date(value).getTime();
    return Number.isNaN(parsed) ? 0 : parsed;
}
