import React, { useRef, useState } from 'react';
import { parseCSV, parseJSON, expandDSPClasses, getSampleCSV } from '../utils/importer';

export default function ImportPanel({ onImport }) {
  const fileRef = useRef();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('add'); // 'add' | 'replace'

  // DSP configure step: null when not active
  const [dspClasses, setDspClasses] = useState(null); // DSPClass[]
  const [dspCounts, setDspCounts] = useState({});     // title → 1|2|3

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('');
    setError('');
    setDspClasses(null);

    try {
      if (file.name.endsWith('.json')) {
        const routines = await parseJSON(file);
        onImport(routines, mode);
        setStatus(`✓ Imported ${routines.length} routine(s)`);
      } else {
        const result = await parseCSV(file);
        if (result.isDSP) {
          // Initialise all counts to 1 and show the configure step
          const initial = {};
          result.classes.forEach(c => { initial[c.title] = 1; });
          setDspClasses(result.classes);
          setDspCounts(initial);
        } else {
          onImport(result.routines, mode);
          setStatus(`✓ Imported ${result.routines.length} routine(s)`);
        }
      }
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }
    e.target.value = '';
  }

  function confirmDSP() {
    const routines = expandDSPClasses(dspClasses, dspCounts);
    onImport(routines, mode);
    const total = routines.length;
    setStatus(`✓ Imported ${total} routine(s) from ${dspClasses.length} class(es)`);
    setDspClasses(null);
    setDspCounts({});
  }

  function cancelDSP() {
    setDspClasses(null);
    setDspCounts({});
  }

  function setCount(title, count) {
    setDspCounts(prev => ({ ...prev, [title]: count }));
  }

  function downloadTemplate() {
    const blob = new Blob([getSampleCSV()], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'dance_routines_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── DSP configure step ──────────────────────────────────────────────────────
  if (dspClasses) {
    return (
      <div className="import-panel card">
        <h2>Configure Routines per Class</h2>
        <p className="hint">
          How many numbers does each class perform in the show?
        </p>

        <div className="dsp-class-list">
          {dspClasses.map(({ title, students }) => (
            <div key={title} className="dsp-class-row">
              <span className="dsp-class-name">{title}</span>
              <span className="dsp-student-count">{students.length} student{students.length !== 1 ? 's' : ''}</span>
              <div className="btn-group">
                {[1, 2, 3].map(n => (
                  <button
                    key={n}
                    className={dspCounts[title] === n ? 'active' : ''}
                    onClick={() => setCount(title, n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="import-actions">
          <button className="btn-primary" onClick={confirmDSP}>
            Confirm Import
          </button>
          <button className="btn-secondary" onClick={cancelDSP}>
            Cancel
          </button>
        </div>
      </div>
    );
  }

  // ── Normal upload step ──────────────────────────────────────────────────────
  return (
    <div className="import-panel card">
      <h2>Import Routines</h2>
      <p className="hint">
        Upload a <strong>CSV</strong> or <strong>JSON</strong> file.
        Supports <strong>Dance Studio Pro</strong> enrollment exports (auto-detected) or
        native format with columns: <code>title</code>, <code>students</code>,{' '}
        <code>act</code> (1/2), <code>position</code>, <code>style</code>, <code>level</code>
      </p>

      <div className="field-row">
        <label>On Import</label>
        <div className="btn-group">
          <button className={mode === 'add' ? 'active' : ''} onClick={() => setMode('add')}>Add to existing</button>
          <button className={mode === 'replace' ? 'active' : ''} onClick={() => setMode('replace')}>Replace all</button>
        </div>
      </div>

      <div className="import-actions">
        <button className="btn-primary" onClick={() => fileRef.current.click()}>
          Choose File…
        </button>
        <button className="btn-secondary" onClick={downloadTemplate}>
          Download Template CSV
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,.json"
          style={{ display: 'none' }}
          onChange={handleFile}
        />
      </div>

      {status && <p className="success">{status}</p>}
      {error && <p className="error">{error}</p>}
    </div>
  );
}
