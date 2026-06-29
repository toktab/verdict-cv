import { useState } from 'react';
import { ArrowRight, BriefcaseBusiness } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiCreateProject, normaliseProject } from '../../api';

export function NewJobPage({ Header, Metric, Textarea, navigateTo, setRoute, user, userToken, setUser, setUserToken, onProjectsChange }) {
    const { t } = useLanguage();
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    async function createProject() {
        setError('');
        setSaving(true);
        try {
            const raw = await apiCreateProject({
                title: title.trim(),
                description: description.trim(),
                requirements: [],
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
                    <Textarea value={description} onChange={setDescription} />
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
