import React, { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { apiUpdateNotificationPreferences, javaApi, normaliseUser } from '../api';
import { Input } from '../components/ui';

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
      </main>
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

function notificationStatus(settings) {
  if (settings.messageNoticesEnabled === false) {
    return 'Message popups are muted until you turn them back on.';
  }
  if (settings.mutedUntil && new Date(settings.mutedUntil).getTime() > Date.now()) {
    return `Message popups muted until ${new Date(settings.mutedUntil).toLocaleTimeString()}.`;
  }
  return 'Message popups are active.';
}
