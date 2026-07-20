import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ArrowLeft,
    CalendarClock,
    Code2,
    ExternalLink,
    GitFork,
    MapPin,
    RefreshCcw,
    ShieldCheck,
    Star,
    UserRoundCheck,
} from 'lucide-react';
import { apiGetLatestCandidateOsint } from '../../api';
import { discoverCvPublicSources } from '../../utils/publicSourceDiscovery';
import { findCandidateFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

export function SignalTraceReportPage({
    Header,
    Metric,
    navigateTo,
    setRoute,
    user,
    userToken,
    setUser,
    setUserToken,
    projects = [],
    projectsLoading = false,
}) {
    const { project, candidate } = findCandidateFromPath(projects);
    const [report, setReport] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    const loadReport = useCallback(async () => {
        if (!project || !candidate) return;
        setLoading(true);
        setError('');
        try {
            setReport(await apiGetLatestCandidateOsint(project.id, candidate.id, userToken));
        } catch (requestError) {
            setError(requestError.message || 'The latest SignalTrace report could not be loaded.');
        } finally {
            setLoading(false);
        }
    }, [candidate, project, userToken]);

    useEffect(() => {
        loadReport();
    }, [loadReport]);

    const github = report?.github || null;
    const repositories = github?.repositories || [];
    const languages = github?.languages || [];
    const cvSources = useMemo(() => discoverCvPublicSources(candidate?.cvText), [candidate?.cvText]);
    const claimComparisons = useMemo(
        () => buildClaimComparisons(candidate?.claims || [], github),
        [candidate?.claims, github],
    );

    if (!project || !candidate) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow="SignalTrace report" title="Investigation report not found" message="This candidate or project is unavailable." />;
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="signalReportPage contentFadeIn">
                <section className="signalReportHero">
                    <div className="signalReportIdentity">
                        {github?.avatar_url ? (
                            <img src={github.avatar_url} alt="" />
                        ) : (
                            <span className="signalReportAvatar"><Code2 size={32} /></span>
                        )}
                        <div>
                            <span className="eyebrow">SignalTrace investigation</span>
                            <h1>{candidate.name}</h1>
                            <p>
                                CV statements compared with public GitHub profile and repository evidence.
                                Public data supports review; it does not prove identity by itself.
                            </p>
                        </div>
                    </div>
                    <div className="signalReportActions">
                        <button className="secondary" onClick={() => navigateTo(setRoute, 'signalTrace', project.id, candidate.id)}>
                            <ArrowLeft size={16} /> Sources
                        </button>
                        <button className="secondary" onClick={() => navigateTo(setRoute, 'candidateDetail', project.id, candidate.id)}>
                            Candidate
                        </button>
                    </div>
                </section>

                {loading && <section className="signalReportState">Loading persisted investigation data...</section>}
                {!loading && error && (
                    <section className="signalReportState error" role="alert">
                        <div>
                            <strong>SignalTrace report unavailable</strong>
                            <span>{error}</span>
                        </div>
                        <button className="secondary" onClick={loadReport}><RefreshCcw size={16} /> Retry</button>
                    </section>
                )}
                {!loading && !error && !report && (
                    <section className="signalReportState">
                        <strong>No investigation has been run for this candidate.</strong>
                        <span>Return to SignalTrace, confirm consent, and choose Check information.</span>
                    </section>
                )}

                {report && (
                    <>
                        <section className="signalReportMetrics">
                            <Metric label="Identity confidence" value={`${report.identityConfidence}%`} />
                            <Metric label="Evidence sources" value={report.corroboratedSources} />
                            <Metric label="Contradictions" value={report.contradictions} />
                            <Metric label="GitHub depth" value={github ? `${github.repository_depth_score}/100` : 'Not checked'} />
                            <Metric label="Public repositories" value={github?.public_repos ?? 'Not found'} />
                            <Metric label="Checked" value={formatDateTime(report.checked_at)} />
                        </section>

                        <section className="signalReportBand">
                            <div className="signalReportSectionHead">
                                <div>
                                    <span className="eyebrow">Identity and recency</span>
                                    <h2>What the public profile actually shows</h2>
                                </div>
                                {github?.profile_url && (
                                    <a className="secondary signalReportLinkButton" href={github.profile_url} target="_blank" rel="noreferrer">
                                        <Code2 size={16} /> Open GitHub <ExternalLink size={14} />
                                    </a>
                                )}
                            </div>
                            {github ? (
                                <div className="signalProfileGrid">
                                    <article>
                                        <UserRoundCheck size={18} />
                                        <span>Public identity</span>
                                        <strong>{github.name || `@${github.username}`}</strong>
                                        <p>{github.bio || 'No public GitHub biography.'}</p>
                                    </article>
                                    <article>
                                        <MapPin size={18} />
                                        <span>Profile context</span>
                                        <strong>{github.location || 'Location not public'}</strong>
                                        <p>{[github.company, github.blog].filter(Boolean).join(' / ') || 'No public company or website field.'}</p>
                                    </article>
                                    <article>
                                        <CalendarClock size={18} />
                                        <span>Latest repository activity</span>
                                        <strong>{formatDateTime(github.latest_activity_at)}</strong>
                                        <p>Profile updated {formatDateTime(github.updated_at)}.</p>
                                    </article>
                                    <article>
                                        <ShieldCheck size={18} />
                                        <span>Public reach</span>
                                        <strong>{github.followers} followers / {github.following} following</strong>
                                        <p>Account created {formatDate(github.created_at)}.</p>
                                    </article>
                                </div>
                            ) : (
                                <div className="signalReportEmpty">A GitHub URL was not verified during this run. Review the evidence findings below.</div>
                            )}
                        </section>

                        <section className="signalReportBand">
                            <div className="signalReportSectionHead">
                                <div>
                                    <span className="eyebrow">Language distribution</span>
                                    <h2>Language bytes across recent public repositories</h2>
                                    <p>Percentages use GitHub Linguist byte totals from the checked repositories. They indicate public code composition, not authorship or proficiency.</p>
                                </div>
                            </div>
                            {languages.length ? (
                                <div className="signalLanguageGrid">
                                    {languages.map((language) => (
                                        <article key={language.name}>
                                            <div>
                                                <strong>{language.name}</strong>
                                                <span>{language.repositories} repos / {formatBytes(language.bytes)}</span>
                                                <b>{language.percentage}%</b>
                                            </div>
                                            <span className="signalLanguageRail">
                                                <i style={{ width: `${language.percentage}%` }} />
                                            </span>
                                        </article>
                                    ))}
                                </div>
                            ) : (
                                <div className="signalReportEmpty">GitHub did not report a primary language for the returned repositories.</div>
                            )}
                        </section>

                        <section className="signalReportBand">
                            <div className="signalReportSectionHead">
                                <div>
                                    <span className="eyebrow">CV versus public evidence</span>
                                    <h2>Claim comparison</h2>
                                    <p>Repository signals indicate related public material. They are not automatic proof that the candidate authored every claim.</p>
                                </div>
                            </div>
                            <div className="signalClaimRows">
                                {claimComparisons.map((comparison, index) => (
                                    <article key={`${comparison.claim}-${index}`}>
                                        <div>
                                            <span>CV statement</span>
                                            <strong>{comparison.claim}</strong>
                                        </div>
                                        <div>
                                            <span>Public repository signal</span>
                                            <p>{comparison.evidence}</p>
                                        </div>
                                        <b className={`signalClaimStatus ${comparison.tone}`}>{comparison.label}</b>
                                    </article>
                                ))}
                                {!claimComparisons.length && <div className="signalReportEmpty">No structured CV claims were available for comparison.</div>}
                            </div>
                        </section>

                        <section className="signalReportBand">
                            <div className="signalReportSectionHead">
                                <div>
                                    <span className="eyebrow">Repository inventory</span>
                                    <h2>Latest public projects</h2>
                                    <p>Sorted by the GitHub API using most recently pushed repositories first.</p>
                                </div>
                                <span className="signalReportCount">{repositories.length} returned</span>
                            </div>
                            <div className="signalRepositoryGrid">
                                {repositories.map((repository) => (
                                    <article key={repository.url || repository.name}>
                                        <div className="signalRepoTopline">
                                            <span className="signalRepoIcon"><Code2 size={17} /></span>
                                            <div>
                                                <a href={repository.url} target="_blank" rel="noreferrer">
                                                    {repository.name} <ExternalLink size={13} />
                                                </a>
                                                <span>{repository.fork ? 'Forked repository' : 'Original repository'}{repository.archived ? ' / Archived' : ''}</span>
                                            </div>
                                            <time dateTime={repository.pushed_at || ''}>{relativeDate(repository.pushed_at)}</time>
                                        </div>
                                        <p>{repository.description || 'No public repository description.'}</p>
                                        <div className="signalRepoFacts">
                                            <span>{repository.language || 'No language'}</span>
                                            <span><Star size={13} /> {repository.stars}</span>
                                            <span><GitFork size={13} /> {repository.forks}</span>
                                            <span>{repository.open_issues} open issues</span>
                                            <span>{repository.size_kb} KB</span>
                                        </div>
                                        {repository.topics?.length > 0 && (
                                            <div className="signalRepoTopics">
                                                {repository.topics.slice(0, 8).map((topic) => <span key={topic}>{topic}</span>)}
                                            </div>
                                        )}
                                        {repository.readme_excerpt && (
                                            <details className="signalRepoReadme">
                                                <summary>README evidence</summary>
                                                <p>{repository.readme_excerpt}</p>
                                            </details>
                                        )}
                                    </article>
                                ))}
                                {!repositories.length && <div className="signalReportEmpty">No public repositories were returned.</div>}
                            </div>
                        </section>

                        <section className="signalReportSplit">
                            <article className="signalReportBand">
                                <div className="signalReportSectionHead">
                                    <div>
                                        <span className="eyebrow">Detected in CV</span>
                                        <h2>Declared public links</h2>
                                    </div>
                                </div>
                                <div className="signalDeclaredLinks">
                                    {cvSources.map((source) => (
                                        <a href={source.url} target="_blank" rel="noreferrer" key={source.url}>
                                            <span><strong>{source.platform}</strong>{source.username ? `@${source.username}` : source.url}</span>
                                            <ExternalLink size={14} />
                                        </a>
                                    ))}
                                </div>
                            </article>
                            <article className="signalReportBand">
                                <div className="signalReportSectionHead">
                                    <div>
                                        <span className="eyebrow">Audit trail</span>
                                        <h2>Evidence findings</h2>
                                    </div>
                                </div>
                                <div className="signalEvidenceList">
                                    {(report.sources || []).map((source) => (
                                        <div key={`${source.source}-${source.finding}`}>
                                            <span className={`signalEvidenceTone ${source.tone || 'warn'}`} />
                                            <p><strong>{source.source}</strong>{source.finding}</p>
                                            <b>{source.confidence}%</b>
                                        </div>
                                    ))}
                                </div>
                            </article>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

function buildClaimComparisons(claims, github) {
    const repositories = github?.repositories || [];
    const languageNames = (github?.languages || []).map((language) => language.name.toLowerCase());
    const repositoryTerms = repositories.flatMap((repository) => [
        repository.name,
        repository.description,
        repository.readme_excerpt,
        ...(repository.topics || []),
    ]).join(' ').toLowerCase();

    return claims.slice(0, 16).map((row) => {
        const claim = Array.isArray(row) ? String(row[0] || '') : String(row?.claim || row || '');
        const normalizedClaim = claim.toLowerCase();
        const languageMatches = languageNames.filter((language) => normalizedClaim.includes(language));
        const technicalWords = [...new Set(normalizedClaim.match(/[a-z][a-z0-9+#.-]{2,}/g) || [])]
            .filter((word) => !CLAIM_STOP_WORDS.has(word) && repositoryTerms.includes(word))
            .slice(0, 5);
        const matches = [...new Set([...languageMatches, ...technicalWords])];
        if (matches.length) {
            return {
                claim,
                evidence: `Related public repository metadata found for: ${matches.join(', ')}.`,
                label: 'Related signal',
                tone: 'good',
            };
        }
        return {
            claim,
            evidence: 'No matching language, topic, repository name, or public description was returned in this GitHub snapshot.',
            label: 'Not corroborated',
            tone: 'warn',
        };
    }).filter((item) => item.claim);
}

const CLAIM_STOP_WORDS = new Set([
    'and', 'the', 'for', 'with', 'from', 'that', 'this', 'have', 'using', 'into',
    'basic', 'knowledge', 'experience', 'project', 'projects', 'public', 'candidate',
]);

function formatDateTime(value) {
    if (!value) return 'Not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
}

function formatBytes(value) {
    const bytes = Number(value || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value) {
    if (!value) return 'not available';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'not available' : date.toLocaleDateString();
}

function relativeDate(value) {
    if (!value) return 'No push date';
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return 'No push date';
    const days = Math.max(0, Math.round((Date.now() - time) / 86_400_000));
    if (days === 0) return 'Pushed today';
    if (days === 1) return 'Pushed yesterday';
    if (days < 30) return `Pushed ${days} days ago`;
    if (days < 365) return `Pushed ${Math.round(days / 30)} months ago`;
    return `Pushed ${Math.round(days / 365)} years ago`;
}
