import { useEffect, useRef, useState } from 'react';
import { Activity, Code2, Edit3, Gauge, History, Lock, LogOut, RefreshCcw, RotateCcw, Save, Trash2, UserPlus, X } from 'lucide-react';
import { javaApi } from '../api';
import { clearAdminToken, readAdminToken, writeAdminToken } from '../sessionAuth';

const api = {
    adminLogin: (payload) => javaApi.adminLogin(payload),
    adminAudits: (token, offset, limit, search) => javaApi.adminAudits(token, offset, limit, search),
    adminLogs: (token, offset, limit, search) => javaApi.adminLogs(token, offset, limit, search),
    adminUsers: (token, offset, limit, search) => javaApi.adminUsers(token, offset, limit, search),
    adminSettings: (token) => javaApi.adminSettings(token),
    adminHealth: (token) => javaApi.adminHealth(token),
    adminAtsTemplates: (token) => javaApi.adminAtsTemplates(token),
    publishAdminAtsTemplate: (token, catalogJson, changeNote) => javaApi.publishAdminAtsTemplate(token, catalogJson, changeNote),
    rollbackAdminAtsTemplate: (token, id, changeNote) => javaApi.rollbackAdminAtsTemplate(token, id, changeNote),
    adminTableClearTargets: (token) => javaApi.adminTableClearTargets(token),
    clearAdminTables: (token, targets, confirmation) => javaApi.clearAdminTables(token, targets, confirmation),
    updateAdminSettings: (token, settings) => javaApi.updateAdminSettings(token, settings),
    adminAudit: (token, id) => javaApi.adminAudit(token, id),
    deleteAudit: (token, id) => javaApi.deleteAudit(token, id),
    deleteLog: (token, id) => javaApi.deleteLog(token, id),
    createUser: (token, userForm) => javaApi.createUser(token, userForm),
    updateUser: (token, id, userForm) => javaApi.updateUser(token, id, userForm),
    deleteUser: (token, id) => javaApi.deleteUser(token, id),
    updateVerdict: (token, id, payload) => javaApi.updateVerdict(token, id, payload),
};

function track(action, target = '', detail = '') {
    javaApi.telemetry?.({ action, target, detail, at: new Date().toISOString() });
}

function Input({ label, value, onChange, type = 'text' }) {
    return <label className="field"><span>{label}</span><input type={type} value={value} onChange={(event) => onChange(event.target.value)} /></label>;
}

function SkeletonBlock({ rows = 3, compact = false }) {
    return <div className={compact ? 'skeletonBlock compact' : 'skeletonBlock'}>{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}
function PaginationControls({ offset, count, pageSize, onPrev, onNext }) {
    const page = Math.floor(offset / pageSize) + 1;
    return (
        <div className="paginationControls">
            <span>Page {page}</span>
            <button disabled={offset === 0} onClick={onPrev}>Prev</button>
            <button disabled={count < pageSize} onClick={onNext}>Next</button>
        </div>
    );
}

export function AdminPage({ Header, setRoute }) {
    const pageSize = 20;
    const [token, setToken] = useState(readAdminToken);
    const [login, setLogin] = useState({ username: 'admin', password: '' });
    const [audits, setAudits] = useState([]);
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState({ requireEmailVerification: false });
    const [health, setHealth] = useState(null);
    const [atsVersions, setAtsVersions] = useState([]);
    const [atsDraft, setAtsDraft] = useState('');
    const [atsChangeNote, setAtsChangeNote] = useState('');
    const [atsSaving, setAtsSaving] = useState(false);
    const [tableClearTargets, setTableClearTargets] = useState([]);
    const [selectedClearTargets, setSelectedClearTargets] = useState([]);
    const [clearConfirmText, setClearConfirmText] = useState('');
    const [clearResults, setClearResults] = useState([]);
    const [userSearch, setUserSearch] = useState('');
    const [auditSearch, setAuditSearch] = useState('');
    const [logSearch, setLogSearch] = useState('');
    const [auditOffset, setAuditOffset] = useState(0);
    const [userOffset, setUserOffset] = useState(0);
    const [logOffset, setLogOffset] = useState(0);
    const [selectedAudit, setSelectedAudit] = useState(null);
    const [editingVerdict, setEditingVerdict] = useState(null);
    const [editingUser, setEditingUser] = useState(null);
    const [adminConfirm, setAdminConfirm] = useState(null);
    const [userForm, setUserForm] = useState(emptyUserForm());
    const [adminLoading, setAdminLoading] = useState(() => Boolean(token));
    const [error, setError] = useState('');
    const loadAdminRef = useRef(null);
    const selectedClearTargetRows = tableClearTargets.filter((target) => selectedClearTargets.includes(target.key));
    const selectedClearRowCount = selectedClearTargetRows.reduce((sum, target) => sum + Number(target.deletedRows || 0), 0);
    const clearConfirmationPhrase = selectedClearTargetRows.map((target) => target.key).join(' + ');
    const clearConfirmed = Boolean(clearConfirmationPhrase) && clearConfirmText.trim().toLowerCase() === clearConfirmationPhrase;

    async function signIn() {
        track('admin_login_clicked', 'admin_login', login.username);
        setError('');
        try {
            const result = await api.adminLogin(login);
            writeAdminToken(result.token);
            setToken(result.token);
        } catch (err) {
            setError(err.message);
        }
    }

    async function loadAdmin() {
        track('admin_refresh', 'admin_panel');
        setAdminLoading(true);
        setError('');
        try {
            const [auditRows, logRows, userRows, settingRows, clearTargetRows, healthRows, atsRows] = await Promise.all([
                api.adminAudits(token, auditOffset, pageSize, auditSearch),
                api.adminLogs(token, logOffset, pageSize, logSearch),
                api.adminUsers(token, userOffset, pageSize, userSearch),
                api.adminSettings(token),
                api.adminTableClearTargets(token),
                api.adminHealth(token),
                api.adminAtsTemplates(token),
            ]);
            setAudits(Array.isArray(auditRows) ? auditRows : []);
            setLogs(Array.isArray(logRows) ? logRows : []);
            setUsers(Array.isArray(userRows) ? userRows : []);
            setSettings(settingRows || { requireEmailVerification: false });
            setTableClearTargets(Array.isArray(clearTargetRows) ? clearTargetRows : []);
            setHealth(healthRows);
            const versions = Array.isArray(atsRows) ? atsRows : [];
            setAtsVersions(versions);
            setAtsDraft((current) => current || versions.find((row) => row.active)?.catalogJson || '');
        } catch (err) {
            setError(err.message || 'Could not load the admin workspace.');
            throw err;
        } finally {
            setAdminLoading(false);
        }
    }

    useEffect(() => {
        if (token) {
            loadAdminRef.current?.().catch((err) => setError(err.message));
        }
    }, [token, auditOffset, userOffset, logOffset, auditSearch, userSearch, logSearch]);

    useEffect(() => {
        function expireAdminSession() {
            clearAdminToken();
            setToken('');
            setError('Admin session expired. Authenticate again.');
        }
        window.addEventListener('verdictAdminAuthProblem', expireAdminSession);
        return () => window.removeEventListener('verdictAdminAuthProblem', expireAdminSession);
    }, []);

    loadAdminRef.current = loadAdmin;

    function requestDeleteAudit(id) {
        setAdminConfirm({
            title: `Delete audit #${id}`,
            detail: 'This removes the audit from the admin list. Saved exports and report history for that row will no longer be available.',
            confirmLabel: 'Delete audit',
            onConfirm: () => deleteAudit(id),
        });
    }

    async function deleteAudit(id) {
        track('admin_delete_audit', 'admin_panel', `auditId=${id}`);
        await api.deleteAudit(token, id);
        if (selectedAudit?.id === id) {
            setSelectedAudit(null);
        }
        await loadAdmin();
    }

    function requestDeleteLog(id) {
        setAdminConfirm({
            title: `Delete log #${id}`,
            detail: 'This hides the selected log row from the admin log stream.',
            confirmLabel: 'Delete log',
            onConfirm: () => deleteLog(id),
        });
    }

    async function deleteLog(id) {
        track('admin_delete_log', 'admin_panel', `logId=${id}`);
        await api.deleteLog(token, id);
        await loadAdmin();
    }

    function editUser(user) {
        track('admin_edit_user', 'admin_panel', `userId=${user.id}`);
        setEditingUser(user);
        setUserForm({
            fullName: user.fullName || '',
            username: user.username || '',
            email: user.email || '',
            country: user.country || '',
            address: user.address || '',
            organization: user.organization || '',
            role: user.role || '',
            password: '',
            emailVerified: Boolean(user.emailVerified),
        });
    }

    function newUser() {
        track('admin_new_user', 'admin_panel');
        setEditingUser(null);
        setUserForm(emptyUserForm());
    }

    async function saveUser() {
        track(editingUser ? 'admin_update_user' : 'admin_create_user', 'admin_panel', editingUser ? `userId=${editingUser.id}` : userForm.username);
        if (editingUser) {
            await api.updateUser(token, editingUser.id, userForm);
        } else {
            await api.createUser(token, userForm);
        }
        setEditingUser(null);
        setUserForm(emptyUserForm());
        await loadAdmin();
    }

    function requestDeleteUser(id) {
        const target = users.find((user) => user.id === id);
        setAdminConfirm({
            title: `Delete user #${id}`,
            detail: `This removes ${target?.email || 'this account'} from the platform. Project ownership and audit references may be affected.`,
            confirmLabel: 'Delete user',
            onConfirm: () => deleteUser(id),
        });
    }

    async function deleteUser(id) {
        track('admin_delete_user', 'admin_panel', `userId=${id}`);
        await api.deleteUser(token, id);
        if (editingUser?.id === id) {
            setEditingUser(null);
            setUserForm(emptyUserForm());
        }
        await loadAdmin();
    }

    async function toggleRequireEmailVerification() {
        const next = !settings.requireEmailVerification;
        track('admin_toggle_mail_verification', 'admin_settings', `required=${next}`);
        setSettings(await api.updateAdminSettings(token, { requireEmailVerification: next }));
    }

    async function publishAtsTemplate() {
        setAtsSaving(true);
        setError('');
        try {
            JSON.parse(atsDraft);
            const published = await api.publishAdminAtsTemplate(token, atsDraft, atsChangeNote);
            setAtsDraft(published.catalogJson);
            setAtsChangeNote('');
            await loadAdmin();
        } catch (err) {
            setError(err instanceof SyntaxError ? `Invalid JSON: ${err.message}` : err.message);
        } finally {
            setAtsSaving(false);
        }
    }

    function requestAtsRollback(version) {
        setAdminConfirm({
            title: `Restore ATS version ${version.version}`,
            detail: 'The selected catalog will be validated and published as a new active version. Existing history remains unchanged.',
            confirmLabel: 'Publish rollback',
            onConfirm: () => rollbackAtsTemplate(version),
        });
    }

    async function rollbackAtsTemplate(version) {
        setAtsSaving(true);
        setError('');
        try {
            const published = await api.rollbackAdminAtsTemplate(token, version.id, `Restored version ${version.version} from admin history`);
            setAtsDraft(published.catalogJson);
            await loadAdmin();
        } catch (err) {
            setError(err.message || 'Could not restore this ATS version.');
        } finally {
            setAtsSaving(false);
        }
    }

    function toggleClearTarget(key) {
        setSelectedClearTargets((current) => current.includes(key)
            ? current.filter((item) => item !== key)
            : [...current, key]);
        setClearConfirmText('');
        setClearResults([]);
    }

    async function clearSelectedTables() {
        if (!selectedClearTargets.length) {
            setError('Select at least one table group to clear.');
            return;
        }
        if (!clearConfirmed) {
            setError(`Type "${clearConfirmationPhrase}" before clearing selected tables.`);
            return;
        }
        const labels = selectedClearTargetRows.map((target) => target.label).join(', ');
        setAdminConfirm({
            title: 'Clear selected tables',
            detail: `This will clear ${selectedClearRowCount} row(s) for: ${labels}. The typed phrase was accepted, but this is still destructive.`,
            confirmLabel: 'Clear tables',
            onConfirm: clearSelectedTablesNow,
        });
    }

    async function clearSelectedTablesNow() {
        track('admin_clear_tables', 'admin_panel', selectedClearTargets.join(','));
        setError('');
        const results = await api.clearAdminTables(token, selectedClearTargets, clearConfirmationPhrase);
        setClearResults(results);
        setSelectedClearTargets([]);
        setClearConfirmText('');
        setSelectedAudit(null);
        await loadAdmin();
    }

    async function openAuditEditor(audit) {
        track('admin_open_audit_editor', 'admin_panel', `auditId=${audit.id}`);
        const fullAudit = await api.adminAudit(token, audit.id);
        setSelectedAudit(fullAudit);
        setEditingVerdict(null);
    }

    function startVerdictEdit(verdict) {
        track('admin_start_verdict_edit', 'admin_modal', `verdictId=${verdict.id}`);
        setEditingVerdict({ ...verdict });
    }

    async function saveVerdictEdit() {
        if (!editingVerdict) {
            return;
        }
        track('admin_save_verdict_edit', 'admin_modal', `verdictId=${editingVerdict.id}`);
        await api.updateVerdict(token, editingVerdict.id, {
            status: editingVerdict.status,
            confidence: editingVerdict.confidence,
            reasonCategory: editingVerdict.reasonCategory,
            explanation: editingVerdict.explanation,
            evidencePointer: editingVerdict.evidencePointer,
        });
        const refreshed = await api.adminAudit(token, selectedAudit.id);
        setSelectedAudit(refreshed);
        setEditingVerdict(null);
        await loadAdmin();
    }

    async function deleteVerdictFromAudit(verdictId) {
        track('admin_delete_verdict', 'admin_modal', `verdictId=${verdictId}`);
        await requestDeleteVerdict(token, verdictId);
        const refreshed = await api.adminAudit(token, selectedAudit.id);
        setSelectedAudit(refreshed);
        await loadAdmin();
    }

    if (!token) {
        return (
            <div className="adminLogin">
                <div className="loginBox">
                    <h1>VERDICT ADMIN</h1>
                    <Input label="Username" value={login.username} onChange={(username) => setLogin({ ...login, username })} />
                    <Input type="password" label="Password" value={login.password} onChange={(password) => setLogin({ ...login, password })} />
                    <button className="primary" onClick={signIn}><Lock size={18} /> Authenticate</button>
                    <button className="secondary" onClick={() => setRoute('app')}>Back to site</button>
                    {error && <div className="error">{error}</div>}
                </div>
            </div>
        );
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} />
            <main className="adminGrid contentFadeIn">
                {error && (
                    <div className="retryNotice error compact">
                        <div><strong>Admin data could not be loaded.</strong><span>{error}</span></div>
                        <div className="retryActions"><button className="secondary" disabled={adminLoading} onClick={() => loadAdmin().catch(() => null)} type="button"><RefreshCcw size={15} /> Retry</button></div>
                    </div>
                )}
                <section className="adminSection adminWide adminStatusBar">
                    <div>
                        <span className="eyebrow">Admin session</span>
                        <strong>Maintenance console</strong>
                    </div>
                    <div className="rowActions">
                        <button className="secondary" disabled={adminLoading} onClick={() => loadAdmin().catch((err) => setError(err.message))} type="button">
                            <RefreshCcw size={15} /> {adminLoading ? 'Refreshing...' : 'Refresh admin'}
                        </button>
                        <button className="secondary" onClick={() => {
                            clearAdminToken();
                            setToken('');
                        }} type="button"><LogOut size={15} /> Log out</button>
                    </div>
                </section>
                <section className="adminSection adminWide adminHealthPanel">
                    <h2><Gauge size={18} /> System health</h2>
                    {adminLoading && !health ? <SkeletonBlock rows={3} compact /> : health ? (
                        <div className="adminHealthGrid">
                            <HealthTile label="DB" value={health.db?.ok ? 'Online' : 'Down'} detail={`${health.db?.latencyMillis || 0}ms / ${health.db?.status || 'unknown'}`} good={health.db?.ok} />
                            <HealthTile label="LLM" value={health.llm?.configured ? 'Configured' : 'Fallback'} detail={`${health.llm?.model || 'local'} / ${health.llm?.mode || 'unknown'}`} good={health.llm?.configured} />
                            <HealthTile label="RabbitMQ" value={health.rabbitmq?.auditQueueEnabled ? 'Queue on' : 'Queue off'} detail={`${health.rabbitmq?.host || 'localhost'} / ${health.rabbitmq?.status || 'local-worker'}`} good={health.rabbitmq?.auditQueueEnabled || health.rabbitmq?.eventsEnabled} />
                            <HealthTile label="Audits" value={`${health.audits?.failureRate || 0}% failed`} detail={`${health.audits?.running || 0} running / ${health.audits?.failed || 0} failed / ${health.audits?.total || 0} total`} good={(health.audits?.failureRate || 0) < 5} />
                            <HealthTile label="Build" value={health.buildHash || 'dev'} detail={health.checkedAt ? new Date(health.checkedAt).toLocaleString() : 'not checked'} good />
                        </div>
                    ) : (
                        <div className="emptyState">Health data has not loaded yet.</div>
                    )}
                </section>
                <section className="adminSection adminWide adminAtsGovernance">
                    <div className="adminSectionHeading">
                        <div>
                            <span className="eyebrow">Official rules</span>
                            <h2><Code2 size={18} /> ATS catalog governance</h2>
                            <p className="mutedPanelText">Publish validated, immutable versions of the rule catalog used by backend candidate and local audit analysis.</p>
                        </div>
                        <span className="adminVersionBadge">Active v{atsVersions.find((row) => row.active)?.version || '-'}</span>
                    </div>
                    {adminLoading && !atsDraft ? <SkeletonBlock rows={5} /> : (
                        <div className="adminAtsGrid">
                            <div className="adminAtsEditor">
                                <label className="field">
                                    <span>Catalog JSON</span>
                                    <textarea spellCheck="false" value={atsDraft} onChange={(event) => setAtsDraft(event.target.value)} />
                                </label>
                                <div className="adminAtsPublishRow">
                                    <Input label="Change note" value={atsChangeNote} onChange={setAtsChangeNote} />
                                    <button className="primary" disabled={atsSaving || !atsDraft.trim()} onClick={publishAtsTemplate} type="button">
                                        <Save size={16} /> {atsSaving ? 'Validating...' : 'Publish version'}
                                    </button>
                                </div>
                            </div>
                            <div className="adminAtsHistory">
                                <h3><History size={16} /> Version history</h3>
                                {atsVersions.map((version) => (
                                    <article className={version.active ? 'active' : ''} key={version.id}>
                                        <div>
                                            <strong>Version {version.version}{version.active ? ' / Active' : ''}</strong>
                                            <span>{version.changeNote}</span>
                                            <small>{version.createdBy} / {new Date(version.createdAt).toLocaleString()}</small>
                                        </div>
                                        <div className="rowActions">
                                            <button className="secondary" onClick={() => setAtsDraft(version.catalogJson)} type="button"><Edit3 size={14} /> Load</button>
                                            <button className="secondary" disabled={version.active || atsSaving} onClick={() => requestAtsRollback(version)} type="button"><RotateCcw size={14} /> Restore</button>
                                        </div>
                                    </article>
                                ))}
                            </div>
                        </div>
                    )}
                </section>
                <section className="adminSection adminWide adminDangerZone">
                    <h2><Trash2 size={18} /> Clear tables</h2>
                    <p className="mutedPanelText">Select table groups to empty. This permanently deletes every row in those groups and handles related child tables in the right order.</p>
                    <div className="tableClearGrid">
                        {tableClearTargets.map((target) => (
                            <label key={target.key} className="tableClearOption">
                                <input
                                    type="checkbox"
                                    checked={selectedClearTargets.includes(target.key)}
                                    onChange={() => toggleClearTarget(target.key)}
                                />
                                <span>{target.label}</span>
                                <small>{target.key} / {target.deletedRows || 0} rows</small>
                            </label>
                        ))}
                    </div>
                    <div className="tableClearSummary">
                        <span>{selectedClearTargets.length ? `${selectedClearTargets.length} group${selectedClearTargets.length === 1 ? '' : 's'} selected` : 'No groups selected'}</span>
                        <strong>{selectedClearRowCount} rows affected</strong>
                        <small>{clearConfirmationPhrase ? `Required phrase: ${clearConfirmationPhrase}` : 'Select a group to generate the confirmation phrase.'}</small>
                    </div>
                    <div className="tableClearConfirm">
                        <Input label={clearConfirmationPhrase ? `Type ${clearConfirmationPhrase} to confirm` : 'Select tables before confirming'} value={clearConfirmText} onChange={setClearConfirmText} />
                        <button
                            className="destructive"
                            disabled={!selectedClearTargets.length || !clearConfirmed}
                            onClick={clearSelectedTables}
                        >
                            <Trash2 size={16} /> Clear selected tables
                        </button>
                    </div>
                    {clearResults.length > 0 && (
                        <div className="inlineNotice">
                            Cleared {clearResults.map((result) => `${result.label}: ${result.deletedRows}`).join(' / ')}
                        </div>
                    )}
                </section>
                <section className="adminSection adminWide">
                    <h2><UserPlus size={18} /> Users</h2>
                    <label className="toggleRow">
                        <input type="checkbox" checked={settings.requireEmailVerification} onChange={toggleRequireEmailVerification} />
                        <span>Require mail verification for registration</span>
                        <small>Default is off. When on, new users are created unverified and cannot login until admin verifies them.</small>
                    </label>
                    <div className="userEditor">
                        <Input label="Full name" value={userForm.fullName} onChange={(fullName) => setUserForm({ ...userForm, fullName })} />
                        <Input label="Username" value={userForm.username} onChange={(username) => setUserForm({ ...userForm, username })} />
                        <Input label="Email" value={userForm.email} onChange={(email) => setUserForm({ ...userForm, email })} />
                        <Input label="Country" value={userForm.country} onChange={(country) => setUserForm({ ...userForm, country })} />
                        <Input label="Address" value={userForm.address} onChange={(address) => setUserForm({ ...userForm, address })} />
                        <Input label="Organization" value={userForm.organization} onChange={(organization) => setUserForm({ ...userForm, organization })} />
                        <Input label="Role" value={userForm.role} onChange={(role) => setUserForm({ ...userForm, role })} />
                        <Input type="password" label={editingUser ? 'New password optional' : 'Password'} value={userForm.password} onChange={(password) => setUserForm({ ...userForm, password })} />
                        <label className="toggleRow compact">
                            <input type="checkbox" checked={userForm.emailVerified} onChange={(event) => setUserForm({ ...userForm, emailVerified: event.target.checked })} />
                            <span>Email verified</span>
                        </label>
                        <div className="editActions">
                            <button className="primary" onClick={saveUser}><Save size={16} /> {editingUser ? 'Save user' : 'Add user'}</button>
                            <button className="secondary" onClick={newUser}><X size={16} /> Clear</button>
                        </div>
                    </div>
                    <Input label="Search users" value={userSearch} onChange={(value) => { setUserSearch(value); setUserOffset(0); }} />
                    <PaginationControls offset={userOffset} count={users.length} pageSize={pageSize} onPrev={() => setUserOffset(Math.max(0, userOffset - pageSize))} onNext={() => setUserOffset(userOffset + pageSize)} />
                    <div className="userRows">
                        {adminLoading && <SkeletonBlock rows={4} compact />}
                        {!adminLoading && users.length === 0 && <div className="emptyState">No users match this search.</div>}
                        {users.map((user) => (
                            <div className="adminRow" key={user.id}>
                                <span>#{user.id} {user.fullName} / {user.username} / {user.email} / {user.emailVerified ? 'verified' : 'unverified'}</span>
                                <div className="rowActions">
                                    <button className="secondary" onClick={() => editUser(user)}><Edit3 size={15} /> Edit</button>
                                    <button className="destructive" onClick={() => requestDeleteUser(user.id)}><Trash2 size={15} /> Delete</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
                <section className="adminSection">
                    <h2><Activity size={18} /> Audits</h2>
                    <Input label="Search audits" value={auditSearch} onChange={(value) => { setAuditSearch(value); setAuditOffset(0); }} />
                    <PaginationControls offset={auditOffset} count={audits.length} pageSize={pageSize} onPrev={() => setAuditOffset(Math.max(0, auditOffset - pageSize))} onNext={() => setAuditOffset(auditOffset + pageSize)} />
                    {adminLoading && <SkeletonBlock rows={4} compact />}
                    {!adminLoading && audits.length === 0 && <div className="emptyState">No audits have been created yet.</div>}
                    {audits.map((audit) => (
                        <div className="adminRow" key={audit.id}>
                            <span>#{audit.id} {audit.claimTitle} / {audit.credibilityScore}% / {audit.status || 'COMPLETED'}</span>
                            <div className="rowActions">
                                <button className="secondary" onClick={() => openAuditEditor(audit)}><Edit3 size={15} /> Edit</button>
                                <button className="destructive" onClick={() => requestDeleteAudit(audit.id)}><Trash2 size={15} /> Delete</button>
                            </div>
                        </div>
                    ))}
                </section>
                <section className="adminSection">
                    <h2><Activity size={18} /> Logs</h2>
                    <Input label="Search logs" value={logSearch} onChange={(value) => { setLogSearch(value); setLogOffset(0); }} />
                    <PaginationControls offset={logOffset} count={logs.length} pageSize={pageSize} onPrev={() => setLogOffset(Math.max(0, logOffset - pageSize))} onNext={() => setLogOffset(logOffset + pageSize)} />
                    {adminLoading && <SkeletonBlock rows={4} compact />}
                    {!adminLoading && logs.length === 0 && <div className="emptyState">No logs are available.</div>}
                    {logs.map((log) => (
                        <div className="logRow" key={log.id}>
                            <code>#{log.sequence} {log.eventType} {log.method} {log.path} {log.statusCode}</code>
                            <span>{log.ipAddress} / {new Date(log.createdAt).toLocaleString()}</span>
                            <small>{log.detail}</small>
                            <button className="destructive" onClick={() => requestDeleteLog(log.id)}><Trash2 size={14} /> Delete</button>
                        </div>
                    ))}
                </section>
            </main>
            {selectedAudit && (
                <AuditAdminModal
                    audit={selectedAudit}
                    editingVerdict={editingVerdict}
                    setEditingVerdict={setEditingVerdict}
                    onClose={() => { track('admin_close_audit_editor', 'admin_modal', `auditId=${selectedAudit.id}`); setSelectedAudit(null); }}
                    onEdit={startVerdictEdit}
                    onSave={saveVerdictEdit}
                    onDeleteVerdict={deleteVerdictFromAudit}
                />
            )}
            {adminConfirm && (
                <AdminConfirmModal
                    action={adminConfirm}
                    onClose={() => setAdminConfirm(null)}
                    onConfirm={async () => {
                        const action = adminConfirm;
                        setAdminConfirm(null);
                        await action.onConfirm?.();
                    }}
                />
            )}
        </div>
    );
}

function AdminConfirmModal({ action, onClose, onConfirm }) {
    return (
        <div className="modalOverlay" role="dialog" aria-modal="true">
            <section className="modal actionConfirmModal">
                <div className="modalHead">
                    <div>
                        <span className="eyebrow">Admin confirmation</span>
                        <h2>{action.title}</h2>
                    </div>
                    <button onClick={onClose}><X size={18} /> Close</button>
                </div>
                <div className="deleteConfirmBox">
                    <Trash2 size={30} />
                    <p>{action.detail}</p>
                </div>
                <div className="editActions">
                    <button className="secondary" onClick={onClose}>Cancel</button>
                    <button className="destructive" onClick={onConfirm}>{action.confirmLabel?.toLowerCase().includes('rollback') ? <RotateCcw size={15} /> : <Trash2 size={15} />} {action.confirmLabel || 'Confirm'}</button>
                </div>
            </section>
        </div>
    );
}

function HealthTile({ label, value, detail, good }) {
    return (
        <article className={`healthTile ${good ? 'good' : 'warn'}`}>
            <span>{label}</span>
            <strong>{value}</strong>
            <small>{detail}</small>
        </article>
    );
}

function emptyUserForm() {
    return {
        fullName: '',
        username: '',
        email: '',
        country: '',
        address: '',
        organization: '',
        role: '',
        password: '',
        emailVerified: true,
    };
}

async function requestDeleteVerdict(token, id) {
    const response = await fetch(`/api/admin/verdicts/${id}`, {
        method: 'DELETE',
        headers: { 'X-Admin-Token': token },
    });
    if (!response.ok) {
        throw new Error(`Could not delete verdict ${id}`);
    }
}

function AuditAdminModal({ audit, editingVerdict, setEditingVerdict, onClose, onEdit, onSave, onDeleteVerdict }) {
    return (
        <div className="modalOverlay" role="dialog" aria-modal="true">
            <section className="modal">
                <div className="modalHead">
                    <div>
                        <h2>Audit #{audit.id}</h2>
                        <span>{audit.claimTitle} / score {audit.credibilityScore}%</span>
                    </div>
                    <button onClick={onClose}><X size={18} /> Close</button>
                </div>
                <div className="verdictTable">
                    <div className="tableHead">
                        <span>#</span>
                        <span>Claim</span>
                        <span>Status</span>
                        <span>Confidence</span>
                        <span>Actions</span>
                    </div>
                    {audit.verdicts.map((verdict) => (
                        <div className="tableRow" key={verdict.id}>
                            <span>{verdict.sentenceIndex + 1}</span>
                            <span>{verdict.sentence}</span>
                            <span>{verdict.status}</span>
                            <span>{verdict.confidence}</span>
                            <span className="rowActions">
                <button onClick={() => onEdit(verdict)}><Edit3 size={14} /> Edit</button>
                <button onClick={() => onDeleteVerdict(verdict.id)}><Trash2 size={14} /> Delete</button>
              </span>
                        </div>
                    ))}
                </div>
                {editingVerdict && (
                    <div className="editPane">
                        <h3>Edit verdict #{editingVerdict.id}</h3>
                        <label>
                            Status
                            <select value={editingVerdict.status} onChange={(event) => setEditingVerdict({ ...editingVerdict, status: event.target.value })}>
                                <option>SUPPORTED</option>
                                <option>STRETCHED</option>
                                <option>UNSUPPORTED</option>
                                <option>NOT_A_CLAIM</option>
                                <option>GAP</option>
                            </select>
                        </label>
                        <label>
                            Confidence
                            <select value={editingVerdict.confidence} onChange={(event) => setEditingVerdict({ ...editingVerdict, confidence: event.target.value })}>
                                <option>HIGH</option>
                                <option>MEDIUM</option>
                                <option>LOW</option>
                            </select>
                        </label>
                        <label>
                            Reason category
                            <input value={editingVerdict.reasonCategory} onChange={(event) => setEditingVerdict({ ...editingVerdict, reasonCategory: event.target.value })} />
                        </label>
                        <label>
                            Explanation
                            <textarea value={editingVerdict.explanation} onChange={(event) => setEditingVerdict({ ...editingVerdict, explanation: event.target.value })} />
                        </label>
                        <label>
                            Evidence pointer
                            <textarea value={editingVerdict.evidencePointer} onChange={(event) => setEditingVerdict({ ...editingVerdict, evidencePointer: event.target.value })} />
                        </label>
                        <div className="editActions">
                            <button className="primary" onClick={onSave}><Save size={16} /> Save verdict</button>
                            <button onClick={() => setEditingVerdict(null)}><X size={16} /> Cancel</button>
                        </div>
                    </div>
                )}
            </section>
        </div>
    );
}


