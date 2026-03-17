import React, { useState } from 'react';

const POSITIONS = {
  opening: 'Opening',
  finale: 'Finale',
  'first-half-closer': 'First-Half Closer',
  'second-half-opener': 'Second-Half Opener',
};

export default function RoutineList({ routines, onDelete, onEdit }) {
  const [search, setSearch] = useState('');

  const filtered = routines.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.students.join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="routine-list card">
      <h2>Routines ({routines.length})</h2>
      <input
        className="search-input"
        placeholder="Search routines or students…"
        value={search}
        onChange={e => setSearch(e.target.value)}
      />
      {filtered.length === 0 && <p className="empty">No routines yet. Add one above or import a file.</p>}
      <ul>
        {filtered.map(r => (
          <li key={r.id} className="routine-item">
            <div className="routine-meta">
              <strong>{r.title}</strong>
              <span className="tags">
                {r.style && <span className="tag tag-style">{r.style}</span>}
                {r.level && <span className="tag tag-level">{r.level}</span>}
                {r.act && <span className="tag tag-act">Act {r.act}</span>}
                {r.position && <span className="tag tag-position">{POSITIONS[r.position]}</span>}
              </span>
            </div>
            {r.students.length > 0 && (
              <div className="routine-students">
                {r.students.map(s => <span key={s} className="student-chip">{s}</span>)}
              </div>
            )}
            <div className="routine-actions">
              <button className="btn-sm btn-edit" onClick={() => onEdit(r)}>Edit</button>
              <button className="btn-sm btn-delete" onClick={() => onDelete(r.id)}>Remove</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
