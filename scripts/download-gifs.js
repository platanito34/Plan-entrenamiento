#!/usr/bin/env node
// ── scripts/download-gifs.js ───────────────────────────────────────────────────
// One-time script: downloads all exercise GIFs from ExerciseDB and saves them
// to assets/gifs/<exercise-id>.gif so the app works without any API at runtime.
//
// Usage:  node scripts/download-gifs.js
// Requires Node.js 18+ (built-in fetch) or Node 16 with node-fetch installed.

const https = require('https');
const fs    = require('fs');
const path  = require('path');

// ── Config ─────────────────────────────────────────────────────────────────────
const API_KEY  = 'cc4f9b7fd3msh0289c66cc0a8c18p1e36dbjsna4a05275eddc';
const API_HOST = 'exercisedb.p.rapidapi.com';
const DELAY_MS = 500;   // ms between API requests to avoid rate-limiting
const OUT_DIR  = path.join(__dirname, '..', 'assets', 'gifs');

// ── Exercise ID → ExerciseDB English search term ───────────────────────────────
const SEARCH_NAMES = {
  // Pecho
  'press-banca':           'barbell bench press',
  'press-inclinado':       'barbell incline bench press',
  'press-mancuernas':      'dumbbell bench press',
  'fondos':                'chest dip',
  'aperturas':             'dumbbell fly',
  'cruces-polea':          'cable crossover',
  // Espalda
  'peso-muerto':           'barbell deadlift',
  'dominadas':             'pull-up',
  'remo-barra':            'barbell row',
  'jalones':               'cable lat pulldown',
  'remo-mancuerna':        'dumbbell one arm row',
  'remo-polea':            'cable seated row',
  // Hombros
  'press-militar':         'barbell overhead press',
  'press-arnold':          'arnold press',
  'elev-laterales':        'dumbbell lateral raise',
  'pajaros':               'dumbbell rear lateral raise',
  'face-pulls':            'cable face pull',
  'elev-frontales':        'dumbbell front raise',
  // Bíceps
  'curl-barra':            'barbell curl',
  'curl-alterno':          'dumbbell alternate bicep curl',
  'curl-martillo':         'dumbbell hammer curl',
  'curl-concentrado':      'dumbbell concentration curl',
  'curl-polea':            'cable biceps bar',
  'curl-inclinado':        'dumbbell incline curl',
  // Tríceps
  'press-cerrado':         'barbell close grip bench press',
  'press-frances':         'ez barbell skull crusher',
  'extension-polea':       'cable triceps pushdown',
  'patada-triceps':        'dumbbell triceps kickback',
  'fondos-banco':          'bench dip',
  'extension-cabeza':      'dumbbell seated overhead triceps extension',
  // Cuádriceps
  'sentadilla':            'barbell squat',
  'prensa':                'leg press',
  'extension-cuad':        'leg extension',
  'sent-bulgara':          'dumbbell bulgarian split squat',
  'zancadas':              'dumbbell lunge',
  'hack-squat':            'barbell hack squat',
  // Isquiotibiales
  'peso-muerto-rumano':    'barbell romanian deadlift',
  'curl-tumbado':          'lying leg curl',
  'curl-sentado':          'seated leg curl',
  'buenos-dias':           'barbell good morning',
  'peso-muerto-sumo':      'barbell sumo deadlift',
  'nordic-curl':           'nordic hamstring curl',
  // Glúteos
  'hip-thrust':            'barbell hip thrust',
  'patada-polea':          'cable hip extension',
  'sent-sumo':             'sumo goblet squat',
  'zancada-inversa':       'dumbbell reverse lunge',
  'abduccion':             'hip abduction',
  'step-up':               'dumbbell step-up',
  // Gemelos
  'elev-talon-pie':        'calf raise',
  'elev-talon-sentado':    'seated calf raise',
  'elev-talon-prensa':     'leg press calf raise',
  'elev-talon-unipierna':  'single leg calf raise',
  'elev-mancuerna':        'dumbbell calf raise',
  'salto-cuerda':          'jump rope',
  // Abdominales
  'plancha':               'plank',
  'crunch-polea':          'cable crunch',
  'elev-piernas':          'hanging leg raise',
  'rueda-abd':             'ab wheel',
  'russian-twist':         'russian twist',
  'dead-bug':              'dead bug',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Makes an HTTPS GET request. Follows one level of redirects.
 * Returns { status, body: Buffer }.
 */
function httpsGet(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers }, res => {
      // Follow redirect
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        resolve(httpsGet(res.headers.location));
        res.resume();
        return;
      }
      const chunks = [];
      res.on('data', chunk => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
    });
    req.on('error', reject);
  });
}

// ── Main ───────────────────────────────────────────────────────────────────────
async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const entries  = Object.entries(SEARCH_NAMES);
  const total    = entries.length;
  let downloaded = 0;
  let skipped    = 0;

  console.log(`\nDescargando ${total} GIFs en ${OUT_DIR}\n`);

  for (let i = 0; i < entries.length; i++) {
    const [exerciseId, searchTerm] = entries[i];
    const outputPath = path.join(OUT_DIR, `${exerciseId}.gif`);
    const prefix     = `[${String(i + 1).padStart(2, '0')}/${total}] ${exerciseId}`;

    // Skip already-downloaded files (allows resuming interrupted runs)
    if (fs.existsSync(outputPath)) {
      console.log(`${prefix} — ya existe, omitido`);
      downloaded++;
      continue;
    }

    process.stdout.write(`${prefix}... `);

    try {
      // 1. Search the exercise by name
      const searchUrl = `https://${API_HOST}/exercises/name/${encodeURIComponent(searchTerm)}?limit=1&offset=0`;
      const { status, body } = await httpsGet(searchUrl, {
        'x-rapidapi-key':  API_KEY,
        'x-rapidapi-host': API_HOST,
      });

      if (status !== 200) {
        console.log(`HTTP ${status} — omitido`);
        skipped++;
      } else {
        const data   = JSON.parse(body.toString('utf8'));
        const gifUrl = Array.isArray(data) && data.length > 0 ? (data[0].gifUrl ?? null) : null;

        if (!gifUrl) {
          console.log(`no encontrado en la API — omitido`);
          skipped++;
        } else {
          // 2. Download the GIF binary
          const { body: gifData } = await httpsGet(gifUrl);
          fs.writeFileSync(outputPath, gifData);
          console.log(`✓  (${(gifData.length / 1024).toFixed(0)} KB)`);
          downloaded++;
        }
      }
    } catch (err) {
      console.log(`error: ${err.message} — omitido`);
      skipped++;
    }

    // Throttle — skip delay after the last entry
    if (i < entries.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  console.log(`\n──────────────────────────────────────────`);
  console.log(`Completado: ${downloaded} descargados / ${skipped} omitidos / ${total} total`);
  if (skipped > 0) {
    console.log(`Los ejercicios omitidos no mostrarán GIF en la app.`);
  }
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
