import { useState } from 'react';
import { History, Play, RefreshCcw, ShieldCheck } from 'lucide-react';
import { useLanguage } from '../i18n';
import { navigateTo } from '../navigation';

export function DashboardPage({ Header, Metric, SkeletonBlock, setRoute, user, userToken, setUser, setUserToken, history, templates, historyLoading, historyError, onRefreshHistory, openAudit }) {
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
                        <div className="historyHead">
                            <h2><History size={18} /> Recent audits</h2>
                            <button className="secondary" disabled={historyLoading} onClick={onRefreshHistory} type="button">
                                <RefreshCcw size={15} /> {historyLoading ? 'Refreshing...' : 'Refresh'}
                            </button>
                        </div>
                        <TemplateLensBar filters={templateFilters} value={templateFilter} onChange={setTemplateFilter} />
                        {historyError && <div className="error compact">Could not load audits. {historyError}</div>}
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

function DashboardLensButton({ filter, value, onChange }) {
    return <button className={value === filter.id ? 'active' : ''} onClick={() => onChange(filter.id)}>{filter.name}</button>;
}

function TemplateLensBar({ filters, value, onChange }) {
    return <div className="templateLensBar">{filters.map((filter) => <DashboardLensButton filter={filter} key={filter.id} value={value} onChange={onChange} />)}</div>;
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

function templateFilterOptions(history, templates = []) {
    const used = new Map();
    history.forEach((audit) => used.set(audit.templateId || 'NO_TEMPLATE', audit.templateName || 'No template'));
    templates.forEach((template) => {
        if (used.has(template.id)) used.set(template.id, template.name);
    });
    return [{ id: 'ALL', name: 'All templates' }, ...Array.from(used.entries()).map(([id, name]) => ({ id, name }))];
}

function filterAuditsByTemplate(history, templateFilter) {
    if (templateFilter === 'ALL') return history;
    if (templateFilter === 'NO_TEMPLATE') return history.filter((audit) => !audit.templateId);
    return history.filter((audit) => audit.templateId === templateFilter);
}
