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

// GET /api/plans/active  — must be before /:id routes
router.get('/active', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, goal, days, data, week_days, is_active, created_at, updated_at FROM plans WHERE user_id = ? AND is_active = 1 LIMIT 1',
      [req.user.id]
    );
    if (rows.length === 0) return res.json(null);
    const r = rows[0];
    res.json({ ...r, data: parseJSON(r.data), week_days: parseJSON(r.week_days) });
  } catch (err) {
    console.error('GET /api/plans/active:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/plans
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, name, goal, days, data, week_days, is_active, created_at, updated_at FROM plans WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    const plans = rows.map(r => ({
      ...r,
      data:      parseJSON(r.data),
      week_days: parseJSON(r.week_days),
    }));
    res.json(plans);
  } catch (err) {
    console.error('GET /api/plans:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/plans
router.post('/', async (req, res) => {
  const { name, goal, days, data, week_days } = req.body;
  if (!name || !goal || !days || !data) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO plans (user_id, name, goal, days, data, week_days) VALUES (?, ?, ?, ?, ?, ?)',
      [req.user.id, name, goal, days, JSON.stringify(data), week_days ? JSON.stringify(week_days) : null]
    );
    res.status(201).json({
      id: result.insertId, name, goal, days, data,
      week_days: week_days || null, is_active: false,
    });
  } catch (err) {
    console.error('POST /api/plans:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/plans/:id/activate  — must be before /:id
router.put('/:id/activate', async (req, res) => {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.execute('UPDATE plans SET is_active = 0 WHERE user_id = ?', [req.user.id]);
    const [result] = await conn.execute(
      'UPDATE plans SET is_active = 1 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    await conn.commit();
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json({ ok: true, id: Number(req.params.id) });
  } catch (err) {
    await conn.rollback();
    console.error('PUT /api/plans/:id/activate:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  } finally {
    conn.release();
  }
});

// PUT /api/plans/:id/deactivate  — must be before /:id
router.put('/:id/deactivate', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'UPDATE plans SET is_active = 0 WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/plans/:id/deactivate:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/plans/:id
router.put('/:id', async (req, res) => {
  const { name, goal, days, data, week_days } = req.body;
  if (!name || !goal || !days || !data) {
    return res.status(400).json({ error: 'Faltan campos obligatorios.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE plans SET name = ?, goal = ?, days = ?, data = ?, week_days = ? WHERE id = ? AND user_id = ?',
      [name, goal, days, JSON.stringify(data), week_days ? JSON.stringify(week_days) : null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Plan no encontrado.' });
    res.json({ id: Number(req.params.id), name, goal, days, data, week_days: week_days || null });
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
