const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const rateLimit = require('express-rate-limit');
const pool = require('../db');

const router = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Demasiados intentos. Inténtalo de nuevo en 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateToken(user) {
  return jwt.sign(
    { id: user.id, nombre: user.nombre, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado.' });
  }
  const token = header.split(' ')[1];
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Token inválido o expirado.' });
  }
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  const { nombre, email, password } = req.body;

  if (!nombre || !email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: 'Formato de email inválido.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    const [existing] = await pool.execute(
      'SELECT id FROM users WHERE email = ?',
      [email]
    );
    if (existing.length > 0) {
      return res.status(409).json({ error: 'El email ya está registrado.' });
    }

    const hash = await bcrypt.hash(password, 12);
    const [result] = await pool.execute(
      'INSERT INTO users (nombre, email, password) VALUES (?, ?, ?)',
      [nombre.trim(), email.toLowerCase().trim(), hash]
    );

    const token = generateToken({ id: result.insertId, nombre: nombre.trim(), email: email.toLowerCase().trim() });
    return res.status(201).json({ token, user: { id: result.insertId, nombre: nombre.trim(), email: email.toLowerCase().trim() } });
  } catch (err) {
    console.error('Error en /register:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Todos los campos son obligatorios.' });
  }

  try {
    const [rows] = await pool.execute(
      'SELECT id, nombre, email, password FROM users WHERE email = ?',
      [email.toLowerCase().trim()]
    );

    if (rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const user = rows[0];
    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: 'Credenciales incorrectas.' });
    }

    const token = generateToken({ id: user.id, nombre: user.nombre, email: user.email });
    return res.json({ token, user: { id: user.id, nombre: user.nombre, email: user.email } });
  } catch (err) {
    console.error('Error en /login:', err.message);
    return res.status(500).json({ error: 'Error interno del servidor.' });
  }
});

// GET /api/auth/verify
router.get('/verify', authMiddleware, (req, res) => {
  return res.json({ user: req.user });
});

module.exports = router;
