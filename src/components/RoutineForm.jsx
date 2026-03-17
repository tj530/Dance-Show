import React, { useState } from 'react';

const POSITIONS = [
  { value: '', label: 'None' },
  { value: 'opening', label: 'Opening' },
  { value: 'finale', label: 'Finale' },
  { value: 'first-half-closer', label: 'First-Half Closer' },
  { value: 'second-half-opener', label: 'Second-Half Opener' },
];

const blank = () => ({
  title: '', students: '', act: '', position: '', style: '', level: '',
});

export default function RoutineForm({ onAdd, numActs }) {
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setError('');
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    const students = form.students
      .split(/[;,|]/)
      .map(s => s.trim())
      .filter(Boolean);

    onAdd({
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: form.title.trim(),
      students,
      act: ['1', '2'].includes(form.act) ? Number(form.act) : null,
      position: form.position || null,
      style: form.style.trim(),
      level: form.level.trim(),
    });
    setForm(blank());
  }

  return (
    <form className="routine-form card" onSubmit={handleSubmit}>
      <h2>Add Routine</h2>
      {error && <p className="error">{error}</p>}

      <div className="form-grid">
        <div className="field-row">
          <label>Title *</label>
          <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Routine name" />
        </div>

        <div className="field-row">
          <label>Students <span className="hint">(separate with ; or ,)</span></label>
          <input value={form.students} onChange={e => set('students', e.target.value)} placeholder="Alice; Bob; Carol" />
        </div>

        <div className="field-row">
          <label>Style</label>
          <input value={form.style} onChange={e => set('style', e.target.value)} placeholder="Ballet, Hip-Hop…" />
        </div>

        <div className="field-row">
          <label>Level</label>
          <input value={form.level} onChange={e => set('level', e.target.value)} placeholder="Beginner, Advanced…" />
        </div>

        {numActs > 1 && (
          <div className="field-row">
            <label>Act</label>
            <select value={form.act} onChange={e => set('act', e.target.value)}>
              <option value="">Either Act</option>
              <option value="1">Act 1</option>
              <option value="2">Act 2</option>
            </select>
          </div>
        )}

        <div className="field-row">
          <label>Special Position</label>
          <select value={form.position} onChange={e => set('position', e.target.value)}>
            {POSITIONS.map(p => (
              <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>
      </div>

      <button type="submit" className="btn-primary">Add Routine</button>
    </form>
  );
}
