const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const path = require('path');
require('dotenv').config();

const { publicLimiter, adminLimiter, loginLimiter } = require('./middleware/rateLimiter');
const { csrfProtection } = require('./middleware/csrfProtection');
const publicRoutes = require('./routes/public');
const adminRoutes = require('./routes/admin');
const verificationRoutes = require('./routes/verification');

const app = express();
const PORT = process.env.PORT || 3000;

// Проверка безопасности при запуске
function checkSecurityConfig() {
  const warnings = [];
  const errors = [];

  // Проверка JWT_SECRET
  if (!process.env.JWT_SECRET) {
    errors.push('JWT_SECRET не установлен в .env');
  } else if (process.env.JWT_SECRET.length < 32) {
    warnings.push('JWT_SECRET слишком короткий (рекомендуется 32+ символов)');
  } else if (process.env.JWT_SECRET.includes('change') || process.env.JWT_SECRET.includes('secret')) {
    warnings.push('JWT_SECRET похож на дефолтный - смените на случайный');
  }

  // В продакшн режиме ошибки критичны
  if (process.env.NODE_ENV === 'production') {
    if (errors.length > 0) {
      console.error('\n❌ КРИТИЧЕСКИЕ ОШИБКИ БЕЗОПАСНОСТИ:');
      errors.forEach(e => console.error(`   - ${e}`));
      console.error('\nСервер не может быть запущен в production режиме.\n');
      process.exit(1);
    }
    if (warnings.length > 0) {
      console.warn('\n⚠️  ПРЕДУПРЕЖДЕНИЯ БЕЗОПАСНОСТИ:');
      warnings.forEach(w => console.warn(`   - ${w}`));
      console.warn('');
    }
  } else if (warnings.length > 0 || errors.length > 0) {
    console.warn('\n⚠️  Проблемы конфигурации (dev режим):');
    [...errors, ...warnings].forEach(m => console.warn(`   - ${m}`));
    console.warn('');
  }
}

checkSecurityConfig();

// Trust proxy for cloud deployments (needed for rate limiting behind reverse proxy)
if (process.env.NODE_ENV === 'production') {
  app.set('trust proxy', 1);
}

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
      upgradeInsecureRequests: process.env.NODE_ENV === 'production' ? [] : null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? process.env.FRONTEND_URL
    : '*',
  credentials: true
}));

// Compression
app.use(compression());

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логирование
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// Статические файлы
app.use(express.static(path.join(__dirname, '../public')));

// API Routes с rate limiting
app.use('/api', publicLimiter, publicRoutes);
app.use('/api/admin/login', loginLimiter);
app.use('/api/admin', adminLimiter, csrfProtection, adminRoutes);
app.use('/api/verification', publicLimiter, verificationRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Cache stats endpoint (admin only in production)
const { getStats: getCacheStats } = require('./utils/cache');
app.get('/api/admin/cache-stats', adminLimiter, (req, res) => {
  const stats = getCacheStats();
  res.json({
    hits: stats.hits,
    misses: stats.misses,
    keys: stats.keys,
    ksize: stats.ksize,
    vsize: stats.vsize,
    hitRate: stats.hits + stats.misses > 0
      ? ((stats.hits / (stats.hits + stats.misses)) * 100).toFixed(2) + '%'
      : '0%'
  });
});

// Обработка SPA маршрутов - возвращаем index.html для всех неизвестных путей
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Обработка ошибок
app.use((err, req, res, next) => {
  console.error('Ошибка сервера:', err);

  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Внутренняя ошибка сервера'
      : err.message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// Автоматическое применение миграций при старте
async function runMigrations() {
  try {
    const db = require('./config/database');
    // Проверяем наличие колонки category в campaigns
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
    console.error('⚠️  Ошибка при выполнении миграций:', error.message);
  }
}

runMigrations();

// Запуск сервера
app.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║     🔥 Тепло Арктики - Сервер запущен     ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');
  console.log(`🌐 Сервер: http://localhost:${PORT}`);
  console.log(`📊 API: http://localhost:${PORT}/api`);
  console.log(`🔧 Health: http://localhost:${PORT}/health`);
  console.log(`🔐 Admin API: http://localhost:${PORT}/api/admin`);
  console.log('');
  console.log(`⚙️  Режим: ${process.env.NODE_ENV || 'development'}`);
  console.log('');
  console.log('Нажмите Ctrl+C для остановки сервера');
  console.log('');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM получен. Завершение работы...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('\nSIGINT получен. Завершение работы...');
  process.exit(0);
});

module.exports = app;
