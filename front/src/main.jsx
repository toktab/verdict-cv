import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Activity, Download, FileSearch, Gauge, History, Lock, Play, ShieldCheck, Trash2 } from 'lucide-react';
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
  const [route, setRoute] = useState(window.location.pathname === '/admin' ? 'admin' : 'app');
  const [form, setForm] = useState(demoCase);
  const [audit, setAudit] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    track('page_view', route, window.location.pathname);
    loadHistory();
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

  return (
    <div className="shell">
      <Header setRoute={setRoute} />
      <main className="workspace">
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
          <button className="primary" disabled={loading} onClick={runAudit}>
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

function Header({ setRoute }) {
  function navigate(next) {
    track('navigation_clicked', next);
    setRoute(next);
    window.history.replaceState(null, '', next === 'admin' ? '/admin' : '/');
  }

  return (
    <header className="topbar">
      <div>
        <div className="brand">VERDICT</div>
        <div className="tagline">Confidence is not evidence.</div>
      </div>
      <nav>
        <button onClick={() => navigate('app')}><FileSearch size={16} /> Audit</button>
        <button onClick={() => navigate('admin')}><Lock size={16} /> Admin</button>
      </nav>
    </header>
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

function Input({ label, value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
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
    await loadAdmin();
  }

  async function deleteLog(id) {
    track('admin_delete_log', 'admin_panel', `logId=${id}`);
    await api.deleteLog(token, id);
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
              <button onClick={() => deleteAudit(audit.id)}><Trash2 size={15} /> Delete</button>
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
    </div>
  );
}

createRoot(document.getElementById('root')).render(<App />);
