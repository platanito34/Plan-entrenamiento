require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const authRoutes        = require('./routes/auth');
const plansRoutes       = require('./routes/plans');
const sessionsRoutes    = require('./routes/sessions');
const weightsRoutes     = require('./routes/weights');
const progressRoutes    = require('./routes/progress');
const exercisesRoutes   = require('./routes/exercises');
const favoritesRoutes   = require('./routes/favorites');
const achievementsRoutes = require('./routes/achievements');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());
app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '2mb' }));

app.use('/api/auth',         authRoutes);
app.use('/api/plans',        plansRoutes);
app.use('/api/sessions',     sessionsRoutes);
app.use('/api/weights',      weightsRoutes);
app.use('/api/progress',     progressRoutes);
app.use('/api/exercises',    exercisesRoutes);
app.use('/api/favorites',    favoritesRoutes);
app.use('/api/achievements', achievementsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor arrancado en el puerto ${PORT}`);
});
