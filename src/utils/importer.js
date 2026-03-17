import Papa from 'papaparse';

/**
 * Returns true if the header list looks like a Dance Studio Pro enrollment export.
 * DSP exports one row per student with separate first/last name and class name columns.
 */
function isDSPFormat(headers) {
  const h = new Set(headers);
  return (h.has('first name') || h.has('firstname')) &&
         (h.has('last name') || h.has('lastname')) &&
         (h.has('class name') || h.has('classname') || h.has('class'));
}

/**
 * Parse rows from a Dance Studio Pro enrollment export.
 * Groups by class name and aggregates student full names.
 */
function parseDSPRows(data) {
  const classMap = new Map(); // class name → { title, style, level, students[] }

  for (const row of data) {
    const firstName = (row['first name'] || row['firstname'] || '').trim();
    const lastName  = (row['last name']  || row['lastname']  || '').trim();
    const fullName  = [firstName, lastName].filter(Boolean).join(' ');

    const className = (row['class name'] || row['classname'] || row['class'] || '').trim();
    if (!className) continue;

    if (!classMap.has(className)) {
      const style = (
        row['dance style'] || row['class style'] || row['style'] || ''
      ).trim();
      const level = (row['class level'] || row['level'] || '').trim();
      classMap.set(className, { title: className, style, level, students: [] });
    }

    if (fullName) classMap.get(className).students.push(fullName);
  }

  return Array.from(classMap.values()).map((entry, i) => ({
    id: `r-${Date.now()}-${i}`,
    title: entry.title,
    students: entry.students,
    act: null,
    position: null,
    style: entry.style,
    level: entry.level,
  }));
}

/**
 * Parse a CSV file into Routine objects.
 * Supports two formats:
 *   - Native format: one row per routine with columns title, students, act, position, style, level
 *   - Dance Studio Pro (DSP): one row per student enrollment with columns
 *     First Name, Last Name, Class Name, Style, Level (rows grouped by class)
 */
export function parseCSV(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: h => h.trim().toLowerCase(),
      complete: ({ data, meta }) => {
        try {
          if (isDSPFormat(meta.fields)) {
            resolve(parseDSPRows(data));
          } else {
            const routines = data.map((row, i) => parseRow(row, i));
            resolve(routines);
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
