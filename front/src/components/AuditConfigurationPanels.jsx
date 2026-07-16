import { Save } from 'lucide-react';

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
    return (
        <section className="statePanel">
            <div className="templateHeader">
                <div>
                    <span className="eyebrow">Check state</span>
                    <h2>Review posture</h2>
                </div>
            </div>
            <div className="stateCards">
                {states.map((state) => (
                    <button type="button" key={state.id} className={selectedId === state.id ? 'active' : ''} onClick={() => onSelect(state.id)}>
                        <strong>{state.name}</strong>
                        <span>{state.description}</span>
                    </button>
                ))}
            </div>
        </section>
    );
}

function PanelInput({ label, value, onChange }) {
    return (
        <label className="field">
            <span>{label}</span>
            <input value={value} onChange={(event) => onChange(event.target.value)} />
        </label>
    );
}
