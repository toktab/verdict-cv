import { Suspense, useEffect, useRef, useState } from 'react';
import { ArrowRight, ChevronDown, Gauge, History, LayoutDashboard, RefreshCcw } from 'lucide-react';
import IntroAnimation from './IntroAnimation';
import { LanguageContext, translate } from './i18n';
import { apiMe, apiLogout, apiListProjects, apiUpdateNotificationPreferences, javaApi, normaliseProject, normaliseUser } from './api';
import Header from './components/Header';
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
import { useRealtime } from './hooks/useRealtime';
import { useUnreadMessages } from './hooks/useUnreadMessages';
import { pages } from './AppRoutes';
import './styles.css';
import './styles/auth.css';
import './styles/reports.css';

const { HistoryPage, AuthPage, CandidateDetailPage, CandidateMatchReportPage, CandidateProfilePage, HomePage, MessagesPage, ProfilePage, AdminPage, AddCandidatePage, NewJobPage, ProjectDetailPage, ProjectSettingsPage, ProjectTeamPage, ProjectsPage, SignalTracePage, SignalTraceReportPage } = pages;

const MAX_DOCUMENT_UPLOAD_BYTES = 8 * 1024 * 1024;
const PROJECT_DATA_ROUTES = new Set(['projectDetail', 'projectSettings', 'projectTeam', 'addCandidate', 'candidateDetail', 'candidateReport', 'candidateProfile', 'signalTrace', 'signalTraceReport']);

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

function SkeletonBlock({ rows = 3, compact = false }) {
    return (
        <div className={`skeletonBlock ${compact ? 'compact' : ''}`}>
            {Array.from({ length: rows }, (_, index) => <span key={index} />)}
        </div>
    );
}

// Metric and Textarea are kept here as they are small utility components used by page renders.
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
    const loadersRef = useRef({});
    loadersRef.current = { loadHistory, loadTemplates, loadStates, loadProjects, loadAuditDetail };

    const { unreadMessages, messageNotice, setMessageNotice } = useUnreadMessages(user, userToken);

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

    useRealtime(userToken, loadProjects);

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
    } else if (route === 'signalTraceReport') {
        content = <SignalTraceReportPage Header={AppHeader} Metric={Metric} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} projects={projects} projectsLoading={projectsLoading} />;
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
                    const durations = { '5m': 300000, '15m': 900000, '1h': 3600000 };
                    const updated = await apiUpdateNotificationPreferences({
                        enabled: duration !== 'forever',
                        mutedUntil: duration === 'forever' ? null : new Date(Date.now() + (durations[duration] || 0)).toISOString(),
                    }, userToken).catch(() => null);
                    if (updated) setUser(updated);
                    setMessageNotice(null);
                }}
            />
        </LanguageContext.Provider>
    );
}

function MessageNoticeToast({ message, onDismiss, onGo, onMute }) {
    const [menuOpen, setMenuOpen] = useState(false);
    if (!message) return null;
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

function RouteLoadingFallback() {
    return (
        <div className="shell">
            <main className="workspace routeChunkLoading" aria-live="polite">
                <div className="loading" role="status">
                    <div className="_v_spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.12)', borderTopColor: '#fff', borderRadius: '50%', animation: '_v_spin 0.9s linear infinite', display: 'inline-block', marginRight: 8 }} />
                    <strong>LOADING WORKSPACE</strong>
                </div>
                <div className="skeletonBlock">
                    {[1,2,3,4,5,6].map((i) => <span key={i} />)}
                </div>
            </main>
        </div>
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

