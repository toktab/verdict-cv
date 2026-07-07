import { useMemo } from 'react';
import { ArrowRight, FileText, Printer, RefreshCcw, Sparkles } from 'lucide-react';
import { buildAtsReport, candidateSourceText, projectDescriptionText, splitTextByTerms } from './atsReportUtils';
import { findCandidateFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

export function CandidateProfilePage({ Header, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false }) {
    const { project, candidate } = findCandidateFromPath(projects);
    const report = useMemo(() => project && candidate ? buildAtsReport(project, candidate) : null, [project, candidate]);
    const resumeText = useMemo(() => candidate ? candidateSourceText(candidate) : '', [candidate]);
    const jobText = useMemo(() => project ? projectDescriptionText(project) : '', [project]);

    if (!project || !candidate) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow={project ? 'Profiling' : undefined} title={project ? 'Candidate profile not found' : undefined} message={project ? 'This profiling route points to a candidate that is unavailable.' : undefined} />;
    }

    return (
        <div className="shell atsScanShell">
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="atsScanWorkspace contentFadeIn">
                <aside className="atsScoreSidebar">
                    <h2>Match Rate</h2>
                    <ScoreDonut score={report.score} />
                    <button className="atsBlueButton" type="button" onClick={() => navigateTo(setRoute, 'addCandidate', project.id)}><RefreshCcw size={16} /> Upload & rescan</button>
                    <button className="atsPaleButton" type="button" onClick={() => navigateTo(setRoute, 'candidateDetail', project.id, candidate.id)}><Sparkles size={16} /> AI Optimize</button>
                    <div className="atsProgressList">
                        {report.categories.map((category) => <ProgressRow key={category.label} category={category} />)}
                    </div>
                </aside>
                <section className="atsScanMain">
                    <header className="atsScanTopbar">
                        <button className="secondary" type="button" onClick={() => navigateTo(setRoute, 'candidateDetail', project.id, candidate.id)}><ArrowRight size={16} /> Back</button>
                        <div>
                            <span>Resume scan results</span>
                            <h1>{project.title}</h1>
                            <p>{candidate.name} / {candidate.role}</p>
                        </div>
                        <button className="secondary" type="button" onClick={() => window.print()}><Printer size={16} /> Print</button>
                    </header>
                    <article className="atsCompareCanvas">
                        <div className="atsCompareHeader">
                            <div>
                                <span className="eyebrow">Side-by-side profiling</span>
                                <h2>CV and job description in one workspace</h2>
                            </div>
                            <p>Use this mode for comparison only. The main candidate page keeps the score, activity, recruiter tips, and workflow controls.</p>
                        </div>
                        <div className="atsCompareSheets">
                            <section className="atsDocumentSheet compactCompare">
                                <h2>{candidate.name}</h2>
                                <p className="atsDocumentSubline">Candidate CV</p>
                                <div className="atsHighlightedDocument">
                                    {renderHighlighted(resumeText, report.skills)}
                                </div>
                            </section>
                            <section className="atsDocumentSheet compactCompare">
                                <h2>{project.title}</h2>
                                <p className="atsDocumentSubline">Job Description</p>
                                <div className="atsHighlightedDocument">
                                    {renderHighlighted(jobText, report.skills)}
                                </div>
                            </section>
                        </div>
                    </article>
                    <section className="atsHighlightLegend">
                        <span className="atsLegendPill matching">Matching Skill</span>
                        <span className="atsLegendPill variation">Skill Variation</span>
                        <span className="atsLegendPill missing">Missing Skill</span>
                        <button type="button" onClick={() => navigateTo(setRoute, 'candidateReport', project.id, candidate.id)}><FileText size={16} /> Open Match Report</button>
                    </section>
                </section>
            </main>
        </div>
    );
}

export function ScoreDonut({ score }) {
    return (
        <div className="atsScoreDonut" style={{ '--ats-score': `${score * 3.6}deg` }}>
            <div>
                <strong>{score}</strong>
                <span>%</span>
            </div>
        </div>
    );
}

function ProgressRow({ category }) {
    return (
        <div className="atsProgressRow">
            <div><span>{category.label}</span><small>{category.issues} {category.issues === 1 ? 'issue' : 'issues'} to fix</small></div>
            <b><i style={{ width: `${category.progress}%` }} /></b>
        </div>
    );
}

function renderHighlighted(text, skills) {
    return splitTextByTerms(text, skills).map((chunk, index) => {
        if (!chunk.match) return <span key={index}>{chunk.text}</span>;
        return (
            <mark className={`atsMark ${chunk.match.status}`} key={`${chunk.text}-${index}`}>
                {chunk.text}
                <em>{statusLabel(chunk.match.status)} / Resume {chunk.match.resumeCount || 0} / Job {chunk.match.jobCount || 0}</em>
            </mark>
        );
    });
}

function statusLabel(status) {
    if (status === 'matching') return 'Matching Skill';
    if (status === 'missing') return 'Missing Skill';
    return 'Skill Variation';
}
