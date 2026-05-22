import React, { useState, useEffect, useRef } from 'react';
import SettingsPanel from './components/SettingsPanel';
import RoutineForm from './components/RoutineForm';
import RoutineList from './components/RoutineList';
import LineupView from './components/LineupView';
import ImportPanel from './components/ImportPanel';
import EditRoutineModal from './components/EditRoutineModal';
import AddRoutineModal from './components/AddRoutineModal';
import VisualizationPanel from './components/VisualizationPanel';
import { generateLineup } from './utils/generator';
import {
  loadRoutines, saveRoutines,
  loadLineup, saveLineup,
  loadSettings, saveSettings,
  defaultSettings,
} from './utils/storage';
import './App.css';

export default function App() {
  // Core data — persisted to localStorage via the save effects below
  const [routines, setRoutines]         = useState(() => loadRoutines());
  const [lineup, setLineup]             = useState(() => loadLineup());
  const [settings, setSettings]         = useState(() => loadSettings());

  // Score log from the last optimizer run — fed into the Analytics charts
  const [scoreLog, setScoreLog]         = useState([]);

  // UI state
  const [editingRoutine, setEditingRoutine] = useState(null);  // routine open in the edit modal
  const [showAddToLineup, setShowAddToLineup] = useState(false);
  const [activeTab, setActiveTab]       = useState('routines');
  const [toast, setToast]               = useState('');

  // Live optimize — re-runs the optimizer automatically whenever routines or settings change
  const [liveOptimize, setLiveOptimize] = useState(false);
  const liveOptimizeRef = useRef(liveOptimize); // ref so the debounce timeout can read the latest value
  const debounceRef     = useRef(null);

  // ── Persistence effects ───────────────────────────────────────
  useEffect(() => { saveRoutines(routines); }, [routines]);
  useEffect(() => { saveLineup(lineup); },   [lineup]);
  useEffect(() => { saveSettings(settings); }, [settings]);
  useEffect(() => { liveOptimizeRef.current = liveOptimize; }, [liveOptimize]);

  // ── Live optimize effect ──────────────────────────────────────
  // Debounced so rapid changes (e.g. editing settings) don't fire the optimizer on every keystroke
  useEffect(() => {
    if (!liveOptimize || routines.length === 0) return;
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      // Check the ref, not the state — the state may be stale inside this closure
      if (!liveOptimizeRef.current) return;
      const { lineup: newLineup, scoreLog: log } = generateLineup(routines, settings);
      setLineup(newLineup);
      setScoreLog(log);
    }, 600);
    return () => clearTimeout(debounceRef.current);
  }, [routines, settings, liveOptimize]); // eslint-disable-line react-hooks/exhaustive-deps

  // Show a temporary notification at the bottom of the screen
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
    // Remove the routine and any lineup entries that reference it
    setRoutines(prev => prev.filter(r => r.id !== id));
    setLineup(prev => prev.filter(e => e.routineId !== id));
    showToast('Routine removed');
  }

  function saveEditedRoutine(updated) {
    setRoutines(prev => prev.map(r => r.id === updated.id ? updated : r));
    // Keep the lineup entry's display label in sync with the new title
    setLineup(prev => prev.map(e =>
      e.routineId === updated.id ? { ...e, label: updated.title } : e
    ));
    setEditingRoutine(null);
    showToast('Routine updated');
  }

  function handleImport(imported, mode) {
    if (mode === 'replace') {
      // Replace all clears the existing lineup so stale entries don't remain
      setRoutines(imported);
      setLineup([]);
    } else {
      setRoutines(prev => [...prev, ...imported]);
    }
    showToast(`Imported ${imported.length} routine(s)`);
  }

  // ── Lock position ─────────────────────────────────────────────

  /**
   * Lock a routine to a special position (opening or finale).
   * Only one routine can hold each position — if another routine already holds it,
   * that one's position is cleared first.
   */
  function handleLockPosition(routineId, position) {
    setRoutines(prev => prev.map(r => {
      if (r.id !== routineId) return r;
      return { ...r, position: position || null };
    }));
    if (position === 'opening' || position === 'finale') {
      // Clear the same position from any other routine that currently holds it
      setRoutines(prev => prev.map(r => {
        if (r.id === routineId) return { ...r, position };
        if (r.position === position) return { ...r, position: null };
        return r;
      }));
    }
    showToast(position ? `Locked as ${position}` : 'Position unlocked');
  }

  // ── Add to lineup ─────────────────────────────────────────────

  function handleAddToLineup(routine, isNew) {
    // If creating a brand-new routine, add it to the routines list too
    if (isNew) setRoutines(prev => [...prev, routine]);
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
        // Run immediately on enable, then the useEffect takes over for future changes
        const { lineup: newLineup, scoreLog: log } = generateLineup(routines, settings);
        setLineup(newLineup);
        setScoreLog(log);
        showToast('Live optimize ON — lineup will auto-update');
        setActiveTab('lineup');
      } else {
        showToast('Live optimize OFF — drag to arrange manually');
      }
      return next;
    });
  }

  // ── Manual optimize ───────────────────────────────────────────

  function handleGenerate() {
    if (routines.length === 0) { showToast('Add some routines first!'); return; }
    const { lineup: newLineup, scoreLog: log } = generateLineup(routines, settings);
    setLineup(newLineup);
    setScoreLog(log);
    setActiveTab('lineup');
    showToast('Lineup optimized!');
  }

  // ── Lineup helpers ────────────────────────────────────────────

  function addIntermission() {
    setLineup(prev => [...prev, {
      id: `entry-${Date.now()}`,
      type: 'intermission',
      routineId: null,
      label: 'Intermission',
      act: 1,
    }]);
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

  /**
   * Export the current lineup as a CSV file and trigger a browser download.
   * Includes both routine entries and intermissions, in display order.
   */
  function exportLineup() {
    const routineMap = Object.fromEntries(routines.map(r => [r.id, r]));
    const headers = ['order', 'type', 'title', 'students', 'act', 'position', 'style', 'level'];
    const rows = lineup.map((entry, i) => {
      if (entry.type === 'intermission') {
        return { order: i + 1, type: 'intermission', title: entry.label, students: '', act: '', position: '', style: '', level: '' };
      }
      const r = routineMap[entry.routineId] || {};
      return {
        order: i + 1, type: 'routine',
        title: r.title || '',
        students: (r.students || []).join('; '),
        act: r.act || '', position: r.position || '',
        style: r.style || '', level: r.level || '',
      };
    });
    const csv = [headers.join(','), ...rows.map(row =>
      headers.map(h => `"${String(row[h]).replace(/"/g, '""')}"`).join(',')
    )].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${settings.showName.replace(/\s+/g, '_')}_lineup.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Lineup exported!');
  }

  /**
   * Export a dancer report — one row per dancer showing every routine they appear in,
   * listed in lineup order with their slot number.
   * Format: Dancer | Number of routines | Slot 1 title | Slot 2 title | …
   */
  function exportDancers() {
    const routineMap = Object.fromEntries(routines.map(r => [r.id, r]));

    // Walk the lineup in order, collecting slot number + title for each dancer
    const dancerMap = new Map(); // name → [{ slot, title }]
    let slot = 1;
    for (const entry of lineup) {
      if (entry.type === 'intermission') continue;
      const r = routineMap[entry.routineId];
      if (!r) continue;
      for (const dancer of r.students) {
        if (!dancerMap.has(dancer)) dancerMap.set(dancer, []);
        dancerMap.get(dancer).push({ slot, title: r.title });
      }
      slot++;
    }

    // Sort dancers alphabetically
    const sorted = [...dancerMap.entries()].sort((a, b) => a[0].localeCompare(b[0]));

    // Find the maximum number of routines any dancer has (to set column count)
    const maxRoutines = sorted.reduce((m, [, entries]) => Math.max(m, entries.length), 0);

    const headers = [
      'Dancer',
      'Number of Routines',
      ...Array.from({ length: maxRoutines }, (_, i) => `Routine ${i + 1}`),
    ];

    const rows = sorted.map(([name, entries]) => [
      name,
      entries.length,
      ...entries.map(e => `#${e.slot} ${e.title}`),
    ]);

    const escape = v => `"${String(v).replace(/"/g, '""')}"`;
    const csv = [
      headers.map(escape).join(','),
      ...rows.map(row => row.map(escape).join(',')),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${settings.showName.replace(/\s+/g, '_')}_dancers.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Dancer list exported!');
  }

  const lineupRoutineIds = new Set(lineup.map(e => e.routineId).filter(Boolean));
  const ALL_TABS = ['routines', 'lineup', 'analytics', 'import', 'reset'];
  const TAB_LABELS = { routines: 'Routines', lineup: 'Lineup', analytics: 'Analytics', import: 'Import', reset: 'Reset' };

  return (
    <div className="app">
      <header className="app-header">
        <div className="header-left">
          <div className="logo-mark">DS</div>
          <h1>{settings.showName}</h1>
        </div>
        <nav className="tabs">
          {ALL_TABS.map(tab => (
            <button key={tab} className={activeTab === tab ? 'active' : ''} onClick={() => setActiveTab(tab)}>
              {TAB_LABELS[tab]}
              {tab === 'routines' && routines.length > 0 && <span className="badge">{routines.length}</span>}
              {tab === 'lineup'   && lineup.length   > 0 && <span className="badge">{lineup.filter(e => e.type === 'routine').length}</span>}
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button
            className={`btn-live-optimize ${liveOptimize ? 'active' : ''}`}
            onClick={toggleLiveOptimize}
            title={liveOptimize ? 'Auto-optimize is on — click to turn off' : 'Turn on auto-optimize'}>
            {liveOptimize ? 'Auto: On' : 'Auto-Optimize'}
            {liveOptimize && <span className="live-pulse" />}
          </button>
          <button className="btn-generate" onClick={handleGenerate}>Optimize Lineup</button>
        </div>
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
              <RoutineList routines={routines} onDelete={deleteRoutine} onEdit={setEditingRoutine} />
            </div>
          </div>
        )}

        {activeTab === 'lineup' && (
          <div className="lineup-page">
            <div className="lineup-toolbar">
              <button className="btn-primary btn-add-routine" onClick={() => setShowAddToLineup(true)}>Add Routine</button>
              <button className="btn-secondary" onClick={clearLineup}>Clear</button>
              {lineup.length > 0 && <button className="btn-secondary" onClick={exportLineup}>Export Lineup</button>}
              {lineup.length > 0 && <button className="btn-secondary" onClick={exportDancers}>Export Dancers</button>}
            </div>
            <LineupView
              lineup={lineup} routines={routines} settings={settings}
              onLineupChange={setLineup} onAddIntermission={addIntermission}
              onRemoveEntry={removeEntry} onRenameIntermission={renameIntermission}
              onEditRoutine={setEditingRoutine} onLockPosition={handleLockPosition}
              liveOptimize={liveOptimize}
            />
          </div>
        )}

        {activeTab === 'analytics' && (
          <VisualizationPanel
            lineup={lineup} routines={routines}
            settings={settings} scoreLog={scoreLog}
          />
        )}

        {activeTab === 'import' && (
          <div className="import-page">
            <ImportPanel onImport={handleImport} />
          </div>
        )}

        {activeTab === 'reset' && (
          <div className="reset-page">
            <div className="reset-card card">
              <h2>Reset Data</h2>
              <p className="reset-desc">Remove data from the app. These actions cannot be undone.</p>

              <div className="reset-actions">
                <div className="reset-row">
                  <div className="reset-row-info">
                    <strong>Clear lineup</strong>
                    <span>Removes all entries from the lineup. Routines are kept.</span>
                  </div>
                  <button className="btn-danger" onClick={() => {
                    if (window.confirm('Clear the lineup? Routines will not be deleted.')) {
                      setLineup([]); showToast('Lineup cleared');
                    }
                  }}>Clear Lineup</button>
                </div>

                <div className="reset-row">
                  <div className="reset-row-info">
                    <strong>Remove all routines</strong>
                    <span>Deletes every routine and clears the lineup.</span>
                  </div>
                  <button className="btn-danger" onClick={() => {
                    if (window.confirm('Delete all routines and clear the lineup?')) {
                      setRoutines([]); setLineup([]); showToast('All routines removed');
                    }
                  }}>Remove All Routines</button>
                </div>

                <div className="reset-row reset-row-destructive">
                  <div className="reset-row-info">
                    <strong>Reset everything</strong>
                    <span>Deletes all routines, clears the lineup, and resets show settings to defaults.</span>
                  </div>
                  <button className="btn-danger" onClick={() => {
                    if (window.confirm('Reset everything? This will delete all routines, clear the lineup, and restore default settings.')) {
                      setRoutines([]); setLineup([]); setSettings(defaultSettings());
                      showToast('Everything reset');
                    }
                  }}>Reset Everything</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Edit modal — opens when a routine's Edit button is clicked */}
      {editingRoutine && (
        <EditRoutineModal routine={editingRoutine} numActs={settings.numActs}
          onSave={saveEditedRoutine} onClose={() => setEditingRoutine(null)} />
      )}

      {/* Add-to-lineup modal — pick an existing routine or create a new one */}
      {showAddToLineup && (
        <AddRoutineModal routines={routines} lineupRoutineIds={lineupRoutineIds}
          numActs={settings.numActs} onAdd={handleAddToLineup}
          onClose={() => setShowAddToLineup(false)} />
      )}
    </div>
  );
}
