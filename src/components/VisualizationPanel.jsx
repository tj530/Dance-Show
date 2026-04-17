import React, { useState, useMemo } from 'react';
import { scoreLineup, detectConflicts } from '../utils/generator';

// ── Palette ──────────────────────────────────────────────────────────────────
const ACCENT   = '#c084fc';
const ACCENT2  = '#818cf8';
const DANGER   = '#f87171';
const SUCCESS  = '#4ade80';
const WARNING  = '#fbbf24';
const SURFACE2 = '#22222f';
const BORDER   = '#2e2e40';
const MUTED    = '#94a3b8';

// ── 1. Score Chart ────────────────────────────────────────────────────────────
function ScoreChart({ scoreLog }) {
  if (!scoreLog || scoreLog.length === 0) {
    return <p className="viz-empty">Run the optimizer to see score history.</p>;
  }

  const W = 720, H = 300, PL = 54, PR = 16, PT = 20, PB = 40;
  const iW = W - PL - PR, iH = H - PT - PB;

  // Filter to non-final entries only (the step-by-step progress)
  const steps = scoreLog.filter(e => !e.isFinal);
  if (steps.length < 2) return <p className="viz-empty">Not enough data yet.</p>;

  const maxScore = Math.max(...steps.map(e => e.score), 1);
  const xStep    = iW / Math.max(steps.length - 1, 1);

  const px = i => PL + i * xStep;
  const py = s => PT + iH - (s / maxScore) * iH;

  // Group by seed for coloring
  const seeds = [...new Set(steps.map(e => e.seed))];
  const seedColors = [ACCENT, ACCENT2, WARNING, SUCCESS, '#fb923c', '#38bdf8', '#e879f9', '#a3e635'];

  const seedGroups = seeds.map((seed, si) => {
    const pts = steps.map((e, i) => ({ ...e, i })).filter(e => e.seed === seed);
    return { seed, pts, color: seedColors[si % seedColors.length] };
  });

  // Best line (minimum across seeds at each global step)
  const minByStep = steps.map((_, i) => steps[i].score);

  const polyline = pts =>
    pts.map(e => `${px(e.i).toFixed(1)},${py(e.score).toFixed(1)}`).join(' ');

  const bestPoly = minByStep.map((s, i) => `${px(i).toFixed(1)},${py(s).toFixed(1)}`).join(' ');

  // Y axis ticks
  const yTicks = 5;

  return (
    <div className="viz-chart-wrap">
      <h3 className="viz-subtitle">Optimization Score Over Steps</h3>
      <p className="viz-desc">Each line is one seed. Score drops as 2-opt swaps improve the arrangement. Lower = fewer conflicts.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg">
        {/* Grid */}
        {Array.from({ length: yTicks + 1 }, (_, i) => {
          const val = (maxScore / yTicks) * i;
          const y   = py(val);
          return (
            <g key={i}>
              <line x1={PL} y1={y} x2={PL + iW} y2={y} stroke={BORDER} strokeWidth="1" />
              <text x={PL - 6} y={y + 4} fill={MUTED} fontSize="10" textAnchor="end">
                {Math.round(val)}
              </text>
            </g>
          );
        })}
        {/* Seed lines */}
        {seedGroups.map(({ seed, pts, color }) => (
          pts.length > 1 && (
            <polyline key={seed} points={polyline(pts)}
              fill="none" stroke={color} strokeWidth="1.5" opacity="0.5" />
          )
        ))}
        {/* Best-so-far bold line */}
        <polyline points={bestPoly} fill="none" stroke={SUCCESS} strokeWidth="2.5" />
        {/* Axes */}
        <line x1={PL} y1={PT} x2={PL} y2={PT + iH} stroke={BORDER} strokeWidth="1" />
        <line x1={PL} y1={PT + iH} x2={PL + iW} y2={PT + iH} stroke={BORDER} strokeWidth="1" />
        {/* Labels */}
        <text x={PL + iW / 2} y={H - 4} fill={MUTED} fontSize="11" textAnchor="middle">Optimization Step</text>
        <text x={12} y={PT + iH / 2} fill={MUTED} fontSize="11" textAnchor="middle"
          transform={`rotate(-90, 12, ${PT + iH / 2})`}>Penalty Score</text>
        {/* Legend */}
        <circle cx={PL + iW - 60} cy={PT + 12} r={4} fill={SUCCESS} />
        <text x={PL + iW - 52} y={PT + 16} fill={SUCCESS} fontSize="10">Best path</text>
      </svg>
    </div>
  );
}

// ── 2. Student Timeline ───────────────────────────────────────────────────────
function StudentTimeline({ lineup, routines, settings }) {
  const routineMap = useMemo(() => Object.fromEntries(routines.map(r => [r.id, r])), [routines]);

  const orderedEntries = lineup.filter(e => e.type === 'routine');
  const orderedRoutines = orderedEntries.map(e => routineMap[e.routineId]).filter(Boolean);

  const conflictIds = useMemo(
    () => detectConflicts(orderedRoutines, settings.conflictBuffer),
    [orderedRoutines, settings.conflictBuffer]
  );

  // Collect all students in lineup order
  const allStudents = useMemo(() => {
    const set = new Set();
    orderedRoutines.forEach(r => r.students.forEach(s => set.add(s)));
    return [...set].sort();
  }, [orderedRoutines]);

  if (allStudents.length === 0 || orderedRoutines.length === 0) {
    return <p className="viz-empty">Generate a lineup to see the student timeline.</p>;
  }

  const CELL = 28, LABEL_W = 140, HEADER_H = 56;
  const W = LABEL_W + orderedRoutines.length * CELL;
  const H = HEADER_H + allStudents.length * CELL;

  // Detect per-student conflicts
  const studentConflictSlots = new Set();
  allStudents.forEach(student => {
    const slots = orderedRoutines.map((r, i) => r.students.includes(student) ? i : -1).filter(i => i >= 0);
    for (let i = 1; i < slots.length; i++) {
      if (slots[i] - slots[i - 1] <= settings.conflictBuffer) {
        studentConflictSlots.add(`${student}-${slots[i]}`);
        studentConflictSlots.add(`${student}-${slots[i - 1]}`);
      }
    }
  });

  return (
    <div className="viz-chart-wrap">
      <h3 className="viz-subtitle">Student Timeline</h3>
      <p className="viz-desc">Each row is a dancer. Purple = performs. Red = conflict within buffer. Numbers = lineup slot.</p>
      <div className="viz-scroll">
        <svg width={W} height={H}>
          {/* Column headers (slot numbers + routine names) */}
          {orderedRoutines.map((r, i) => {
            const x = LABEL_W + i * CELL + CELL / 2;
            const isConflict = conflictIds.has(r.id);
            return (
              <g key={r.id}>
                <text x={x} y={HEADER_H - 36} fill={isConflict ? DANGER : MUTED}
                  fontSize="10" textAnchor="middle" transform={`rotate(-45, ${x}, ${HEADER_H - 36})`}>
                  {r.title.length > 12 ? r.title.slice(0, 11) + '…' : r.title}
                </text>
                <text x={x} y={HEADER_H - 4} fill={MUTED} fontSize="9" textAnchor="middle">
                  #{i + 1}
                </text>
              </g>
            );
          })}

          {/* Student rows */}
          {allStudents.map((student, si) => {
            const y = HEADER_H + si * CELL;
            return (
              <g key={student}>
                {/* Alternating row background */}
                <rect x={0} y={y} width={W} height={CELL}
                  fill={si % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent'} />
                {/* Student label */}
                <text x={LABEL_W - 8} y={y + CELL / 2 + 4}
                  fill={MUTED} fontSize="11" textAnchor="end">{student}</text>
                {/* Cells */}
                {orderedRoutines.map((r, i) => {
                  const performs = r.students.includes(student);
                  const hasConflictHere = studentConflictSlots.has(`${student}-${i}`);
                  const cx = LABEL_W + i * CELL;
                  if (!performs) {
                    return <rect key={i} x={cx + 2} y={y + 2} width={CELL - 4} height={CELL - 4}
                      rx="3" fill={SURFACE2} />;
                  }
                  return (
                    <g key={i}>
                      <rect x={cx + 2} y={y + 2} width={CELL - 4} height={CELL - 4}
                        rx="3" fill={hasConflictHere ? DANGER : ACCENT}
                        opacity={hasConflictHere ? 0.9 : 0.7} />
                      {hasConflictHere && (
                        <text x={cx + CELL / 2} y={y + CELL / 2 + 4}
                          fill="white" fontSize="9" textAnchor="middle">!</text>
                      )}
                    </g>
                  );
                })}
              </g>
            );
          })}

          {/* Grid lines */}
          {orderedRoutines.map((_, i) => (
            <line key={i} x1={LABEL_W + i * CELL} y1={0}
              x2={LABEL_W + i * CELL} y2={H} stroke={BORDER} strokeWidth="1" />
          ))}
          <line x1={LABEL_W} y1={0} x2={LABEL_W} y2={H} stroke={BORDER} strokeWidth="1" />
          <line x1={0} y1={HEADER_H} x2={W} y2={HEADER_H} stroke={BORDER} strokeWidth="1" />
        </svg>
      </div>
    </div>
  );
}

// ── 3. Conflict Heatmap ───────────────────────────────────────────────────────
function ConflictHeatmap({ lineup, routines }) {
  const routineMap = useMemo(() => Object.fromEntries(routines.map(r => [r.id, r])), [routines]);
  const ordered    = lineup.filter(e => e.type === 'routine')
                           .map(e => routineMap[e.routineId]).filter(Boolean);

  if (ordered.length === 0) return <p className="viz-empty">Generate a lineup to see the conflict heatmap.</p>;

  const n = ordered.length;
  const CELL = Math.max(18, Math.min(36, Math.floor(560 / n)));
  const LABEL_W = 120, HEADER_H = 120;
  const W = LABEL_W + n * CELL, H = HEADER_H + n * CELL;

  // Precompute max shared count for color scale
  let maxShared = 1;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < n; j++)
      if (i !== j) {
        const s = new Set(ordered[i].students);
        const c = ordered[j].students.filter(x => s.has(x)).length;
        if (c > maxShared) maxShared = c;
      }

  function cellColor(i, j) {
    if (i === j) return 'rgba(192,132,252,0.15)';
    const s = new Set(ordered[i].students);
    const shared = ordered[j].students.filter(x => s.has(x)).length;
    if (shared === 0) return SURFACE2;
    const intensity = shared / maxShared;
    const r = Math.round(248 * intensity + 34 * (1 - intensity));
    const g = Math.round(113 * intensity + 34 * (1 - intensity));
    const b = Math.round(113 * intensity + 47 * (1 - intensity));
    return `rgba(${r},${g},${b},${0.4 + intensity * 0.6})`;
  }

  return (
    <div className="viz-chart-wrap">
      <h3 className="viz-subtitle">Conflict Heatmap</h3>
      <p className="viz-desc">Each cell shows shared dancers between two routines. Darker red = more shared students = higher conflict potential.</p>
      <div className="viz-scroll">
        <svg width={W} height={H}>
          {/* Column headers */}
          {ordered.map((r, i) => {
            const x = LABEL_W + i * CELL + CELL / 2;
            return (
              <text key={i} x={x} y={HEADER_H - 6} fill={MUTED} fontSize="9"
                textAnchor="start" transform={`rotate(-60, ${x}, ${HEADER_H - 6})`}>
                {r.title.length > 14 ? r.title.slice(0, 13) + '…' : r.title}
              </text>
            );
          })}

          {/* Rows */}
          {ordered.map((rRow, i) => (
            <g key={i}>
              <text x={LABEL_W - 6} y={HEADER_H + i * CELL + CELL / 2 + 4}
                fill={MUTED} fontSize="10" textAnchor="end">
                {rRow.title.length > 14 ? rRow.title.slice(0, 13) + '…' : rRow.title}
              </text>
              {ordered.map((_, j) => (
                <g key={j}>
                  <rect x={LABEL_W + j * CELL + 1} y={HEADER_H + i * CELL + 1}
                    width={CELL - 2} height={CELL - 2} rx="2"
                    fill={cellColor(i, j)} />
                  {(() => {
                    if (i === j) return null;
                    const s = new Set(ordered[i].students);
                    const shared = ordered[j].students.filter(x => s.has(x)).length;
                    if (shared === 0) return null;
                    return (
                      <text x={LABEL_W + j * CELL + CELL / 2} y={HEADER_H + i * CELL + CELL / 2 + 4}
                        fill="white" fontSize={CELL > 24 ? "10" : "8"} textAnchor="middle" fontWeight="700">
                        {shared}
                      </text>
                    );
                  })()}
                </g>
              ))}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

// ── 4. Routine Network ────────────────────────────────────────────────────────
function RoutineNetwork({ lineup, routines, settings }) {
  const routineMap = useMemo(() => Object.fromEntries(routines.map(r => [r.id, r])), [routines]);
  const ordered    = lineup.filter(e => e.type === 'routine')
                           .map(e => routineMap[e.routineId]).filter(Boolean);

  const conflictIds = useMemo(
    () => detectConflicts(ordered, settings.conflictBuffer),
    [ordered, settings.conflictBuffer]
  );

  if (ordered.length === 0) return <p className="viz-empty">Generate a lineup to see the routine network.</p>;

  const W = 720, H = 480, CX = W / 2, CY = H / 2;
  const R = Math.min(CX, CY) - 70;
  const n = ordered.length;

  // Circular layout
  const angle = i => (2 * Math.PI * i) / n - Math.PI / 2;
  const nodePos = i => ({
    x: CX + R * Math.cos(angle(i)),
    y: CY + R * Math.sin(angle(i)),
  });

  // Edges: pairs with shared students
  const edges = [];
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const s = new Set(ordered[i].students);
      const shared = ordered[j].students.filter(x => s.has(x)).length;
      if (shared > 0) edges.push({ i, j, shared });
    }
  }

  const maxShared = Math.max(...edges.map(e => e.shared), 1);
  const NODE_R    = Math.max(10, Math.min(20, Math.floor(R * 0.18)));

  return (
    <div className="viz-chart-wrap">
      <h3 className="viz-subtitle">Routine Network</h3>
      <p className="viz-desc">Nodes = routines in lineup order. Lines = shared dancers (thicker/darker = more shared). Red nodes = currently conflicting.</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="viz-svg">
        {/* Edges */}
        {edges.map(({ i, j, shared }) => {
          const a = nodePos(i), b = nodePos(j);
          const intensity = shared / maxShared;
          const isClose   = Math.abs(i - j) <= settings.conflictBuffer;
          return (
            <line key={`${i}-${j}`}
              x1={a.x} y1={a.y} x2={b.x} y2={b.y}
              stroke={isClose ? DANGER : `rgba(192,132,252,${0.15 + intensity * 0.55})`}
              strokeWidth={0.5 + intensity * 3}
              opacity={isClose ? 0.8 : 0.5}
            />
          );
        })}

        {/* Nodes */}
        {ordered.map((r, i) => {
          const { x, y } = nodePos(i);
          const isConflict = conflictIds.has(r.id);
          const fill = isConflict ? DANGER : ACCENT;
          const labelAngle = angle(i) * (180 / Math.PI) + 90;
          const labelR = R + NODE_R + 14;
          const lx = CX + labelR * Math.cos(angle(i));
          const ly = CY + labelR * Math.sin(angle(i));

          return (
            <g key={r.id}>
              <circle cx={x} cy={y} r={NODE_R}
                fill={fill} opacity="0.85"
                stroke={isConflict ? '#fca5a5' : '#e9d5ff'} strokeWidth="1.5" />
              <text x={x} y={y + 4} fill="white"
                fontSize={NODE_R > 14 ? "11" : "9"} textAnchor="middle" fontWeight="700">
                {i + 1}
              </text>
              <text x={lx} y={ly + 3} fill={isConflict ? DANGER : MUTED}
                fontSize="9" textAnchor="middle">
                {r.title.length > 10 ? r.title.slice(0, 9) + '…' : r.title}
              </text>
            </g>
          );
        })}

        {/* Center legend */}
        <text x={CX} y={CY - 14} fill={MUTED} fontSize="11" textAnchor="middle">
          {ordered.length} routines
        </text>
        <text x={CX} y={CY + 4} fill={conflictIds.size > 0 ? DANGER : SUCCESS} fontSize="12" textAnchor="middle" fontWeight="700">
          {conflictIds.size > 0 ? `⚠ ${conflictIds.size} conflict${conflictIds.size > 1 ? 's' : ''}` : '✓ No conflicts'}
        </text>
        <text x={CX} y={CY + 20} fill={MUTED} fontSize="10" textAnchor="middle">
          {edges.length} shared-student connection{edges.length !== 1 ? 's' : ''}
        </text>
      </svg>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'timeline', label: 'Student Timeline' },
  { id: 'heatmap',  label: 'Conflict Heatmap' },
  { id: 'score',    label: 'Score Chart' },
  { id: 'network',  label: 'Routine Network' },
];

export default function VisualizationPanel({ lineup, routines, settings, scoreLog }) {
  const [tab, setTab] = useState('timeline');

  return (
    <div className="viz-panel card">
      <h2>Analytics</h2>

      <div className="viz-tabs">
        {TABS.map(t => (
          <button key={t.id}
            className={`viz-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="viz-content">
        {tab === 'timeline' && <StudentTimeline lineup={lineup} routines={routines} settings={settings} />}
        {tab === 'heatmap'  && <ConflictHeatmap lineup={lineup} routines={routines} />}
        {tab === 'score'    && <ScoreChart scoreLog={scoreLog} />}
        {tab === 'network'  && <RoutineNetwork lineup={lineup} routines={routines} settings={settings} />}
      </div>
    </div>
  );
}
