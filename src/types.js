/**
 * @typedef {Object} Routine
 * @property {string} id
 * @property {string} title
 * @property {string[]} students  - list of student names
 * @property {number|null} act    - 1, 2, … or null (either act)
 * @property {'opening'|'finale'|'first-half-closer'|'second-half-opener'|null} position
 * @property {string} style       - e.g. "Ballet", "Hip-Hop"
 * @property {string} level       - e.g. "Beginner", "Advanced"
 */

/**
 * @typedef {Object} LineupEntry
 * @property {string} id           - unique entry id
 * @property {'routine'|'intermission'} type
 * @property {string|null} routineId
 * @property {string} label        - display label for intermission
 * @property {number} act
 */

/**
 * @typedef {Object} ShowSettings
 * @property {number} conflictBuffer   - 1 | 2 | 3 routines min gap for same student
 * @property {number} numActs          - 1 | 2
 * @property {string} showName
 */
