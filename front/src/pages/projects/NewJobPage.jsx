import { useState } from 'react';
import { ArrowRight, BriefcaseBusiness } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiCreateProject, normaliseProject } from '../../api';
import './NewJobPage.css';

export function NewJobPage({ Header, Metric, Textarea, navigateTo, setRoute, user, userToken, setUser, setUserToken, onProjectsChange }) {
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
                    <div className="jobDescriptionEditor">
                        <Textarea value={description} onChange={setDescription} />
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
