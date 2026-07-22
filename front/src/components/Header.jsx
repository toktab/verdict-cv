import { useState } from 'react';
import {
    ChevronDown, Gauge, History, LayoutDashboard, Lock, LogOut,
    Mail, Menu, User, UserPlus, X,
} from 'lucide-react';
import { useLanguage } from '../i18n';
import { apiLogout } from '../api/authApi';
import { clearUserToken } from '../sessionAuth';
import { navigateTo } from '../navigation';

function track(action, target = '', detail = '') {
    fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, target, detail }),
    }).catch(() => null);
}

export default function Header({ setRoute, user, userToken, setUser, setUserToken, unreadMessages = 0 }) {
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
            await apiLogout(userToken).catch(() => null);
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
