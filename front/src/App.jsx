import { useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, CheckCircle2, ChevronDown, Download, Edit3, FileSearch, Gauge, History, LayoutDashboard, Lock, LogOut, Mail, Menu, Play, Save, Send, ShieldCheck, Trash2, User, UserPlus, X } from 'lucide-react';
import IntroAnimation from './IntroAnimation';
import { CandidateDetailPage } from './pages/projects/CandidateDetailPage';
import { CandidateProfilePage } from './pages/projects/CandidateProfilePage';
import { HomePage } from './pages/HomePage';
import { MessagesPage } from './pages/MessagesPage';
import { AddCandidatePage } from './pages/projects/AddCandidatePage';
import { NewJobPage } from './pages/projects/NewJobPage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { ProjectTeamPage } from './pages/projects/ProjectTeamPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { SignalTracePage } from './pages/projects/SignalTracePage';
import { LanguageContext, translate, useLanguage } from './i18n';
import { apiLogin, apiRegister, apiMe, apiLogout, apiListMessages, apiListProjects, apiSendMessage, javaApi, normaliseProject, normaliseUser } from './api';
import { appendMessage, createMessage, messageBelongsTo, readMessages } from './messageStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { AuditScoreExplainer } from './components/AuditScoreExplainer';
import { auditScoreLevel } from './utils/auditScore';
import './styles.css';

const auditModes = {
    cv: {
        name: 'Job / CV audit',
        claimTitle: 'Candidate CV',
        claimSubtitle: 'Paste the CV, application answers, portfolio summary, or interview notes submitted by the candidate.',
        evidenceTitle: 'Job application evidence',
        evidenceSubtitle: 'Paste the job requirements, consented profile links, portfolio notes, references, GitHub or LinkedIn evidence, and organizer comments.',
        actionCopy: 'Audit candidate',
    },
};

const demoCase = {
    id: 'cv-demo',
    name: 'Job candidate demo',
    auditMode: 'cv',
    claimTitle: 'Backend developer applicant',
    evidenceTitle: 'Role requirements and public evidence',
    claimText: 'Senior backend developer with deep Java experience. Led a team of six engineers. Built production authentication systems and advanced REST APIs. Strong GitHub portfolio with several real projects.',
    evidenceText: 'The job requires backend Java, SQL, authentication, API design, and clear project evidence. Candidate portfolio contains two Java API projects and one authentication demo. LinkedIn lists junior backend developer, not senior lead. GitHub is public but has limited recent activity.',
};

const demoCases = [
    demoCase,
];

const demoTemplates = [
    { id: 'template-cv', mode: 'cv', name: 'Verified CV hiring template', description: 'Checks candidate claims against role needs, profile evidence, and consented public signals.', instructions: 'Flag inflated seniority, unsupported leadership, vague deep-experience claims, missing project proof, weak GitHub evidence, and contradictions between CV, LinkedIn, and portfolio links.', shared: true },
];

const demoStates = [
    { id: 'state-light', name: 'Light State', description: 'Fast template review for obvious CV contradictions and low-effort exaggeration.' },
    { id: 'state-war', name: 'WAR State', description: 'Strict template review that expects every serious skill or leadership claim to be backed inside the application.' },
    { id: 'state-person', name: 'Person State', description: 'AI-assisted reviewer judgment for polish, tone, credibility, and whether the CV feels genuinely substantiated.' },
    { id: 'state-war-ai', name: 'WAR+AI State', description: 'Highest scrutiny with AI, deterministic rules, optional OSINT escalation, and full claim-by-claim report scoring.' },
];

const api = {
    telemetry: async (payload) => fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }).catch(() => null),
    me: async (token) => {
        try { return normaliseUser(await apiMe(token)); } catch { return null; }
    },
    login: async ({ identifier, password }) => {
        const res = await apiLogin({ identifier, password });
        return { token: res.token, user: normaliseUser(res.user) };
    },
    register: async (form) => {
        const res = await apiRegister({
            username: form.username,
            email: form.email,
            password: form.password,
            fullName: form.fullName || `${form.firstName || ''} ${form.lastName || ''}`.trim(),
            organization: form.organization || '',
        });
        return { token: res.token, user: normaliseUser(res.user) };
    },
    logout: async (token) => { try { await apiLogout(token); } catch { /* ignore */ } },
    history: async (token) => javaApi.history(token),
    templates: async (token) => javaApi.templates(token).catch(() => demoTemplates),
    states: async (token) => javaApi.states(token).catch(() => demoStates),
    createTemplate: async (token, template) => javaApi.createTemplate(token, template),
    runAudit: async (payload, token) => javaApi.runAudit(payload, token),
    getAudit: async (id, token) => javaApi.getAudit(id, token),
    adminLogin: async (payload) => javaApi.adminLogin(payload),
    adminAudits: async (token, offset, limit, search) => javaApi.adminAudits(token, offset, limit, search),
    adminLogs: async (token, offset, limit, search) => javaApi.adminLogs(token, offset, limit, search),
    adminUsers: async (token, offset, limit, search) => javaApi.adminUsers(token, offset, limit, search),
    adminSettings: async (token) => javaApi.adminSettings(token),
    adminTableClearTargets: async (token) => javaApi.adminTableClearTargets(token),
    clearAdminTables: async (token, targets) => javaApi.clearAdminTables(token, targets),
    updateAdminSettings: async (token, settings) => javaApi.updateAdminSettings(token, settings),
    adminAudit: async (token, id) => javaApi.adminAudit(token, id),
    deleteAudit: async (token, id) => javaApi.deleteAudit(token, id),
    deleteLog: async (token, id) => javaApi.deleteLog(token, id),
    createUser: async (token, userForm) => javaApi.createUser(token, userForm),
    updateUser: async (token, id, userForm) => javaApi.updateUser(token, id, userForm),
    deleteUser: async (token, id) => javaApi.deleteUser(token, id),
    updateVerdict: async (token, id, payload) => javaApi.updateVerdict(token, id, payload),
};

function useRouteState(getInitialRoute) {
    const initial = getInitialRoute();
    const [route, setRoute] = useState(initial.route);
    const [detailAuditId, setDetailAuditId] = useState(initial.auditId || null);
    return { route, setRoute, detailAuditId, setDetailAuditId };
}

function Input({ label, value, onChange, type = 'text' }) {
    return (
        <label className="field">
            <span>{label}</span>
            <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} />
        </label>
    );
}

function Textarea({ value, onChange }) {
    return <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} />;
}

function Panel({ title, subtitle, children }) {
    return (
        <section className="panel">
            <div className="panelHead">
                <div>
                    <h2>{title}</h2>
                    <p>{subtitle}</p>
                </div>
            </div>
            {children}
        </section>
    );
}

function Metric({ label, value }) {
    return (
        <div className="metric">
            <span>{label}</span>
            <strong>{value}</strong>
        </div>
    );
}

function Loading({ stage }) {
    return (
        <div className="loading">
            <Activity size={18} />
            <strong>{stage || 'Loading'}</strong>
        </div>
    );
}

function SkeletonBlock({ rows = 3, compact = false }) {
    return (
        <div className={`skeletonBlock ${compact ? 'compact' : ''}`}>
            {Array.from({ length: rows }, (_, index) => <span key={index} />)}
        </div>
    );
}

function AuditTemplatePanel({ mode, templates, selectedId, onSelect, templateForm, setTemplateForm, onSave }) {
    return (
        <section className="templatePanel">
            <div className="templateHeader">
                <div>
                    <span className="eyebrow">Templates</span>
                    <h2>Audit instructions</h2>
                </div>
                <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
                    <option value="">No template</option>
                    {templates.filter((template) => template.mode === mode).map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                </select>
            </div>
            <div className="templateBuilder">
                <Input label="Name" value={templateForm.name} onChange={(name) => setTemplateForm({ ...templateForm, name })} />
                <Input label="Description" value={templateForm.description} onChange={(description) => setTemplateForm({ ...templateForm, description })} />
                <label className="field">
                    <span>Instructions</span>
                    <textarea value={templateForm.instructions} onChange={(event) => setTemplateForm({ ...templateForm, instructions: event.target.value })} />
                </label>
                <button className="secondary" onClick={onSave}><Save size={16} /> Save template</button>
            </div>
        </section>
    );
}

function CheckStatePanel({ states, selectedId, onSelect }) {
    return (
        <section className="statePanel">
            <div className="templateHeader">
                <div>
                    <span className="eyebrow">Check state</span>
                    <h2>Review posture</h2>
                </div>
            </div>
            <div className="stateCards">
                {states.map((state) => (
                    <button key={state.id} className={selectedId === state.id ? 'active' : ''} onClick={() => onSelect(state.id)}>
                        <strong>{state.name}</strong>
                        <span>{state.description}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

function DenseVerdictTable({ verdicts = [] }) {
    return (
        <div className="denseVerdictPanel">
            <div className="denseVerdictHead">
                <span>#</span><span>Status</span><span>Confidence</span><span>Claim</span><span>Evidence</span>
            </div>
            {verdicts.map((verdict, index) => (
                <div className="denseVerdictRow" key={verdict.id || index}>
                    <span>{index + 1}</span>
                    <strong>{verdict.status}</strong>
                    <span>{verdict.confidence}</span>
                    <span>{verdict.sentence}</span>
                    <small>{verdict.evidencePointer}</small>
                </div>
            ))}
        </div>
    );
}

function ProfilePage({ Header, setRoute, user, userToken, setUser, setUserToken }) {
    const { t } = useLanguage();
    return (
        <div className="shell">
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="profilePage">
                <section className="profileHero">
                    <div>
                        <span className="eyebrow">{t('profile')}</span>
                        <h1>{user?.fullName || user?.username || t('demoUser')}</h1>
                        <p>{user?.email || t('createAccountToSave')}</p>
                    </div>
                    <Metric label={t('role')} value={user?.role || 'User'} />
                </section>
            </main>
        </div>
    );
}

function track(action, target = '', detail = '') {
    api.telemetry({ action, target, detail });
}

function App() {
    const { route, setRoute, detailAuditId, setDetailAuditId } = useRouteState(routeFromPath);
    const [userToken, setUserToken] = useState(localStorage.getItem('verdictUserToken') || '');
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(demoCase);
    const [audit, setAudit] = useState(null);
    const [detailAudit, setDetailAudit] = useState(null);
    const [history, setHistory] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [states, setStates] = useState([]);
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(false);
    const [templateForm, setTemplateForm] = useState(emptyTemplateForm(demoCase.auditMode));
    const [selectedDemoId, setSelectedDemoId] = useState(demoCases[0]?.id || '');
    const [demoConfirmOpen, setDemoConfirmOpen] = useState(false);
    const [demoCountdown, setDemoCountdown] = useState(3);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [historyLoading, setHistoryLoading] = useState(false);
    const [templateLoading, setTemplateLoading] = useState(false);
    const [uploadingField, setUploadingField] = useState('');
    const [stage, setStage] = useState('');
    const [error, setError] = useState('');
    const [introVisible, setIntroVisible] = useState(true);
    const [lang, setLangState] = useState(() => localStorage.getItem('verdictLang') || 'ge');
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeDraft, setComposeDraft] = useState({ to: '', subject: '', body: '', replyToMessageId: null, forwardedFromMessageId: null });
    const [unreadMessages, setUnreadMessages] = useState(0);

    function setLang(nextLang) {
        localStorage.setItem('verdictLang', nextLang);
        setLangState(nextLang);
    }

    function t(key, replacements) {
        return translate(lang, key, replacements);
    }

    function openCompose(prefill = {}) {
        setComposeDraft((current) => ({
            ...current,
            ...prefill,
        }));
        setComposeOpen(true);
    }

    useEffect(() => {
        document.documentElement.lang = lang === 'ge' ? 'ka' : lang;
    }, [lang]);

    useEffect(() => {
        scrollToPageTop();
    }, [route, detailAuditId]);

    useEffect(() => {
        track('page_view', route, window.location.pathname);
        loadHistory();
        loadTemplates();
        loadStates();
        loadProjects();
        if (userToken) {
            api.me(userToken).then(setUser).catch(() => {
                localStorage.removeItem('verdictUserToken');
                setUserToken('');
                setUser(null);
            });
        }
    }, []);

    useEffect(() => {
        if ((route === 'auditDetail' || route === 'auditProfile') && detailAuditId && userToken) {
            loadAuditDetail(detailAuditId);
        }
    }, [route, detailAuditId, userToken]);

    useEffect(() => {
        loadHistory();
        loadTemplates();
        loadStates();
        loadProjects();
    }, [userToken]);

    useEffect(() => {
        let cancelled = false;
        async function refreshUnreadMessages() {
            if (!user) {
                setUnreadMessages(0);
                return;
            }
            try {
                const rows = userToken ? await apiListMessages(userToken) : readMessages(user);
                if (!cancelled) {
                    setUnreadMessages(rows.filter((message) => !message.read && messageBelongsTo(message, user, 'to')).length);
                }
            } catch {
                if (!cancelled) {
                    setUnreadMessages(readMessages(user).filter((message) => !message.read && messageBelongsTo(message, user, 'to')).length);
                }
            }
        }
        refreshUnreadMessages();
        window.addEventListener('verdictMessagesChanged', refreshUnreadMessages);
        return () => {
            cancelled = true;
            window.removeEventListener('verdictMessagesChanged', refreshUnreadMessages);
        };
    }, [user, userToken]);

    useEffect(() => {
        if (!demoConfirmOpen) {
            return undefined;
        }
        setDemoCountdown(3);
        const started = Date.now();
        const timer = setInterval(() => {
            setDemoCountdown(Math.max(0, 3 - Math.floor((Date.now() - started) / 1000)));
        }, 250);
        return () => clearInterval(timer);
    }, [demoConfirmOpen]);

    async function loadHistory() {
        if (!userToken) {
            setHistory([]);
            return;
        }
        setHistoryLoading(true);
        try {
            setHistory(await api.history(userToken));
        } catch {
            setHistory([]);
        } finally {
            setHistoryLoading(false);
        }
    }

    async function loadTemplates() {
        if (!userToken) {
            setTemplates([]);
            return;
        }
        setTemplateLoading(true);
        try {
            const rows = await api.templates(userToken);
            setTemplates(rows);
            setForm((current) => current.templateId ? current : { ...current, templateId: rows.find((template) => template.mode === (current.auditMode || 'cv'))?.id || rows[0]?.id || '' });
        } catch {
            setTemplates([]);
        } finally {
            setTemplateLoading(false);
        }
    }

    async function loadStates() {
        if (!userToken) {
            setStates([]);
            return;
        }
        try {
            const rows = await api.states(userToken);
            setStates(rows);
            setForm((current) => current.checkStateId ? current : { ...current, checkStateId: rows[0]?.id || '' });
        } catch {
            setStates([]);
        }
    }

    async function loadProjects() {
        if (!userToken) {
            setProjects([]);
            setProjectsLoading(false);
            return;
        }
        setProjectsLoading(true);
        try {
            const rows = await apiListProjects(userToken);
            setProjects(rows.map(normaliseProject));
        } catch {
            setProjects([]);
        } finally {
            setProjectsLoading(false);
        }
    }

    async function saveTemplate() {
        setError('');
        if (!userToken) {
            setError('Sign in before saving templates.');
            return;
        }
        try {
            const saved = await api.createTemplate(userToken, { ...templateForm, mode: form.auditMode || 'cv' });
            const rows = await api.templates(userToken);
            setTemplates(rows);
            setForm((current) => ({ ...current, templateId: saved.id }));
            setTemplateForm(emptyTemplateForm(form.auditMode || 'cv'));
        } catch (err) {
            setError(err.message);
        }
    }

    function confirmLoadDemo() {
        const selectedDemo = demoCases.find((item) => item.id === selectedDemoId) || demoCase;
        setForm({
            ...selectedDemo,
            templateId: templates.find((template) => template.mode === selectedDemo.auditMode)?.id || '',
            checkStateId: states[0]?.id || '',
        });
        setAudit(null);
        setDemoConfirmOpen(false);
        track('load_demo_case_confirmed', 'commandbar');
    }

    async function runAudit() {
        track('audit_clicked', 'commandbar', `claimChars=${form.claimText.length};evidenceChars=${form.evidenceText.length}`);
        setError('');
        if (!userToken) {
            setError('Sign in before running an audit.');
            return;
        }
        setLoading(true);
        const stages = ['READING CV', 'EXTRACTING CANDIDATE CLAIMS', 'CHECKING ROLE EVIDENCE', 'SCORING HIRING CREDIBILITY', 'WRITING CANDIDATE REPORT'];
        let index = 0;
        setStage(stages[index]);
        const timer = setInterval(() => {
            index = Math.min(index + 1, stages.length - 1);
            setStage(stages[index]);
        }, 700);
        try {
            const queued = await api.runAudit(auditPayload(form), userToken);
            setAudit(queued);
            setStage('AUDIT JOB QUEUED');
            const result = await waitForAuditCompletion(queued.id, userToken, setStage);
            await loadHistory();
            setAudit(result);
        } catch (err) {
            setError(err.message);
        } finally {
            clearInterval(timer);
            setLoading(false);
            setStage('');
        }
    }

    async function uploadAuditFile(field, event) {
        const file = event.target.files?.[0];
        event.target.value = '';
        if (!file) {
            return;
        }
        setError('');
        if (!userToken) {
            setError('Sign in before uploading audit files.');
            return;
        }
        setUploadingField(field);
        try {
            const extracted = await javaApi.extractAuditFile(file, userToken);
            const textKey = field === 'claim' ? 'claimText' : 'evidenceText';
            const titleKey = field === 'claim' ? 'claimTitle' : 'evidenceTitle';
            setForm((current) => ({
                ...current,
                [textKey]: extracted.text || '',
                [titleKey]: current[titleKey] || extracted.filename || '',
            }));
            if (extracted.warnings?.length) {
                setError(extracted.warnings.join(' '));
            }
        } catch (err) {
            setError(err.message);
        } finally {
            setUploadingField('');
        }
    }

    async function openAudit(id) {
        track('history_open_audit', 'history', `auditId=${id}`);
        setDetailAuditId(id);
        navigateTo(setRoute, 'auditDetail', id);
        await loadAuditDetail(id);
    }

    async function loadAuditDetail(id) {
        setError('');
        setDetailLoading(true);
        try {
            setDetailAudit(await api.getAudit(id, userToken));
        } catch (err) {
            setError(err.message);
        } finally {
            setDetailLoading(false);
        }
    }

    if (introVisible) {
        return (
            <LanguageContext.Provider value={{ lang, setLang, t }}>
                <IntroAnimation onDone={() => setIntroVisible(false)} />
            </LanguageContext.Provider>
        );
    }

    const AppHeader = (props) => <Header {...props} unreadMessages={unreadMessages} />;

    let content;
    if (route === 'admin') {
        content = <AdminPanel setRoute={setRoute} />;
    } else if (route === 'dashboard') {
        content = <DashboardPage setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} history={history} templates={templates} historyLoading={historyLoading} openAudit={openAudit} />;
    } else if (route === 'projects') {
        content = <ProjectsPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} onProjectsChange={loadProjects} />;
    } else if (route === 'newProject') {
        content = <NewJobPage Header={AppHeader} Metric={Metric} Textarea={Textarea} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} onProjectsChange={loadProjects} />;
    } else if (route === 'projectDetail') {
        content = <ProjectDetailPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} />;
    } else if (route === 'projectTeam') {
        content = <ProjectTeamPage Header={AppHeader} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} openCompose={openCompose} />;
    } else if (route === 'addCandidate') {
        content = <AddCandidatePage Header={AppHeader} Metric={Metric} Textarea={Textarea} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} onProjectsChange={loadProjects} />;
    } else if (route === 'candidateDetail') {
        content = <CandidateDetailPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} onProjectsChange={loadProjects} />;
    } else if (route === 'candidateProfile') {
        content = <CandidateProfilePage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} />;
    } else if (route === 'signalTrace') {
        content = <SignalTracePage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} />;
    } else if (route === 'auditDetail') {
        content = <AuditDetailPage setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} audit={detailAudit} loading={detailLoading} error={error} />;
    } else if (route === 'auditProfile') {
        content = <ProfilingModePage setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} audit={detailAudit} loading={detailLoading} error={error} />;
    } else if (route === 'profile') {
        content = <ProfilePage Header={AppHeader} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />;
    } else if (route === 'messages') {
        content = <MessagesPage Header={AppHeader} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} openCompose={openCompose} onProjectsChange={loadProjects} />;
    } else if (route === 'login') {
        content = <AuthPage mode="login" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} />;
    } else if (route === 'register') {
        content = <AuthPage mode="register" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} />;
    } else if (route === 'home') {
        content = <HomePage Header={AppHeader} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />;
    } else {
        content = (
            <div className="shell">
                <div className="pageGlow contentFadeIn" />
                <AppHeader setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
                <main className="workspace contentFadeIn">
                    {!userToken && (
                        <div className="error">Sign in or create an organizer account before running private candidate audits.</div>
                    )}
                    {userToken && (
                        <section className="privateStrip">
                            <div>
                                <span className="eyebrow">Private workspace</span>
                                <strong>{user?.fullName || user?.username || 'Signed-in user'}</strong>
                            </div>
                            <Metric label="My audits" value={history.length} />
                            <Metric label="Last activity" value={history[0]?.createdAt ? new Date(history[0].createdAt).toLocaleDateString() : 'None'} />
                        </section>
                    )}
                    <section className="intake">
                        <Panel title={currentAuditMode(form).claimTitle} subtitle={currentAuditMode(form).claimSubtitle}>
                            <Input label="Claim title" value={form.claimTitle} onChange={(claimTitle) => setForm({ ...form, claimTitle })} />
                            <label className="auditFileButton">
                                <FileSearch size={16} />
                                {uploadingField === 'claim' ? 'Reading file...' : 'Upload PDF, DOCX, or TXT'}
                                <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => uploadAuditFile('claim', event)} disabled={!userToken || uploadingField === 'claim'} />
                            </label>
                            <Textarea value={form.claimText} onChange={(claimText) => setForm({ ...form, claimText })} />
                        </Panel>
                        <Panel title={currentAuditMode(form).evidenceTitle} subtitle={currentAuditMode(form).evidenceSubtitle}>
                            <Input label="Evidence title" value={form.evidenceTitle} onChange={(evidenceTitle) => setForm({ ...form, evidenceTitle })} />
                            <label className="auditFileButton">
                                <FileSearch size={16} />
                                {uploadingField === 'evidence' ? 'Reading file...' : 'Upload PDF, DOCX, or TXT'}
                                <input type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={(event) => uploadAuditFile('evidence', event)} disabled={!userToken || uploadingField === 'evidence'} />
                            </label>
                            <Textarea value={form.evidenceText} onChange={(evidenceText) => setForm({ ...form, evidenceText })} />
                        </Panel>
                    </section>
                    {userToken && (
                        <>
                            {templateLoading ? <SkeletonBlock rows={4} /> : <AuditTemplatePanel
                                mode={form.auditMode || 'cv'}
                                templates={templates}
                                selectedId={form.templateId || ''}
                                onSelect={(templateId) => setForm({ ...form, templateId })}
                                templateForm={templateForm}
                                setTemplateForm={setTemplateForm}
                                onSave={saveTemplate}
                            />}
                            <CheckStatePanel
                                states={states}
                                selectedId={form.checkStateId || ''}
                                onSelect={(checkStateId) => setForm({ ...form, checkStateId })}
                            />
                        </>
                    )}
                    <section className="commandbar">
                        <div className="demoPicker">
                            <select value={selectedDemoId} onChange={(event) => setSelectedDemoId(event.target.value)}>
                                {demoCases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                            </select>
                            <button className="secondary" onClick={() => { track('load_demo_case', 'commandbar', selectedDemoId); setDemoConfirmOpen(true); }}>Load demo</button>
                        </div>
                        <button className="primary" disabled={loading || !userToken} onClick={runAudit}>
                            <Play size={18} /> {currentAuditMode(form).actionCopy}
                        </button>
                        <Metric label="Claim chars" value={form.claimText.length} />
                        <Metric label="Evidence chars" value={form.evidenceText.length} />
                    </section>
                    {error && <div className="error">{error}</div>}
                    {loading && <><Loading stage={stage} /><SkeletonBlock rows={5} /></>}
                    {audit && <AuditResult audit={audit} setRoute={setRoute} />}
                    <HistoryPanel history={history} templates={templates} loading={historyLoading} openAudit={openAudit} />
                </main>
                {demoConfirmOpen && (
                    <DemoConfirmModal
                        countdown={demoCountdown}
                        onCancel={() => setDemoConfirmOpen(false)}
                        onConfirm={confirmLoadDemo}
                    />
                )}
            </div>
        );
    }

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            <ErrorBoundary
                key={route}
                resetKey={`${route}:${detailAuditId || ''}`}
                route={route}
                onDashboard={() => navigateTo(setRoute, userToken ? 'dashboard' : 'home')}
                onProjects={() => navigateTo(setRoute, userToken ? 'projects' : 'home')}
                onLogout={async () => {
                    if (userToken) {
                        await api.logout(userToken).catch(() => null);
                    }
                    localStorage.removeItem('verdictUserToken');
                    setUserToken('');
                    setUser(null);
                    navigateTo(setRoute, 'home');
                }}
            >
                {content}
            </ErrorBoundary>
            <GlobalCompose
                draft={composeDraft}
                open={composeOpen}
                setDraft={setComposeDraft}
                setOpen={setComposeOpen}
                user={user}
            />
        </LanguageContext.Provider>
    );
}

function GlobalCompose({ draft, open, setDraft, setOpen, user }) {
    const [composeState, setComposeState] = useState('idle');
    const [composeError, setComposeError] = useState('');

    useEffect(() => {
        if (open) {
            setComposeState('idle');
            setComposeError('');
        }
    }, [open]);

    if (!open) {
        return null;
    }

    const canEdit = composeState === 'idle' || composeState === 'failed';

    async function sendMessage(event) {
        event.preventDefault();
        if (composeState === 'sending') {
            return;
        }
        setComposeState('sending');
        setComposeError('');
        const token = localStorage.getItem('verdictUserToken') || '';
        try {
            if (token) {
                await apiSendMessage({
                    to: draft.to.trim(),
                    subject: draft.subject,
                    body: draft.body,
                    replyToMessageId: draft.replyToMessageId,
                    forwardedFromMessageId: draft.forwardedFromMessageId,
                }, token);
                window.dispatchEvent(new Event('verdictMessagesChanged'));
            } else {
                saveOfflineMessage();
            }
        } catch {
            setComposeState('failed');
            setComposeError('Server delivery failed. Check the recipient or connection, then retry.');
            return;
        }
        setComposeState('sent');
        await new Promise((resolve) => setTimeout(resolve, 520));
        setDraft(emptyComposeDraft());
        setComposeState('idle');
        setOpen(false);
    }

    function saveOfflineMessage() {
        appendMessage(createMessage({
            from: user?.email || 'me@verdict.local',
            fromName: user?.fullName || user?.username || 'Current user',
            to: draft.to.trim(),
            subject: draft.subject,
            body: draft.body,
            replyToMessageId: draft.replyToMessageId,
            forwardedFromMessageId: draft.forwardedFromMessageId,
        }), user);
        window.dispatchEvent(new Event('verdictMessagesChanged'));
    }

    function saveOfflineAndClose() {
        saveOfflineMessage();
        setDraft(emptyComposeDraft());
        setComposeError('');
        setComposeState('idle');
        setOpen(false);
    }

    return (
        <form className={`gmailCompose ${composeState}`} onSubmit={sendMessage}>
            <div className="composeHead">
                <strong>{composeState === 'sent' ? 'Message sent' : composeState === 'sending' ? 'Sending...' : composeState === 'failed' ? 'Delivery failed' : 'New Message'}</strong>
                <button type="button" disabled={composeState === 'sending'} onClick={() => setOpen(false)}><X size={16} /></button>
            </div>
            <div className="composeSendTrack"><span /></div>
            {composeError && <div className="composeError">{composeError}</div>}
            <input value={draft.to} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, to: event.target.value })} placeholder="Recipients" required />
            <input value={draft.subject} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, subject: event.target.value })} placeholder="Subject" />
            <textarea value={draft.body} disabled={!canEdit} onChange={(event) => setDraft({ ...draft, body: event.target.value })} placeholder="Description" required />
            <div className="composeActions">
                <button className="primary composeSendButton" disabled={!canEdit} type="submit"><Send size={16} /> {composeState === 'failed' ? 'Retry' : composeState === 'sending' ? 'Sending' : composeState === 'sent' ? 'Sent' : 'Send'}</button>
                {composeState === 'failed' && <button className="secondary" type="button" onClick={saveOfflineAndClose}>Save offline</button>}
            </div>
        </form>
    );
}

function emptyComposeDraft() {
    return { to: '', subject: '', body: '', replyToMessageId: null, forwardedFromMessageId: null };
}

function routeFromPath() {
    if (window.location.pathname === '/admin') return { route: 'admin' };
    if (window.location.pathname === '/dashboard') return { route: 'dashboard' };
    if (window.location.pathname === '/messages') return { route: 'messages' };
    if (window.location.pathname === '/profile') return { route: 'profile' };
    if (window.location.pathname === '/projects') return { route: 'projects' };
    if (window.location.pathname === '/projects/new') return { route: 'newProject' };
    if (window.location.pathname.match(/^\/projects\/([^/]+)\/candidates\/new$/)) return { route: 'addCandidate' };
    if (window.location.pathname.match(/^\/projects\/([^/]+)\/team$/)) return { route: 'projectTeam' };
    if (window.location.pathname.match(/^\/projects\/([^/]+)\/candidates\/([^/]+)\/signaltrace$/)) return { route: 'signalTrace' };
    if (window.location.pathname.match(/^\/projects\/([^/]+)\/candidates\/([^/]+)\/profile$/)) return { route: 'candidateProfile' };
    if (window.location.pathname.match(/^\/projects\/([^/]+)\/candidates\/([^/]+)$/)) return { route: 'candidateDetail' };
    if (window.location.pathname.match(/^\/projects\/([^/]+)$/)) return { route: 'projectDetail' };
    const profileMatch = window.location.pathname.match(/^\/audit\/(\d+)\/profile$/);
    if (profileMatch) return { route: 'auditProfile', auditId: Number(profileMatch[1]) };
    const auditMatch = window.location.pathname.match(/^\/audit\/(\d+)$/);
    if (auditMatch) return { route: 'auditDetail', auditId: Number(auditMatch[1]) };
    if (window.location.pathname === '/audit') return { route: 'app' };
    if (window.location.pathname === '/login') return { route: 'login' };
    if (window.location.pathname === '/register') return { route: 'register' };
    return { route: 'home' };
}

function navigateTo(setRoute, next, id, childId) {
    setRoute(next);
    const path = next === 'admin' ? '/admin' : next === 'dashboard' ? '/dashboard' : next === 'messages' ? '/messages' : next === 'projects' ? '/projects' : next === 'newProject' ? '/projects/new' : next === 'projectDetail' ? `/projects/${id}` : next === 'projectTeam' ? `/projects/${id}/team` : next === 'addCandidate' ? `/projects/${id}/candidates/new` : next === 'signalTrace' ? `/projects/${id}/candidates/${childId}/signaltrace` : next === 'candidateProfile' ? `/projects/${id}/candidates/${childId}/profile` : next === 'candidateDetail' ? `/projects/${id}/candidates/${childId}` : next === 'profile' ? '/profile' : next === 'auditProfile' ? `/audit/${id}/profile` : next === 'auditDetail' ? `/audit/${id}` : next === 'app' ? '/projects' : next === 'login' ? '/login' : next === 'register' ? '/register' : '/';
    window.history.replaceState(null, '', path);
    scrollToPageTop();
}

function scrollToPageTop() {
    window.requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
        document.scrollingElement?.scrollTo?.({ top: 0, left: 0, behavior: 'auto' });
    });
}

function Header({ setRoute, user, userToken, setUser, setUserToken, unreadMessages = 0 }) {
    const { lang, setLang, t } = useLanguage();
    const [accountOpen, setAccountOpen] = useState(false);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
    function navigate(next) {
        setAccountOpen(false);
        setMobileMenuOpen(false);
        track('navigation_clicked', next);
        navigateTo(setRoute, next);
    }

    async function logout() {
        track('logout_clicked', 'topbar');
        if (userToken) {
            await api.logout(userToken).catch(() => null);
        }
        localStorage.removeItem('verdictUserToken');
        setUserToken?.('');
        setUser?.(null);
        navigate('home');
    }

    return (
        <header className={`topbar ${mobileMenuOpen ? 'menuOpen' : ''}`}>
            <div className="topbarBg contentFadeIn" />
            <div className="topbarIdentity">
                <div className="brandLine">
                    <div className="brand">VERDICT</div>
                    <div className="languageSwitch" aria-label="Language switch">
                        <button className={lang === 'en' ? 'active' : ''} type="button" onClick={() => setLang('en')}>EN</button>
                        <button className={lang === 'ge' ? 'active' : ''} type="button" onClick={() => setLang('ge')}>GE</button>
                    </div>
                </div>
                <div className="tagline">{t('brandTagline')}</div>
            </div>
            <button
                className="menuToggle"
                type="button"
                aria-label={mobileMenuOpen ? t('closeMenu') : t('openMenu')}
                aria-expanded={mobileMenuOpen}
                onClick={() => {
                    setMobileMenuOpen((open) => !open);
                    setAccountOpen(false);
                }}
            >
                {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
                <span>{t('menu')}</span>
            </button>
            <nav className="topbarNav">
                <button onClick={() => navigate('home')}>{t('home')}</button>
                {user && <button className="quiet" onClick={() => navigate('dashboard')}><Gauge size={16} /> {t('dashboard')}</button>}
                <button className="quiet" onClick={() => navigate('projects')}><LayoutDashboard size={16} /> {t('projects')}</button>
                {user && (
                    <button className="quiet mailNavButton" onClick={() => navigate('messages')}>
                        <Mail size={16} /> Messages
                        {unreadMessages > 0 && <b aria-label={`${unreadMessages} unread messages`}>{unreadMessages > 99 ? '99+' : unreadMessages}</b>}
                    </button>
                )}
                <button className="quiet" onClick={() => navigate('projects')}><FileSearch size={16} /> {t('audits')}</button>
                {user ? (
                    <div className="accountMenu">
                        <button className="accountChip" onClick={() => setAccountOpen(!accountOpen)}>
                            <span>{user.username}</span>
                            <small>{user.role || t('account')}</small>
                            <ChevronDown size={15} />
                        </button>
                        {accountOpen && (
                            <div className="accountDropdown">
                                <button onClick={() => navigate('dashboard')}><LayoutDashboard size={16} /> {t('dashboard')}</button>
                                <button onClick={() => navigate('projects')}><FileSearch size={16} /> {t('audits')}</button>
                                <button onClick={() => navigate('profile')}><User size={16} /> {t('profile')}</button>
                                <button className="destructive" onClick={logout}><LogOut size={16} /> {t('logout')}</button>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        <button className="quiet" onClick={() => navigate('login')}><Lock size={16} /> {t('login')}</button>
                        <button className="primary" onClick={() => navigate('register')}><UserPlus size={16} /> {t('register')}</button>
                    </>
                )}
            </nav>
        </header>
    );
}

function DashboardPage({ setRoute, user, userToken, setUser, setUserToken, history, templates, historyLoading, openAudit }) {
    const { t } = useLanguage();
    const [templateFilter, setTemplateFilter] = useState('ALL');
    const stats = dashboardStats(history);
    const filteredHistory = filterAuditsByTemplate(history, templateFilter);
    const templateFilters = templateFilterOptions(history, templates);
    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="dashboard contentFadeIn">
                <section className="dashboardHero">
                    <div>
                        <span className="eyebrow">{t('privateWorkspace')}</span>
                        <h1>{user ? t('welcome', { name: user.fullName }) : t('welcomeBackTitle')}</h1>
                        <p>{user?.organization || t('independent')} / {user?.role || t('analyst')} / {user?.email}</p>
                    </div>
                    <button className="primary" onClick={() => navigateTo(setRoute, 'app')}><Play size={18} /> {t('newAudit')}</button>
                </section>
                <section className="dashboardStats">
                    <Metric label={t('privateAudits')} value={history.length} />
                    <Metric label={t('averageScore')} value={`${stats.averageScore}%`} />
                    <Metric label="Risky claims" value={stats.riskyClaims} />
                    <Metric label="Saved reports" value={history.length} />
                </section>
                <section className="dashboardGrid">
                    <div className="dashboardPanel">
                        <h2><History size={18} /> Recent audits</h2>
                        <TemplateLensBar filters={templateFilters} value={templateFilter} onChange={setTemplateFilter} />
                        {historyLoading && <SkeletonBlock rows={5} compact />}
                        {!historyLoading && filteredHistory.length === 0 && <div className="emptyState">No private audits match this template lens.</div>}
                        {filteredHistory.slice(0, 5).map((item) => (
                            <button className="dashboardAuditRow" key={item.id} onClick={() => openAudit(item.id)}>
                                <span>#{item.id} {item.claimTitle}</span>
                                <small>{item.templateName || 'No template'}</small>
                                <span className={`auditStatusPill ${(item.status || 'COMPLETED').toLowerCase()}`}>{item.status || 'COMPLETED'}</span>
                                <strong>{item.credibilityScore}%</strong>
                            </button>
                        ))}
                    </div>
                    <div className="dashboardPanel">
                        <h2><ShieldCheck size={18} /> Workspace health</h2>
                        <div className="healthLine"><span>Last activity</span><strong>{stats.lastActivity}</strong></div>
                        <div className="healthLine"><span>Lowest score</span><strong>{stats.lowestScore}%</strong></div>
                        <div className="healthLine"><span>Highest score</span><strong>{stats.highestScore}%</strong></div>
                        <div className="healthLine"><span>Most common issue</span><strong>{stats.commonIssue}</strong></div>
                    </div>
                </section>
            </main>
        </div>
    );
}

function dashboardStats(history) {
    if (history.length === 0) {
        return { averageScore: 0, riskyClaims: 0, lowestScore: 0, highestScore: 0, lastActivity: 'No audits yet', commonIssue: 'None' };
    }
    const total = history.reduce((sum, audit) => sum + audit.credibilityScore, 0);
    const riskyClaims = history.reduce((sum, audit) => sum + audit.stretchedCount + audit.unsupportedCount + audit.gapCount, 0);
    const scores = history.map((audit) => audit.credibilityScore);
    const latest = history[0]?.createdAt ? new Date(history[0].createdAt).toLocaleString() : 'Unknown';
    const unsupported = history.reduce((sum, audit) => sum + audit.unsupportedCount, 0);
    const stretched = history.reduce((sum, audit) => sum + audit.stretchedCount, 0);
    const gaps = history.reduce((sum, audit) => sum + audit.gapCount, 0);
    const commonIssue = unsupported >= stretched && unsupported >= gaps ? 'Unsupported claims' : stretched >= gaps ? 'Stretched wording' : 'Requirement gaps';
    return {
        averageScore: Math.round(total / history.length),
        riskyClaims,
        lowestScore: Math.min(...scores),
        highestScore: Math.max(...scores),
        lastActivity: latest,
        commonIssue,
    };
}

function currentAuditMode(form) {
    return auditModes[form.auditMode] || auditModes.cv;
}

function auditPayload(form) {
    return {
        claimTitle: form.claimTitle,
        evidenceTitle: form.evidenceTitle,
        claimText: form.claimText,
        evidenceText: form.evidenceText,
        auditMode: form.auditMode || 'cv',
        templateId: form.templateId || '',
        checkStateId: form.checkStateId || '',
    };
}

function DemoConfirmModal({ countdown, onCancel, onConfirm }) {
    return (
        <div className="modalOverlay" role="dialog" aria-modal="true">
            <section className="modal demoModal">
                <div className="modalHead">
                    <div>
                        <h2>Load demo case?</h2>
                        <span>This will replace the text currently in the audit form.</span>
                    </div>
                    <button onClick={onCancel}><X size={18} /> Cancel</button>
                </div>
                <div className="demoCountdown">
                    <strong>{countdown}</strong>
                    <span>Confirm unlocks after the countdown.</span>
                </div>
                <div className="editActions">
                    <button className="primary" disabled={countdown > 0} onClick={onConfirm}><Play size={16} /> Yes, load demo</button>
                    <button onClick={onCancel}>Keep current text</button>
                </div>
            </section>
        </div>
    );
}

function emptyTemplateForm(mode = 'cv') {
    return {
        mode,
        name: '',
        description: '',
        instructions: '',
        markUnimportant: 'email, phone, linkedin, github, website, contact',
        shared: false,
    };
}

async function waitForAuditCompletion(id, token, setStage) {
    const pollStages = ['RUNNING CLAIM CHECKS', 'CHECKING EVIDENCE', 'FINALIZING RESULTS'];
    for (let attempt = 0; attempt < 60; attempt += 1) {
        await delay(1000);
        setStage(pollStages[attempt % pollStages.length]);
        const audit = await api.getAudit(id, token);
        if (audit.status === 'FAILED') {
            throw new Error('Audit job failed. Please try again.');
        }
        if (audit.status !== 'RUNNING') {
            return audit;
        }
    }
    throw new Error('Audit job is still running. Open it from history in a moment.');
}

function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function AuthPage({ mode, setRoute, setUser, setUserToken }) {
    const { t } = useLanguage();
    const isRegister = mode === 'register';
    const [form, setForm] = useState({
        firstName: '',
        lastName: '',
        fullName: '',
        username: '',
        email: '',
        country: '',
        address: '',
        organization: '',
        role: '',
        identifier: '',
        password: '',
        confirmInfo: false,
    });
    const [registerStep, setRegisterStep] = useState(0);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const registerSteps = getRegisterSteps(form);
    const activeStep = registerSteps[registerStep] || registerSteps[0];
    const activeChecks = activeStep?.checks || [];
    const stepValid = activeChecks.every((check) => check.valid);

    async function submit() {
        setError('');
        if (isRegister) {
            const invalidStep = registerSteps.findIndex((step) => step.checks.some((check) => !check.valid));
            if (invalidStep >= 0) {
                setRegisterStep(invalidStep);
                setError('Finish the highlighted step before creating the account.');
                return;
            }
        }
        setLoading(true);
        track(isRegister ? 'register_submit' : 'login_submit', 'auth');
        try {
            const response = isRegister ? await api.register(registerPayload(form)) : await api.login(form);
            if (!response.token) {
                setError('Account created. Email verification is required before login; ask an admin to verify the account.');
                return;
            }
            localStorage.setItem('verdictUserToken', response.token);
            setUserToken(response.token);
            setUser(response.user);
            navigateTo(setRoute, 'dashboard');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }

    function updateForm(patch) {
        setForm((current) => ({ ...current, ...patch }));
        setError('');
    }

    function nextStep() {
        if (!stepValid) {
            setError('Complete the checks on this step before continuing.');
            return;
        }
        setError('');
        setRegisterStep((current) => Math.min(current + 1, registerSteps.length - 1));
    }

    function previousStep() {
        setError('');
        setRegisterStep((current) => Math.max(current - 1, 0));
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={null} userToken="" setUser={setUser} setUserToken={setUserToken} />
            <main className="authWrap contentFadeIn">
                <section className="authCard">
                    <span className="eyebrow">{isRegister ? t('createAccount') : t('welcomeBack')}</span>
                    <h1>{isRegister ? t('privateAuditWorkspace') : t('loginToContinue')}</h1>
                    {isRegister ? (
                        <div className="registerWizard">
                            <div className="registerProgress" aria-label={t('registrationProgress')}>
                                <div className="progressTop">
                                    <strong>{registerStep + 1}/{registerSteps.length}</strong>
                                    <span>{activeStep.title}</span>
                                </div>
                                <div className="progressRail">
                                    <span style={{ width: `${((registerStep + 1) / registerSteps.length) * 100}%` }} />
                                </div>
                                <div className="stepDots">
                                    {registerSteps.map((step, index) => (
                                        <button
                                            key={step.title}
                                            className={index === registerStep ? 'active' : index < registerStep ? 'done' : ''}
                                            onClick={() => index <= registerStep && setRegisterStep(index)}
                                            disabled={index > registerStep}
                                            aria-label={`Step ${index + 1}: ${step.title}`}
                                        >
                                            {index + 1}
                                        </button>
                                    ))}
                                </div>
                            </div>
                            <div className="registerStepPanel" key={registerStep}>
                                <div className="stepHead">
                                    <span className="eyebrow">{t('step')} {registerStep + 1}</span>
                                    <h2>{activeStep.title}</h2>
                                </div>
                                {registerStep === 0 && (
                                    <div className="authGrid">
                                        <Input label={t('firstName')} value={form.firstName} onChange={(firstName) => updateForm({ firstName })} />
                                        <Input label={t('lastName')} value={form.lastName} onChange={(lastName) => updateForm({ lastName })} />
                                    </div>
                                )}
                                {registerStep === 1 && (
                                    <div className="authGrid single">
                                        <Input label={t('username')} value={form.username} onChange={(username) => updateForm({ username })} />
                                    </div>
                                )}
                                {registerStep === 2 && (
                                    <div className="authGrid single">
                                        <Input label={t('email')} value={form.email} onChange={(email) => updateForm({ email })} />
                                    </div>
                                )}
                                {registerStep === 3 && (
                                    <div className="authGrid">
                                        <Input label={t('country')} value={form.country} onChange={(country) => updateForm({ country })} />
                                        <Input label={t('address')} value={form.address} onChange={(address) => updateForm({ address })} />
                                    </div>
                                )}
                                {registerStep === 4 && (
                                    <div className="authGrid">
                                        <Input label={t('organization')} value={form.organization} onChange={(organization) => updateForm({ organization })} />
                                        <Input label={t('role')} value={form.role} onChange={(role) => updateForm({ role })} />
                                    </div>
                                )}
                                {registerStep === 5 && (
                                    <div className="authGrid single">
                                        <Input type="password" label={t('password')} value={form.password} onChange={(password) => updateForm({ password })} />
                                    </div>
                                )}
                                {registerStep === 6 && (
                                    <>
                                        <div className="reviewBox">
                                            {reviewRows(form).map(([label, value]) => (
                                                <div key={label}>
                                                    <span>{label}</span>
                                                    <strong>{value || t('notProvided')}</strong>
                                                </div>
                                            ))}
                                        </div>
                                        <label className="confirmRow">
                                            <input type="checkbox" checked={form.confirmInfo} onChange={(event) => updateForm({ confirmInfo: event.target.checked })} />
                                            <span>{t('infoCorrect')}</span>
                                        </label>
                                    </>
                                )}
                                <ValidationList checks={activeChecks} />
                                <div className="stepActions">
                                    <button className="ghost" disabled={registerStep === 0 || loading} onClick={previousStep}>{t('back')}</button>
                                    {registerStep < registerSteps.length - 1 ? (
                                        <button className="primary" disabled={!stepValid || loading} onClick={nextStep}>
                                            {t('next')} <ArrowRight size={18} />
                                        </button>
                                    ) : (
                                        <button className="primary" disabled={!stepValid || loading} onClick={submit}>
                                            <UserPlus size={18} /> {loading ? t('working') : t('createAccount')}
                                        </button>
                                    )}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="authGrid single">
                            <Input label={t('usernameOrEmail')} value={form.identifier} onChange={(identifier) => setForm({ ...form, identifier })} />
                            <Input type="password" label={t('password')} value={form.password} onChange={(password) => setForm({ ...form, password })} />
                        </div>
                    )}
                    {!isRegister && (
                        <button className="primary authSubmit" disabled={loading} onClick={submit}>
                            <Lock size={18} />
                            {loading ? t('working') : t('login')}
                        </button>
                    )}
                    <button className="ghost authSubmit" onClick={() => navigateTo(setRoute, isRegister ? 'login' : 'register')}>
                        {isRegister ? t('alreadyHaveAccount') : t('createNewAccount')}
                    </button>
                    {error && <div className="error">{error}</div>}
                </section>
            </main>
        </div>
    );
}

function getRegisterSteps(form) {
    const firstName = form.firstName.trim();
    const lastName = form.lastName.trim();
    const username = form.username.trim();
    const email = form.email.trim();
    const country = form.country.trim();
    const address = form.address.trim();
    const organization = form.organization.trim();
    const role = form.role.trim();
    const password = form.password;
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const usernameOk = /^[a-zA-Z0-9_-]+$/.test(username);
    const passwordDigits = (password.match(/\d/g) || []).length;
    return [
        {
            title: 'First name and last name',
            checks: [
                { label: 'First name has at least 2 letters', valid: firstName.length >= 2 },
                { label: 'Last name has at least 2 letters', valid: lastName.length >= 2 },
            ],
        },
        {
            title: 'Username',
            checks: [
                { label: 'Username is 3 to 80 characters', valid: username.length >= 3 && username.length <= 80 },
                { label: 'Only letters, numbers, underscore, or dash', valid: usernameOk },
            ],
        },
        {
            title: 'Email address',
            checks: [
                { label: 'Email format is valid', valid: emailOk },
                { label: 'Email is under 160 characters', valid: email.length > 0 && email.length <= 160 },
            ],
        },
        {
            title: 'Location',
            checks: [
                { label: 'Country is filled in', valid: country.length >= 2 && country.length <= 120 },
                { label: 'Address is at least 6 characters', valid: address.length >= 6 && address.length <= 220 },
                { label: 'Address includes at least one number', valid: /\d/.test(address) },
            ],
        },
        {
            title: 'Work profile',
            checks: [
                { label: 'Organization is 80 characters or less', valid: organization.length <= 80 },
                { label: 'Role is 80 characters or less', valid: role.length <= 80 },
            ],
        },
        {
            title: 'Password',
            checks: [
                { label: 'Password is at least 8 characters', valid: password.length >= 8 },
                { label: 'Password includes at least 1 digit', valid: passwordDigits >= 1 },
                { label: 'Password includes at least 1 letter', valid: /[a-zA-Z]/.test(password) },
            ],
        },
        {
            title: 'Is all information correct?',
            checks: [
                { label: 'Name, email, location, and password checks are complete', valid: firstName.length >= 2 && lastName.length >= 2 && username.length >= 3 && emailOk && country.length >= 2 && address.length >= 6 && password.length >= 8 && passwordDigits >= 1 },
                { label: 'You confirmed the information is correct', valid: form.confirmInfo },
            ],
        },
    ];
}

function registerPayload(form) {
    return {
        fullName: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        country: form.country.trim(),
        address: form.address.trim(),
        organization: form.organization.trim(),
        role: form.role.trim(),
        password: form.password,
    };
}

function reviewRows(form) {
    const payload = registerPayload(form);
    return [
        ['Full name', payload.fullName],
        ['Username', payload.username],
        ['Email', payload.email],
        ['Country', payload.country],
        ['Address', payload.address],
        ['Organization', payload.organization || 'Independent'],
        ['Role', payload.role || 'Analyst'],
    ];
}

function ValidationList({ checks }) {
    return (
        <div className="validationList">
            {checks.map((check) => (
                <div className={check.valid ? 'valid' : ''} key={check.label}>
                    <CheckCircle2 size={16} />
                    <span>{check.label}</span>
                </div>
            ))}
        </div>
    );
}

function AuditDetailPage({ setRoute, user, userToken, setUser, setUserToken, audit, loading, error }) {
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [confidenceFilter, setConfidenceFilter] = useState('ALL');
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const verdicts = audit?.verdicts || [];
    const filteredVerdicts = verdicts.filter((verdict) => {
        const statusMatch = statusFilter === 'ALL' || verdict.status === statusFilter;
        const confidenceMatch = confidenceFilter === 'ALL' || verdict.confidence === confidenceFilter;
        const severityMatch = severityFilter === 'ALL'
            || (severityFilter === 'PROBLEM' && isProblemVerdict(verdict))
            || verdictSeverity(verdict) === severityFilter;
        return statusMatch && confidenceMatch && severityMatch;
    });
    const statusFilters = ['ALL', 'SUPPORTED', 'STRETCHED', 'UNSUPPORTED', 'GAP'];
    const confidenceFilters = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];
    const severityFilters = ['ALL', 'PROBLEM', 'HIGH RISK', 'MEDIUM RISK', 'LOW RISK'];

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="detailPage contentFadeIn">
                <button className="ghost" onClick={() => navigateTo(setRoute, 'dashboard')}>Back to dashboard</button>
                {error && <div className="error">{error}</div>}
                {loading && <><Loading stage="LOADING AUDIT DETAIL" /><SkeletonBlock rows={8} /></>}
                {!loading && !audit && <div className="emptyState">Audit detail is not available.</div>}
                {audit && (
                    <>
                        <section className="detailHero">
                            <div>
                                <span className="eyebrow">Private audit #{audit.id}</span>
                                <h1>{audit.claimTitle}</h1>
                                <p>{audit.evidenceTitle}</p>
                            </div>
                            <div className="detailScore">
                                <Gauge size={28} />
                                <span>Credibility</span>
                                <strong>{audit.credibilityScore}%</strong>
                            </div>
                            <ExportActions auditId={audit.id} />
                        </section>
                        <StickyAuditBar audit={audit} />
                        <section className="detailMeta">
                            <Metric label="Created" value={formatDateTime(audit.createdAt)} />
                            <Metric label="Status" value={audit.status || 'COMPLETED'} />
                            <Metric label="Engine" value={audit.engine} />
                            <Metric label="Analyzer" value={audit.analyzerVersion || 'Unknown'} />
                            <Metric label="Prompt" value={audit.promptVersion || 'Unknown'} />
                            <Metric label="Runtime" value={`${audit.processingMillis}ms`} />
                            <Metric label="CV hash" value={shortHash(audit.claimFingerprint)} />
                            <Metric label="Evidence hash" value={shortHash(audit.evidenceFingerprint)} />
                        </section>
                        <AuditScoreExplainer audit={audit} />
                        <section className="documentCompare">
                            <Panel title="Candidate CV" subtitle={audit.claimTitle}>
                                <pre>{audit.claimText}</pre>
                            </Panel>
                            <Panel title="Job evidence" subtitle={audit.evidenceTitle}>
                                <pre>{audit.evidenceText}</pre>
                            </Panel>
                        </section>
                        <SuspiciousWordsPanel text={audit.claimText || verdicts.map((verdict) => verdict.sentence).join(' ')} />
                        <ProfilingModePanel audit={audit} verdicts={verdicts} setRoute={setRoute} />
                        <RewriteSuggestions verdicts={verdicts} />
                        <section className="detailTableSection">
                            <div className="tableToolbar">
                                <h2>Verdicts</h2>
                                <div className="filterStack">
                                    <FilterGroup label="Status" filters={statusFilters} value={statusFilter} onChange={setStatusFilter} />
                                    <FilterGroup label="Confidence" filters={confidenceFilters} value={confidenceFilter} onChange={setConfidenceFilter} />
                                    <FilterGroup label="Severity" filters={severityFilters} value={severityFilter} onChange={setSeverityFilter} />
                                </div>
                            </div>
                            <div className="detailResultsGrid">
                                <div className="detailVerdictTable">
                                    <div className="detailTableHead">
                                        <span>#</span>
                                        <span>Claim</span>
                                        <span>Status</span>
                                        <span>Confidence</span>
                                        <span>Evidence</span>
                                    </div>
                                    {filteredVerdicts.map((verdict) => (
                                        <div className="detailTableRow" key={verdict.id || verdict.sentenceIndex}>
                                            <span>{verdict.sentenceIndex + 1}</span>
                                            <strong>{verdict.sentence}</strong>
                                            <span className={`statusPill ${verdict.status.toLowerCase().replaceAll('_', '-')}`}>{verdict.status}</span>
                                            <span>{verdict.confidence}</span>
                                            <small><b>{verdictSeverity(verdict)}</b> / {verdict.evidencePointer}</small>
                                        </div>
                                    ))}
                                    {filteredVerdicts.length === 0 && <div className="emptyState">No verdicts match this filter.</div>}
                                </div>
                                <EvidenceHighlights evidenceText={audit.evidenceText} verdicts={filteredVerdicts} />
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

function EvidenceHighlights({ evidenceText, verdicts }) {
    const keywords = evidenceKeywords(verdicts);
    const paragraphs = (evidenceText || '').split(/\n+/).map((value) => value.trim()).filter(Boolean);
    const highlighted = paragraphs
        .map((paragraph, index) => ({ paragraph, index, score: matchScore(paragraph, keywords) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

    return (
        <aside className="evidencePanel">
            <div>
                <span className="eyebrow">Matching evidence</span>
                <h3>Snippets beside results</h3>
            </div>
            {highlighted.length === 0 && <div className="emptyState">No matching evidence snippets for this filter.</div>}
            {highlighted.map((item) => (
                <article className="evidenceSnippet" key={`${item.index}-${item.paragraph}`}>
                    <strong>Evidence paragraph {item.index + 1}</strong>
                    <p>{highlightText(item.paragraph, keywords)}</p>
                </article>
            ))}
        </aside>
    );
}

const suspiciousWordRules = [
    ['expert', 'Signals seniority without proof.', 'Specify years, systems, scope, or credentials.'],
    ['led', 'Can overstate ownership if the evidence only shows participation.', 'Use managed, coordinated, contributed to, or supported with team size.'],
    ['optimized', 'Needs a measurable before/after baseline.', 'Add metric, timeframe, and method.'],
    ['proven', 'Sounds absolute unless backed by repeatable evidence.', 'Replace with demonstrated, tested, or documented.'],
    ['advanced', 'Vague level claim without a standard.', 'Name the technique, tool, or measurable complexity.'],
    ['strategic', 'Often hides unclear responsibility.', 'State the decision, audience, and outcome.'],
    ['scalable', 'Requires load, growth, or architecture evidence.', 'Add traffic, volume, latency, or capacity numbers.'],
    ['innovative', 'Subjective without external validation.', 'Describe what changed and why it was different.'],
];

const profilingPhraseRules = [
    ...suspiciousWordRules.map(([word, risk, safer]) => ({
        pattern: new RegExp(`\\b${escapeRegExp(word)}\\b`, 'ig'),
        role: 'Confidence signal',
        level: word === 'led' || word === 'expert' || word === 'proven' ? 'high' : 'medium',
        risk,
        safer,
    })),
    {
        pattern: /\b\d+(?:\.\d+)?\s?(?:%|percent|x|times|k|m|million|billion)\b/ig,
        role: 'Quantified claim',
        level: 'high',
        risk: 'Numbers create a concrete promise. They need direct evidence, baseline, and timeframe.',
        safer: 'Keep the number only when the evidence shows the same metric and context.',
    },
    {
        pattern: /\b(?:best|first|only|largest|fastest|highest|top|world-class)\b/ig,
        role: 'Superlative claim',
        level: 'high',
        risk: 'Absolute ranking language implies comparison against a wider market or peer group.',
        safer: 'Replace with the exact award, ranking source, or a narrower factual description.',
    },
    {
        pattern: /\b(?:responsible for|owned|managed|delivered|built|launched)\b/ig,
        role: 'Ownership claim',
        level: 'medium',
        risk: 'Ownership verbs can overstate personal responsibility if the evidence shows team contribution.',
        safer: 'Name the scope, team size, and your exact contribution.',
    },
    {
        pattern: /\b(?:certified|licensed|degree|award|publication|patent)\b/ig,
        role: 'Credential claim',
        level: 'high',
        risk: 'Credential words matter because they are usually externally verifiable.',
        safer: 'Attach issuer, date, certificate ID, publication link, or source document.',
    },
    {
        pattern: /\b(?:Java|Spring Boot|Spring Data JPA|Hibernate|REST APIs?|SQL|MySQL|PostgreSQL|GitHub?|Postman|Selenium|Playwright|JUnit|TestNG|Docker|JWT|Spring Security|HTML|CSS|JavaScript|CI\/CD)\b/ig,
        role: 'Technical skill claim',
        level: 'medium',
        risk: 'Tool and technology names imply practical ability. They should connect to projects, work history, or demonstrable usage.',
        safer: 'Keep the skill and show where it was used: project, repo, test suite, endpoint, database, or deployment.',
    },
    {
        pattern: /\b(?:basic knowledge|basic experience|understanding of|familiarity with|knowledge of|comfortable working with|strong understanding)\b/ig,
        role: 'Skill-depth qualifier',
        level: 'medium',
        risk: 'Skill-depth wording is useful, but vague unless the evidence shows the actual level.',
        safer: 'Pair the level with a concrete example, course, project, internship task, or repo.',
    },
    {
        pattern: /\b(?:motivated|fast learner|detail-oriented|responsible|good communication skills|problem-solving mindset|willingness to learn|friendly|supportive)\b/ig,
        role: 'Soft-skill claim',
        level: 'medium',
        risk: 'Soft skills are easy to claim and hard to verify without examples.',
        safer: 'Support it with a situation, feedback, deadline, team responsibility, or result.',
    },
    {
        pattern: /\b(?:develop(?:ed)?|maintain(?:ed)?|create(?:d)?|update(?:d)?|fix(?:ed)?|improve(?:d)?|write|test(?:ed)?|debug|communicate|participate(?:d)?|implemented|verified|worked with|created automated|built)\b/ig,
        role: 'Responsibility/action claim',
        level: 'medium',
        risk: 'Action verbs claim contribution. The reviewer needs scope, ownership, and outcome.',
        safer: 'Add what you built or tested, with scale, feature, tool, or measurable result.',
    },
    {
        pattern: /\b(?:real projects?|real project experience|mentorship|career growth|paid training|learning resources|hybrid work environment|full-time|entry-level|junior)\b/ig,
        role: 'Job-offer promise',
        level: 'low',
        risk: 'Offer and role terms set expectations. They matter when comparing candidate fit.',
        safer: 'Keep offer terms precise and consistent with job title, level, and employment conditions.',
    },
    {
        pattern: /\b(?:Bachelor of Computer Science|Computer Science student|Georgian Technical University|2023\s?[–-]\s?Present|June 2025\s?[–-]\s?September 2025|Intern)\b/ig,
        role: 'Education/experience record',
        level: 'high',
        risk: 'Dates, institutions, and internships are externally checkable facts.',
        safer: 'Verify dates, organization names, enrollment status, and internship responsibilities.',
    },
    {
        pattern: /\b(?:Junior Java Developer|QA Automation Engineer|Software Tester Intern|backend development team|project managers|frontend developers|testers)\b/ig,
        role: 'Role/position claim',
        level: 'medium',
        risk: 'Role titles frame seniority and fit. They should match actual experience and responsibilities.',
        safer: 'Use the title exactly as listed in the job, internship, or project context.',
    },
    {
        pattern: /\b(?:Tbilisi|Georgia|Georgian|English|Russian|Native|Fluent|Conversational|Hybrid|Full-time)\b/ig,
        role: 'Context/profile fact',
        level: 'low',
        risk: 'Location, language, and work-mode facts are usually not risky, but still affect fit.',
        safer: 'Keep context facts accurate and consistent across CV, application, and profile links.',
    },
    {
        pattern: /\b(?:\+?\d[\d\s()-]{7,}|[\w.-]+@[\w.-]+\.\w+|linkedin\.com\/[^\s]+|github\.com\/[^\s]+)\b/ig,
        role: 'Contact/profile evidence',
        level: 'low',
        risk: 'Contact and profile links are not achievement claims, but they should be valid and relevant.',
        safer: 'Ensure the email, phone, LinkedIn, and GitHub links are real and match the candidate.',
    },
    {
        pattern: /\b(?:\d{1,3}(?:,\d{3})?\s?[–-]\s?\d{1,3}(?:,\d{3})?\s?GEL|GEL net per month|depending on skills|interview results)\b/ig,
        role: 'Compensation claim',
        level: 'high',
        risk: 'Salary ranges and conditions are concrete terms that should be clear and not misleading.',
        safer: 'Keep currency, net/gross status, range, and dependency conditions explicit.',
    },
    {
        pattern: /\b(?:Online Shop Backend|Booking Website QA Testing Project|Token-Based Authorization System|product, user, and order management|role-based access control|test cases|bug reports)\b/ig,
        role: 'Project evidence claim',
        level: 'high',
        risk: 'Project descriptions are evidence anchors. They should be backed by code, tests, docs, or demos.',
        safer: 'Link the repository or describe exact endpoints, entities, tests, and your contribution.',
    },
    {
        pattern: /\b(?:Junior|Junior Developer|Junior QA Engineer|Junior Java Developer|Mid-level|Mid-level Developer|Middle Developer|Middle QA Engineer|Senior|Senior Developer|Senior QA Engineer|Senior Software Engineer|Lead|Team Lead|Technical Lead|Lead Developer|Principal|Principal Engineer|Staff Engineer|Staff Software Engineer|Intern|Software Intern|QA Intern|Entry-level|Entry-level Developer|Associate|Associate Engineer|Trainee|Graduate Trainee|Specialist|QA Specialist|Security Specialist|Manager|Engineering Manager|Project Manager|Product Manager|Head of|Head of Engineering|Head of QA|Architect|Software Architect|Solution Architect|Cloud Architect|Data Architect|Enterprise Architect)\b/ig,
        role: 'SENIORITY_CLAIM',
        level: 'high',
        risk: 'Seniority titles set expectations for independence, ownership, leadership, and evidence depth.',
        safer: 'Match the title to years, responsibilities, team scope, architecture decisions, projects, and outcomes.',
    },
    {
        pattern: /\b(?:Python|TypeScript|C#|C\+\+|Go|Golang|Rust|PHP|Ruby|Kotlin|Swift|Dart|Scala|MATLAB|Bash|PowerShell|GraphQL|ASP\.NET Core|Entity Framework|Django|Flask|FastAPI|Node\.js|Express\.js|NestJS|React|Next\.js|Vue\.js|Nuxt|Angular|Svelte|Tailwind CSS|Bootstrap|Material UI|Redux|Zustand|RxJS|Laravel|Symfony|Ruby on Rails|Flutter|React Native|Android SDK|iOS SDK|TensorFlow|PyTorch|scikit-learn|Pandas|NumPy|OpenCV|LangChain|Hugging Face|Cypress|Mockito|RestAssured|Swagger|OpenAPI|Allure Reports|JMeter|Gatling|k6)\b/ig,
        role: 'TECH_SKILL_CLAIM',
        level: 'medium',
        risk: 'Technology names imply usable skill. Depth varies widely and should be tied to real tasks.',
        safer: 'Show where the tool was used: repo, project, endpoint, test suite, deployment, report, or coursework.',
    },
    {
        pattern: /\b(?:SQL Server|Oracle Database|SQLite|MongoDB|Redis|Elasticsearch|Cassandra|DynamoDB|Firebase Firestore|Supabase|Prisma|Liquibase|Flyway|Kafka|RabbitMQ|Spark|Airflow|dbt|Snowflake|BigQuery|Redshift)\b/ig,
        role: 'TECH_SKILL_CLAIM',
        level: 'high',
        risk: 'Data, messaging, and infrastructure tools often imply system complexity or production exposure.',
        safer: 'Add schema, query, pipeline, topic, dashboard, migration, benchmark, or architecture evidence.',
    },
    {
        pattern: /\b(?:AWS|Azure|Google Cloud|GCP|Docker Compose|Kubernetes|Helm|Terraform|Ansible|Jenkins|GitHub Actions|GitLab CI|Azure DevOps|CircleCI|Travis CI|Nginx|Apache HTTP Server|Linux|Ubuntu|Bash scripting|Monitoring|Prometheus|Grafana|ELK Stack|Sentry|Datadog|Cloudflare|Vercel|Netlify|Render|Heroku|Railway|Clever Cloud|DigitalOcean)\b/ig,
        role: 'TECH_SKILL_CLAIM',
        level: 'high',
        risk: 'Cloud and DevOps claims can imply deployment, ownership, reliability, and operational responsibility.',
        safer: 'Name exact services, configs, workflows, dashboards, deployment links, or environment scope.',
    },
    {
        pattern: /\b(?:OAuth2|OpenID Connect|RBAC|Encryption|Hashing|bcrypt|HTTPS|TLS|OWASP Top 10|Penetration testing|Vulnerability scanning|Burp Suite|SonarQube|SAST|DAST|Dependency scanning|Secrets management|HashiCorp Vault)\b/ig,
        role: 'SECURITY_CLAIM',
        level: 'high',
        risk: 'Security claims are high-trust and can be misleading without implementation or audit evidence.',
        safer: 'Add auth flow, permission model, tool report, certificate, legal scope, or code reference.',
    },
    {
        pattern: /\b(?:Beginner knowledge|Introductory knowledge|Some experience with|Exposure to|Working knowledge of|Practical knowledge of|Practical experience with|Hands-on experience with|Commercial experience with|Production experience with|Professional experience with|Deep understanding of|Solid understanding of|Good knowledge of|Excellent knowledge of|Advanced knowledge of|Proficient in|Highly proficient in|Expert in|Specialist in|Experienced in|Skilled in|Comfortable with|Able to work with|Capable of|Confident in|Mastery of|Strong command of|End-to-end experience|Full lifecycle experience|Cross-functional experience|Enterprise-level experience|Real-world experience|Industry experience)\b/ig,
        role: 'SKILL_DEPTH_CLAIM',
        level: 'high',
        risk: 'Skill-depth phrases change how strongly a reader trusts the claim.',
        safer: 'Use the weakest accurate level and add project, date, task, repo, work context, or measurable proof.',
    },
    {
        pattern: /\b(?:Built from scratch|Architected|Co-led|Designed|Automated|Migrated|Refactored|Reviewed|Mentored|Trained|Coordinated|Collaborated|Supported|Troubleshot|Resolved|Analyzed|Researched|Planned|Prioritized|Monitored|Documented|Validated|Audited|Assessed|Investigated|Launched|Released|Shipped|Scaled|Secured|Configured|Set up|Established|Standardized|Streamlined)\b/ig,
        role: 'LEADERSHIP_CLAIM',
        level: 'high',
        risk: 'Responsibility verbs can overstate ownership, leadership, production maturity, or technical scope.',
        safer: 'State exact responsibility, supervision level, team size, artifact, before/after, and final outcome.',
    },
    {
        pattern: /\b(?:Increased|Increased revenue|Increased conversion|Increased user engagement|Increased retention|Reduced|Reduced costs|Reduced bugs|Reduced latency|Reduced load time|Reduced manual work|Improved|Improved performance|Improved reliability|Improved security|Improved UX|Improved maintainability|Optimized database queries|Optimized API response time|Accelerated|Saved time|Saved money|Cut processing time|Boosted|Enhanced|Strengthened|Modernized|Transformed|Revolutionized|World-class|Best-in-class|High-performance|Robust|Secure|Reliable|Maintainable|User-friendly|Production-ready|Enterprise-ready)\b/ig,
        role: 'IMPACT_CLAIM',
        level: 'high',
        risk: 'Impact language implies measurable change or quality. It should not stand alone.',
        safer: 'Add baseline, metric, timeframe, benchmark, source, test method, or release evidence.',
    },
    {
        pattern: /\b(?:\d+(?:\.\d+)?%|\d+\+?\s*(?:years?|yrs?|months?|weeks?|users?|customers?|clients?|projects?|features?|APIs?|endpoints?|test cases?|bug reports?|tickets?|commits?|pull requests?|deployments?|releases?|microservices?|databases?|servers?|RPS|ms|seconds?|minutes?)|team of \d+|managed \d+|\d+\+?\s*(?:GEL|USD|EUR)|\$[\d,]+|€[\d,]+|₾[\d,]+|\d+k\b|\d+M\b|\d+x\b|\d+ times faster|under \d+ ms|99\.9% uptime|24\/7|7 days a week|up to \d+%|starting from\b.*\d+|\d+[-–]\d+\s*(?:GEL|USD|EUR))\b/ig,
        role: 'QUANTIFIED_CLAIM',
        level: 'high',
        risk: 'Numbers look factual and require a source, calculation, timeframe, or benchmark.',
        safer: 'Add exact source, before/after, formula, date range, logs, analytics, transcript, or salary terms.',
    },
    {
        pattern: /\b(?:Quick learner|Highly motivated|Team player|Strong team player|Leadership skills|Excellent communication skills|Strong problem-solving skills|Works independently|Proactive|Self-starter|Adaptable|Flexible|Organized|Creative|Analytical|Critical thinker|Strategic thinker|Growth mindset|Passionate|Hardworking|Dedicated|Disciplined|Results-driven|Customer-focused|Ownership mindset|High attention to detail|Works well under pressure|Time management|Conflict resolution|Negotiation skills|Presentation skills|Mentoring mindset|Positive attitude|Professional attitude)\b/ig,
        role: 'VAGUE_CLAIM',
        level: 'medium',
        risk: 'Soft-skill phrases are common but subjective without a concrete situation.',
        safer: 'Support with a story, deadline, defect found, documentation, team interaction, or delivered result.',
    },
    {
        pattern: /\b(?:Bachelor|Bachelor’s degree|BSc|BA|Master|Master’s degree|MSc|MBA|PhD|Diploma|Certification|Bootcamp|University|College|Online course|GPA|GPA 4\.0|Honors|Scholarship|Erasmus|Exchange student|Dean’s List|Graduated|Currently studying|Expected graduation|Completed course|Coursera|Udemy|edX|AWS Certified|Azure Certified|Google Cloud Certified|ISTQB|Scrum Master|PMP)\b/ig,
        role: 'CREDENTIAL_CLAIM',
        level: 'high',
        risk: 'Education and credential claims are externally verifiable and should be precise.',
        safer: 'Add issuer, institution, date, credential ID, transcript, certificate link, or expected graduation date.',
    },
    {
        pattern: /\b(?:Internship|Full-time|Part-time|Freelance|Contract|Remote|On-site|Temporary|Seasonal|Volunteer|Promoted|Hired|Onboarded|Trained employees|Supervised|Reported to|Worked with clients|Stakeholder management|Cross-functional team|Agile team|Scrum|Kanban|Jira|Daily standups|Sprint planning|Code reviews|Pull requests|Production support|On-call|Release management|Incident response|Customer support|Technical support|Manual testing|Automation testing|Regression testing|Integration testing|Functional testing|API testing|Performance testing|Load testing|Security testing)\b/ig,
        role: 'WORK_EXPERIENCE_CLAIM',
        level: 'medium',
        risk: 'Work-experience phrases imply role scope, process exposure, and sometimes production responsibility.',
        safer: 'Add company, dates, hours, system scope, tools, reports, tickets, releases, or team context.',
    },
    {
        pattern: /\b(?:GitLab|Bitbucket|Personal website|Live demo|Deployed project|Production environment|README|API documentation|Test plan|Test strategy|Checklist|Defect reports|Jira tickets|Trello board|Screenshots|Video demo|Case study|Architecture diagram|ER diagram|Database schema|Migrations|Seed data|API endpoints|Authentication flow|Authorization roles|CI\/CD pipeline|Dockerfile|docker-compose\.yml|Kubernetes manifests|Environment variables|\.env\.example|Logs|Monitoring dashboard|Analytics|Benchmark|Load test report|Coverage report|Release notes|Changelog|Version tag|Commit history|Pull request|Code review|Issue tracker|License file|NPM package|Maven package|PyPI package|App Store|Google Play)\b/ig,
        role: 'EVIDENCE_FIELD',
        level: 'medium',
        risk: 'Evidence fields help prove technical claims, but links/artifacts should be real and consistent.',
        safer: 'Check the link or artifact and connect it to the exact claim being made.',
    },
    {
        pattern: /\b(?:E-mail|Mobile|Website|Remote availability|Languages|English\s?[–-]\s?(?:Fluent|B2|C1)|Georgian\s?[–-]\s?Native|Russian\s?[–-]\s?Conversational|Spanish\s?[–-]\s?Intermediate|Citizenship|Work permit|Visa sponsorship|Relocation|Availability|Notice period|Open to work|Salary expectation|References|Date of birth|Marital status|Photo)\b/ig,
        role: 'CONTACT_FIELD',
        level: 'low',
        risk: 'Profile/contact fields affect hiring context and may include sensitive or verifiable data.',
        safer: 'Validate links and formats; avoid sensitive personal fields unless legally required.',
    },
    {
        pattern: /\b(?:Growth opportunities|Training provided|Hands-on projects|Flexible schedule|Flexible hours|Remote work|Work from anywhere|Competitive salary|Attractive salary|Salary negotiable|Benefits|Full benefits package|Health insurance|Paid vacation|Paid leave|Bonus|Annual bonus|Performance bonus|Stock options|Equity|Relocation support|Modern office|Free snacks|Team events|Learning budget|Conference budget|Certification support|Equipment provided|Laptop provided|Paid internship|Unpaid internship|Trial period|Probation period|Fast-paced environment|Dynamic environment|Startup culture|Work-life balance|No overtime|Occasional overtime|International team|Global company|Industry leader|Cutting-edge technology|Latest technologies|Real impact)\b/ig,
        role: 'JOB_PROMISE',
        level: 'high',
        risk: 'Job-posting promises affect candidate expectations and should be concrete.',
        safer: 'Add salary range, net/gross, policy, schedule, eligibility, office days, budget amount, or benefit details.',
    },
    {
        pattern: /\b(?:junior\b.*\bexpert|entry[- ]level\b.*\b5\+?\s*years|intern\b.*\bowned|senior\b.*\bbasic knowledge|lead\b.*\bteam of \d+|head of\b.*\bdepartment|production experience\b.*(?:no work|no project)|production\b(?!.*(?:company|link|users?|deployment)))\b/ig,
        role: 'POSSIBLE_MISMATCH',
        level: 'high',
        risk: 'This phrase combination may contradict expected seniority, experience, or evidence level.',
        safer: 'Clarify true level, reduce exaggerated wording, or add direct evidence for the stronger claim.',
    },
];

function ProfilingModePanel({ audit, verdicts, setRoute }) {
    const rows = (verdicts || []).map((verdict) => ({
        verdict,
        matches: profileSentence(verdict.sentence || ''),
        severity: profileSeverity(verdict),
    }));
    const activeRows = rows.filter((row) => row.matches.length > 0 || isProblemVerdict(row.verdict));
    const hotPhraseCount = rows.reduce((count, row) => count + row.matches.length, 0);
    const templateName = audit?.templateName || 'Selected template';
    const stateName = audit?.checkStateName || 'Default state';

    return (
        <section className="profilingPanel">
            <div className="profilingHead">
                <div>
                    <span className="eyebrow">Profiling mode</span>
                    <h2>Forensic language layer</h2>
                    <p>Hover or focus highlighted phrases to see their role, risk, and why the current template/state cares.</p>
                </div>
                <div className="profilingStats">
                    <Metric label="Hot phrases" value={hotPhraseCount} />
                    <Metric label="Profiled claims" value={activeRows.length} />
                    {audit?.id && setRoute && (
                        <button className="primary" onClick={() => navigateTo(setRoute, 'auditProfile', audit.id)}>
                            <FileSearch size={16} /> Open profiling mode
                        </button>
                    )}
                </div>
            </div>
            <div className="profilingContext">
                <span>{templateName}</span>
                <span>{stateName}</span>
                <span>Evidence pressure: unsupported confidence is treated as risk, not style.</span>
            </div>
            <div className="profiledDocument preview">
                {activeRows.length === 0 && <div className="emptyState">No profile hotspots found in this audit.</div>}
                {activeRows.slice(0, 3).map(({ verdict, matches, severity }) => (
                    <article className={`profileSentenceCard ${severity}`} key={verdict.id || verdict.sentenceIndex}>
                        <div className="profileSentenceMeta">
                            <span className={`statusPill ${verdict.status.toLowerCase().replaceAll('_', '-')}`}>{verdict.status}</span>
                            <small>{verdictSeverity(verdict)} / sentence {verdict.sentenceIndex + 1}</small>
                        </div>
                        <p className="profileSentenceText">
                            {renderProfiledSentence(verdict.sentence, matches, verdict, templateName, stateName)}
                        </p>
                        <small>{profileSentenceSummary(verdict, matches)}</small>
                    </article>
                ))}
            </div>
        </section>
    );
}

function ProfilingModePage({ setRoute, user, userToken, setUser, setUserToken, audit, loading, error }) {
    const verdicts = audit?.verdicts || [];
    const profiledText = buildProfiledText(audit?.claimText || verdicts.map((verdict) => verdict.sentence).join('\n'), verdicts, audit);
    const [activeProfile, setActiveProfile] = useState(null);
    const [inspectorWidth, setInspectorWidth] = useState(420);
    const [resizingInspector, setResizingInspector] = useState(false);
    const profileLayoutRef = useRef(null);
    const inspectorOpen = Boolean(activeProfile);

    useEffect(() => {
        if (!resizingInspector) {
            return undefined;
        }
        function resize(event) {
            const rect = profileLayoutRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }
            const pointerX = event.touches?.[0]?.clientX ?? event.clientX;
            const maxWidth = Math.min(720, rect.width * 0.62);
            const nextWidth = Math.min(maxWidth, Math.max(320, rect.right - pointerX));
            setInspectorWidth(nextWidth);
        }
        function stopResize() {
            setResizingInspector(false);
        }
        window.addEventListener('pointermove', resize);
        window.addEventListener('pointerup', stopResize);
        return () => {
            window.removeEventListener('pointermove', resize);
            window.removeEventListener('pointerup', stopResize);
        };
    }, [resizingInspector]);

    return (
        <div className="shell profileShell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="profileModePage contentFadeIn">
                <section className="profileModeTopbar">
                    <button className="ghost" disabled={!audit?.id} onClick={() => navigateTo(setRoute, 'auditDetail', audit.id)}>Back to audit</button>
                    <div>
                        <span className="eyebrow">Profiling mode</span>
                        <h1>{audit?.claimTitle || 'Forensic language profile'}</h1>
                        <p>{audit?.templateName || 'Selected template'} / {audit?.checkStateName || 'Default state'} / click highlighted text to inspect it.</p>
                    </div>
                    {audit?.id && <ExportActions auditId={audit.id} />}
                </section>
                {error && <div className="error">{error}</div>}
                {loading && <><Loading stage="LOADING PROFILING MODE" /><SkeletonBlock rows={8} /></>}
                {!loading && !audit && <div className="emptyState">Profiling mode needs an audit record.</div>}
                {audit && (
                    <section ref={profileLayoutRef} className={`profileModeLayout ${inspectorOpen ? 'inspectorOpen' : ''} ${resizingInspector ? 'resizing' : ''}`}>
                        <article className="profileDocumentSheet">
                            <div className="profileDocumentHead">
                                <span>Candidate CV</span>
                                <strong>{audit.claimTitle}</strong>
                            </div>
                            <div className="profileDocumentText">
                                {renderProfiledFullText(profiledText, activeProfile, setActiveProfile)}
                            </div>
                        </article>
                        <div
                            className="profileResizeHandle"
                            aria-hidden={!inspectorOpen}
                            onPointerDown={(event) => {
                                if (!inspectorOpen) {
                                    return;
                                }
                                event.preventDefault();
                                setResizingInspector(true);
                            }}
                        />
                        <ProfileInspector audit={audit} activeProfile={activeProfile} onClose={() => setActiveProfile(null)} width={inspectorWidth} />
                    </section>
                )}
            </main>
        </div>
    );
}

function profileSentence(sentence) {
    const matches = [];
    profilingPhraseRules.forEach((rule) => {
        const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match = pattern.exec(sentence);
        while (match) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length,
                role: rule.role,
                level: rule.level,
                risk: rule.risk,
                safer: rule.safer,
            });
            match = pattern.exec(sentence);
        }
    });
    return matches
        .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
        .filter((match, index, all) => !all.some((other, otherIndex) => otherIndex < index && other.start <= match.start && other.end >= match.end));
}

function renderProfiledSentence(sentence, matches, verdict, templateName, stateName) {
    if (!matches.length) {
        return sentence;
    }
    const parts = [];
    let cursor = 0;
    matches.forEach((match, index) => {
        if (match.start > cursor) {
            parts.push(sentence.slice(cursor, match.start));
        }
        parts.push(
            <span className={`profileHotspot ${match.level}`} tabIndex={0} key={`${match.text}-${match.start}-${index}`}>
        {sentence.slice(match.start, match.end)}
                <span className="profileTooltip" role="tooltip">
          <b>{match.role}</b>
          <span>{match.risk}</span>
          <span>{templateName} + {stateName}: {profileStatePressure(verdict)}</span>
          <em>{match.safer}</em>
        </span>
      </span>
        );
        cursor = match.end;
    });
    if (cursor < sentence.length) {
        parts.push(sentence.slice(cursor));
    }
    return parts;
}

function buildProfiledText(text, verdicts, audit) {
    const matches = profileSentence(text || '').map((match) => {
        const verdict = nearestVerdictForMatch(text, match, verdicts) || fallbackProfileVerdict(text, match);
        return {
            ...match,
            payload: profileInspectorPayload(match, verdict, audit),
            severity: profileSeverity(verdict),
        };
    });
    return { text: text || '', matches };
}

function renderProfiledFullText(profiledText, activeProfile, setActiveProfile) {
    const { text, matches } = profiledText;
    const parts = [];
    let cursor = 0;
    matches.forEach((match) => {
        const active = activeProfile?.key === match.payload.key;
        if (match.start > cursor) {
            parts.push(...renderPlainProfileText(text.slice(cursor, match.start), `plain-${cursor}`));
        }
        parts.push(
            <button
                className={`profileWordMark ${match.level} ${active ? 'active' : ''}`}
                key={match.payload.key}
                onClick={() => setActiveProfile(match.payload)}
            >
                {text.slice(match.start, match.end)}
                <span className="profileMiniTooltip">{miniProfileText(match.payload)}</span>
            </button>
        );
        cursor = match.end;
    });
    if (cursor < text.length) {
        parts.push(...renderPlainProfileText(text.slice(cursor), `plain-${cursor}`));
    }
    return parts;
}

function renderPlainProfileText(value, keyPrefix) {
    return value.split(/(\n+)/).map((part, index) => {
        if (/^\n+$/.test(part)) {
            return <br key={`${keyPrefix}-br-${index}`} />;
        }
        return part;
    });
}

function nearestVerdictForMatch(text, match, verdicts) {
    const lower = (text || '').toLowerCase();
    return (verdicts || []).find((verdict) => {
        const sentence = (verdict.sentence || '').toLowerCase().trim();
        return sentence && lower.includes(sentence) && match.start >= lower.indexOf(sentence) && match.start <= lower.indexOf(sentence) + sentence.length;
    }) || (verdicts || []).find((verdict) => (verdict.sentence || '').toLowerCase().includes(match.text.toLowerCase()));
}

function fallbackProfileVerdict(text, match) {
    return {
        id: `text-${match.start}`,
        sentenceIndex: 0,
        sentence: surroundingText(text, match.start, match.end),
        status: match.level === 'high' ? 'UNSUPPORTED' : 'STRETCHED',
        confidence: match.level === 'high' ? 'HIGH' : 'MEDIUM',
        explanation: 'This phrase is profiled from the full document text even when it does not map cleanly to a saved verdict sentence.',
        evidencePointer: 'Open the verdict table for exact evidence mapping.',
    };
}

function surroundingText(text, start, end) {
    const before = text.lastIndexOf('.', start);
    const after = text.indexOf('.', end);
    return text.slice(before >= 0 ? before + 1 : 0, after >= 0 ? after + 1 : text.length).trim();
}

function miniProfileText(profile) {
    if (profile.status === 'SUPPORTED') {
        return `${profile.role}: supported by evidence.`;
    }
    if (profile.status === 'UNSUPPORTED') {
        return `${profile.role}: needs proof.`;
    }
    if (profile.status === 'GAP') {
        return `${profile.role}: evidence gap.`;
    }
    return `${profile.role}: wording may be too strong.`;
}

function profileInspectorPayload(match, verdict, audit) {
    return {
        key: `${verdict.id || verdict.sentenceIndex}-${match.start}-${match.text}`,
        phrase: match.text,
        role: match.role,
        level: match.level,
        risk: match.risk,
        safer: match.safer,
        status: verdict.status,
        confidence: verdict.confidence,
        sentence: verdict.sentence,
        explanation: verdict.explanation,
        evidencePointer: verdict.evidencePointer,
        severity: verdictSeverity(verdict),
        statePressure: profileStatePressure(verdict),
        templateName: audit?.templateName || 'Selected template',
        stateName: audit?.checkStateName || 'Default state',
    };
}

function ProfileInspector({ audit, activeProfile, onClose, width }) {
    return (
        <aside className={`profileInspector ${activeProfile ? 'open' : ''}`} style={{ '--inspector-width': `${width}px` }}>
            <div className="profileInspectorHead">
                <div>
                    <span className="eyebrow">Inspector</span>
                    <h2>{activeProfile?.phrase || 'Select a highlight'}</h2>
                </div>
                <button className="ghost inspectorClose" onClick={onClose} aria-label="Close inspector"><X size={16} /> Close</button>
            </div>
            {!activeProfile ? (
                <div className="emptyState">Hover or click a highlighted phrase in the document to open its analysis here.</div>
            ) : (
                <>
                    <div className="inspectorGrid">
                        <Metric label="Role" value={activeProfile.role} />
                        <Metric label="Risk" value={activeProfile.severity} />
                        <Metric label="Verdict" value={activeProfile.status} />
                        <Metric label="Confidence" value={activeProfile.confidence} />
                    </div>
                    <section>
                        <h3>Why this matters</h3>
                        <p>{activeProfile.risk}</p>
                    </section>
                    <section>
                        <h3>Template/state pressure</h3>
                        <p>{activeProfile.templateName} + {activeProfile.stateName}: {activeProfile.statePressure}</p>
                    </section>
                    <section>
                        <h3>Safer wording</h3>
                        <p>{activeProfile.safer}</p>
                    </section>
                    <section>
                        <h3>Sentence</h3>
                        <p>{activeProfile.sentence}</p>
                    </section>
                    <section>
                        <h3>Evidence pointer</h3>
                        <p>{activeProfile.evidencePointer || 'No evidence pointer available.'}</p>
                    </section>
                    <section>
                        <h3>Audit explanation</h3>
                        <p>{activeProfile.explanation}</p>
                    </section>
                </>
            )}
            <div className="profileInspectorFooter">
                <span>{audit?.engine || 'Engine unknown'}</span>
                <span>{audit?.analyzerVersion || 'Analyzer unknown'}</span>
            </div>
        </aside>
    );
}

function profileStatePressure(verdict) {
    if (verdict.status === 'SUPPORTED') {
        return 'this phrase is acceptable because evidence currently supports the claim.';
    }
    if (verdict.status === 'STRETCHED') {
        return 'this phrase may be too strong for the evidence available.';
    }
    if (verdict.status === 'UNSUPPORTED') {
        return 'this phrase needs proof before it can be trusted.';
    }
    if (verdict.status === 'GAP') {
        return 'this phrase exposes a missing requirement or unanswered evidence gap.';
    }
    return 'this phrase is read as context unless it makes a verifiable claim.';
}

function profileSeverity(verdict) {
    if (verdict.status === 'UNSUPPORTED' || verdict.status === 'GAP') {
        return 'high';
    }
    if (verdict.status === 'STRETCHED') {
        return 'medium';
    }
    return 'low';
}

function profileSentenceSummary(verdict, matches) {
    if (matches.length > 0) {
        return `${matches.length} profiled phrase${matches.length === 1 ? '' : 's'} found. ${verdict.explanation}`;
    }
    if (isProblemVerdict(verdict)) {
        return `No specific hotspot, but the sentence is still profiled because the verdict is ${verdict.status}. ${verdict.explanation}`;
    }
    return verdict.explanation;
}

function SuspiciousWordsPanel({ text }) {
    const lower = (text || '').toLowerCase();
    const hits = suspiciousWordRules
        .map(([word, risk, safer]) => ({ word, risk, safer, count: countWord(lower, word) }))
        .filter((item) => item.count > 0);
    if (hits.length === 0) {
        return (
            <section className="suspiciousPanel">
                <div>
                    <span className="eyebrow">Suspicious words</span>
                    <h2>No risky wording detected</h2>
                </div>
                <p>Current claim language avoids the most common inflated terms.</p>
            </section>
        );
    }
    return (
        <section className="suspiciousPanel">
            <div>
                <span className="eyebrow">Suspicious words</span>
                <h2>Risky wording found</h2>
            </div>
            <div className="suspiciousGrid">
                {hits.map((item) => (
                    <article key={item.word}>
                        <strong>{item.word}</strong>
                        <span>{item.count} match{item.count === 1 ? '' : 'es'}</span>
                        <p>{item.risk}</p>
                        <small>{item.safer}</small>
                    </article>
                ))}
            </div>
        </section>
    );
}

function RewriteSuggestions({ verdicts }) {
    const suggestions = (verdicts || [])
        .filter((verdict) => ['STRETCHED', 'UNSUPPORTED'].includes(verdict.status))
        .map((verdict) => ({
            id: verdict.id || verdict.sentenceIndex,
            status: verdict.status,
            original: verdict.sentence,
            replacement: saferRewrite(verdict),
            reason: verdict.explanation,
        }));
    if (suggestions.length === 0) {
        return (
            <section className="rewritePanel">
                <div>
                    <span className="eyebrow">Rewrite suggestions</span>
                    <h2>No rewrites needed</h2>
                </div>
                <p>There are no stretched or unsupported claims in the current verdict set.</p>
            </section>
        );
    }
    return (
        <section className="rewritePanel">
            <div>
                <span className="eyebrow">Rewrite suggestions</span>
                <h2>Safer replacement wording</h2>
            </div>
            <div className="rewriteList">
                {suggestions.map((suggestion) => (
                    <article key={suggestion.id}>
                        <span className={`statusPill ${suggestion.status.toLowerCase()}`}>{suggestion.status}</span>
                        <p><b>Original:</b> {suggestion.original}</p>
                        <p><b>Safer:</b> {suggestion.replacement}</p>
                        <small>{suggestion.reason}</small>
                    </article>
                ))}
            </div>
        </section>
    );
}

function saferRewrite(verdict) {
    const sentence = verdict.sentence.replace(/\.$/, '');
    if (verdict.status === 'UNSUPPORTED') {
        return `Evidence does not currently verify: ${softenInflatedWords(sentence)}.`;
    }
    return `${softenInflatedWords(sentence)} based on the available evidence.`;
}

function softenInflatedWords(sentence) {
    return sentence
        .replace(/\b[Ee]xpert in\b/g, 'Experience with')
        .replace(/\b[Ll]ed\b/g, 'Contributed to')
        .replace(/\b[Oo]ptimized\b/g, 'Worked on improving')
        .replace(/\b[Pp]roven\b/g, 'Documented')
        .replace(/\b[Aa]dvanced\b/g, 'Specific');
}

function countWord(text, word) {
    const matches = text.match(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g'));
    return matches ? matches.length : 0;
}

function evidenceKeywords(verdicts) {
    const words = verdicts.flatMap((verdict) => `${verdict.sentence} ${verdict.evidencePointer || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length >= 5));
    return [...new Set(words)].slice(0, 30);
}

function matchScore(text, keywords) {
    const lower = text.toLowerCase();
    return keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0);
}

function highlightText(text, keywords) {
    const sorted = keywords.filter(Boolean).sort((a, b) => b.length - a.length);
    if (sorted.length === 0) {
        return text;
    }
    const pattern = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'ig');
    return text.split(pattern).map((part, index) => (
        sorted.some((keyword) => part.toLowerCase() === keyword.toLowerCase())
            ? <mark key={`${part}-${index}`}>{part}</mark>
            : part
    ));
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function FilterGroup({ label, filters, value, onChange }) {
    return (
        <div className="filterGroup">
            <span>{label}</span>
            <div className="filterTabs">
                {filters.map((filter) => (
                    <button key={filter} className={value === filter ? 'active' : ''} onClick={() => onChange(filter)}>
                        {filter}
                    </button>
                ))}
            </div>
        </div>
    );
}

function verdictSeverity(verdict) {
    if (verdict.status === 'UNSUPPORTED' || verdict.status === 'GAP') {
        return 'HIGH RISK';
    }
    if (verdict.status === 'STRETCHED') {
        return 'MEDIUM RISK';
    }
    if (verdict.status === 'SUPPORTED' || verdict.status === 'NOT_A_CLAIM') {
        return 'LOW RISK';
    }
    return 'PROBLEM';
}

function isProblemVerdict(verdict) {
    return ['STRETCHED', 'UNSUPPORTED', 'GAP'].includes(verdict.status);
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : 'Unknown';
}

function shortHash(value) {
    return value ? `${value.slice(0, 8)}...` : 'None';
}

function AuditResult({ audit, setRoute }) {
    const problems = audit.verdicts.filter((v) => ['UNSUPPORTED', 'STRETCHED', 'GAP'].includes(v.status));
    return (
        <section className="results">
            <StickyAuditBar audit={audit} />
            <div className="scoreBlock">
                <Gauge size={26} />
                <div>
                    <span>Credibility Score</span>
                    <strong>{audit.credibilityScore}%</strong>
                </div>
                <div className="counts">
                    <b>{audit.supportedCount}</b> supported
                    <b>{audit.stretchedCount}</b> stretched
                    <b>{audit.unsupportedCount}</b> unsupported
                </div>
                <ExportActions auditId={audit.id} />
            </div>
            <AuditScoreExplainer audit={audit} />
            <DenseVerdictTable verdicts={audit.verdicts} />
            <div className="verdictGrid">
                {audit.verdicts.map((verdict) => <VerdictCard key={verdict.id || verdict.sentenceIndex} verdict={verdict} />)}
            </div>
            <SuspiciousWordsPanel text={audit.claimText || audit.verdicts.map((verdict) => verdict.sentence).join(' ')} />
            <ProfilingModePanel audit={audit} verdicts={audit.verdicts} setRoute={setRoute} />
            <RewriteSuggestions verdicts={audit.verdicts} />
            <div className="summaryStrip">
                <ShieldCheck size={18} />
                <span>Top risk count: {problems.length}. Status: {audit.status || 'COMPLETED'}. Engine: {audit.engine}. Analyzer: {audit.analyzerVersion || 'Unknown'}. Prompt: {audit.promptVersion || 'Unknown'}. Completed in {audit.processingMillis}ms.</span>
            </div>
        </section>
    );
}

function StickyAuditBar({ audit }) {
    if (!audit) {
        return null;
    }
    const level = auditScoreLevel(audit.credibilityScore);
    return (
        <div className="stickyAuditBar">
            <div>
                <span>Score</span>
                <strong>{audit.credibilityScore}%</strong>
            </div>
            <div><span>Level</span><b>{level}/10</b></div>
            <div><span>Supported</span><b>{audit.supportedCount}</b></div>
            <div><span>Stretched</span><b>{audit.stretchedCount}</b></div>
            <div><span>Unsupported</span><b>{audit.unsupportedCount}</b></div>
            <div><span>State</span><b>{audit.checkStateName || 'Default'}</b></div>
            <div><span>Engine</span><b>{audit.engine}</b></div>
            <ExportActions auditId={audit.id} />
        </div>
    );
}

function ExportActions({ auditId }) {
    const formats = [
        ['txt', 'TXT'],
        ['word', 'Word'],
        ['excel', 'Excel'],
        ['pdf', 'PDF'],
    ];
    return (
        <div className="exportActions" aria-label="Export audit formats">
            <span><Download size={15} /> Export</span>
            {formats.map(([format, label]) => (
                <button key={format} className={format === 'pdf' ? 'primaryExport' : ''} onClick={() => exportAudit(auditId, format)}>
                    {label}
                </button>
            ))}
        </div>
    );
}

async function exportAudit(id, format = 'txt') {
    const token = localStorage.getItem('verdictUserToken') || '';
    const response = await fetch(`/api/audit/${id}/export?format=${encodeURIComponent(format)}`, { headers: { 'X-User-Token': token } });
    if (!response.ok) {
        throw new Error('Export failed');
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(id, format, response.headers.get('Content-Disposition'));
    link.click();
    URL.revokeObjectURL(url);
}

function exportFilename(id, format, disposition) {
    const match = disposition?.match(/filename="?([^"]+)"?/i);
    if (match?.[1]) {
        return match[1];
    }
    const extensions = { txt: 'txt', word: 'doc', excel: 'csv', pdf: 'pdf' };
    return `verdict-audit-${id}.${extensions[format] || 'txt'}`;
}

function VerdictCard({ verdict }) {
    return (
        <article className={`verdict ${verdict.status.toLowerCase().replaceAll('_', '-')}`}>
            <div className="verdictTop">
                <span>{verdict.status}</span>
                <small>{verdict.confidence}</small>
            </div>
            <p className="sentence">{verdict.sentence}</p>
            <p>{verdict.explanation}</p>
            <code>{verdict.evidencePointer}</code>
        </article>
    );
}

function HistoryPanel({ history, templates, loading, openAudit }) {
    const [templateFilter, setTemplateFilter] = useState('ALL');
    const filteredHistory = filterAuditsByTemplate(history, templateFilter);
    const templateFilters = templateFilterOptions(history, templates);
    return (
        <section className="history">
            <h2><History size={18} /> My Audit History</h2>
            <TemplateLensBar filters={templateFilters} value={templateFilter} onChange={setTemplateFilter} />
            <div className="historyRows">
                {loading && <SkeletonBlock rows={5} compact />}
                {!loading && filteredHistory.length === 0 && <div className="emptyState">No audits match this template lens.</div>}
                {filteredHistory.map((item) => (
                    <button key={item.id} onClick={() => openAudit(item.id)}>
                        <span>#{item.id} {item.claimTitle} / {item.templateName || 'No template'}</span>
                        <strong>{item.credibilityScore}%</strong>
                    </button>
                ))}
            </div>
        </section>
    );
}

function TemplateLensBar({ filters, value, onChange }) {
    return (
        <div className="templateLensBar">
            {filters.map((filter) => (
                <button key={filter.id} className={value === filter.id ? 'active' : ''} onClick={() => onChange(filter.id)}>
                    {filter.name}
                </button>
            ))}
        </div>
    );
}

function templateFilterOptions(history, templates = []) {
    const used = new Map();
    history.forEach((audit) => {
        const id = audit.templateId || 'NO_TEMPLATE';
        used.set(id, audit.templateName || 'No template');
    });
    templates.forEach((template) => {
        if (used.has(template.id)) {
            used.set(template.id, template.name);
        }
    });
    return [
        { id: 'ALL', name: 'All templates' },
        ...Array.from(used.entries()).map(([id, name]) => ({ id, name })),
    ];
}

function filterAuditsByTemplate(history, templateFilter) {
    if (templateFilter === 'ALL') {
        return history;
    }
    if (templateFilter === 'NO_TEMPLATE') {
        return history.filter((audit) => !audit.templateId);
    }
    return history.filter((audit) => audit.templateId === templateFilter);
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

function AdminPanel({ setRoute }) {
    const pageSize = 20;
    const [token, setToken] = useState(localStorage.getItem('verdictAdminToken') || '');
    const [login, setLogin] = useState({ username: 'admin', password: '' });
    const [audits, setAudits] = useState([]);
    const [logs, setLogs] = useState([]);
    const [users, setUsers] = useState([]);
    const [settings, setSettings] = useState({ requireEmailVerification: false });
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
    const [userForm, setUserForm] = useState(emptyUserForm());
    const [adminLoading, setAdminLoading] = useState(false);
    const [error, setError] = useState('');

    async function signIn() {
        track('admin_login_clicked', 'admin_login', login.username);
        setError('');
        try {
            const result = await api.adminLogin(login);
            localStorage.setItem('verdictAdminToken', result.token);
            setToken(result.token);
        } catch (err) {
            setError(err.message);
        }
    }

    async function loadAdmin() {
        track('admin_refresh', 'admin_panel');
        setAdminLoading(true);
        try {
            const [auditRows, logRows, userRows, settingRows, clearTargetRows] = await Promise.all([
                api.adminAudits(token, auditOffset, pageSize, auditSearch),
                api.adminLogs(token, logOffset, pageSize, logSearch),
                api.adminUsers(token, userOffset, pageSize, userSearch),
                api.adminSettings(token),
                api.adminTableClearTargets(token),
            ]);
            setAudits(auditRows);
            setLogs(logRows);
            setUsers(userRows);
            setSettings(settingRows);
            setTableClearTargets(clearTargetRows);
        } finally {
            setAdminLoading(false);
        }
    }

    useEffect(() => {
        if (token) {
            loadAdmin().catch((err) => setError(err.message));
        }
    }, [token, auditOffset, userOffset, logOffset, auditSearch, userSearch, logSearch]);

    async function deleteAudit(id) {
        if (!window.confirm(`Delete audit #${id}?`)) {
            return;
        }
        track('admin_delete_audit', 'admin_panel', `auditId=${id}`);
        await api.deleteAudit(token, id);
        if (selectedAudit?.id === id) {
            setSelectedAudit(null);
        }
        await loadAdmin();
    }

    async function deleteLog(id) {
        if (!window.confirm(`Delete log #${id}?`)) {
            return;
        }
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

    async function deleteUser(id) {
        if (!window.confirm(`Delete user #${id}? This removes their account.`)) {
            return;
        }
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

    function toggleClearTarget(key) {
        setSelectedClearTargets((current) => current.includes(key)
            ? current.filter((item) => item !== key)
            : [...current, key]);
        setClearResults([]);
    }

    async function clearSelectedTables() {
        if (clearConfirmText !== 'CLEAR') {
            setError('Type CLEAR before clearing selected tables.');
            return;
        }
        if (!selectedClearTargets.length) {
            setError('Select at least one table group to clear.');
            return;
        }
        const labels = tableClearTargets
            .filter((target) => selectedClearTargets.includes(target.key))
            .map((target) => target.label)
            .join(', ');
        if (!window.confirm(`Clear all data for: ${labels}? This cannot be undone.`)) {
            return;
        }
        track('admin_clear_tables', 'admin_panel', selectedClearTargets.join(','));
        setError('');
        const results = await api.clearAdminTables(token, selectedClearTargets);
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
                    <Input label="Password" value={login.password} onChange={(password) => setLogin({ ...login, password })} />
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
                {error && <div className="error">{error}</div>}
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
                                <small>{target.key}</small>
                            </label>
                        ))}
                    </div>
                    <div className="tableClearConfirm">
                        <Input label="Type CLEAR to confirm" value={clearConfirmText} onChange={setClearConfirmText} />
                        <button
                            className="destructive"
                            disabled={!selectedClearTargets.length || clearConfirmText !== 'CLEAR'}
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
                                    <button className="destructive" onClick={() => deleteUser(user.id)}><Trash2 size={15} /> Delete</button>
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
                                <button className="destructive" onClick={() => deleteAudit(audit.id)}><Trash2 size={15} /> Delete</button>
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
                            <button className="destructive" onClick={() => deleteLog(log.id)}><Trash2 size={14} /> Delete</button>
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
        </div>
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

export default App;
