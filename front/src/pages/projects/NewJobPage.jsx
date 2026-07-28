import { useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, FileText, UploadCloud } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiCreateProject, normaliseProject } from '../../api';
import './NewJobPage.css';

export function NewJobPage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, onProjectsChange }) {
    const { t } = useLanguage();
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
    const fileInputRef = useRef(null);
    const dragCounter = useRef(0);

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

        if (name.endsWith('.txt')) {
            try {
                const text = await file.text();
                setDescription(normalizePastedText(text));
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
            setDescription(normalizePastedText(text));
        } catch (err) {
            setError(err.message);
            setUploadFileName('');
        } finally {
            setUploading(false);
        }
    }

    function handleDescriptionPaste() {
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
                            <span className="pasteHint">Paste from PDF: Ctrl+A → Ctrl+C → Ctrl+V here</span>
                        </div>
                        <div className="jobDescriptionEditor">
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
                        </div>
                    </div>
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
