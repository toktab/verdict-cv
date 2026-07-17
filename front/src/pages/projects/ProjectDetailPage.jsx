import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ClipboardCheck, Download, FileSearch, GitCompareArrows, Megaphone, Pin, Send, Settings, ShieldCheck, Trash2, UserPlus, Users, X } from 'lucide-react';
import { apiAcceptProjectInvite, apiCreateProjectAnnouncement, apiCreateProjectInvite, apiDeleteProjectAnnouncement, apiListProjectAnnouncements, apiListProjectInvites, apiListProjectMembers, apiPinProjectAnnouncement } from '../../api';
import { useLanguage } from '../../i18n';
import { CandidateTable } from './components/CandidateTable';
import { ProjectScoreStrip } from './components/ProjectScoreStrip';
import { bestCandidate, candidateTotals, findProjectFromPath, workModeInfo } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';
import '../../styles/projectAnalytics.css';

export function ProjectDetailPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false }) {
    const { t } = useLanguage();
    const [invites, setInvites] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteToken, setInviteToken] = useState('');
    const [members, setMembers] = useState([]);
    const [teamMessage, setTeamMessage] = useState('');
    const [teamBusy, setTeamBusy] = useState(false);
    const [compareIds, setCompareIds] = useState([]);
    const [announcements, setAnnouncements] = useState([]);
    const [announcementBody, setAnnouncementBody] = useState('');
    const [announcementPinned, setAnnouncementPinned] = useState(false);
    const [announcementBusy, setAnnouncementBusy] = useState(false);
    const [announcementError, setAnnouncementError] = useState('');
    const [deleteAnnouncement, setDeleteAnnouncement] = useState(null);
    const project = findProjectFromPath(projects);
    useEffect(() => {
        if (!project?.id || !userToken) return;
        let cancelled = false;
        apiListProjectInvites(project.id, userToken)
            .then((rows) => {
                if (!cancelled) setInvites(rows || []);
            })
            .catch(() => {
                if (!cancelled) setInvites([]);
            });
        apiListProjectMembers(project.id, userToken)
            .then((rows) => {
                if (!cancelled) setMembers(rows || []);
            })
            .catch(() => {
                if (!cancelled) setMembers([]);
            });
        return () => {
            cancelled = true;
        };
    }, [project?.id, userToken]);

    useEffect(() => {
        if (!project?.id || !userToken) return undefined;
        let cancelled = false;
        const load = () => apiListProjectAnnouncements(project.id, userToken)
            .then((rows) => { if (!cancelled) setAnnouncements(rows || []); })
            .catch((error) => { if (!cancelled) setAnnouncementError(error.message || 'Could not load announcements.'); });
        load();
        window.addEventListener('verdictProjectsChanged', load);
        return () => {
            cancelled = true;
            window.removeEventListener('verdictProjectsChanged', load);
        };
    }, [project?.id, userToken]);

    async function createInvite(event) {
        event.preventDefault();
        if (!project?.id || !inviteEmail.trim()) return;
        setTeamBusy(true);
        setTeamMessage('');
        try {
            const invite = await apiCreateProjectInvite(project.id, { email: inviteEmail.trim(), role: 'REVIEWER' }, userToken);
            setInvites((current) => [invite, ...current.filter((row) => row.id !== invite.id)]);
            setInviteEmail('');
            setTeamMessage(`Invite created. Share this token with ${invite.email}: ${invite.token}`);
        } catch (error) {
            setTeamMessage(error.message || 'Could not create invite.');
        } finally {
            setTeamBusy(false);
        }
    }

    async function acceptInvite(event) {
        event.preventDefault();
        if (!inviteToken.trim()) return;
        setTeamBusy(true);
        setTeamMessage('');
        try {
            const invite = await apiAcceptProjectInvite(inviteToken.trim(), userToken);
            setInvites((current) => [invite, ...current.filter((row) => row.id !== invite.id)]);
            setInviteToken('');
            setTeamMessage('Invite accepted. Refresh projects if the shared role is not visible yet.');
        } catch (error) {
            setTeamMessage(error.message || 'Could not accept invite.');
        } finally {
            setTeamBusy(false);
        }
    }

    async function publishAnnouncement(event) {
        event.preventDefault();
        if (!announcementBody.trim()) return;
        setAnnouncementBusy(true);
        setAnnouncementError('');
        try {
            const row = await apiCreateProjectAnnouncement(project.id, announcementBody.trim(), announcementPinned, userToken);
            setAnnouncements((current) => [row, ...current.filter((item) => item.id !== row.id)].sort(sortAnnouncements));
            setAnnouncementBody('');
            setAnnouncementPinned(false);
        } catch (error) {
            setAnnouncementError(error.message || 'Could not publish announcement.');
        } finally {
            setAnnouncementBusy(false);
        }
    }

    async function toggleAnnouncementPin(row) {
        setAnnouncementBusy(true);
        setAnnouncementError('');
        try {
            const updated = await apiPinProjectAnnouncement(project.id, row.id, !row.pinned, userToken);
            setAnnouncements((current) => current.map((item) => item.id === updated.id ? updated : item).sort(sortAnnouncements));
        } catch (error) {
            setAnnouncementError(error.message || 'Could not update announcement pin.');
        } finally {
            setAnnouncementBusy(false);
        }
    }

    async function confirmDeleteAnnouncement() {
        if (!deleteAnnouncement) return;
        setAnnouncementBusy(true);
        setAnnouncementError('');
        try {
            await apiDeleteProjectAnnouncement(project.id, deleteAnnouncement.id, userToken);
            setAnnouncements((current) => current.filter((item) => item.id !== deleteAnnouncement.id));
            setDeleteAnnouncement(null);
        } catch (error) {
            setAnnouncementError(error.message || 'Could not delete announcement.');
        } finally {
            setAnnouncementBusy(false);
        }
    }

    if (!project) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} />;

    }
    const totals = candidateTotals(project.candidates);
    const workMode = workModeInfo(project, t);
    const requirements = project.requirements?.length ? project.requirements : extractJobBullets(project.description, 'Requirements');
    const responsibilities = extractJobBullets(project.description, 'Responsibilities');
    const preferred = extractJobBullets(project.description, 'Preferred Qualifications');
    const best = bestCandidate(project.candidates);
    const funnel = projectFunnel(project.candidates);
    const risks = projectRiskClusters(project.candidates, t);
    const coverage = projectCoverage(project);
    const scoreBuckets = projectScoreDistribution(project.candidates);
    const workload = projectReviewWorkload(project.candidates);
    const requirementTrends = projectRequirementTrends(project);
    const comparedCandidates = project.candidates.filter((candidate) => compareIds.includes(String(candidate.id)));
    const myMember = members.find((member) => sameIdentity(member.email, user?.email) || sameIdentity(member.email, user?.username));
    const myPermissions = project.myPermissions?.length ? project.myPermissions : permissionsForProjectRole(myMember?.role || project.myRole || (project.ownerId === user?.id ? 'Head Admin' : 'Viewer'));
    const canTeamManage = myPermissions.includes('canTeamManage') || myPermissions.includes('protectedAccount');
    const canInvite = myPermissions.includes('canInvite') || myPermissions.includes('protectedAccount');
    const canSettings = myPermissions.includes('protectedAccount') || project.myRole === 'Head Admin' || project.ownerId === user?.id;
    const canPostAnnouncement = myPermissions.includes('canAddNote') || myPermissions.includes('canMessage') || myPermissions.includes('protectedAccount');
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
                    <div className="detailHeroActions">
                        <button className="secondary compactHeroButton" onClick={() => navigateTo(setRoute, 'projects')}><ArrowRight size={16} /> {t('allProjects')}</button>
                        <button className="secondary compactHeroButton" onClick={() => navigateTo(setRoute, 'projectTeam', project.id)}><Users size={18} /> {canTeamManage ? 'Team' : 'Members'}</button>
                        {canSettings && <button className="secondary iconHeroButton" title="Project settings" aria-label="Project settings" onClick={() => navigateTo(setRoute, 'projectSettings', project.id)}><Settings size={18} /></button>}
                        <button className="primary compactHeroButton" onClick={() => navigateTo(setRoute, 'addCandidate', project.id)}><UserPlus size={18} /> {t('addCandidate')}</button>
                    </div>
                </section>
                <section className="projectAnnouncementPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Project bulletin</span>
                            <h2><Megaphone size={18} /> Announcements</h2>
                        </div>
                        <span>{announcements.filter((row) => row.pinned).length} pinned</span>
                    </div>
                    {announcementError && <div className="error compact">{announcementError}</div>}
                    {canPostAnnouncement && (
                        <form className="projectAnnouncementComposer" onSubmit={publishAnnouncement}>
                            <label>
                                <span>Update the team. Mention members with their username, for example @reviewer.</span>
                                <textarea value={announcementBody} onChange={(event) => setAnnouncementBody(event.target.value)} maxLength={5000} placeholder="Review update, deadline, decision context..." />
                            </label>
                            <div>
                                {canTeamManage && <label className="toggleRow"><input checked={announcementPinned} onChange={(event) => setAnnouncementPinned(event.target.checked)} type="checkbox" /><span>Pin announcement</span></label>}
                                <button className="primary" disabled={announcementBusy || !announcementBody.trim()} type="submit"><Send size={16} /> Publish</button>
                            </div>
                        </form>
                    )}
                    <div className="projectAnnouncementList">
                        {announcements.map((row) => {
                            const own = Number(row.author_id) === Number(user?.id);
                            return (
                                <article className={row.pinned ? 'pinned' : ''} key={row.id}>
                                    <div className="projectAnnouncementIcon">{row.pinned ? <Pin size={17} /> : <Megaphone size={17} />}</div>
                                    <div>
                                        <div className="projectAnnouncementMeta"><strong>{row.author_name}</strong><span>{new Date(row.created_at).toLocaleString()}</span></div>
                                        <p>{highlightMentions(row.body)}</p>
                                        {!!row.mentions?.length && <div className="projectMentionList">{row.mentions.map((mention) => <span key={mention}>{mention}</span>)}</div>}
                                    </div>
                                    {(canTeamManage || own) && (
                                        <div className="projectAnnouncementActions">
                                            {canTeamManage && <button aria-label={row.pinned ? 'Unpin announcement' : 'Pin announcement'} className="secondary" disabled={announcementBusy} onClick={() => toggleAnnouncementPin(row)} title={row.pinned ? 'Unpin' : 'Pin'} type="button"><Pin size={15} /></button>}
                                            <button aria-label="Delete announcement" className="destructive" disabled={announcementBusy} onClick={() => setDeleteAnnouncement(row)} title="Delete" type="button"><Trash2 size={15} /></button>
                                        </div>
                                    )}
                                </article>
                            );
                        })}
                        {!announcements.length && <div className="emptyState">No project announcements yet.</div>}
                    </div>
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
                <section className="projectOutcomeBand">
                    <article className="bestCandidateSpotlight">
                        <span className="eyebrow">Best candidate</span>
                        <div>
                            <strong>{best?.name || 'No candidate yet'}</strong>
                            <b className={best?.score >= 80 ? 'scoreGood' : best?.score >= 55 ? 'scoreWarn' : 'scoreBad'}>{best?.score || 0}%</b>
                        </div>
                        <p>{best ? `${best.name} leads this role with ${best.supported} supported claims, ${best.match}% job match, and ${best.risk.toLowerCase()} risk.` : 'Add candidate CVs to generate a ranked shortlist.'}</p>
                        <button className="secondary" disabled={!best} onClick={() => best && navigateTo(setRoute, 'candidateDetail', project.id, best.id)}>Open leading profile</button>
                    </article>
                    <article className="projectFunnelPanel">
                        <span className="eyebrow">Review funnel</span>
                        <div className="projectFunnelSteps">
                            {funnel.map((item) => (
                                <span key={item.label}>
                                    <strong>{item.value}</strong>
                                    <small>{item.label}</small>
                                </span>
                            ))}
                        </div>
                    </article>
                    <article className="projectCoveragePanel">
                        <span className="eyebrow">Role coverage</span>
                        <strong>{coverage.percent}%</strong>
                        <div className="decisionRail"><span style={{ width: `${coverage.percent}%` }} /></div>
                        <p>{coverage.covered}/{coverage.total} requirements have at least one candidate with strong proof.</p>
                    </article>
                </section>
                <section className="projectRiskPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Risk clusters</span>
                            <h2>What slows this shortlist down</h2>
                        </div>
                    </div>
                    <div className="projectRiskGrid">
                        {risks.map((risk) => (
                            <article className={risk.tone} key={risk.label}>
                                <strong>{risk.value}</strong>
                                <span>{risk.label}</span>
                                <small>{risk.text}</small>
                            </article>
                        ))}
                    </div>
                </section>
                <section className="dashboardGrid">
                    <div className="dashboardPanel">
                        <h2><ShieldCheck size={18} /> {t('roleRequirements')}</h2>
                        <div className="requirementList">
                            {requirements.map((requirement, index) => <span key={`${index}-${requirement}`}>{requirement}</span>)}
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
                <section className="projectAnalyticsGrid" aria-label="Project review analytics">
                    <article className="projectAnalyticsPanel">
                        <div className="projectAnalyticsHead"><div><span className="eyebrow">Score distribution</span><h2>Shortlist quality bands</h2></div><strong>{project.candidates.length}</strong></div>
                        <div className="scoreHistogram">
                            {scoreBuckets.map((bucket) => (
                                <div key={bucket.label}>
                                    <span className="scoreHistogramBar"><i style={{ height: `${bucket.height}%` }} /></span>
                                    <b>{bucket.count}</b>
                                    <small>{bucket.label}</small>
                                </div>
                            ))}
                        </div>
                    </article>
                    <article className="projectAnalyticsPanel">
                        <div className="projectAnalyticsHead"><div><span className="eyebrow">Review workload</span><h2>Evidence pressure queue</h2></div><strong>{workload.totalActions}</strong></div>
                        <div className="workloadRows">
                            {workload.rows.map((row) => <div key={row.label}><span>{row.label}</span><b>{row.value}</b><small>{row.detail}</small></div>)}
                        </div>
                    </article>
                    <article className="projectAnalyticsPanel requirementTrendPanel">
                        <div className="projectAnalyticsHead"><div><span className="eyebrow">Requirement trends</span><h2>Coverage across candidates</h2></div><strong>{requirementTrends.length}</strong></div>
                        <div className="requirementTrendRows">
                            {requirementTrends.map((row, index) => (
                                <div key={`${index}-${row.requirement}`}>
                                    <strong>{row.requirement}</strong>
                                    <span className="requirementTrendRail"><i className="supported" style={{ width: `${row.supportedPercent}%` }} /><i className="partial" style={{ width: `${row.partialPercent}%` }} /></span>
                                    <small>{row.supported} supported / {row.partial} partial / {row.missing} missing</small>
                                </div>
                            ))}
                            {!requirementTrends.length && <div className="emptyState">Add role requirements to calculate cross-candidate trends.</div>}
                        </div>
                    </article>
                </section>
                <section className="candidateComparePanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Candidate comparison</span>
                            <h2><GitCompareArrows size={18} /> Compare 2 to 4 candidates</h2>
                        </div>
                        <button className="secondary" disabled={comparedCandidates.length < 2} type="button" onClick={() => downloadCandidateComparison(project, comparedCandidates)}>
                            <Download size={16} /> Export CSV
                        </button>
                    </div>
                    <div className="candidateComparePicker">
                        {project.candidates.map((candidate) => {
                            const selected = compareIds.includes(String(candidate.id));
                            return (
                                <label className={selected ? 'selected' : ''} key={candidate.id}>
                                    <input
                                        type="checkbox"
                                        checked={selected}
                                        disabled={!selected && compareIds.length >= 4}
                                        onChange={() => setCompareIds((current) => selected
                                            ? current.filter((id) => id !== String(candidate.id))
                                            : [...current, String(candidate.id)])}
                                    />
                                    <span><strong>{candidate.name}</strong><small>{candidate.role}</small></span>
                                </label>
                            );
                        })}
                    </div>
                    {comparedCandidates.length >= 2 ? (
                        <div className="candidateCompareTable" role="table" aria-label="Candidate comparison">
                            <div className="candidateCompareRow heading" role="row">
                                <span>Candidate</span><span>Score</span><span>Match</span><span>Risk</span><span>Supported</span><span>Stretched</span><span>Unsupported</span><span>Decision</span>
                            </div>
                            {comparedCandidates.map((candidate) => (
                                <button className="candidateCompareRow" role="row" type="button" key={candidate.id} onClick={() => navigateTo(setRoute, 'candidateDetail', project.id, candidate.id)}>
                                    <strong>{candidate.name}</strong><span>{candidate.score}%</span><span>{candidate.match}%</span><span>{candidate.risk}</span><span>{candidate.supported}</span><span>{candidate.stretched}</span><span>{candidate.unsupported}</span><span>{comparisonDecision(candidate)}</span>
                                </button>
                            ))}
                        </div>
                    ) : <div className="emptyState">Select at least two candidates to compare evidence, risk, and fit.</div>}
                </section>
                {canInvite && <section className="teamInvitePanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Team</span>
                            <h2><Users size={18} /> Project invites</h2>
                        </div>
                        <span>{invites.length} invite{invites.length === 1 ? '' : 's'}</span>
                    </div>
                    {teamMessage && <div className="inlineNotice">{teamMessage}</div>}
                    <div className="teamInviteGrid">
                        <form className="teamInviteForm" onSubmit={createInvite}>
                            <label>
                                Reviewer email
                                <input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="reviewer@example.com" type="email" />
                            </label>
                            <button className="primary" disabled={teamBusy || !inviteEmail.trim()} type="submit"><UserPlus size={16} /> Create invite</button>
                        </form>
                        <form className="teamInviteForm" onSubmit={acceptInvite}>
                            <label>
                                Invite token
                                <input value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Paste invite token" />
                            </label>
                            <button className="secondary" disabled={teamBusy || !inviteToken.trim()} type="submit"><ClipboardCheck size={16} /> Accept invite</button>
                        </form>
                    </div>
                    <div className="teamInviteList">
                        {invites.map((invite) => (
                            <article key={invite.id}>
                                <div>
                                    <strong>{invite.email}</strong>
                                    <small>{invite.role} / {invite.status}</small>
                                </div>
                                <code>{invite.token}</code>
                            </article>
                        ))}
                        {!invites.length && <p className="mutedPanelText">No project invites have been created yet.</p>}
                    </div>
                </section>}
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
            {deleteAnnouncement && (
                <div className="candidateSendBackdrop" role="dialog" aria-modal="true">
                    <section className="candidateSendModal actionConfirmModal">
                        <div className="modalHead">
                            <div><span className="eyebrow">Confirm deletion</span><h2>Delete announcement</h2></div>
                            <button onClick={() => setDeleteAnnouncement(null)} type="button"><X size={16} /> Close</button>
                        </div>
                        <div className="deleteConfirmBox"><Trash2 size={30} /><p>You are about to remove this project announcement and record the action in project history. Are you sure?</p></div>
                        <div className="editActions">
                            <button className="secondary" onClick={() => setDeleteAnnouncement(null)} type="button">Cancel</button>
                            <button className="destructive" disabled={announcementBusy} onClick={confirmDeleteAnnouncement} type="button"><Trash2 size={15} /> Delete announcement</button>
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function sortAnnouncements(left, right) {
    if (left.pinned !== right.pinned) return left.pinned ? -1 : 1;
    return new Date(right.created_at).getTime() - new Date(left.created_at).getTime();
}

function highlightMentions(body = '') {
    return String(body).split(/(@[A-Za-z0-9._-]{2,40})/g).map((part, index) => part.startsWith('@')
        ? <mark className="projectMention" key={`${part}-${index}`}>{part}</mark>
        : <span key={`text-${index}`}>{part}</span>);
}

function JobBulletPanel({ title, items, fallback }) {
    return (
        <article className="jobListingPanel">
            <h2><ShieldCheck size={18} /> {title}</h2>
            {items.length > 0 ? (
                <ul className="jobBulletList">
                    {items.map((item, index) => <li key={`${index}-${item}`}>{item}</li>)}
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

function projectFunnel(candidates) {
    return [
        { label: 'CVs', value: candidates.length },
        { label: 'Parsed', value: candidates.filter((candidate) => candidate.cvText || candidate.summary).length },
        { label: 'Interview ready', value: candidates.filter((candidate) => candidate.score >= 75).length },
        { label: 'Needs review', value: candidates.filter((candidate) => candidate.state === 'Needs review' || (candidate.score >= 45 && candidate.score < 75)).length },
        { label: 'High risk', value: candidates.filter((candidate) => candidate.risk === 'High').length },
    ];
}

function projectRiskClusters(candidates) {
    const unsupported = candidates.reduce((sum, candidate) => sum + candidate.unsupported, 0);
    const stretched = candidates.reduce((sum, candidate) => sum + candidate.stretched, 0);
    const osintMissing = candidates.filter((candidate) => candidate.osint === 'Not started' || candidate.osint === 'Escalate').length;
    const lowMatch = candidates.filter((candidate) => candidate.match < 55).length;
    return [
        { label: 'Unsupported claims', value: unsupported, text: 'Claims with no clear evidence in uploaded CVs.', tone: unsupported > 0 ? 'bad' : 'good' },
        { label: 'Stretched claims', value: stretched, text: 'Claims that need stronger project, timeline, or source proof.', tone: stretched > 0 ? 'warn' : 'good' },
        { label: 'OSINT gaps', value: osintMissing, text: 'Candidates without completed external public-source evidence.', tone: osintMissing > 0 ? 'warn' : 'good' },
        { label: 'Low job match', value: lowMatch, text: 'Candidates below the role-fit threshold for this project.', tone: lowMatch > 0 ? 'bad' : 'good' },
    ];
}

function projectCoverage(project) {
    const requirements = project.requirements || [];
    const total = Math.max(1, requirements.length);
    const covered = requirements.filter((requirement) => (
        project.candidates || []
    ).some((candidate) => requirementClaim(candidate, requirement)?.[1] === 'Supported')).length;
    return {
        covered,
        total,
        percent: Math.round((covered / total) * 100),
    };
}

function requirementClaim(candidate, requirement) {
    const wanted = normalizeClaim(requirement);
    return (candidate.claims || []).find(([claim]) => normalizeClaim(claim) === wanted);
}

function normalizeClaim(value = '') {
    return String(value).toLowerCase().replace(/[^a-z0-9+#. ]/g, ' ').replace(/\s+/g, ' ').trim();
}

function projectScoreDistribution(candidates = []) {
    const definitions = [
        { label: '0-39', min: 0, max: 39 },
        { label: '40-59', min: 40, max: 59 },
        { label: '60-74', min: 60, max: 74 },
        { label: '75-89', min: 75, max: 89 },
        { label: '90-100', min: 90, max: 100 },
    ];
    const counts = definitions.map((bucket) => candidates.filter((candidate) => candidate.score >= bucket.min && candidate.score <= bucket.max).length);
    const peak = Math.max(1, ...counts);
    return definitions.map((bucket, index) => ({ ...bucket, count: counts[index], height: Math.max(counts[index] ? 12 : 0, Math.round((counts[index] / peak) * 100)) }));
}

function projectReviewWorkload(candidates = []) {
    const unsupported = candidates.reduce((sum, candidate) => sum + Number(candidate.unsupported || 0), 0);
    const stretched = candidates.reduce((sum, candidate) => sum + Number(candidate.stretched || 0), 0);
    const osint = candidates.filter((candidate) => !['Ready', 'Complete'].includes(candidate.osint)).length;
    const manual = candidates.filter((candidate) => candidate.state === 'Needs review' || (candidate.score >= 40 && candidate.score < 75)).length;
    return {
        totalActions: unsupported + stretched + osint + manual,
        rows: [
            { label: 'Unsupported claims', value: unsupported, detail: 'Need direct proof or rejection.' },
            { label: 'Stretched claims', value: stretched, detail: 'Need wording or evidence review.' },
            { label: 'SignalTrace pending', value: osint, detail: 'Need consented public-source checks.' },
            { label: 'Manual decisions', value: manual, detail: 'Need a reviewer pipeline decision.' },
        ],
    };
}

function projectRequirementTrends(project) {
    const candidates = project.candidates || [];
    const total = Math.max(1, candidates.length);
    return (project.requirements || []).map((requirement) => {
        const statuses = candidates.map((candidate) => requirementClaim(candidate, requirement)?.[1] || 'Gap');
        const supported = statuses.filter((status) => status === 'Supported').length;
        const partial = statuses.filter((status) => status === 'Stretched').length;
        const missing = Math.max(0, candidates.length - supported - partial);
        return {
            requirement,
            supported,
            partial,
            missing,
            supportedPercent: Math.round((supported / total) * 100),
            partialPercent: Math.round((partial / total) * 100),
        };
    }).sort((left, right) => right.missing - left.missing || right.partial - left.partial).slice(0, 8);
}

function comparisonDecision(candidate) {
    if (candidate.score >= 80 && candidate.risk === 'Low') return 'Interview priority';
    if (candidate.score >= 60 && candidate.risk !== 'High') return 'Human review';
    return 'Hold';
}

function downloadCandidateComparison(project, candidates) {
    const rows = [
        ['Candidate', 'Role', 'Score', 'Match', 'Risk', 'Supported', 'Stretched', 'Unsupported', 'OSINT', 'Memory', 'Decision'],
        ...candidates.map((candidate) => [candidate.name, candidate.role, candidate.score, candidate.match, candidate.risk, candidate.supported, candidate.stretched, candidate.unsupported, candidate.osint, candidate.memory, comparisonDecision(candidate)]),
    ];
    const csv = rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(project.title || 'project').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-candidate-comparison.csv`;
    link.click();
    URL.revokeObjectURL(url);
}

function csvCell(value) {
    return `"${String(value ?? '').replaceAll('"', '""')}"`;
}

function sameIdentity(left = '', right = '') {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function permissionsForProjectRole(role = '') {
    const normalized = String(role).toLowerCase();
    if (normalized.includes('head admin')) return ['canView', 'canInvite', 'canTeamManage', 'protectedAccount'];
    if (normalized.includes('admin') || normalized.includes('coordinator')) return ['canView', 'canInvite', 'canTeamManage'];
    return ['canView'];
}
