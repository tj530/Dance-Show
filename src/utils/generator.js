/**
 * Auto-lineup generator
 * Rules:
 *  - Respect fixed positions: opening, finale, first-half-closer, second-half-opener
 *  - Respect act assignments
 *  - No student appears in consecutive numbers within the conflict buffer distance
 *  - Place intermission(s) between acts
 *  - Runs multiple iterations and picks the lineup with fewest conflicts
 */

const POSITIONS = ['opening', 'finale', 'first-half-closer', 'second-half-opener'];
const OPTIMIZE_ITERATIONS = 12;

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Check if placing `routine` at position `idx` in `placed` array violates the conflict buffer.
 * @param {import('../types').Routine} routine
 * @param {import('../types').Routine[]} placed  - routines placed so far (in order)
 * @param {number} buffer
 * @returns {boolean} true = conflict
 */
export function hasConflict(routine, placed, buffer) {
  const routineStudents = new Set(routine.students);
  for (let i = Math.max(0, placed.length - buffer); i < placed.length; i++) {
    for (const s of placed[i].students) {
      if (routineStudents.has(s)) return true;
    }
  }
  return false;
}

/**
 * Count total conflicts across the full placed list.
 * Lower is better.
 */
function countTotalConflicts(placed, buffer) {
  let count = 0;
  for (let i = 0; i < placed.length; i++) {
    const students = new Set(placed[i].students);
    for (let j = Math.max(0, i - buffer); j < i; j++) {
      for (const s of placed[j].students) {
        if (students.has(s)) { count++; break; }
      }
    }
  }
  return count;
}

/**
 * Try to insert `routine` into `placed` at the best position that minimises conflicts.
 * Returns new array with routine inserted.
 */
function insertAtBestPosition(routine, placed, buffer) {
  // Try appending (no conflict is optimal)
  if (!hasConflict(routine, placed, buffer)) {
    return [...placed, routine];
  }

  // Score every insertion position and pick the one with the fewest conflicts
  let bestResult = null;
  let bestScore = Infinity;

  for (let i = 0; i <= placed.length; i++) {
    const candidate = [...placed.slice(0, i), routine, ...placed.slice(i)];
    const score = countTotalConflicts(candidate, buffer);
    if (score < bestScore) {
      bestScore = score;
      bestResult = candidate;
    }
    if (score === 0) break; // perfect placement found
  }

  return bestResult || [...placed, routine];
}

/**
 * Detect all conflicts in a flat ordered routine list.
 * Returns Set of routine ids that are too close to another routine sharing a student.
 */
export function detectConflicts(orderedRoutines, buffer) {
  const conflictIds = new Set();
  for (let i = 0; i < orderedRoutines.length; i++) {
    const r = orderedRoutines[i];
    const students = new Set(r.students);
    for (let j = Math.max(0, i - buffer); j < i; j++) {
      for (const s of orderedRoutines[j].students) {
        if (students.has(s)) {
          conflictIds.add(r.id);
          conflictIds.add(orderedRoutines[j].id);
        }
      }
    }
  }
  return conflictIds;
}

/**
 * Single generation pass – returns LineupEntry[].
 */
function generateOnce(routines, settings) {
  const { conflictBuffer, numActs } = settings;

  const pinned = {};
  POSITIONS.forEach(p => {
    const found = routines.find(r => r.position === p);
    if (found) pinned[p] = found;
  });

  const pinnedIds = new Set(Object.values(pinned).map(r => r.id));
  const free = routines.filter(r => !pinnedIds.has(r.id));

  const act1Free = free.filter(r => r.act === 1);
  const act2Free = free.filter(r => r.act === 2);
  const anyFree  = shuffleArray(free.filter(r => !r.act));

  const half = Math.ceil(anyFree.length / 2);
  const anyForAct1 = numActs === 1 ? anyFree : anyFree.slice(0, half);
  const anyForAct2 = numActs === 1 ? []      : anyFree.slice(half);

  function buildAct(actRoutines, openingRoutine, closerRoutine) {
    let placed = openingRoutine ? [openingRoutine] : [];
    const toPlace = shuffleArray([...actRoutines]);

    for (const r of toPlace) {
      placed = insertAtBestPosition(r, placed, conflictBuffer);
    }

    if (closerRoutine) {
      placed = placed.filter(r => r.id !== closerRoutine.id);
      placed = [...placed, closerRoutine];
    }

    return placed;
  }

  let act1Routines, act2Routines;

  if (numActs === 1) {
    act1Routines = buildAct([...act1Free, ...anyForAct1], pinned['opening'], pinned['finale']);
    act2Routines = [];
  } else {
    act1Routines = buildAct([...act1Free, ...anyForAct1], pinned['opening'], pinned['first-half-closer']);
    act2Routines = buildAct([...act2Free, ...anyForAct2], pinned['second-half-opener'], pinned['finale']);
  }

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

/**
 * Main generator – runs multiple iterations and returns the lineup with the fewest conflicts.
 * @param {import('../types').Routine[]} routines
 * @param {import('../types').ShowSettings} settings
 * @returns {import('../types').LineupEntry[]}
 */
export function generateLineup(routines, settings) {
  const routineMap = Object.fromEntries(routines.map(r => [r.id, r]));

  let bestLineup = null;
  let bestConflicts = Infinity;

  for (let i = 0; i < OPTIMIZE_ITERATIONS; i++) {
    const candidate = generateOnce(routines, settings);

    const orderedRoutines = candidate
      .filter(e => e.type === 'routine')
      .map(e => routineMap[e.routineId])
      .filter(Boolean);

    const conflicts = detectConflicts(orderedRoutines, settings.conflictBuffer).size;

    if (conflicts < bestConflicts) {
      bestConflicts = conflicts;
      bestLineup = candidate;
    }

    // Perfect – no conflicts, stop early
    if (bestConflicts === 0) break;
  }

  return bestLineup || generateOnce(routines, settings);
}
