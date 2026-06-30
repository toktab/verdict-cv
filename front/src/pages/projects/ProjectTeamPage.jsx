import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, Crown, Mail, Shield, Trash2, UserCog, UserPlus } from 'lucide-react';
import { apiCreateProjectInvite, apiListProjectInvites } from '../../api';
import { findProjectFromPath } from './projectPageUtils';

const ROLE_ORDER = ['Viewer', 'Voter', 'Reviewer', 'Screener', 'Coordinator', 'Admin'];
const ROLE_PERMISSIONS = {
    Viewer: ['canView'],
    Voter: ['canView', 'canVote'],
    Reviewer: ['canView', 'canVote', 'canAddNote'],
    Screener: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck'],
    Coordinator: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck', 'canSetInterview', 'canHire', 'canClose', 'canViewActivityLog'],
    Admin: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck', 'canSetInterview', 'canHire', 'canClose', 'canManageMembers', 'canMessage', 'canViewActivityLog'],
};

export function ProjectTeamPage({ Header, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [] }) {
    const project = findProjectFromPath(projects) || projects[0];
    const [invites, setInvites] = useState([]);
    const [email, setEmail] = useState('');
    const [roleOverrides, setRoleOverrides] = useState(() => readRoles(project?.id));
    const [message, setMessage] = useState('');
    const members = useMemo(() => buildMembers(project, user, invites, roleOverrides), [project, user, invites, roleOverrides]);
    const myRole = members.find((member) => member.email === user?.email)?.role || 'Admin';

    useEffect(() => {
        if (!project?.id || !userToken) return;
        apiListProjectInvites(project.id, userToken).then(setInvites).catch(() => setInvites([]));
    }, [project?.id, userToken]);

    useEffect(() => {
        setRoleOverrides(readRoles(project?.id));
    }, [project?.id]);

    if (!project) {
        return (
            <div className="shell">
                <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
                <main className="workspace contentFadeIn"><div className="loading"><strong>Loading team...</strong></div></main>
            </div>
        );
    }

    async function invite(event) {
        event.preventDefault();
        const row = await apiCreateProjectInvite(project.id, { email, role: 'REVIEWER' }, userToken);
        setInvites((current) => [row, ...current]);
        setEmail('');
        setMessage(`Invite token created for ${row.email}: ${row.token}`);
    }

    function setRole(emailAddress, role) {
        const next = { ...roleOverrides, [emailAddress]: role };
        setRoleOverrides(next);
        writeRoles(project.id, next);
    }

    function removeMember(emailAddress) {
        const next = { ...roleOverrides, [emailAddress]: 'Kicked' };
        setRoleOverrides(next);
        writeRoles(project.id, next);
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="projectTeamPage contentFadeIn">
                <section className="detailHero">
                    <div>
                        <span className="eyebrow">Team</span>
                        <h1>{project.title}</h1>
                        <p>Manage role templates, project members, and invite access.</p>
                    </div>
                    <button className="secondary" onClick={() => navigateTo(setRoute, 'projectDetail', project.id)}><ArrowRight size={16} /> Back to project</button>
                    <button className="primary" onClick={() => navigateTo(setRoute, 'messages')}><Mail size={16} /> Messages</button>
                </section>
                <section className="dashboardGrid">
                    <article className="dashboardPanel">
                        <h2><Crown size={18} /> Your role</h2>
                        <strong>{myRole}</strong>
                        <p className="mutedPanelText">{roleDescription(myRole)}</p>
                        <div className="permissionChips">
                            {(ROLE_PERMISSIONS[myRole] || []).map((permission) => <span key={permission}>{permission}</span>)}
                        </div>
                    </article>
                    <article className="dashboardPanel">
                        <h2><UserPlus size={18} /> Invite reviewer</h2>
                        {message && <div className="inlineNotice">{message}</div>}
                        <form className="teamInviteForm" onSubmit={invite}>
                            <label>Reviewer email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" required /></label>
                            <button className="primary" type="submit">Create invite</button>
                        </form>
                    </article>
                </section>
                <section className="teamMembersPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Members</span>
                            <h2><Shield size={18} /> Role management</h2>
                        </div>
                    </div>
                    <div className="teamMemberRows">
                        {members.filter((member) => member.role !== 'Kicked').map((member) => (
                            <article key={member.email}>
                                <div>
                                    <strong>{member.name}</strong>
                                    <small>{member.email}</small>
                                </div>
                                <select value={member.role} onChange={(event) => setRole(member.email, event.target.value)}>
                                    {ROLE_ORDER.map((role) => <option key={role}>{role}</option>)}
                                </select>
                                <div className="teamActionRow">
                                    <button className="secondary" type="button" onClick={() => setRole(member.email, promote(member.role))}><UserCog size={15} /> Promote</button>
                                    <button className="secondary" type="button" onClick={() => setRole(member.email, demote(member.role))}>Demote</button>
                                    <button className="destructive" type="button" onClick={() => removeMember(member.email)}><Trash2 size={15} /> Kick</button>
                                </div>
                            </article>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

function buildMembers(project, user, invites, overrides) {
    const rows = [{
        name: user?.fullName || user?.username || 'Project creator',
        email: user?.email || 'owner@verdict.local',
        role: overrides[user?.email] || 'Admin',
    }];
    for (const invite of invites || []) {
        rows.push({
            name: invite.email?.split('@')[0] || 'Reviewer',
            email: invite.email,
            role: overrides[invite.email] || (invite.status === 'ACCEPTED' ? 'Voter' : 'Viewer'),
        });
    }
    return rows;
}

function roleDescription(role) {
    if (role === 'Admin') return 'Can manage members, send messages, vote, and change the full candidate pipeline.';
    if (role === 'Coordinator') return 'Can add notes, vote, move candidates through interview and hire/close decisions, and view activity.';
    if (role === 'Screener') return 'Can add notes, vote, and move candidates into OnCheck.';
    if (role === 'Reviewer') return 'Can add candidate notes and vote.';
    if (role === 'Voter') return 'Can upvote, downvote, star, and score candidates, but cannot add notes.';
    return 'Can view project and candidates only.';
}

function promote(role) {
    return ROLE_ORDER[Math.min(ROLE_ORDER.length - 1, ROLE_ORDER.indexOf(role) + 1)] || 'Reviewer';
}

function demote(role) {
    return ROLE_ORDER[Math.max(0, ROLE_ORDER.indexOf(role) - 1)] || 'Viewer';
}

function readRoles(projectId) {
    if (!projectId) return {};
    try {
        return JSON.parse(localStorage.getItem(`projectRoles:${projectId}`) || '{}');
    } catch {
        return {};
    }
}

function writeRoles(projectId, roles) {
    localStorage.setItem(`projectRoles:${projectId}`, JSON.stringify(roles));
}
