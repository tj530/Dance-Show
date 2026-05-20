/**
 * Dance Show Lineup Optimizer
 *
 * Penalty equation (student conflicts):
 *   penalty(i, j) = sharedStudents(i, j) × (buffer − gap + 1)²
 *
 *   The squared term means being 1 apart is much worse than being 2 apart.
 *   e.g. buffer=2, gap=1 → violation=2 → cost × 4
 *        buffer=2, gap=2 → violation=1 → cost × 1
 *
 * Additional penalty: adjacent solos/duos/trios (1–3 performers) cost
 * SMALL_GROUP_PENALTY so the optimizer breaks them up with larger groups.
 *
 * Optimization pipeline (run once per act):
 *   1. Pull out any routines locked to opening/finale/closer positions
 *   2. Generate 8 different starting orders (seeds) for the free routines
 *   3. Greedy insert: place each routine in whichever slot scores lowest
 *   4. 2-opt: repeatedly swap pairs until no swap can lower the score
 *   5. Keep whichever seed produced the best final score
 */

const POSITIONS           = ['opening', 'finale', 'first-half-closer', 'second-half-opener'];
const SEEDS               = 8;   // number of starting orders to try
const SMALL_GROUP_PENALTY = 6;   // penalty points per adjacent solo/duo/trio pair

// ── Helpers ───────────────────────────────────────────────────────────────────

// Count how many dancers appear in both routines
function sharedStudentCount(r1, r2) {
  const s = new Set(r1.students);
  return r2.students.filter(x => s.has(x)).length;
}

// A "small group" is a solo (1), duo (2), or trio (3)
function isSmallGroup(routine) {
  const n = routine.students.length;
  return n >= 1 && n <= 3;
}

/**
 * Returns true if two routines have the exact same set of dancers.
 * These routines are exempt from conflict penalties — the same group
 * performing twice can be placed close together without issue.
 */
function sameExactCast(r1, r2) {
  if (r1.students.length === 0 || r1.students.length !== r2.students.length) return false;
  const s = new Set(r1.students);
  return r2.students.every(x => s.has(x));
}

// ── Scoring ───────────────────────────────────────────────────────────────────

/**
 * Calculate the total penalty score for a lineup order.
 * Lower score = better lineup. Score of 0 means no conflicts.
 */
export function scoreLineup(orderedRoutines, buffer) {
  let score = 0;

  for (let i = 0; i < orderedRoutines.length; i++) {
    // Check this routine against the previous `buffer` routines for shared dancers.
    // Skip pairs with an identical cast — the same group performing twice is intentional
    // and can be placed close together without needing a change gap.
    for (let j = Math.max(0, i - buffer); j < i; j++) {
      if (sameExactCast(orderedRoutines[i], orderedRoutines[j])) continue;
      const shared = sharedStudentCount(orderedRoutines[i], orderedRoutines[j]);
      if (shared > 0) {
        const gap       = i - j;                 // how far apart they are
        const violation = buffer - gap + 1;      // how badly the buffer is broken
        score += shared * violation * violation; // squared so closer = much worse
      }
    }

    // Penalise two small groups (solo/duo/trio) sitting next to each other
    if (i > 0 && isSmallGroup(orderedRoutines[i]) && isSmallGroup(orderedRoutines[i - 1])) {
      score += SMALL_GROUP_PENALTY;
    }
  }

  return score;
}

/**
 * Return the IDs of all routines that share an identical cast with at least
 * one other routine in the list. Used by LineupView to highlight these pairs.
 */
export function detectIdenticalCastGroups(orderedRoutines) {
  const flagged = new Set();
  for (let i = 0; i < orderedRoutines.length; i++) {
    for (let j = i + 1; j < orderedRoutines.length; j++) {
      if (sameExactCast(orderedRoutines[i], orderedRoutines[j])) {
        flagged.add(orderedRoutines[i].id);
        flagged.add(orderedRoutines[j].id);
      }
    }
  }
  return flagged;
}

/**
 * Return the IDs of routines that are adjacent to another solo/duo/trio.
 * Used by LineupView to highlight these entries.
 */
export function detectSmallGroupAdjacency(orderedRoutines) {
  const flagged = new Set();
  for (let i = 1; i < orderedRoutines.length; i++) {
    if (isSmallGroup(orderedRoutines[i]) && isSmallGroup(orderedRoutines[i - 1])) {
      flagged.add(orderedRoutines[i].id);
      flagged.add(orderedRoutines[i - 1].id);
    }
  }
  return flagged;
}

/**
 * Return the IDs of routines whose dancers appear too close together.
 * Used by LineupView to highlight conflict entries.
 */
export function detectConflicts(orderedRoutines, buffer) {
  const conflictIds = new Set();
  for (let i = 0; i < orderedRoutines.length; i++) {
    const students = new Set(orderedRoutines[i].students);
    for (let j = Math.max(0, i - buffer); j < i; j++) {
      // Identical-cast routines are exempt — same group performing twice is not a conflict
      if (sameExactCast(orderedRoutines[i], orderedRoutines[j])) continue;
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

/**
 * Quick check: would inserting `routine` after `placed` create a conflict?
 * Used during greedy insertion to find conflict-free slots first.
 */
export function hasConflict(routine, placed, buffer) {
  const students = new Set(routine.students);
  for (let i = Math.max(0, placed.length - buffer); i < placed.length; i++) {
    for (const s of placed[i].students) {
      if (students.has(s)) return true;
    }
  }
  return false;
}

// ── Greedy placement ──────────────────────────────────────────────────────────

/**
 * Insert routines one at a time, always choosing the position that gives
 * the lowest score for the whole lineup so far.
 * `base` contains any pinned routines already fixed at the front —
 * we never insert before them, so we start scanning from base.length.
 */
function greedyInsert(base, toPlace, buffer) {
  let placed = [...base];
  for (const r of toPlace) {
    let bestScore = Infinity;
    let bestPos   = placed.length; // default: append at end
    // Start from base.length — position 0..base.length-1 are reserved for the pinned opener
    for (let pos = base.length; pos <= placed.length; pos++) {
      const candidate = [...placed.slice(0, pos), r, ...placed.slice(pos)];
      const s = scoreLineup(candidate, buffer);
      if (s < bestScore) { bestScore = s; bestPos = pos; }
    }
    placed = [...placed.slice(0, bestPos), r, ...placed.slice(bestPos)];
  }
  return placed;
}

// ── 2-opt local search ────────────────────────────────────────────────────────

/**
 * Repeatedly swap any two non-pinned routines if it lowers the score.
 * Stops when no single swap can improve things further (local optimum).
 * Records each improvement in scoreLog for the Analytics chart.
 */
function twoOpt(routines, buffer, pinnedIds, scoreLog, seedLabel) {
  let current  = [...routines];
  let improved = true;
  let step     = 0;

  // Record the score right after greedy insertion, before any swaps
  if (scoreLog) scoreLog.push({ label: `${seedLabel} greedy`, score: scoreLineup(current, buffer), seed: seedLabel, step: step++ });

  while (improved) {
    improved = false;
    const baseline = scoreLineup(current, buffer);

    outer:
    for (let i = 0; i < current.length - 1; i++) {
      if (pinnedIds.has(current[i].id)) continue; // never move pinned routines
      for (let j = i + 1; j < current.length; j++) {
        if (pinnedIds.has(current[j].id)) continue;
        const candidate = [...current];
        [candidate[i], candidate[j]] = [candidate[j], candidate[i]]; // try the swap
        if (scoreLineup(candidate, buffer) < baseline) {
          current  = candidate;
          improved = true;
          if (scoreLog) scoreLog.push({ label: `${seedLabel} swap ${step}`, score: scoreLineup(current, buffer), seed: seedLabel, step: step++ });
          break outer; // restart scan from the beginning with the new order
        }
      }
    }
  }

  return current;
}

// ── Seed orderings ────────────────────────────────────────────────────────────

// Fisher-Yates shuffle — returns a new randomly ordered array
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Generate the 8 starting orders (seeds) to try.
 * Seed 1: most-conflicting routines first (spreads heavy hitters across the lineup)
 * Seed 2: reverse of seed 1
 * Seeds 3–8: random shuffles (escape local optima the sorted order might miss)
 */
function seedOrders(routines) {
  if (routines.length === 0) return [[]];
  const weight = r => routines.reduce((s, o) => s + (o !== r ? sharedStudentCount(r, o) : 0), 0);
  const byDesc = [...routines].sort((a, b) => weight(b) - weight(a));
  const seeds  = [byDesc, [...byDesc].reverse()];
  while (seeds.length < SEEDS) seeds.push(shuffle(routines));
  return seeds;
}

// ── Per-act optimizer ─────────────────────────────────────────────────────────

/**
 * Optimize the order of one act's routines.
 * `opener` and `closer` are pinned to the first/last slots respectively.
 * Tries all seeds, keeps the one with the lowest final score.
 */
function optimizeAct(free, opener, closer, buffer, scoreLog) {
  // Nothing to arrange — just return the pinned routines in order
  if (free.length === 0) {
    return [...(opener ? [opener] : []), ...(closer ? [closer] : [])];
  }

  const pinnedIds = new Set([
    ...(opener ? [opener.id] : []),
    ...(closer ? [closer.id] : []),
  ]);

  const base  = opener ? [opener] : []; // greedy insertion starts after the opener
  const seeds = seedOrders(free);

  let bestResult = null;
  let bestScore  = Infinity;

  seeds.forEach((seed, idx) => {
    const label = `Seed ${idx + 1}`;

    // Greedy insert into the slot after the opener
    let result = greedyInsert(base, seed, buffer);

    // Force the closer to the end (greedy may have placed it elsewhere)
    if (closer) {
      result = result.filter(r => r.id !== closer.id);
      result = [...result, closer];
    }

    result = twoOpt(result, buffer, pinnedIds, scoreLog, label);

    const s = scoreLineup(result, buffer);
    if (scoreLog) scoreLog.push({ label: `${label} final`, score: s, seed: label, step: -1, isFinal: true });

    if (s < bestScore) { bestScore = s; bestResult = result; }
    if (s === 0) return; // perfect score — no point trying more seeds
  });

  return bestResult;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate an optimized lineup from the given routines and show settings.
 *
 * Steps:
 *  1. Separate pinned routines (Opening, Finale, etc.) from free routines
 *  2. Assign "either act" routines to whichever act they conflict with less
 *  3. Optimize each act independently
 *  4. Stitch the acts together with an Intermission entry between them
 *
 * @param {import('../types').Routine[]} routines
 * @param {import('../types').ShowSettings} settings
 * @returns {{ lineup: import('../types').LineupEntry[], scoreLog: object[] }}
 */
export function generateLineup(routines, settings) {
  const { conflictBuffer, numActs } = settings;
  const scoreLog = []; // collects score snapshots for the Analytics chart

  // Pull out any routines locked to special positions
  const pinned = {};
  POSITIONS.forEach(p => {
    const found = routines.find(r => r.position === p);
    if (found) pinned[p] = found;
  });

  const pinnedIds = new Set(Object.values(pinned).map(r => r.id));
  const free      = routines.filter(r => !pinnedIds.has(r.id));

  // Split free routines into act pools
  const act1Free = free.filter(r => r.act === 1);
  const act2Free = free.filter(r => r.act === 2);
  const anyFree  = free.filter(r => !r.act); // no act preference set

  // Assign "either act" routines to whichever act they share fewer dancers with
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

  // Optimize each act with its pinned opener and closer
  let act1Routines, act2Routines;
  if (numActs === 1) {
    act1Routines = optimizeAct(pool1, pinned['opening'] || null, pinned['finale'] || null, conflictBuffer, scoreLog);
    act2Routines = [];
  } else {
    act1Routines = optimizeAct(pool1, pinned['opening'] || null, pinned['first-half-closer'] || null, conflictBuffer, scoreLog);
    act2Routines = optimizeAct(pool2, pinned['second-half-opener'] || null, pinned['finale'] || null, conflictBuffer, scoreLog);
  }

  // Build the flat lineup entry list, inserting an Intermission between acts
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
