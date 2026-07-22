import { Suspense, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { DialogKeyboardManager } from './components/DialogKeyboardManager';
import { GlobalCompose } from './components/GlobalCompose';
import { navigateTo } from './navigation';
import { apiUpdateNotificationPreferences } from './api/authApi';
import { clearUserToken } from './sessionAuth';

function Loading({ stage }) {
    return (
        <div className="loading">
            <div className="_v_spinner" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.12)', borderTopColor: '#fff', borderRadius: '50%', animation: '_v_spin 0.9s linear infinite', display: 'inline-block', marginRight: 8 }} />
            <strong>{stage || 'Loading'}</strong>
        </div>
    );
}

function SkeletonBlock({ rows = 3, compact = false }) {
    return (
        <div className={`skeletonBlock ${compact ? 'compact' : ''}`}>
            {Array.from({ length: rows }, (_, index) => (
                <span key={index} />
            ))}
        </div>
    );
}

export function RouteLoadingFallback() {
    return (
        <div className="shell">
            <main className="workspace routeChunkLoading" aria-live="polite">
                <Loading stage="LOADING WORKSPACE" />
                <SkeletonBlock rows={6} />
            </main>
        </div>
    );
}

export function MessageNoticeToast({ message, onDismiss, onGo, onMute }) {
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
                    <button className="secondary" type="button" onClick={() => setMenuOpen((open) => !open)}>
                        Ignore for <ChevronDown size={14} />
                    </button>
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

export default function AppShell({
    route,
    user,
    userToken,
    setUser,
    setUserToken,
    composeOpen,
    composeDraft,
    setComposeOpen,
    setComposeDraft,
    messageNotice,
    setMessageNotice,
    content,
    onLogout,
}) {
    return (
        <>
            <DialogKeyboardManager />
            <ErrorBoundary
                key={route}
                resetKey={`${route}`}
                route={route}
                onDashboard={() => navigateTo((r) => r, userToken ? 'dashboard' : 'home')}
                onProjects={() => navigateTo((r) => r, userToken ? 'projects' : 'home')}
                onLogout={onLogout}
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
                    navigateTo((r) => r, 'messages');
                }}
                onMute={async (duration) => {
                    const updated = await apiUpdateNotificationPreferences(
                        {
                            enabled: duration !== 'forever',
                            mutedUntil: duration === 'forever'
                                ? null
                                : new Date(Date.now() + ({ '5m': 300000, '15m': 900000, '1h': 3600000 }[duration] || 0)).toISOString(),
                        },
                        userToken
                    ).catch(() => null);
                    if (updated) setUser(updated);
                    setMessageNotice(null);
                }}
            />
        </>
    );
}
