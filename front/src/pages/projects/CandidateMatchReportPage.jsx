import { ArrowRight, CheckCircle2, Download, Printer, XCircle } from 'lucide-react';
import { buildAtsReport, candidateSourceText, projectDescriptionText } from './atsReportUtils';
import { findCandidateFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

export function CandidateMatchReportPage({ Header, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false }) {
    const { project, candidate } = findCandidateFromPath(projects);

    if (!project || !candidate) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow={project ? 'Match report' : undefined} title={project ? 'Candidate report not found' : undefined} message={project ? 'This report points to a candidate that is unavailable.' : undefined} />;
    }

    const report = buildAtsReport(project, candidate);
    const printReport = () => window.print();

    return (
        <div className="shell atsReportShell">
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="atsReportWorkspace contentFadeIn">
                <div className="atsReportActions noPrint">
                    <button className="secondary" type="button" onClick={() => navigateTo(setRoute, 'candidateDetail', project.id, candidate.id)}><ArrowRight size={16} /> Back</button>
                    <button className="primary" type="button" onClick={printReport}><Printer size={16} /> Print Report</button>
                </div>
                <article className="atsReportPaper">
                    <header className="atsReportHeader">
                        <div>
                            <h1>Match Report</h1>
                            <p>{project.title}</p>
                            <small>{candidate.name} / {candidate.role}</small>
                        </div>
                        <button className="primary noPrint" type="button" onClick={printReport}><Download size={16} /> Download PDF</button>
                    </header>
                    <section className="atsReportSummary">
                        <div className="atsMiniDonut" style={{ '--ats-score': `${report.score * 3.6}deg` }}>
                            <strong>{report.score}</strong>
                        </div>
                        {report.categories.map((category) => (
                            <article key={category.label}>
                                <span>{category.label}</span>
                                <strong>{category.issues}</strong>
                                <small>{category.issues === 1 ? 'issue' : 'issues'}</small>
                            </article>
                        ))}
                    </section>
                    <ReportTable title="Searchability" rows={report.searchabilityRows} />
                    <section className="atsReportSection">
                        <h2>Skills</h2>
                        <table className="atsReportTable">
                            <thead>
                                <tr>
                                    <th>Skill</th>
                                    <th>Resume</th>
                                    <th>Job Description</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {report.skills.slice(0, 32).map((row) => (
                                    <tr key={row.label}>
                                        <td>{row.label}</td>
                                        <td>{row.resumeCount || <span className="atsX">x</span>}</td>
                                        <td>{row.jobCount || <span className="atsX">x</span>}</td>
                                        <td><span className={`atsLegendPill ${row.status}`}>{statusLabel(row.status)}</span></td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </section>
                    <ReportTable title="Recruiter Tips" rows={report.recruiterRows} />
                    <ReportTable title="Formatting" rows={report.formattingRows} />
                    <section className="atsReportSection">
                        <h2>Resume / Job Evidence</h2>
                        <div className="atsReportEvidenceGrid">
                            <pre>{candidateSourceText(candidate)}</pre>
                            <pre>{projectDescriptionText(project)}</pre>
                        </div>
                    </section>
                </article>
            </main>
        </div>
    );
}

function ReportTable({ title, rows }) {
    return (
        <section className="atsReportSection">
            <h2>{title}</h2>
            <table className="atsReportTable">
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.label}>
                            <th>{row.label}</th>
                            <td>{row.ok ? <CheckCircle2 className="atsOkIcon" size={16} /> : <XCircle className="atsBadIcon" size={16} />}</td>
                            <td>{row.text}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </section>
    );
}

function statusLabel(status) {
    if (status === 'matching') return 'Matching Skill';
    if (status === 'missing') return 'Missing Skill';
    return 'Skill Variation';
}
