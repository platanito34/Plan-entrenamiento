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

// GET /api/sessions
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, plan_id, plan_name, day_label, muscles, duration_minutes, notes, exercises, completed_at FROM sessions WHERE user_id = ? ORDER BY completed_at DESC',
      [req.user.id]
    );
    const sessions = rows.map(r => ({
      ...r,
      muscles: parseJSON(r.muscles),
      exercises: parseJSON(r.exercises),
    }));
    res.json(sessions);
  } catch (err) {
    console.error('GET /api/sessions:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/sessions
router.post('/', async (req, res) => {
  const { plan_id, plan_name, day_label, muscles, duration_minutes, notes, exercises } = req.body;
  if (!exercises) {
    return res.status(400).json({ error: 'El campo exercises es obligatorio.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO sessions (user_id, plan_id, plan_name, day_label, muscles, duration_minutes, notes, exercises) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.id,
        plan_id || null,
        plan_name || null,
        day_label || null,
        muscles ? JSON.stringify(muscles) : null,
        duration_minutes || null,
        notes || null,
        JSON.stringify(exercises),
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('POST /api/sessions:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
