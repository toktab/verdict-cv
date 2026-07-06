import { useEffect, useRef, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CodeXml, Radar, Search, Users } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiRunCandidateOsint } from '../../api';
import { findCandidateFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

const signalStates = [
    { id: 'light', name: 'Light State', shortName: 'Light', description: 'Fast first pass with obvious contradiction checks.' },
    { id: 'war', name: 'WAR State', shortName: 'WAR', description: 'Strict template pressure against serious claims.' },
    { id: 'person', name: 'Person_AI State', shortName: 'Person_AI', description: 'Reviewer-style AI judgment for credibility and polish.' },
    { id: 'strict-war-ai', name: 'WAR_AI State', shortName: 'WAR_AI', description: 'Deep AI-assisted verification with OSINT-ready evidence.' },
];

const signalGroupsEn = [
    {
        id: 'github',
        name: 'GitHub',
        icon: CodeXml,
        description: 'Developer evidence: repositories, code activity, language usage, project substance, and whether claimed skills appear in real work.',
        options: [
            ['profile-search', 'Search matching profiles', 'Find likely GitHub accounts by name, email handles, portfolio links, and application aliases.'],
            ['project-scan', 'Scan public projects', 'Read repository names, READMEs, topics, and structure to see what the person actually built.'],
            ['knowledge-match', 'Match skills to code', 'Compare CV technologies with languages, frameworks, folders, commits, and project evidence.'],
            ['last-activity', 'Last activity check', 'Check recent commits, contribution recency, abandoned profiles, and suspiciously empty activity.'],
            ['repo-depth', 'Project depth', 'Estimate whether repos look like real work, tutorials, coursework, forks, or empty shells.'],
            ['collaboration', 'Collaboration signals', 'Look for pull requests, issues, reviews, team work, and repository ownership patterns.'],
            ['ai-footprint', 'AI footprint estimate', 'Flag code patterns that may suggest heavy generated-code usage for human review.'],
            ['evidence-links', 'Attach evidence links', 'Connect specific repositories back to exact CV claims.'],
        ],
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: BriefcaseBusiness,
        description: 'Professional identity evidence: title, employer, dates, role history, profile consistency, and company association.',
        options: [
            ['profile-match', 'Resolve profile identity', 'Match name, location, employer, role, and application details to avoid common-name mistakes.'],
            ['title-check', 'Verify claimed title', 'Compare CV titles with profile titles and role history.'],
            ['employer-check', 'Employer association', 'Check whether listed companies appear on the profile and align with the CV.'],
            ['date-consistency', 'Date consistency', 'Compare tenure dates, overlapping roles, and missing periods.'],
            ['seniority-pressure', 'Seniority pressure', 'Challenge senior, lead, manager, and architect wording against profile evidence.'],
            ['education-cert', 'Education and certificate check', 'Read public education, licenses, certificates, and issuer details.'],
            ['network-signals', 'Network signals', 'Look for coworkers, company follows, endorsements, and profile completeness as weak signals.'],
            ['profile-changes', 'Profile freshness', 'Check whether the profile looks maintained or created only for the application.'],
        ],
    },
    {
        id: 'socials',
        name: 'Socials',
        icon: Users,
        description: 'Optional public social presence checks. These should be scoped carefully and used only for consented, job-relevant verification.',
        options: [
            ['facebook', 'Facebook', 'Look for public identity anchors, employment mentions, education, and obvious contradictions.'],
            ['instagram', 'Instagram', 'Check public bio links, portfolio references, employer mentions, and identity consistency.'],
            ['x-twitter', 'X / Twitter', 'Find public technical posts, role claims, project posts, and profile links.'],
            ['medium', 'Medium / blogs', 'Search writing, tutorials, project notes, and claimed expertise evidence.'],
            ['personal-site', 'Personal website', 'Check portfolio pages, project claims, links, and resume consistency.'],
            ['stackoverflow', 'Stack Overflow', 'Look for technical participation and topic alignment where public.'],
            ['youtube', 'YouTube', 'Search public demos, talks, project walkthroughs, and tutorial evidence.'],
        ],
    },
    {
        id: 'other',
        name: 'Other',
        icon: Search,
        description: 'Broader web and verification checks for cases where primary sources are incomplete or contradictory.',
        options: [
            ['web-search', 'Open web search', 'Search public mentions across websites, directories, articles, and cached references.'],
            ['company-site', 'Company site check', 'Look for team pages, author pages, staff directories, and employer-owned evidence.'],
            ['portfolio-links', 'Portfolio link audit', 'Open links from the CV and verify whether they support the exact claims.'],
            ['certificate-issuer', 'Certificate issuer check', 'Validate issuer names, certificate IDs, dates, and public verification links.'],
            ['identity-conflict', 'Identity conflict scan', 'Flag conflicting names, locations, employers, or role timelines for human review.'],
            ['final-report', 'Generate SignalTrace report', 'Write the evidence summary that feeds back into the candidate score.'],
        ],
    },
];

const signalGroupsGe = [
    {
        id: 'github',
        name: 'GitHub',
        icon: CodeXml,
        description: 'დეველოპერის მტკიცებულება: რეპოზიტორიები, კოდის აქტივობა, ენები, პროექტის სიღრმე და ემთხვევა თუ არა რეალურ სამუშაოს CV-ში მითითებული უნარები.',
        options: [
            ['profile-search', 'შესაბამისი პროფილების ძებნა', 'იპოვე სავარაუდო GitHub ანგარიშები სახელით, email handle-ებით, პორტფოლიოს ბმულებით და განაცხადის alias-ებით.'],
            ['project-scan', 'საჯარო პროექტების სკანირება', 'წაიკითხე repository names, README-ები, topics და სტრუქტურა იმის სანახავად, რა ააშენა რეალურად კანდიდატმა.'],
            ['knowledge-match', 'უნარების კოდთან შედარება', 'შეადარე CV ტექნოლოგიები ენებს, framework-ებს, folder-ებს, commit-ებს და პროექტის მტკიცებულებას.'],
            ['last-activity', 'ბოლო აქტივობის შემოწმება', 'შეამოწმე ბოლო commit-ები, contribution recency, მიტოვებული პროფილები და საეჭვოდ ცარიელი აქტივობა.'],
            ['repo-depth', 'პროექტის სიღრმე', 'შეაფასე repos რეალურ სამუშაოს ჰგავს, tutorial-ს, coursework-ს, fork-ს თუ ცარიელ shell-ს.'],
            ['collaboration', 'კოლაბორაციის სიგნალები', 'ეძებე pull request-ები, issue-ები, review-ები, teamwork და ownership პატერნები.'],
            ['ai-footprint', 'AI footprint შეფასება', 'მონიშნე კოდის პატერნები, რომლებიც შეიძლება generated-code-ის მძიმე გამოყენებაზე მიუთითებდეს.'],
            ['evidence-links', 'მტკიცებულების ბმულების მიბმა', 'დააკავშირე კონკრეტული რეპოზიტორიები ზუსტ CV claim-ებთან.'],
        ],
    },
    {
        id: 'linkedin',
        name: 'LinkedIn',
        icon: BriefcaseBusiness,
        description: 'პროფესიული იდენტობის მტკიცებულება: სათაური, დამსაქმებელი, თარიღები, როლების ისტორია, პროფილის თანმიმდევრულობა და კომპანიასთან კავშირი.',
        options: [
            ['profile-match', 'პროფილის იდენტობის გადაწყვეტა', 'შეადარე სახელი, ლოკაცია, დამსაქმებელი, როლი და განაცხადის დეტალები common-name შეცდომების ასარიდებლად.'],
            ['title-check', 'მითითებული სათაურის შემოწმება', 'შეადარე CV titles პროფილის titles-ს და როლების ისტორიას.'],
            ['employer-check', 'დამსაქმებელთან კავშირი', 'შეამოწმე, ჩანს თუ არა ჩამოთვლილი კომპანიები პროფილზე და ემთხვევა თუ არა CV-ს.'],
            ['date-consistency', 'თარიღების თანმიმდევრულობა', 'შეადარე tenure dates, გადაფარული როლები და გამოტოვებული პერიოდები.'],
            ['seniority-pressure', 'სენიორობის წნევა', 'შეამოწმე senior, lead, manager და architect ფორმულირებები პროფილის მტკიცებულებასთან.'],
            ['education-cert', 'განათლება და სერტიფიკატები', 'წაიკითხე საჯარო განათლება, license-ები, certificate-ები და issuer დეტალები.'],
            ['network-signals', 'ქსელის სიგნალები', 'ეძებე coworkers, company follows, endorsements და პროფილის სისრულე როგორც სუსტი სიგნალები.'],
            ['profile-changes', 'პროფილის აქტუალობა', 'შეამოწმე პროფილი მოვლილია თუ მხოლოდ განაცხადისთვის შექმნილი ჩანს.'],
        ],
    },
    {
        id: 'socials',
        name: 'Socials',
        icon: Users,
        description: 'სურვილისამებრ საჯარო სოციალური presence checks. გამოიყენება ფრთხილად და მხოლოდ თანხმობით, job-relevant ვერიფიკაციისთვის.',
        options: [
            ['facebook', 'Facebook', 'ეძებე საჯარო იდენტობის anchors, დასაქმების mention-ები, განათლება და აშკარა წინააღმდეგობები.'],
            ['instagram', 'Instagram', 'შეამოწმე public bio links, portfolio references, employer mentions და identity consistency.'],
            ['x-twitter', 'X / Twitter', 'იპოვე public technical posts, role claims, project posts და profile links.'],
            ['medium', 'Medium / blogs', 'ეძებე წერილები, tutorials, project notes და claimed expertise evidence.'],
            ['personal-site', 'Personal website', 'შეამოწმე portfolio pages, project claims, links და resume consistency.'],
            ['stackoverflow', 'Stack Overflow', 'ეძებე ტექნიკური მონაწილეობა და topic alignment, სადაც საჯაროა.'],
            ['youtube', 'YouTube', 'ეძებე public demos, talks, project walkthroughs და tutorial evidence.'],
        ],
    },
    {
        id: 'other',
        name: 'Other',
        icon: Search,
        description: 'უფრო ფართო web და verification checks შემთხვევებისთვის, როცა ძირითადი წყაროები არასრული ან წინააღმდეგობრივია.',
        options: [
            ['web-search', 'ღია ვებ ძებნა', 'ეძებე საჯარო mentions websites, directories, articles და cached references-ში.'],
            ['company-site', 'კომპანიის საიტის შემოწმება', 'ეძებე team pages, author pages, staff directories და employer-owned evidence.'],
            ['portfolio-links', 'Portfolio link audit', 'გახსენი CV-დან ბმულები და გადაამოწმე, ამყარებს თუ არა ზუსტ claim-ებს.'],
            ['certificate-issuer', 'Certificate issuer check', 'დაადასტურე issuer names, certificate IDs, dates და public verification links.'],
            ['identity-conflict', 'Identity conflict scan', 'მონიშნე conflicting names, locations, employers ან role timelines ადამიანის რევიუსთვის.'],
            ['final-report', 'SignalTrace report-ის გენერაცია', 'დაწერე evidence summary, რომელიც candidate score-ში დაბრუნდება.'],
        ],
    },
];

export function SignalTracePage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false }) {
    const { lang, t } = useLanguage();
    const { project, candidate } = findCandidateFromPath(projects);
    const activeProject = project;
    const activeCandidate = candidate;
    const projectStateId = stateIdFromName(activeProject?.state);
    const stateStorageKey = candidateStateStorageKey(activeProject?.id, activeCandidate?.id);
    const [activeStateId, setActiveStateId] = useState(() => readCandidateState(stateStorageKey, projectStateId));
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [selected, setSelected] = useState(() => new Set(['profile-search', 'project-scan', 'profile-match', 'title-check']));
    const [initializedStateIds, setInitializedStateIds] = useState(() => readInitializedStates(stateStorageKey, projectStateId));
    const [osintResult, setOsintResult] = useState(null);
    const [osintLoading, setOsintLoading] = useState(false);
    const [osintError, setOsintError] = useState('');
    const autoRunKey = useRef('');
    const signalGroups = lang === 'ge' ? signalGroupsGe : signalGroupsEn;
    const activeState = signalStates.find((state) => state.id === activeStateId) || signalStates[0];
    const selectedStateInitialized = initializedStateIds.has(activeStateId);
    const signalTraceUnlocked = activeStateId === 'strict-war-ai';
    const lockedTraceMessage = 'Switch to WAR_AI State to unlock SignalTrace OSINT.';
    const resultRows = activeCandidate && selectedStateInitialized ? buildSignalResults(activeCandidate, activeStateId, t, osintResult) : [];

    useEffect(() => {
        const nextStateId = readCandidateState(stateStorageKey, projectStateId);
        setActiveStateId(nextStateId);
        setOsintResult(null);
        setOsintError('');
        setInitializedStateIds((current) => {
            const stored = readInitializedStates(stateStorageKey, projectStateId);
            const next = new Set([...current, ...stored]);
            next.add(projectStateId);
            return next;
        });
    }, [activeProject?.id, activeCandidate?.id, projectStateId, stateStorageKey]);

    useEffect(() => {
        const runKey = `${activeProject?.id || ''}:${activeCandidate?.id || ''}:${activeStateId}`;
        if (!activeProject || !activeCandidate || !signalTraceUnlocked || !selectedStateInitialized || autoRunKey.current === runKey) {
            return;
        }
        autoRunKey.current = runKey;
        runOsintCheck();
    }, [activeProject, activeCandidate, activeStateId, selectedStateInitialized, signalTraceUnlocked]);

    if (!activeProject || !activeCandidate) {
        return <ProjectRouteState Header={Header} navigateTo={navigateTo} setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} loading={projectsLoading} eyebrow={activeProject ? 'SignalTrace' : undefined} title={activeProject ? 'Candidate signal route not found' : undefined} message={activeProject ? 'This SignalTrace route points to a candidate that is unavailable.' : undefined} />;

    }

    function toggle(id) {
        setSelected((current) => {
            const next = new Set(current);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }

    async function initializeSelectedState() {
        if (!signalTraceUnlocked) return;
        setInitializedStateIds((current) => {
            const next = new Set(current);
            next.add(activeStateId);
            writeInitializedStates(stateStorageKey, next);
            return next;
        });
        await runOsintCheck();
    }

    async function runOsintCheck() {
        if (!activeProject || !activeCandidate || !signalTraceUnlocked) return;
        setOsintLoading(true);
        setOsintError('');
        try {
            const payload = await apiRunCandidateOsint(activeProject.id, activeCandidate.id, { state: activeStateId, checks: [...selected] }, userToken);
            setOsintResult(payload);
        } catch (error) {
            setOsintError(error.message || 'OSINT check failed');
        } finally {
            setOsintLoading(false);
        }
    }

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="detailPage contentFadeIn">
                <section className="detailHero">
                    <div>
                        <span className="eyebrow">{t('signalTraceOsint')}</span>
                        <h1>{activeCandidate.name}</h1>
                        <p>{t('signalTraceText')}</p>
                    </div>
                    <button className="secondary" onClick={() => navigateTo(setRoute, 'candidateDetail', activeProject.id, activeCandidate.id)}><ArrowRight size={16} /> {t('backToCandidate')}</button>
                    <button
                        className="primary"
                        disabled={osintLoading || !signalTraceUnlocked}
                        onClick={initializeSelectedState}
                        title={signalTraceUnlocked ? '' : lockedTraceMessage}
                    >
                        <Radar size={18} /> {osintLoading ? 'Running OSINT...' : t('startTrace')}
                    </button>
                </section>
                <section className="detailMeta">
                    <Metric label={t('subjectId')} value={activeCandidate.id} />
                    <Metric label={t('jobId')} value={activeProject.id} />
                    <Metric label={t('selectedChecks')} value={selected.size} />
                    <Metric label={t('consentGate')} value={t('required')} />
                    <Metric label={t('mode')} value={signalTraceUnlocked ? activeState.shortName : `${activeState.shortName} locked`} />
                    <Metric label={t('risk')} value={osintResult?.status || activeCandidate.risk} />
                </section>

                <section className={`consentGatePanel ${consentAccepted ? 'accepted' : ''}`}>
                    <div>
                        <span className="eyebrow">{t('consentGateTitle')}</span>
                        <h2>{t('consentGateSubtitle')}</h2>
                    </div>
                    <div className="consentGateGrid">
                        <article>
                            <strong>{t('consentScope')}</strong>
                            <p>{t('consentScopeText')}</p>
                        </article>
                        <article>
                            <strong>{t('retentionPolicy')}</strong>
                            <p>{t('retentionPolicyText')}</p>
                        </article>
                        <article>
                            <strong>{t('legalBasis')}</strong>
                            <p>{t('legalBasisText')}</p>
                        </article>
                    </div>
                    <label className="consentConfirmRow">
                        <input type="checkbox" checked={consentAccepted} onChange={(event) => setConsentAccepted(event.target.checked)} />
                        <span>{t('consentConfirm')}</span>
                    </label>
                </section>

                <section className={`signalDirectory ${signalTraceUnlocked ? '' : 'locked'}`} title={signalTraceUnlocked ? '' : lockedTraceMessage}>
                    <div className="signalDirectoryHead">
                        <span className="eyebrow">{t('traceDirectory')}</span>
                        <strong>{signalTraceUnlocked ? t('candidateEvidenceSources') : 'SignalTrace locked for this State'}</strong>
                        <small>{signalTraceUnlocked ? t('chooseChecks') : lockedTraceMessage}</small>
                    </div>
                    {signalGroups.map((group) => {
                        const Icon = group.icon;
                        return (
                            <details className="signalGroup" key={group.id} open={group.id === 'github' || group.id === 'linkedin'}>
                                <summary>
                                    <Icon size={18} />
                                    <span>{group.name}</span>
                                    <small>{group.description}</small>
                                </summary>
                                <div className="signalOptions">
                                    {group.options.map(([id, label, description]) => (
                                        <label className="signalOption" key={id}>
                                            <input type="checkbox" checked={selected.has(id)} disabled={!signalTraceUnlocked} onChange={() => toggle(id)} />
                                            <span>
                                                <strong>{label}</strong>
                                                <small>{description}</small>
                                            </span>
                                        </label>
                                    ))}
                                </div>
                            </details>
                        );
                    })}
                </section>

                <section className="signalResultPanel">
                    <div className="signalResultHead">
                        <div>
                            <span className="eyebrow">{t('osintResult')}</span>
                            <h2>{activeState.name}</h2>
                            <p>{signalTraceUnlocked ? (selectedStateInitialized ? t('osintResultSubtitle') : `${activeState.name} search has not been initialized.`) : lockedTraceMessage}</p>
                        </div>
                        {signalTraceUnlocked && selectedStateInitialized ? (
                            <div className="signalResultMetrics">
                                <div><span>{t('identityConfidence')}</span><strong>{osintResult?.identityConfidence ?? identityConfidence(activeCandidate, activeStateId)}%</strong></div>
                                <div><span>{t('corroboratedSources')}</span><strong>{osintResult?.corroboratedSources ?? sourceCount(activeCandidate, activeStateId)}</strong></div>
                                <div><span>{t('contradictions')}</span><strong>{osintResult?.contradictions ?? activeCandidate.unsupported}</strong></div>
                            </div>
                        ) : (
                            <div className={`stateNotInitialized ${signalTraceUnlocked ? '' : 'locked'}`} title={signalTraceUnlocked ? '' : lockedTraceMessage}>
                                <strong>{signalTraceUnlocked ? `${activeState.shortName} search not initialized` : 'SignalTrace locked'}</strong>
                                <span>{signalTraceUnlocked ? 'Accept consent and press Start trace to initialize this State mode for the current candidate.' : lockedTraceMessage}</span>
                            </div>
                        )}
                    </div>
                    {osintError && <div className="emptyState">{osintError}</div>}
                    {osintLoading && <div className="emptyState">Running automatic OSINT check for {activeCandidate.name}...</div>}
                    {signalTraceUnlocked && selectedStateInitialized ? (
                        <div className="signalResultRows">
                            {resultRows.map((row) => (
                                <article className={`signalResultCard ${row.tone}`} key={row.source}>
                                    <div>
                                        <span>{t('source')}</span>
                                        <strong>{row.source}</strong>
                                    </div>
                                    <div>
                                        <span>{t('finding')}</span>
                                        <p>{row.finding}</p>
                                    </div>
                                    <div>
                                        <span>{t('sourceConfidence')}</span>
                                        <b>{row.confidence}%</b>
                                    </div>
                                    <div>
                                        <span>{t('impact')}</span>
                                        <b>{row.impact}</b>
                                    </div>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="emptyState" title={signalTraceUnlocked ? '' : lockedTraceMessage}>
                            {signalTraceUnlocked ? `${activeState.name} search has not been initialized for ${activeCandidate.name}.` : lockedTraceMessage}
                        </div>
                    )}
                </section>

                <section className="signalPeoplePanel">
                    <div className="tableToolbar">
                        <h2>{t('peopleInJob')}</h2>
                        <span>{t('directoryStatusPreview')}</span>
                    </div>
                    <div className="signalPeopleRows">
                        {activeProject.candidates.map((person) => (
                            <button className={`signalPersonRow ${person.id === activeCandidate.id ? 'active' : ''}`} key={person.id} onClick={() => navigateTo(setRoute, 'signalTrace', activeProject.id, person.id)}>
                                <span>
                                    <strong>{person.id}</strong>
                                    <small>{person.name} / {person.role}</small>
                                </span>
                                <b className={person.score >= 80 ? 'scoreGood' : person.score >= 55 ? 'scoreWarn' : 'scoreBad'}>{person.score}</b>
                                <span>{person.osint}</span>
                                <span>{person.risk}</span>
                            </button>
                        ))}
                    </div>
                </section>
            </main>
        </div>
    );
}

function stateIdFromName(name = '') {
    const normalized = name.toLowerCase();
    if (normalized.includes('light')) return 'light';
    if (normalized.includes('person')) return 'person';
    if (normalized.includes('war+ai') || normalized.includes('war_ai') || normalized.includes('strict')) return 'strict-war-ai';
    if (normalized.includes('war')) return 'war';
    return 'strict-war-ai';
}

function candidateStateStorageKey(projectId, candidateId) {
    return projectId && candidateId ? `candidate-state:${projectId}:${candidateId}` : '';
}

function readCandidateState(key, fallback) {
    if (!key || typeof localStorage === 'undefined') return fallback;
    return localStorage.getItem(`${key}:selected`) || fallback;
}

function readInitializedStates(key, fallback) {
    const states = new Set([fallback]);
    if (!key || typeof localStorage === 'undefined') return states;
    try {
        JSON.parse(localStorage.getItem(`${key}:initialized`) || '[]').forEach((stateId) => states.add(stateId));
    } catch {
        // Ignore stale local state.
    }
    return states;
}

function writeInitializedStates(key, states) {
    if (!key || typeof localStorage === 'undefined') return;
    localStorage.setItem(`${key}:initialized`, JSON.stringify([...states]));
}

function identityConfidence(candidate, stateId) {
    if (stateId === 'light') return Math.min(72, Math.max(24, candidate.score));
    if (stateId === 'war') return Math.min(82, Math.max(34, candidate.score + 3));
    if (stateId === 'person') return Math.min(88, Math.max(38, candidate.score + 6));
    if (candidate.osint === 'Ready') return 91;
    if (candidate.osint === 'Partial') return 67;
    if (candidate.osint === 'Escalate') return 44;
    return 28;
}

function sourceCount(candidate, stateId) {
    if (stateId === 'light') return 1;
    if (stateId === 'war') return 2;
    if (stateId === 'person') return 3;
    if (candidate.osint === 'Ready') return 4;
    if (candidate.osint === 'Partial') return 2;
    if (candidate.osint === 'Escalate') return 1;
    return 0;
}

function buildSignalResults(candidate, stateId, t, osintResult) {
    if (osintResult?.sources?.length) {
        return osintResult.sources.map((source) => ({
            source: source.source,
            finding: source.finding,
            confidence: source.confidence,
            impact: source.impact,
            tone: source.tone || 'neutral',
            url: source.url || '',
        }));
    }
    const baseRows = [
        { source: 'Contradiction scan', finding: t('contradictionFinding'), confidence: candidate.unsupported ? 76 : 22, impact: candidate.unsupported ? `-${candidate.unsupported * 8}` : '0', tone: candidate.unsupported ? 'bad' : 'good' },
        { source: 'CV claim map', finding: `${candidate.supported} supported, ${candidate.stretched} stretched, and ${candidate.unsupported} unsupported claims were extracted from the uploaded CV.`, confidence: Math.max(35, Math.min(92, candidate.score)), impact: candidate.score >= 70 ? '+8' : '-4', tone: candidate.score >= 70 ? 'good' : 'warn' },
    ];
    if (stateId === 'light') {
        return baseRows;
    }
    const warRows = [
        ...baseRows,
        { source: 'Requirement pressure', finding: `${candidate.role} is checked against the job requirements with strict proof expectations.`, confidence: Math.max(42, Math.min(88, candidate.match)), impact: candidate.match >= 70 ? '+10' : '-6', tone: candidate.match >= 70 ? 'good' : 'warn' },
    ];
    if (stateId === 'war') {
        return warRows;
    }
    const personRows = [
        ...warRows,
        { source: 'LinkedIn', finding: t('linkedinFinding'), confidence: candidate.osint === 'Ready' ? 88 : 54, impact: '+12', tone: 'good' },
    ];
    if (stateId === 'person') {
        return personRows;
    }
    return [
        ...personRows,
        { source: 'GitHub', finding: t('githubFinding'), confidence: candidate.score >= 75 ? 84 : 48, impact: candidate.score >= 75 ? '+16' : '+4', tone: candidate.score >= 75 ? 'good' : 'warn' },
        { source: 'Socials', finding: t('socialFinding'), confidence: candidate.osint === 'Not started' ? 0 : 36, impact: candidate.osint === 'Not started' ? '0' : '+2', tone: 'neutral' },
    ];
}
