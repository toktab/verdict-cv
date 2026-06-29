export function ProjectScoreStrip({ project, large = false }) {
    const total = Math.max(1, project.candidates.length);
    const strong = project.candidates.filter((candidate) => candidate.score >= 80).length;
    const medium = project.candidates.filter((candidate) => candidate.score >= 55 && candidate.score < 80).length;
    const risky = project.candidates.filter((candidate) => candidate.score < 55).length;
    return (
        <div className={`projectScoreStrip ${large ? 'large' : ''}`}>
            <span className="supportedBar" style={{ width: `${(strong / total) * 100}%` }} />
            <span className="stretchedBar" style={{ width: `${(medium / total) * 100}%` }} />
            <span className="unsupportedBar" style={{ width: `${(risky / total) * 100}%` }} />
        </div>
    );
}
