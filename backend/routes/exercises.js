const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/exercises/custom
router.get('/custom', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT id, exercise_id, name, muscle_group, description, note, working_weight, created_at FROM custom_exercises WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/exercises/custom:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/exercises/custom
router.post('/custom', async (req, res) => {
  const { exercise_id, name, muscle_group, description, note, working_weight } = req.body;
  if (!exercise_id || !name || !muscle_group) {
    return res.status(400).json({ error: 'exercise_id, name y muscle_group son obligatorios.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO custom_exercises (user_id, exercise_id, name, muscle_group, description, note, working_weight) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, exercise_id, name, muscle_group, description ?? null, note ?? null, working_weight ?? null]
    );
    res.status(201).json({ id: result.insertId, exercise_id, name, muscle_group });
  } catch (err) {
    console.error('POST /api/exercises/custom:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// PUT /api/exercises/custom/:id
router.put('/custom/:id', async (req, res) => {
  const { name, muscle_group, description, note, working_weight } = req.body;
  if (!name || !muscle_group) {
    return res.status(400).json({ error: 'name y muscle_group son obligatorios.' });
  }
  try {
    const [result] = await pool.execute(
      'UPDATE custom_exercises SET name = ?, muscle_group = ?, description = ?, note = ?, working_weight = ? WHERE id = ? AND user_id = ?',
      [name, muscle_group, description ?? null, note ?? null, working_weight ?? null, req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ejercicio no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('PUT /api/exercises/custom/:id:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/exercises/custom/:id
router.delete('/custom/:id', async (req, res) => {
  try {
    const [result] = await pool.execute(
      'DELETE FROM custom_exercises WHERE id = ? AND user_id = ?',
      [req.params.id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Ejercicio no encontrado.' });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/exercises/custom/:id:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
