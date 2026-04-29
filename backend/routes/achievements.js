const express = require('express');
const pool = require('../db');
const auth = require('../middleware/auth');

const router = express.Router();
router.use(auth);

// GET /api/achievements
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.execute(
      'SELECT achievement_id, unlocked_at FROM achievements WHERE user_id = ? ORDER BY unlocked_at DESC',
      [req.user.id]
    );
    res.json(rows);
  } catch (err) {
    console.error('GET /api/achievements:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/achievements/:achievementId
router.post('/:achievementId', async (req, res) => {
  try {
    await pool.execute(
      'INSERT IGNORE INTO achievements (user_id, achievement_id) VALUES (?, ?)',
      [req.user.id, req.params.achievementId]
    );
    res.status(201).json({ ok: true });
  } catch (err) {
    console.error('POST /api/achievements/:achievementId:', err.message);
    res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

module.exports = router;
