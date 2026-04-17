import React, { useState } from 'react';

const POSITIONS = {
  opening: 'Opening',
  finale: 'Finale',
  'first-half-closer': 'Act 1 Closer',
  'second-half-opener': 'Act 2 Opener',
};

export default function RoutineList({ routines, onDelete, onEdit }) {
  const [search, setSearch] = useState('');

  const filtered = routines.filter(r =>
    r.title.toLowerCase().includes(search.toLowerCase()) ||
    r.students.join(' ').toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="routine-list card">
      <div className="card-header">
        <h2>Routines</h2>
        {routines.length > 0 && <span className="count-pill">{routines.length}</span>}
      </div>

      {routines.length === 0 ? (
        <div className="list-empty">
          <p className="empty-heading">No routines yet</p>
          <p className="empty-sub">Add a routine using the form on the left, or import from a file.</p>
        </div>
      ) : (
        <>
          <input
            className="search-input"
            placeholder="Search by name or dancer…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {filtered.length === 0 && (
            <p className="empty">No results for "{search}"</p>
          )}
          <ul>
            {filtered.map(r => (
              <li key={r.id} className="routine-item">
                <div className="routine-meta">
                  <strong>{r.title}</strong>
                  <span className="tags">
                    {r.style    && <span className="tag tag-style">{r.style}</span>}
                    {r.level    && <span className="tag tag-level">{r.level}</span>}
                    {r.act      && <span className="tag tag-act">Act {r.act}</span>}
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
        </>
      )}
    </div>
  );
}
