import React, { useState } from 'react';

const POSITIONS = [
  { value: '', label: 'No special position' },
  { value: 'opening', label: 'Opening' },
  { value: 'finale', label: 'Finale' },
  { value: 'first-half-closer', label: 'Act 1 Closer' },
  { value: 'second-half-opener', label: 'Act 2 Opener' },
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
    if (!form.title.trim()) { setError('Please enter a routine title.'); return; }
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
          <label>Routine title <span className="field-required">*</span></label>
          <input
            value={form.title}
            onChange={e => set('title', e.target.value)}
            placeholder="e.g. Swan Lake"
          />
        </div>

        <div className="field-row">
          <label>
            Dancers
            <span className="field-hint">separate with comma or semicolon</span>
          </label>
          <input
            value={form.students}
            onChange={e => set('students', e.target.value)}
            placeholder="Alice, Bob, Carol"
          />
        </div>

        <div className="field-row">
          <label>Style</label>
          <input
            value={form.style}
            onChange={e => set('style', e.target.value)}
            placeholder="Ballet, Hip-Hop, Contemporary…"
          />
        </div>

        <div className="field-row">
          <label>Level</label>
          <input
            value={form.level}
            onChange={e => set('level', e.target.value)}
            placeholder="Beginner, Intermediate, Advanced…"
          />
        </div>

        {numActs > 1 && (
          <div className="field-row">
            <label>Act preference</label>
            <select value={form.act} onChange={e => set('act', e.target.value)}>
              <option value="">Either act</option>
              <option value="1">Act 1</option>
              <option value="2">Act 2</option>
            </select>
          </div>
        )}

        <div className="field-row">
          <label>Special position</label>
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
