import { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, FileSearch, FileText, Play, UploadCloud } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiAddCandidate, apiUploadCandidateResume } from '../../api';
import { findCatchphraseMatches } from '../../utils/catchphraseAnalyzer';
import { findProjectFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

export function AddCandidatePage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false, onProjectsChange }) {
    const { t } = useLanguage();
    const project = findProjectFromPath(projects);
    const [candidateName, setCandidateName] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [cvText, setCvText] = useState('');
    const [savedAuditMatches, setSavedAuditMatches] = useState([]);
    const [reviewSummary, setReviewSummary] = useState('');
    const [stage, setStage] = useState('');
    const [analyzed, setAnalyzed] = useState(false);
    const [error, setError] = useState('');
    const localDetectedMatches = useMemo(() => findCatchphraseMatches(cvText), [cvText]);
    const detectedMatches = savedAuditMatches.length ? savedAuditMatches : localDetectedMatches;
    const highRiskCount = detectedMatches.filter((match) => match.risk === 'High').length;
    const mediumRiskCount = detectedMatches.filter((match) => match.risk === 'Medium').length;

    if (!project) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} title="Project not found" message="Choose an existing project before adding a candidate." />;

    }

    async function analyzeCandidate() {
        if (!resumeFile && !cvText.trim()) {
            setError('Paste CV text or upload a PDF/DOCX resume.');
            return;
        }
        setAnalyzed(false);
        setReviewSummary('');
        setSavedAuditMatches([]);
        setError('');
        const stages = [resumeFile ? 'UPLOADING RESUME' : 'READING PASTED CV', 'TRANSCRIBING CV', 'EXTRACTING CLAIMS', 'CHECKING CONSENT GATE', 'WRITING REVIEW RECORD'];
        let index = 0;
        setStage(stages[index]);
        const timer = setInterval(() => {
            index += 1;
            if (index >= stages.length) {
                clearInterval(timer);
                setStage('');
            } else {
                setStage(stages[index]);
            }
        }, 520);

        try {
            const saved = resumeFile
                ? await apiUploadCandidateResume(project.id, {
                    name: candidateName || 'Unnamed candidate',
                    role: '',
                    resume: resumeFile,
                }, userToken)
                : await apiAddCandidate(project.id, {
                    name: candidateName || 'Unnamed candidate',
                    role: '',
                    cvText,
                }, userToken);
            setCvText(saved.cv_text || saved.cvText || '');
            setSavedAuditMatches(saved.audit_phrase_matches || saved.auditPhraseMatches || []);
            setReviewSummary(saved.summary || '');
            if (onProjectsChange) await onProjectsChange();
            setAnalyzed(true);
        } catch (err) {
            setError(err.message);
            setAnalyzed(true);
        } finally {
            clearInterval(timer);
            setStage('');
        }
    }

    function chooseResume(event) {
        const file = event.target.files?.[0] || null;
        setAnalyzed(false);
        setSavedAuditMatches([]);
        setReviewSummary('');
        setError('');
        if (!file) {
            setResumeFile(null);
            return;
        }
        const name = file.name.toLowerCase();
        if (!name.endsWith('.pdf') && !name.endsWith('.docx')) {
            setResumeFile(null);
            setError('Upload a PDF or DOCX resume.');
            return;
        }
        setResumeFile(file);
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="workspace contentFadeIn">
                <section className="detailHero">
                    <div>
                        <span className="eyebrow">{t('addCandidate')}</span>
                        <h1>{project.title}</h1>
                        <p>{t('addCandidateText')}</p>
                    </div>
                    <button className="secondary" onClick={() => navigateTo(setRoute, 'projectDetail', project.id)}><ArrowRight size={16} /> {t('backToJob')}</button>
                </section>

                <section className="detailMeta">
                    <Metric label={t('job')} value={project.title} />
                    <Metric label={t('state')} value={project.state} />
                    <Metric label={t('existingCvs')} value={project.candidates.length} />
                    <Metric label={t('status')} value={project.status} />
                </section>

                <section className="intake">
                    <section className="panel">
                        <div className="panelHead">
                            <div>
                                <h2>{t('jobDescription')}</h2>
                                <p>{t('jobDescriptionFixed')}</p>
                            </div>
                        </div>
                        <pre className="jobDescriptionBox">{project.description + `\n\n${t('requirements')}:\n- ` + project.requirements.join('\n- ')}</pre>
                    </section>
                    <section className="panel">
                        <div className="panelHead candidatePanelHead">
                            <div>
                                <h2>{t('candidateCvResume')}</h2>
                                <p>{t('uploadCandidateResume')}</p>
                            </div>
                            <label className="smallUploadButton">
                                <input type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" onChange={chooseResume} />
                                <UploadCloud size={16} />
                                Upload PDF/DOCX
                            </label>
                        </div>
                        <label className="field compactField">
                            <span>{t('candidateName')}</span>
                            <input value={candidateName} onChange={(event) => setCandidateName(event.target.value)} placeholder={t('candidateName')} />
                        </label>
                        {resumeFile && (
                            <div className="resumeFileMeta">
                                <FileText size={16} />
                                <span>{resumeFile.type || 'resume file'}</span>
                                <strong>{formatFileSize(resumeFile.size)}</strong>
                            </div>
                        )}
                        <label className="field candidatePasteField">
                            <span>Paste CV / resume text</span>
                            <textarea
                                value={cvText}
                                onChange={(event) => {
                                    setCvText(event.target.value);
                                    setSavedAuditMatches([]);
                                    setAnalyzed(false);
                                }}
                                placeholder="Paste the candidate CV, LinkedIn summary, portfolio notes, or application answers here."
                            />
                        </label>
                    </section>
                </section>

                <section className="commandbar">
                    <button className="primary" disabled={(!resumeFile && !cvText.trim()) || Boolean(stage)} onClick={analyzeCandidate}>
                        <Play size={18} /> {t('analyzeCandidate')}
                    </button>
                    <Metric label={t('resumeFile')} value={resumeFile ? formatFileSize(resumeFile.size) : cvText.trim() ? 'Pasted text' : 'None'} />
                    <Metric label={t('jobRequirements')} value={project.requirements.length} />
                    <Metric label={t('detectedPhrases')} value={detectedMatches.length} />
                </section>

                {error && <div className="error">{error}</div>}

                {stage && (
                    <div className="loading">
                        <FileSearch size={18} />
                        <strong>{stage}</strong>
                    </div>
                )}

                {analyzed && (
                    <section className="analysisComplete">
                        <div>
                            <span className="eyebrow">{t('patternReady')}</span>
                            <h2>{t('scoredAgainst', { name: candidateName || t('newCandidate'), job: project.title })}</h2>
                            <p>{reviewSummary || t('foundPhrases', { total: detectedMatches.length, high: highRiskCount, medium: mediumRiskCount })}</p>
                        </div>
                        <button className="primary" onClick={() => navigateTo(setRoute, 'projectDetail', project.id)}>{t('returnToCandidateTable')}</button>
                    </section>
                )}

                {analyzed && (
                    <section className="catchphrasePanel">
                        <div className="panelHead">
                            <div>
                                <h2>{t('detectedAuditPhrases')}</h2>
                                <p>{t('readFromJson')}</p>
                            </div>
                            <div className="catchphraseStats">
                                <span>{highRiskCount} {t('high')}</span>
                                <span>{mediumRiskCount} {t('medium')}</span>
                                <span>{Math.max(0, detectedMatches.length - highRiskCount - mediumRiskCount)} {t('low')}</span>
                            </div>
                        </div>
                        {detectedMatches.length ? (
                            <div className="catchphraseRows">
                                {detectedMatches.slice(0, 18).map((match) => (
                                    <article className={`catchphraseRow ${match.severity}`} key={match.id}>
                                        <div className="catchphraseTopline">
                                            <strong>{match.text}</strong>
                                            <span className={`riskBadge ${match.severity}`}>{match.risk}</span>
                                        </div>
                                        <small>{match.label} / {match.category}</small>
                                        <p>{match.why}</p>
                                        <em>{match.safer}</em>
                                    </article>
                                ))}
                            </div>
                        ) : (
                            <div className="emptyState">
                                <AlertTriangle size={18} />
                                {t('noCatchphrases')}
                            </div>
                        )}
                    </section>
                )}
            </main>
        </div>
    );
}

function formatFileSize(size) {
    if (!Number.isFinite(size)) return '0 KB';
    if (size >= 1024 * 1024) return `${(size / (1024 * 1024)).toFixed(1)} MB`;
    return `${Math.max(1, Math.round(size / 1024))} KB`;
}
