import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Activity, ArrowRight, ChevronDown, Gauge, History, LayoutDashboard, Lock, LogOut, Mail, Menu, RefreshCcw, User, UserPlus, X } from 'lucide-react';
import IntroAnimation from './IntroAnimation';
import { LanguageContext, translate, useLanguage } from './i18n';
import { apiMe, apiLogout, apiListMessages, apiListProjects, apiRealtimeUrl, apiUpdateNotificationPreferences, javaApi, normaliseProject, normaliseUser } from './api';
import { messageBelongsTo, readMessages } from './messageStore';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DialogKeyboardManager } from './components/DialogKeyboardManager';
import { GlobalCompose } from './components/GlobalCompose';
import { AuditDetailPage, ProfilingModePage } from './pages/AuditAnalysisPages';
import { AuditWorkspacePage } from './pages/AuditWorkspacePage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectRouteState } from './pages/projects/ProjectRouteState';
import { navigateTo, routeFromPath, scrollToPageTop } from './navigation';
import { formatUploadSize } from './utils/auditPresentation';
import { auditPayload, demoCase, demoCases, demoStates, demoTemplates, emptyTemplateForm } from './data/auditWorkspaceDefaults';
import { clearUserToken, readUserToken } from './sessionAuth';
import './styles.css';
import './styles/auth.css';
import './styles/reports.css';

const lazyNamed = (loader, name) => lazy(() => loader().then((module) => ({ default: module[name] })));
const HistoryPage = lazyNamed(() => import('./pages/HistoryPage'), 'HistoryPage');
const AuthPage = lazyNamed(() => import('./pages/AuthPage'), 'AuthPage');
const CandidateDetailPage = lazyNamed(() => import('./pages/projects/CandidateDetailPage'), 'CandidateDetailPage');
const CandidateMatchReportPage = lazyNamed(() => import('./pages/projects/CandidateMatchReportPage'), 'CandidateMatchReportPage');
const CandidateProfilePage = lazyNamed(() => import('./pages/projects/CandidateProfilePage'), 'CandidateProfilePage');
const HomePage = lazyNamed(() => import('./pages/HomePage'), 'HomePage');
const MessagesPage = lazyNamed(() => import('./pages/MessagesPage'), 'MessagesPage');
const ProfilePage = lazyNamed(() => import('./pages/ProfilePage'), 'ProfilePage');
const AdminPage = lazyNamed(() => import('./pages/AdminPage'), 'AdminPage');
const AddCandidatePage = lazyNamed(() => import('./pages/projects/AddCandidatePage'), 'AddCandidatePage');
const NewJobPage = lazyNamed(() => import('./pages/projects/NewJobPage'), 'NewJobPage');
const ProjectDetailPage = lazyNamed(() => import('./pages/projects/ProjectDetailPage'), 'ProjectDetailPage');
const ProjectSettingsPage = lazyNamed(() => import('./pages/projects/ProjectSettingsPage'), 'ProjectSettingsPage');
const ProjectTeamPage = lazyNamed(() => import('./pages/projects/ProjectTeamPage'), 'ProjectTeamPage');
const ProjectsPage = lazyNamed(() => import('./pages/projects/ProjectsPage'), 'ProjectsPage');
const SignalTracePage = lazyNamed(() => import('./pages/projects/SignalTracePage'), 'SignalTracePage');

const MAX_DOCUMENT_UPLOAD_BYTES = 8 * 1024 * 1024;
const PROJECT_DATA_ROUTES = new Set(['projectDetail', 'projectSettings', 'projectTeam', 'addCandidate', 'candidateDetail', 'candidateReport', 'candidateProfile', 'signalTrace']);

const api = {
    telemetry: async (payload) => fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
    }).catch(() => null),
    me: async (token) => {
        try { return normaliseUser(await apiMe(token)); } catch { return null; }
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

function Textarea({ value, onChange }) {
    return <textarea value={value || ''} onChange={(event) => onChange(event.target.value)} />;
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

function track(action, target = '', detail = '') {
    api.telemetry({ action, target, detail });
}

function shouldShowIntroOnBoot() {
    if (typeof window === 'undefined') return false;
    if (window.location.pathname !== '/') return false;
    return sessionStorage.getItem('verdictIntroSeen') !== 'true';
}

function App() {
    const { route, setRoute, detailAuditId, setDetailAuditId } = useRouteState(routeFromPath);
    const [userToken, setUserToken] = useState(readUserToken);
    const [user, setUser] = useState(null);
    const [form, setForm] = useState(demoCase);
    const [audit, setAudit] = useState(null);
    const [detailAudit, setDetailAudit] = useState(null);
    const [history, setHistory] = useState([]);
    const [templates, setTemplates] = useState([]);
    const [states, setStates] = useState([]);
    const [projects, setProjects] = useState([]);
    const [projectsLoading, setProjectsLoading] = useState(() => Boolean(userToken));
    const [templateForm, setTemplateForm] = useState(emptyTemplateForm(demoCase.auditMode));
    const [selectedDemoId, setSelectedDemoId] = useState(demoCases[0]?.id || '');
    const [demoConfirmOpen, setDemoConfirmOpen] = useState(false);
    const [demoCountdown, setDemoCountdown] = useState(3);
    const [loading, setLoading] = useState(false);
    const [detailLoading, setDetailLoading] = useState(() => Boolean(userToken && (route === 'auditDetail' || route === 'auditProfile')));
    const [historyLoading, setHistoryLoading] = useState(() => Boolean(userToken));
    const [templateLoading, setTemplateLoading] = useState(() => Boolean(userToken));
    const [uploadingField, setUploadingField] = useState('');
    const [lastAuditUpload, setLastAuditUpload] = useState(null);
    const [stage, setStage] = useState('');
    const [error, setError] = useState('');
    const [authProblem, setAuthProblem] = useState('');
    const [historyError, setHistoryError] = useState('');
    const [projectsError, setProjectsError] = useState('');
    const [introVisible, setIntroVisible] = useState(() => shouldShowIntroOnBoot());
    const [lang, setLangState] = useState('en');
    const [composeOpen, setComposeOpen] = useState(false);
    const [composeDraft, setComposeDraft] = useState({ to: '', subject: '', body: '', replyToMessageId: null, forwardedFromMessageId: null, candidateAttachments: [] });
    const [unreadMessages, setUnreadMessages] = useState(0);
    const [messageNotice, setMessageNotice] = useState(null);
    const seenInboundMessageIds = useRef(new Set());
    const loadersRef = useRef({});
    loadersRef.current = { loadHistory, loadTemplates, loadStates, loadProjects, loadAuditDetail };

    function setLang(nextLang) {
        if (nextLang !== 'en') return;
        localStorage.setItem('verdictLang', 'en');
        setLangState('en');
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
        function handleAuthProblem() {
            const message = 'User authentication problem. Please login. If this happened multiple times, please contact the support.';
            clearUserToken();
            setUserToken('');
            setUser(null);
            setAuthProblem(message);
            navigateTo(setRoute, 'login');
        }
        window.addEventListener('verdictAuthProblem', handleAuthProblem);
        return () => window.removeEventListener('verdictAuthProblem', handleAuthProblem);
    }, [setRoute]);

    useEffect(() => {
        scrollToPageTop();
    }, [route, detailAuditId]);

    useEffect(() => {
        track('page_view', route, window.location.pathname);
    }, [route]);

    useEffect(() => {
        if (!userToken) {
            setUser(null);
            return;
        }
        api.me(userToken).then(setUser).catch(() => {
            clearUserToken();
            setUserToken('');
            setUser(null);
        });
    }, [userToken]);

    useEffect(() => {
        if ((route === 'auditDetail' || route === 'auditProfile') && detailAuditId && userToken) {
            loadersRef.current.loadAuditDetail(detailAuditId);
        } else {
            setDetailLoading(false);
        }
    }, [route, detailAuditId, userToken]);

    useEffect(() => {
        loadersRef.current.loadHistory();
        loadersRef.current.loadTemplates();
        loadersRef.current.loadStates();
        loadersRef.current.loadProjects();
    }, [userToken]);

    useEffect(() => {
        if (!userToken || typeof EventSource === 'undefined') return undefined;
        const source = new EventSource(apiRealtimeUrl(userToken));
        source.addEventListener('project', () => {
            loadersRef.current.loadProjects({ silent: true });
            window.dispatchEvent(new Event('verdictProjectsChanged'));
        });
        source.addEventListener('message', () => {
            window.dispatchEvent(new Event('verdictMessagesChanged'));
        });
        source.addEventListener('audit', (event) => {
            window.dispatchEvent(new CustomEvent('verdictAuditChanged', { detail: JSON.parse(event.data || '{}') }));
        });
        source.onerror = () => {
            window.dispatchEvent(new Event('verdictRealtimeDisconnected'));
        };
        return () => source.close();
    }, [userToken]);

    useEffect(() => {
        let cancelled = false;
        async function refreshUnreadMessages() {
            if (!user) {
                setUnreadMessages(0);
                setMessageNotice(null);
                return;
            }
            try {
                const rows = userToken ? await apiListMessages(userToken) : readMessages(user);
                if (!cancelled) {
                    const inbound = rows.filter((message) => messageBelongsTo(message, user, 'to'));
                    const unread = inbound.filter((message) => !message.read);
                    setUnreadMessages(unread.length);
                    const nextIds = new Set(inbound.map((message) => String(message.id)));
                    const fresh = inbound.find((message) => !seenInboundMessageIds.current.has(String(message.id)));
                    if (seenInboundMessageIds.current.size > 0 && fresh && shouldShowMessageNotice(user)) {
                        setMessageNotice(fresh);
                    }
                    seenInboundMessageIds.current = nextIds;
                }
            } catch {
                if (!cancelled && !userToken) {
                    setUnreadMessages(readMessages(user).filter((message) => !message.read && messageBelongsTo(message, user, 'to')).length);
                }
            }
        }
        refreshUnreadMessages();
        window.addEventListener('verdictMessagesChanged', refreshUnreadMessages);
        window.addEventListener('focus', refreshUnreadMessages);
        return () => {
            cancelled = true;
            window.removeEventListener('verdictMessagesChanged', refreshUnreadMessages);
            window.removeEventListener('focus', refreshUnreadMessages);
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
            setHistoryError('');
            return;
        }
        setHistoryLoading(true);
        setHistoryError('');
        try {
            const rows = await api.history(userToken);
            setHistory(Array.isArray(rows) ? rows : []);
        } catch (err) {
            setHistoryError(err.message || 'Could not load audit history.');
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
            const safeRows = Array.isArray(rows) ? rows : [];
            setTemplates(safeRows);
            setForm((current) => current.templateId ? current : { ...current, templateId: safeRows.find((template) => template.mode === (current.auditMode || 'cv'))?.id || safeRows[0]?.id || '' });
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
            const safeRows = Array.isArray(rows) ? rows : [];
            setStates(safeRows);
            setForm((current) => current.checkStateId ? current : { ...current, checkStateId: safeRows[0]?.id || '' });
        } catch {
            setStates([]);
        }
    }

    async function loadProjects(options = {}) {
        if (!userToken) {
            setProjects([]);
            setProjectsError('');
            setProjectsLoading(false);
            return;
        }
        const silent = Boolean(options.silent);
        if (!silent) {
            setProjectsLoading(true);
            setProjectsError('');
        }
        try {
            const rows = await apiListProjects(userToken);
            setProjects((Array.isArray(rows) ? rows : []).filter(Boolean).map(normaliseProject));
        } catch (err) {
            if (!silent) {
                setProjectsError(err.message || 'Could not load projects.');
            }
        } finally {
            if (!silent) {
                setProjectsLoading(false);
            }
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

    function applyDemoCase(selectedDemo) {
        setForm({
            ...selectedDemo,
            templateId: templates.find((template) => template.mode === selectedDemo.auditMode)?.id || '',
            checkStateId: states[0]?.id || '',
        });
        setAudit(null);
    }

    function loadDemoNow() {
        const selectedDemo = demoCases.find((item) => item.id === selectedDemoId) || demoCase;
        applyDemoCase(selectedDemo);
        track('load_demo_case_direct', 'first_run', selectedDemo.id);
    }

    function confirmLoadDemo() {
        const selectedDemo = demoCases.find((item) => item.id === selectedDemoId) || demoCase;
        applyDemoCase(selectedDemo);
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
        setLastAuditUpload({ field, file });
        await uploadAuditFileObject(field, file);
    }

    async function uploadAuditFileObject(field, file) {
        setError('');
        if (!userToken) {
            setError('Sign in before uploading audit files.');
            return;
        }
        if (file.size > MAX_DOCUMENT_UPLOAD_BYTES) {
            setError(`${file.name} is ${formatUploadSize(file.size)}. Audit documents must be 8 MB or smaller.`);
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

    async function retryAuditUpload() {
        if (!lastAuditUpload) return;
        await uploadAuditFileObject(lastAuditUpload.field, lastAuditUpload.file);
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
                <IntroAnimation onDone={() => {
                    sessionStorage.setItem('verdictIntroSeen', 'true');
                    setIntroVisible(false);
                }} />
            </LanguageContext.Provider>
        );
    }

    const AppHeader = (props) => <Header {...props} unreadMessages={unreadMessages} />;

    let content;
    if (route === 'admin') {
        content = <AdminPage Header={Header} setRoute={setRoute} />;
    } else if (route === 'dashboard') {
        content = <DashboardPage Header={AppHeader} Metric={Metric} SkeletonBlock={SkeletonBlock} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} history={history} templates={templates} historyLoading={historyLoading} historyError={historyError} onRefreshHistory={loadHistory} openAudit={openAudit} />;
    } else if (route === 'history') {
        content = <HistoryPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} history={history} historyLoading={historyLoading} historyError={historyError} onRefreshHistory={loadHistory} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} onRefreshProjects={loadProjects} openAudit={openAudit} />;
    } else if (route === 'projects') {
        content = <ProjectsPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} projectsError={projectsError} onProjectsChange={loadProjects} />;
    } else if (route === 'newProject') {
        content = <NewJobPage Header={AppHeader} Metric={Metric} Textarea={Textarea} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} onProjectsChange={loadProjects} />;
    } else if (PROJECT_DATA_ROUTES.has(route) && projectsError && !projectsLoading && projects.length === 0) {
        content = <ProjectRouteState Header={AppHeader} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} eyebrow="Project loading failed" title="Your project workspace could not be loaded." message={projectsError} retryLabel="Retry projects" onRetry={loadProjects} />;
    } else if (route === 'projectDetail') {
        content = <ProjectDetailPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} />;
    } else if (route === 'projectSettings') {
        content = <ProjectSettingsPage Header={AppHeader} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} onProjectsChange={loadProjects} />;
    } else if (route === 'projectTeam') {
        content = <ProjectTeamPage Header={AppHeader} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} openCompose={openCompose} onProjectsChange={loadProjects} />;
    } else if (route === 'addCandidate') {
        content = <AddCandidatePage Header={AppHeader} Metric={Metric} Textarea={Textarea} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} onProjectsChange={loadProjects} />;
    } else if (route === 'candidateDetail') {
        content = <CandidateDetailPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} onProjectsChange={loadProjects} />;
    } else if (route === 'candidateReport') {
        content = <CandidateMatchReportPage Header={AppHeader} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} />;
    } else if (route === 'candidateProfile') {
        content = <CandidateProfilePage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} />;
    } else if (route === 'signalTrace') {
        content = <SignalTracePage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} onProjectsChange={loadProjects} />;
    } else if (route === 'auditDetail') {
        content = <AuditDetailPage Header={AppHeader} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} audit={detailAudit} loading={detailLoading} error={error} onRetry={() => loadAuditDetail(detailAuditId)} />;
    } else if (route === 'auditProfile') {
        content = <ProfilingModePage Header={AppHeader} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} audit={detailAudit} loading={detailLoading} error={error} onRetry={() => loadAuditDetail(detailAuditId)} />;
    } else if (route === 'profile') {
        content = <ProfilePage Header={AppHeader} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />;
    } else if (route === 'messages') {
        content = <MessagesPage Header={AppHeader} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} openCompose={openCompose} onProjectsChange={loadProjects} />;
    } else if (route === 'login') {
        content = <AuthPage Header={AppHeader} mode="login" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} authProblem={authProblem} clearAuthProblem={() => setAuthProblem('')} />;
    } else if (route === 'register') {
        content = <AuthPage Header={AppHeader} mode="register" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} authProblem={authProblem} clearAuthProblem={() => setAuthProblem('')} />;
    } else if (route === 'home') {
        content = <HomePage Header={AppHeader} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />;
    } else if (route === 'notFound') {
        content = (
            <div className="shell">
                <div className="pageGlow contentFadeIn" />
                <AppHeader setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
                <main className="workspace contentFadeIn">
                    <section className="routeStatePanel" role="status">
                        <span className="eyebrow">Not found</span>
                        <h1>This page does not exist anymore.</h1>
                        <p>The address may be outdated, or the project, candidate, message, or audit may have been removed.</p>
                        <div className="routeStateActions">
                            <button className="primary" type="button" onClick={() => navigateTo(setRoute, userToken ? 'dashboard' : 'home')}>
                                <LayoutDashboard size={16} /> {userToken ? 'Dashboard' : 'Home'}
                            </button>
                            {userToken && <button className="secondary" type="button" onClick={() => navigateTo(setRoute, 'projects')}><ArrowRight size={16} /> Projects</button>}
                            <button className="secondary" type="button" onClick={() => window.location.reload()}><RefreshCcw size={16} /> Reload</button>
                        </div>
                    </section>
                </main>
            </div>
        );
    } else {
        content = <AuditWorkspacePage
            Header={AppHeader}
            setRoute={setRoute}
            user={user}
            userToken={userToken}
            setUser={setUser}
            setUserToken={setUserToken}
            form={form}
            setForm={setForm}
            audit={audit}
            history={history}
            templates={templates}
            states={states}
            templateForm={templateForm}
            setTemplateForm={setTemplateForm}
            templateLoading={templateLoading}
            historyLoading={historyLoading}
            historyError={historyError}
            uploadingField={uploadingField}
            lastAuditUpload={lastAuditUpload}
            loading={loading}
            stage={stage}
            error={error}
            setError={setError}
            selectedDemoId={selectedDemoId}
            setSelectedDemoId={setSelectedDemoId}
            demoConfirmOpen={demoConfirmOpen}
            setDemoConfirmOpen={setDemoConfirmOpen}
            demoCountdown={demoCountdown}
            onLoadDemo={loadDemoNow}
            onConfirmDemo={confirmLoadDemo}
            onSaveTemplate={saveTemplate}
            onRunAudit={runAudit}
            onUploadFile={uploadAuditFile}
            onRetryUpload={retryAuditUpload}
            onRefreshHistory={loadHistory}
            onOpenAudit={openAudit}
            onTrack={track}
        />;
    }

    return (
        <LanguageContext.Provider value={{ lang, setLang, t }}>
            <DialogKeyboardManager />
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
            clearUserToken();
                    setUserToken('');
                    setUser(null);
                    navigateTo(setRoute, 'home');
                }}
            >
                <Suspense fallback={<RouteLoadingFallback />}>
                    {content}
                </Suspense>
            </ErrorBoundary>
            <GlobalCompose
                draft={composeDraft}
                open={composeOpen}
                setDraft={setComposeDraft}
                setOpen={setComposeOpen}
                user={user}
            />
            <MessageNoticeToast
                message={messageNotice}
                onDismiss={() => setMessageNotice(null)}
                onGo={() => {
                    setMessageNotice(null);
                    navigateTo(setRoute, 'messages');
                }}
                onMute={async (duration) => {
                    const updated = await muteMessageNotices(userToken, duration).catch(() => null);
                    if (updated) setUser(updated);
                    setMessageNotice(null);
                }}
            />
        </LanguageContext.Provider>
    );
}

function MessageNoticeToast({ message, onDismiss, onGo, onMute }) {
    const [menuOpen, setMenuOpen] = useState(false);
    if (!message) {
        return null;
    }
    return (
        <aside className="messageNoticeToast">
            <div>
                <span className="eyebrow">New message</span>
                <strong>{message.subject || 'No subject'}</strong>
                <small>From {message.fromName || message.from} / {message.from}</small>
            </div>
            <div className="messageNoticeActions">
                <button className="secondary" type="button" onClick={onDismiss}>Dismiss</button>
                <button className="primary" type="button" onClick={onGo}>Go</button>
                <div className="noticeMuteMenu">
                    <button className="secondary" type="button" onClick={() => setMenuOpen((open) => !open)}>Ignore for <ChevronDown size={14} /></button>
                    {menuOpen && (
                        <div>
                            <button type="button" onClick={() => onMute('5m')}>5 minutes</button>
                            <button type="button" onClick={() => onMute('15m')}>15 minutes</button>
                            <button type="button" onClick={() => onMute('1h')}>1 hour</button>
                            <button type="button" onClick={() => onMute('forever')}>Until I change it back</button>
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}

function readNotificationSettings(user) {
    return {
        messageNoticesEnabled: user?.messageNotificationsEnabled !== false,
        mutedUntil: user?.messageNotificationsMutedUntil || null,
    };
}

function shouldShowMessageNotice(user) {
    const settings = readNotificationSettings(user);
    if (settings.messageNoticesEnabled === false) return false;
    if (settings.mutedUntil && new Date(settings.mutedUntil).getTime() > Date.now()) return false;
    return true;
}

async function muteMessageNotices(token, duration) {
    const durations = { '5m': 5 * 60 * 1000, '15m': 15 * 60 * 1000, '1h': 60 * 60 * 1000 };
    return apiUpdateNotificationPreferences({
        enabled: duration !== 'forever',
        mutedUntil: duration === 'forever' ? null : new Date(Date.now() + (durations[duration] || 0)).toISOString(),
    }, token);
}

function RouteLoadingFallback() {
    return (
        <div className="shell">
            <main className="workspace routeChunkLoading" aria-live="polite">
                <Loading stage="LOADING WORKSPACE" />
                <SkeletonBlock rows={6} />
            </main>
        </div>
    );
}

function Header({ setRoute, user, userToken, setUser, setUserToken, unreadMessages = 0 }) {
    const { t } = useLanguage();
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
        clearUserToken();
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
                    <span className="languageCurrent" aria-label="Interface language">EN</span>
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
                {user && <button className="quiet" onClick={() => navigate('history')}><History size={16} /> {t('history')}</button>}
                {user && (
                    <button className="quiet mailNavButton" onClick={() => navigate('messages')}>
                        <Mail size={16} /> Messages
                        {unreadMessages > 0 && <b aria-label={`${unreadMessages} unread messages`}>{unreadMessages > 99 ? '99+' : unreadMessages}</b>}
                    </button>
                )}
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
                                <button onClick={() => navigate('history')}><History size={16} /> {t('history')}</button>
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

async function waitForAuditCompletion(id, token, setStage) {
    setStage('WAITING FOR REALTIME AUDIT EVENT');
    return new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
            window.removeEventListener('verdictAuditChanged', onAudit);
            reject(new Error('Audit realtime event did not arrive. Open History and press Refresh to recover the result.'));
        }, 120000);
        async function onAudit(event) {
            const detail = event.detail || {};
            if (Number(detail.auditId) !== Number(id)) {
                return;
            }
            window.clearTimeout(timeout);
            window.removeEventListener('verdictAuditChanged', onAudit);
            setStage(`AUDIT ${detail.status || 'UPDATED'}`);
            try {
                const audit = await api.getAudit(id, token);
                if (audit.status === 'FAILED') {
                    reject(new Error('Audit job failed. Please try again.'));
                } else {
                    resolve(audit);
                }
            } catch (error) {
                reject(error);
            }
        }
        window.addEventListener('verdictAuditChanged', onAudit);
    });
}

export default App;

