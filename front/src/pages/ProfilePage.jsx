import React, { useEffect, useState } from 'react';
import { Check, Clock3, Copy, Download, KeyRound, MonitorSmartphone, RefreshCcw, Save, ShieldCheck, ShieldOff, Terminal, X } from 'lucide-react';
import { apiCreateCmdPairingCode, apiListCmdSessions, apiRevokeCmdSession, apiUpdateNotificationPreferences, javaApi, normaliseUser } from '../api';
import { Input } from '../components/ui';
import '../styles/profile.css';

export function ProfilePage({ Header, setRoute, user, userToken, setUser, setUserToken }) {
  const [form, setForm] = useState(() => ({
    fullName: user?.fullName || '',
    email: user?.email || '',
    country: user?.country || '',
    address: user?.address || '',
    organization: user?.organization || '',
    role: user?.role || '',
    password: '',
  }));
  const [error, setError] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState(() => notificationSettingsFromUser(user));
  const [cmdSessions, setCmdSessions] = useState([]);
  const [cmdLoading, setCmdLoading] = useState(false);
  const [cmdError, setCmdError] = useState('');
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [pairingCode, setPairingCode] = useState(null);
  const [pairingSeconds, setPairingSeconds] = useState(0);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        fullName: user.fullName || '',
        email: user.email || '',
        country: user.country || '',
        address: user.address || '',
        organization: user.organization || '',
        role: user.role || '',
        password: '',
      });
      setNotificationSettings(notificationSettingsFromUser(user));
    }
  }, [user]);

  useEffect(() => {
    if (!userToken) return undefined;
    let cancelled = false;
    setCmdLoading(true);
    apiListCmdSessions(userToken)
      .then((rows) => { if (!cancelled) setCmdSessions(rows || []); })
      .catch((err) => { if (!cancelled) setCmdError(err.message || 'Could not load CMD access.'); })
      .finally(() => { if (!cancelled) setCmdLoading(false); });
    return () => { cancelled = true; };
  }, [userToken]);

  useEffect(() => {
    if (!pairingCode?.expires_at) return undefined;
    const update = () => setPairingSeconds(Math.max(0, Math.ceil((new Date(pairingCode.expires_at).getTime() - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [pairingCode]);

  async function refreshCmdSessions() {
    setCmdLoading(true);
    setCmdError('');
    try {
      setCmdSessions(await apiListCmdSessions(userToken));
    } catch (err) {
      setCmdError(err.message || 'Could not refresh CMD access.');
    } finally {
      setCmdLoading(false);
    }
  }

  async function revokeCmdAccess() {
    if (!revokeTarget) return;
    setCmdLoading(true);
    setCmdError('');
    try {
      await apiRevokeCmdSession(revokeTarget.id, userToken);
      setRevokeTarget(null);
      await refreshCmdSessions();
      setSaved('CMD access revoked. The connector must sign in again.');
    } catch (err) {
      setCmdError(err.message || 'Could not revoke CMD access.');
      setCmdLoading(false);
    }
  }

  async function generatePairingCode() {
    setCmdLoading(true);
    setCmdError('');
    setCopied('');
    try {
      const created = await apiCreateCmdPairingCode(userToken);
      setPairingCode(created);
      setPairingSeconds(created.expires_in_seconds || 300);
    } catch (err) {
      setCmdError(err.message || 'Could not generate a pairing code.');
    } finally {
      setCmdLoading(false);
    }
  }

  async function copyConnectorValue(value, label) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(label);
      window.setTimeout(() => setCopied(''), 1800);
    } catch {
      setCmdError('Clipboard access was blocked. Select and copy the command manually.');
    }
  }

  async function updateNotifications(patch) {
    const next = { ...notificationSettings, ...patch };
    setNotificationSettings(next);
    setError('');
    try {
      const updated = await apiUpdateNotificationPreferences({
        enabled: next.messageNoticesEnabled !== false,
        mutedUntil: next.mutedUntil || null,
      }, userToken);
      setUser(updated);
      setSaved('Notification settings saved to your account.');
    } catch (err) {
      setNotificationSettings(notificationSettingsFromUser(user));
      setError(err.message || 'Could not save notification settings.');
    }
  }

  async function saveProfile() {
    setError('');
    setSaved('');
    const validation = profileValidation(form);
    if (validation) {
      setError(validation);
      return;
    }
    setLoading(true);
    try {
      const updated = normaliseUser(await javaApi.updateMe(userToken, form));
      setUser(updated);
      setForm((current) => ({ ...current, password: '' }));
      setSaved('Profile saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="shell">
      <div className="pageGlow contentFadeIn" />
      <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
      <main className="profilePage contentFadeIn">
        <section className="profileHero">
          <div>
            <span className="eyebrow">Account profile</span>
            <h1>{user?.username || 'Your account'}</h1>
            <p>Update your private workspace identity and optional password.</p>
          </div>
          <button className="primary" disabled={loading || !userToken} onClick={saveProfile}><Save size={16} /> {loading ? 'Saving...' : 'Save profile'}</button>
        </section>
        {!userToken && <div className="error">Login before editing your profile.</div>}
        {error && <div className="error">{error}</div>}
        {saved && <div className="success">{saved}</div>}
        <section className="profileGrid">
          <Input label="Full name" value={form.fullName} onChange={(fullName) => setForm({ ...form, fullName })} />
          <Input label="Email" value={form.email} onChange={(email) => setForm({ ...form, email })} />
          <Input label="Country" value={form.country} onChange={(country) => setForm({ ...form, country })} />
          <Input label="Address" value={form.address} onChange={(address) => setForm({ ...form, address })} />
          <Input label="Organization" value={form.organization} onChange={(organization) => setForm({ ...form, organization })} />
          <Input label="Role" value={form.role} onChange={(role) => setForm({ ...form, role })} />
          <Input type="password" label="New password optional" value={form.password} onChange={(password) => setForm({ ...form, password })} />
        </section>
        <section className="profileNotificationPanel">
          <div>
            <span className="eyebrow">Messages</span>
            <h2>Notification settings</h2>
            <p>Control the top-left new-message alerts for this account.</p>
          </div>
          <label className="toggleRow">
            <input
              type="checkbox"
              checked={notificationSettings.messageNoticesEnabled !== false}
              onChange={(event) => updateNotifications({ messageNoticesEnabled: event.target.checked, mutedUntil: null })}
            />
            <span>Show new message popups</span>
          </label>
          <div className="notificationStatusRow">
            <span>{notificationStatus(notificationSettings)}</span>
            <button className="secondary" type="button" onClick={() => updateNotifications({ messageNoticesEnabled: true, mutedUntil: null })}>Unmute messages</button>
          </div>
        </section>
        <section className="profileCmdPanel">
          <div className="profileCmdHead">
            <div>
              <span className="eyebrow">Developer access</span>
              <h2><Terminal size={20} /> VERDICT for CMD</h2>
              <p>Install once, pair without a password, and control every trusted terminal from here.</p>
            </div>
            <div className="profileCmdSummary">
              <span><strong>{cmdSessions.filter((session) => session.active).length}</strong> active</span>
              <button className="secondary" disabled={cmdLoading} onClick={refreshCmdSessions} type="button"><RefreshCcw size={15} /> {cmdLoading ? 'Refreshing...' : 'Refresh'}</button>
            </div>
          </div>
          {cmdError && <div className="retryNotice error compact"><div><strong>CMD access could not be loaded.</strong><span>{cmdError}</span></div><button className="secondary" onClick={refreshCmdSessions} type="button">Retry</button></div>}
          <div className="cmdConnectWorkspace">
            <div className="cmdConnectIntro">
              <div className="cmdConnectIcon"><MonitorSmartphone size={27} /></div>
              <div>
                <span className="eyebrow">Connect this account</span>
                <h3>Authorize a terminal in under a minute</h3>
                <p>The Windows setup includes the standalone connector, PATH configuration, updates, uninstall support, and permanent diagnostic logs. Node.js is not required.</p>
              </div>
              <a className="primary cmdInstallerButton" download="VERDICT-Setup-Windows-x64.exe" href={`${connectorServerUrl()}/api/system/cli/files/VERDICT-Setup-Windows-x64.exe`}><Download size={16} /> Download Windows setup</a>
            </div>
            <div className="cmdPairingGrid">
              <div className="cmdPairingSteps">
                <span><i>1</i><strong>Run Windows setup</strong><small>Open <code>VERDICT-Setup-Windows-x64.exe</code>. The result and log location always stay visible.</small></span>
                <span><i>2</i><strong>Create a one-time code</strong><small>Codes expire after five minutes and work once.</small></span>
                <span><i>3</i><strong>Connect from CMD</strong><small>The terminal becomes visible below immediately.</small></span>
              </div>
              <div className={`cmdPairingCard ${pairingCode && pairingSeconds > 0 ? 'ready' : ''}`}>
                {!pairingCode || pairingSeconds <= 0 ? (
                  <div className="cmdPairingEmpty">
                    <KeyRound size={24} />
                    <strong>{pairingCode ? 'Pairing code expired' : 'Ready for secure pairing'}</strong>
                    <span>Generating a new code invalidates any previous unused code.</span>
                    <button className="primary" disabled={cmdLoading} onClick={generatePairingCode} type="button"><KeyRound size={15} /> {cmdLoading ? 'Generating...' : 'Generate pairing code'}</button>
                  </div>
                ) : (
                  <>
                    <div className="cmdPairingMeta"><span><i /> One-time code</span><span><Clock3 size={14} /> {formatCountdown(pairingSeconds)}</span></div>
                    <button className="cmdPairingCode" onClick={() => copyConnectorValue(pairingCode.code, 'code')} title="Copy pairing code" type="button">
                      <strong>{pairingCode.code}</strong>{copied === 'code' ? <Check size={18} /> : <Copy size={18} />}
                    </button>
                    <div className="cmdCommandLine"><code>verdict connect {pairingCode.code} --server {connectorServerUrl()}</code><button onClick={() => copyConnectorValue(`verdict connect ${pairingCode.code} --server ${connectorServerUrl()}`, 'command')} title="Copy command" type="button">{copied === 'command' ? <Check size={16} /> : <Copy size={16} />}</button></div>
                    <div className="cmdPairingActions"><span>Do not share this code.</span><button className="secondary" disabled={cmdLoading} onClick={generatePairingCode} type="button"><RefreshCcw size={14} /> Replace code</button></div>
                  </>
                )}
              </div>
            </div>
            <div className="cmdSecurityStrip">
              <span><ShieldCheck size={17} /><strong>Passwordless pairing</strong></span>
              <span><Clock3 size={17} /><strong>5-minute expiry</strong></span>
              <span><KeyRound size={17} /><strong>Single use</strong></span>
              <span><ShieldOff size={17} /><strong>Instant revoke</strong></span>
            </div>
          </div>
          <div className="cmdDevicesHead"><div><span className="eyebrow">Trusted terminals</span><h3>Connector activity</h3></div><span>{cmdSessions.length} device record{cmdSessions.length === 1 ? '' : 's'}</span></div>
          <div className="profileCmdTable" role="table" aria-label="CMD access sessions">
            <div className="profileCmdRow heading" role="row"><span>Connector</span><span>IP address</span><span>First access</span><span>Last active</span><span>Status</span><span>Action</span></div>
            {cmdSessions.map((session) => (
              <div className="profileCmdRow" role="row" key={session.id}>
                <span><strong>{session.client_name || 'VERDICT CLI'}</strong><small>{session.user_agent || 'Unknown terminal'}</small></span>
                <code>{session.ip_address || 'Unknown'}</code>
                <span>{formatSessionTime(session.created_at)}</span>
                <span>{formatSessionTime(session.last_used_at)}</span>
                <span className={`cmdSessionStatus ${session.active ? 'active' : 'inactive'}`}><i />{session.active ? 'Active' : session.revoked_at ? 'Revoked' : 'Expired'}</span>
                <button className="destructive" disabled={!session.active || cmdLoading} onClick={() => setRevokeTarget(session)} type="button"><ShieldOff size={15} /> Revoke</button>
              </div>
            ))}
            {!cmdLoading && !cmdSessions.length && <div className="profileCmdEmpty"><Terminal size={28} /><strong>No trusted terminals yet</strong><span>Download the installer and use a one-time code to connect your first device.</span></div>}
          </div>
        </section>
      </main>
      {revokeTarget && (
        <div className="candidateSendBackdrop" role="dialog" aria-modal="true" aria-labelledby="revoke-cmd-title">
          <section className="candidateSendModal actionConfirmModal">
            <div className="modalHead"><div><span className="eyebrow">Confirm access revocation</span><h2 id="revoke-cmd-title">Disconnect {revokeTarget.client_name || 'VERDICT CLI'}?</h2></div><button data-dialog-close onClick={() => setRevokeTarget(null)} type="button"><X size={16} /> Close</button></div>
            <div className="deleteConfirmBox"><ShieldOff size={30} /><p>This CMD connector at <strong>{revokeTarget.ip_address || 'an unknown IP'}</strong> will lose access immediately and must log in again.</p></div>
            <div className="editActions"><button className="secondary" onClick={() => setRevokeTarget(null)} type="button">Cancel</button><button className="destructive" disabled={cmdLoading} onClick={revokeCmdAccess} type="button"><ShieldOff size={15} /> Revoke CMD access</button></div>
          </section>
        </div>
      )}
    </div>
  );
}

function profileValidation(form) {
  if (form.fullName.trim().length < 2) return 'Full name is required.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email format is invalid.';
  if (form.country.trim().length < 2) return 'Country is required.';
  if (form.address.trim().length < 6) return 'Address must be at least 6 characters.';
  if (form.password && form.password.length < 8) return 'New password must be at least 8 characters.';
  return '';
}

function notificationSettingsFromUser(user) {
  return {
    messageNoticesEnabled: user?.messageNotificationsEnabled !== false,
    mutedUntil: user?.messageNotificationsMutedUntil || null,
  };
}

function formatSessionTime(value) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unknown' : date.toLocaleString();
}

function connectorServerUrl() {
  if (typeof window === 'undefined') return 'http://localhost:8080';
  return window.location.port === '5173' ? `${window.location.protocol}//${window.location.hostname}:8080` : window.location.origin;
}

function formatCountdown(seconds) {
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`;
}

function notificationStatus(settings) {
  if (settings.messageNoticesEnabled === false) {
    return 'Message popups are muted until you turn them back on.';
  }
  if (settings.mutedUntil && new Date(settings.mutedUntil).getTime() > Date.now()) {
    return `Message popups muted until ${new Date(settings.mutedUntil).toLocaleTimeString()}.`;
  }
  return 'Message popups are active.';
}
