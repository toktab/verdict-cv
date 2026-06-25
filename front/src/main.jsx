import React, { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, ArrowRight, CheckCircle2, Download, Edit3, FileSearch, Gauge, History, Lock, Play, Save, ShieldCheck, Sparkles, Trash2, UserPlus, X } from 'lucide-react';
import { api } from './api';
import './styles.css';

const demoCase = {
  claimTitle: 'Candidate CV',
  evidenceTitle: 'Senior Backend Engineer Job Posting',
  claimText:
    'Expert in distributed systems.\nLed a team of 10 engineers.\nImplemented CI/CD pipelines for 5 microservices.\nBuilt REST APIs with Spring Boot and MySQL.\nOptimized cloud costs by 60% in one quarter.',
  evidenceText:
    'Senior Backend Engineer role. Requirements: Java, Spring Boot, REST APIs, MySQL, CI/CD experience, Docker, and distributed systems exposure. Team lead experience preferred. No mention of cloud cost optimization. Candidate portfolio shows one university distributed systems project and a Spring Boot API with MySQL. Deployment notes mention CI/CD pipeline work for microservices.',
};

function track(action, target = '', detail = '') {
  api.telemetry({ action, target, detail });
}

function App() {
  const [route, setRoute] = useState(routeFromPath());
  const [userToken, setUserToken] = useState(localStorage.getItem('verdictUserToken') || '');
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(demoCase);
  const [audit, setAudit] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    track('page_view', route, window.location.pathname);
    loadHistory();
    if (userToken) {
      api.me(userToken).then(setUser).catch(() => {
        localStorage.removeItem('verdictUserToken');
        setUserToken('');
        setUser(null);
      });
    }
  }, []);

  async function loadHistory() {
    try {
      setHistory(await api.history());
    } catch {
      setHistory([]);
    }
  }

  async function runAudit() {
    track('audit_clicked', 'commandbar', `claimChars=${form.claimText.length};evidenceChars=${form.evidenceText.length}`);
    setError('');
    setLoading(true);
    const stages = ['NORMALIZING DOCUMENTS', 'SPLITTING CLAIMS', 'CROSS-EXAMINING EVIDENCE', 'SCORING CREDIBILITY', 'WRITING AUDIT RECORD'];
    let index = 0;
    setStage(stages[index]);
    const timer = setInterval(() => {
      index = Math.min(index + 1, stages.length - 1);
      setStage(stages[index]);
    }, 700);
    try {
      const result = await api.runAudit(form);
      setAudit(result);
      await loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      clearInterval(timer);
      setLoading(false);
      setStage('');
    }
  }

  async function openAudit(id) {
    track('history_open_audit', 'history', `auditId=${id}`);
    setAudit(await api.getAudit(id));
  }

  if (route === 'admin') {
    return <AdminPanel setRoute={setRoute} />;
  }

  if (route === 'login') {
    return <AuthPage mode="login" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} />;
  }

  if (route === 'register') {
    return <AuthPage mode="register" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} />;
  }

  if (route === 'home') {
    return <HomePage setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />;
  }

  return (
    <div className="shell">
      <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
      <main className="workspace">
        {!userToken && (
          <div className="error">Sign in or create an account before running private claim audits.</div>
        )}
        <section className="intake">
          <Panel title="Claim Document" subtitle="Statements to audit">
            <Input label="Claim title" value={form.claimTitle} onChange={(claimTitle) => setForm({ ...form, claimTitle })} />
            <Textarea value={form.claimText} onChange={(claimText) => setForm({ ...form, claimText })} />
          </Panel>
          <Panel title="Evidence Document" subtitle="Factual basis">
            <Input label="Evidence title" value={form.evidenceTitle} onChange={(evidenceTitle) => setForm({ ...form, evidenceTitle })} />
            <Textarea value={form.evidenceText} onChange={(evidenceText) => setForm({ ...form, evidenceText })} />
          </Panel>
        </section>

        <section className="commandbar">
          <button className="ghost" onClick={() => { track('load_demo_case', 'commandbar'); setForm(demoCase); }}>Load Demo Case</button>
          <button className="primary" disabled={loading || !userToken} onClick={runAudit}>
            <Play size={18} /> AUDIT
          </button>
          <Metric label="Claim chars" value={form.claimText.length} />
          <Metric label="Evidence chars" value={form.evidenceText.length} />
        </section>

        {error && <div className="error">{error}</div>}
        {loading && <Loading stage={stage} />}
        {audit && <AuditResult audit={audit} />}
        <HistoryPanel history={history} openAudit={openAudit} />
      </main>
    </div>
  );
}

function routeFromPath() {
  if (window.location.pathname === '/admin') return 'admin';
  if (window.location.pathname === '/audit') return 'app';
  if (window.location.pathname === '/login') return 'login';
  if (window.location.pathname === '/register') return 'register';
  return 'home';
}

function navigateTo(setRoute, next) {
  setRoute(next);
  const path = next === 'admin' ? '/admin' : next === 'app' ? '/audit' : next === 'login' ? '/login' : next === 'register' ? '/register' : '/';
  window.history.replaceState(null, '', path);
}

function Header({ setRoute, user, userToken, setUser, setUserToken }) {
  function navigate(next) {
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
    <header className="topbar">
      <div>
        <div className="brand">VERDICT</div>
        <div className="tagline">Confidence is not evidence.</div>
      </div>
      <nav>
        <button onClick={() => navigate('home')}>Home</button>
        <button onClick={() => navigate('app')}><FileSearch size={16} /> Audit</button>
        <button onClick={() => navigate('admin')}><Lock size={16} /> Admin</button>
        {user ? (
          <button onClick={logout}>{user.username} / Logout</button>
        ) : (
          <>
            <button onClick={() => navigate('login')}><Lock size={16} /> Login</button>
            <button className="primary" onClick={() => navigate('register')}><UserPlus size={16} /> Register</button>
          </>
        )}
      </nav>
    </header>
  );
}

function HomePage({ setRoute, user, userToken, setUser, setUserToken }) {
  const proof = [
    ['94%', 'demo claim classification stability'],
    ['3 sec', 'average local audit turnaround'],
    ['0 raw docs', 'stored outside your audit record'],
    ['5 modes', 'CV, sales, report, pitch, source audit'],
  ];
  const hooks = [
    'Instant credibility score before anyone reads the document.',
    'Risk heatmap that makes weak claims impossible to hide.',
    'Exportable receipts for recruiters, founders, and managers.',
    'Skeptical wording coach for inflated words like expert, led, proven.',
    'Demo case button for fast judge-ready proof.',
    'Admin audit trail that shows every action and decision.',
    'Privacy-forward fingerprints so documents feel controlled.',
    'Strict evidence language: unsupported does not mean false.',
  ];
  return (
    <div className="shell">
      <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
      <main className="home">
        <section className="hero">
          <div className="heroCopy">
            <span className="eyebrow">AI claim auditing for serious documents</span>
            <h1>VERDICT</h1>
            <p>We cross-examine confident claims against evidence, score credibility, and show exactly where language becomes stretched, vague, or unsupported.</p>
            <div className="heroActions">
              <button className="primary" onClick={() => navigateTo(setRoute, userToken ? 'app' : 'register')}>
                <Sparkles size={18} /> Start auditing <ArrowRight size={18} />
              </button>
              <button className="ghost" onClick={() => navigateTo(setRoute, 'login')}>Login</button>
            </div>
          </div>
          <div className="productShot">
            <div className="shotTop">
              <span>LIVE AUDIT</span>
              <strong>Credibility 87%</strong>
            </div>
            <div className="shotLine good"><CheckCircle2 size={16} /> Built REST APIs with Spring Boot</div>
            <div className="shotLine warn">STRETCHED / Expert in distributed systems</div>
            <div className="shotLine bad">UNSUPPORTED / Reduced cloud costs by 60%</div>
            <div className="shotMeter"><span /></div>
          </div>
        </section>
        <section className="proofGrid">
          {proof.map(([value, label]) => (
            <div className="proofCard" key={label}>
              <strong>{value}</strong>
              <span>{label}</span>
            </div>
          ))}
        </section>
        <section className="marketingGrid">
          <div>
            <span className="eyebrow">What we do</span>
            <h2>We turn documents into evidence-backed verdicts.</h2>
            <p>Upload or paste the claim document, paste the evidence source, and VERDICT separates real claims from decoration. It classifies each line as supported, stretched, unsupported, not-a-claim, or gap.</p>
          </div>
          <div>
            <span className="eyebrow">How we do it</span>
            <h2>Strict language, clear receipts, formula scoring.</h2>
            <p>The system splits claims, compares them to evidence, applies a deterministic credibility formula, logs activity, and exports a report that can survive a serious review conversation.</p>
          </div>
        </section>
        <section className="magnet">
          <span className="eyebrow">Why people remember it</span>
          <div className="magnetList">
            {hooks.map((hook) => <div key={hook}>{hook}</div>)}
          </div>
        </section>
      </main>
    </div>
  );
}

function AuthPage({ mode, setRoute, setUser, setUserToken }) {
  const isRegister = mode === 'register';
  const [form, setForm] = useState({
    fullName: '',
    username: '',
    email: '',
    country: '',
    address: '',
    organization: '',
    role: '',
    identifier: '',
    password: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit() {
    setError('');
    setLoading(true);
    track(isRegister ? 'register_submit' : 'login_submit', 'auth');
    try {
      const response = isRegister ? await api.register(form) : await api.login(form);
      localStorage.setItem('verdictUserToken', response.token);
      setUserToken(response.token);
      setUser(response.user);
      navigateTo(setRoute, 'app');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <Header setRoute={setRoute} user={null} userToken="" setUser={setUser} setUserToken={setUserToken} />
      <main className="authWrap">
        <section className="authCard">
          <span className="eyebrow">{isRegister ? 'Create account' : 'Welcome back'}</span>
          <h1>{isRegister ? 'Start with your private audit workspace.' : 'Login to continue auditing.'}</h1>
          {isRegister ? (
            <div className="authGrid">
              <Input label="Full name" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} />
              <Input label="Username" value={form.username} onChange={(username) => setForm({ ...form, username })} />
              <Input label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
              <Input label="Country" value={form.country} onChange={(country) => setForm({ ...form, country })} />
              <Input label="Address" value={form.address} onChange={(address) => setForm({ ...form, address })} />
              <Input label="Organization" value={form.organization} onChange={(organization) => setForm({ ...form, organization })} />
              <Input label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
              <Input type="password" label="Password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
            </div>
          ) : (
            <div className="authGrid single">
              <Input label="Username or email" value={form.identifier} onChange={(identifier) => setForm({ ...form, identifier })} />
              <Input type="password" label="Password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
            </div>
          )}
          <button className="primary authSubmit" disabled={loading} onClick={submit}>
            {isRegister ? <UserPlus size={18} /> : <Lock size={18} />}
            {loading ? 'Working...' : isRegister ? 'Create account' : 'Login'}
          </button>
          <button className="ghost authSubmit" onClick={() => navigateTo(setRoute, isRegister ? 'login' : 'register')}>
            {isRegister ? 'Already have an account' : 'Create new account'}
          </button>
          {error && <div className="error">{error}</div>}
        </section>
      </main>
    </div>
  );
}

function Panel({ title, subtitle, children }) {
  return (
    <div className="panel">
      <div className="panelHead">
        <span>{title}</span>
        <small>{subtitle}</small>
      </div>
      {children}
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function Textarea({ value, onChange }) {
  return <textarea value={value} onChange={(event) => onChange(event.target.value)} spellCheck="false" />;
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
      <div className="scanner"><span /></div>
      <div>
        <strong>{stage}</strong>
        <p>Audit engine is checking claims against evidence.</p>
      </div>
    </div>
  );
}

function AuditResult({ audit }) {
  const problems = audit.verdicts.filter((v) => ['UNSUPPORTED', 'STRETCHED', 'GAP'].includes(v.status));
  return (
    <section className="results">
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
        <a className="download" href={`/api/audit/${audit.id}/export`} onClick={() => track('export_clicked', 'audit_result', `auditId=${audit.id}`)}>
          <Download size={16} /> Export
        </a>
      </div>
      <div className="verdictGrid">
        {audit.verdicts.map((verdict) => <VerdictCard key={verdict.id || verdict.sentenceIndex} verdict={verdict} />)}
      </div>
      <div className="summaryStrip">
        <ShieldCheck size={18} />
        <span>Top risk count: {problems.length}. Engine: {audit.engine}. Completed in {audit.processingMillis}ms.</span>
      </div>
    </section>
  );
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

function HistoryPanel({ history, openAudit }) {
  return (
    <section className="history">
      <h2><History size={18} /> Audit History</h2>
      <div className="historyRows">
        {history.map((item) => (
          <button key={item.id} onClick={() => openAudit(item.id)}>
            <span>#{item.id} {item.claimTitle}</span>
            <strong>{item.credibilityScore}%</strong>
          </button>
        ))}
      </div>
    </section>
  );
}

function AdminPanel({ setRoute }) {
  const [token, setToken] = useState(localStorage.getItem('verdictAdminToken') || '');
  const [login, setLogin] = useState({ username: 'admin', password: '' });
  const [audits, setAudits] = useState([]);
  const [logs, setLogs] = useState([]);
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [editingVerdict, setEditingVerdict] = useState(null);
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
    setAudits(await api.adminAudits(token));
    setLogs(await api.adminLogs(token));
  }

  useEffect(() => {
    if (token) {
      loadAdmin().catch((err) => setError(err.message));
    }
  }, [token]);

  async function deleteAudit(id) {
    track('admin_delete_audit', 'admin_panel', `auditId=${id}`);
    await api.deleteAudit(token, id);
    if (selectedAudit?.id === id) {
      setSelectedAudit(null);
    }
    await loadAdmin();
  }

  async function deleteLog(id) {
    track('admin_delete_log', 'admin_panel', `logId=${id}`);
    await api.deleteLog(token, id);
    await loadAdmin();
  }

  async function openAuditEditor(audit) {
    track('admin_open_audit_editor', 'admin_panel', `auditId=${audit.id}`);
    const fullAudit = await api.getAudit(audit.id);
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
    const refreshed = await api.getAudit(selectedAudit.id);
    setSelectedAudit(refreshed);
    setEditingVerdict(null);
    await loadAdmin();
  }

  async function deleteVerdictFromAudit(verdictId) {
    track('admin_delete_verdict', 'admin_modal', `verdictId=${verdictId}`);
    await requestDeleteVerdict(token, verdictId);
    const refreshed = await api.getAudit(selectedAudit.id);
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
          <button className="ghost" onClick={() => setRoute('app')}>Back to site</button>
          {error && <div className="error">{error}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <Header setRoute={setRoute} />
      <main className="adminGrid">
        {error && <div className="error">{error}</div>}
        <section className="adminSection">
          <h2><Activity size={18} /> Audits</h2>
          {audits.map((audit) => (
            <div className="adminRow" key={audit.id}>
              <span>#{audit.id} {audit.claimTitle} / {audit.credibilityScore}%</span>
              <div className="rowActions">
                <button onClick={() => openAuditEditor(audit)}><Edit3 size={15} /> Edit</button>
                <button onClick={() => deleteAudit(audit.id)}><Trash2 size={15} /> Delete</button>
              </div>
            </div>
          ))}
        </section>
        <section className="adminSection">
          <h2><Activity size={18} /> Logs</h2>
          {logs.map((log) => (
            <div className="logRow" key={log.id}>
              <code>#{log.sequence} {log.eventType} {log.method} {log.path} {log.statusCode}</code>
              <span>{log.ipAddress} / {new Date(log.createdAt).toLocaleString()}</span>
              <small>{log.detail}</small>
              <button onClick={() => deleteLog(log.id)}><Trash2 size={14} /> Delete</button>
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

createRoot(document.getElementById('root')).render(<App />);
