import Papa from 'papaparse';

/**
 * Detect whether a CSV is a Dance Studio Pro (DSP) enrollment export.
 * DSP files have columns: (blank), Name, Class, Teacher, Location, Room, Days & Time, Birthday, Age
 * We only need to spot Name + Class + Teacher to be confident it's DSP format.
 */
function isDSPFormat(headers) {
  // Lowercase before comparing — PapaParse's meta.fields may return original case
  const h = new Set(headers.map(x => x.trim().toLowerCase()));
  return h.has('name') && h.has('class') && h.has('teacher');
}

/**
 * Parse rows from a DSP enrollment export into an array of class objects.
 *
 * DSP quirks this handles:
 *  - The file contains multiple classes stacked in one CSV
 *  - Each class section repeats the header row (Name, Class, Teacher…) at the top
 *  - Each class section ends with an "Average Age" summary row
 *
 * @typedef {{ title: string, students: string[] }} DSPClass
 * @returns {DSPClass[]}
 */
function parseDSPRows(data) {
  const classMap = new Map(); // Map preserves insertion order so class sequence is maintained

  for (const row of data) {
    const nameVal = (row['name'] || '').trim();

    // Skip the repeated header rows that appear at the top of each class section
    if (nameVal.toLowerCase() === 'name') continue;

    // Skip "Average Age" summary rows that appear at the bottom of each class section
    const allValues = Object.values(row).join(' ').toLowerCase();
    if (allValues.includes('average age')) continue;

    const className = (row['class'] || '').trim();
    if (!nameVal || !className) continue; // skip any other blank/garbage rows

    // Group students by their class name
    if (!classMap.has(className)) {
      classMap.set(className, { title: className, students: [] });
    }
    classMap.get(className).students.push(nameVal);
  }

  return Array.from(classMap.values());
}

/**
 * Expand DSP classes into Routine objects.
 * A class can perform 1, 2, or 3 times in the show (configured by the user after import).
 *   count = 1 → one routine titled "Ballet Beginners"
 *   count > 1 → routines titled "Ballet Beginners 1", "Ballet Beginners 2", …
 * All routines for the same class share the same student list.
 *
 * @param {DSPClass[]} classes
 * @param {Record<string, number>} counts  map of class title → number of routines (1–3)
 */
export function expandDSPClasses(classes, counts) {
  const routines = [];
  classes.forEach(({ title, students }) => {
    const count = counts[title] ?? 1;
    for (let n = 1; n <= count; n++) {
      routines.push({
        id: `r-${Date.now()}-${routines.length}`,
        title: count === 1 ? title : `${title} ${n}`,
        students,
        act: null,       // no act preference — optimizer will assign
        position: null,  // no special position
        style: '',
        level: '',
      });
    }
  });
  return routines;
}

/**
 * Parse a CSV file dropped on the import panel.
 * Auto-detects whether it's a DSP enrollment export or the native format.
 *
 * Returns:
 *   { isDSP: true,  classes: DSPClass[] }  — show per-class count config screen
 *   { isDSP: false, routines: Routine[] }  — import directly
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(), // normalise all headers to lowercase
      complete: ({ data, meta }) => {
        try {
          // meta.fields may be original-case depending on PapaParse version,
          // so fall back to the actual data row keys (always lowercase after transformHeader)
          const fields = (meta.fields && meta.fields.length)
            ? meta.fields
            : Object.keys(data[0] || {});

          if (isDSPFormat(fields)) {
            resolve({ isDSP: true, classes: parseDSPRows(data) });
          } else {
            // Skip intermission rows when re-importing a previously exported lineup
            const routineRows = data.filter(row => (row.type || '').toLowerCase() !== 'intermission');
            resolve({ isDSP: false, routines: routineRows.map((row, i) => parseRow(row, i)) });
          }
        } catch (e) {
          reject(e);
        }
      },
      error: reject,
    });
  });
}

/**
 * Parse a JSON file — expected to be an array of routine objects.
 * Keys are normalised to lowercase so casing in the file doesn't matter.
 */
export function parseJSON(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const data = JSON.parse(e.target.result);
        if (!Array.isArray(data)) throw new Error('JSON must be an array of routines');
        const routines = data.map((row, i) => parseRow(normalizeKeys(row), i));
        resolve(routines);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = reject;
    reader.readAsText(file);
  });
}

// Lowercase all keys so the parser doesn't care about capitalisation in the file
function normalizeKeys(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => { out[k.toLowerCase().trim()] = v; });
  return out;
}

const VALID_POSITIONS = ['opening', 'finale', 'first-half-closer', 'second-half-opener'];

/**
 * Convert a single CSV/JSON row into a Routine object.
 * Accepts several alternate column names (students / performers / dancers)
 * so files exported from other tools still work.
 */
function parseRow(row, index) {
  const title = (row.title || row.name || '').trim();
  if (!title) throw new Error(`Row ${index + 1}: missing "title" column`);

  // Accept semicolons, commas, or pipes as dancer separators
  const studentsRaw = row.students || row.performers || row.dancers || '';
  const students = String(studentsRaw)
    .split(/[;,|]/)
    .map(s => s.trim())
    .filter(Boolean);

  const actRaw = String(row.act || '').trim();
  const act = ['1', '2'].includes(actRaw) ? Number(actRaw) : null;

  // Normalise position value to the internal slug format (e.g. "First Half Closer" → "first-half-closer")
  const positionRaw = String(row.position || '').trim().toLowerCase().replace(/\s+/g, '-');
  const position = VALID_POSITIONS.includes(positionRaw) ? positionRaw : null;

  return {
    id: `r-${Date.now()}-${index}`,
    title,
    students,
    act,
    position,
    style: (row.style || '').trim(),
    level: (row.level || '').trim(),
  };
}

/**
 * Return a sample CSV string for the "Download Template" button.
 * Shows the expected column names and a few example rows.
 */
export function getSampleCSV() {
  return `title,students,act,position,style,level
Opening Number,Alice;Bob;Carol,1,opening,Ballet,Advanced
Hip Hop Crew,Dave;Eve,1,,Hip-Hop,Intermediate
Tap Trio,Frank;Grace;Henry,,,,Tap,Beginner
Jazz Quartet,Irene;Jack;Karen;Liam,2,,Jazz,Advanced
Finale Number,Alice;Dave;Frank;Irene,2,finale,Contemporary,Advanced
`;
}
