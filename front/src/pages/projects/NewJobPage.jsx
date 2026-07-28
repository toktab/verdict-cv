import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, FileText, GitCompare, UploadCloud, X } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiCreateProject, normaliseProject } from '../../api';
import './NewJobPage.css';

export function NewJobPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, onProjectsChange }) {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [department, setDepartment] = useState('');
    const [location, setLocation] = useState('');
    const [description, setDescription] = useState('');
    const [mustHave, setMustHave] = useState('');
    const [niceToHave, setNiceToHave] = useState('');
    const [outcomes, setOutcomes] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [uploadFileName, setUploadFileName] = useState('');
    const [dragOver, setDragOver] = useState(false);
    const [rawText, setRawText] = useState('');
    const [showDiff, setShowDiff] = useState(false);
    const fileInputRef = useRef(null);
    const dragCounter = useRef(0);

    const textStats = useMemo(() => computeTextStats(description), [description]);

    function normalizePastedText(raw) {
        return raw
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/[\u200B-\u200D\uFEFF]/g, '')
            .replace(/\n{3,}/g, '\n\n');
    }

    function handleDragEnter(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setDragOver(true);
        }
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    function handleDragLeave(e) {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        if (dragCounter.current <= 0) {
            dragCounter.current = 0;
            setDragOver(false);
        }
    }

    async function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        setDragOver(false);
        dragCounter.current = 0;
        const file = e.dataTransfer.files?.[0];
        if (!file) return;
        e.dataTransfer.clearData();
        await processFile(file);
    }

    async function processFile(file) {
        const name = file.name.toLowerCase();
        if (!name.endsWith('.pdf') && !name.endsWith('.docx') && !name.endsWith('.txt')) {
            setError('Upload a PDF, DOCX, or TXT file.');
            return;
        }
        if (file.size > 8 * 1024 * 1024) {
            setError(`${file.name} is ${formatFileSize(file.size)}. Files must be 8 MB or smaller.`);
            return;
        }

        setShowDiff(false);
        let raw = '';
        if (name.endsWith('.txt')) {
            try {
                raw = await file.text();
                setRawText(raw);
                setDescription(normalizePastedText(raw));
                setUploadFileName(file.name);
            } catch (err) {
                setError(`Could not read ${file.name}: ${err.message}`);
            }
            return;
        }

        setUploading(true);
        setUploadFileName(file.name);
        try {
            const formData = new FormData();
            formData.append('file', file);
            const result = await fetch('/api/projects/extract-text', {
                method: 'POST',
                headers: { 'X-User-Token': userToken },
                body: formData,
            });
            if (!result.ok) {
                const body = await result.json().catch(() => ({}));
                throw new Error(body.message || body.error || `Extraction failed (${result.status})`);
            }
            const { text } = await result.json();
            setRawText(text);
            setDescription(normalizePastedText(text));
        } catch (err) {
            setError(err.message);
            setUploadFileName('');
        } finally {
            setUploading(false);
        }
    }

    function handleDescriptionPaste(event) {
        const pasted = event.clipboardData?.getData('text/plain') || '';
        if (pasted && !rawText) {
            const el = event.target;
            const start = el.selectionStart;
            const end = el.selectionEnd;
            const merged = description.slice(0, start) + pasted + description.slice(end);
            setRawText(merged);
        }
        requestAnimationFrame(() => {
            setDescription((current) => normalizePastedText(current));
        });
    }

    async function handleFileUpload(event) {
        const file = event.target.files?.[0] || null;
        setError('');
        setUploadFileName('');
        if (!file) return;
        event.target.value = '';
        await processFile(file);
    }

    async function createProject() {
        setError('');
        setSaving(true);
        try {
            const mustHaveRows = rubricLines(mustHave);
            const niceToHaveRows = rubricLines(niceToHave);
            const outcomeRows = rubricLines(outcomes);
            const raw = await apiCreateProject({
                title: title.trim(),
                department: department.trim(),
                location: location.trim(),
                description: description.trim(),
                requirements: [...mustHaveRows, ...niceToHaveRows],
                rubric: {
                    mustHave: mustHaveRows.map((label) => ({ label, weight: 3 })),
                    niceToHave: niceToHaveRows.map((label) => ({ label, weight: 1 })),
                    outcomes: outcomeRows.map((label) => ({ label, weight: 2 })),
                },
                state: 'WAR+AI State',
                status: 'Screening',
            }, userToken);
            const project = normaliseProject(raw);
            if (onProjectsChange) await onProjectsChange();
            navigateTo(setRoute, 'projectDetail', project.id);
        } catch (err) {
            setError(err.message);
        } finally {
            setSaving(false);
        }
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="workspace contentFadeIn">
                <section className="detailHero">
                    <div>
                        <span className="eyebrow">{t('newAuditProject')}</span>
                        <h1>{t('addJobDescription')}</h1>
                        <p>{t('newJobText')}</p>
                    </div>
                    <button className="secondary" onClick={() => navigateTo(setRoute, 'projects')}><ArrowRight size={16} /> {t('allJobs')}</button>
                </section>
                <section className="detailMeta">
                    <Metric label={t('step')} value="1 / 2" />
                    <Metric label={t('recordType')} value={t('job')} />
                    <Metric label={t('next')} value={t('addCvs')} />
                    <Metric label={t('state')} value={t('warAiReady')} />
                </section>
                <section className="panel">
                    <div className="panelHead">
                        <div>
                            <h2>{t('jobDescription')}</h2>
                            <p>{t('pasteRole')}</p>
                        </div>
                    </div>
                    <label className="field compactField">
                        <span>{t('jobTitle')}</span>
                        <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Backend Java Developer" />
                    </label>
                    <div className="jobIdentityGrid">
                        <label className="field compactField">
                            <span>Department</span>
                            <input value={department} onChange={(event) => setDepartment(event.target.value)} placeholder="Engineering" />
                        </label>
                        <label className="field compactField">
                            <span>Location</span>
                            <input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Tbilisi / Hybrid" />
                        </label>
                    </div>
                    <div
                        className={`uploadPasteArea ${dragOver ? 'dragOver' : ''}`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        {dragOver && <div className="dragOverlay"><UploadCloud size={28} /><strong>Drop your file here</strong><span>PDF, DOCX, or TXT</span></div>}
                        <div className="uploadPasteToolbar">
                            <label className="smallUploadButton">
                                <input ref={fileInputRef} type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain" onChange={handleFileUpload} />
                                <UploadCloud size={16} />
                                Upload PDF / DOCX / TXT
                            </label>
                            {uploadFileName && (
                                <span className="uploadFileTag">
                                    <FileText size={13} />
                                    {uploadFileName}
                                </span>
                            )}
                            {uploading && <span className="uploadProgress">Extracting text…</span>}
                            {rawText && (
                                <button className="ghost diffToggleBtn" onClick={() => setShowDiff(!showDiff)} type="button">
                                    <GitCompare size={14} />
                                    {showDiff ? 'Close diff' : 'Compare with original'}
                                </button>
                            )}
                            <span className="pasteHint">Paste from PDF: Ctrl+A → Ctrl+C → Ctrl+V here</span>
                        </div>
                        <div className={`jobDescriptionEditor ${description.trim() ? 'hasStats' : ''}`}>
                            <textarea
                                value={description}
                                onChange={(event) => setDescription(event.target.value)}
                                onPaste={handleDescriptionPaste}
                                placeholder="Paste the full job description, requirements, and responsibilities here. Works perfectly with text copied from any PDF reader."
                                spellCheck={false}
                                onDragEnter={(e) => e.stopPropagation()}
                                onDragOver={(e) => e.stopPropagation()}
                                onDragLeave={(e) => e.stopPropagation()}
                                onDrop={(e) => e.stopPropagation()}
                            />
                            {description.trim() && (
                                <div className="textStatsBar">
                                    <span><strong>{textStats.chars.toLocaleString()}</strong> chars</span>
                                    <span className="statDivider" />
                                    <span><strong>{textStats.words.toLocaleString()}</strong> words</span>
                                    <span className="statDivider" />
                                    <span><strong>{textStats.lines.toLocaleString()}</strong> lines</span>
                                    <span className="statDivider" />
                                    <span className={textStats.atsPages > 2 ? 'statWarn' : ''}>
                                        <strong>{textStats.atsLabel}</strong>
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>
                    {showDiff && rawText && (
                        <DiffPanel rawText={rawText} cleanedText={description} onClose={() => setShowDiff(false)} />
                    )}
                </section>
                <section className="panel jobRubricPanel">
                    <div className="panelHead">
                        <div>
                            <span className="eyebrow">Decision rubric</span>
                            <h2>Define what matters before candidates arrive</h2>
                            <p>One item per line. Must-haves carry three times the fit weight of nice-to-haves.</p>
                        </div>
                    </div>
                    <div className="jobRubricGrid">
                        <label>
                            <span>Must-have requirements</span>
                            <textarea rows={7} value={mustHave} onChange={(event) => setMustHave(event.target.value)} placeholder={'Java 17+\nSpring Boot\nREST API design'} />
                        </label>
                        <label>
                            <span>Nice-to-have signals</span>
                            <textarea rows={7} value={niceToHave} onChange={(event) => setNiceToHave(event.target.value)} placeholder={'RabbitMQ\nDocker\nCloud deployment'} />
                        </label>
                        <label>
                            <span>Expected outcomes</span>
                            <textarea rows={7} value={outcomes} onChange={(event) => setOutcomes(event.target.value)} placeholder={'Ship a production API\nImprove test coverage\nReview team pull requests'} />
                        </label>
                    </div>
                </section>
                {error && <div className="error">{error}</div>}
                <section className="commandbar">
                    <button className="primary" disabled={!title.trim() || !description.trim() || saving} onClick={createProject}>
                        <BriefcaseBusiness size={18} /> {saving ? 'Saving…' : t('createJobProject')}
                    </button>
                    <Metric label={t('descriptionChars')} value={description.length} />
                </section>
            </main>
        </div>
    );
}

function rubricLines(value) {
    return String(value || '')
        .split(/\r?\n/)
        .map((row) => row.replace(/^[-*]\s*/, '').trim())
        .filter(Boolean);
}

function formatFileSize(size) {
    if (!Number.isFinite(size)) return '0 KB';
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
}

function DiffPanel({ rawText, cleanedText, onClose }) {
    const diffStats = useMemo(() => computeDiffStats(rawText, cleanedText), [rawText, cleanedText]);
    const lineChanges = useMemo(() => {
        const rawLines = rawText.split('\n');
        const cleanedLines = cleanedText.split('\n');
        const maxLines = Math.max(rawLines.length, cleanedLines.length);
        const changes = [];
        for (let i = 0; i < maxLines; i++) {
            const raw = rawLines[i] ?? '';
            const cleaned = cleanedLines[i] ?? '';
            if (raw !== cleaned) {
                changes.push({
                    line: i + 1,
                    raw: raw || '(empty)',
                    cleaned: cleaned || '(empty)',
                    type: raw === '' ? 'added' : cleaned === '' ? 'removed' : 'modified',
                });
            }
        }
        return changes;
    }, [rawText, cleanedText]);

    return (
        <div className="diffPanel">
            <div className="diffPanelHead">
                <span className="eyebrow">Extraction diff</span>
                <div>
                    <span className="diffStat"><span className="diffStatDot removed" /> {diffStats.removedChars} chars removed</span>
                    <span className="diffStat"><span className="diffStatDot replaced" /> {diffStats.crlfCount} CRLF → LF</span>
                    <span className="diffStat"><span className="diffStatDot stripped" /> {diffStats.zeroWidthCount} zero-width chars stripped</span>
                    <span className="diffStat"><span className="diffStatDot collapsed" /> {diffStats.collapsedLines} blank line{ diffStats.collapsedLines !== 1 ? 's' : ''} collapsed</span>
                </div>
                <button className="ghost" onClick={onClose} type="button"><X size={16} /></button>
            </div>
            <div className="diffPanelBody">
                <div className="diffColumn">
                    <span className="diffColumnHead">Original <small>({rawText.length} chars)</small></span>
                    <div className="diffText">
                        {rawText.split('').map((char, idx) => {
                            if (char === '\r') return <mark key={idx} className="diffRemoved" title="Carriage return (CR)">\r</mark>;
                            if (/[\u200B-\u200D\uFEFF]/.test(char)) return <mark key={idx} className="diffRemoved" title="Zero-width character">\u{char.charCodeAt(0).toString(16)}</mark>;
                            if (char === '\n') return '\n';
                            return char;
                        })}
                    </div>
                </div>
                <div className="diffColumn">
                    <span className="diffColumnHead">Processed <small>({cleanedText.length} chars)</small></span>
                    <div className="diffText">{cleanedText}</div>
                </div>
            </div>
            {lineChanges.length > 0 && (
                <div className="diffLineChanges">
                    <span className="diffColumnHead">Line changes <small>({lineChanges.length} line{lineChanges.length !== 1 ? 's' : ''} affected)</small></span>
                    <div className="diffLineGrid">
                        <span className="diffLineHead">#</span>
                        <span className="diffLineHead">Original</span>
                        <span className="diffLineHead">Processed</span>
                        {lineChanges.slice(0, 50).map((change) => (
                            <React.Fragment key={change.line}>
                                <span className="diffLineNum">{change.line}</span>
                                <span className={`diffLineCell ${change.type === 'added' ? 'cellAdded' : change.type === 'removed' ? 'cellRemoved' : 'cellModified'}`}>{change.raw}</span>
                                <span className={`diffLineCell ${change.type === 'added' ? 'cellAdded' : change.type === 'removed' ? 'cellRemoved' : 'cellModified'}`}>{change.cleaned}</span>
                            </React.Fragment>
                        ))}
                        {lineChanges.length > 50 && <span className="diffLineMore">… and {lineChanges.length - 50} more changed lines</span>}
                    </div>
                </div>
            )}
        </div>
    );
}

function computeDiffStats(raw, cleaned) {
    const crlfPairs = (raw.match(/\r\n/g) || []).length;
    const standaloneCr = (raw.match(/(?<!\n)\r(?!\n)/g) || []).length;
    const crlfCount = crlfPairs + standaloneCr;
    const zeroWidthCount = (raw.match(/[\u200B-\u200D\uFEFF]/g) || []).length;
    const collapsedRaw = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/[\u200B-\u200D\uFEFF]/g, '');
    const extraBlankCount = (collapsedRaw.match(/\n{3,}/g) || []).reduce((sum, m) => sum + m.length - 2, 0);
    const removedChars = raw.length - cleaned.length;
    return { crlfCount, zeroWidthCount, collapsedLines: extraBlankCount, removedChars };
}

function computeTextStats(text) {
    const chars = text.length;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const lines = text.split(/\r?\n/).length;
    const rawPages = (chars / 3500);
    const atsPages = Math.max(0.5, Math.round(rawPages * 10) / 10);
    const atsLabel = rawPages < 0.5 ? '< 1 page' : atsPages + (atsPages === 1 ? ' page' : ' pages');
    return { chars, words, lines, atsPages, atsLabel };
}
