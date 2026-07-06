import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Bell, Database, FileText, Lock, RotateCcw, Save, Settings, ShieldCheck, SlidersHorizontal, Trash2, Users, X } from 'lucide-react';
import { apiDeleteProject } from '../../api';
import { findProjectFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

const defaultSettings = {
    projectVisibility: 'Private workspace',
    inviteApproval: 'Head Admin approval',
    defaultRole: 'Reviewer',
    defaultAuditState: 'WAR_AI State',
    atsTemplate: 'Verified default ATS',
    candidateIntake: 'Manual + resume upload',
    evidenceRequirement: 'Require project/source evidence',
    shortlistThreshold: 80,
    messageNotifications: true,
    exportBranding: true,
    activityLogging: true,
    retentionWindow: 'Keep until deleted',
};

export function ProjectSettingsPage({ Header, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false, onProjectsChange }) {
    const project = findProjectFromPath(projects);
    const canManage = Boolean(project?.myPermissions?.includes('protectedAccount') || project?.myRole === 'Head Admin' || project?.ownerId === user?.id);
    const [settings, setSettings] = useState(() => readProjectSettings(project?.id));
    const [saved, setSaved] = useState('');
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [deleteCountdown, setDeleteCountdown] = useState(3);
    const [deletePhrase, setDeletePhrase] = useState('');
    const [deleteBusy, setDeleteBusy] = useState(false);
    const deleteReady = deleteCountdown <= 0 && deletePhrase === 'I confirm';
    const settingRows = useMemo(() => projectSettingsRows(settings, setSettings, !canManage), [settings, canManage]);

    useEffect(() => {
        setSettings(readProjectSettings(project?.id));
    }, [project?.id]);

    useEffect(() => {
        if (!deleteOpen) return undefined;
        setDeleteCountdown(3);
        setDeletePhrase('');
        const timer = window.setInterval(() => {
            setDeleteCountdown((current) => Math.max(0, current - 1));
        }, 1000);
        return () => window.clearInterval(timer);
    }, [deleteOpen]);

    if (!project) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow="Settings" title="Project settings not found" message="This settings route is unavailable, deleted, or not shared with your account." />;
    }

    function saveSettings() {
        writeProjectSettings(project.id, settings);
        setSaved('Project settings saved for this workspace.');
        window.setTimeout(() => setSaved(''), 1800);
    }

    function resetSettings() {
        setSettings(defaultSettings);
        writeProjectSettings(project.id, defaultSettings);
        setSaved('Settings reset to VERDICT defaults.');
        window.setTimeout(() => setSaved(''), 1800);
    }

    async function deleteProject() {
        if (!deleteReady) return;
        setDeleteBusy(true);
        try {
            await apiDeleteProject(project.id, userToken);
            await onProjectsChange?.();
            navigateTo(setRoute, 'projects');
        } catch (error) {
            setSaved(error.message || 'Could not delete project.');
        } finally {
            setDeleteBusy(false);
        }
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="projectSettingsPage contentFadeIn">
                <section className="detailHero settingsHero">
                    <div>
                        <span className="eyebrow">Project settings</span>
                        <h1>{project.title}</h1>
                        <p>{canManage ? 'Control access, audit behavior, evidence rules, notifications, exports, and deletion safeguards.' : 'Only the creator or Head Admin can change this project.'}</p>
                    </div>
                    <div className="detailHeroActions">
                        <button className="secondary compactHeroButton" type="button" onClick={() => navigateTo(setRoute, 'projectDetail', project.id)}><ArrowRight size={16} /> Back</button>
                        <button className="secondary compactHeroButton" type="button" onClick={() => navigateTo(setRoute, 'projectTeam', project.id)}><Users size={16} /> Team</button>
                    </div>
                </section>

                {saved && <section className={saved.includes('Could not') ? 'error compact' : 'success compact'}>{saved}</section>}

                <section className="settingsGrid">
                    {settingRows.map((row) => (
                        <article className="settingsCard" key={row.key}>
                            <div className="settingsCardIcon">{row.icon}</div>
                            <div>
                                <span className="eyebrow">{row.group}</span>
                                <h2>{row.title}</h2>
                                <p>{row.text}</p>
                                {row.control}
                            </div>
                        </article>
                    ))}
                </section>

                <section className="settingsDangerPanel">
                    <div>
                        <span className="eyebrow">Danger zone</span>
                        <h2><AlertTriangle size={18} /> Delete project</h2>
                        <p>Deletes this project from active lists. Keep this guarded because candidates, team access, and review history belong to this workspace.</p>
                    </div>
                    <button className="destructive" disabled={!canManage} type="button" onClick={() => setDeleteOpen(true)}><Trash2 size={16} /> Delete</button>
                </section>

                <div className="settingsActionBar">
                    <button className="secondary" disabled={!canManage} type="button" onClick={resetSettings}><RotateCcw size={16} /> Reset</button>
                    <button className="primary" disabled={!canManage} type="button" onClick={saveSettings}><Save size={16} /> Save settings</button>
                </div>
            </main>

            {deleteOpen && (
                <div className="candidateSendBackdrop settingsDeleteBackdrop" role="dialog" aria-modal="true">
                    <section className="candidateSendModal settingsDeleteModal">
                        <div className="modalHead">
                            <div>
                                <span className="eyebrow">Confirm deletion</span>
                                <h2>Delete {project.title}</h2>
                            </div>
                            <button type="button" onClick={() => setDeleteOpen(false)}><X size={16} /> Close</button>
                        </div>
                        <div className="deleteConfirmBox">
                            <AlertTriangle size={32} />
                            <p>Wait {deleteCountdown > 0 ? `${deleteCountdown}s` : 'complete'}, then type exactly <strong>I confirm</strong>.</p>
                            <input value={deletePhrase} onChange={(event) => setDeletePhrase(event.target.value)} placeholder="I confirm" />
                        </div>
                        <button className="destructive" disabled={!deleteReady || deleteBusy} type="button" onClick={deleteProject}>
                            <Trash2 size={16} /> {deleteBusy ? 'Deleting...' : 'Delete project'}
                        </button>
                    </section>
                </div>
            )}
        </div>
    );
}

function projectSettingsRows(settings, setSettings, disabled) {
    return [
        selectRow('Access', 'Project visibility', 'Choose who can discover this project workspace.', 'projectVisibility', ['Private workspace', 'Team visible', 'Organization visible'], <Lock size={18} />),
        selectRow('Access', 'Invite approval', 'Decide who can approve new project members.', 'inviteApproval', ['Head Admin approval', 'Admins can approve', 'Invite link only'], <Users size={18} />),
        selectRow('Access', 'Default member role', 'Role applied to new accepted invitations.', 'defaultRole', ['Viewer', 'Voter', 'Reviewer', 'Screener', 'Coordinator'], <ShieldCheck size={18} />),
        selectRow('Audit', 'Default audit state', 'Preferred analysis strictness for new candidates.', 'defaultAuditState', ['Light State', 'WAR State', 'Person_AI State', 'WAR_AI State'], <SlidersHorizontal size={18} />),
        selectRow('Audit', 'ATS template', 'Default rules used for phrase and keyword detection.', 'atsTemplate', ['Verified default ATS', 'Strict seniority ATS', 'Technical proof ATS'], <FileText size={18} />),
        selectRow('Candidates', 'Candidate intake', 'How candidates can be added to this project.', 'candidateIntake', ['Manual + resume upload', 'Manual only', 'Resume upload only'], <Database size={18} />),
        selectRow('Evidence', 'Evidence requirement', 'Minimum proof expected before a candidate is considered strong.', 'evidenceRequirement', ['Require project/source evidence', 'Require profile links', 'Reviewer decides'], <ShieldCheck size={18} />),
        rangeRow('Scoring', 'Shortlist threshold', 'Minimum score for shortlist and leading candidate widgets.', 'shortlistThreshold', settings, setSettings, disabled),
        toggleRow('Messaging', 'Message notifications', 'Notify members when project settings or candidate flow changes.', 'messageNotifications', settings, setSettings, disabled, <Bell size={18} />),
        toggleRow('Exports', 'Export branding', 'Keep VERDICT title, project name, and evidence summary on exports.', 'exportBranding', settings, setSettings, disabled, <FileText size={18} />),
        toggleRow('Logs', 'Activity logging', 'Track role, candidate, and audit activity for admins.', 'activityLogging', settings, setSettings, disabled, <Settings size={18} />),
        selectRow('Data', 'Retention window', 'How long active review data should stay visible.', 'retentionWindow', ['Keep until deleted', 'Archive after closing', 'Review every 90 days'], <Database size={18} />),
    ].map((row) => typeof row === 'function' ? row(settings, setSettings, disabled) : row);
}

function selectRow(group, title, text, key, options, icon) {
    return (settings, setSettings, disabled) => ({
        key,
        group,
        title,
        text,
        icon,
        control: (
            <select disabled={disabled} value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}>
                {options.map((option) => <option key={option}>{option}</option>)}
            </select>
        ),
    });
}

function toggleRow(group, title, text, key, settings, setSettings, disabled, icon) {
    return {
        key,
        group,
        title,
        text,
        icon,
        control: (
            <label className="toggleRow">
                <input disabled={disabled} type="checkbox" checked={Boolean(settings[key])} onChange={(event) => setSettings({ ...settings, [key]: event.target.checked })} />
                <span>{settings[key] ? 'Enabled' : 'Disabled'}</span>
            </label>
        ),
    };
}

function rangeRow(group, title, text, key, settings, setSettings, disabled) {
    return {
        key,
        group,
        title,
        text,
        icon: <SlidersHorizontal size={18} />,
        control: (
            <label className="settingsRange">
                <input disabled={disabled} type="range" min="40" max="95" step="5" value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })} />
                <strong>{settings[key]}%</strong>
            </label>
        ),
    };
}

function settingsKey(projectId) {
    return `verdictProjectSettings:${projectId || 'unknown'}`;
}

function readProjectSettings(projectId) {
    try {
        return { ...defaultSettings, ...JSON.parse(localStorage.getItem(settingsKey(projectId)) || '{}') };
    } catch {
        return defaultSettings;
    }
}

function writeProjectSettings(projectId, settings) {
    localStorage.setItem(settingsKey(projectId), JSON.stringify(settings));
}
