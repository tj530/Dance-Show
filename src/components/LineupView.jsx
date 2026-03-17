import React from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { detectConflicts } from '../utils/generator';

const POSITION_LABELS = {
  opening: '★ Opening',
  finale: '★ Finale',
  'first-half-closer': '★ Act 1 Closer',
  'second-half-opener': '★ Act 2 Opener',
};

function SortableEntry({ entry, routine, conflict, onRemove, onEditIntermission }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  if (entry.type === 'intermission') {
    return (
      <li ref={setNodeRef} style={style} className="lineup-entry intermission">
        <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
        <div className="entry-content">
          <span className="intermission-label">— {entry.label} —</span>
          <button className="btn-sm btn-edit" onClick={() => onEditIntermission(entry)}>Rename</button>
        </div>
        <button className="btn-sm btn-delete" onClick={() => onRemove(entry.id)}>✕</button>
      </li>
    );
  }

  if (!routine) return null;

  return (
    <li ref={setNodeRef} style={style} className={`lineup-entry ${conflict ? 'conflict' : ''}`}>
      <span className="drag-handle" {...attributes} {...listeners}>⠿</span>
      <div className="entry-content">
        <div className="entry-title">
          <strong>{routine.title}</strong>
          {routine.position && (
            <span className="tag tag-position">{POSITION_LABELS[routine.position]}</span>
          )}
          {conflict && <span className="conflict-badge">⚠ Conflict</span>}
        </div>
        <div className="entry-details">
          {routine.style && <span className="tag tag-style">{routine.style}</span>}
          {routine.level && <span className="tag tag-level">{routine.level}</span>}
          {routine.act && <span className="tag tag-act">Act {routine.act}</span>}
        </div>
        {routine.students.length > 0 && (
          <div className="entry-students">
            {routine.students.map(s => (
              <span key={s} className={`student-chip ${conflict ? 'conflict' : ''}`}>{s}</span>
            ))}
          </div>
        )}
      </div>
      <button className="btn-sm btn-delete" onClick={() => onRemove(entry.id)}>✕</button>
    </li>
  );
}

export default function LineupView({
  lineup,
  routines,
  settings,
  onLineupChange,
  onAddIntermission,
  onRemoveEntry,
  onRenameIntermission,
}) {
  const sensors = useSensors(useSensor(PointerSensor));

  const routineMap = Object.fromEntries(routines.map(r => [r.id, r]));

  // Build ordered routines list for conflict detection (skip intermissions)
  const orderedRoutines = lineup
    .filter(e => e.type === 'routine')
    .map(e => routineMap[e.routineId])
    .filter(Boolean);

  const conflictIds = detectConflicts(orderedRoutines, settings.conflictBuffer);

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lineup.findIndex(e => e.id === active.id);
    const newIndex = lineup.findIndex(e => e.id === over.id);
    onLineupChange(arrayMove(lineup, oldIndex, newIndex));
  }

  function handleRenameIntermission(entry) {
    const newLabel = window.prompt('Rename intermission:', entry.label);
    if (newLabel && newLabel.trim()) onRenameIntermission(entry.id, newLabel.trim());
  }

  // Split into acts for display
  const acts = [];
  let currentAct = [];
  let actNum = 1;

  for (const entry of lineup) {
    if (entry.type === 'intermission') {
      acts.push({ actNum, entries: currentAct });
      acts.push({ actNum: 'intermission', entries: [entry] });
      currentAct = [];
      actNum++;
    } else {
      currentAct.push(entry);
    }
  }
  if (currentAct.length > 0) {
    acts.push({ actNum, entries: currentAct });
  }

  const conflictCount = conflictIds.size;

  return (
    <div className="lineup-view card">
      <div className="lineup-header">
        <h2>{settings.showName} — Lineup</h2>
        <div className="lineup-stats">
          <span>{lineup.filter(e => e.type === 'routine').length} routines</span>
          {conflictCount > 0 && (
            <span className="conflict-summary">
              ⚠ {conflictCount} conflict{conflictCount > 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      <div className="lineup-actions">
        <button className="btn-secondary" onClick={onAddIntermission}>
          + Add Intermission
        </button>
      </div>

      {lineup.length === 0 && (
        <p className="empty">No lineup yet. Add routines and click "Generate Lineup".</p>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
        <SortableContext items={lineup.map(e => e.id)} strategy={verticalListSortingStrategy}>
          <div className="act-sections">
            {acts.map((act, i) => {
              if (act.actNum === 'intermission') {
                return (
                  <ul key={`intermission-${i}`} className="lineup-list">
                    {act.entries.map(entry => (
                      <SortableEntry
                        key={entry.id}
                        entry={entry}
                        routine={null}
                        conflict={false}
                        onRemove={onRemoveEntry}
                        onEditIntermission={handleRenameIntermission}
                      />
                    ))}
                  </ul>
                );
              }
              return (
                <div key={`act-${i}`} className="act-section">
                  {settings.numActs > 1 && (
                    <h3 className="act-heading">Act {act.actNum}</h3>
                  )}
                  <ul className="lineup-list">
                    {act.entries.map((entry, idx) => {
                      const routine = routineMap[entry.routineId];
                      const conflict = routine ? conflictIds.has(routine.id) : false;
                      return (
                        <SortableEntry
                          key={entry.id}
                          entry={entry}
                          routine={routine}
                          conflict={conflict}
                          onRemove={onRemoveEntry}
                          onEditIntermission={handleRenameIntermission}
                        />
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
