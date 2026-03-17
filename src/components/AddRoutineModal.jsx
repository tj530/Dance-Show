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

/**
 * Modal with two modes:
 *  - "existing": pick a routine not yet in the lineup
 *  - "new": fill out a quick form to create one from scratch
 */
export default function AddRoutineModal({ routines, lineupRoutineIds, numActs, onAdd, onClose }) {
  const [mode, setMode] = useState('existing');
  const [form, setForm] = useState(blank());
  const [error, setError] = useState('');

  const available = routines.filter(r => !lineupRoutineIds.has(r.id));

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
    setError('');
  }

  function handleAddExisting(routine) {
    onAdd(routine, false);
  }

  function handleCreateNew(e) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }
    const students = form.students.split(/[;,|]/).map(s => s.trim()).filter(Boolean);
    const newRoutine = {
      id: `r-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: form.title.trim(),
      students,
      act: ['1', '2'].includes(form.act) ? Number(form.act) : null,
      position: form.position || null,
      style: form.style.trim(),
      level: form.level.trim(),
    };
    onAdd(newRoutine, true);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal modal-wide" onClick={e => e.stopPropagation()}>
        <h2>Add Routine to Lineup</h2>

        <div className="mode-tabs">
          <button
            className={`mode-tab ${mode === 'existing' ? 'active' : ''}`}
            onClick={() => setMode('existing')}
          >
            From Existing ({available.length})
          </button>
          <button
            className={`mode-tab ${mode === 'new' ? 'active' : ''}`}
            onClick={() => setMode('new')}
          >
            Create New
          </button>
        </div>

        {mode === 'existing' && (
          <div className="existing-routines-list">
            {available.length === 0 ? (
              <p className="empty">All routines are already in the lineup.</p>
            ) : (
              <ul>
                {available.map(r => (
                  <li key={r.id} className="existing-routine-row">
                    <div className="existing-routine-info">
                      <strong>{r.title}</strong>
                      <div className="existing-routine-meta">
                        {r.style && <span className="tag tag-style">{r.style}</span>}
                        {r.level && <span className="tag tag-level">{r.level}</span>}
                        {r.act && <span className="tag tag-act">Act {r.act}</span>}
                        {r.students.length > 0 && (
                          <span className="tag-muted">{r.students.length} dancer{r.students.length !== 1 ? 's' : ''}</span>
                        )}
                      </div>
                    </div>
                    <button className="btn-sm btn-edit" onClick={() => handleAddExisting(r)}>
                      + Add
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {mode === 'new' && (
          <form className="form-grid" onSubmit={handleCreateNew}>
            {error && <p className="error">{error}</p>}
            <div className="field-row">
              <label>Title *</label>
              <input value={form.title} onChange={e => set('title', e.target.value)} placeholder="Routine name" />
            </div>
            <div className="field-row">
              <label>Dancers <span className="hint">(separate with ; or ,)</span></label>
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
            <button type="submit" className="btn-primary">Create & Add to Lineup</button>
          </form>
        )}

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn-secondary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
