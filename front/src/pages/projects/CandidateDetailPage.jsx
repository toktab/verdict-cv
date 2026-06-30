import { useEffect, useState } from 'react';
import { Activity, ArrowRight, History, MessageSquarePlus, Radar, RefreshCcw, ScanText } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiCreateCandidateNote, apiListCandidateNotes, apiReanalyzeCandidate } from '../../api';
import { findCatchphraseMatches } from '../../utils/catchphraseAnalyzer';
import { findCandidateFromPath, scorePercent, scoreTone } from './projectPageUtils';

const analysisStates = [
    { id: 'light', name: 'Light State', shortName: 'Light', description: 'Fast first pass with obvious contradiction checks.' },
    { id: 'war', name: 'WAR State', shortName: 'WAR', description: 'Strict template pressure against serious claims.' },
    { id: 'person', name: 'Person_AI State', shortName: 'Person_AI', description: 'Reviewer-style AI judgment for credibility and polish.' },
    { id: 'strict-war-ai', name: 'WAR_AI State', shortName: 'WAR_AI', description: 'Deep AI-assisted verification with OSINT-ready evidence.' },
];

export function CandidateDetailPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], onProjectsChange }) {
    const { t } = useLanguage();
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [confidenceFilter, setConfidenceFilter] = useState('ALL');
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const [reanalyzing, setReanalyzing] = useState(false);
    const [reanalyzeMessage, setReanalyzeMessage] = useState('');
    const [reviewNotes, setReviewNotes] = useState([]);
    const [noteDecision, setNoteDecision] = useState('INTERVIEW');
    const [noteBody, setNoteBody] = useState('');
    const [noteMessage, setNoteMessage] = useState('');
    const [noteBusy, setNoteBusy] = useState(false);
    const { project, candidate } = findCandidateFromPath(projects);
    const activeProject = project || projects[0];
    const activeCandidate = candidate || activeProject?.candidates?.[0];
    const projectStateId = stateIdFromName(activeProject?.state);
    const stateStorageKey = candidateStateStorageKey(activeProject?.id, activeCandidate?.id);
    const [activeStateId, setActiveStateId] = useState(() => readCandidateState(stateStorageKey, projectStateId));
    const [initializedStateIds, setInitializedStateIds] = useState(() => readInitializedStates(stateStorageKey, projectStateId));

    useEffect(() => {
        const nextStateId = readCandidateState(stateStorageKey, projectStateId);
        setActiveStateId(nextStateId);
        setInitializedStateIds((current) => {
            const stored = readInitializedStates(stateStorageKey, projectStateId);
            const next = new Set([...current, ...stored, projectStateId]);
            writeInitializedStates(stateStorageKey, next);
            return next;
        });
    }, [activeProject?.id, activeCandidate?.id, projectStateId, stateStorageKey]);

    useEffect(() => {
        if (!activeProject?.id || !activeCandidate?.id || !userToken) return;
        let cancelled = false;
        apiListCandidateNotes(activeProject.id, activeCandidate.id, userToken)
            .then((rows) => {
                if (!cancelled) setReviewNotes(rows || []);
            })
            .catch(() => {
                if (!cancelled) setReviewNotes([]);
            });
        return () => {
            cancelled = true;
        };
    }, [activeProject?.id, activeCandidate?.id, userToken]);

    if (!activeProject || !activeCandidate) {
        return (
            <div className="shell">
                <div className="pageGlow contentFadeIn" />
                <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
                <main className="workspace contentFadeIn">
                    <div className="loading"><strong>Loading candidate…</strong></div>
                </main>
            </div>
        );
    }

    const verdictRows = buildCandidateVerdicts(activeCandidate);
    const evidenceRows = buildEvidenceRows(activeProject, activeCandidate, t);
    const scoreFactors = buildScoreFactors(activeCandidate, t);
    const activeScoreLevel = scoreLevel(activeCandidate.score);
    const memoryProfile = buildMemoryProfile(activeCandidate, t);
    const interviewQuestions = buildInterviewQuestions(activeCandidate, t);
    const fitRows = buildFitRows(activeProject, activeCandidate, t);
    const cvText = candidateSourceText(activeCandidate);
    const cvHighlights = findCatchphraseMatches(cvText);
    const cvStats = importantWordStats(cvText, cvHighlights);
    const filteredVerdictRows = filterVerdicts(verdictRows, statusFilter, confidenceFilter, severityFilter);
    const activeState = analysisStates.find((state) => state.id === activeStateId) || analysisStates[0];
    const selectedStateInitialized = initializedStateIds.has(activeStateId);
    const decision = candidateDecision(activeCandidate);
    const coverage = proofCoverage(activeProject, activeCandidate);
    const verdictCounts = countVerdicts(verdictRows);
    const strongestClaim = strongestRequirementClaim(activeProject, activeCandidate) || activeCandidate.claims.find(([, status]) => status === 'Supported')?.[0] || activeCandidate.role;
    const weakestClaim = weakestRequirementClaim(activeProject, activeCandidate) || activeCandidate.claims.find(([claim, status]) => status === 'Unsupported' && isActionableQuestionClaim(claim))?.[0] || activeCandidate.claims.find(([claim, status]) => status === 'Stretched' && isActionableQuestionClaim(claim))?.[0] || activeCandidate.risk;
    const recruiterSummary = buildRecruiterSummary(activeProject, activeCandidate, decision, coverage, strongestClaim, weakestClaim);

    function selectAnalysisState(stateId) {
        setActiveStateId(stateId);
        writeCandidateState(stateStorageKey, stateId);
    }

    function initializeAnalysisState() {
        setInitializedStateIds((current) => {
            const next = new Set(current);
            next.add(activeStateId);
            writeInitializedStates(stateStorageKey, next);
            return next;
        });
    }

    async function reanalyzeCandidate() {
        setReanalyzing(true);
        setReanalyzeMessage('');
        try {
            await apiReanalyzeCandidate(activeProject.id, activeCandidate.id, userToken);
            await onProjectsChange?.();
            setReanalyzeMessage('Analysis refreshed with the latest scoring rules.');
        } catch (error) {
            setReanalyzeMessage(error.message || 'Could not refresh analysis.');
        } finally {
            setReanalyzing(false);
        }
    }

    async function addReviewerNote(event) {
        event.preventDefault();
        if (!noteBody.trim()) return;
        setNoteBusy(true);
        setNoteMessage('');
        try {
            const note = await apiCreateCandidateNote(activeProject.id, activeCandidate.id, {
                type: 'DECISION',
                decision: noteDecision,
                body: noteBody.trim(),
            }, userToken);
            setReviewNotes((current) => [note, ...current]);
            setNoteBody('');
            setNoteMessage('Reviewer note saved.');
        } catch (error) {
            setNoteMessage(error.message || 'Could not save reviewer note.');
        } finally {
            setNoteBusy(false);
        }
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="detailPage contentFadeIn">
                <section className="detailHero candidateDetailHero">
                    <div className="candidateHeroMain">
                        <button className="secondary candidateBackButton" onClick={() => navigateTo(setRoute, 'projectDetail', activeProject.id)}><ArrowRight size={16} /> {t('backToJob')}</button>
                        <div className="candidateTitleRow">
                            <h1>{activeCandidate.name}</h1>
                            <div className={`candidateScore inline ${scoreTone(activeCandidate.score)}`}>{activeCandidate.score}</div>
                        </div>
                        <p>{activeCandidate.summary}</p>
                        <div className="candidateDecisionLine">
                            <span className={`decisionBadge ${decision.tone}`}>{decision.label}</span>
                            <strong>{decision.headline}</strong>
                            <small>{decision.reason}</small>
                        </div>
                    </div>
                    <div className="candidateHeroActions">
                        <button className="secondary" disabled={reanalyzing} onClick={reanalyzeCandidate} type="button"><RefreshCcw size={18} /> {reanalyzing ? 'Re-running...' : 'Re-run analysis'}</button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'candidateProfile', activeProject.id, activeCandidate.id)}><ScanText size={18} /> {t('profilingMode')}</button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'signalTrace', activeProject.id, activeCandidate.id)}><Radar size={18} /> {t('signalTrace')}</button>
                    </div>
                </section>
                {reanalyzeMessage && <div className="inlineNotice">{reanalyzeMessage}</div>}
                <section className="detailMeta">
                    <Metric label={t('role')} value={activeCandidate.role} />
                    <Metric label={t('jobMatch')} value={`${activeCandidate.match}%`} />
                    <Metric label={t('risk')} value={activeCandidate.risk} />
                    <Metric label={t('osint')} value={activeCandidate.osint} />
                    <Metric label={t('memory')} value={activeCandidate.memory} />
                    <Metric label={t('flags')} value={activeCandidate.flags} />
                </section>
                <section className={`decisionSummaryBand ${decision.tone}`}>
                    <article>
                        <span className="eyebrow">Decision</span>
                        <strong>{decision.label}</strong>
                        <p>{decision.headline}</p>
                    </article>
                    <article>
                        <span className="eyebrow">Proof coverage</span>
                        <strong>{coverage.percent}%</strong>
                        <div className="decisionRail"><span style={{ width: `${coverage.percent}%` }} /></div>
                    </article>
                    <article>
                        <span className="eyebrow">Strongest proof</span>
                        <strong>{strongestClaim}</strong>
                        <p>{activeCandidate.supported} supported signals</p>
                    </article>
                    <article>
                        <span className="eyebrow">Main risk</span>
                        <strong>{weakestClaim}</strong>
                        <p>{activeCandidate.unsupported + activeCandidate.stretched} review signals</p>
                    </article>
                </section>
                <section className="reviewNotesPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Reviewer notes</span>
                            <h2><MessageSquarePlus size={18} /> Decision history</h2>
                        </div>
                        <span>{reviewNotes.length} note{reviewNotes.length === 1 ? '' : 's'}</span>
                    </div>
                    {noteMessage && <div className="inlineNotice">{noteMessage}</div>}
                    <form className="reviewNoteForm" onSubmit={addReviewerNote}>
                        <label>
                            Decision
                            <select value={noteDecision} onChange={(event) => setNoteDecision(event.target.value)}>
                                <option value="INTERVIEW">Interview</option>
                                <option value="HOLD">Hold</option>
                                <option value="REJECT">Reject</option>
                                <option value="NEEDS_EVIDENCE">Needs evidence</option>
                            </select>
                        </label>
                        <label>
                            Note
                            <textarea value={noteBody} onChange={(event) => setNoteBody(event.target.value)} placeholder="Write the human review decision, evidence request, or follow-up context." />
                        </label>
                        <button className="primary" disabled={noteBusy || !noteBody.trim()} type="submit">Save note</button>
                    </form>
                    <div className="reviewNoteList">
                        {reviewNotes.map((note) => (
                            <article key={note.id}>
                                <div>
                                    <strong>{note.decision}</strong>
                                    <small>{note.author_name || 'Reviewer'} / {formatNoteDate(note.created_at)}</small>
                                </div>
                                <p>{note.body}</p>
                            </article>
                        ))}
                        {!reviewNotes.length && <p className="mutedPanelText">No reviewer decisions have been saved for this candidate yet.</p>}
                    </div>
                </section>
                <section className="signalStatePanel">
                    <div className="signalDirectoryHead">
                        <span className="eyebrow">4 States</span>
                        <strong>Choose candidate analysis state</strong>
                        <small>Switching to a State that has not been initialized blanks the analysis until you initialize it.</small>
                    </div>
                    <div className="signalStateGrid">
                        {analysisStates.map((state) => {
                            const initialized = initializedStateIds.has(state.id);
                            return (
                                <button className={state.id === activeStateId ? 'active' : ''} key={state.id} onClick={() => selectAnalysisState(state.id)} type="button">
                                    <span>
                                        <strong>{state.name}</strong>
                                        <small>{state.description}</small>
                                    </span>
                                    <b className={initialized ? 'stateDone' : 'statePending'}>{initialized ? 'Done' : 'Not initialized'}</b>
                                </button>
                            );
                        })}
                    </div>
                </section>
                {!selectedStateInitialized ? (
                    <section className="analysisBlankPanel">
                        <div>
                            <span className="eyebrow">Analysis not initialized</span>
                            <h2>{activeState.name} has not run for this candidate.</h2>
                            <p>No score explanation, claim verdicts, job fit, memory, or OSINT-derived results are available for this State yet.</p>
                        </div>
                        <button className="primary" onClick={initializeAnalysisState} type="button">Initialize Analysis with State: {activeState.name}</button>
                    </section>
                ) : (
                    <>
                <section className="candidateInsightGrid">
                    <div className="dashboardPanel">
                        <h2><Activity size={18} /> {t('claimScoreSplit')}</h2>
                        <div className="claimSplit">
                            <span style={{ width: `${scorePercent(activeCandidate.supported, activeCandidate)}%` }} className="supportedBar" />
                            <span style={{ width: `${scorePercent(activeCandidate.stretched, activeCandidate)}%` }} className="stretchedBar" />
                            <span style={{ width: `${scorePercent(activeCandidate.unsupported, activeCandidate)}%` }} className="unsupportedBar" />
                        </div>
                        <div className="counts">
                            <span><b>{activeCandidate.supported}</b> {t('supported')}</span>
                            <span><b>{activeCandidate.stretched}</b> {t('stretched')}</span>
                            <span><b>{activeCandidate.unsupported}</b> {t('unsupported')}</span>
                        </div>
                    </div>
                    <div className="dashboardPanel">
                        <h2><History size={18} /> {t('organizerNote')}</h2>
                        <p className="candidateNote">{t('organizerNoteText')}</p>
                    </div>
                </section>
                <section className="recruiterSummaryPanel">
                    <div>
                        <span className="eyebrow">Recruiter-ready summary</span>
                        <h2>{decision.label}: {activeCandidate.name}</h2>
                    </div>
                    <p>{recruiterSummary}</p>
                    <div className="summaryActionGrid">
                        <span><b>Next action</b>{decision.nextAction}</span>
                        <span><b>Coverage</b>{coverage.covered}/{coverage.total} requirements backed</span>
                        <span><b>State</b>{activeState.name}</span>
                    </div>
                </section>
                <section className="fullCvPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Original CV</span>
                            <h2>Uploaded candidate text</h2>
                        </div>
                        <span>{cvStats.totalWords} words / {cvHighlights.length} important phrases</span>
                    </div>
                    <div className="importantWordChips">
                        {cvStats.topWords.map((item) => (
                            <span key={item.word}>{item.word}<b>{item.count}</b></span>
                        ))}
                    </div>
                    <pre className="fullCvText">{cvText}</pre>
                </section>
                <section className="jobFitPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">{t('jobFitDashboard')}</span>
                            <h2>{t('jobFitSubtitle')}</h2>
                        </div>
                        <span>{activeCandidate.match}% {t('match')}</span>
                    </div>
                    <div className="jobFitRows">
                        {fitRows.map((row) => (
                            <article className={`jobFitRow ${row.tone}`} key={row.requirement}>
                                <div>
                                    <span>{t('requirement')}</span>
                                    <strong>{row.requirement}</strong>
                                </div>
                                <div>
                                    <span>{t('fitScore')}</span>
                                    <b>{row.score}%</b>
                                </div>
                                <div className="jobFitBar"><span style={{ width: `${row.score}%` }} /></div>
                                <div>
                                    <span>{t('proofLevel')}</span>
                                    <strong>{row.proof}</strong>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
                <section className="candidateReportPanel">
                    <div className="candidateReportHead">
                        <div>
                            <span className="eyebrow">{t('endReport')}</span>
                            <h2>{t('endReportSubtitle')}</h2>
                        </div>
                        <div className={`reportScoreDial ${scoreTone(activeCandidate.score)}`}>
                            <strong>{activeCandidate.score}</strong>
                            <span>{t('score')}</span>
                        </div>
                    </div>
                    <div className="reportGrid">
                        <article className="reportMetric">
                            <span>{t('overallCandidateScore')}</span>
                            <strong>{activeCandidate.score}%</strong>
                            <div className="reportRail"><b style={{ width: `${activeCandidate.score}%` }} /></div>
                        </article>
                        <article className="reportMetric">
                            <span>{t('claimReliability')}</span>
                            <strong>{scorePercent(activeCandidate.supported, activeCandidate)}%</strong>
                            <div className="reportRail good"><b style={{ width: `${scorePercent(activeCandidate.supported, activeCandidate)}%` }} /></div>
                        </article>
                        <article className="reportMetric">
                            <span>{t('osintReadiness')}</span>
                            <strong>{activeCandidate.osint}</strong>
                            <div className="reportRail signal"><b style={{ width: `${osintPercent(activeCandidate.osint)}%` }} /></div>
                        </article>
                        <article className="reportMetric">
                            <span>{t('memoryImpact')}</span>
                            <strong>{activeCandidate.memory}</strong>
                            <div className="reportRail memory"><b style={{ width: `${memoryPercent(activeCandidate.memory)}%` }} /></div>
                        </article>
                    </div>
                    <div className="reportChartGrid">
                        <div>
                            <h3>{t('evidenceDistribution')}</h3>
                            <div className="reportStackedBar">
                                <span className="supportedBar" style={{ width: `${scorePercent(activeCandidate.supported, activeCandidate)}%` }} />
                                <span className="stretchedBar" style={{ width: `${scorePercent(activeCandidate.stretched, activeCandidate)}%` }} />
                                <span className="unsupportedBar" style={{ width: `${scorePercent(activeCandidate.unsupported, activeCandidate)}%` }} />
                            </div>
                            <div className="reportLegend">
                                <span><b className="legendDot supportedBar" />{t('supportedClaims')}: {activeCandidate.supported}</span>
                                <span><b className="legendDot stretchedBar" />{t('stretchedClaims')}: {activeCandidate.stretched}</span>
                                <span><b className="legendDot unsupportedBar" />{t('unsupportedClaims')}: {activeCandidate.unsupported}</span>
                            </div>
                        </div>
                        <div className="reportSignalList">
                            <h3>{t('reportBreakdown')}</h3>
                            <div><span>{t('strongestSignal')}</span><strong>{activeCandidate.claims.find(([, status]) => status === 'Supported')?.[0] || activeCandidate.role}</strong></div>
                            <div><span>{t('weakestSignal')}</span><strong>{activeCandidate.claims.find(([, status]) => status === 'Unsupported')?.[0] || activeCandidate.claims.find(([, status]) => status === 'Stretched')?.[0] || activeCandidate.risk}</strong></div>
                            <div><span>{t('riskPenalty')}</span><strong>-{Math.min(30, activeCandidate.flags * 3)} pts</strong></div>
                        </div>
                    </div>
                </section>
                <section className="scoreExplanationPanel">
                    <div className="candidateReportHead">
                        <div>
                            <span className="eyebrow">{t('whyThisScore')}</span>
                            <h2>{t('scoreFactorsSubtitle')}</h2>
                        </div>
                        <strong className={`scoreDeltaTotal ${scoreTone(activeCandidate.score)}`}>{activeCandidate.score}%</strong>
                    </div>
                    <div className="scoreFactorColumns">
                        <div>
                            <h3>{t('positiveSignals')}</h3>
                            {scoreFactors.positive.map((factor) => (
                                <div className="scoreFactorRow positive" key={factor.label}>
                                    <span>{factor.label}</span>
                                    <b>+{factor.points}</b>
                                </div>
                            ))}
                        </div>
                        <div>
                            <h3>{t('penalties')}</h3>
                            {scoreFactors.negative.map((factor) => (
                                <div className="scoreFactorRow negative" key={factor.label}>
                                    <span>{factor.label}</span>
                                    <b>-{factor.points}</b>
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="scoreLevelPanel">
                        <div>
                            <span className="eyebrow">{t('scoreLevel')}</span>
                            <h3>{activeScoreLevel}/10 - {scoreLevelLabel(activeScoreLevel, t)}</h3>
                            <p>{t('scoreLevelSubtitle')}</p>
                        </div>
                        <div className="scoreLevelRail">
                            {Array.from({ length: 10 }, (_, index) => index + 1).map((level) => (
                                <span className={level === activeScoreLevel ? 'active' : level < activeScoreLevel ? 'passed' : ''} key={level}>{level}</span>
                            ))}
                        </div>
                    </div>
                </section>
                <section className="memoryPanel">
                    <div className="candidateReportHead">
                        <div>
                            <span className="eyebrow">{t('candidateMemory')}</span>
                            <h2>{t('candidateMemorySubtitle')}</h2>
                        </div>
                        <strong className={`memoryBadge ${memoryProfile.tone}`}>{activeCandidate.memory}</strong>
                    </div>
                    <div className="memoryGrid">
                        <div><span>{t('memoryState')}</span><strong>{memoryProfile.state}</strong></div>
                        <div><span>{t('priorScore')}</span><strong>{memoryProfile.priorScore}</strong></div>
                        <div><span>{t('repeatedRisk')}</span><strong>{memoryProfile.repeatedRisk}</strong></div>
                        <div><span>{t('cvDelta')}</span><strong>{memoryProfile.delta}</strong></div>
                    </div>
                    <div className="memoryTimeline">
                        <span>{t('memoryTimeline')}</span>
                        {memoryProfile.timeline.map((item) => (
                            <div key={item.label}>
                                <small>{item.label}</small>
                                <strong>{item.value}</strong>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="interviewPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">{t('interviewQuestions')}</span>
                            <h2>{t('interviewQuestionsSubtitle')}</h2>
                        </div>
                        <span>{interviewQuestions.length} prompts</span>
                    </div>
                    {interviewQuestions.length ? (
                        <div className="interviewQuestionRows">
                            {interviewQuestions.map((item, index) => (
                                <article className={`interviewQuestion ${item.tone}`} key={item.question}>
                                    <b>{String(index + 1).padStart(2, '0')}</b>
                                    <div>
                                        <span>{t('questionFocus')}</span>
                                        <strong>{item.focus}</strong>
                                    </div>
                                    <p>{item.question}</p>
                                    <small><b>{t('questionReason')}</b> {item.reason}</small>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="emptyState">{t('noWeakQuestions')}</div>
                    )}
                </section>
                <section className="detailTableSection">
                    <div className="tableToolbar">
                        <h2>{t('claimEvidence')}</h2>
                        <span>{activeProject.title}</span>
                    </div>
                    <div className="candidateClaimRows">
                        {activeCandidate.claims.map(([claim, status, reason]) => (
                            <div className="candidateClaimRow" key={claim}>
                                <strong>{claim}</strong>
                                <span className={`statusPill ${status.toLowerCase()}`}>{status}</span>
                                <small>{reason}</small>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="detailTableSection candidateResultSection">
                    <div className="tableToolbar">
                        <h2>{t('verdicts')}</h2>
                        <div className="filterStack">
                            <div className="filterGroup">
                                <span>{t('status')}</span>
                                <div className="filterTabs">
                                    {['ALL', 'SUPPORTED', 'STRETCHED', 'UNSUPPORTED', 'GAP'].map((item) => (
                                        <button
                                            className={item === statusFilter ? 'active' : ''}
                                            key={item}
                                            onClick={() => setStatusFilter(item)}
                                            type="button"
                                        >
                                            {item} <b>{verdictCounts[item] ?? verdictCounts.ALL}</b>
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="filterGroup">
                                <span>{t('confidence')}</span>
                                <div className="filterTabs">
                                    {['ALL', 'HIGH', 'MEDIUM', 'LOW'].map((item) => (
                                        <button
                                            className={item === confidenceFilter ? 'active' : ''}
                                            key={item}
                                            onClick={() => setConfidenceFilter(item)}
                                            type="button"
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="filterGroup">
                                <span>{t('severity')}</span>
                                <div className="filterTabs">
                                    {['ALL', 'PROBLEM', 'HIGH RISK', 'MEDIUM RISK', 'LOW RISK'].map((item) => (
                                        <button
                                            className={item === severityFilter ? 'active' : ''}
                                            key={item}
                                            onClick={() => setSeverityFilter(item)}
                                            type="button"
                                        >
                                            {item}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="detailResultsGrid">
                        <div className="detailVerdictTable">
                            <div className="detailTableHead">
                                <span>#</span>
                                <span>Claim</span>
                                <span>{t('status')}</span>
                                <span>{t('confidence')}</span>
                                <span>{t('evidence')}</span>
                            </div>
                            {filteredVerdictRows.map((row, index) => (
                                <div className="detailTableRow" key={row.claim}>
                                    <span>{index + 1}</span>
                                    <strong>{row.claim}</strong>
                                    <span className={`statusPill ${row.status.toLowerCase()}`}>{row.status}</span>
                                    <span>{row.confidence}</span>
                                    <small><b>{row.severity}</b> / {row.evidence}</small>
                                </div>
                            ))}
                            {!filteredVerdictRows.length && (
                                <div className="emptyState">No verdict rows match the selected filters.</div>
                            )}
                        </div>
                        <aside className="evidencePanel">
                            <span className="eyebrow">{t('matchingEvidence')}</span>
                            <h3>{t('snippetsBesideResults')}</h3>
                            {evidenceRows.map((row) => (
                                <article className="evidenceSnippet" key={row.title}>
                                    <strong>{row.title}</strong>
                                    <p>{row.text}</p>
                                </article>
                            ))}
                        </aside>
                    </div>
                </section>
                    </>
                )}
            </main>
        </div>
    );
}

function candidateSourceText(candidate) {
    return candidate.cvText?.trim() || candidate.summary || 'No original CV text was stored for this candidate.';
}

function formatNoteDate(value) {
    if (!value) return 'Just now';
    return String(value).slice(0, 16).replace('T', ' ');
}

function candidateDecision(candidate) {
    if (candidate.score >= 82 && candidate.unsupported <= 1) {
        return {
            label: 'Interview priority',
            headline: 'Strong evidence profile with low verification pressure.',
            reason: 'The score, supported claims, and risk mix are strong enough to move quickly.',
            nextAction: 'Schedule interview and attach proof questions for the strongest claims.',
            tone: 'good',
        };
    }
    if (candidate.score >= 65) {
        return {
            label: 'Interview with proof',
            headline: 'Promising candidate, but key claims still need evidence.',
            reason: 'The profile has useful signal, but stretched or missing proof should be checked first.',
            nextAction: 'Ask for portfolio, repository, or project evidence before final shortlist.',
            tone: 'warn',
        };
    }
    if (candidate.score >= 45) {
        return {
            label: 'Manual review',
            headline: 'Mixed evidence profile with meaningful uncertainty.',
            reason: 'The candidate may fit parts of the role, but unsupported claims create review cost.',
            nextAction: 'Run WAR_AI and prepare targeted screening questions.',
            tone: 'caution',
        };
    }
    return {
        label: 'High-risk screen-out',
        headline: 'Weak proof profile for this role.',
        reason: 'The candidate has too many unsupported or stretched signals for the current job.',
        nextAction: 'Reject or request stronger evidence before spending interview time.',
        tone: 'bad',
    };
}

function proofCoverage(project, candidate) {
    const requirements = project.requirements || [];
    const total = Math.max(1, requirements.length);
    const covered = requirements.filter((requirement) => requirementClaim(candidate, requirement)?.[1] === 'Supported').length;
    return {
        covered,
        total,
        percent: Math.round((covered / total) * 100),
    };
}

function countVerdicts(rows) {
    return rows.reduce((counts, row) => {
        counts.ALL += 1;
        counts[row.status] = (counts[row.status] || 0) + 1;
        return counts;
    }, { ALL: 0, SUPPORTED: 0, STRETCHED: 0, UNSUPPORTED: 0, GAP: 0 });
}

function buildRecruiterSummary(project, candidate, decision, coverage, strongestClaim, weakestClaim) {
    return `${candidate.name} is currently marked as ${decision.label.toLowerCase()} for ${project.title}. The profile has ${coverage.percent}% proof coverage across the role requirements, with "${strongestClaim}" as the strongest visible signal and "${weakestClaim}" as the main review risk. Recommendation: ${decision.nextAction}`;
}

function stateIdFromName(name = '') {
    const normalized = name.toLowerCase();
    if (normalized.includes('light')) return 'light';
    if (normalized.includes('person')) return 'person';
    if (normalized.includes('war+ai') || normalized.includes('war_ai') || normalized.includes('strict')) return 'strict-war-ai';
    if (normalized.includes('war')) return 'war';
    return 'strict-war-ai';
}

function candidateStateStorageKey(projectId, candidateId) {
    return projectId && candidateId ? `candidate-state:${projectId}:${candidateId}` : '';
}

function readCandidateState(key, fallback) {
    if (!key || typeof localStorage === 'undefined') return fallback;
    return localStorage.getItem(`${key}:selected`) || fallback;
}

function writeCandidateState(key, stateId) {
    if (!key || typeof localStorage === 'undefined') return;
    localStorage.setItem(`${key}:selected`, stateId);
}

function readInitializedStates(key, fallback) {
    const states = new Set([fallback]);
    if (!key || typeof localStorage === 'undefined') return states;
    try {
        JSON.parse(localStorage.getItem(`${key}:initialized`) || '[]').forEach((stateId) => states.add(stateId));
    } catch {
        // Ignore stale local state.
    }
    return states;
}

function writeInitializedStates(key, states) {
    if (!key || typeof localStorage === 'undefined') return;
    localStorage.setItem(`${key}:initialized`, JSON.stringify([...states]));
}

function importantWordStats(text, highlights) {
    const words = text.toLowerCase().match(/[a-z0-9+#.]{3,}/g) || [];
    const stop = new Set(['the', 'and', 'for', 'with', 'from', 'this', 'that', 'candidate', 'resume', 'profile', 'work', 'have', 'has', 'was', 'are', 'you', 'your']);
    const counts = new Map();
    words.forEach((word) => {
        if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1);
    });
    highlights.forEach((item) => {
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

function osintPercent(status) {
    if (status === 'Ready') return 92;
    if (status === 'Partial') return 58;
    if (status === 'Escalate') return 36;
    return 18;
}

function memoryPercent(memory) {
    if (memory === 'Clear') return 88;
    if (memory === 'No prior record') return 55;
    return 28;
}

function buildScoreFactors(candidate, t) {
    const supportPoints = Math.round(scorePercent(candidate.supported, candidate) * 0.34);
    const matchPoints = Math.round(candidate.match * 0.24);
    const osintPoints = Math.round(osintPercent(candidate.osint) * 0.14);
    const memoryPoints = Math.round(memoryPercent(candidate.memory) * 0.08);
    return {
        positive: [
            { label: t('supportedClaims'), points: supportPoints },
            { label: t('jobMatchContribution'), points: matchPoints },
            { label: t('osintContribution'), points: osintPoints },
            { label: t('memoryContribution'), points: memoryPoints },
        ],
        negative: [
            { label: t('unsupportedPenalty'), points: candidate.unsupported * 8 },
            { label: t('stretchedPenalty'), points: candidate.stretched * 3 },
            { label: t('flagPenalty'), points: candidate.flags * 2 },
        ],
    };
}

function scoreLevel(score) {
    return Math.max(1, Math.min(10, Math.ceil(score / 10)));
}

function scoreLevelLabel(level, t) {
    if (level >= 9) return t('levelHighlyBacked');
    if (level >= 7) return t('levelStrong');
    if (level >= 5) return t('levelReview');
    if (level >= 3) return t('levelRisky');
    return t('levelWeak');
}

function buildMemoryProfile(candidate, t) {
    const hasMismatch = candidate.memory === 'Previous mismatch';
    const hasPrior = candidate.memory !== 'No prior record';
    return {
        tone: hasMismatch ? 'bad' : hasPrior ? 'good' : 'neutral',
        state: hasMismatch ? t('priorMismatch') : hasPrior ? t('noContradiction') : candidate.memory,
        priorScore: hasPrior ? `${Math.max(18, candidate.score - (hasMismatch ? 17 : 3))}%` : 'N/A',
        repeatedRisk: hasMismatch ? t('priorMismatch') : t('noContradiction'),
        delta: hasMismatch ? t('changedClaims') : '+0',
        timeline: [
            { label: t('firstSeen'), value: hasPrior ? '2025-06' : 'New' },
            { label: t('lastReview'), value: hasPrior ? '2026-02' : 'N/A' },
            { label: t('currentSubmission'), value: candidate.submittedAt },
        ],
    };
}

function buildInterviewQuestions(candidate, t) {
    const weakClaims = candidate.claims.filter(([claim, status]) => ['Unsupported', 'Stretched'].includes(status) && isActionableQuestionClaim(claim));
    const rows = weakClaims.map(([claim, status, reason]) => ({
        focus: claim,
        question: `${t('explainClaim')} ${claim}`,
        reason,
        tone: status === 'Unsupported' ? 'bad' : 'warn',
    }));
    if (candidate.flags > 3) {
        rows.push({
            focus: t('flags'),
            question: t('askForProof'),
            reason: `${candidate.flags} risk flags are attached to this candidate record.`,
            tone: 'bad',
        });
    }
    return rows.slice(0, 5);
}

function buildFitRows(project, candidate, t) {
    return project.requirements.map((requirement) => {
        const claimRow = requirementClaim(candidate, requirement);
        const status = claimRow?.[1] || 'Gap';
        const score = status === 'Supported' ? 98 : status === 'Stretched' ? 55 : status === 'Unsupported' ? 18 : 35;
        return {
            requirement,
            score,
            proof: status === 'Supported' ? t('strongProof') : status === 'Stretched' ? t('partialProof') : t('weakProof'),
            tone: status === 'Supported' ? 'good' : status === 'Stretched' ? 'warn' : 'bad',
        };
    });
}

function strongestRequirementClaim(project, candidate) {
    return (project.requirements || [])
        .map((requirement) => requirementClaim(candidate, requirement))
        .find((row) => row?.[1] === 'Supported')?.[0];
}

function weakestRequirementClaim(project, candidate) {
    return (project.requirements || [])
        .map((requirement) => requirementClaim(candidate, requirement))
        .find((row) => row?.[1] === 'Unsupported')?.[0]
        || (project.requirements || [])
            .map((requirement) => requirementClaim(candidate, requirement))
            .find((row) => row?.[1] === 'Stretched')?.[0];
}

function requirementClaim(candidate, requirement) {
    const wanted = normalizeLocal(requirement);
    return (candidate.claims || []).find(([claim]) => normalizeLocal(claim) === wanted);
}

function isActionableQuestionClaim(claim = '') {
    const normalized = normalizeLocal(claim);
    if (!normalized || normalized.length < 4) return false;
    if (/\b(phone|email|linkedin|mailto|contact)\b/.test(normalized)) return false;
    if (normalized.includes('http') || /^github\b/.test(normalized)) return false;
    if (/\b(native|fluent|intermediate|conversational)\b/.test(normalized)) return false;
    if (normalized.includes('@')) return false;
    return !['profile', 'technical skills', 'soft skills', 'education', 'projects', 'certifications and awards', 'languages'].includes(normalized);
}

function buildCandidateVerdicts(candidate) {
    const rows = (candidate.claims || []).map(([claim, status, reason]) => ({
        claim,
        status: status.toUpperCase(),
        confidence: status === 'Supported' ? 'HIGH' : status === 'Stretched' ? 'MEDIUM' : 'HIGH',
        severity: status === 'Unsupported' ? 'HIGH RISK' : status === 'Stretched' ? 'MEDIUM RISK' : 'LOW RISK',
        evidence: reason,
    }));
    const seen = new Set(rows.map((row) => normalizeLocal(row.claim)));
    cvSentences(candidateSourceText(candidate)).forEach((sentence) => {
        const key = normalizeLocal(sentence);
        if (!seen.has(key)) {
            rows.push(localVerdictForSentence(sentence));
            seen.add(key);
        }
    });
    return rows.length ? rows : [{
        claim: 'Candidate CV',
        status: 'GAP',
        confidence: 'LOW',
        severity: 'PROBLEM',
        evidence: 'No readable CV text was available for analysis.',
    }];
}

function filterVerdicts(rows, status, confidence, severity) {
    return rows.filter((row) => {
        const statusMatches = status === 'ALL' || row.status === status;
        const confidenceMatches = confidence === 'ALL' || row.confidence === confidence;
        const severityMatches = severity === 'ALL' || (severity === 'PROBLEM' ? row.status !== 'SUPPORTED' : row.severity === severity);
        return statusMatches && confidenceMatches && severityMatches;
    });
}

function cvSentences(text) {
    return candidateSourceText({ cvText: text })
        .split(/(?<=[.!?])\s+|\r?\n+/)
        .map((sentence) => sentence.trim())
        .filter((sentence) => sentence.length >= 18)
        .slice(0, 120);
}

function localVerdictForSentence(sentence) {
    const normalized = normalizeLocal(sentence);
    const risky = ['expert', 'senior', 'led', 'advanced', 'proven', 'guaranteed', 'best', 'deep'].some((word) => normalized.includes(word));
    const concrete = /\b(\d+|spring|java|react|sql|docker|api|github|postgres|mysql|kubernetes|aws|azure|gcp|node|python|typescript)\b/.test(normalized);
    if (risky) {
        return {
            claim: sentence,
            status: 'STRETCHED',
            confidence: concrete ? 'MEDIUM' : 'LOW',
            severity: 'MEDIUM RISK',
            evidence: 'The wording raises the proof burden and should be backed by concrete project, duration, team, or production evidence.',
        };
    }
    if (concrete) {
        return {
            claim: sentence,
            status: 'SUPPORTED',
            confidence: 'HIGH',
            severity: 'LOW RISK',
            evidence: 'The sentence contains concrete technical terms or measurable evidence from the uploaded CV.',
        };
    }
    return {
        claim: sentence,
        status: 'GAP',
        confidence: 'LOW',
        severity: 'PROBLEM',
        evidence: 'This CV sentence is shown for review but does not contain enough concrete technical evidence by itself.',
    };
}

function normalizeLocal(value) {
    return String(value || '').toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function buildEvidenceRows(project, candidate, t) {
    return [
        {
            title: t('jobDescriptionMatch'),
            text: `${project.title} requires ${project.requirements.join(', ')}. Candidate match is ${candidate.match}%.`,
        },
        {
            title: t('candidateAuditSummary'),
            text: `${candidate.summary} Current SignalTrace status is ${candidate.osint}, memory is ${candidate.memory}, and risk is ${candidate.risk}.`,
        },
        {
            title: t('claimPressure'),
            text: `${candidate.supported} supported, ${candidate.stretched} stretched, and ${candidate.unsupported} unsupported claims are currently recorded for this candidate.`,
        },
    ];
}
