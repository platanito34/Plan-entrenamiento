require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 3002;

app.use(helmet());

app.use(cors({
  origin: process.env.ALLOWED_ORIGIN || 'http://localhost',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.use(express.json({ limit: '10kb' }));

app.use('/api/auth', authRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// 404 genérico — no revela rutas existentes
app.use((req, res) => {
  res.status(404).json({ error: 'Recurso no encontrado.' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error no controlado:', err.message);
  res.status(500).json({ error: 'Error interno del servidor.' });
});

app.listen(PORT, () => {
  console.log(`Servidor arrancado en el puerto ${PORT}`);
});
