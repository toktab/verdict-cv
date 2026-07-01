import { auditScoreLevel } from '../utils/auditScore';

export function AuditScoreExplainer({ audit }) {
    if (!audit) {
        return null;
    }
    const level = auditScoreLevel(audit.credibilityScore);
    const drivers = auditScoreDrivers(audit);
    return (
        <section className="auditScoreExplainer">
            <div className="scoreLevelPanel auditScoreLevelPanel">
                <div>
                    <span className="eyebrow">Score level</span>
                    <h3>{level}/10 - {auditScoreLevelLabel(level)}</h3>
                    <p>{auditScoreLevelExplanation(level)}</p>
                </div>
                <div className="scoreLevelRail" aria-label="Audit score level out of 10">
                    {Array.from({ length: 10 }, (_, index) => {
                        const step = index + 1;
                        return <span className={step === level ? 'active' : step < level ? 'passed' : ''} key={step}>{step}</span>;
                    })}
                </div>
            </div>
            <div className="auditScoreDrivers">
                <div>
                    <span className="eyebrow">What moved the score</span>
                    <h3>Evidence pressure map</h3>
                </div>
                {drivers.map((driver) => (
                    <article className={driver.tone} key={driver.label}>
                        <span>{driver.label}</span>
                        <strong>{driver.value}</strong>
                        <small>{driver.text}</small>
                    </article>
                ))}
            </div>
        </section>
    );
}

function auditScoreLevelLabel(level) {
    if (level >= 9) return 'Highly supported';
    if (level >= 7) return 'Mostly supported';
    if (level >= 5) return 'Mixed evidence';
    if (level >= 3) return 'High review risk';
    return 'Evidence failure';
}

function auditScoreLevelExplanation(level) {
    if (level >= 9) return 'The claim set is strongly aligned with supplied evidence and has few visible risk flags.';
    if (level >= 7) return 'Most important claims are supported, but the audit still found wording or evidence gaps worth checking.';
    if (level >= 5) return 'The record has useful support and meaningful uncertainty. Reviewers should inspect the highlighted gaps before trusting it.';
    if (level >= 3) return 'Unsupported or stretched claims are carrying the result. Treat this as a review queue, not a pass.';
    return 'The evidence does not substantiate the claim set enough for a hiring or business decision.';
}

function auditScoreDrivers(audit) {
    const supported = audit.supportedCount || 0;
    const stretched = audit.stretchedCount || 0;
    const unsupported = audit.unsupportedCount || 0;
    const gaps = audit.gapCount || 0;
    return [
        {
            label: 'Supported claims',
            value: `+${supported}`,
            tone: 'positive',
            text: 'Directly backed statements lift the credibility level.',
        },
        {
            label: 'Stretched wording',
            value: `-${stretched}`,
            tone: stretched ? 'warning' : 'positive',
            text: 'Claims that may be true but overstate the available proof.',
        },
        {
            label: 'Unsupported claims',
            value: `-${unsupported}`,
            tone: unsupported ? 'negative' : 'positive',
            text: 'Statements with no matching evidence create the strongest penalty.',
        },
        {
            label: 'Requirement gaps',
            value: `-${gaps}`,
            tone: gaps ? 'warning' : 'positive',
            text: 'Missing or weak requirement coverage lowers confidence.',
        },
    ];
}
