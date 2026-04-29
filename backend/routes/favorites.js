const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/favorites
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT exercise_id, created_at FROM favorites WHERE user_id = ? ORDER BY created_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/favorites:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/favorites/:exerciseId
router.post('/:exerciseId', async (req, res) => {
  try {
    await pool.execute(
      'INSERT IGNORE INTO favorites (user_id, exercise_id) VALUES (?, ?)',
      [req.user.id, req.params.exerciseId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/favorites/:exerciseId:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// DELETE /api/favorites/:exerciseId
router.delete('/:exerciseId', async (req, res) => {
  try {
    await pool.execute(
      'DELETE FROM favorites WHERE user_id = ? AND exercise_id = ?',
      [req.user.id, req.params.exerciseId]
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/favorites/:exerciseId:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
