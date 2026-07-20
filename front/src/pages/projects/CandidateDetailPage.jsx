import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Award, BriefcaseBusiness, CheckCircle2, CodeXml, ExternalLink, FileText, History, Link, MessageSquarePlus, Radar, RefreshCcw, ScanText, ShieldCheck, Sparkles, Star, ThumbsDown, ThumbsUp, Trash2, X, XCircle } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiCreateCandidateNote, apiDeleteCandidate, apiGetCandidateWorkflow, apiGetLatestCandidateOsint, apiListCandidateNotes, apiReanalyzeCandidate, apiUpdateCandidateAnalysisState, apiUpdateCandidateStatus, apiVoteCandidate } from '../../api';
import defaultAts from '../../data/default-ats.json';
import { analysisStates } from '../../data/analysisStates';
import { findCatchphraseMatches } from '../../utils/catchphraseAnalyzer';
import { buildAtsReport, candidateSourceText as atsCandidateSourceText, projectDescriptionText, splitTextByTerms } from './atsReportUtils';
import { recordProjectActivityOnServer } from './projectActivity';
import { findCandidateFromPath, scorePercent, scoreTone } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';
import '../../styles/candidateInsights.css';

const pipelineSteps = ['Unreviewed', 'OnCheck', 'OnInterview', 'Hired', 'Closed'];

export function CandidateDetailPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false, onProjectsChange }) {
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
    const [workflow, setWorkflow] = useState(null);
    const [workflowMessage, setWorkflowMessage] = useState('');
    const [statusTarget, setStatusTarget] = useState('');
    const [statusReason, setStatusReason] = useState('');
    const [statusBusy, setStatusBusy] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletePhrase, setDeletePhrase] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState('');
    const [analysisStateMessage, setAnalysisStateMessage] = useState('');
    const [analysisStateBusy, setAnalysisStateBusy] = useState(false);
    const [signalTraceReport, setSignalTraceReport] = useState(null);
    const [signalTraceLoading, setSignalTraceLoading] = useState(false);
    const [activeDetailTab, setActiveDetailTab] = useState('overview');
    const { project, candidate } = findCandidateFromPath(projects);
    const activeProject = project;
    const activeCandidate = candidate;
    const [voteScore, setVoteScore] = useState('3');
    const projectStateId = stateIdFromName(activeProject?.state);
    const [activeStateId, setActiveStateId] = useState(activeCandidate?.analysisState || projectStateId);
    const [initializedStateIds, setInitializedStateIds] = useState(() => new Set(activeCandidate?.initializedAnalysisStates || [projectStateId]));

    useEffect(() => {
        setActiveStateId(activeCandidate?.analysisState || projectStateId);
        setInitializedStateIds(new Set(activeCandidate?.initializedAnalysisStates?.length
            ? activeCandidate.initializedAnalysisStates
            : [projectStateId]));
        setAnalysisStateMessage('');
    }, [activeCandidate?.id, activeCandidate?.analysisState, activeCandidate?.initializedAnalysisStates, projectStateId]);

    useEffect(() => {
        setWorkflow(null);
        setWorkflowMessage('');
    }, [activeProject?.id]);

    useEffect(() => {
        if (!activeProject?.id || !activeCandidate?.id || !userToken) return;
        let cancelled = false;
        apiGetCandidateWorkflow(activeProject.id, activeCandidate.id, userToken)
            .then((row) => {
                if (!cancelled) setWorkflow(row);
            })
            .catch(() => {
                if (!cancelled) setWorkflow(null);
            });
        return () => {
            cancelled = true;
        };
    }, [activeProject?.id, activeCandidate?.id, userToken]);

    useEffect(() => {
        if (!activeProject?.id || !activeCandidate?.id || !userToken) return;
        let cancelled = false;
        setSignalTraceLoading(true);
        apiGetLatestCandidateOsint(activeProject.id, activeCandidate.id, userToken)
            .then((row) => {
                if (!cancelled) setSignalTraceReport(row);
            })
            .catch(() => {
                if (!cancelled) setSignalTraceReport(null);
            })
            .finally(() => {
                if (!cancelled) setSignalTraceLoading(false);
            });
        return () => {
            cancelled = true;
        };
    }, [activeProject?.id, activeCandidate?.id, activeCandidate?.osint, userToken]);

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

    useEffect(() => {
        if (!activeProject?.id || !activeCandidate?.id || !user) return;
        writeActivity(activeProject.id, user, activeCandidate, 'opened candidate profile', userToken, { type: 'candidate_view' });
    }, [activeProject?.id, activeCandidate?.id, activeCandidate, user, userToken]);

    const atsReport = useMemo(() => buildAtsReport(activeProject, activeCandidate), [activeProject, activeCandidate]);

    if (!activeProject || !activeCandidate) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow={activeProject ? 'Candidate' : undefined} title={activeProject ? 'Candidate not found' : undefined} message={activeProject ? 'This candidate is unavailable or was removed from the project.' : undefined} />;

    }

    const verdictRows = buildCandidateVerdicts(activeCandidate);
    const evidenceRows = buildEvidenceRows(activeProject, activeCandidate, t);
    const sourceCards = buildSourceCards(activeCandidate);
    const technologyRows = buildTechnologyMatrix(atsReport, sourceCards);
    const scoreFactors = buildScoreFactors(activeCandidate, t);
    const activeScoreLevel = scoreLevel(activeCandidate.score);
    const memoryProfile = buildMemoryProfile(activeCandidate, t);
    const interviewQuestions = buildInterviewQuestions(activeCandidate, t);
    const fitRows = buildFitRows(activeProject, activeCandidate);
    const cvText = candidateSourceText(activeCandidate);
    const cvHighlights = findCatchphraseMatches(cvText);
    const cvStats = importantWordStats(cvText, cvHighlights);
    const filteredVerdictRows = filterVerdicts(verdictRows, statusFilter, confidenceFilter, severityFilter);
    const activeState = analysisStates.find((state) => state.id === activeStateId) || analysisStates[0];
    const selectedStateInitialized = initializedStateIds.has(activeStateId);
    const decision = candidateDecision(activeCandidate);
    const coverage = proofCoverage(activeProject, activeCandidate);
    const verdictCounts = countVerdicts(verdictRows);
    const strongestClaim = activeCandidate.claims.find(([claim, status]) => status === 'Supported' && candidateCvContainsClaim(activeCandidate, claim))?.[0]
        || strongestRequirementClaim(activeProject, activeCandidate)
        || activeCandidate.role;
    const weakestClaim = activeCandidate.claims.find(([claim, status]) => status === 'Unsupported' && candidateCvContainsClaim(activeCandidate, claim) && isActionableQuestionClaim(claim))?.[0]
        || activeCandidate.claims.find(([claim, status]) => status === 'Stretched' && candidateCvContainsClaim(activeCandidate, claim) && isActionableQuestionClaim(claim))?.[0]
        || weakestRequirementClaim(activeProject, activeCandidate)
        || activeCandidate.risk;
    const recruiterSummary = buildRecruiterSummary(activeProject, activeCandidate, decision, coverage, strongestClaim, weakestClaim);
    const voteStats = workflow?.voteSummary || voteSummary();
    const voteRow = workflow?.voteRow || workflow?.votes || workflow?.voteSummary || {};
    const myVoteKey = user?.email || user?.username || 'me';
    const pipelineStatus = workflow?.status || activeCandidate.state || 'Unreviewed';
    const projectRole = activeProject?.myRole || 'Viewer';
    const projectPermissions = activeProject?.myPermissions || [];
    const canVote = hasProjectPermission(projectRole, projectPermissions, 'canVote');
    const canAddNote = hasProjectPermission(projectRole, projectPermissions, 'canAddNote');
    const activePipelineIndex = Math.max(0, pipelineSteps.indexOf(pipelineStatus));
    const activityCount = workflow?.activity?.length || 0;
    const workflowTrustLabel = userToken ? 'Server saved workflow' : 'Demo browser workflow';
    const decisionVoteCount = voteStats.totalVotes ?? (voteStats.attribution || []).filter((line) => /upvote|downvote/i.test(line)).length ?? 0;
    const deleteReady = deletePhrase.trim() === 'I confirm';

    async function selectAnalysisState(stateId) {
        const previous = activeStateId;
        setActiveStateId(stateId);
        setAnalysisStateBusy(true);
        setAnalysisStateMessage('');
        try {
            const updated = await apiUpdateCandidateAnalysisState(activeProject.id, activeCandidate.id, { state: stateId }, userToken);
            setActiveStateId(updated.analysis_state || updated.analysisState || stateId);
            setInitializedStateIds(new Set(updated.initialized_analysis_states || updated.initializedAnalysisStates || []));
            await onProjectsChange?.();
        } catch (error) {
            setActiveStateId(previous);
            setAnalysisStateMessage(error.message || 'Could not save the analysis state.');
        } finally {
            setAnalysisStateBusy(false);
        }
    }

    async function initializeAnalysisState() {
        setAnalysisStateBusy(true);
        setAnalysisStateMessage('');
        try {
            const updated = await apiUpdateCandidateAnalysisState(activeProject.id, activeCandidate.id, {
                state: activeStateId,
                initialize: true,
            }, userToken);
            setInitializedStateIds(new Set(updated.initialized_analysis_states || updated.initializedAnalysisStates || [activeStateId]));
            setAnalysisStateMessage(`${activeState.name} is initialized and saved for the project team.`);
            await onProjectsChange?.();
        } catch (error) {
            setAnalysisStateMessage(error.message || 'Could not initialize the analysis state.');
        } finally {
            setAnalysisStateBusy(false);
        }
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
        if (!canAddNote) return;
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
            setWorkflow(await apiGetCandidateWorkflow(activeProject.id, activeCandidate.id, userToken));
            setNoteBody('');
            setNoteMessage('Reviewer note saved.');
        } catch (error) {
            setNoteMessage(error.message || 'Could not save reviewer note.');
        } finally {
            setNoteBusy(false);
        }
    }

    async function upvote() {
        await saveServerVote('UPVOTE', Number(voteScore));
    }

    async function downvote() {
        await saveServerVote('DOWNVOTE');
    }

    async function toggleStar() {
        const willStar = !workflow?.voteSummary?.starredByMe;
        await saveServerVote(willStar ? 'STAR' : 'UNSTAR');
    }

    async function saveServerVote(action, score = null) {
        if (!canVote) return;
        if (!userToken) {
            setWorkflowMessage('Sign in before changing candidate workflow.');
            return;
        }
        setWorkflowMessage('');
        try {
            const next = await apiVoteCandidate(activeProject.id, activeCandidate.id, { action, score }, userToken);
            setWorkflow(next);
            setWorkflowMessage('Workflow saved.');
        } catch (error) {
            setWorkflowMessage(error.message || 'Could not save workflow vote.');
        }
    }

    function requestPipelineStatus(status) {
        if (!canSetStatus(projectRole, projectPermissions, status)) return;
        if (status === pipelineStatus) return;
        setStatusTarget(status);
        setStatusReason('');
        setWorkflowMessage('');
    }

    async function changePipelineStatus() {
        const status = statusTarget;
        if (!status) return;
        if (!userToken) {
            setWorkflowMessage('Sign in before changing candidate workflow.');
            return;
        }
        if (['OnInterview', 'Hired', 'Closed'].includes(status) && statusReason.trim().length < 12) {
            setWorkflowMessage('Add a clear decision reason of at least 12 characters.');
            return;
        }
        setStatusBusy(true);
        setWorkflowMessage('');
        try {
            const next = await apiUpdateCandidateStatus(activeProject.id, activeCandidate.id, {
                status,
                reason: statusReason.trim(),
            }, userToken);
            setWorkflow(next);
            await onProjectsChange?.();
            setWorkflowMessage('Candidate status saved.');
            setStatusTarget('');
            setStatusReason('');
        } catch (error) {
            setWorkflowMessage(error.message || 'Could not save candidate status.');
        } finally {
            setStatusBusy(false);
        }
    }

    async function deleteCandidate() {
        if (!deleteReady || deleteBusy) return;
        setDeleteBusy(true);
        setDeleteMessage('');
        try {
            await apiDeleteCandidate(activeProject.id, activeCandidate.id, userToken);
            await onProjectsChange?.();
            navigateTo(setRoute, 'projectDetail', activeProject.id);
        } catch (error) {
            setDeleteMessage(error.message || 'Could not delete candidate.');
        } finally {
            setDeleteBusy(false);
        }
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className={`detailPage contentFadeIn candidateTab-${activeDetailTab}`}>
                <section className="detailHero candidateDetailHero">
                    <div className="candidateHeroMain">
                        <button className="secondary candidateBackButton" onClick={() => navigateTo(setRoute, 'projectDetail', activeProject.id)}><ArrowRight size={16} /> {t('backToJob')}</button>
                        <div className="candidateTitleRow">
                            <h1>{activeCandidate.name}</h1>
                            <div className={`candidateScore inline ${scoreTone(activeCandidate.score)}`}>{activeCandidate.score}</div>
                        </div>
                        <p>{candidateScoreExplanation(activeCandidate)}</p>
                        <div className="candidateDecisionLine">
                            <span className={`decisionBadge ${decision.tone}`}>{decision.label}</span>
                            <strong>{decision.headline}</strong>
                            <small>{decision.reason}</small>
                        </div>
                    </div>
                    <div className="candidateHeroActions">
                        <button className="secondary" disabled={reanalyzing} onClick={reanalyzeCandidate} type="button"><RefreshCcw size={18} /> {reanalyzing ? 'Re-running...' : 'Re-run analysis'}</button>
                        <button className="secondary" onClick={() => navigateTo(setRoute, 'candidateReport', activeProject.id, activeCandidate.id)} type="button"><FileText size={18} /> Export</button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'candidateProfile', activeProject.id, activeCandidate.id)}><ScanText size={18} /> {t('profilingMode')}</button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'signalTrace', activeProject.id, activeCandidate.id)}><Radar size={18} /> {t('signalTrace')}</button>
                        <button className="destructive" onClick={() => setDeleteOpen(true)} type="button"><Trash2 size={18} /> Delete</button>
                    </div>
                </section>
                <nav className="candidateDetailTabs" aria-label="Candidate workspace">
                    {[
                        ['overview', 'Overview'],
                        ['fit', 'Fit'],
                        ['evidence', 'Evidence'],
                        ['review', 'Review'],
                    ].map(([value, label]) => (
                        <button className={activeDetailTab === value ? 'active' : ''} key={value} onClick={() => setActiveDetailTab(value)} type="button">
                            {label}
                        </button>
                    ))}
                </nav>
                {reanalyzeMessage && <div className="inlineNotice">{reanalyzeMessage}</div>}
                <CandidateDecisionScoreBand candidate={activeCandidate} report={signalTraceReport} onOpenEvidence={() => setActiveDetailTab('evidence')} />
                {(signalTraceReport || (signalTraceLoading && activeCandidate.osint !== 'Not started')) && (
                    <GithubJobMatchBand
                        candidate={activeCandidate}
                        project={activeProject}
                        report={signalTraceReport}
                        loading={signalTraceLoading}
                        navigateTo={navigateTo}
                        setRoute={setRoute}
                    />
                )}
                <AtsCandidateOverview
                    candidate={activeCandidate}
                    project={activeProject}
                    report={atsReport}
                    navigateTo={navigateTo}
                    setRoute={setRoute}
                    reanalyzing={reanalyzing}
                    onReanalyze={reanalyzeCandidate}
                />
                <section className="detailMeta">
                    <Metric label={t('role')} value={activeCandidate.role} />
                    <Metric label="ATS coverage" value={`${activeCandidate.match}%`} />
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
                        <span className="eyebrow">Strict claim coverage</span>
                        <strong>{coverage.percent}%</strong>
                        <div className="decisionRail"><span style={{ width: `${coverage.percent}%` }} /></div>
                    </article>
                    <article>
                        <span className="eyebrow">Strongest CV signal</span>
                        <strong>{strongestClaim}</strong>
                        <p>{activeCandidate.supported} CV-aligned signals</p>
                    </article>
                    <article>
                        <span className="eyebrow">Main risk</span>
                        <strong>{weakestClaim}</strong>
                        <p>{activeCandidate.unsupported + activeCandidate.stretched} review signals</p>
                    </article>
                </section>
                <section className="candidateVotingPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Voting</span>
                            <h2>Candidate score and pipeline</h2>
                        </div>
                        <span>Avg {voteStats.average}/5 / {voteStats.downvotes} downvotes / {voteStats.stars} stars</span>
                    </div>
                    {workflowMessage && <div className="inlineNotice">{workflowMessage}</div>}
                    <div className="workflowTrustStrip">
                        <span><ShieldCheck size={16} /> {workflowTrustLabel}</span>
                        <span>{decisionVoteCount} vote{decisionVoteCount === 1 ? '' : 's'}</span>
                        <span>{activityCount} workflow event{activityCount === 1 ? '' : 's'}</span>
                        <span>{projectRole}</span>
                    </div>
                    <div className="pipelineTimeline" aria-label="Candidate status timeline">
                        {pipelineSteps.map((status, index) => {
                            const state = index < activePipelineIndex ? 'done' : index === activePipelineIndex ? 'active' : 'pending';
                            return (
                                <button
                                    className={state}
                                    disabled={!canSetStatus(projectRole, projectPermissions, status)}
                                    key={status}
                                    onClick={() => requestPipelineStatus(status)}
                                    title={canSetStatus(projectRole, projectPermissions, status) ? `Move candidate to ${status}` : `Your role cannot set ${status}`}
                                    type="button"
                                >
                                    <span>{index + 1}</span>
                                    <strong>{status}</strong>
                                </button>
                            );
                        })}
                    </div>
                    <div className="candidateVotingGrid">
                        <article>
                            <strong>Reviewer vote</strong>
                            <label>
                                Upvote score
                                <select value={voteScore} onChange={(event) => setVoteScore(event.target.value)}>
                                    {scoreOptions().map((score) => <option key={score} value={score}>{score}</option>)}
                                </select>
                            </label>
                            <div className="teamActionRow">
                                <button className="primary" disabled={!canVote} type="button" onClick={upvote}><ThumbsUp size={16} /> Upvote</button>
                                <button className="secondary" disabled={!canVote} type="button" onClick={downvote}><ThumbsDown size={16} /> Downvote</button>
                                <button className="secondary" disabled={!canVote} type="button" onClick={toggleStar}><Star size={16} /> {workflow?.voteSummary?.starredByMe || voteRow.stars?.[myVoteKey] ? 'Unstar' : 'Star'}</button>
                            </div>
                        </article>
                        <article>
                            <strong>Status pipeline</strong>
                            <label>
                                Candidate status
                                <select value={pipelineStatus} onChange={(event) => requestPipelineStatus(event.target.value)}>
                                    {pipelineSteps.map((status) => <option disabled={!canSetStatus(projectRole, projectPermissions, status)} key={status}>{status}</option>)}
                                </select>
                            </label>
                            <small>Your role: {projectRole}. Voter+: vote. Reviewer+: add notes. Screener+: OnCheck. Coordinator+: interview, hire, close.</small>
                        </article>
                    </div>
                    <div className="voteAttributionList">
                        {(workflow?.voteSummary?.attribution || voteAttribution(voteRow)).map((line) => <span key={line}>{line}</span>)}
                        {(workflow?.voteSummary?.attribution || voteAttribution(voteRow)).length === 0 && <span>No votes yet.</span>}
                    </div>
                </section>
                {workflow?.activity?.length > 0 && (
                    <section className="reviewNotesPanel">
                        <div className="tableToolbar">
                            <div>
                                <span className="eyebrow">Activity</span>
                                <h2><History size={18} /> Candidate workflow trail</h2>
                            </div>
                            <div className="teamActionRow">
                                <span>{Math.min(5, workflow.activity.length)} of {workflow.activity.length} event{workflow.activity.length === 1 ? '' : 's'}</span>
                                <button className="secondary" type="button" onClick={() => openCandidateLogs(activeProject, activeCandidate, setRoute, navigateTo)}>
                                    See more
                                </button>
                            </div>
                        </div>
                        <div className="reviewNoteList">
                            {workflow.activity.slice(0, 5).map((row) => (
                                <article key={row.id}>
                                    <div>
                                        <strong>{row.action}</strong>
                                        <small>{row.actor_name || row.actorName || 'Reviewer'} / {formatNoteDate(row.created_at || row.createdAt)}</small>
                                    </div>
                                    <p>{row.candidate_name || row.candidateName || activeCandidate.name}</p>
                                </article>
                            ))}
                        </div>
                    </section>
                )}
                <section className="reviewNotesPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Reviewer notes</span>
                            <h2><MessageSquarePlus size={18} /> Decision history</h2>
                        </div>
                        <span>{reviewNotes.length} note{reviewNotes.length === 1 ? '' : 's'}</span>
                    </div>
                    {noteMessage && <div className="inlineNotice">{noteMessage}</div>}
                    {!canAddNote && <div className="inlineNotice">Your current role is {projectRole}. Reviewer or higher can add notes; everyone with project access can read them.</div>}
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
                        <button className="primary" disabled={!canAddNote || noteBusy || !noteBody.trim()} type="submit">Save note</button>
                    </form>
                    <div className="reviewNoteList">
                        {reviewNotes.map((note) => {
                            const noteTone = noteVoteTone(note, voteRow);
                            return (
                            <article className={noteTone.tone} key={note.id}>
                                <div>
                                    <strong>{note.decision}</strong>
                                    <small>{note.author_name || 'Reviewer'} / {formatNoteDate(note.created_at)} / {noteTone.label}</small>
                                </div>
                                <p>{note.body}</p>
                            </article>
                            );
                        })}
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
                                <button className={state.id === activeStateId ? 'active' : ''} disabled={analysisStateBusy || !canAddNote} key={state.id} onClick={() => selectAnalysisState(state.id)} type="button">
                                    <span>
                                        <strong>{state.name}</strong>
                                        <small>{state.description}</small>
                                    </span>
                                    <b className={initialized ? 'stateDone' : 'statePending'}>{initialized ? 'Done' : 'Not initialized'}</b>
                                </button>
                            );
                        })}
                    </div>
                    {selectedStateInitialized && (
                        <div className="analysisProvenance" role="status">
                            <span><b>Engine</b> {activeCandidate.analysisEngine || 'Legacy analysis'}</span>
                            <span><b>Prompt</b> {activeCandidate.analysisPromptVersion || 'Local policy'}</span>
                            <span><b>Tokens</b> {activeCandidate.totalTokens || 0}</span>
                            <span><b>Cost</b> ${Number(activeCandidate.estimatedCostUsd || 0).toFixed(6)}</span>
                            {['person', 'strict-war-ai'].includes(activeStateId)
                                && !activeCandidate.analysisEngine?.includes('LLM_') && (
                                <strong>AI was unavailable; a local fallback produced this result.</strong>
                            )}
                        </div>
                    )}
                    {analysisStateMessage && <p className="formMessage">{analysisStateMessage}</p>}
                </section>
                {!selectedStateInitialized ? (
                    <section className="analysisBlankPanel">
                        <div>
                            <span className="eyebrow">Analysis not initialized</span>
                            <h2>{activeState.name} has not run for this candidate.</h2>
                            <p>No score explanation, claim verdicts, job fit, memory, or OSINT-derived results are available for this State yet.</p>
                        </div>
                        <button className="primary" disabled={analysisStateBusy || !canAddNote} onClick={initializeAnalysisState} type="button">Initialize Analysis with State: {activeState.name}</button>
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
                {statusTarget && (
                    <div className="modalOverlay" role="presentation" onMouseDown={() => !statusBusy && setStatusTarget('')}>
                        <section className="workflowDecisionModal" role="alertdialog" aria-modal="true" aria-labelledby="workflow-decision-title" onMouseDown={(event) => event.stopPropagation()}>
                            <button className="iconButton workflowModalClose" aria-label="Close status change" disabled={statusBusy} onClick={() => setStatusTarget('')} type="button"><X size={20} /></button>
                            <span className="eyebrow">Confirm workflow decision</span>
                            <h2 id="workflow-decision-title">Move {activeCandidate.name} to {statusTarget}?</h2>
                            <p>This decision is written to the project activity log with your identity and timestamp.</p>
                            <div className="workflowTransition">
                                <span>{pipelineStatus}</span>
                                <ArrowRight size={18} />
                                <strong>{statusTarget}</strong>
                            </div>
                            <label>
                                Decision reason {['OnInterview', 'Hired', 'Closed'].includes(statusTarget) ? '(required)' : '(optional)'}
                                <textarea
                                    autoFocus
                                    maxLength={2000}
                                    onChange={(event) => setStatusReason(event.target.value)}
                                    placeholder="State the evidence and reviewer rationale for this move."
                                    rows={5}
                                    value={statusReason}
                                />
                            </label>
                            {statusTarget === 'Hired' && (
                                <div className="workflowGateNotice">
                                    Hiring requires an interview-stage candidate, at least one reviewer vote, and independent evidence when the project policy requires it.
                                </div>
                            )}
                            {workflowMessage && <div className="error" role="alert">{workflowMessage}</div>}
                            <div className="workflowModalActions">
                                <button className="secondary" disabled={statusBusy} onClick={() => setStatusTarget('')} type="button">Cancel</button>
                                <button className="primary" disabled={statusBusy} onClick={changePipelineStatus} type="button">
                                    {statusBusy ? 'Saving...' : `Confirm ${statusTarget}`}
                                </button>
                            </div>
                        </section>
                    </div>
                )}
                <section className="technologyMatrixPanel">
                    <div className="tableToolbar">
                        <div><span className="eyebrow">Technology matrix</span><h2>Claim, role demand, and evidence confidence</h2></div>
                        <span>{technologyRows.length} technologies</span>
                    </div>
                    <div className="technologyMatrix" role="table" aria-label="Candidate technology evidence matrix">
                        <div className="technologyMatrixRow heading" role="row"><span>Technology</span><span>CV mentions</span><span>Job mentions</span><span>Public evidence</span><span>Confidence</span></div>
                        {technologyRows.map((row) => (
                            <div className="technologyMatrixRow" role="row" key={row.label}>
                                <strong>{row.label}</strong>
                                <span>{row.resumeCount}</span>
                                <span>{row.jobCount}</span>
                                <span className={row.publicEvidence ? 'matrixEvidence found' : 'matrixEvidence missing'}>{row.publicEvidence ? row.source : 'Not found'}</span>
                                <span className={`matrixConfidence ${row.tone}`}>{row.confidence}</span>
                            </div>
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
                                    <span className={`statusPill ${row.status.toLowerCase()}`}>{claimDisplayStatus(row.status)}</span>
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
                            <div className="sourceCardStack">
                                {sourceCards.map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <article className={`sourceCard ${card.tone}`} key={card.kind}>
                                            <div className="sourceCardIcon"><Icon size={18} /></div>
                                            <div>
                                                <strong>{card.title}</strong>
                                                <span>{card.summary}</span>
                                                {card.url ? <a href={card.url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open source</a> : <small>No link found in CV text.</small>}
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        </aside>
                    </div>
                </section>
                    </>
                )}
            </main>
            {deleteOpen && (
                <div className="candidateSendBackdrop settingsDeleteBackdrop" role="dialog" aria-modal="true">
                    <section className="candidateSendModal settingsDeleteModal">
                        <div className="modalHead">
                            <div>
                                <span className="eyebrow">Confirm candidate deletion</span>
                                <h2>Delete {activeCandidate.name}</h2>
                            </div>
                            <button type="button" onClick={() => setDeleteOpen(false)}><X size={16} /> Close</button>
                        </div>
                        {deleteMessage && <div className="error compact">{deleteMessage}</div>}
                        <div className="deleteConfirmBox">
                            <AlertTriangle size={32} />
                            <p>You are about to delete <strong>{activeCandidate.name}</strong> from <strong>{activeProject.title}</strong>. This action will be saved in the project log. Type exactly <strong>I confirm</strong>.</p>
                            <input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} placeholder="I confirm" />
                        </div>
                        <button className="destructive" disabled={!deleteReady || deleteBusy} type="button" onClick={deleteCandidate}>
                            <Trash2 size={16} /> {deleteBusy ? 'Deleting...' : 'Delete candidate'}
                        </button>
                    </section>
                </div>
            )}
        </div>
    );
}

function openCandidateLogs(project, candidate, setRoute, navigateTo) {
    if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(`projectLogFilter:${project.id}`, JSON.stringify({
            open: true,
            candidateId: String(candidate.id),
            candidateName: candidate.name,
        }));
    }
    navigateTo(setRoute, 'projectSettings', project.id);
}

function candidateSourceText(candidate) {
    return candidate.cvText?.trim() || candidate.summary || 'No original CV text was stored for this candidate.';
}

function CandidateDecisionScoreBand({ candidate, report, onOpenEvidence }) {
    const githubJobMatch = report?.github_job_match || report?.githubJobMatch;
    const githubScore = candidate.githubMatchScore || Number(githubJobMatch?.score || 0);
    const evidenceScore = candidate.evidenceScore || (
        report?.github
            ? Math.min(100, Math.round(Number(report.identityConfidence || 0) * 0.35 + githubScore * 0.65))
            : 0
    );
    const measures = [
        {
            key: 'recommendation',
            label: 'Recommendation',
            value: candidate.score ?? 0,
            detail: 'Strict CV and requirement analysis',
        },
        {
            key: 'fit',
            label: 'ATS keyword coverage',
            value: candidate.fitScore ?? candidate.match ?? 0,
            detail: 'Project requirements mentioned in the CV; not proof',
        },
        {
            key: 'evidence',
            label: 'Verified evidence',
            value: evidenceScore,
            detail: evidenceScore > 0 ? 'Independent public evidence coverage' : 'No independent proof completed',
        },
        {
            key: 'github',
            label: 'GitHub relevance',
            value: githubScore,
            detail: githubScore > 0 ? 'Repository signals relevant to this role' : 'Run SignalTrace to calculate',
        },
        {
            key: 'review',
            label: 'Reviewer consensus',
            value: candidate.reviewerScore ?? 0,
            detail: candidate.reviewerScore > 0 ? 'Latest reviewer votes normalized to 100' : 'No reviewer votes yet',
        },
    ];
    return (
        <section className="candidateDecisionScores">
            <div className="candidateDecisionScoreHead">
                <div>
                    <span className="eyebrow">Decision dimensions</span>
                    <h2>Different scores answer different hiring questions.</h2>
                    <p>ATS keyword coverage measures CV wording. The recommendation also applies strict claim checks, risk penalties, verified evidence, and reviewer input.</p>
                </div>
                <button className="secondary" onClick={onOpenEvidence} type="button"><ShieldCheck size={16} /> Review evidence</button>
            </div>
            {Math.abs(Number(candidate.fitScore || 0) - Number(candidate.score || 0)) >= 25 && (
                <div className="candidateScoreGapNotice" role="note">
                    <AlertTriangle size={18} />
                    <span>
                        <strong>{candidate.fitScore}% keyword coverage is not a {candidate.fitScore}% hiring recommendation.</strong>
                        {' '}The recommendation is {candidate.score}% because strict analysis found {candidate.unsupported} unsupported and {candidate.stretched} partial signals, with {evidenceScore}% independently verified evidence.
                    </span>
                </div>
            )}
            <div className="candidateDecisionScoreGrid">
                {measures.map((measure) => (
                    <article className={scoreTone(measure.value)} key={measure.key}>
                        <span>{measure.label}</span>
                        <strong>{measure.value}%</strong>
                        <div className="candidateDecisionScoreRail"><i style={{ width: `${Math.max(0, Math.min(100, measure.value))}%` }} /></div>
                        <small>{measure.detail}</small>
                    </article>
                ))}
            </div>
            {candidate.analysisRuns?.length > 0 && (
                <div className="candidateRunLedger">
                    <span>Recent immutable runs</span>
                    {candidate.analysisRuns.slice(0, 4).map((run) => (
                        <small key={run.id}>
                            <strong>{stateLabel(run.stateId)}</strong>
                            {run.fitScore}% fit / {run.evidenceScore}% evidence / {formatNoteDate(run.createdAt)}
                        </small>
                    ))}
                </div>
            )}
        </section>
    );
}

function GithubJobMatchBand({ candidate, project, report, loading, navigateTo, setRoute }) {
    const match = report?.github_job_match || report?.githubJobMatch;
    const github = report?.github;

    if (loading && !report) {
        return (
            <section className="githubJobMatchBand loading" aria-busy="true">
                <span className="githubJobMatchScore">...</span>
                <div className="githubJobMatchMain">
                    <span className="eyebrow">GitHub evidence for this job</span>
                    <h2>Loading public repository evidence...</h2>
                    <p>Comparing the latest completed SignalTrace report with {project.title}.</p>
                </div>
            </section>
        );
    }

    const score = Number(match?.score || 0);
    const tone = score >= 75 ? 'good' : score >= 50 ? 'warn' : 'bad';
    const matchedTerms = match?.matched_terms || match?.matchedTerms || [];
    const missingTerms = match?.missing_terms || match?.missingTerms || [];
    const latestActivity = github?.latest_activity_at || github?.latestActivityAt;
    const depthScore = github?.repository_depth_score ?? github?.repositoryDepthScore;
    const publicRepos = github?.public_repos ?? github?.publicRepos;

    return (
        <section className={`githubJobMatchBand ${tone}`} aria-label="GitHub job match">
            <div className="githubJobMatchScore" aria-label={`GitHub job match ${score} percent`}>
                <strong>{score}</strong>
                <span>%</span>
            </div>
            <div className="githubJobMatchMain">
                <span className="eyebrow">GitHub evidence for this job</span>
                <h2>{match?.label || 'GitHub match needs a fresh scan'}</h2>
                <p>{match?.summary || `Run SignalTrace again to compare ${candidate.name}'s public repositories with ${project.title}.`}</p>
                <div className="githubJobMatchTerms">
                    {matchedTerms.slice(0, 8).map((term) => (
                        <span className="matched" key={`matched-${term}`}><CheckCircle2 size={14} /> {term}</span>
                    ))}
                    {missingTerms.slice(0, 6).map((term) => (
                        <span className="missing" key={`missing-${term}`}><XCircle size={14} /> {term}</span>
                    ))}
                    {matchedTerms.length === 0 && missingTerms.length === 0 && (
                        <span className="missing">No job technology comparison is available yet</span>
                    )}
                </div>
            </div>
            <div className="githubJobMatchFacts">
                <span>
                    <small>Latest activity</small>
                    <strong>{formatSignalTraceDate(latestActivity)}</strong>
                </span>
                <span>
                    <small>Repository depth</small>
                    <strong>{Number.isFinite(Number(depthScore)) ? `${depthScore}/100` : 'Not checked'}</strong>
                </span>
                <span>
                    <small>Public repositories</small>
                    <strong>{Number.isFinite(Number(publicRepos)) ? publicRepos : 'Not checked'}</strong>
                </span>
            </div>
            <button
                className="primary githubJobMatchAction"
                onClick={() => navigateTo(setRoute, 'signalTraceReport', project.id, candidate.id)}
                type="button"
            >
                <CodeXml size={17} /> View GitHub evidence <ArrowRight size={16} />
            </button>
        </section>
    );
}

function formatSignalTraceDate(value) {
    if (!value) return 'No activity found';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function AtsCandidateOverview({ project, candidate, report, navigateTo, setRoute, reanalyzing, onReanalyze }) {
    const [view, setView] = useState('comparison');
    const resumeText = atsCandidateSourceText(candidate);
    const jobText = projectDescriptionText(project);
    const visibleSkills = report.skills.slice(0, 18);
    return (
        <section className="atsEmbeddedPanel">
            <aside className="atsScoreSidebar embedded">
                <h2>Match Rate</h2>
                <div className="atsScoreDonut" style={{ '--ats-score': `${report.score * 3.6}deg` }}>
                    <div><strong>{report.score}</strong><span>%</span></div>
                </div>
                <button className="atsBlueButton" disabled={reanalyzing} type="button" onClick={onReanalyze}><RefreshCcw size={16} /> {reanalyzing ? 'Scanning...' : 'Upload & rescan'}</button>
                <button className="atsPaleButton" type="button" onClick={() => navigateTo(setRoute, 'candidateProfile', project.id, candidate.id)}><Sparkles size={16} /> Highlighted view</button>
                <div className="atsProgressList">
                    {report.categories.map((category) => (
                        <div className="atsProgressRow" key={category.label}>
                            <div><span>{category.label}</span><small>{category.issues} {category.issues === 1 ? 'issue' : 'issues'} to fix</small></div>
                            <b><i style={{ width: `${category.progress}%` }} /></b>
                        </div>
                    ))}
                </div>
            </aside>
            <div className="atsEmbeddedMain">
                <div className="atsTipBanner">
                    <Sparkles size={17} />
                    <span>ATS-specific scan for {project.title}. Skills, searchability, recruiter tips, and formatting are generated from the default ATS template.</span>
                    <button type="button" onClick={() => navigateTo(setRoute, 'candidateReport', project.id, candidate.id)}>Open Match Report</button>
                </div>
                <section className="atsCheckPanel">
                    <div className="atsSectionHead">
                        <div>
                            <h2>Searchability</h2>
                            <p>How well this resume can be found, parsed, and understood by hiring teams.</p>
                        </div>
                        <span className="atsImpactBadge">Important</span>
                    </div>
                    <div className="atsCheckRows">
                        {report.searchabilityRows.map((row) => (
                            <article key={row.label}>
                                <strong>{row.label}</strong>
                                {row.ok ? <CheckCircle2 className="atsOkIcon" size={18} /> : <XCircle className="atsBadIcon" size={18} />}
                                <span>{row.text}</span>
                            </article>
                        ))}
                    </div>
                </section>
                <section className="atsCheckPanel">
                    <div className="atsSectionHead">
                        <div>
                            <h2>Skills</h2>
                            <p>Hard and soft signals are combined into one comparison, colored by match quality.</p>
                        </div>
                        <div className="atsSegmented">
                            <button className={view === 'comparison' ? 'active' : ''} type="button" onClick={() => setView('comparison')}>Skills Comparison</button>
                            <button className={view === 'highlighted' ? 'active' : ''} type="button" onClick={() => setView('highlighted')}>Highlighted Skills</button>
                        </div>
                    </div>
                    {view === 'comparison' ? (
                        <table className="atsSkillTable">
                            <thead>
                                <tr>
                                    <th>Skill</th>
                                    <th>Resume</th>
                                    <th>Job Description</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {visibleSkills.map((row) => (
                                    <tr key={row.label}>
                                        <td>{row.label}</td>
                                        <td>{row.resumeCount || <span className="atsX">x</span>}</td>
                                        <td>{row.jobCount || <span className="atsX">x</span>}</td>
                                        <td><span className={`atsLegendPill ${row.status}`}>{atsStatusLabel(row.status)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    ) : (
                        <div className="atsHighlightedGrid">
                            <div>
                                <strong>Resume</strong>
                                <pre>{renderAtsHighlighted(resumeText, report.skills)}</pre>
                            </div>
                            <div>
                                <strong>Job Description</strong>
                                <pre>{renderAtsHighlighted(jobText, report.skills)}</pre>
                            </div>
                        </div>
                    )}
                    <div className="atsHighlightLegend compact">
                        <span className="atsLegendPill matching">Matching Skill</span>
                        <span className="atsLegendPill variation">Skill Variation</span>
                        <span className="atsLegendPill missing">Missing Skill</span>
                    </div>
                </section>
                <section className="atsCheckPanel">
                    <div className="atsSectionHead">
                        <div>
                            <h2>Recruiter Tips</h2>
                            <p>Readable next actions before a human makes a hiring decision.</p>
                        </div>
                    </div>
                    <div className="atsCheckRows">
                        {report.recruiterRows.map((row) => (
                            <article key={row.label}>
                                <strong>{row.label}</strong>
                                {row.ok ? <CheckCircle2 className="atsOkIcon" size={18} /> : <AlertTriangle className="atsWarnIcon" size={18} />}
                                <span>{row.text}</span>
                            </article>
                        ))}
                    </div>
                </section>
            </div>
        </section>
    );
}

function renderAtsHighlighted(text, skills) {
    return splitTextByTerms(text, skills).map((chunk, index) => {
        if (!chunk.match) return <span key={index}>{chunk.text}</span>;
        return <mark className={`atsMark ${chunk.match.status}`} key={`${chunk.text}-${index}`}>{chunk.text}</mark>;
    });
}

function atsStatusLabel(status) {
    if (status === 'matching') return 'Matching Skill';
    if (status === 'missing') return 'Missing Skill';
    return 'Skill Variation';
}

function formatNoteDate(value) {
    if (!value) return 'Just now';
    return String(value).slice(0, 16).replace('T', ' ');
}

function scoreOptions() {
    return Array.from({ length: 11 }, (_, index) => (index * 0.5).toFixed(index % 2 ? 1 : 0));
}

function voteSummary(row = {}) {
    const upvotes = Object.values(row.upvotes || {});
    const downvotes = Object.keys(row.downvotes || {}).length;
    const average = upvotes.length ? (upvotes.reduce((sum, vote) => sum + Number(vote.score || 0), 0) / upvotes.length).toFixed(1) : '0.0';
    return {
        average,
        downvotes,
        stars: Object.keys(row.stars || {}).length,
        totalVotes: upvotes.length + downvotes,
    };
}

function voteAttribution(row = {}) {
    return [
        ...Object.entries(row.upvotes || {}).map(([email, vote]) => `${vote.name || email}: upvote ${vote.score}/5`),
        ...Object.entries(row.downvotes || {}).map(([email, vote]) => `${vote.name || email}: downvote`),
        ...Object.entries(row.stars || {}).map(([email, vote]) => `${vote.name || email}: starred`),
    ];
}

const ROLE_PERMISSIONS = {
    Viewer: ['canView'],
    Voter: ['canView', 'canVote'],
    Reviewer: ['canView', 'canVote', 'canAddNote'],
    Screener: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck'],
    Coordinator: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck', 'canSetInterview', 'canHire', 'canClose', 'canInvite', 'canTeamManage', 'canViewActivityLog'],
    Admin: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck', 'canSetInterview', 'canHire', 'canClose', 'canInvite', 'canTeamManage', 'canKickMembers', 'canPromoteMembers', 'canDemoteMembers', 'canChangePermissions', 'canMessage', 'canViewActivityLog'],
    'Head Admin': ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck', 'canSetInterview', 'canHire', 'canClose', 'canInvite', 'canTeamManage', 'canKickMembers', 'canPromoteMembers', 'canDemoteMembers', 'canChangePermissions', 'canMessage', 'canViewActivityLog', 'protectedAccount'],
};

function hasPermission(role, permission) {
    return (ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Viewer).includes(permission);
}

function hasProjectPermission(role, permissions = [], permission) {
    return permissions.length ? permissions.includes(permission) || permissions.includes('protectedAccount') : hasPermission(role, permission);
}

function canSetStatus(role, permissions = [], status) {
    if (status === 'Unreviewed') return hasProjectPermission(role, permissions, 'canMarkOnCheck');
    if (status === 'OnCheck') return hasProjectPermission(role, permissions, 'canMarkOnCheck');
    if (status === 'OnInterview') return hasProjectPermission(role, permissions, 'canSetInterview');
    if (status === 'Hired') return hasProjectPermission(role, permissions, 'canHire');
    if (status === 'Closed') return hasProjectPermission(role, permissions, 'canClose');
    return false;
}

function noteVoteTone(note, voteRow = {}) {
    const author = note.author_email || note.authorEmail || note.author_name || note.authorName || 'Reviewer';
    const upvote = Object.entries(voteRow.upvotes || {}).find(([email, vote]) => email === author || vote.name === author);
    if (upvote) {
        const score = Number(upvote[1].score || 0);
        return {
            tone: score >= 3 ? 'positive' : 'negative',
            label: `voted ${score}/5`,
        };
    }
    const downvote = Object.entries(voteRow.downvotes || {}).find(([email, vote]) => email === author || vote.name === author);
    if (downvote) {
        return { tone: 'negative', label: 'downvoted' };
    }
    return { tone: 'neutral', label: 'no vote attached' };
}

function candidateDecision(candidate) {
    if (candidate.score >= 82 && candidate.unsupported <= 1) {
        return {
            label: 'Interview priority',
            headline: 'Strong evidence-adjusted recommendation with manageable verification pressure.',
            reason: 'Strict claim results and the risk mix support moving to independent evidence review.',
            nextAction: 'Run SignalTrace, collect reviewer input, then schedule an evidence-focused interview.',
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
            headline: 'Mixed recommendation with meaningful uncertainty.',
            reason: 'The candidate may fit parts of the role, but missing CV signals create review cost.',
            nextAction: 'Run WAR_AI and prepare targeted screening questions.',
            tone: 'caution',
        };
    }
    return {
        label: 'High-risk screen-out',
        headline: 'High verification risk despite any keyword overlap.',
        reason: 'Strict analysis found too many unsupported or partial claims for a confident recommendation.',
        nextAction: 'Reject or request stronger evidence before spending interview time.',
        tone: 'bad',
    };
}

function candidateScoreExplanation(candidate) {
    const recommendation = Number(candidate.score || 0);
    const coverage = Number(candidate.fitScore ?? candidate.match ?? 0);
    return `${recommendation}% strict analysis recommendation for ${candidate.role}. `
        + `${coverage}% ATS keyword coverage, ${candidate.supported} supported, `
        + `${candidate.stretched} partial, and ${candidate.unsupported} unsupported signals.`;
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
    return `${candidate.name} is currently marked as ${decision.label.toLowerCase()} for ${project.title}. Strict analysis confirmed ${coverage.percent}% of the role requirements as CV-aligned, with "${strongestClaim}" as the strongest self-reported signal and "${weakestClaim}" as the main review risk. Recommendation: ${decision.nextAction}`;
}

function claimDisplayStatus(status) {
    return {
        SUPPORTED: 'CV aligned',
        STRETCHED: 'Partial mention',
        UNSUPPORTED: 'Missing from CV',
        GAP: 'Not assessed',
    }[String(status || '').toUpperCase()] || status;
}

function stateIdFromName(name = '') {
    const normalized = name.toLowerCase();
    if (normalized.includes('light')) return 'light';
    if (normalized.includes('person')) return 'person';
    if (normalized.includes('war+ai') || normalized.includes('war_ai') || normalized.includes('strict')) return 'strict-war-ai';
    if (normalized.includes('war')) return 'war';
    return 'strict-war-ai';
}

function stateLabel(stateId = '') {
    return analysisStates.find((state) => state.id === stateId)?.name || stateId || 'Analysis';
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
    const history = candidate.memoryHistory || [];
    const hasMismatch = candidate.memory === 'Previous mismatch';
    const hasPrior = history.length > 0;
    const latest = history[0];
    return {
        tone: hasMismatch ? 'bad' : hasPrior ? 'good' : 'neutral',
        state: hasMismatch ? t('priorMismatch') : hasPrior ? t('noContradiction') : candidate.memory,
        priorScore: hasPrior ? `${latest.score}%` : 'N/A',
        repeatedRisk: hasMismatch ? t('priorMismatch') : t('noContradiction'),
        delta: hasPrior ? `${candidate.score - Number(latest.score) >= 0 ? '+' : ''}${candidate.score - Number(latest.score)}` : '+0',
        timeline: history.length ? history.map((item) => ({
            label: item.projectTitle,
            value: `${String(item.submittedAt || '').slice(0, 10)} / ${item.score}% / ${item.risk}`,
        })) : [{ label: t('firstSeen'), value: 'New' }],
    };
}

function buildTechnologyMatrix(report, sourceCards) {
    const github = sourceCards.find((card) => card.kind === 'github' && card.url);
    const portfolio = sourceCards.find((card) => card.kind === 'portfolio' && card.url);
    return (report.skills || [])
        .filter((row) => row.resumeCount > 0 || row.jobCount > 0)
        .slice(0, 16)
        .map((row) => {
            const publicEvidence = Boolean(github || portfolio);
            const aligned = row.resumeCount > 0 && row.jobCount > 0;
            const confidence = aligned && publicEvidence ? 'High' : aligned ? 'Medium' : row.resumeCount > 0 ? 'Claim only' : 'Missing';
            return {
                label: row.label,
                resumeCount: row.resumeCount || 0,
                jobCount: row.jobCount || 0,
                publicEvidence,
                source: github ? 'GitHub' : portfolio ? 'Portfolio' : '',
                confidence,
                tone: confidence === 'High' ? 'good' : confidence === 'Medium' ? 'warn' : 'bad',
            };
        });
}

function buildInterviewQuestions(candidate, t) {
    const weakClaims = candidate.claims.filter(([claim, status]) =>
        ['Unsupported', 'Stretched'].includes(status)
        && candidateCvContainsClaim(candidate, claim)
        && isActionableQuestionClaim(claim));
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

function candidateCvContainsClaim(candidate, claim) {
    const normalizedClaim = normalizeClaim(claim);
    const normalizedCv = normalizeClaim(candidate.cvText || candidate.summary || '');
    return normalizedClaim.length >= 8 && normalizedCv.includes(normalizedClaim);
}

function buildFitRows(project, candidate) {
    return project.requirements.map((requirement) => {
        const claimRow = requirementClaim(candidate, requirement);
        const status = claimRow?.[1] || 'Gap';
        const score = status === 'Supported' ? 98 : status === 'Stretched' ? 55 : status === 'Unsupported' ? 18 : 35;
        return {
            requirement,
            score,
            proof: status === 'Supported' ? 'CV aligned' : status === 'Stretched' ? 'Partial mention' : 'Missing from CV',
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
    const risky = (defaultAts.analyzers?.riskyWords || []).some((word) => normalized.includes(word));
    const concrete = /\b\d+\b/.test(normalized) || (defaultAts.analyzers?.techTerms || []).some((term) => normalized.includes(term));
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

function writeActivity(projectId, user, candidate, action, token = '', details = {}) {
    recordProjectActivityOnServer(projectId, user, {
        ...details,
        type: details.type || 'candidate_workflow',
        action,
        candidateId: candidate?.id,
        candidateName: candidate?.name,
    }, token).catch(() => null);
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

function buildSourceCards(candidate) {
    const links = extractCandidateLinks(candidateSourceText(candidate));
    const github = links.find((url) => /github\.com/i.test(url));
    const linkedin = links.find((url) => /linkedin\.com/i.test(url));
    const certificate = links.find((url) => /(credly|coursera|udemy|certificate|certification|verify|badgr|accredible)/i.test(url));
    const portfolio = links.find((url) => !github && /(portfolio|vercel\.app|netlify\.app|pages\.dev|dev\.to|medium\.com|hashnode|notion\.site|personal|about)/i.test(url))
        || links.find((url) => !/(github|linkedin|credly|coursera|udemy|certificate|certification|verify|badgr|accredible)/i.test(url));
    const publicLink = links.find((url) => url !== github && url !== linkedin && url !== certificate && url !== portfolio);
    return [
        sourceCard('github', 'GitHub', github, github ? 'Repository/profile evidence found in CV.' : 'Ask for code profile or repository links.', CodeXml),
        sourceCard('linkedin', 'LinkedIn', linkedin, linkedin ? 'Professional profile evidence found in CV.' : 'Ask for profile URL to verify title and dates.', BriefcaseBusiness),
        sourceCard('portfolio', 'Portfolio', portfolio, portfolio ? 'Portfolio or personal site found in CV.' : 'No portfolio-style link was detected.', Link),
        sourceCard('certificates', 'Certificates', certificate, certificate ? 'Certificate or issuer verification link found.' : 'No certificate verification link was detected.', Award),
        sourceCard('public', 'Public links', publicLink, links.length ? `${links.length} total public link${links.length === 1 ? '' : 's'} detected.` : 'No public links were detected in the CV text.', ExternalLink),
    ];
}

function sourceCard(kind, title, url, summary, icon) {
    return {
        kind,
        title,
        url: url || '',
        summary,
        icon,
        tone: url ? 'found' : 'missing',
    };
}

function extractCandidateLinks(text) {
    const matches = String(text || '').match(/https?:\/\/[^\s),;]+/gi) || [];
    return [...new Set(matches.map((url) => url.replace(/[.,;:]+$/, '')))].slice(0, 20);
}
