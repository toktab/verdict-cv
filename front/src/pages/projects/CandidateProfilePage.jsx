import { useMemo, useState } from 'react';
import { ArrowRight, PanelRightOpen } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { findCatchphraseMatches } from '../../utils/catchphraseAnalyzer';
import { findCandidateFromPath, scoreTone } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

export function CandidateProfilePage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false }) {
    const { t } = useLanguage();
    const { project, candidate } = findCandidateFromPath(projects);
    const activeProject = project;
    const activeCandidate = candidate;
    const [activeProfile, setActiveProfile] = useState(null);
    const profileText = useMemo(() => activeCandidate ? candidateSourceText(activeCandidate) : '', [activeCandidate]);
    const profileItems = useMemo(() => activeCandidate ? buildProfileItems(profileText, activeCandidate) : [], [profileText, activeCandidate]);
    const wordStats = useMemo(() => importantWordStats(profileText, profileItems), [profileText, profileItems]);

    if (!activeProject || !activeCandidate) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow={activeProject ? 'Profiling' : undefined} title={activeProject ? 'Candidate profile not found' : undefined} message={activeProject ? 'This profiling route points to a candidate that is unavailable.' : undefined} />;

    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="profileModePage contentFadeIn">
                <section className="profileModeTopbar">
                    <div>
                        <span className="eyebrow">{t('profilingMode')}</span>
                        <h1>{activeCandidate.name}</h1>
                        <p>{t('profileModeText')}</p>
                    </div>
                    <button className="secondary" onClick={() => navigateTo(setRoute, 'candidateDetail', activeProject.id, activeCandidate.id)}><ArrowRight size={16} /> {t('backToCandidate')}</button>
                </section>
                <section className="detailMeta">
                    <Metric label={t('candidateId')} value={activeCandidate.id} />
                    <Metric label={t('jobId')} value={activeProject.id} />
                    <Metric label={t('score')} value={`${activeCandidate.score}%`} />
                    <Metric label={t('risk')} value={activeCandidate.risk} />
                    <Metric label={t('highlights')} value={profileItems.length} />
                    <Metric label="Words" value={wordStats.totalWords} />
                    <Metric label={t('state')} value={activeProject.state} />
                </section>
                <section className="cvSignalSummary">
                    <div>
                        <span className="eyebrow">Important words</span>
                        <h2>Full CV text is shown below</h2>
                    </div>
                    <div className="importantWordChips">
                        {wordStats.topWords.map((item) => (
                            <span key={item.word}>{item.word}<b>{item.count}</b></span>
                        ))}
                    </div>
                </section>
                <section className={`profileModeLayout ${activeProfile ? 'inspectorOpen' : ''}`}>
                    <article className="profileDocumentSheet">
                        <div className="profileDocumentHead">
                            <span>{t('candidateCv')}</span>
                            <strong>{activeProject.title}</strong>
                        </div>
                        <div className="profileDocumentText">
                            {renderProfileText(profileText, profileItems, activeProfile, setActiveProfile)}
                        </div>
                    </article>
                    <aside className={`profileInspector ${activeProfile ? `open ${activeProfile.severity}` : ''}`}>
                        {activeProfile ? (
                            <>
                                <div className="profileInspectorHead">
                                    <div>
                                        <span className="eyebrow">{t('phraseInspector')}</span>
                                        <h2>{activeProfile.text}</h2>
                                    </div>
                                    <div className="profileInspectorActions">
                                        <span className={`profileSeverityBadge ${activeProfile.severity}`}>{activeProfile.severity} signal</span>
                                        <button onClick={() => setActiveProfile(null)}>{t('close')}</button>
                                    </div>
                                </div>
                                <section>
                                    <h3>{activeProfile.role}</h3>
                                    <p>{activeProfile.reason}</p>
                                </section>
                                <section>
                                    <h3>{t('verdictPressure')}</h3>
                                    <p>{activeProfile.verdict}</p>
                                </section>
                                <section>
                                    <h3>{t('saferWording')}</h3>
                                    <p>{activeProfile.safer}</p>
                                </section>
                                <div className="profileInspectorFooter">
                                    <span className={scoreTone(activeCandidate.score)}>{activeCandidate.score}% {t('candidateScore')}</span>
                                    <span>{activeProject.state}</span>
                                </div>
                            </>
                        ) : (
                            <div className="emptyState">
                                <PanelRightOpen size={18} />
                                {t('clickHighlighted')}
                            </div>
                        )}
                    </aside>
                </section>
            </main>
        </div>
    );
}

function candidateSourceText(candidate) {
    return candidate.cvText?.trim() || candidate.summary || 'No original CV text was stored for this candidate.';
}

function buildProfileItems(text, candidate) {
    return findCatchphraseMatches(text)
        .map((match) => ({
            id: match.id,
            text: match.text,
            start: match.start,
            end: match.end,
            severity: match.severity,
            role: `${match.label} / ${match.category}`,
            reason: match.why,
            verdict: `${candidate.supported} supported, ${candidate.stretched} stretched, ${candidate.unsupported} unsupported claims in this candidate record. Rule risk: ${match.risk}.`,
            safer: match.safer,
        }))
        .sort((a, b) => a.start - b.start)
        .filter((item, index, all) => index === 0 || item.start >= all[index - 1].end);
}

function importantWordStats(text, profileItems) {
    const words = text.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || [];
    const stop = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'candidate', 'resume', 'profile', 'work', 'have', 'has', 'was', 'are', 'you', 'your']);
    const counts = new Map();
    words.forEach((word) => {
        if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    });
    profileItems.forEach((item) => {
        const key = item.text.toLowerCase();
        counts.set(key, Math.max(counts.get(key) || 0, 1));
    });
    return {
        totalWords: words.length,
        topWords: [...counts.entries()]
            .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
            .slice(0, 16)
            .map(([word, count]) => ({ word, count })),
    };
}

function renderProfileText(text, items, activeProfile, setActiveProfile) {
    const nodes = [];
    let cursor = 0;
    items.forEach((item) => {
        if (item.start > cursor) {
            nodes.push(text.slice(cursor, item.start));
        }
        nodes.push(
            <button
                key={item.id}
                type="button"
                className={`profileWordMark ${item.severity} ${activeProfile?.id === item.id ? 'active' : ''}`}
                onClick={() => setActiveProfile(item)}
            >
                {text.slice(item.start, item.end)}
                <span className="profileMiniTooltip">
                    <b>{item.role}</b>
                    <em>{item.reason}</em>
                </span>
            </button>,
        );
        cursor = item.end;
    });
    if (cursor < text.length) {
        nodes.push(text.slice(cursor));
    }
    return <p>{nodes}</p>;
}
