import React from 'react';

export function Panel({ title, subtitle, children }) {
  return (
    <div className="panel">
      <div className="panelHead">
        <span>{title}</span>
        <small>{subtitle}</small>
      </div>
      {children}
    </div>
  );
}

export function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

export function Textarea({ value, onChange }) {
  return <textarea value={value} onChange={(event) => onChange(event.target.value)} spellCheck="false" />;
}

export function Metric({ label, value }) {
  return (
    <div className="metric">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

export function Loading({ stage }) {
  return (
    <div className="loading">
      <div className="scanner"><span /></div>
      <div>
        <strong>{stage}</strong>
        <p>Audit engine is checking claims against evidence.</p>
      </div>
    </div>
  );
}
