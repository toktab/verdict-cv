import { Brain, Cpu, Save, ShieldCheck, Sparkles, Zap } from 'lucide-react';

export function AuditTemplatePanel({ mode, templates, selectedId, onSelect, templateForm, setTemplateForm, onSave }) {
    return (
        <section className="templatePanel">
            <div className="templateHeader">
                <div>
                    <span className="eyebrow">Templates</span>
                    <h2>Audit instructions</h2>
                </div>
                <select value={selectedId} onChange={(event) => onSelect(event.target.value)}>
                    <option value="">No template</option>
                    {templates.filter((template) => template.mode === mode).map((template) => (
                        <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                </select>
            </div>
            <div className="templateBuilder">
                <PanelInput label="Name" value={templateForm.name} onChange={(name) => setTemplateForm({ ...templateForm, name })} />
                <PanelInput label="Description" value={templateForm.description} onChange={(description) => setTemplateForm({ ...templateForm, description })} />
                <label className="field">
                    <span>Instructions</span>
                    <textarea value={templateForm.instructions} onChange={(event) => setTemplateForm({ ...templateForm, instructions: event.target.value })} />
                </label>
                <button className="secondary" type="button" onClick={onSave}><Save size={16} /> Save template</button>
            </div>
        </section>
    );
}

export function CheckStatePanel({ states, selectedId, onSelect }) {
    const selected = states.find((state) => state.id === selectedId) || states[0];
    return (
        <section className="statePanel">
            <div className="templateHeader">
                <div>
                    <span className="eyebrow">Check state</span>
                    <h2>Analysis engine</h2>
                    <p>Choose the proof burden and reasoning strategy for this run.</p>
                </div>
                {selected && <div className={`stateAvailability ${selected.requiresLlm && !selected.aiConfigured ? 'fallback' : 'ready'}`}><i />{selected.availabilityMessage || 'Ready'}</div>}
            </div>
            <div className="stateCards">
                {states.map((state) => {
                    const StateIcon = stateIcon(state.id);
                    return (
                    <button type="button" key={state.id} aria-pressed={selectedId === state.id} className={selectedId === state.id ? 'active' : ''} onClick={() => onSelect(state.id)}>
                        <span className="stateCardTop"><i><StateIcon size={16} /></i><b>{state.intensity || 'Standard'}</b></span>
                        <strong>{state.name}</strong>
                        <span>{state.description}</span>
                        <small>{state.requiresLlm ? state.aiConfigured ? 'AI connected' : 'Local fallback available' : 'Runs locally'}</small>
                    </button>
                    );
                })}
            </div>
            {selected && (
                <div className="stateSelectedDetail">
                    <div><span className="eyebrow">Selected strategy</span><strong>{strategyLabel(selected.strategy)}</strong></div>
                    <div className="stateCapabilityList">{(selected.capabilities || []).map((capability) => <span key={capability}><ShieldCheck size={14} /> {capability}</span>)}</div>
                </div>
            )}
        </section>
    );
}

function stateIcon(id) {
    if (id === 'light') return Zap;
    if (id === 'person') return Brain;
    if (id === 'strict-war-ai') return Sparkles;
    return Cpu;
}

function strategyLabel(strategy) {
    return {
        DETERMINISTIC: 'Deterministic evidence audit',
        DETERMINISTIC_LENIENT: 'Lenient deterministic screening',
        AI_CONTEXTUAL: 'Contextual AI judgment',
        HYBRID_STRICT: 'Deterministic + AI cross-check',
    }[strategy] || 'Evidence audit';
}

function PanelInput({ label, value, onChange }) {
    return (
        <label className="field">
            <span>{label}</span>
            <input value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
    );
}
