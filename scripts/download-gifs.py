#!/usr/bin/env python3
"""
One-time script: downloads all exercise GIFs from ExerciseDB and saves them
to assets/gifs/<exercise-id>.gif so the app works without any API at runtime.

Usage:  python scripts/download-gifs.py
Requires Python 3.6+ (uses only the standard library).
"""

import urllib.request
import urllib.error
import json
import os
import time

# ── Config ─────────────────────────────────────────────────────────────────────
API_KEY  = 'cc4f9b7fd3msh0289c66cc0a8c18p1e36dbjsna4a05275eddc'
API_HOST = 'exercisedb.p.rapidapi.com'
DELAY_S  = 0.5   # seconds between API requests to avoid rate-limiting
OUT_DIR  = os.path.join(os.path.dirname(__file__), '..', 'assets', 'gifs')

# ── Exercise ID → ExerciseDB English search term ───────────────────────────────
SEARCH_NAMES = {
    # Pecho
    'press-banca':          'barbell bench press',
    'press-inclinado':      'barbell incline bench press',
    'press-mancuernas':     'dumbbell bench press',
    'fondos':               'chest dip',
    'aperturas':            'dumbbell fly',
    'cruces-polea':         'cable crossover',
    # Espalda
    'peso-muerto':          'barbell deadlift',
    'dominadas':            'pull-up',
    'remo-barra':           'barbell row',
    'jalones':              'cable lat pulldown',
    'remo-mancuerna':       'dumbbell one arm row',
    'remo-polea':           'cable seated row',
    # Hombros
    'press-militar':        'barbell overhead press',
    'press-arnold':         'arnold press',
    'elev-laterales':       'dumbbell lateral raise',
    'pajaros':              'dumbbell rear lateral raise',
    'face-pulls':           'cable face pull',
    'elev-frontales':       'dumbbell front raise',
    # Bíceps
    'curl-barra':           'barbell curl',
    'curl-alterno':         'dumbbell alternate bicep curl',
    'curl-martillo':        'dumbbell hammer curl',
    'curl-concentrado':     'dumbbell concentration curl',
    'curl-polea':           'cable biceps bar',
    'curl-inclinado':       'dumbbell incline curl',
    # Tríceps
    'press-cerrado':        'barbell close grip bench press',
    'press-frances':        'ez barbell skull crusher',
    'extension-polea':      'cable triceps pushdown',
    'patada-triceps':       'dumbbell triceps kickback',
    'fondos-banco':         'bench dip',
    'extension-cabeza':     'dumbbell seated overhead triceps extension',
    # Cuádriceps
    'sentadilla':           'barbell squat',
    'prensa':               'leg press',
    'extension-cuad':       'leg extension',
    'sent-bulgara':         'dumbbell bulgarian split squat',
    'zancadas':             'dumbbell lunge',
    'hack-squat':           'barbell hack squat',
    # Isquiotibiales
    'peso-muerto-rumano':   'barbell romanian deadlift',
    'curl-tumbado':         'lying leg curl',
    'curl-sentado':         'seated leg curl',
    'buenos-dias':          'barbell good morning',
    'peso-muerto-sumo':     'barbell sumo deadlift',
    'nordic-curl':          'nordic hamstring curl',
    # Glúteos
    'hip-thrust':           'barbell hip thrust',
    'patada-polea':         'cable hip extension',
    'sent-sumo':            'sumo goblet squat',
    'zancada-inversa':      'dumbbell reverse lunge',
    'abduccion':            'hip abduction',
    'step-up':              'dumbbell step-up',
    # Gemelos
    'elev-talon-pie':       'calf raise',
    'elev-talon-sentado':   'seated calf raise',
    'elev-talon-prensa':    'leg press calf raise',
    'elev-talon-unipierna': 'single leg calf raise',
    'elev-mancuerna':       'dumbbell calf raise',
    'salto-cuerda':         'jump rope',
    # Abdominales
    'plancha':              'plank',
    'crunch-polea':         'cable crunch',
    'elev-piernas':         'hanging leg raise',
    'rueda-abd':            'ab wheel',
    'russian-twist':        'russian twist',
    'dead-bug':             'dead bug',
}


def api_get(search_term):
    """Call ExerciseDB search endpoint. Returns gifUrl string or None."""
    url = (
        f'https://{API_HOST}/exercises/name/'
        f'{urllib.parse.quote(search_term)}?limit=1&offset=0'
    )
    req = urllib.request.Request(url, headers={
        'x-rapidapi-key':  API_KEY,
        'x-rapidapi-host': API_HOST,
        'User-Agent':      'download-gifs/1.0',
    })
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = json.loads(resp.read().decode('utf-8'))
            if isinstance(data, list) and len(data) > 0:
                return data[0].get('gifUrl')
    except Exception:
        pass
    return None


def download_binary(url, dest_path):
    """Download any URL to dest_path. Returns size in bytes."""
    req = urllib.request.Request(url, headers={'User-Agent': 'download-gifs/1.0'})
    with urllib.request.urlopen(req, timeout=30) as resp:
        data = resp.read()
    with open(dest_path, 'wb') as f:
        f.write(data)
    return len(data)


def main():
    import urllib.parse  # needed inside api_get, ensure it's imported

    os.makedirs(OUT_DIR, exist_ok=True)

    entries    = list(SEARCH_NAMES.items())
    total      = len(entries)
    downloaded = 0
    skipped    = 0

    print(f'\nDescargando {total} GIFs en {os.path.abspath(OUT_DIR)}\n')

    for i, (exercise_id, search_term) in enumerate(entries):
        out_path = os.path.join(OUT_DIR, f'{exercise_id}.gif')
        label    = f'[{i+1:02d}/{total}] {exercise_id}'

        if os.path.exists(out_path):
            print(f'{label} — ya existe, omitido')
            downloaded += 1
            continue

        print(f'{label}... ', end='', flush=True)

        try:
            gif_url = api_get(search_term)
            if not gif_url:
                print('no encontrado en la API — omitido')
                skipped += 1
            else:
                size = download_binary(gif_url, out_path)
                print(f'✓  ({size // 1024} KB)')
                downloaded += 1
        except Exception as e:
            print(f'error: {e} — omitido')
            skipped += 1

        if i < total - 1:
            time.sleep(DELAY_S)

    print(f'\n──────────────────────────────────────────')
    print(f'Completado: {downloaded} descargados / {skipped} omitidos / {total} total')
    if skipped > 0:
        print('Los ejercicios omitidos no mostrarán GIF en la app.')


if __name__ == '__main__':
    import urllib.parse
    main()
