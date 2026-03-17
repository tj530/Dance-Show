import Papa from 'papaparse';

/**
 * Returns true if the header list looks like a Dance Studio Pro enrollment export.
 * DSP exports use columns: Name, Class, Teacher, Location, Room, Days & Time, Birthday, Age
 */
function isDSPFormat(headers) {
  // Lowercase before comparing — meta.fields may contain original-case headers
  const h = new Set(headers.map(x => x.trim().toLowerCase()));
  return h.has('name') && h.has('class') && h.has('teacher');
}

/**
 * Parse rows from a Dance Studio Pro enrollment export.
 *
 * DSP exports have multiple class sections in one file. Each section starts with
 * a repeated header row and ends with an "Average Age" summary row. Student rows
 * contain a full name in the "Name" column and the class name in the "Class" column.
 * This function groups rows by class name and collects student names.
 */
/**
 * @typedef {{ title: string, students: string[] }} DSPClass
 */

/**
 * Extract class objects from DSP rows (one entry per unique class name).
 * @returns {DSPClass[]}
 */
function parseDSPRows(data) {
  const classMap = new Map(); // preserves insertion order (class sequence)

  for (const row of data) {
    const nameVal = (row['name'] || '').trim();

    // Skip repeated header rows (Name, Class, Teacher … appear mid-file)
    if (nameVal.toLowerCase() === 'name') continue;

    // Skip "Average Age" summary rows
    const allValues = Object.values(row).join(' ').toLowerCase();
    if (allValues.includes('average age')) continue;

    const className = (row['class'] || '').trim();
    if (!nameVal || !className) continue;

    if (!classMap.has(className)) {
      classMap.set(className, { title: className, students: [] });
    }
    classMap.get(className).students.push(nameVal);
  }

  return Array.from(classMap.values());
}

/**
 * Expand DSP classes into Routine objects using per-class counts.
 * count=1 → one routine titled "ClassName"
 * count>1 → routines titled "ClassName 1", "ClassName 2", …
 * @param {DSPClass[]} classes
 * @param {Record<string,number>} counts  map of title → number of routines (1-3)
 * @returns {import('../types').Routine[]}
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
        act: null,
        position: null,
        style: '',
        level: '',
      });
    }
  });
  return routines;
}

/**
 * Parse a CSV file.
 * Returns one of:
 *   { isDSP: true,  classes: DSPClass[] }   — Dance Studio Pro export
 *   { isDSP: false, routines: Routine[] }   — native format
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
      complete: ({ data, meta }) => {
        try {
          // meta.fields may be original-case or post-transform depending on PapaParse version;
          // fall back to the first data row's keys (always post-transform) if needed
          const fields = (meta.fields && meta.fields.length)
            ? meta.fields
            : Object.keys(data[0] || {});
          if (isDSPFormat(fields)) {
            resolve({ isDSP: true, classes: parseDSPRows(data) });
          } else {
            resolve({ isDSP: false, routines: data.map((row, i) => parseRow(row, i)) });
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
 * Parse a JSON file (array of routine objects).
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

function normalizeKeys(obj) {
  const out = {};
  Object.entries(obj).forEach(([k, v]) => { out[k.toLowerCase().trim()] = v; });
  return out;
}

const VALID_POSITIONS = ['opening', 'finale', 'first-half-closer', 'second-half-opener'];

function parseRow(row, index) {
  const title = (row.title || row.name || '').trim();
  if (!title) throw new Error(`Row ${index + 1}: missing "title" column`);

  const studentsRaw = row.students || row.performers || row.dancers || '';
  const students = String(studentsRaw)
    .split(/[;,|]/)
    .map(s => s.trim())
    .filter(Boolean);

  const actRaw = String(row.act || '').trim();
  const act = ['1', '2'].includes(actRaw) ? Number(actRaw) : null;

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
 * Generate a sample CSV template string for download.
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
