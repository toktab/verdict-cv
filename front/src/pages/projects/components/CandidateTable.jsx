import { useMemo, useState } from 'react';
import { useLanguage } from '../../../i18n';
import { formatShortDate, scoreTone } from '../projectPageUtils';
import { pageCount, pageItems } from '../projectPageUtils';

export function CandidateTable({ project, setRoute, navigateTo }) {
    const { t } = useLanguage();
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [votes] = useState(() => readCandidateVotes(project.id));
    const [statuses] = useState(() => readCandidateStatuses(project.id));
    const filteredCandidates = useMemo(() => {
        const needle = search.trim().toLowerCase();
        if (!needle) return project.candidates;
        return project.candidates.filter((candidate) => [candidate.id, candidate.name, candidate.role, candidate.risk, candidate.state, candidate.osint, candidate.memory]
            .some((value) => String(value).toLowerCase().includes(needle)));
    }, [project.candidates, search]);
    const currentPage = Math.min(page, pageCount(filteredCandidates));
    const visibleCandidates = pageItems(filteredCandidates, currentPage);

    return (
        <section className="candidateTablePanel">
            <div className="tableToolbar">
                <h2>{t('candidateDatabase')}</h2>
                <span>{t('cvsShown', { shown: filteredCandidates.length, total: project.candidates.length })}</span>
            </div>
            <div className="directoryToolbar compact">
                <label>
                    <span>{t('searchCandidates')}</span>
                    <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder={t('searchCandidatesPlaceholder')} />
                </label>
                <span>{t('perPage10')}</span>
            </div>
            <div className="candidateTable">
                <div className="candidateTableHead">
                    <span>{t('candidate')}</span>
                    <span>{t('score')}</span>
                    <span>{t('match')}</span>
                    <span>{t('risk')}</span>
                    <span>{t('osint')}</span>
                    <span>{t('memory')}</span>
                    <span>{t('status')}</span>
                </div>
                {visibleCandidates.map((candidate) => {
                    const summary = voteSummary(votes[candidate.id]);
                    const pipelineStatus = statuses[candidate.id] || 'Unreviewed';
                    return (
                        <button className="candidateTableRow candidateTableRowTall" key={candidate.id} onClick={() => navigateTo(setRoute, 'candidateDetail', project.id, candidate.id)}>
                            <span>
                                <strong>{candidate.id} / {candidate.name}</strong>
                                <small>{candidate.role} / {t('submitted')} {formatShortDate(candidate.submittedAt)}</small>
                                <small>Avg: {summary.average}/5 / {summary.downvotes} downvotes / {summary.stars} stars</small>
                            </span>
                            <b className={scoreTone(candidate.score)}>{candidate.score}%</b>
                            <span>{candidate.match}%</span>
                            <span>{candidate.risk}</span>
                            <span>{candidate.osint}</span>
                            <span>{candidate.memory}</span>
                            <span className={`auditStatusPill ${pipelineStatus.toLowerCase().replace(/\s+/g, '-')}`}>{pipelineStatus}</span>
                        </button>
                    );
                })}
                {visibleCandidates.length === 0 && (
                    <div className="candidateEmptyState">
                        <strong>No candidate CVs have been added yet.</strong>
                        <span>Add the first candidate to start scoring this job against the role requirements.</span>
                        <button className="primary" type="button" onClick={() => navigateTo(setRoute, 'addCandidate', project.id)}>
                            {t('addCandidate')}
                        </button>
                    </div>
                )}
            </div>
            <div className="paginationControls">
                <span>{t('pageOf', { page: currentPage, total: pageCount(filteredCandidates) })}</span>
                <button disabled={currentPage <= 1} onClick={() => setPage(currentPage - 1)}>{t('prev')}</button>
                {Array.from({ length: pageCount(filteredCandidates) }, (_, index) => (
                    <button key={index + 1} className={currentPage === index + 1 ? 'active' : ''} onClick={() => setPage(index + 1)}>{index + 1}</button>
                ))}
                <button disabled={currentPage >= pageCount(filteredCandidates)} onClick={() => setPage(currentPage + 1)}>{t('next')}</button>
            </div>
        </section>
    );
}

function readCandidateVotes(projectId) {
    try {
        return JSON.parse(localStorage.getItem(`candidateVotes:${projectId}`) || '{}');
    } catch {
        return {};
    }
}

function readCandidateStatuses(projectId) {
    try {
        return JSON.parse(localStorage.getItem(`candidateStatuses:${projectId}`) || '{}');
    } catch {
        return {};
    }
}

function voteSummary(row = {}) {
    const upvotes = Object.values(row.upvotes || {});
    const average = upvotes.length ? (upvotes.reduce((sum, vote) => sum + Number(vote.score || 0), 0) / upvotes.length).toFixed(1) : '0.0';
    return {
        average,
        downvotes: Object.keys(row.downvotes || {}).length,
        stars: Object.keys(row.stars || {}).length,
    };
}
