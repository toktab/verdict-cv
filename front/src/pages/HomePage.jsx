import { ArrowRight, Sparkles } from 'lucide-react';
import { useLanguage } from '../i18n';

export function HomePage({ Header, navigateTo, setRoute, user, userToken, setUser, setUserToken }) {
    const { t } = useLanguage();
    const proof = [
        [t('cvFirst'), t('cvFirstText')],
        [t('fourStates'), t('fourStatesText')],
        [t('osintReady'), t('osintReadyText')],
        [t('memory'), t('memoryText')],
    ];
    const hooks = [
        t('hook1'),
        t('hook2'),
        t('hook3'),
        t('hook4'),
        t('hook5'),
        t('hook6'),
        t('hook7'),
        t('hook8'),
    ];
    const states = [
        {
            name: 'Light State',
            tag: t('lightStateTag'),
            description: t('lightStateText'),
        },
        {
            name: 'WAR State',
            tag: t('warStateTag'),
            description: t('warStateText'),
        },
        {
            name: 'Person State',
            tag: t('personStateTag'),
            description: t('personStateText'),
        },
        {
            name: 'WAR+AI State',
            tag: t('warAiStateTag'),
            description: t('warAiStateText'),
        },
    ];
    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="home contentFadeIn">
                <section className="hero">
                    <div className="heroCopy">
                        <span className="eyebrow">{t('cvVerification')}</span>
                        <h1>VERDICT</h1>
                        <p>{t('homeHeroCopy')}</p>
                        <div className="heroActions">
                            <button className="primary" onClick={() => navigateTo(setRoute, userToken ? 'app' : 'register')}>
                                <Sparkles size={18} /> {t('startScreening')} <ArrowRight size={18} />
                            </button>
                            <button className="ghost" onClick={() => navigateTo(setRoute, 'login')}>{t('login')}</button>
                        </div>
                    </div>
                    <div className="candidateConsole" aria-label="Candidate verification preview">
                        <div className="consoleHeader">
                            <span>{t('shortlistControl')}</span>
                            <strong>{t('evidenceFirstRanking')}</strong>
                        </div>
                        <div className="candidateRank primaryRank">
                            <span className="rankNumber">01</span>
                            <div>
                                <strong>{t('candidateA')}</strong>
                                <small>{t('candidateASub')}</small>
                            </div>
                            <b>91</b>
                        </div>
                        <div className="candidateRank">
                            <span className="rankNumber">02</span>
                            <div>
                                <strong>{t('candidateB')}</strong>
                                <small>{t('candidateBSub')}</small>
                            </div>
                            <b>68</b>
                        </div>
                        <div className="claimPressure">
                            <span>{t('claimPressure')}</span>
                            <strong>{t('deepSpringExperience')}</strong>
                            <small>{t('backedByRepo')}</small>
                        </div>
                        <div className="intelGrid">
                            <div><span>{t('state')}</span><strong>WAR+AI</strong></div>
                            <div><span>{t('osint')}</span><strong>{t('ready')}</strong></div>
                            <div><span>{t('memory')}</span><strong>{t('clear')}</strong></div>
                            <div><span>{t('risk')}</span><strong>{t('flags2')}</strong></div>
                        </div>
                    </div>
                </section>
                <section className="proofGrid">
                    {proof.map(([value, label]) => (
                        <div className="proofCard" key={label}>
                            <strong>{value}</strong>
                            <span>{label}</span>
                        </div>
                    ))}
                </section>
                <section className="marketingGrid">
                    <div>
                        <span className="eyebrow">{t('whatItDoes')}</span>
                        <h2>{t('whatItDoesTitle')}</h2>
                        <p>{t('whatItDoesText')}</p>
                    </div>
                    <div>
                        <span className="eyebrow">{t('whyItMatters')}</span>
                        <h2>{t('whyItMattersTitle')}</h2>
                        <p>{t('whyItMattersText')}</p>
                    </div>
                </section>
                <section className="templateShowcase">
                    <div className="templateLead">
                        <span className="eyebrow">{t('verifiedTemplates')}</span>
                        <h2>{t('templatesTitle')}</h2>
                        <p>{t('templatesText')}</p>
                    </div>
                    <div className="templateTypes">
                        <article>
                            <strong>{t('officialCvTemplates')}</strong>
                            <span>{t('officialCvTemplatesText')}</span>
                        </article>
                        <article>
                            <strong>{t('communityLayers')}</strong>
                            <span>{t('communityLayersText')}</span>
                        </article>
                        <article>
                            <strong>{t('privateRules')}</strong>
                            <span>{t('privateRulesText')}</span>
                        </article>
                    </div>
                </section>
                <section className="stateShowcase">
                    <div className="stateShowcaseHead">
                        <span className="eyebrow">{t('auditStates')}</span>
                        <h2>{t('auditStatesTitle')}</h2>
                        <p>{t('auditStatesText')}</p>
                    </div>
                    <div className="stateMarketingGrid">
                        {states.map((state) => (
                            <article key={state.name} className="stateMarketingCard">
                                <div>
                                    <span>{state.tag}</span>
                                    <h3>{state.name}</h3>
                                </div>
                                <p>{state.description}</p>
                            </article>
                        ))}
                    </div>
                </section>
                <section className="magnet">
                    <span className="eyebrow">{t('whyRemember')}</span>
                    <div className="magnetList">
                        {hooks.map((hook) => <div key={hook}>{hook}</div>)}
                    </div>
                </section>
            </main>
        </div>
    );
}
