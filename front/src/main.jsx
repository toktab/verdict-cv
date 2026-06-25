import React, { useEffect, useState } from 'react';
import IntroAnimation from "./IntroAnimation";
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
  const initialRoute = routeFromPath();
  const [route, setRoute] = useState(initialRoute.route);
  const [detailAuditId, setDetailAuditId] = useState(initialRoute.auditId);
  const [userToken, setUserToken] = useState(localStorage.getItem('verdictUserToken') || '');
  const [user, setUser] = useState(null);
  const [form, setForm] = useState(demoCase);
  const [audit, setAudit] = useState(null);
  const [detailAudit, setDetailAudit] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [stage, setStage] = useState('');
  const [error, setError] = useState('');
  const [introVisible, setIntroVisible] = useState(true);

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

  useEffect(() => {
    if (route === 'auditDetail' && detailAuditId && userToken) {
      loadAuditDetail(detailAuditId);
    }
  }, [route, detailAuditId, userToken]);

  async function loadHistory() {
    if (!userToken) {
      setHistory([]);
      return;
    }
    try {
      setHistory(await api.history(userToken));
    } catch {
      setHistory([]);
    }
  }

  async function runAudit() {
    track('audit_clicked', 'commandbar', `claimChars=${form.claimText.length};evidenceChars=${form.evidenceText.length}`);
    setError('');
    if (!userToken) {
      setError('Sign in before running an audit.');
      return;
    }
    setLoading(true);
    const stages = ['NORMALIZING DOCUMENTS', 'SPLITTING CLAIMS', 'CROSS-EXAMINING EVIDENCE', 'SCORING CREDIBILITY', 'WRITING AUDIT RECORD'];
    let index = 0;
    setStage(stages[index]);
    const timer = setInterval(() => {
      index = Math.min(index + 1, stages.length - 1);
      setStage(stages[index]);
    }, 700);
    try {
      const result = await api.runAudit(form, userToken);
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
    return <IntroAnimation onDone={() => setIntroVisible(false)} />;
  }

  let content;
    if (route === 'admin') {
      content = <AdminPanel setRoute={setRoute} />;
    } else if (route === 'dashboard') {
      content = <DashboardPage setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} history={history} openAudit={openAudit} />;
    } else if (route === 'auditDetail') {
      content = <AuditDetailPage setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} audit={detailAudit} loading={detailLoading} error={error} />;
    } else if (route === 'login') {
      content = <AuthPage mode="login" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} />;
    } else if (route === 'register') {
      content = <AuthPage mode="register" setRoute={setRoute} setUser={setUser} setUserToken={setUserToken} />;
    } else if (route === 'home') {
      content = <HomePage setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />;
    } else {
      content = (
        <div className="shell">
        <div className="pageGlow contentFadeIn" />
          <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
          <main className="workspace contentFadeIn">
            {!userToken && (
              <div className="error">Sign in or create an account before running private claim audits.</div>
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

    return content;
}

function routeFromPath() {
  if (window.location.pathname === '/admin') return { route: 'admin' };
  if (window.location.pathname === '/dashboard') return { route: 'dashboard' };
  const auditMatch = window.location.pathname.match(/^\/audit\/(\d+)$/);
  if (auditMatch) return { route: 'auditDetail', auditId: Number(auditMatch[1]) };
  if (window.location.pathname === '/audit') return { route: 'app' };
  if (window.location.pathname === '/login') return { route: 'login' };
  if (window.location.pathname === '/register') return { route: 'register' };
  return { route: 'home' };
}

function navigateTo(setRoute, next, id) {
  setRoute(next);
  const path = next === 'admin' ? '/admin' : next === 'dashboard' ? '/dashboard' : next === 'auditDetail' ? `/audit/${id}` : next === 'app' ? '/audit' : next === 'login' ? '/login' : next === 'register' ? '/register' : '/';
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
      <div className="topbarBg contentFadeIn" />
      <div>
        <div className="brand">VERDICT</div>
        <div className="tagline">Confidence is not evidence.</div>
      </div>
      <nav>
        <button onClick={() => navigate('home')}>Home</button>
        {user && <button onClick={() => navigate('dashboard')}><Gauge size={16} /> Dashboard</button>}
        <button onClick={() => navigate('app')}><FileSearch size={16} /> Audit</button>
        <button onClick={() => navigate('admin')}><Lock size={16} /> Admin</button>
        {user ? (
          <button className="accountChip" onClick={logout}>
            <span>{user.username}</span>
            <small>Logout</small>
          </button>
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
    <div className="pageGlow contentFadeIn" />
      <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
      <main className="home contentFadeIn">
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

function DashboardPage({ setRoute, user, userToken, setUser, setUserToken, history, openAudit }) {
  const stats = dashboardStats(history);
  return (
    <div className="shell">
    <div className="pageGlow contentFadeIn" />
      <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
      <main className="dashboard contentFadeIn">
        <section className="dashboardHero">
          <div>
            <span className="eyebrow">Private workspace</span>
            <h1>{user ? `Welcome, ${user.fullName}` : 'Welcome back'}</h1>
            <p>{user?.organization || 'Independent'} / {user?.role || 'Analyst'} / {user?.email}</p>
          </div>
          <button className="primary" onClick={() => navigateTo(setRoute, 'app')}><Play size={18} /> New audit</button>
        </section>
        <section className="dashboardStats">
          <Metric label="Private audits" value={history.length} />
          <Metric label="Average score" value={`${stats.averageScore}%`} />
          <Metric label="Risky claims" value={stats.riskyClaims} />
          <Metric label="Saved reports" value={history.length} />
        </section>
        <section className="dashboardGrid">
          <div className="dashboardPanel">
            <h2><History size={18} /> Recent audits</h2>
            {history.length === 0 && <div className="emptyState">No private audits yet. Start with the demo case or paste your own claim and evidence.</div>}
            {history.slice(0, 5).map((item) => (
              <button className="dashboardAuditRow" key={item.id} onClick={() => openAudit(item.id)}>
                <span>#{item.id} {item.claimTitle}</span>
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

function AuthPage({ mode, setRoute, setUser, setUserToken }) {
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
          <span className="eyebrow">{isRegister ? 'Create account' : 'Welcome back'}</span>
          <h1>{isRegister ? 'Start with your private audit workspace.' : 'Login to continue auditing.'}</h1>
          {isRegister ? (
            <div className="registerWizard">
              <div className="registerProgress" aria-label="Registration progress">
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
                  <span className="eyebrow">Step {registerStep + 1}</span>
                  <h2>{activeStep.title}</h2>
                </div>
                {registerStep === 0 && (
                  <div className="authGrid">
                    <Input label="First name" value={form.firstName} onChange={(firstName) => updateForm({ firstName })} />
                    <Input label="Last name" value={form.lastName} onChange={(lastName) => updateForm({ lastName })} />
                  </div>
                )}
                {registerStep === 1 && (
                  <div className="authGrid single">
                    <Input label="Username" value={form.username} onChange={(username) => updateForm({ username })} />
                  </div>
                )}
                {registerStep === 2 && (
                  <div className="authGrid single">
                    <Input label="Email" value={form.email} onChange={(email) => updateForm({ email })} />
                  </div>
                )}
                {registerStep === 3 && (
                  <div className="authGrid">
                    <Input label="Country" value={form.country} onChange={(country) => updateForm({ country })} />
                    <Input label="Address" value={form.address} onChange={(address) => updateForm({ address })} />
                  </div>
                )}
                {registerStep === 4 && (
                  <div className="authGrid">
                    <Input label="Organization" value={form.organization} onChange={(organization) => updateForm({ organization })} />
                    <Input label="Role" value={form.role} onChange={(role) => updateForm({ role })} />
                  </div>
                )}
                {registerStep === 5 && (
                  <div className="authGrid single">
                    <Input type="password" label="Password" value={form.password} onChange={(password) => updateForm({ password })} />
                  </div>
                )}
                {registerStep === 6 && (
                  <>
                    <div className="reviewBox">
                      {reviewRows(form).map(([label, value]) => (
                        <div key={label}>
                          <span>{label}</span>
                          <strong>{value || 'Not provided'}</strong>
                        </div>
                      ))}
                    </div>
                    <label className="confirmRow">
                      <input type="checkbox" checked={form.confirmInfo} onChange={(event) => updateForm({ confirmInfo: event.target.checked })} />
                      <span>All information is correct.</span>
                    </label>
                  </>
                )}
                <ValidationList checks={activeChecks} />
                <div className="stepActions">
                  <button className="ghost" disabled={registerStep === 0 || loading} onClick={previousStep}>Back</button>
                  {registerStep < registerSteps.length - 1 ? (
                    <button className="primary" disabled={!stepValid || loading} onClick={nextStep}>
                      Next <ArrowRight size={18} />
                    </button>
                  ) : (
                    <button className="primary" disabled={!stepValid || loading} onClick={submit}>
                      <UserPlus size={18} /> {loading ? 'Working...' : 'Create account'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="authGrid single">
              <Input label="Username or email" value={form.identifier} onChange={(identifier) => setForm({ ...form, identifier })} />
              <Input type="password" label="Password" value={form.password} onChange={(password) => setForm({ ...form, password })} />
            </div>
          )}
          {!isRegister && (
            <button className="primary authSubmit" disabled={loading} onClick={submit}>
              <Lock size={18} />
              {loading ? 'Working...' : 'Login'}
            </button>
          )}
          <button className="ghost authSubmit" onClick={() => navigateTo(setRoute, isRegister ? 'login' : 'register')}>
            {isRegister ? 'Already have an account' : 'Create new account'}
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

function AuditDetailPage({ setRoute, user, userToken, setUser, setUserToken, audit, loading, error }) {
  const [statusFilter, setStatusFilter] = useState('ALL');
  const verdicts = audit?.verdicts || [];
  const filteredVerdicts = statusFilter === 'ALL' ? verdicts : verdicts.filter((verdict) => verdict.status === statusFilter);
  const filters = ['ALL', 'SUPPORTED', 'STRETCHED', 'UNSUPPORTED', 'GAP'];

  return (
    <div className="shell">
      <div className="pageGlow contentFadeIn" />
      <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
      <main className="detailPage contentFadeIn">
        <button className="ghost" onClick={() => navigateTo(setRoute, 'dashboard')}>Back to dashboard</button>
        {error && <div className="error">{error}</div>}
        {loading && <Loading stage="LOADING AUDIT DETAIL" />}
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
              <button className="download" onClick={() => exportAudit(audit.id)}><Download size={16} /> Export</button>
            </section>
            <section className="detailMeta">
              <Metric label="Created" value={formatDateTime(audit.createdAt)} />
              <Metric label="Engine" value={audit.engine} />
              <Metric label="Runtime" value={`${audit.processingMillis}ms`} />
              <Metric label="Claim hash" value={shortHash(audit.claimFingerprint)} />
              <Metric label="Evidence hash" value={shortHash(audit.evidenceFingerprint)} />
            </section>
            <section className="documentCompare">
              <Panel title="Original claim" subtitle={audit.claimTitle}>
                <pre>{audit.claimText}</pre>
              </Panel>
              <Panel title="Original evidence" subtitle={audit.evidenceTitle}>
                <pre>{audit.evidenceText}</pre>
              </Panel>
            </section>
            <section className="detailTableSection">
              <div className="tableToolbar">
                <h2>Verdicts</h2>
                <div className="filterTabs">
                  {filters.map((filter) => (
                    <button key={filter} className={statusFilter === filter ? 'active' : ''} onClick={() => setStatusFilter(filter)}>
                      {filter}
                    </button>
                  ))}
                </div>
              </div>
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
                    <small>{verdict.evidencePointer}</small>
                  </div>
                ))}
                {filteredVerdicts.length === 0 && <div className="emptyState">No verdicts match this filter.</div>}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

function formatDateTime(value) {
  return value ? new Date(value).toLocaleString() : 'Unknown';
}

function shortHash(value) {
  return value ? `${value.slice(0, 8)}...` : 'None';
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
        <button className="download" onClick={() => exportAudit(audit.id)}>
          <Download size={16} /> Export
        </button>
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

async function exportAudit(id) {
  const token = localStorage.getItem('verdictUserToken') || '';
  const response = await fetch(`/api/audit/${id}/export`, { headers: { 'X-User-Token': token } });
  if (!response.ok) {
    throw new Error('Export failed');
  }
  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `verdict-audit-${id}.txt`;
  link.click();
  URL.revokeObjectURL(url);
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
      <h2><History size={18} /> My Audit History</h2>
      <div className="historyRows">
        {history.length === 0 && <div className="emptyState">No audits yet. Run your first private claim audit.</div>}
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
  const [users, setUsers] = useState([]);
  const [settings, setSettings] = useState({ requireEmailVerification: false });
  const [userSearch, setUserSearch] = useState('');
  const [selectedAudit, setSelectedAudit] = useState(null);
  const [editingVerdict, setEditingVerdict] = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [userForm, setUserForm] = useState(emptyUserForm());
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
    const [auditRows, logRows, userRows, settingRows] = await Promise.all([
      api.adminAudits(token),
      api.adminLogs(token),
      api.adminUsers(token),
      api.adminSettings(token),
    ]);
    setAudits(auditRows);
    setLogs(logRows);
    setUsers(userRows);
    setSettings(settingRows);
  }

  useEffect(() => {
    if (token) {
      loadAdmin().catch((err) => setError(err.message));
    }
  }, [token]);

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
          <button className="ghost" onClick={() => setRoute('app')}>Back to site</button>
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
              <button onClick={newUser}><X size={16} /> Clear</button>
            </div>
          </div>
          <Input label="Search users" value={userSearch} onChange={setUserSearch} />
          <div className="userRows">
            {filteredUsers(users, userSearch).length === 0 && <div className="emptyState">No users match this search.</div>}
            {filteredUsers(users, userSearch).map((user) => (
              <div className="adminRow" key={user.id}>
                <span>#{user.id} {user.fullName} / {user.username} / {user.email} / {user.emailVerified ? 'verified' : 'unverified'}</span>
                <div className="rowActions">
                  <button onClick={() => editUser(user)}><Edit3 size={15} /> Edit</button>
                  <button onClick={() => deleteUser(user.id)}><Trash2 size={15} /> Delete</button>
                </div>
              </div>
            ))}
          </div>
        </section>
        <section className="adminSection">
          <h2><Activity size={18} /> Audits</h2>
          {audits.length === 0 && <div className="emptyState">No audits have been created yet.</div>}
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
          {logs.length === 0 && <div className="emptyState">No logs are available.</div>}
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

function filteredUsers(users, search) {
  const needle = search.trim().toLowerCase();
  if (!needle) {
    return users;
  }
  return users.filter((user) => [user.fullName, user.username, user.email, user.country, user.organization, user.role]
    .filter(Boolean)
    .some((value) => value.toLowerCase().includes(needle)));
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
