import { useEffect, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ClipboardCheck, FileSearch, Settings, ShieldCheck, UserPlus, Users } from 'lucide-react';
import { apiAcceptProjectInvite, apiCreateProjectInvite, apiListProjectInvites, apiListProjectMembers } from '../../api';
import { useLanguage } from '../../i18n';
import { CandidateTable } from './components/CandidateTable';
import { ProjectScoreStrip } from './components/ProjectScoreStrip';
import { bestCandidate, candidateTotals, findProjectFromPath, workModeInfo } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

export function ProjectDetailPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false }) {
    const { t } = useLanguage();
    const [invites, setInvites] = useState([]);
    const [inviteEmail, setInviteEmail] = useState('');
    const [inviteToken, setInviteToken] = useState('');
    const [members, setMembers] = useState([]);
    const [teamMessage, setTeamMessage] = useState('');
    const [teamBusy, setTeamBusy] = useState(false);
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

    if (!project) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} title="Project not found" message="This project is unavailable, deleted, or not shared with your account." />;

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
    const myMember = members.find((member) => sameIdentity(member.email, user?.email) || sameIdentity(member.email, user?.username));
    const myPermissions = project.myPermissions?.length ? project.myPermissions : permissionsForProjectRole(myMember?.role || project.myRole || (project.ownerId === user?.id ? 'Head Admin' : 'Viewer'));
    const canTeamManage = myPermissions.includes('canTeamManage') || myPermissions.includes('protectedAccount');
    const canInvite = myPermissions.includes('canInvite') || myPermissions.includes('protectedAccount');
    const canSettings = myPermissions.includes('protectedAccount') || project.myRole === 'Head Admin' || project.ownerId === user?.id;
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
                            {requirements.map((requirement) => <span key={requirement}>{requirement}</span>)}
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
        </div>
    );
}

function JobBulletPanel({ title, items, fallback }) {
    return (
        <article className="jobListingPanel">
            <h2><ShieldCheck size={18} /> {title}</h2>
            {items.length > 0 ? (
                <ul className="jobBulletList">
                    {items.map((item) => <li key={item}>{item}</li>)}
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

function sameIdentity(left = '', right = '') {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function permissionsForProjectRole(role = '') {
    const normalized = String(role).toLowerCase();
    if (normalized.includes('head admin')) return ['canView', 'canInvite', 'canTeamManage', 'protectedAccount'];
    if (normalized.includes('admin') || normalized.includes('coordinator')) return ['canView', 'canInvite', 'canTeamManage'];
    return ['canView'];
}
