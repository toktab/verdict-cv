import { useEffect, useState } from 'react';
import { ArrowRight, BriefcaseBusiness, CodeXml, ExternalLink, Link2, Radar, Search, Users } from 'lucide-react';
import { useLanguage } from '../../i18n';
import { apiRunCandidateOsint, apiUpdateCandidateAnalysisState } from '../../api';
import { analysisStates as signalStates } from '../../data/analysisStates';
import { discoverCvPublicSources } from '../../utils/publicSourceDiscovery';
import { findCandidateFromPath } from './projectPageUtils';
import { ProjectRouteState } from './ProjectRouteState';

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

export function SignalTracePage({ Header, Metric, navigateTo, setRoute, user, userToken, setUser, setUserToken, projects = [], projectsLoading = false, onProjectsChange }) {
    const { lang, t } = useLanguage();
    const { project, candidate } = findCandidateFromPath(projects);
    const activeProject = project;
    const activeCandidate = candidate;
    const projectStateId = stateIdFromName(activeProject?.state);
    const [activeStateId, setActiveStateId] = useState(activeCandidate?.analysisState || projectStateId);
    const [consentAccepted, setConsentAccepted] = useState(false);
    const [selected, setSelected] = useState(() => new Set(['profile-search', 'project-scan', 'profile-match', 'title-check']));
    const [initializedStateIds, setInitializedStateIds] = useState(() => new Set(activeCandidate?.initializedAnalysisStates || [projectStateId]));
    const [osintLoading, setOsintLoading] = useState(false);
    const [osintError, setOsintError] = useState('');
    const signalGroups = lang === 'ge' ? signalGroupsGe : signalGroupsEn;
    const activeState = signalStates.find((state) => state.id === activeStateId) || signalStates[0];
    const selectedStateInitialized = initializedStateIds.has(activeStateId);
    const signalTraceUnlocked = activeStateId === 'strict-war-ai';
    const lockedTraceMessage = 'Switch to WAR_AI State to unlock SignalTrace OSINT.';
    const discoveredCvSources = discoverCvPublicSources(activeCandidate?.cvText);
    const discoveredGithubSources = discoveredCvSources.filter((source) => source.kind === 'github');

    useEffect(() => {
        setActiveStateId(activeCandidate?.analysisState || projectStateId);
        setOsintError('');
        setInitializedStateIds(new Set(activeCandidate?.initializedAnalysisStates?.length
            ? activeCandidate.initializedAnalysisStates
            : [projectStateId]));
    }, [activeProject?.id, activeCandidate?.id, activeCandidate?.analysisState, activeCandidate?.initializedAnalysisStates, projectStateId]);

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

    async function checkInformation() {
        if (!signalTraceUnlocked) return;
        setOsintLoading(true);
        setOsintError('');
        try {
            if (!selectedStateInitialized) {
                const updated = await apiUpdateCandidateAnalysisState(activeProject.id, activeCandidate.id, {
                    state: activeStateId,
                    initialize: true,
                }, userToken);
                setInitializedStateIds(new Set(updated.initialized_analysis_states || updated.initializedAnalysisStates || [activeStateId]));
            }
            await apiRunCandidateOsint(activeProject.id, activeCandidate.id, {
                state: activeStateId,
                checks: [...selected],
                consent: consentAccepted,
            }, userToken);
            await onProjectsChange?.();
            navigateTo(setRoute, 'signalTraceReport', activeProject.id, activeCandidate.id);
        } catch (error) {
            setOsintError(error.message || 'SignalTrace could not check this candidate.');
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
                        disabled={osintLoading || !signalTraceUnlocked || !consentAccepted}
                        onClick={checkInformation}
                        title={!signalTraceUnlocked ? lockedTraceMessage : !consentAccepted ? 'Accept the consent terms before starting SignalTrace.' : ''}
                    >
                        <Radar size={18} /> {osintLoading ? 'Checking information...' : 'Check information'}
                    </button>
                </section>
                <section className="detailMeta">
                    <Metric label={t('subjectId')} value={activeCandidate.id} />
                    <Metric label={t('jobId')} value={activeProject.id} />
                    <Metric label={t('selectedChecks')} value={selected.size} />
                    <Metric label={t('consentGate')} value={t('required')} />
                    <Metric label={t('mode')} value={signalTraceUnlocked ? activeState.shortName : `${activeState.shortName} locked`} />
                    <Metric label={t('risk')} value={activeCandidate.risk} />
                </section>
                {osintError && (
                    <div className="signalTraceError" role="alert">
                        <div>
                            <strong>SignalTrace could not check this candidate.</strong>
                            <span>{osintError}</span>
                        </div>
                        <button className="secondary" type="button" disabled={osintLoading} onClick={checkInformation}>
                            Try again
                        </button>
                    </div>
                )}

                <section className={`cvSourceDiscovery ${discoveredCvSources.length ? 'hasSources' : ''}`}>
                    <div className="cvSourceDiscoveryHead">
                        <div>
                            <span className="eyebrow">CV source preflight</span>
                            <h2>
                                {discoveredGithubSources.length
                                    ? `Found ${discoveredGithubSources.length} GitHub link${discoveredGithubSources.length === 1 ? '' : 's'} in this CV`
                                    : discoveredCvSources.length
                                        ? `Found ${discoveredCvSources.length} public link${discoveredCvSources.length === 1 ? '' : 's'} in this CV`
                                        : 'No public links found in this CV'}
                            </h2>
                            <p>
                                Link detection uses only the stored CV text. External profiles remain unverified until consent is accepted and SignalTrace runs.
                            </p>
                        </div>
                        <span className={`cvSourceCount ${discoveredCvSources.length ? 'found' : ''}`}>
                            <Link2 size={15} />
                            {discoveredCvSources.length} detected
                        </span>
                    </div>
                    {discoveredCvSources.length > 0 ? (
                        <div className="cvSourceRows">
                            {discoveredCvSources.map((source) => (
                                <article className={`cvSourceRow ${source.kind}`} key={source.url}>
                                    <CodeXml size={18} aria-hidden="true" />
                                    <div>
                                        <strong>{source.platform}</strong>
                                        <span>
                                            Found in CV
                                            {source.username ? ` / username: ${source.username}` : ''}
                                        </span>
                                    </div>
                                    <span className="cvSourcePending">Verification pending</span>
                                    <a href={source.url} target="_blank" rel="noreferrer">
                                        <span>{source.url}</span>
                                        <ExternalLink size={14} />
                                    </a>
                                </article>
                            ))}
                        </div>
                    ) : (
                        <div className="cvSourceEmpty">
                            Add a complete URL such as <code>https://github.com/username</code> to the candidate CV, then upload or rescan it.
                        </div>
                    )}
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
