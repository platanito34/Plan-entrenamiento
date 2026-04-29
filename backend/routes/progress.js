const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/progress
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, date, weight, height, chest, waist, hips, bicep_right, bicep_left, thigh_right, thigh_left, created_at FROM body_progress WHERE user_id = ? ORDER BY date DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/progress:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/progress
router.post('/', async (req, res) => {
  const { date, weight, height, chest, waist, hips, bicep_right, bicep_left, thigh_right, thigh_left } = req.body;
  if (!date) {
    return res.status(400).json({ error: 'El campo date es obligatorio.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO body_progress (user_id, date, weight, height, chest, waist, hips, bicep_right, bicep_left, thigh_right, thigh_left) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [
        req.user.id, date,
        weight ?? null, height ?? null,
        chest ?? null, waist ?? null, hips ?? null,
        bicep_right ?? null, bicep_left ?? null,
        thigh_right ?? null, thigh_left ?? null,
      ]
    );
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    console.error('POST /api/progress:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/progress/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM body_progress WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Registro no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/progress/:id:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
