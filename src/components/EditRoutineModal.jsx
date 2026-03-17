import React, { useState } from 'react';

const POSITIONS = [
  { value: '', label: 'None' },
  { value: 'opening', label: 'Opening' },
  { value: 'finale', label: 'Finale' },
  { value: 'first-half-closer', label: 'First-Half Closer' },
  { value: 'second-half-opener', label: 'Second-Half Opener' },
];

export default function EditRoutineModal({ routine, numActs, onSave, onClose }) {
  const [form, setForm] = useState({
    title: routine.title,
    students: routine.students.join('; '),
    act: routine.act ? String(routine.act) : '',
    position: routine.position || '',
    style: routine.style || '',
    level: routine.level || '',
  });

  function set(field, val) {
    setForm(f => ({ ...f, [field]: val }));
  }

  function handleSave() {
    const students = form.students.split(/[;,|]/).map(s => s.trim()).filter(Boolean);
    onSave({
      ...routine,
      title: form.title.trim(),
      students,
      act: ['1', '2'].includes(form.act) ? Number(form.act) : null,
      position: form.position || null,
      style: form.style.trim(),
      level: form.level.trim(),
    });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h2>Edit Routine</h2>
        <div className="form-grid">
          <div className="field-row">
            <label>Title</label>
            <input value={form.title} onChange={e => set('title', e.target.value)} />
          </div>
          <div className="field-row">
            <label>Students</label>
            <input value={form.students} onChange={e => set('students', e.target.value)} />
          </div>
          <div className="field-row">
            <label>Style</label>
            <input value={form.style} onChange={e => set('style', e.target.value)} />
          </div>
          <div className="field-row">
            <label>Level</label>
            <input value={form.level} onChange={e => set('level', e.target.value)} />
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
        <div className="modal-actions">
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
