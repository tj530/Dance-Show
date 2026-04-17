/**
 * Dance Show Lineup Optimizer
 *
 * Penalty equation:
 *   penalty(i, j) = sharedStudents(i,j) × (buffer − gap + 1)²
 *
 * Pipeline per act:
 *   1. Build conflict-weight graph
 *   2. Generate SEEDS initial orderings (conflict-sorted + random)
 *   3. Greedy insert each routine at lowest-score position
 *   4. 2-opt local search (swap pairs until no improvement)
 *   5. Return best result; emit score log for visualization
 */

const POSITIONS = ['opening', 'finale', 'first-half-closer', 'second-half-opener'];
const SEEDS     = 8;

// ── Scoring ──────────────────────────────────────────────────────────────────

function sharedStudentCount(r1, r2) {
  const s = new Set(r1.students);
  return r2.students.filter(x => s.has(x)).length;
}

export function scoreLineup(orderedRoutines, buffer) {
  let score = 0;
  for (let i = 0; i < orderedRoutines.length; i++) {
    for (let j = Math.max(0, i - buffer); j < i; j++) {
      const shared = sharedStudentCount(orderedRoutines[i], orderedRoutines[j]);
      if (shared > 0) {
        const gap       = i - j;
        const violation = buffer - gap + 1;
        score += shared * violation * violation;
      }
    }
  }
  return score;
}

export function detectConflicts(orderedRoutines, buffer) {
  const conflictIds = new Set();
  for (let i = 0; i < orderedRoutines.length; i++) {
    const students = new Set(orderedRoutines[i].students);
    for (let j = Math.max(0, i - buffer); j < i; j++) {
      for (const s of orderedRoutines[j].students) {
        if (students.has(s)) {
          conflictIds.add(orderedRoutines[i].id);
          conflictIds.add(orderedRoutines[j].id);
        }
      }
    }
  }
  return conflictIds;
}

export function hasConflict(routine, placed, buffer) {
  const students = new Set(routine.students);
  for (let i = Math.max(0, placed.length - buffer); i < placed.length; i++) {
    for (const s of placed[i].students) {
      if (students.has(s)) return true;
    }
  }
  return false;
}

// ── Greedy placement ─────────────────────────────────────────────────────────

function greedyInsert(base, toPlace, buffer) {
  let placed = [...base];
  for (const r of toPlace) {
    let bestScore = Infinity;
    let bestPos   = placed.length;
    for (let pos = 0; pos <= placed.length; pos++) {
      const candidate = [...placed.slice(0, pos), r, ...placed.slice(pos)];
      const s = scoreLineup(candidate, buffer);
      if (s < bestScore) { bestScore = s; bestPos = pos; }
    }
    placed = [...placed.slice(0, bestPos), r, ...placed.slice(bestPos)];
  }
  return placed;
}

// ── 2-opt local search ────────────────────────────────────────────────────────

function twoOpt(routines, buffer, pinnedIds, scoreLog, seedLabel) {
  let current  = [...routines];
  let improved = true;
  let step     = 0;

  if (scoreLog) scoreLog.push({ label: `${seedLabel} greedy`, score: scoreLineup(current, buffer), seed: seedLabel, step: step++ });

  while (improved) {
    improved = false;
    const baseline = scoreLineup(current, buffer);

    outer:
    for (let i = 0; i < current.length - 1; i++) {
      if (pinnedIds.has(current[i].id)) continue;
      for (let j = i + 1; j < current.length; j++) {
        if (pinnedIds.has(current[j].id)) continue;
        const candidate = [...current];
        [candidate[i], candidate[j]] = [candidate[j], candidate[i]];
        if (scoreLineup(candidate, buffer) < baseline) {
          current  = candidate;
          improved = true;
          if (scoreLog) scoreLog.push({ label: `${seedLabel} swap ${step}`, score: scoreLineup(current, buffer), seed: seedLabel, step: step++ });
          break outer;
        }
      }
    }
  }

  return current;
}

// ── Seed orderings ────────────────────────────────────────────────────────────

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function seedOrders(routines) {
  if (routines.length === 0) return [[]];
  const weight = r => routines.reduce((s, o) => s + (o !== r ? sharedStudentCount(r, o) : 0), 0);
  const byDesc = [...routines].sort((a, b) => weight(b) - weight(a));
  const seeds  = [byDesc, [...byDesc].reverse()];
  while (seeds.length < SEEDS) seeds.push(shuffle(routines));
  return seeds;
}

// ── Per-act optimizer ─────────────────────────────────────────────────────────

function optimizeAct(free, opener, closer, buffer, scoreLog) {
  if (free.length === 0) {
    return [...(opener ? [opener] : []), ...(closer ? [closer] : [])];
  }

  const pinnedIds = new Set([
    ...(opener ? [opener.id] : []),
    ...(closer ? [closer.id] : []),
  ]);

  const base  = opener ? [opener] : [];
  const seeds = seedOrders(free);

  let bestResult = null;
  let bestScore  = Infinity;

  seeds.forEach((seed, idx) => {
    const label  = `Seed ${idx + 1}`;
    let result   = greedyInsert(base, seed, buffer);
    if (closer) {
      result = result.filter(r => r.id !== closer.id);
      result = [...result, closer];
    }
    result = twoOpt(result, buffer, pinnedIds, scoreLog, label);

    const s = scoreLineup(result, buffer);
    if (scoreLog) scoreLog.push({ label: `${label} final`, score: s, seed: label, step: -1, isFinal: true });

    if (s < bestScore) { bestScore = s; bestResult = result; }
    if (s === 0) return;
  });

  return bestResult;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * @param {import('../types').Routine[]} routines
 * @param {import('../types').ShowSettings} settings
 * @returns {{ lineup: import('../types').LineupEntry[], scoreLog: object[] }}
 */
export function generateLineup(routines, settings) {
  const { conflictBuffer, numActs } = settings;
  const scoreLog = [];

  const pinned = {};
  POSITIONS.forEach(p => {
    const found = routines.find(r => r.position === p);
    if (found) pinned[p] = found;
  });

  const pinnedIds = new Set(Object.values(pinned).map(r => r.id));
  const free      = routines.filter(r => !pinnedIds.has(r.id));

  const act1Free = free.filter(r => r.act === 1);
  const act2Free = free.filter(r => r.act === 2);
  const anyFree  = free.filter(r => !r.act);

  let anyForAct1, anyForAct2;
  if (numActs === 1) {
    anyForAct1 = anyFree; anyForAct2 = [];
  } else {
    anyForAct1 = []; anyForAct2 = [];
    for (const r of anyFree) {
      const w1 = act1Free.reduce((s, o) => s + sharedStudentCount(r, o), 0) + anyForAct1.reduce((s, o) => s + sharedStudentCount(r, o), 0);
      const w2 = act2Free.reduce((s, o) => s + sharedStudentCount(r, o), 0) + anyForAct2.reduce((s, o) => s + sharedStudentCount(r, o), 0);
      (w1 <= w2 ? anyForAct1 : anyForAct2).push(r);
    }
  }

  const pool1 = [...act1Free, ...anyForAct1];
  const pool2 = [...act2Free, ...anyForAct2];

  let act1Routines, act2Routines;
  if (numActs === 1) {
    act1Routines = optimizeAct(pool1, pinned['opening'] || null, pinned['finale'] || null, conflictBuffer, scoreLog);
    act2Routines = [];
  } else {
    act1Routines = optimizeAct(pool1, pinned['opening'] || null, pinned['first-half-closer'] || null, conflictBuffer, scoreLog);
    act2Routines = optimizeAct(pool2, pinned['second-half-opener'] || null, pinned['finale'] || null, conflictBuffer, scoreLog);
  }

  const entries = [];
  let entryId   = 1;
  const makeEntry = (r, act) => ({ id: `entry-${entryId++}`, type: 'routine', routineId: r.id, label: r.title, act });

  act1Routines.forEach(r => entries.push(makeEntry(r, 1)));
  if (numActs > 1) {
    entries.push({ id: `entry-${entryId++}`, type: 'intermission', routineId: null, label: 'Intermission', act: 1 });
    act2Routines.forEach(r => entries.push(makeEntry(r, 2)));
  }

  return { lineup: entries, scoreLog };
}
