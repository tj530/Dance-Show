import React, { useRef, useState } from 'react';
import { parseCSV, parseJSON, getSampleCSV } from '../utils/importer';

export default function ImportPanel({ onImport }) {
  const fileRef = useRef();
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [mode, setMode] = useState('add'); // 'add' | 'replace'

  async function handleFile(e) {
    const file = e.target.files[0];
    if (!file) return;
    setStatus('');
    setError('');

    try {
      let routines;
      if (file.name.endsWith('.json')) {
        routines = await parseJSON(file);
      } else {
        routines = await parseCSV(file);
      }
      onImport(routines, mode);
      setStatus(`✓ Imported ${routines.length} routine(s)`);
    } catch (err) {
      setError(`Import failed: ${err.message}`);
    }
    e.target.value = '';
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
