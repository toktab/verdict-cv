import { useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Award, BriefcaseBusiness, CheckCircle2, CodeXml, ExternalLink, FileText, History, Link, MessageSquarePlus, Radar, RefreshCcw, ScanText, ShieldCheck, Sparkles, Star, ThumbsDown, ThumbsUp, Trash2, X, XCircle } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiCreateCandidateNote, apiDeleteCandidate, apiGetCandidateWorkflow, apiListCandidateNotes, apiReanalyzeCandidate, apiUpdateCandidateStatus, apiVoteCandidate } from '../../api';
import defaultAts from '../../data/default-ats.json';
import { findCatchphraseMatches } from '../../utils/catchphraseAnalyzer';
import { buildAtsReport, candidateSourceText as atsCandidateSourceText, projectDescriptionText, splitTextByTerms } from './atsReportUtils';
import { recordProjectActivity, recordProjectActivityOnServer } from './projectActivity';
import { findCandidateFromPath, scorePercent, scoreTone } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

const analysisStates = [
    { id: 'light', name: 'Light State', shortName: 'Light', description: 'Fast first pass with obvious contradiction checks.' },
    { id: 'war', name: 'WAR State', shortName: 'WAR', description: 'Strict template pressure against serious claims.' },
    { id: 'person', name: 'Person_AI State', shortName: 'Person_AI', description: 'Reviewer-style AI judgment for credibility and polish.' },
    { id: 'strict-war-ai', name: 'WAR_AI State', shortName: 'WAR_AI', description: 'Deep AI-assisted verification with OSINT-ready evidence.' },
];

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
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deletePhrase, setDeletePhrase] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);
    const [deleteMessage, setDeleteMessage] = useState('');
    const { project, candidate } = findCandidateFromPath(projects);
    const activeProject = project;
    const activeCandidate = candidate;
    const [voteScore, setVoteScore] = useState('3');
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
        writeActivity(activeProject.id, user, activeCandidate, 'opened candidate profile', userToken);
    }, [activeProject?.id, activeCandidate?.id, activeCandidate, user, userToken]);

    const atsReport = useMemo(() => buildAtsReport(activeProject, activeCandidate), [activeProject, activeCandidate]);

    if (!activeProject || !activeCandidate) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow={activeProject ? 'Candidate' : undefined} title={activeProject ? 'Candidate not found' : undefined} message={activeProject ? 'This candidate is unavailable or was removed from the project.' : undefined} />;

    }

    const verdictRows = buildCandidateVerdicts(activeCandidate);
    const evidenceRows = buildEvidenceRows(activeProject, activeCandidate, t);
    const sourceCards = buildSourceCards(activeCandidate);
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
            setNoteBody('');
            setNoteMessage('Reviewer note saved.');
            writeActivity(activeProject.id, user, activeCandidate, `added reviewer note: ${noteDecision}`, userToken, {
                type: 'candidate_note',
                severity: 'info',
                detail: noteBody.trim(),
            });
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
            writeActivity(activeProject.id, user, activeCandidate, `candidate vote: ${action}${score ? ` ${score}/5` : ''}`, userToken, {
                type: 'candidate_vote',
                severity: action === 'DOWNVOTE' ? 'warn' : 'good',
            });
        } catch (error) {
            setWorkflowMessage(error.message || 'Could not save workflow vote.');
        }
    }

    async function changePipelineStatus(status) {
        if (!canSetStatus(projectRole, projectPermissions, status)) return;
        if (!userToken) {
            setWorkflowMessage('Sign in before changing candidate workflow.');
            return;
        }
        setWorkflowMessage('');
        try {
            const next = await apiUpdateCandidateStatus(activeProject.id, activeCandidate.id, { status }, userToken);
            setWorkflow(next);
            await onProjectsChange?.();
            setWorkflowMessage('Candidate status saved.');
            writeActivity(activeProject.id, user, activeCandidate, `candidate moved to ${status}`, userToken, {
                type: 'candidate_status',
                severity: status === 'Closed' ? 'warn' : status === 'Hired' ? 'good' : 'info',
            });
        } catch (error) {
            setWorkflowMessage(error.message || 'Could not save candidate status.');
        }
    }

    async function deleteCandidate() {
        if (!deleteReady || deleteBusy) return;
        setDeleteBusy(true);
        setDeleteMessage('');
        try {
            await apiDeleteCandidate(activeProject.id, activeCandidate.id, userToken);
            recordProjectActivity(activeProject.id, user, {
                type: 'candidate_delete',
                action: `Deleted candidate ${activeCandidate.name}`,
                candidateId: activeCandidate.id,
                candidateName: activeCandidate.name,
                projectTitle: activeProject.title,
                severity: 'danger',
                detail: `${activeCandidate.name} was removed from ${activeProject.title}.`,
            });
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
                        <button className="secondary" onClick={() => navigateTo(setRoute, 'candidateReport', activeProject.id, activeCandidate.id)} type="button"><FileText size={18} /> Export</button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'candidateProfile', activeProject.id, activeCandidate.id)}><ScanText size={18} /> {t('profilingMode')}</button>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'signalTrace', activeProject.id, activeCandidate.id)}><Radar size={18} /> {t('signalTrace')}</button>
                        <button className="destructive" onClick={() => setDeleteOpen(true)} type="button"><Trash2 size={18} /> Delete</button>
                    </div>
                </section>
                {reanalyzeMessage && <div className="inlineNotice">{reanalyzeMessage}</div>}
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
                                    onClick={() => changePipelineStatus(status)}
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
                                <select value={pipelineStatus} onChange={(event) => changePipelineStatus(event.target.value)}>
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
    recordProjectActivity(projectId, user, {
        ...details,
        type: details.type || 'candidate_workflow',
        action,
        candidateId: candidate?.id,
        candidateName: candidate?.name,
    });
    recordProjectActivityOnServer(projectId, user, {
        ...details,
        type: details.type || 'candidate_workflow',
        action,
        candidateId: candidate?.id,
        candidateName: candidate?.name,
    }, token);
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
