import React, { useState, useEffect, useRef } from 'react';
import SettingsPanel from './components/SettingsPanel';
import RoutineForm from './components/RoutineForm';
import RoutineList from './components/RoutineList';
import LineupView from './components/LineupView';
import ImportPanel from './components/ImportPanel';
import EditRoutineModal from './components/EditRoutineModal';
import AddRoutineModal from './components/AddRoutineModal';
import { generateLineup } from './utils/generator';
import {
  loadRoutines, saveRoutines,
  loadLineup, saveLineup,
  loadSettings, saveSettings,
} from './utils/storage';
import './App.css';

export default function App() {
  const [routines, setRoutines] = useState(() => loadRoutines());
  const [lineup, setLineup] = useState(() => loadLineup());
  const [settings, setSettings] = useState(() => loadSettings());
  const [editingRoutine, setEditingRoutine] = useState(null);
  const [showAddToLineup, setShowAddToLineup] = useState(false);
  const [activeTab, setActiveTab] = useState('routines');
  const [toast, setToast] = useState('');
  const [liveOptimize, setLiveOptimize] = useState(false);
  const liveOptimizeRef = useRef(liveOptimize);
  const debounceRef = useRef(null);

  useEffect(() => { saveRoutines(routines); }, [routines]);
  useEffect(() => { saveLineup(lineup); }, [lineup]);
  useEffect(() => { saveSettings(settings); }, [settings]);

  // Keep ref in sync so the debounce callback sees the latest value
  useEffect(() => { liveOptimizeRef.current = liveOptimize; }, [liveOptimize]);

  // ── Live optimize effect ──────────────────────────────────────
  useEffect(() => {
    if (!liveOptimize || routines.length === 0) return;

    // Debounce: wait 600 ms after the last change before re-optimizing
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      if (!liveOptimizeRef.current) return;
      setLineup(generateLineup(routines, settings));
    }, 600);

    return () => clearTimeout(debounceRef.current);
  }, [routines, settings, liveOptimize]); // eslint-disable-line react-hooks/exhaustive-deps

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  }

  // ── Routines ──────────────────────────────────────────────────
  function addRoutine(r) {
    setRoutines(prev => [...prev, r]);
    showToast(`Added "${r.title}"`);
  }

  function deleteRoutine(id) {
    setRoutines(prev => prev.filter(r => r.id !== id));
    setLineup(prev => prev.filter(e => e.routineId !== id));
    showToast('Routine removed');
  }

  function saveEditedRoutine(updated) {
    setRoutines(prev => prev.map(r => r.id === updated.id ? updated : r));
    // Sync label in lineup
    setLineup(prev => prev.map(e =>
      e.routineId === updated.id ? { ...e, label: updated.title } : e
    ));
    setEditingRoutine(null);
    showToast('Routine updated');
  }

  function handleImport(imported, mode) {
    if (mode === 'replace') {
      setRoutines(imported);
      setLineup([]);
    } else {
      setRoutines(prev => [...prev, ...imported]);
    }
    showToast(`Imported ${imported.length} routine(s)`);
  }

  // ── Lock position from lineup ─────────────────────────────────
  function handleLockPosition(routineId, position) {
    setRoutines(prev => prev.map(r => {
      if (r.id !== routineId) return r;
      // If locking opening/finale, clear those from any other routine first
      return { ...r, position: position || null };
    }));
    // If locking opening/finale, unset those from other routines
    if (position === 'opening' || position === 'finale') {
      setRoutines(prev => prev.map(r => {
        if (r.id === routineId) return { ...r, position };
        if (r.position === position) return { ...r, position: null };
        return r;
      }));
    }
    showToast(position ? `Locked as ${position}` : 'Position unlocked');
  }

  // ── Add to lineup from lineup tab ─────────────────────────────
  function handleAddToLineup(routine, isNew) {
    // Add routine to master list if brand new
    if (isNew) {
      setRoutines(prev => [...prev, routine]);
    }
    // Append to lineup
    const entry = {
      id: `entry-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: 'routine',
      routineId: routine.id,
      label: routine.title,
      act: routine.act || 1,
    };
    setLineup(prev => [...prev, entry]);
    setShowAddToLineup(false);
    showToast(`Added "${routine.title}" to lineup`);
  }

  // ── Live optimize toggle ──────────────────────────────────────
  function toggleLiveOptimize() {
    setLiveOptimize(prev => {
      const next = !prev;
      if (next && routines.length > 0) {
        // Immediately optimize on enable
        setLineup(generateLineup(routines, settings));
        showToast('Live optimize ON — lineup will auto-update');
        setActiveTab('lineup');
      } else {
        showToast('Live optimize OFF — drag to arrange manually');
      }
      return next;
    });
  }

  // ── Lineup ────────────────────────────────────────────────────
  function handleGenerate() {
    if (routines.length === 0) {
      showToast('Add some routines first!');
      return;
    }
    const newLineup = generateLineup(routines, settings);
    setLineup(newLineup);
    setActiveTab('lineup');
    showToast('Lineup optimized!');
  }

  function addIntermission() {
    const entry = {
      id: `entry-${Date.now()}`,
      type: 'intermission',
      routineId: null,
      label: 'Intermission',
      act: 1,
    };
    setLineup(prev => [...prev, entry]);
  }

  function removeEntry(id) {
    setLineup(prev => prev.filter(e => e.id !== id));
  }

  function renameIntermission(id, label) {
    setLineup(prev => prev.map(e => e.id === id ? { ...e, label } : e));
  }

  function clearLineup() {
    if (window.confirm('Clear the entire lineup?')) {
      setLineup([]);
      showToast('Lineup cleared');
    }
  }

  function exportLineup() {
    const routineMap = Object.fromEntries(routines.map(r => [r.id, r]));
    const rows = lineup.map((entry, i) => {
      if (entry.type === 'intermission') {
        return {
          order: i + 1, type: 'intermission', title: entry.label,
          students: '', act: '', position: '', style: '', level: '',
        };
      }
      const r = routineMap[entry.routineId] || {};
      return {
        order: i + 1, type: 'routine',
        title: r.title || '',
        students: (r.students || []).join('; '),
        act: r.act || '',
        position: r.position || '',
        style: r.style || '',
        level: r.level || '',
      };
    });

    const headers = ['order', 'type', 'title', 'students', 'act', 'position', 'style', 'level'];
    const csv = [
      headers.join(','),
      ...rows.map(row => headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${settings.showName.replace(/\s+/g, '_')}_lineup.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Lineup exported!');
  }

  // Routines currently in lineup (for AddRoutineModal filtering)
  const lineupRoutineIds = new Set(lineup.map(e => e.routineId).filter(Boolean));

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <span className="logo">💃</span>
          <h1>{settings.showName}</h1>
        </div>
        <nav className="tabs">
          {['routines', 'lineup', 'import'].map(tab => (
            <button
              key={tab}
              className={activeTab === tab ? 'active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
              {tab === 'routines' && routines.length > 0 && (
                <span className="badge">{routines.length}</span>
              )}
              {tab === 'lineup' && lineup.length > 0 && (
                <span className="badge">{lineup.filter(e => e.type === 'routine').length}</span>
              )}
            </button>
          ))}
        </nav>
        <button
          className={`btn-live-optimize ${liveOptimize ? 'active' : ''}`}
          onClick={toggleLiveOptimize}
          title={liveOptimize ? 'Live optimize is ON — click to disable' : 'Enable live optimize'}
        >
          {liveOptimize ? '⟳ Live' : '⟳ Live Optimize'}
          {liveOptimize && <span className="live-pulse" />}
        </button>
        <button className="btn-generate" onClick={handleGenerate}>
          ⚡ Optimize Now
        </button>
      </header>

      {toast && <div className="toast">{toast}</div>}

      <main className="app-body">
        {activeTab === 'routines' && (
          <div className="two-col">
            <div className="col-left">
              <SettingsPanel settings={settings} onChange={setSettings} />
              <RoutineForm onAdd={addRoutine} numActs={settings.numActs} />
            </div>
            <div className="col-right">
              <RoutineList
                routines={routines}
                onDelete={deleteRoutine}
                onEdit={setEditingRoutine}
              />
            </div>
          </div>
        )}

        {activeTab === 'lineup' && (
          <div className="lineup-page">
            <div className="lineup-toolbar">
              <button className="btn-primary btn-add-routine" onClick={() => setShowAddToLineup(true)}>
                + Add Routine
              </button>
              <button className="btn-secondary" onClick={clearLineup}>Clear Lineup</button>
              {lineup.length > 0 && (
                <button className="btn-secondary" onClick={exportLineup}>Export CSV</button>
              )}
            </div>
            <LineupView
              lineup={lineup}
              routines={routines}
              settings={settings}
              onLineupChange={setLineup}
              onAddIntermission={addIntermission}
              onRemoveEntry={removeEntry}
              onRenameIntermission={renameIntermission}
              onEditRoutine={setEditingRoutine}
              onLockPosition={handleLockPosition}
              liveOptimize={liveOptimize}
            />
          </div>
        )}

        {activeTab === 'import' && (
          <div className="import-page">
            <ImportPanel onImport={handleImport} />
          </div>
        )}
      </main>

      {editingRoutine && (
        <EditRoutineModal
          routine={editingRoutine}
          numActs={settings.numActs}
          onSave={saveEditedRoutine}
          onClose={() => setEditingRoutine(null)}
        />
      )}

      {showAddToLineup && (
        <AddRoutineModal
          routines={routines}
          lineupRoutineIds={lineupRoutineIds}
          numActs={settings.numActs}
          onAdd={handleAddToLineup}
          onClose={() => setShowAddToLineup(false)}
        />
      )}
    </div>
  );
}
