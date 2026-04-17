/**
 * Dance Show Lineup Optimizer
 *
 * Uses a score-equation approach rather than random shuffling:
 *
 *   penalty(i, j) = sharedStudents(i,j) × (buffer − gap + 1)²
 *
 * where gap = positions between routines i and j.
 * Squaring the violation depth makes close conflicts far worse than near-buffer ones,
 * giving the optimizer a real gradient to follow.
 *
 * Pipeline per act:
 *   1. Build conflict-weight graph between all routine pairs
 *   2. Generate several seed orderings (conflict-sorted, reverse, random ×N)
 *   3. Greedy insert: place each routine at the position with the lowest score
 *   4. 2-opt improvement: swap every non-pinned pair that reduces total score
 *   5. Return the best result across all seeds
 */

const POSITIONS = ['opening', 'finale', 'first-half-closer', 'second-half-opener'];
const SEEDS      = 8;   // number of random seeds to try per act

// ── Scoring ─────────────────────────────────────────────────────────────────

/** Number of students shared between two routines. */
function sharedStudentCount(r1, r2) {
  const s = new Set(r1.students);
  return r2.students.filter(x => s.has(x)).length;
}

/**
 * Total penalty score for an ordered list of routines.
 * Lower = better. Zero = no conflicts within the buffer window.
 */
export function scoreLineup(orderedRoutines, buffer) {
  let score = 0;
  for (let i = 0; i < orderedRoutines.length; i++) {
    for (let j = Math.max(0, i - buffer); j < i; j++) {
      const shared = sharedStudentCount(orderedRoutines[i], orderedRoutines[j]);
      if (shared > 0) {
        const gap       = i - j;                    // 1 = back-to-back
        const violation = buffer - gap + 1;          // > 0 means inside buffer
        score += shared * violation * violation;     // quadratic depth penalty
      }
    }
  }
  return score;
}

// ── Conflict detection (public — used by LineupView) ────────────────────────

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

// Kept for external callers
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

/**
 * Insert each routine from `toPlace` into `base` at the position that
 * produces the lowest total score. Returns the completed array.
 */
function greedyInsert(base, toPlace, buffer) {
  let placed = [...base];
  for (const r of toPlace) {
    let bestScore = Infinity;
    let bestPos   = placed.length;

    for (let pos = 0; pos <= placed.length; pos++) {
      const candidate = [...placed.slice(0, pos), r, ...placed.slice(pos)];
      const s = scoreLineup(candidate, buffer);
      if (s < bestScore) {
        bestScore = s;
        bestPos   = pos;
      }
    }
    placed = [...placed.slice(0, bestPos), r, ...placed.slice(bestPos)];
  }
  return placed;
}

// ── 2-opt local search ────────────────────────────────────────────────────────

/**
 * Repeatedly swap pairs of non-pinned routines until no swap improves score.
 * `pinnedIndices` is a Set of indices that must not move.
 */
function twoOpt(routines, buffer, pinnedIds) {
  let current = [...routines];
  let improved = true;

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
          break outer; // restart with the new arrangement
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

/**
 * Generate `SEEDS` different starting orders for `routines`, sorted by
 * conflict weight and padded with random shuffles.
 */
function seedOrders(routines) {
  if (routines.length === 0) return [[]];

  // Conflict weight = sum of shared students with every other routine
  const weight = r => routines.reduce((s, o) => s + (o !== r ? sharedStudentCount(r, o) : 0), 0);
  const byWeightDesc = [...routines].sort((a, b) => weight(b) - weight(a));
  const byWeightAsc  = [...byWeightDesc].reverse();

  const seeds = [byWeightDesc, byWeightAsc];
  while (seeds.length < SEEDS) seeds.push(shuffle(routines));
  return seeds;
}

// ── Per-act optimizer ─────────────────────────────────────────────────────────

/**
 * Find the best ordering for an act's routines.
 *
 * @param {Routine[]} free          - routines to order freely
 * @param {Routine|null} opener     - must be first (or null)
 * @param {Routine|null} closer     - must be last (or null)
 * @param {number} buffer
 * @returns {Routine[]}
 */
function optimizeAct(free, opener, closer, buffer) {
  if (free.length === 0) {
    return [...(opener ? [opener] : []), ...(closer ? [closer] : [])];
  }

  const pinnedIds = new Set([
    ...(opener ? [opener.id] : []),
    ...(closer ? [closer.id] : []),
  ]);

  // Base array: opener fixed at front, closer fixed at back
  const base  = opener ? [opener] : [];
  const seeds = seedOrders(free);

  let bestResult = null;
  let bestScore  = Infinity;

  for (const seed of seeds) {
    // Greedy insert in this seed order
    let result = greedyInsert(base, seed, buffer);

    // Attach closer at the end (remove if it snuck in during greedy)
    if (closer) {
      result = result.filter(r => r.id !== closer.id);
      result = [...result, closer];
    }

    // 2-opt improvement (don't move opener/closer)
    result = twoOpt(result, buffer, pinnedIds);

    const s = scoreLineup(result, buffer);
    if (s < bestScore) {
      bestScore  = s;
      bestResult = result;
      if (s === 0) break; // perfect — no need to keep trying
    }
  }

  return bestResult;
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Generate the best possible lineup for the given routines and settings.
 * @param {import('../types').Routine[]} routines
 * @param {import('../types').ShowSettings} settings
 * @returns {import('../types').LineupEntry[]}
 */
export function generateLineup(routines, settings) {
  const { conflictBuffer, numActs } = settings;

  // Separate pinned routines
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

  // Distribute "either act" routines to minimise cross-act student overlap
  let anyForAct1, anyForAct2;
  if (numActs === 1) {
    anyForAct1 = anyFree;
    anyForAct2 = [];
  } else {
    // Assign each "any" routine to whichever act has fewer shared students with it
    anyForAct1 = [];
    anyForAct2 = [];
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
    act1Routines = optimizeAct(pool1, pinned['opening'] || null, pinned['finale'] || null, conflictBuffer);
    act2Routines = [];
  } else {
    act1Routines = optimizeAct(pool1, pinned['opening'] || null, pinned['first-half-closer'] || null, conflictBuffer);
    act2Routines = optimizeAct(pool2, pinned['second-half-opener'] || null, pinned['finale'] || null, conflictBuffer);
  }

  // Build LineupEntry array
  const entries = [];
  let entryId = 1;
  const makeEntry = (routine, act) => ({
    id: `entry-${entryId++}`,
    type: 'routine',
    routineId: routine.id,
    label: routine.title,
    act,
  });

  act1Routines.forEach(r => entries.push(makeEntry(r, 1)));

  if (numActs > 1) {
    entries.push({
      id: `entry-${entryId++}`,
      type: 'intermission',
      routineId: null,
      label: 'Intermission',
      act: 1,
    });
    act2Routines.forEach(r => entries.push(makeEntry(r, 2)));
  }

  return entries;
}
