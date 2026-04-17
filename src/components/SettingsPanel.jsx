import React from 'react';

export default function SettingsPanel({ settings, onChange }) {
  const { conflictBuffer, numActs, showName } = settings;

  return (
    <div className="settings-panel card">
      <h2>Show Settings</h2>

      <div className="field-row">
        <label>Show name</label>
        <input
          type="text"
          value={showName}
          onChange={e => onChange({ ...settings, showName: e.target.value })}
          placeholder="e.g. Annual Dance Showcase"
        />
      </div>

      <div className="field-row">
        <label>Number of acts</label>
        <div className="btn-group">
          {[1, 2].map(n => (
            <button
              key={n}
              className={numActs === n ? 'active' : ''}
              onClick={() => onChange({ ...settings, numActs: n })}
            >
              {n} {n === 1 ? 'Act' : 'Acts'}
            </button>
          ))}
        </div>
      </div>

      <div className="field-row">
        <label>
          Conflict buffer
          <span className="field-hint">routines between same dancer</span>
        </label>
        <div className="btn-group">
          {[1, 2, 3].map(n => (
            <button
              key={n}
              className={conflictBuffer === n ? 'active' : ''}
              onClick={() => onChange({ ...settings, conflictBuffer: n })}
            >
              {n}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
