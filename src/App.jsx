import React, { useState, useEffect } from 'react';
import SettingsPanel from './components/SettingsPanel';
import RoutineForm from './components/RoutineForm';
import RoutineList from './components/RoutineList';
import LineupView from './components/LineupView';
import ImportPanel from './components/ImportPanel';
import EditRoutineModal from './components/EditRoutineModal';
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
  const [activeTab, setActiveTab] = useState('routines');
  const [toast, setToast] = useState('');

  useEffect(() => { saveRoutines(routines); }, [routines]);
  useEffect(() => { saveLineup(lineup); }, [lineup]);
  useEffect(() => { saveSettings(settings); }, [settings]);

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

  // ── Lineup ────────────────────────────────────────────────────
  function handleGenerate() {
    if (routines.length === 0) {
      showToast('Add some routines first!');
      return;
    }
    const newLineup = generateLineup(routines, settings);
    setLineup(newLineup);
    setActiveTab('lineup');
    showToast('Lineup generated!');
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
        <button className="btn-generate" onClick={handleGenerate}>
          ⚡ Generate Lineup
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
    </div>
  );
}
