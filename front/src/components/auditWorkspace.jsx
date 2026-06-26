import React from 'react';
import { Save } from 'lucide-react';
import { Input } from './ui';

export function SkeletonBlock({ rows = 3, compact = false }) {
  return (
    <div className={`skeletonBlock ${compact ? 'compact' : ''}`} aria-label="Loading">
      {Array.from({ length: rows }).map((_, index) => <span key={index} />)}
    </div>
  );
}

export function AuditTemplatePanel({ mode, templates, selectedId, onSelect, templateForm, setTemplateForm, onSave }) {
  const modeTemplates = templates.filter((template) => template.mode === mode);
  const selected = modeTemplates.find((template) => template.id === selectedId) || modeTemplates[0];
  return (
    <section className="templatePanel">
      <div className="templateHeader">
        <div>
          <span className="eyebrow">Audit template</span>
          <h2>{selected?.name || 'No template selected'}</h2>
          <p>{selected?.description || 'Choose a default template or save your own private template.'}</p>
        </div>
        <select value={selectedId || selected?.id || ''} onChange={(event) => onSelect(event.target.value)}>
          {modeTemplates.map((template) => (
            <option key={template.id} value={template.id}>{template.source === 'default' ? 'Default' : 'Custom'} / {template.name}</option>
          ))}
        </select>
      </div>
      {selected?.instructions && <p className="templateInstructions">{selected.instructions}</p>}
      <div className="templateBuilder">
        <Input label="Custom template name" value={templateForm.name} onChange={(name) => setTemplateForm({ ...templateForm, name })} />
        <Input label="Description" value={templateForm.description} onChange={(description) => setTemplateForm({ ...templateForm, description })} />
        <Input label="Mark as unimportant" value={templateForm.markUnimportant} onChange={(markUnimportant) => setTemplateForm({ ...templateForm, markUnimportant })} />
        <label className="field">
          <span>Instructions</span>
          <textarea value={templateForm.instructions} onChange={(event) => setTemplateForm({ ...templateForm, instructions: event.target.value })} />
        </label>
        <label className="toggleRow compact">
          <input type="checkbox" checked={templateForm.shared} onChange={(event) => setTemplateForm({ ...templateForm, shared: event.target.checked })} />
          <span>Share in library</span>
        </label>
        <button className="primary" onClick={onSave}><Save size={16} /> Save custom template</button>
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
          <h2>{selected?.name || 'No state selected'}</h2>
          <p>{selected?.description || 'Choose how strict and contextual this audit should be.'}</p>
        </div>
        <select value={selectedId || selected?.id || ''} onChange={(event) => onSelect(event.target.value)}>
          {states.map((state) => (
            <option key={state.id} value={state.id}>{state.name}{state.paid ? ' / paid' : ''}</option>
          ))}
        </select>
      </div>
      {selected && (
        <div className="stateCards">
          {states.map((state) => (
            <button key={state.id} className={state.id === selected.id ? 'active' : ''} onClick={() => onSelect(state.id)}>
              <strong>{state.name}</strong>
              <span>{state.intensity}{state.paid ? ' / paid' : ' / included'}</span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export function DenseVerdictTable({ verdicts }) {
  return (
    <section className="denseVerdictPanel">
      <div className="denseVerdictHead">
        <span>#</span>
        <span>Status</span>
        <span>Confidence</span>
        <span>Claim</span>
        <span>Evidence</span>
      </div>
      {verdicts.map((verdict) => (
        <div className="denseVerdictRow" key={verdict.id || verdict.sentenceIndex}>
          <span>{verdict.sentenceIndex + 1}</span>
          <span className={`statusPill ${verdict.status.toLowerCase().replaceAll('_', '-')}`}>{verdict.status}</span>
          <span>{verdict.confidence}</span>
          <strong>{verdict.sentence}</strong>
          <small>{verdict.evidencePointer}</small>
        </div>
      ))}
    </section>
  );
}
