const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

function parseJSON(val) {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return val; }
}

// GET /api/weights
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT exercise_id, working_weight, max_weight, max_date, note, history, updated_at FROM exercise_weights WHERE user_id = ?',
      [req.user.id]
    );
    const weights = rows.map(r => ({ ...r, history: parseJSON(r.history) }));
    res.json(weights);
  } catch (err) {
    console.error('GET /api/weights:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/weights/:exerciseId  (upsert)
router.put('/:exerciseId', async (req, res) => {
  const { working_weight, max_weight, max_date, note, history } = req.body;
  const { exerciseId } = req.params;
  try {
    await pool.execute(
      `INSERT INTO exercise_weights (user_id, exercise_id, working_weight, max_weight, max_date, note, history)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         working_weight = VALUES(working_weight),
         max_weight     = VALUES(max_weight),
         max_date       = VALUES(max_date),
         note           = VALUES(note),
         history        = VALUES(history)`,
      [
        req.user.id,
        exerciseId,
        working_weight ?? null,
        max_weight ?? null,
        max_date ?? null,
        note ?? null,
        history ? JSON.stringify(history) : null,
      ]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/weights/:exerciseId:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
