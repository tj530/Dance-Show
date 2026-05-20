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
import { detectConflicts, detectSmallGroupAdjacency, detectIdenticalCastGroups } from '../utils/generator';

// Human-readable labels for the special locked positions
const POSITION_LABELS = {
  opening: 'Opening',
  finale: 'Finale',
  'first-half-closer': 'Act 1 Closer',
  'second-half-opener': 'Act 2 Opener',
};

// Six-dot SVG drag handle — more reliable than Unicode braille across fonts
function DragHandle(props) {
  return (
    <span className="drag-handle" {...props}>
      <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
        <circle cx="3" cy="3" r="1.5"/><circle cx="7" cy="3" r="1.5"/>
        <circle cx="3" cy="8" r="1.5"/><circle cx="7" cy="8" r="1.5"/>
        <circle cx="3" cy="13" r="1.5"/><circle cx="7" cy="13" r="1.5"/>
      </svg>
    </span>
  );
}

/**
 * A single draggable row in the lineup.
 * Handles both routine entries and intermission entries.
 * Shows conflict badges and lock buttons for routine entries.
 */
function SortableEntry({
  entry, routine, conflict, sizeConflict, sameCast,
  onRemove, onEditIntermission,
  onEditRoutine, onLockPosition,
}) {
  // dnd-kit hook — provides drag transform, listeners, and ref for the DOM node
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: entry.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.45 : 1, // fade while dragging so you can see the drop target
  };

  // Intermission rows are simpler — just a label and a rename/delete button
  if (entry.type === 'intermission') {
    return (
      <li ref={setNodeRef} style={style} className="lineup-entry intermission">
        <DragHandle {...attributes} {...listeners} />
        <div className="entry-content">
          <span className="intermission-label">{entry.label}</span>
          <button className="btn-sm btn-edit" onClick={() => onEditIntermission(entry)}>Rename</button>
        </div>
        <button className="btn-sm btn-delete" aria-label="Remove" onClick={() => onRemove(entry.id)}>×</button>
      </li>
    );
  }

  // If the routine was deleted but the lineup entry still exists, skip rendering
  if (!routine) return null;

  const isOpening = routine.position === 'opening';
  const isFinale  = routine.position === 'finale';

  return (
    // Dancer conflict takes visual priority over size conflict, then same-cast highlight
    <li ref={setNodeRef} style={style} className={`lineup-entry${conflict ? ' conflict' : sizeConflict ? ' size-conflict' : sameCast ? ' same-cast' : ''}`}>
      <DragHandle {...attributes} {...listeners} />
      <div className="entry-content">
        <div className="entry-title">
          <strong>{routine.title}</strong>
          {routine.position && (
            <span className="tag tag-position">{POSITION_LABELS[routine.position]}</span>
          )}
          {/* Conflict badges — dancer conflict takes priority */}
          {conflict                       && <span className="conflict-badge">Dancer conflict</span>}
          {sizeConflict && !conflict      && <span className="size-conflict-badge">Adjacent small group</span>}
          {sameCast     && !conflict      && <span className="same-cast-badge">Same group</span>}
        </div>
        <div className="entry-details">
          {routine.style && <span className="tag tag-style">{routine.style}</span>}
          {routine.level && <span className="tag tag-level">{routine.level}</span>}
          {routine.act   && <span className="tag tag-act">Act {routine.act}</span>}
        </div>
        {routine.students.length > 0 && (
          <div className="entry-students">
            {routine.students.map(s => (
              <span key={s} className={`student-chip${conflict ? ' conflict' : ''}`}>{s}</span>
            ))}
          </div>
        )}
        {/* Lock buttons — toggle the routine into the opening or finale slot */}
        <div className="entry-lock-row">
          <button
            className={`btn-lock${isOpening ? ' active' : ''}`}
            title={isOpening ? 'Remove opening lock' : 'Lock as opening number'}
            onClick={() => onLockPosition(routine.id, isOpening ? null : 'opening')}
          >
            Opening
          </button>
          <button
            className={`btn-lock${isFinale ? ' active' : ''}`}
            title={isFinale ? 'Remove finale lock' : 'Lock as finale number'}
            onClick={() => onLockPosition(routine.id, isFinale ? null : 'finale')}
          >
            Finale
          </button>
        </div>
      </div>
      <div className="entry-actions">
        <button className="btn-sm btn-edit" onClick={() => onEditRoutine(routine)}>Edit</button>
        <button className="btn-sm btn-delete" aria-label="Remove" onClick={() => onRemove(entry.id)}>×</button>
      </div>
    </li>
  );
}

/**
 * The full draggable lineup view.
 * Splits the lineup into act sections around any intermission entries,
 * detects conflicts, and renders each entry as a SortableEntry.
 */
export default function LineupView({
  lineup,
  routines,
  settings,
  onLineupChange,
  onAddIntermission,
  onRemoveEntry,
  onRenameIntermission,
  onEditRoutine,
  onLockPosition,
  liveOptimize,
}) {
  // PointerSensor works for both mouse and touch
  const sensors = useSensors(useSensor(PointerSensor));

  // Build a lookup map so we can find the full routine object for each lineup entry
  const routineMap = Object.fromEntries(routines.map(r => [r.id, r]));

  // Split the lineup into per-act groups at each intermission.
  // Conflict detection runs independently per act — a dancer can appear in the
  // last routine of Act 1 AND the first routine of Act 2 without it being a conflict,
  // because the intermission is a real break between them.
  const actGroups = [];
  let currentGroup = [];
  for (const entry of lineup) {
    if (entry.type === 'intermission') {
      actGroups.push(currentGroup);
      currentGroup = [];
    } else {
      const r = routineMap[entry.routineId];
      if (r) currentGroup.push(r);
    }
  }
  actGroups.push(currentGroup);

  const conflictIds   = new Set();
  const smallGroupIds = new Set();
  for (const group of actGroups) {
    detectConflicts(group, settings.conflictBuffer).forEach(id => conflictIds.add(id));
    detectSmallGroupAdjacency(group).forEach(id => smallGroupIds.add(id));
  }

  // Identical-cast detection runs across the whole show (not per-act) —
  // a group performing in both acts should still be highlighted
  const allRoutines  = lineup.filter(e => e.type === 'routine').map(e => routineMap[e.routineId]).filter(Boolean);
  const sameCastIds  = detectIdenticalCastGroups(allRoutines);

  // Reorder the lineup array when a drag completes
  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = lineup.findIndex(e => e.id === active.id);
    const newIndex = lineup.findIndex(e => e.id === over.id);
    onLineupChange(arrayMove(lineup, oldIndex, newIndex));
  }

  // Use window.prompt for intermission renaming — simple, no extra modal needed
  function handleRenameIntermission(entry) {
    const newLabel = window.prompt('Rename intermission:', entry.label);
    if (newLabel && newLabel.trim()) onRenameIntermission(entry.id, newLabel.trim());
  }

  // Split the flat lineup array into act groups, separated at intermission entries
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
  if (currentAct.length > 0) acts.push({ actNum, entries: currentAct });

  const routineCount      = lineup.filter(e => e.type === 'routine').length;
  const conflictCount     = conflictIds.size;
  // Only count size conflicts that aren't also dancer conflicts (avoid double-counting in the header)
  const sizeConflictCount = [...smallGroupIds].filter(id => !conflictIds.has(id)).length;

  return (
    <div className="lineup-view card">
      <div className="lineup-header">
        <div className="lineup-header-left">
          <h2>{settings.showName}</h2>
          <span className="lineup-subtitle">
            {routineCount === 0 ? 'No routines yet' : `${routineCount} routine${routineCount !== 1 ? 's' : ''}`}
          </span>
        </div>
        <div className="lineup-stats">
          {conflictCount > 0 && (
            <span className="conflict-summary">
              {conflictCount} dancer conflict{conflictCount > 1 ? 's' : ''}
            </span>
          )}
          {sizeConflictCount > 0 && (
            <span className="size-conflict-summary" title="Adjacent solos, duos or trios">
              {sizeConflictCount} size clash{sizeConflictCount > 1 ? 'es' : ''}
            </span>
          )}
          {conflictCount === 0 && sizeConflictCount === 0 && routineCount > 0 && (
            <span className="no-conflict-summary">No conflicts</span>
          )}
          {liveOptimize && (
            <span className="live-badge">
              Auto-optimize on
              <span className="live-pulse" />
            </span>
          )}
        </div>
      </div>

      {lineup.length === 0 ? (
        <div className="lineup-empty">
          <p className="empty-heading">Your lineup is empty</p>
          <p className="empty-sub">Click <strong>Optimize Lineup</strong> to auto-generate, or use <strong>Add Routine</strong> to build manually.</p>
        </div>
      ) : (
        <>
          <div className="lineup-actions">
            <button className="btn-secondary btn-sm-action" onClick={onAddIntermission}>
              Add Intermission
            </button>
          </div>

          {/* DndContext wraps everything that participates in drag-and-drop */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={lineup.map(e => e.id)} strategy={verticalListSortingStrategy}>
              <div className="act-sections">
                {acts.map((act, i) => {
                  // Intermission acts render as a single entry in their own list
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
                            onEditRoutine={onEditRoutine}
                            onLockPosition={onLockPosition}
                          />
                        ))}
                      </ul>
                    );
                  }
                  return (
                    <div key={`act-${i}`} className="act-section">
                      {/* Only show act headings in a two-act show */}
                      {settings.numActs > 1 && (
                        <h3 className="act-heading">Act {act.actNum}</h3>
                      )}
                      <ul className="lineup-list">
                        {act.entries.map(entry => {
                          const routine      = routineMap[entry.routineId];
                          const conflict     = routine ? conflictIds.has(routine.id)   : false;
                          const sizeConflict = routine ? smallGroupIds.has(routine.id) : false;
                          const sameCast     = routine ? sameCastIds.has(routine.id)   : false;
                          return (
                            <SortableEntry
                              key={entry.id}
                              entry={entry}
                              routine={routine}
                              conflict={conflict}
                              sizeConflict={sizeConflict}
                              sameCast={sameCast}
                              onRemove={onRemoveEntry}
                              onEditIntermission={handleRenameIntermission}
                              onEditRoutine={onEditRoutine}
                              onLockPosition={onLockPosition}
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
        </>
      )}
    </div>
  );
}
