import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, AlertTriangle, ArrowRight, Crown, Lock, Mail, Plus, Search, Shield, Trash2, UserCog, UserPlus, X } from 'lucide-react';
import { apiCreateProjectInvite, apiListProjectInvites, apiListProjectMembers, apiLookupUser, apiSendMessage, apiUpdateProjectMemberRole } from '../../api';
import { appendMessage, createMessage } from '../../messageStore';
import { readProjectActivity, recordProjectActivity } from './projectActivity';
import { findProjectFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

const PERMISSION_ATOMS = ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck', 'canSetInterview', 'canHire', 'canClose', 'canInvite', 'canTeamManage', 'canKickMembers', 'canPromoteMembers', 'canDemoteMembers', 'canChangePermissions', 'canMessage', 'canViewActivityLog'];
const ROLE_ORDER = ['Viewer', 'Voter', 'Reviewer', 'Screener', 'Coordinator', 'Admin', 'Head Admin', 'Custom'];
const ROLE_PERMISSIONS = {
    Viewer: ['canView'],
    Voter: ['canView', 'canVote'],
    Reviewer: ['canView', 'canVote', 'canAddNote'],
    Screener: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck'],
    Coordinator: ['canView', 'canVote', 'canAddNote', 'canMarkOnCheck', 'canSetInterview', 'canHire', 'canClose', 'canInvite', 'canTeamManage', 'canKickMembers', 'canPromoteMembers', 'canDemoteMembers', 'canChangePermissions', 'canViewActivityLog'],
    Admin: [...PERMISSION_ATOMS],
    'Head Admin': [...PERMISSION_ATOMS, 'protectedAccount'],
    Custom: ['canView'],
};

export function ProjectTeamPage({ Header, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false, openCompose, onProjectsChange }) {
    const project = findProjectFromPath(projects);
    const [invites, setInvites] = useState([]);
    const [serverMembers, setServerMembers] = useState(null);
    const [email, setEmail] = useState('');
    const [inviteLookup, setInviteLookup] = useState({ state: 'idle', user: null, query: '' });
    const [roleOverrides, setRoleOverrides] = useState(() => readRoles(project?.id));
    const [customPermissions, setCustomPermissions] = useState(() => readCustomPermissions(project?.id));
    const [message, setMessage] = useState('');
    const [notifyRoleChange, setNotifyRoleChange] = useState(true);
    const [candidateSenderOpen, setCandidateSenderOpen] = useState(false);
    const [candidateSearch, setCandidateSearch] = useState('');
    const [selectedCandidateIds, setSelectedCandidateIds] = useState([]);
    const [activityMember, setActivityMember] = useState(null);
    const [rankModal, setRankModal] = useState(null);
    const [memberModal, setMemberModal] = useState(null);
    const [confirmAction, setConfirmAction] = useState(null);
    const [activityRows, setActivityRows] = useState(() => readProjectActivity(project?.id));
    const members = useMemo(() => buildMembers(project, user, invites, roleOverrides, serverMembers), [project, user, invites, roleOverrides, serverMembers]);
    const updateRankModal = useCallback((patch) => {
        setRankModal((current) => {
            if (!current) return current;
            return { ...current, ...(typeof patch === 'function' ? patch(current) : patch) };
        });
    }, []);
    const myMember = members.find((member) => sameEmail(member.email, user?.email));
    const myRole = project?.myRole || myMember?.role || 'Viewer';
    const myPermissions = project?.myPermissions?.length ? project.myPermissions : permissionsFor(myRole, user?.email, customPermissions, myMember?.permissions);
    const canTeamManage = myPermissions.includes('canTeamManage') || myPermissions.includes('protectedAccount');
    const canInvite = myPermissions.includes('canInvite') || myPermissions.includes('protectedAccount');
    const visibleCandidates = useMemo(() => {
        const needle = candidateSearch.trim().toLowerCase();
        if (!needle) return project?.candidates || [];
        return (project?.candidates || []).filter((candidate) => [candidate.name, candidate.role, candidate.risk, candidate.state]
            .some((value) => String(value || '').toLowerCase().includes(needle)));
    }, [candidateSearch, project?.candidates]);
    const loadTeamData = useCallback(async () => {
        if (!project?.id || !userToken) return;
        const [inviteRows, memberRows] = await Promise.all([
            apiListProjectInvites(project.id, userToken).catch(() => []),
            apiListProjectMembers(project.id, userToken).catch(() => []),
        ]);
        setInvites(inviteRows);
        setServerMembers(memberRows);
    }, [project?.id, userToken]);

    useEffect(() => {
        if (!project?.id || !userToken) return;
        loadTeamData();
        function refreshOnFocus() {
            loadTeamData();
        }
        window.addEventListener('focus', refreshOnFocus);
        const timer = window.setInterval(refreshOnFocus, 12000);
        return () => {
            window.removeEventListener('focus', refreshOnFocus);
            window.clearInterval(timer);
        };
    }, [loadTeamData, project?.id, userToken]);

    useEffect(() => {
        setRoleOverrides(readRoles(project?.id));
        setCustomPermissions(readCustomPermissions(project?.id));
        setActivityRows(readProjectActivity(project?.id));
    }, [project?.id]);

    useEffect(() => {
        const query = email.trim();
        if (!query || !userToken) {
            setInviteLookup({ state: 'idle', user: null, query });
            return undefined;
        }
        const timeout = window.setTimeout(() => {
            setInviteLookup({ state: 'loading', user: null, query });
            apiLookupUser(query, userToken)
                .then((found) => setInviteLookup({ state: 'found', user: found, query }))
                .catch(() => setInviteLookup({ state: query.includes('@') ? 'external' : 'missing', user: null, query }));
        }, 240);
        return () => window.clearTimeout(timeout);
    }, [email, userToken]);

    if (!project) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow="Team" title="Project team not found" message="This team route is unavailable, deleted, or not shared with your account." />;

    }

    async function invite(event) {
        event.preventDefault();
        const row = await apiCreateProjectInvite(project.id, { email, role: 'REVIEWER' }, userToken);
        setInvites((current) => [row, ...current]);
        loadTeamData();
        setEmail('');
        setInviteLookup({ state: 'idle', user: null, query: '' });
        setMessage(`Invite token created for ${row.email}: ${row.token}`);
        recordProjectActivity(project.id, user, {
            type: 'invite',
            action: `Invited ${row.email}`,
            targetEmail: row.email,
            targetName: inviteLookup.user?.fullName || inviteLookup.user?.username || row.email,
            projectTitle: project.title,
            severity: 'good',
            detail: `Invite token created with role ${row.role || 'Reviewer'}.`,
        });
        setActivityRows(readProjectActivity(project.id));
    }

    async function applyRoleChange(emailAddress, role, notify = notifyRoleChange) {
        const member = members.find((row) => row.email === emailAddress);
        if (!member) return;
        const previousRole = member.role;
        if (previousRole === role) return;
        try {
            const memberRows = await apiUpdateProjectMemberRole(project.id, { email: emailAddress, role }, userToken);
            setServerMembers(memberRows);
            setRoleOverrides({});
            writeRoles(project.id, {});
            await loadTeamData();
            await onProjectsChange?.();
        } catch (error) {
            setMessage(error.message || 'Could not update member role.');
            return;
        }
        if (role === 'Custom' && !customPermissions[emailAddress]) {
            const nextCustom = { ...customPermissions, [emailAddress]: ROLE_PERMISSIONS.Viewer };
            setCustomPermissions(nextCustom);
            writeCustomPermissions(project.id, nextCustom);
        }
        if (notify) {
            sendRoleNotice(emailAddress, `Your role changed from ${previousRole} to ${role} on ${project.title}.`);
        }
        if (role === 'Head Admin' && user?.email && !sameEmail(user.email, emailAddress)) {
            if (notify) {
                sendRoleNotice(user.email, `Head Admin was transferred to ${member.name} on ${project.title}. Your role is now Admin.`);
            }
        }
        recordProjectActivity(project.id, user, {
            type: 'rank_change',
            action: `Changed ${member.name}'s rank from ${previousRole} to ${role}`,
            targetEmail: member.email,
            targetName: member.name,
            projectTitle: project.title,
            severity: 'warn',
            detail: notify ? 'Member notification was requested.' : 'Member notification was skipped.',
        });
        setActivityRows(readProjectActivity(project.id));
    }

    function removeMember(emailAddress) {
        const member = members.find((row) => row.email === emailAddress);
        if (!member || isProtectedMember(member)) return;
        const next = { ...roleOverrides, [emailAddress]: 'Kicked' };
        setRoleOverrides(next);
        writeRoles(project.id, next);
        sendRoleNotice(emailAddress, `You were removed from ${project.title}.`);
        recordProjectActivity(project.id, user, {
            type: 'kick',
            action: `Kicked ${member.name} from project`,
            targetEmail: member.email,
            targetName: member.name,
            projectTitle: project.title,
            severity: 'danger',
            detail: `${member.email} was removed from ${project.title}.`,
        });
        setActivityRows(readProjectActivity(project.id));
    }

    function sendRoleNotice(to, body) {
        if (!notifyRoleChange) return;
        apiSendMessage({
            to,
            subject: `Project team update: ${project.title}`,
            body,
        }, userToken).catch(() => appendMessage(createMessage({
            from: user?.email || 'system@verdict.local',
            fromName: user?.fullName || user?.username || 'Team admin',
            to,
            subject: `Project team update: ${project.title}`,
            body,
        }), user));
    }

    function toggleCandidateSelection(candidateId, event) {
        setSelectedCandidateIds((current) => {
            if (event.ctrlKey || event.metaKey) {
                return current.includes(candidateId) ? current.filter((id) => id !== candidateId) : [...current, candidateId];
            }
            return [candidateId];
        });
    }

    function composeCandidatePackage() {
        const selected = (project.candidates || []).filter((candidate) => selectedCandidateIds.includes(candidate.id));
        if (!selected.length) return;
        openCompose?.({
            subject: `Candidate package: ${project.title}`,
            body: `Project: ${project.title}\n\n${selected.map(candidatePackageLine).join('\n\n')}`,
        });
        setCandidateSenderOpen(false);
    }

    function toggleCustomPermission(emailAddress, permission) {
        if (!myPermissions.includes('canChangePermissions')) return;
        const current = customPermissions[emailAddress] || ROLE_PERMISSIONS.Viewer;
        const nextPermissions = current.includes(permission)
            ? current.filter((item) => item !== permission)
            : [...current, permission];
        const next = { ...customPermissions, [emailAddress]: nextPermissions.includes('canView') ? nextPermissions : ['canView', ...nextPermissions] };
        setCustomPermissions(next);
        writeCustomPermissions(project.id, next);
        const member = members.find((row) => sameEmail(row.email, emailAddress));
        recordProjectActivity(project.id, user, {
            type: 'permission_change',
            action: `${nextPermissions.includes(permission) ? 'Enabled' : 'Disabled'} ${permission} for ${member?.name || emailAddress}`,
            targetEmail: emailAddress,
            targetName: member?.name || emailAddress,
            projectTitle: project.title,
            severity: 'warn',
        });
        setActivityRows(readProjectActivity(project.id));
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
                        <p>{canTeamManage ? 'Manage role templates, project members, and invite access.' : 'View project members, roles, and access status.'}</p>
                    </div>
                    <button className="secondary" onClick={() => navigateTo(setRoute, 'projectDetail', project.id)}><ArrowRight size={16} /> Back to project</button>
                    <button className="primary" onClick={() => navigateTo(setRoute, 'messages')}><Mail size={16} /> Messages</button>
                </section>
                {canTeamManage && (
                <section className="dashboardGrid">
                    <article className="dashboardPanel">
                        <div className="rolePanelHead">
                            <h2><Crown size={18} /> Your role</h2>
                            <button
                                className="secondary iconButton"
                                type="button"
                                title="Send team message"
                                onClick={() => openCompose?.({
                                    subject: `Team message: ${project.title}`,
                                    body: `Project: ${project.title}\n\n`,
                                })}
                            >
                                <Mail size={16} />
                            </button>
                        </div>
                        <strong>{myRole}</strong>
                        <p className="mutedPanelText">{roleDescription(myRole)}</p>
                        <div className="permissionChips">
                            {myPermissions.map((permission) => <span key={permission}>{permission}</span>)}
                        </div>
                    </article>
                    <article className="dashboardPanel">
                        <h2><UserPlus size={18} /> Invite reviewer</h2>
                        {message && <div className="inlineNotice">{message}</div>}
                        <form className="teamInviteForm" onSubmit={invite}>
                            <label>Reviewer username or email<input value={email} onChange={(event) => setEmail(event.target.value)} type="text" required /></label>
                            <InviteLookupPreview lookup={inviteLookup} rawValue={email} />
                            <button className="primary" disabled={!canInvite} type="submit">Create invite</button>
                        </form>
                    </article>
                </section>
                )}
                <section className="teamMembersPanel">
                    <div className="tableToolbar">
                        <div>
                            <span className="eyebrow">Members</span>
                            <h2><Shield size={18} /> Role management</h2>
                        </div>
                        {canTeamManage && <label className="notifyRoleToggle">
                            <input type="checkbox" checked={notifyRoleChange} onChange={(event) => setNotifyRoleChange(event.target.checked)} />
                            <span>Send message to them</span>
                        </label>}
                    </div>
                    {canTeamManage && <div className="teamShortcutBar">
                        <button className="secondary" type="button" onClick={() => setCandidateSenderOpen(true)}><Plus size={16} /> Send Candidate(s)</button>
                    </div>}
                    <div className="teamMemberTable">
                        <div className="teamMemberTableHead">
                            <span>Member</span>
                            <span>Email</span>
                            <span>Role</span>
                            <span>Status</span>
                            <span>Source</span>
                            <span>Permissions</span>
                        </div>
                        {members.filter((member) => member.role !== 'Kicked').map((member) => {
                            const protectedMember = isProtectedMember(member);
                            const memberPermissions = permissionsFor(member.role, member.email, customPermissions, member.permissions);
                            return (
                                <button key={member.email} type="button" className={`teamMemberRecord ${protectedMember ? 'protectedMember' : ''}`} onClick={() => setMemberModal(member)}>
                                    <span><strong>{member.name}</strong></span>
                                    <span>{member.email}</span>
                                    <span><b>{member.role}</b></span>
                                    <span><i>{member.status || 'ACTIVE'}</i></span>
                                    <span>{member.source || 'MEMBER'}</span>
                                    <span>{protectedMember ? <em><Lock size={13} /> Protected</em> : `${memberPermissions.length} permissions`}</span>
                                </button>
                            );
                        })}
                    </div>
                </section>
            </main>
            {memberModal && (
                <MemberActionModal
                    member={memberModal}
                    project={project}
                    user={user}
                    canTeamManage={canTeamManage}
                    myPermissions={myPermissions}
                    customPermissions={customPermissions}
                    openCompose={openCompose}
                    notifyRoleChange={notifyRoleChange}
                    onClose={() => setMemberModal(null)}
                    onActivity={(member) => {
                        setActivityRows(readProjectActivity(project.id));
                        setActivityMember(member);
                        setMemberModal(null);
                    }}
                    onRank={(member) => {
                        setRankModal({ member, selectedRole: member.role, confirmText: '', countdown: 10, notify: notifyRoleChange });
                        setMemberModal(null);
                    }}
                    onKick={(member) => {
                        setConfirmAction({
                            title: `Kick ${member.name}`,
                            detail: `You are about to remove ${member.name} (${member.email}) from ${project.title}. This action will be saved in project logs.`,
                            confirmLabel: 'Kick member',
                            danger: true,
                            onConfirm: () => removeMember(member.email),
                        });
                        setMemberModal(null);
                    }}
                    onTogglePermission={toggleCustomPermission}
                />
            )}
            {candidateSenderOpen && (
                <div className="candidateSendBackdrop" role="dialog" aria-modal="true">
                    <section className="candidateSendModal">
                        <div className="modalHead">
                            <div>
                                <span className="eyebrow">Send Candidate(s)</span>
                                <h2>{project.title}</h2>
                            </div>
                            <button type="button" onClick={() => setCandidateSenderOpen(false)}><X size={16} /> Close</button>
                        </div>
                        <label className="candidateSendSearch">
                            <Search size={16} />
                            <input value={candidateSearch} onChange={(event) => setCandidateSearch(event.target.value)} placeholder="Search candidates" />
                        </label>
                        <p className="mutedPanelText">Hint: Ctrl+Select to select multiple candidates.</p>
                        <div className="candidateSendList">
                            {visibleCandidates.map((candidate) => (
                                <button
                                    className={selectedCandidateIds.includes(candidate.id) ? 'active' : ''}
                                    key={candidate.id}
                                    type="button"
                                    onClick={(event) => toggleCandidateSelection(candidate.id, event)}
                                >
                                    <strong>{candidate.name}</strong>
                                    <span>{candidate.role}</span>
                                    <small>Score {candidate.score}% / match {candidate.match}% / risk {candidate.risk}</small>
                                </button>
                            ))}
                            {!visibleCandidates.length && <p className="mutedPanelText">No candidates match that search.</p>}
                        </div>
                        <div className="editActions">
                            <button className="primary" disabled={!selectedCandidateIds.length} type="button" onClick={composeCandidatePackage}><Mail size={16} /> Open compose</button>
                            <button className="secondary" type="button" onClick={() => setSelectedCandidateIds([])}>Clear selection</button>
                        </div>
                    </section>
                </div>
            )}
            {rankModal && (
                <RankModal
                    currentUser={user}
                    member={rankModal.member}
                    selectedRole={rankModal.selectedRole}
                    confirmText={rankModal.confirmText}
                    countdown={rankModal.countdown}
                    notify={rankModal.notify}
                    onChange={updateRankModal}
                    onClose={() => setRankModal(null)}
                    onApply={() => {
                        applyRoleChange(rankModal.member.email, rankModal.selectedRole, rankModal.notify);
                        setRankModal(null);
                    }}
                />
            )}
            {confirmAction && (
                <ConfirmActionModal
                    action={confirmAction}
                    onClose={() => setConfirmAction(null)}
                    onConfirm={() => {
                        confirmAction.onConfirm?.();
                        setConfirmAction(null);
                    }}
                />
            )}
            {activityMember && (
                <div className="candidateSendBackdrop" role="dialog" aria-modal="true">
                    <section className="candidateSendModal">
                        <div className="modalHead">
                            <div>
                                <span className="eyebrow">Activity log</span>
                                <h2>{activityMember.name}</h2>
                            </div>
                            <button type="button" onClick={() => setActivityMember(null)}><X size={16} /> Close</button>
                        </div>
                        <div className="activityLogRows">
                            {activityRows.filter((row) => sameIdentity(row.actorEmail, activityMember.email) || sameIdentity(row.targetEmail, activityMember.email)).map((row) => (
                                <article key={row.id}>
                                    <strong>{row.action}</strong>
                                    <span>{row.candidateName || row.detail || row.projectTitle}</span>
                                    <small>{row.createdAt.slice(0, 16).replace('T', ' ')}</small>
                                </article>
                            ))}
                            {!activityRows.some((row) => sameIdentity(row.actorEmail, activityMember.email) || sameIdentity(row.targetEmail, activityMember.email)) && <p className="mutedPanelText">No project activity has been recorded for this member yet.</p>}
                        </div>
                    </section>
                </div>
            )}
        </div>
    );
}

function MemberActionModal({ member, project, user, canTeamManage, myPermissions, customPermissions, openCompose, notifyRoleChange, onClose, onActivity, onRank, onKick, onTogglePermission }) {
    const protectedMember = isProtectedMember(member);
    const memberPermissions = permissionsFor(member.role, member.email, customPermissions, member.permissions);
    const canMessage = canTeamManage && myPermissions.includes('canMessage');
    const canActivity = canTeamManage && myPermissions.includes('canViewActivityLog');
    const canRank = canTeamManage && myPermissions.includes('canChangePermissions') && !sameEmail(member.email, user?.email);
    const canKick = canTeamManage && myPermissions.includes('canKickMembers') && !protectedMember;

    return (
        <div className="candidateSendBackdrop memberActionBackdrop" role="dialog" aria-modal="true">
            <section className="candidateSendModal memberActionModal">
                <div className="modalHead">
                    <div>
                        <span className="eyebrow">Team member</span>
                        <h2>{member.name}</h2>
                    </div>
                    <button type="button" onClick={onClose}><X size={16} /> Close</button>
                </div>
                <div className="memberProfileGrid">
                    <div className="memberAvatarLarge">{initials(member.name || member.email)}</div>
                    <div>
                        <strong>{member.role}</strong>
                        <span>{member.email}</span>
                        <small>{member.status || 'ACTIVE'} / {member.source || 'MEMBER'}</small>
                    </div>
                    {protectedMember && <span className="protectedBadge"><Lock size={14} /> Protected</span>}
                </div>
                <div className="memberActionGrid">
                    <button className="primary" disabled={!canMessage} type="button" onClick={() => openCompose?.({ to: member.email, subject: `Message about ${project.title}` })}><Mail size={16} /> Message</button>
                    <button className="secondary" disabled={!canActivity} type="button" onClick={() => onActivity(member)}><Activity size={16} /> Activity</button>
                    <button className="secondary" disabled={!canRank} type="button" onClick={() => onRank(member)}><UserCog size={16} /> Rank</button>
                    <button className="destructive" disabled={!canKick} type="button" onClick={() => onKick(member)}><Trash2 size={16} /> Kick</button>
                </div>
                <div className="memberPermissionSummary">
                    <div>
                        <span className="eyebrow">Permissions</span>
                        <strong>{memberPermissions.length} enabled</strong>
                    </div>
                    <label className="notifyRoleToggle">
                        <input type="checkbox" checked={notifyRoleChange} readOnly />
                        <span>Role changes notify members</span>
                    </label>
                </div>
                <div className="permissionChips memberPermissionChips">
                    {memberPermissions.map((permission) => <span key={permission}>{permission}</span>)}
                </div>
                {canTeamManage && member.role === 'Custom' && (
                    <div className="customPermissionGrid modalPermissionGrid">
                        {PERMISSION_ATOMS.map((permission) => (
                            <label key={permission}>
                                <input
                                    checked={memberPermissions.includes(permission)}
                                    disabled={!myPermissions.includes('canChangePermissions') || permission === 'canView'}
                                    type="checkbox"
                                    onChange={() => onTogglePermission(member.email, permission)}
                                />
                                <span>{permission}</span>
                            </label>
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}

function RankModal({ currentUser, member, selectedRole, confirmText, countdown, notify, onChange, onClose, onApply }) {
    const oldRole = member.role;
    const isTransfer = selectedRole === 'Head Admin' && oldRole !== 'Head Admin';
    const phrase = 'I fully acknowledge and Confirm';
    const canApply = selectedRole !== oldRole && (!isTransfer || (countdown <= 0 && confirmText === phrase));

    useEffect(() => {
        if (!isTransfer) return undefined;
        onChange({ countdown: 10, confirmText: '' });
        const timer = window.setInterval(() => {
            onChange((current) => ({ countdown: Math.max(0, (current.countdown || 0) - 1) }));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [isTransfer, member.email, onChange, selectedRole]);

    return (
        <div className="candidateSendBackdrop rankModalBackdrop" role="dialog" aria-modal="true">
            <section className="candidateSendModal rankModal">
                <div className="modalHead">
                    <div>
                        <span className="eyebrow">Rank change</span>
                        <h2>{member.name}</h2>
                    </div>
                    <button type="button" onClick={onClose}><X size={16} /> Close</button>
                </div>
                <div className="rankChangeSummary">
                    <article>
                        <span>Old rank</span>
                        <strong>{oldRole}</strong>
                    </article>
                    <ArrowRight size={20} />
                    <article>
                        <span>New rank</span>
                        <strong>{selectedRole}</strong>
                    </article>
                </div>
                <label className="rankSelectField">
                    Choose rank
                    <select value={selectedRole} onChange={(event) => onChange({ selectedRole: event.target.value, countdown: 10, confirmText: '' })}>
                        {ROLE_ORDER.filter((role) => role !== 'Custom' || oldRole === 'Custom').map((role) => <option key={role}>{role}</option>)}
                    </select>
                </label>
                <p className="mutedPanelText">{roleDescription(selectedRole)}</p>
                {isTransfer && (
                    <div className="headAdminTransferBox">
                        <strong>Head Admin transfer is protected</strong>
                        <span>This will leave only one Head Admin. {currentUser?.email ? `${currentUser.email} will become Admin after transfer.` : 'Your account will become Admin after transfer.'}</span>
                        <b>{countdown > 0 ? `Wait ${countdown}s before confirming` : 'Confirmation unlocked'}</b>
                        <label>
                            Type exactly: {phrase}
                            <input value={confirmText} onChange={(event) => onChange({ confirmText: event.target.value })} placeholder={phrase} />
                        </label>
                    </div>
                )}
                <label className="notifyRoleToggle">
                    <input type="checkbox" checked={notify} onChange={(event) => onChange({ notify: event.target.checked })} />
                    <span>Notify them</span>
                </label>
                <div className="editActions">
                    <button className="secondary" type="button" onClick={onClose}>Cancel</button>
                    <button className="primary" disabled={!canApply} type="button" onClick={() => {
                        if (window.confirm(`Apply rank change from ${oldRole} to ${selectedRole}?`)) {
                            onApply();
                        }
                    }}>Apply rank</button>
                </div>
            </section>
        </div>
    );
}

function ConfirmActionModal({ action, onClose, onConfirm }) {
    return (
        <div className="candidateSendBackdrop" role="dialog" aria-modal="true">
            <section className="candidateSendModal actionConfirmModal">
                <div className="modalHead">
                    <div>
                        <span className="eyebrow">Confirm action</span>
                        <h2>{action.title}</h2>
                    </div>
                    <button type="button" onClick={onClose}><X size={16} /> Close</button>
                </div>
                <div className="deleteConfirmBox">
                    <AlertTriangle size={32} />
                    <p>{action.detail}</p>
                </div>
                <div className="editActions">
                    <button className="secondary" type="button" onClick={onClose}>Cancel</button>
                    <button className={action.danger ? 'destructive' : 'primary'} type="button" onClick={onConfirm}>{action.confirmLabel || 'Confirm'}</button>
                </div>
            </section>
        </div>
    );
}

function initials(value = '') {
    const parts = String(value).replace(/@.*$/, '').split(/\s+|[._-]+/).filter(Boolean);
    return `${parts[0]?.[0] || 'V'}${parts[1]?.[0] || ''}`.toUpperCase();
}

function buildMembers(project, user, invites, overrides, serverMembers = []) {
    const rows = Array.isArray(serverMembers) && serverMembers.length ? serverMembers.map((member) => ({
        name: member.name || member.email?.split('@')[0] || 'Reviewer',
        email: member.email,
        role: overrides[member.email] || normalizeRole(member.role, member.status),
        permissions: member.permissions || [],
        status: member.status || 'ACTIVE',
        source: member.source || 'MEMBER',
        protectedMember: Boolean(member.protected_member || member.protectedMember),
    })) : [{
        name: user?.fullName || user?.username || 'Project creator',
        email: user?.email || 'owner@verdict.local',
        role: 'Head Admin',
        permissions: ROLE_PERMISSIONS['Head Admin'],
        status: 'ACTIVE',
        source: 'OWNER',
        protectedMember: true,
    }];
    const known = new Set(rows.map((row) => row.email?.toLowerCase()).filter(Boolean));
    for (const invite of invites || []) {
        const email = invite.email?.toLowerCase();
        if (known.has(email)) {
            continue;
        }
        rows.push({
            name: invite.email?.split('@')[0] || 'Reviewer',
            email: invite.email,
            role: overrides[invite.email] || normalizeRole(invite.role, invite.status),
            permissions: invite.permissions || [],
            status: invite.status || 'PENDING',
            source: 'INVITE',
            protectedMember: false,
        });
    }
    return rows;
}

function normalizeRole(role, status) {
    if (status && status !== 'ACCEPTED' && status !== 'ACTIVE') return 'Viewer';
    const value = String(role || '').toLowerCase();
    if (value.includes('head admin') || value.includes('organization_admin')) return 'Head Admin';
    if (value.includes('coordinator')) return 'Coordinator';
    if (value.includes('screener')) return 'Screener';
    if (value.includes('reviewer')) return 'Reviewer';
    if (value.includes('voter')) return 'Voter';
    if (value.includes('admin')) return 'Admin';
    if (value.includes('viewer')) return 'Viewer';
    return 'Reviewer';
}

function sameEmail(left = '', right = '') {
    return String(left || '').trim().toLowerCase() === String(right || '').trim().toLowerCase();
}

function roleDescription(role) {
    if (role === 'Head Admin') return 'Protected owner role. Cannot be edited, kicked, demoted, or promoted.';
    if (role === 'Custom') return 'Custom permission set assigned by a Coordinator, Admin, or Head Admin.';
    if (role === 'Admin') return 'Can manage members, send messages, vote, and change the full candidate pipeline.';
    if (role === 'Coordinator') return 'Can invite members, manage team access, add notes, vote, move candidates through interview and hire/close decisions, and view activity.';
    if (role === 'Screener') return 'Can add notes, vote, and move candidates into OnCheck.';
    if (role === 'Reviewer') return 'Can add candidate notes and vote.';
    if (role === 'Voter') return 'Can upvote, downvote, star, and score candidates, but cannot add notes.';
    return 'Can view project and candidates only.';
}

function isProtectedMember(member) {
    return member.protectedMember || member.role === 'Head Admin';
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

function readCustomPermissions(projectId) {
    if (!projectId) return {};
    try {
        return JSON.parse(localStorage.getItem(`projectCustomPermissions:${projectId}`) || '{}');
    } catch {
        return {};
    }
}

function writeCustomPermissions(projectId, permissions) {
    localStorage.setItem(`projectCustomPermissions:${projectId}`, JSON.stringify(permissions));
}

function permissionsFor(role, email, customPermissions, serverPermissions = []) {
    if (serverPermissions.length) return serverPermissions;
    if (role === 'Custom') return customPermissions[email] || ROLE_PERMISSIONS.Custom;
    return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS.Viewer;
}

function candidatePackageLine(candidate) {
    return [
        `${candidate.name} / ${candidate.role}`,
        `Score: ${candidate.score}%`,
        `Match: ${candidate.match}%`,
        `Risk: ${candidate.risk}`,
        `Status: ${candidate.state}`,
        `Summary: ${candidate.summary || 'No summary available.'}`,
    ].join('\n');
}

function InviteLookupPreview({ lookup, rawValue }) {
    const value = (rawValue || '').trim();
    if (!value) return null;
    if (lookup.state === 'loading') {
        return <div className="recipientPreview loading"><span className="recipientAvatar">...</span><div><strong>Looking up invitee</strong><small>{value}</small></div></div>;
    }
    if (lookup.user) {
        return (
            <div className="recipientPreview found">
                <span className="recipientAvatar">{userInitials(lookup.user)}</span>
                <div>
                    <strong>{lookup.user.fullName || lookup.user.username}</strong>
                    <small>{lookup.user.username} / {lookup.user.email}</small>
                </div>
            </div>
        );
    }
    if (lookup.state === 'external') {
        return <div className="recipientPreview external"><span className="recipientAvatar">@</span><div><strong>External email invite</strong><small>{value}</small></div></div>;
    }
    if (lookup.state === 'missing') {
        return <div className="recipientPreview missing"><span className="recipientAvatar">?</span><div><strong>No VERDICT user found</strong><small>Check the username or enter a full email address.</small></div></div>;
    }
    return null;
}

function userInitials(user) {
    const source = user?.fullName || user?.username || user?.email || 'U';
    return source.split(/\s+/).map((part) => part.charAt(0)).join('').slice(0, 2).toUpperCase();
}

function sameIdentity(left = '', right = '') {
    return String(left).trim().toLowerCase() === String(right).trim().toLowerCase();
}
