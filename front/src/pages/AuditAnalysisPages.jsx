import { useEffect, useRef, useState } from 'react';
import { Download, FileSearch, Gauge, ShieldCheck, X } from 'lucide-react';
import { AuditScoreExplainer } from '../components/AuditScoreExplainer';
import { DenseVerdictTable, VerdictCard } from '../components/VerdictEvidence';
import defaultAts from '../data/default-ats.json';
import { navigateTo } from '../navigation';
import { readUserToken } from '../sessionAuth';
import { auditScoreLevel } from '../utils/auditScore';

function Metric({ label, value }) {
    return <div className="metric"><span>{label}</span><strong>{value}</strong></div>;
}
function Panel({ title, subtitle, children }) {
    return <section className="panel"><div className="panelHead"><div><h3>{title}</h3><small>{subtitle}</small></div></div>{children}</section>;
}

function Loading({ stage }) {
    return <div className="loading"><span className="spinner" /><strong>{stage}</strong></div>;
}

function SkeletonBlock({ rows = 3 }) {
    return <div className="skeletonBlock" aria-hidden="true">{Array.from({ length: rows }, (_, index) => <span key={index} />)}</div>;
}

function RouteRetryNotice({ title, message, onRetry }) {
    return <section className="retryNotice error"><div><strong>{title}</strong><span>{message}</span></div><div className="retryActions"><button className="secondary" type="button" onClick={onRetry}>Retry</button></div></section>;
}
export function AuditDetailPage({ Header, setRoute, user, userToken, setUser, setUserToken, audit, loading, error, onRetry }) {
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [confidenceFilter, setConfidenceFilter] = useState('ALL');
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const verdicts = audit?.verdicts || [];
    const filteredVerdicts = verdicts.filter((verdict) => {
        const statusMatch = statusFilter === 'ALL' || verdict.status === statusFilter;
        const confidenceMatch = confidenceFilter === 'ALL' || verdict.confidence === confidenceFilter;
        const severityMatch = severityFilter === 'ALL'
            || (severityFilter === 'PROBLEM' && isProblemVerdict(verdict))
            || verdictSeverity(verdict) === severityFilter;
        return statusMatch && confidenceMatch && severityMatch;
    });
    const statusFilters = ['ALL', 'SUPPORTED', 'STRETCHED', 'UNSUPPORTED', 'GAP'];
    const confidenceFilters = ['ALL', 'HIGH', 'MEDIUM', 'LOW'];
    const severityFilters = ['ALL', 'PROBLEM', 'HIGH RISK', 'MEDIUM RISK', 'LOW RISK'];

    return (
        <div className="shell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="detailPage contentFadeIn">
                <button className="ghost" onClick={() => navigateTo(setRoute, 'dashboard')}>Back to dashboard</button>
                {error && <div className="error">{error}</div>}
                {loading && <><Loading stage="LOADING AUDIT DETAIL" /><SkeletonBlock rows={8} /></>}
                {!loading && error && <RouteRetryNotice title="Audit detail failed to load." message={error} onRetry={onRetry} />}
                {!loading && !error && !audit && <div className="emptyState">Audit detail is not available.</div>}
                {audit && (
                    <>
                        <section className="detailHero">
                            <div>
                                <span className="eyebrow">Private audit #{audit.id}</span>
                                <h1>{audit.claimTitle}</h1>
                                <p>{audit.evidenceTitle}</p>
                            </div>
                            <div className="detailScore">
                                <Gauge size={28} />
                                <span>Credibility</span>
                                <strong>{audit.credibilityScore}%</strong>
                            </div>
                        </section>
                        <StickyAuditBar audit={audit} />
                        <section className="detailMeta">
                            <Metric label="Created" value={formatDateTime(audit.createdAt)} />
                            <Metric label="Status" value={audit.status || 'COMPLETED'} />
                            <Metric label="Engine" value={audit.engine} />
                            <Metric label="Analyzer" value={audit.analyzerVersion || 'Unknown'} />
                            <Metric label="Prompt" value={audit.promptVersion || 'Unknown'} />
                            <Metric label="Runtime" value={`${audit.processingMillis}ms`} />
                            <Metric label="Prompt tokens" value={audit.promptTokens || 0} />
                            <Metric label="Completion tokens" value={audit.completionTokens || 0} />
                            <Metric label="Total tokens" value={audit.totalTokens || 0} />
                            <Metric label="Estimated cost" value={formatAuditCost(audit.estimatedCostUsd)} />
                            <Metric label="CV hash" value={shortHash(audit.claimFingerprint)} />
                            <Metric label="Evidence hash" value={shortHash(audit.evidenceFingerprint)} />
                        </section>
                        <AuditScoreExplainer audit={audit} />
                        <section className="documentCompare">
                            <Panel title="Candidate CV" subtitle={audit.claimTitle}>
                                <pre>{audit.claimText}</pre>
                            </Panel>
                            <Panel title="Job evidence" subtitle={audit.evidenceTitle}>
                                <pre>{audit.evidenceText}</pre>
                            </Panel>
                        </section>
                        <SuspiciousWordsPanel text={audit.claimText || verdicts.map((verdict) => verdict.sentence).join(' ')} />
                        <ProfilingModePanel audit={audit} verdicts={verdicts} setRoute={setRoute} />
                        <RewriteSuggestions verdicts={verdicts} />
                        <section className="detailTableSection">
                            <div className="tableToolbar">
                                <h2>Verdicts</h2>
                                <div className="filterStack">
                                    <FilterGroup label="Status" filters={statusFilters} value={statusFilter} onChange={setStatusFilter} />
                                    <FilterGroup label="Confidence" filters={confidenceFilters} value={confidenceFilter} onChange={setConfidenceFilter} />
                                    <FilterGroup label="Severity" filters={severityFilters} value={severityFilter} onChange={setSeverityFilter} />
                                </div>
                            </div>
                            <div className="detailResultsGrid">
                                <div className="detailVerdictTable">
                                    <div className="detailTableHead">
                                        <span>#</span>
                                        <span>Claim</span>
                                        <span>Status</span>
                                        <span>Confidence</span>
                                        <span>Evidence</span>
                                    </div>
                                    {filteredVerdicts.map((verdict) => (
                                        <div className="detailTableRow" key={verdict.id || verdict.sentenceIndex}>
                                            <span>{verdict.sentenceIndex + 1}</span>
                                            <strong>{verdict.sentence}</strong>
                                            <span className={`statusPill ${verdict.status.toLowerCase().replaceAll('_', '-')}`}>{verdict.status}</span>
                                            <span>{verdict.confidence}</span>
                                            <small><b>{verdictSeverity(verdict)}</b> / {verdict.evidencePointer}</small>
                                        </div>
                                    ))}
                                    {filteredVerdicts.length === 0 && <div className="emptyState">No verdicts match this filter.</div>}
                                </div>
                                <EvidenceHighlights evidenceText={audit.evidenceText} verdicts={filteredVerdicts} />
                            </div>
                        </section>
                    </>
                )}
            </main>
        </div>
    );
}

function EvidenceHighlights({ evidenceText, verdicts }) {
    const keywords = evidenceKeywords(verdicts);
    const paragraphs = (evidenceText || '').split(/\n+/).map((value) => value.trim()).filter(Boolean);
    const highlighted = paragraphs
        .map((paragraph, index) => ({ paragraph, index, score: matchScore(paragraph, keywords) }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 6);

    return (
        <aside className="evidencePanel">
            <div>
                <span className="eyebrow">Matching evidence</span>
                <h3>Snippets beside results</h3>
            </div>
            {highlighted.length === 0 && <div className="emptyState">No matching evidence snippets for this filter.</div>}
            {highlighted.map((item) => (
                <article className="evidenceSnippet" key={`${item.index}-${item.paragraph}`}>
                    <strong>Evidence paragraph {item.index + 1}</strong>
                    <p>{highlightText(item.paragraph, keywords)}</p>
                </article>
            ))}
        </aside>
    );
}

const suspiciousWordRules = (defaultAts.analyzers?.localAuditRiskyWords || defaultAts.analyzers?.riskyWords || []).map((word) => [
    word,
    `The default ATS template flags "${word}" as wording that needs stronger evidence.`,
    'Add concrete scope, artifact, metric, team size, date, repo, or source evidence.',
]);

const profilingPhraseRules = defaultAts.rules.flatMap((rule) => [
    ...(rule.keywords || []).map((keyword) => ({
        pattern: new RegExp(`\\b${escapeRegExp(keyword)}\\b`, 'ig'),
        role: rule.label || rule.category || 'ATS_RULE',
        level: riskToProfileLevel(rule.risk),
        risk: rule.why,
        safer: rule.safer,
    })),
    ...(rule.patterns || []).map((pattern) => ({
        pattern: new RegExp(pattern, 'ig'),
        role: rule.label || rule.category || 'ATS_RULE',
        level: riskToProfileLevel(rule.risk),
        risk: rule.why,
        safer: rule.safer,
    })),
]);

function riskToProfileLevel(risk) {
    if (risk === 'High') return 'high';
    if (risk === 'Medium') return 'medium';
    return 'low';
}

function ProfilingModePanel({ audit, verdicts, setRoute }) {
    const rows = (verdicts || []).map((verdict) => ({
        verdict,
        matches: profileSentence(verdict.sentence || ''),
        severity: profileSeverity(verdict),
    }));
    const activeRows = rows.filter((row) => row.matches.length > 0 || isProblemVerdict(row.verdict));
    const hotPhraseCount = rows.reduce((count, row) => count + row.matches.length, 0);
    const templateName = audit?.templateName || 'Selected template';
    const stateName = audit?.checkStateName || 'Default state';

    return (
        <section className="profilingPanel">
            <div className="profilingHead">
                <div>
                    <span className="eyebrow">Profiling mode</span>
                    <h2>Forensic language layer</h2>
                    <p>Hover or focus highlighted phrases to see their role, risk, and why the current template/state cares.</p>
                </div>
                <div className="profilingStats">
                    <Metric label="Hot phrases" value={hotPhraseCount} />
                    <Metric label="Profiled claims" value={activeRows.length} />
                    {audit?.id && setRoute && (
                        <button className="primary" onClick={() => navigateTo(setRoute, 'auditProfile', audit.id)}>
                            <FileSearch size={16} /> Open profiling mode
                        </button>
                    )}
                </div>
            </div>
            <div className="profilingContext">
                <span>{templateName}</span>
                <span>{stateName}</span>
                <span>Evidence pressure: unsupported confidence is treated as risk, not style.</span>
            </div>
            <div className="profiledDocument preview">
                {activeRows.length === 0 && <div className="emptyState">No profile hotspots found in this audit.</div>}
                {activeRows.slice(0, 3).map(({ verdict, matches, severity }) => (
                    <article className={`profileSentenceCard ${severity}`} key={verdict.id || verdict.sentenceIndex}>
                        <div className="profileSentenceMeta">
                            <span className={`statusPill ${verdict.status.toLowerCase().replaceAll('_', '-')}`}>{verdict.status}</span>
                            <small>{verdictSeverity(verdict)} / sentence {verdict.sentenceIndex + 1}</small>
                        </div>
                        <p className="profileSentenceText">
                            {renderProfiledSentence(verdict.sentence, matches, verdict, templateName, stateName)}
                        </p>
                        <small>{profileSentenceSummary(verdict, matches)}</small>
                    </article>
                ))}
            </div>
        </section>
    );
}

export function ProfilingModePage({ Header, setRoute, user, userToken, setUser, setUserToken, audit, loading, error, onRetry }) {
    const verdicts = audit?.verdicts || [];
    const profiledText = buildProfiledText(audit?.claimText || verdicts.map((verdict) => verdict.sentence).join('\n'), verdicts, audit);
    const [activeProfile, setActiveProfile] = useState(null);
    const [inspectorWidth, setInspectorWidth] = useState(420);
    const [resizingInspector, setResizingInspector] = useState(false);
    const profileLayoutRef = useRef(null);
    const inspectorOpen = Boolean(activeProfile);

    useEffect(() => {
        if (!resizingInspector) {
            return undefined;
        }
        function resize(event) {
            const rect = profileLayoutRef.current?.getBoundingClientRect();
            if (!rect) {
                return;
            }
            const pointerX = event.touches?.[0]?.clientX ?? event.clientX;
            const maxWidth = Math.min(720, rect.width * 0.62);
            const nextWidth = Math.min(maxWidth, Math.max(320, rect.right - pointerX));
            setInspectorWidth(nextWidth);
        }
        function stopResize() {
            setResizingInspector(false);
        }
        window.addEventListener('pointermove', resize);
        window.addEventListener('pointerup', stopResize);
        return () => {
            window.removeEventListener('pointermove', resize);
            window.removeEventListener('pointerup', stopResize);
        };
    }, [resizingInspector]);

    return (
        <div className="shell profileShell">
            <div className="pageGlow contentFadeIn" />
            <Header setRoute={setRoute} user={user} userToken={userToken} setUser={setUser} setUserToken={setUserToken} />
            <main className="profileModePage contentFadeIn">
                <section className="profileModeTopbar">
                    <button className="ghost" disabled={!audit?.id} onClick={() => navigateTo(setRoute, 'auditDetail', audit.id)}>Back to audit</button>
                    <div>
                        <span className="eyebrow">Profiling mode</span>
                        <h1>{audit?.claimTitle || 'Forensic language profile'}</h1>
                        <p>{audit?.templateName || 'Selected template'} / {audit?.checkStateName || 'Default state'} / click highlighted text to inspect it.</p>
                    </div>
                    {audit?.id && <ExportActions auditId={audit.id} />}
                </section>
                {error && <div className="error">{error}</div>}
                {loading && <><Loading stage="LOADING PROFILING MODE" /><SkeletonBlock rows={8} /></>}
                {!loading && error && <RouteRetryNotice title="Profiling mode failed to load." message={error} onRetry={onRetry} />}
                {!loading && !error && !audit && <div className="emptyState">Profiling mode needs an audit record.</div>}
                {audit && (
                    <section ref={profileLayoutRef} className={`profileModeLayout ${inspectorOpen ? 'inspectorOpen' : ''} ${resizingInspector ? 'resizing' : ''}`}>
                        <article className="profileDocumentSheet">
                            <div className="profileDocumentHead">
                                <span>Candidate CV</span>
                                <strong>{audit.claimTitle}</strong>
                            </div>
                            <div className="profileDocumentText">
                                {renderProfiledFullText(profiledText, activeProfile, setActiveProfile)}
                            </div>
                        </article>
                        <div
                            className="profileResizeHandle"
                            aria-hidden={!inspectorOpen}
                            onPointerDown={(event) => {
                                if (!inspectorOpen) {
                                    return;
                                }
                                event.preventDefault();
                                setResizingInspector(true);
                            }}
                        />
                        <ProfileInspector audit={audit} activeProfile={activeProfile} onClose={() => setActiveProfile(null)} width={inspectorWidth} />
                    </section>
                )}
            </main>
        </div>
    );
}

function profileSentence(sentence) {
    const matches = [];
    profilingPhraseRules.forEach((rule) => {
        const pattern = new RegExp(rule.pattern.source, rule.pattern.flags);
        let match = pattern.exec(sentence);
        while (match) {
            matches.push({
                text: match[0],
                start: match.index,
                end: match.index + match[0].length,
                role: rule.role,
                level: rule.level,
                risk: rule.risk,
                safer: rule.safer,
            });
            match = pattern.exec(sentence);
        }
    });
    return matches
        .sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start))
        .filter((match, index, all) => !all.some((other, otherIndex) => otherIndex < index && other.start <= match.start && other.end >= match.end));
}

function renderProfiledSentence(sentence, matches, verdict, templateName, stateName) {
    if (!matches.length) {
        return sentence;
    }
    const parts = [];
    let cursor = 0;
    matches.forEach((match, index) => {
        if (match.start > cursor) {
            parts.push(sentence.slice(cursor, match.start));
        }
        parts.push(
            <span className={`profileHotspot ${match.level}`} tabIndex={0} key={`${match.text}-${match.start}-${index}`}>
        {sentence.slice(match.start, match.end)}
                <span className="profileTooltip" role="tooltip">
          <b>{match.role}</b>
          <span>{match.risk}</span>
          <span>{templateName} + {stateName}: {profileStatePressure(verdict)}</span>
          <em>{match.safer}</em>
        </span>
      </span>
        );
        cursor = match.end;
    });
    if (cursor < sentence.length) {
        parts.push(sentence.slice(cursor));
    }
    return parts;
}

function buildProfiledText(text, verdicts, audit) {
    const matches = profileSentence(text || '').map((match) => {
        const verdict = nearestVerdictForMatch(text, match, verdicts) || fallbackProfileVerdict(text, match);
        return {
            ...match,
            payload: profileInspectorPayload(match, verdict, audit),
            severity: profileSeverity(verdict),
        };
    });
    return { text: text || '', matches };
}

function renderProfiledFullText(profiledText, activeProfile, setActiveProfile) {
    const { text, matches } = profiledText;
    const parts = [];
    let cursor = 0;
    matches.forEach((match) => {
        const active = activeProfile?.key === match.payload.key;
        if (match.start > cursor) {
            parts.push(...renderPlainProfileText(text.slice(cursor, match.start), `plain-${cursor}`));
        }
        parts.push(
            <button
                className={`profileWordMark ${match.level} ${active ? 'active' : ''}`}
                key={match.payload.key}
                onClick={() => setActiveProfile(match.payload)}
            >
                {text.slice(match.start, match.end)}
                <span className="profileMiniTooltip">{miniProfileText(match.payload)}</span>
            </button>
        );
        cursor = match.end;
    });
    if (cursor < text.length) {
        parts.push(...renderPlainProfileText(text.slice(cursor), `plain-${cursor}`));
    }
    return parts;
}

function renderPlainProfileText(value, keyPrefix) {
    return value.split(/(\n+)/).map((part, index) => {
        if (/^\n+$/.test(part)) {
            return <br key={`${keyPrefix}-br-${index}`} />;
        }
        return part;
    });
}

function nearestVerdictForMatch(text, match, verdicts) {
    const lower = (text || '').toLowerCase();
    return (verdicts || []).find((verdict) => {
        const sentence = (verdict.sentence || '').toLowerCase().trim();
        return sentence && lower.includes(sentence) && match.start >= lower.indexOf(sentence) && match.start <= lower.indexOf(sentence) + sentence.length;
    }) || (verdicts || []).find((verdict) => (verdict.sentence || '').toLowerCase().includes(match.text.toLowerCase()));
}

function fallbackProfileVerdict(text, match) {
    return {
        id: `text-${match.start}`,
        sentenceIndex: 0,
        sentence: surroundingText(text, match.start, match.end),
        status: match.level === 'high' ? 'UNSUPPORTED' : 'STRETCHED',
        confidence: match.level === 'high' ? 'HIGH' : 'MEDIUM',
        explanation: 'This phrase is profiled from the full document text even when it does not map cleanly to a saved verdict sentence.',
        evidencePointer: 'Open the verdict table for exact evidence mapping.',
    };
}

function surroundingText(text, start, end) {
    const before = text.lastIndexOf('.', start);
    const after = text.indexOf('.', end);
    return text.slice(before >= 0 ? before + 1 : 0, after >= 0 ? after + 1 : text.length).trim();
}

function miniProfileText(profile) {
    if (profile.status === 'SUPPORTED') {
        return `${profile.role}: supported by evidence.`;
    }
    if (profile.status === 'UNSUPPORTED') {
        return `${profile.role}: needs proof.`;
    }
    if (profile.status === 'GAP') {
        return `${profile.role}: evidence gap.`;
    }
    return `${profile.role}: wording may be too strong.`;
}

function profileInspectorPayload(match, verdict, audit) {
    return {
        key: `${verdict.id || verdict.sentenceIndex}-${match.start}-${match.text}`,
        phrase: match.text,
        role: match.role,
        level: match.level,
        risk: match.risk,
        safer: match.safer,
        status: verdict.status,
        confidence: verdict.confidence,
        sentence: verdict.sentence,
        explanation: verdict.explanation,
        evidencePointer: verdict.evidencePointer,
        severity: verdictSeverity(verdict),
        statePressure: profileStatePressure(verdict),
        templateName: audit?.templateName || 'Selected template',
        stateName: audit?.checkStateName || 'Default state',
    };
}

function ProfileInspector({ audit, activeProfile, onClose, width }) {
    return (
        <aside className={`profileInspector ${activeProfile ? 'open' : ''}`} style={{ '--inspector-width': `${width}px` }}>
            <div className="profileInspectorHead">
                <div>
                    <span className="eyebrow">Inspector</span>
                    <h2>{activeProfile?.phrase || 'Select a highlight'}</h2>
                </div>
                <button className="ghost inspectorClose" onClick={onClose} aria-label="Close inspector"><X size={16} /> Close</button>
            </div>
            {!activeProfile ? (
                <div className="emptyState">Hover or click a highlighted phrase in the document to open its analysis here.</div>
            ) : (
                <>
                    <div className="inspectorGrid">
                        <Metric label="Role" value={activeProfile.role} />
                        <Metric label="Risk" value={activeProfile.severity} />
                        <Metric label="Verdict" value={activeProfile.status} />
                        <Metric label="Confidence" value={activeProfile.confidence} />
                    </div>
                    <section>
                        <h3>Why this matters</h3>
                        <p>{activeProfile.risk}</p>
                    </section>
                    <section>
                        <h3>Template/state pressure</h3>
                        <p>{activeProfile.templateName} + {activeProfile.stateName}: {activeProfile.statePressure}</p>
                    </section>
                    <section>
                        <h3>Safer wording</h3>
                        <p>{activeProfile.safer}</p>
                    </section>
                    <section>
                        <h3>Sentence</h3>
                        <p>{activeProfile.sentence}</p>
                    </section>
                    <section>
                        <h3>Evidence pointer</h3>
                        <p>{activeProfile.evidencePointer || 'No evidence pointer available.'}</p>
                    </section>
                    <section>
                        <h3>Audit explanation</h3>
                        <p>{activeProfile.explanation}</p>
                    </section>
                </>
            )}
            <div className="profileInspectorFooter">
                <span>{audit?.engine || 'Engine unknown'}</span>
                <span>{audit?.analyzerVersion || 'Analyzer unknown'}</span>
            </div>
        </aside>
    );
}

function profileStatePressure(verdict) {
    if (verdict.status === 'SUPPORTED') {
        return 'this phrase is acceptable because evidence currently supports the claim.';
    }
    if (verdict.status === 'STRETCHED') {
        return 'this phrase may be too strong for the evidence available.';
    }
    if (verdict.status === 'UNSUPPORTED') {
        return 'this phrase needs proof before it can be trusted.';
    }
    if (verdict.status === 'GAP') {
        return 'this phrase exposes a missing requirement or unanswered evidence gap.';
    }
    return 'this phrase is read as context unless it makes a verifiable claim.';
}

function profileSeverity(verdict) {
    if (verdict.status === 'UNSUPPORTED' || verdict.status === 'GAP') {
        return 'high';
    }
    if (verdict.status === 'STRETCHED') {
        return 'medium';
    }
    return 'low';
}

function profileSentenceSummary(verdict, matches) {
    if (matches.length > 0) {
        return `${matches.length} profiled phrase${matches.length === 1 ? '' : 's'} found. ${verdict.explanation}`;
    }
    if (isProblemVerdict(verdict)) {
        return `No specific hotspot, but the sentence is still profiled because the verdict is ${verdict.status}. ${verdict.explanation}`;
    }
    return verdict.explanation;
}

function SuspiciousWordsPanel({ text }) {
    const lower = (text || '').toLowerCase();
    const hits = suspiciousWordRules
        .map(([word, risk, safer]) => ({ word, risk, safer, count: countWord(lower, word) }))
        .filter((item) => item.count > 0);
    if (hits.length === 0) {
        return (
            <section className="suspiciousPanel">
                <div>
                    <span className="eyebrow">Suspicious words</span>
                    <h2>No risky wording detected</h2>
                </div>
                <p>Current claim language avoids the most common inflated terms.</p>
            </section>
        );
    }
    return (
        <section className="suspiciousPanel">
            <div>
                <span className="eyebrow">Suspicious words</span>
                <h2>Risky wording found</h2>
            </div>
            <div className="suspiciousGrid">
                {hits.map((item) => (
                    <article key={item.word}>
                        <strong>{item.word}</strong>
                        <span>{item.count} match{item.count === 1 ? '' : 'es'}</span>
                        <p>{item.risk}</p>
                        <small>{item.safer}</small>
                    </article>
                ))}
            </div>
        </section>
    );
}

function RewriteSuggestions({ verdicts }) {
    const suggestions = (verdicts || [])
        .filter((verdict) => ['STRETCHED', 'UNSUPPORTED'].includes(verdict.status))
        .map((verdict) => ({
            id: verdict.id || verdict.sentenceIndex,
            status: verdict.status,
            original: verdict.sentence,
            replacement: saferRewrite(verdict),
            reason: verdict.explanation,
        }));
    if (suggestions.length === 0) {
        return (
            <section className="rewritePanel">
                <div>
                    <span className="eyebrow">Rewrite suggestions</span>
                    <h2>No rewrites needed</h2>
                </div>
                <p>There are no stretched or unsupported claims in the current verdict set.</p>
            </section>
        );
    }
    return (
        <section className="rewritePanel">
            <div>
                <span className="eyebrow">Rewrite suggestions</span>
                <h2>Safer replacement wording</h2>
            </div>
            <div className="rewriteList">
                {suggestions.map((suggestion) => (
                    <article key={suggestion.id}>
                        <span className={`statusPill ${suggestion.status.toLowerCase()}`}>{suggestion.status}</span>
                        <p><b>Original:</b> {suggestion.original}</p>
                        <p><b>Safer:</b> {suggestion.replacement}</p>
                        <small>{suggestion.reason}</small>
                    </article>
                ))}
            </div>
        </section>
    );
}

function saferRewrite(verdict) {
    const sentence = verdict.sentence.replace(/\.$/, '');
    if (verdict.status === 'UNSUPPORTED') {
        return `Evidence does not currently verify: ${softenInflatedWords(sentence)}.`;
    }
    return `${softenInflatedWords(sentence)} based on the available evidence.`;
}

function softenInflatedWords(sentence) {
    return sentence
        .replace(/\b[Ee]xpert in\b/g, 'Experience with')
        .replace(/\b[Ll]ed\b/g, 'Contributed to')
        .replace(/\b[Oo]ptimized\b/g, 'Worked on improving')
        .replace(/\b[Pp]roven\b/g, 'Documented')
        .replace(/\b[Aa]dvanced\b/g, 'Specific');
}

function countWord(text, word) {
    const matches = text.match(new RegExp(`\\b${escapeRegExp(word)}\\b`, 'g'));
    return matches ? matches.length : 0;
}

function evidenceKeywords(verdicts) {
    const words = verdicts.flatMap((verdict) => `${verdict.sentence} ${verdict.evidencePointer || ''}`
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((word) => word.length >= 5));
    return [...new Set(words)].slice(0, 30);
}

function matchScore(text, keywords) {
    const lower = text.toLowerCase();
    return keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0);
}

function highlightText(text, keywords) {
    const sorted = keywords.filter(Boolean).sort((a, b) => b.length - a.length);
    if (sorted.length === 0) {
        return text;
    }
    const pattern = new RegExp(`(${sorted.map(escapeRegExp).join('|')})`, 'ig');
    return text.split(pattern).map((part, index) => (
        sorted.some((keyword) => part.toLowerCase() === keyword.toLowerCase())
            ? <mark key={`${part}-${index}`}>{part}</mark>
            : part
    ));
}

function escapeRegExp(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function FilterGroup({ label, filters, value, onChange }) {
    return (
        <div className="filterGroup">
            <span>{label}</span>
            <div className="filterTabs">
                {filters.map((filter) => (
                    <button key={filter} className={value === filter ? 'active' : ''} onClick={() => onChange(filter)}>
                        {filter}
                    </button>
                ))}
            </div>
        </div>
    );
}

function verdictSeverity(verdict) {
    if (verdict.status === 'UNSUPPORTED' || verdict.status === 'GAP') {
        return 'HIGH RISK';
    }
    if (verdict.status === 'STRETCHED') {
        return 'MEDIUM RISK';
    }
    if (verdict.status === 'SUPPORTED' || verdict.status === 'NOT_A_CLAIM') {
        return 'LOW RISK';
    }
    return 'PROBLEM';
}

function isProblemVerdict(verdict) {
    return ['STRETCHED', 'UNSUPPORTED', 'GAP'].includes(verdict.status);
}

function formatDateTime(value) {
    return value ? new Date(value).toLocaleString() : 'Unknown';
}

function formatAuditCost(value) {
    const amount = Number(value || 0);
    return `$${Number.isFinite(amount) ? amount.toFixed(6) : '0.000000'}`;
}

function shortHash(value) {
    return value ? `${value.slice(0, 8)}...` : 'None';
}

export function AuditResult({ audit, setRoute }) {
    const verdicts = audit.verdicts || [];
    const problems = verdicts.filter((v) => ['UNSUPPORTED', 'STRETCHED', 'GAP'].includes(v.status));
    return (
        <section className="results">
            <StickyAuditBar audit={audit} />
            <div className="scoreBlock">
                <Gauge size={26} />
                <div>
                    <span>Credibility Score</span>
                    <strong>{audit.credibilityScore}%</strong>
                </div>
                <div className="counts">
                    <b>{audit.supportedCount}</b> supported
                    <b>{audit.stretchedCount}</b> stretched
                    <b>{audit.unsupportedCount}</b> unsupported
                </div>
            </div>
            <AuditScoreExplainer audit={audit} />
            <DenseVerdictTable verdicts={verdicts} />
            <div className="verdictGrid">
                {verdicts.map((verdict) => <VerdictCard key={verdict.id || verdict.sentenceIndex} verdict={verdict} />)}
            </div>
            <SuspiciousWordsPanel text={audit.claimText || verdicts.map((verdict) => verdict.sentence).join(' ')} />
            <ProfilingModePanel audit={audit} verdicts={verdicts} setRoute={setRoute} />
            <RewriteSuggestions verdicts={verdicts} />
            <div className="summaryStrip">
                <ShieldCheck size={18} />
                <span>Top risk count: {problems.length}. Status: {audit.status || 'COMPLETED'}. Engine: {audit.engine}. Tokens: {audit.totalTokens || 0}. Estimated cost: {formatAuditCost(audit.estimatedCostUsd)}. Completed in {audit.processingMillis}ms.</span>
            </div>
        </section>
    );
}

function StickyAuditBar({ audit }) {
    if (!audit) {
        return null;
    }
    const level = auditScoreLevel(audit.credibilityScore);
    return (
        <div className="stickyAuditBar">
            <div>
                <span>Score</span>
                <strong>{audit.credibilityScore}%</strong>
            </div>
            <div><span>Level</span><b>{level}/10</b></div>
            <div><span>Supported</span><b>{audit.supportedCount}</b></div>
            <div><span>Stretched</span><b>{audit.stretchedCount}</b></div>
            <div><span>Unsupported</span><b>{audit.unsupportedCount}</b></div>
            <div><span>State</span><b>{audit.checkStateName || 'Default'}</b></div>
            <div><span>Engine</span><b>{audit.engine}</b></div>
            <ExportActions auditId={audit.id} />
        </div>
    );
}

function ExportActions({ auditId }) {
    const [exportState, setExportState] = useState({ busy: '', error: '' });
    const formats = [
        ['txt', 'TXT'],
        ['word', 'Word'],
        ['excel', 'Excel'],
        ['pdf', 'PDF'],
    ];
    async function download(format) {
        setExportState({ busy: format, error: '' });
        try {
            await exportAudit(auditId, format);
            setExportState({ busy: '', error: '' });
        } catch (error) {
            setExportState({ busy: '', error: error.message || `Could not export ${format.toUpperCase()}.` });
        }
    }
    return (
        <div className="exportActions" aria-label="Export audit formats">
            <span><Download size={15} /> Export</span>
            {formats.map(([format, label]) => (
                <button key={format} className={format === 'pdf' ? 'primaryExport' : ''} disabled={Boolean(exportState.busy)} onClick={() => download(format)}>
                    {exportState.busy === format ? '...' : label}
                </button>
            ))}
            {exportState.error && (
                <button className="exportRetry" type="button" onClick={() => download('pdf')}>
                    Retry PDF
                </button>
            )}
        </div>
    );
}

async function exportAudit(id, format = 'txt') {
    const token = readUserToken();
    const response = await fetch(`/api/audit/${id}/export?format=${encodeURIComponent(format)}`, { headers: { 'X-User-Token': token } });
    if (!response.ok) {
        throw new Error(`${format.toUpperCase()} export failed. Check your session and try again.`);
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = exportFilename(id, format, response.headers.get('Content-Disposition'));
    link.click();
    URL.revokeObjectURL(url);
}

function exportFilename(id, format, disposition) {
    const match = disposition?.match(/filename="?([^"]+)"?/i);
    if (match?.[1]) {
        return match[1];
    }
    const extensions = { txt: 'txt', word: 'doc', excel: 'csv', pdf: 'pdf' };
    return `verdict-audit-${id}.${extensions[format] || 'txt'}`;
}
