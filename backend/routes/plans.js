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

// GET /api/plans
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, goal, days, data, created_at, updated_at FROM plans WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    const plans = rows.map(r => ({ ...r, data: parseJSON(r.data) }));
    res.json(plans);
  } catch (err) {
    console.error('GET /api/plans:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/plans
router.post('/', async (req, res) => {
  const { name, goal, days, data } = req.body;
  if (!name || !goal || !days || !data) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO plans (user_id, name, goal, days, data) VALUES (?, ?, ?, ?, ?)',
      [req.user.id, name, goal, days, JSON.stringify(data)]
    );
    res.status(201).json({ id: result.insertId, name, goal, days, data });
  } catch (err) {
    console.error('POST /api/plans:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/plans/:id
router.put('/:id', async (req, res) => {
  const { name, goal, days, data } = req.body;
  if (!name || !goal || !days || !data) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE plans SET name = ?, goal = ?, days = ?, data = ? WHERE id = ? AND user_id = ?',
      [name, goal, days, JSON.stringify(data), req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json({ id: Number(req.params.id), name, goal, days, data });
  } catch (err) {
    console.error('PUT /api/plans/:id:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/plans/:id
router.delete('/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM plans WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/plans/:id:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
