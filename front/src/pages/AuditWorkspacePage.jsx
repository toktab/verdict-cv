import { useState } from 'react';
import { CheckCircle2, FileSearch, History, Play, RefreshCcw, X } from 'lucide-react';
import { AuditTemplatePanel, CheckStatePanel } from '../components/AuditConfigurationPanels';
import { AuditResult } from './AuditAnalysisPages';
import { currentAuditMode, demoCases } from '../data/auditWorkspaceDefaults';
import { navigateTo } from '../navigation';

const ACCEPTED_AUDIT_FILES = '.pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain';

export function AuditWorkspacePage({
    Header,
    setRoute,
    user,
    userToken,
    setUser,
    setUserToken,
    form,
    setForm,
    audit,
    history,
    templates,
    states,
    templateForm,
    setTemplateForm,
    templateLoading,
    historyLoading,
    historyError,
    uploadingField,
    lastAuditUpload,
    loading,
    stage,
    error,
    setError,
    selectedDemoId,
    setSelectedDemoId,
    demoConfirmOpen,
    setDemoConfirmOpen,
    demoCountdown,
    onLoadDemo,
    onConfirmDemo,
    onSaveTemplate,
    onRunAudit,
    onUploadFile,
    onRetryUpload,
    onRefreshHistory,
    onOpenAudit,
    onTrack,
}) {
    const mode = currentAuditMode(form);
    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="workspace contentFadeIn">
                {!userToken && <div className="error">Sign in or create an organizer account before running private candidate audits.</div>}
                {userToken && <PrivateWorkspaceSummary history={history} user={user} />}
                <FirstRunGuide form={form} hasAudits={history.length > 0} onLoadDemo={onLoadDemo} setRoute={setRoute} signedIn={Boolean(userToken)} states={states} templates={templates} />
                <section className="intake">
                    <DocumentPanel
                        disabled={!userToken || uploadingField === 'claim'}
                        field="claim"
                        label="Claim title"
                        onChange={(claimTitle) => setForm({ ...form, claimTitle })}
                        onTextChange={(claimText) => setForm({ ...form, claimText })}
                        onUpload={onUploadFile}
                        subtitle={mode.claimSubtitle}
                        text={form.claimText}
                        title={mode.claimTitle}
                        titleValue={form.claimTitle}
                        uploading={uploadingField === 'claim'}
                    />
                    <DocumentPanel
                        disabled={!userToken || uploadingField === 'evidence'}
                        field="evidence"
                        label="Evidence title"
                        onChange={(evidenceTitle) => setForm({ ...form, evidenceTitle })}
                        onTextChange={(evidenceText) => setForm({ ...form, evidenceText })}
                        onUpload={onUploadFile}
                        subtitle={mode.evidenceSubtitle}
                        text={form.evidenceText}
                        title={mode.evidenceTitle}
                        titleValue={form.evidenceTitle}
                        uploading={uploadingField === 'evidence'}
                    />
                </section>
                {userToken && (
                    <>
                        {templateLoading ? <SkeletonBlock rows={4} /> : <AuditTemplatePanel mode={form.auditMode || 'cv'} templates={templates} selectedId={form.templateId || ''} onSelect={(templateId) => setForm({ ...form, templateId })} templateForm={templateForm} setTemplateForm={setTemplateForm} onSave={onSaveTemplate} />}
                        <CheckStatePanel states={states} selectedId={form.checkStateId || ''} onSelect={(checkStateId) => setForm({ ...form, checkStateId })} />
                    </>
                )}
                <section className="commandbar">
                    <div className="demoPicker">
                        <select aria-label="Demo audit case" value={selectedDemoId} onChange={(event) => setSelectedDemoId(event.target.value)}>
                            {demoCases.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                        </select>
                        <button className="secondary" onClick={() => { onTrack?.('load_demo_case', 'commandbar', selectedDemoId); setDemoConfirmOpen(true); }} type="button">Load demo</button>
                    </div>
                    <button className="primary" disabled={loading || !userToken} onClick={onRunAudit} type="button"><Play size={18} /> {mode.actionCopy}</button>
                    <Metric label="Claim chars" value={form.claimText.length} />
                    <Metric label="Evidence chars" value={form.evidenceText.length} />
                </section>
                {error && <WorkspaceRetry error={error} loading={loading} onDismiss={() => setError('')} onRetryAudit={onRunAudit} onRetryUpload={onRetryUpload} uploadingField={uploadingField} userToken={userToken} hasUpload={Boolean(lastAuditUpload)} />}
                {loading && <><Loading stage={stage} /><SkeletonBlock rows={5} /></>}
                {audit && <AuditResult audit={audit} setRoute={setRoute} />}
                <HistoryPanel history={history} templates={templates} loading={historyLoading} error={historyError} onRefresh={onRefreshHistory} openAudit={onOpenAudit} />
            </main>
            {demoConfirmOpen && <DemoConfirmModal countdown={demoCountdown} onCancel={() => setDemoConfirmOpen(false)} onConfirm={onConfirmDemo} />}
        </div>
    );
}

function PrivateWorkspaceSummary({ history, user }) {
    return <section className="privateStrip"><div><span className="eyebrow">Private workspace</span><strong>{user?.fullName || user?.username || 'Signed-in user'}</strong></div><Metric label="My audits" value={history.length} /><Metric label="Last activity" value={history[0]?.createdAt ? new Date(history[0].createdAt).toLocaleDateString() : 'None'} /></section>;
}

function DocumentPanel({ disabled, field, label, onChange, onTextChange, onUpload, subtitle, text, title, titleValue, uploading }) {
    return (
        <section className="panel">
            <div className="panelHead"><div><h2>{title}</h2><p>{subtitle}</p></div></div>
            <label className="field"><span>{label}</span><input type="text" value={titleValue || ''} onChange={(event) => onChange(event.target.value)} /></label>
            <label className="auditFileButton"><FileSearch size={16} />{uploading ? 'Reading file...' : 'Upload PDF, DOCX, or TXT'}<input type="file" accept={ACCEPTED_AUDIT_FILES} onChange={(event) => onUpload(field, event)} disabled={disabled} /></label>
            <textarea value={text || ''} onChange={(event) => onTextChange(event.target.value)} />
        </section>
    );
}

function WorkspaceRetry({ error, loading, onDismiss, onRetryAudit, onRetryUpload, uploadingField, userToken, hasUpload }) {
    return <div className="retryNotice error" role="alert"><div><strong>Something needs another try.</strong><span>{error}</span></div><div className="retryActions"><button className="secondary" disabled={loading || !userToken} onClick={onRetryAudit} type="button"><RefreshCcw size={15} /> Retry audit</button>{hasUpload && <button className="secondary" disabled={Boolean(uploadingField)} onClick={onRetryUpload} type="button"><FileSearch size={15} /> Retry upload</button>}<button className="secondary" onClick={onDismiss} type="button">Dismiss</button></div></div>;
}

function DemoConfirmModal({ countdown, onCancel, onConfirm }) {
    return <div className="modalOverlay" role="dialog" aria-modal="true" aria-labelledby="demo-confirm-title"><section className="modal demoModal"><div className="modalHead"><div><h2 id="demo-confirm-title">Load demo case?</h2><span>This will replace the text currently in the audit form.</span></div><button onClick={onCancel} type="button"><X size={18} /> Cancel</button></div><div className="demoCountdown"><strong>{countdown}</strong><span>Confirm unlocks after the countdown.</span></div><div className="editActions"><button className="primary" disabled={countdown > 0} onClick={onConfirm} type="button"><Play size={16} /> Yes, load demo</button><button onClick={onCancel} type="button">Keep current text</button></div></section></div>;
}

function FirstRunGuide({ form, hasAudits, onLoadDemo, setRoute, signedIn, states, templates }) {
    if (hasAudits) return null;
    const sampleLoaded = Boolean(form.claimText?.trim() && form.evidenceText?.trim());
    const checks = [
        { label: signedIn ? 'Signed in' : 'Sign in or create account', done: signedIn },
        { label: sampleLoaded ? 'Sample evidence loaded' : 'Load a realistic sample', done: sampleLoaded },
        { label: form.templateId || templates.length ? 'Template ready' : 'Template library loading', done: Boolean(form.templateId || templates.length) },
        { label: form.checkStateId || states.length ? 'Audit state ready' : 'Audit states loading', done: Boolean(form.checkStateId || states.length) },
    ];
    return <section className="firstRunGuide"><div><span className="eyebrow">First run</span><h2>Get to a trustable audit in under a minute</h2><p>Use a seeded CV and evidence pack, review the template/state, then run the audit from the command bar.</p></div><div className="firstRunChecks">{checks.map((check) => <span className={check.done ? 'done' : ''} key={check.label}><CheckCircle2 size={15} /> {check.label}</span>)}</div><div className="firstRunActions">{!signedIn && <button className="primary" onClick={() => navigateTo(setRoute, 'login')} type="button">Sign in</button>}{!signedIn && <button className="secondary" onClick={() => navigateTo(setRoute, 'register')} type="button">Create account</button>}<button className={sampleLoaded ? 'secondary' : 'primary'} onClick={onLoadDemo} type="button">Load sample CV</button></div></section>;
}

function HistoryPanel({ history, templates, loading, error, onRefresh, openAudit }) {
    const [templateFilter, setTemplateFilter] = useState('ALL');
    const filteredHistory = filterAuditsByTemplate(history, templateFilter);
    return <section className="history"><div className="historyHead"><h2><History size={18} /> My Audit History</h2><button className="secondary" disabled={loading} onClick={onRefresh} type="button"><RefreshCcw size={15} /> {loading ? 'Refreshing...' : 'Refresh'}</button></div><TemplateLensBar filters={templateFilterOptions(history, templates)} value={templateFilter} onChange={setTemplateFilter} />{error && <div className="error compact">Could not load audits. {error}</div>}<div className="historyRows">{loading && <SkeletonBlock rows={5} compact />}{!loading && filteredHistory.length === 0 && <div className="emptyState">No audits match this template lens.</div>}{filteredHistory.map((item) => <button key={item.id} onClick={() => openAudit(item.id)} type="button"><span>#{item.id} {item.claimTitle} / {item.templateName || 'No template'}</span><strong>{item.credibilityScore}%</strong></button>)}</div></section>;
}

function TemplateLensBar({ filters, value, onChange }) {
    return <div className="templateLensBar">{filters.map((filter) => <button key={filter.id} className={value === filter.id ? 'active' : ''} onClick={() => onChange(filter.id)} type="button">{filter.name}</button>)}</div>;
}

function templateFilterOptions(history, templates = []) {
    const used = new Map();
    history.forEach((audit) => used.set(audit.templateId || 'NO_TEMPLATE', audit.templateName || 'No template'));
    templates.forEach((template) => { if (used.has(template.id)) used.set(template.id, template.name); });
    return [{ id: 'ALL', name: 'All templates' }, ...Array.from(used.entries()).map(([id, name]) => ({ id, name }))];
}

function filterAuditsByTemplate(history, templateFilter) {
    if (templateFilter === 'ALL') return history;
    if (templateFilter === 'NO_TEMPLATE') return history.filter((audit) => !audit.templateId);
    return history.filter((audit) => audit.templateId === templateFilter);
}

function Metric({ label, value }) {
    return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}

function Loading({ stage }) {
    return <div className="loading"><RefreshCcw size={18} /><strong>{stage || 'Loading'}</strong></div>;
}

function SkeletonBlock({ rows = 3, compact = false }) {
    return <div className={`skeletonBlock ${compact ? 'compact' : ''}`} aria-hidden="true">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}
