const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

const { publicLimiter, adminLimiter, loginLimiter } = require('../backend/middleware/rateLimiter');
const publicRoutes = require('../backend/routes/public');
const adminRoutes = require('../backend/routes/admin');
const verificationRoutes = require('../backend/routes/verification');

const app = express();

// Автоматическое применение миграций (один раз при первом запросе)
let migrationsApplied = false;
async function ensureMigrations() {
  if (migrationsApplied) return;
  migrationsApplied = true;
  try {
    const db = require('../backend/config/database');
    const checkCol = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'campaigns' AND column_name = 'category'
    `);
    if (checkCol.rows.length === 0) {
      await db.query(`ALTER TABLE campaigns ADD COLUMN category VARCHAR(20) DEFAULT 'general'`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category)`);
      await db.query(`CREATE INDEX IF NOT EXISTS idx_campaigns_active_category ON campaigns(is_active, category, created_at DESC)`);
      console.log('✅ Миграция: добавлена колонка category в campaigns');
    }
  } catch (error) {
    migrationsApplied = false; // Повторить при следующем запросе
    console.error('⚠️  Ошибка при выполнении миграций:', error.message);
  }
}

app.use(async (req, res, next) => {
  await ensureMigrations();
  next();
});

// Trust proxy for Vercel/cloud deployments (needed for rate limiting)
app.set('trust proxy', 1);

// Middleware для безопасности
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.tailwindcss.com"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https://images.unsplash.com", "https://*.unsplash.com", "https://res.cloudinary.com", "https://*.cloudinary.com"],
      connectSrc: ["'self'"],
      frameSrc: ["'none'"],
      objectSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: true,
  credentials: true
}));

// Compression
app.use(compression());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Статические файлы
app.use(express.static(path.join(__dirname, '../public')));

// API Routes с rate limiting
app.use('/api', publicLimiter, publicRoutes);
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin', adminLimiter, adminRoutes);
app.use('/api/verification', publicLimiter, verificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Обработка SPA маршрутов
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);
  res.status(err.status || 500).json({
    error: 'Внутренняя ошибка сервера'
  });
});

module.exports = app;
