export function DenseVerdictTable({ verdicts = [] }) {
    return (
        <div className="denseVerdictPanel">
            <div className="denseVerdictHead">
                <span>#</span><span>Status</span><span>Confidence</span><span>Claim</span><span>Evidence</span>
            </div>
            {verdicts.map((verdict, index) => (
                <div className="denseVerdictRow" key={verdict.id || index}>
                    <span>{index + 1}</span>
                    <strong>{verdict.status}</strong>
                    <span>{verdict.confidence}</span>
                    <span>{verdict.sentence}</span>
                    <div className="evidenceCell">
                        <small>{verdict.evidencePointer}</small>
                        <EvidenceMeta verdict={verdict} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function VerdictCard({ verdict }) {
    return (
        <article className={`verdict ${verdict.status.toLowerCase().replaceAll('_', '-')}`}>
            <div className="verdictTop">
                <span>{verdict.status}</span>
                <small>{verdict.confidence}</small>
            </div>
            <p className="sentence">{verdict.sentence}</p>
            <p>{verdict.explanation}</p>
            <code>{verdict.evidencePointer}</code>
            <EvidenceMeta verdict={verdict} />
        </article>
    );
}

function EvidenceMeta({ verdict }) {
    const source = evidenceSource(verdict.evidencePointer);
    const quality = evidenceQuality(verdict.status);
    return (
        <span className="evidenceMeta" aria-label={`Evidence source ${source}, quality ${quality}`}>
            <b>{source}</b>
            <i className={quality.toLowerCase()}>{quality}</i>
            <em>{source === 'Manual' ? 'manually reviewed' : 'user-provided/public'}</em>
        </span>
    );
}

function evidenceSource(pointer = '') {
    const value = String(pointer).toLowerCase();
    if (value.includes('github') || value.includes('repository') || value.includes('commit')) return 'GitHub';
    if (value.includes('linkedin')) return 'LinkedIn';
    if (value.includes('portfolio') || value.includes('website')) return 'Portfolio';
    if (value.includes('certificate')) return 'Certificate';
    if (value.includes('osint') || value.includes('public source')) return 'OSINT';
    if (value.includes('manual') || value.includes('reviewer')) return 'Manual';
    return 'CV';
}

function evidenceQuality(status = '') {
    if (status === 'SUPPORTED') return 'Direct';
    if (status === 'STRETCHED') return 'Partial';
    if (status === 'UNSUPPORTED') return 'Missing';
    if (status === 'GAP') return 'Weak';
    return 'Context';
}
