export function AddCandidatePanel({ project, Input }) {
    return (
        <section className="addCandidatePanel">
            <div>
                <span className="eyebrow">New candidate</span>
                <h2>Add CV to {project.title}</h2>
                <p>This front-end demo shows the organizer flow. The next backend step should persist a candidate, CV text, consent status, and source links under this job project.</p>
            </div>
            <div className="addCandidateGrid">
                <Input label="Candidate name" value="" onChange={() => null} />
                <Input label="Applied role" value={project.title} onChange={() => null} />
                <Input label="LinkedIn / profile URL" value="" onChange={() => null} />
                <Input label="GitHub / portfolio URL" value="" onChange={() => null} />
            </div>
        </section>
    );
}
