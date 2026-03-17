/**
 * Auto-lineup generator
 * Rules:
 *  - Respect fixed positions: opening, finale, first-half-closer, second-half-opener
 *  - Respect act assignments
 *  - No student appears in consecutive numbers within the conflict buffer distance
 *  - Place intermission(s) between acts
 */

const POSITIONS = ['opening', 'finale', 'first-half-closer', 'second-half-opener'];

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
 * Try to insert `routine` into `placed` at any position that satisfies the buffer constraint.
 * Returns new array with routine inserted, or null if impossible.
 */
function insertWithoutConflict(routine, placed, buffer) {
  // Try appending first (most common case)
  if (!hasConflict(routine, placed, buffer)) {
    return [...placed, routine];
  }
  // Try inserting at every index
  for (let i = placed.length - 1; i >= 0; i--) {
    const candidate = [...placed.slice(0, i), routine, ...placed.slice(i)];
    // Check window around insertion point
    let ok = true;
    for (let j = Math.max(0, i - buffer); j <= Math.min(candidate.length - 1, i + buffer); j++) {
      if (j === i) continue;
      const window = candidate.slice(Math.max(0, j - buffer), j);
      if (hasConflict(candidate[j], window, buffer)) { ok = false; break; }
    }
    if (ok) return candidate;
  }
  return null;
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
 * Main generator – returns array of LineupEntry objects.
 * @param {import('../types').Routine[]} routines
 * @param {import('../types').ShowSettings} settings
 * @returns {import('../types').LineupEntry[]}
 */
export function generateLineup(routines, settings) {
  const { conflictBuffer, numActs } = settings;

  // Separate pinned (position) routines from free ones
  const pinned = {};
  POSITIONS.forEach(p => {
    const found = routines.find(r => r.position === p);
    if (found) pinned[p] = found;
  });

  const pinnedIds = new Set(Object.values(pinned).map(r => r.id));
  const free = routines.filter(r => !pinnedIds.has(r.id));

  // Split free by act
  const act1Free = free.filter(r => r.act === 1);
  const act2Free = free.filter(r => r.act === 2);
  const anyFree = shuffleArray(free.filter(r => !r.act));

  // Distribute "any" routines evenly
  const half = Math.ceil(anyFree.length / 2);
  const anyForAct1 = numActs === 1 ? anyFree : anyFree.slice(0, half);
  const anyForAct2 = numActs === 1 ? [] : anyFree.slice(half);

  function buildAct(actRoutines, openingRoutine, closerRoutine) {
    // Start with opening if provided
    let placed = openingRoutine ? [openingRoutine] : [];

    // Shuffle and insert remaining routines respecting conflict buffer
    const toPlace = shuffleArray([...actRoutines]);

    for (const r of toPlace) {
      const result = insertWithoutConflict(r, placed, conflictBuffer);
      if (result) {
        placed = result;
      } else {
        // Force append as fallback
        placed = [...placed, r];
      }
    }

    // Place closer at end if provided
    if (closerRoutine) {
      // Remove from current position if it snuck in
      placed = placed.filter(r => r.id !== closerRoutine.id);
      placed = [...placed, closerRoutine];
    }

    return placed;
  }

  let act1Routines, act2Routines;

  if (numActs === 1) {
    const pool = [...act1Free, ...anyForAct1];
    act1Routines = buildAct(pool, pinned['opening'], pinned['finale']);
    act2Routines = [];
  } else {
    const pool1 = [...act1Free, ...anyForAct1];
    const pool2 = [...act2Free, ...anyForAct2];
    act1Routines = buildAct(pool1, pinned['opening'], pinned['first-half-closer']);
    act2Routines = buildAct(pool2, pinned['second-half-opener'], pinned['finale']);
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
