#!/usr/bin/env node
/**
 * Скрипт подготовки к production деплою
 * Генерирует безопасные секреты и проверяет конфигурацию
 *
 * Использование: node scripts/setup-production.js
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(prompt) {
  return new Promise(resolve => rl.question(prompt, resolve));
}

function generateSecret(length = 64) {
  return crypto.randomBytes(length).toString('hex');
}

function generatePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

async function main() {
  console.log('');
  console.log('╔════════════════════════════════════════════════════╗');
  console.log('║   🚀 Подготовка к Production деплою                ║');
  console.log('║   Тепло Арктики (PostgreSQL)                       ║');
  console.log('╚════════════════════════════════════════════════════╝');
  console.log('');

  const envPath = path.join(__dirname, '..', '.env');

  // Проверяем существование .env
  if (fs.existsSync(envPath)) {
    console.log('📄 Найден существующий .env файл');
  } else {
    console.log('📄 .env файл не найден, будет создан новый');
  }

  console.log('');
  console.log('Этот скрипт сгенерирует безопасные секреты для production.');
  console.log('');

  const proceed = await question('Продолжить? (y/n): ');
  if (proceed.toLowerCase() !== 'y') {
    console.log('Отменено.');
    rl.close();
    process.exit(0);
  }

  console.log('');

  // Генерация секретов
  const jwtSecret = generateSecret(64);
  const sessionSecret = generateSecret(32);
  const adminPassword = generatePassword();

  // Запрос данных
  const adminEmail = await question('Email администратора (admin@teplo-arctici.ru): ') || 'admin@teplo-arctici.ru';
  const frontendUrl = await question('URL сайта (https://teplo-arctici.ru): ') || 'https://teplo-arctici.ru';
  const port = await question('Порт сервера (3000): ') || '3000';

  console.log('');
  console.log('📦 Настройка PostgreSQL');
  console.log('   Примеры DATABASE_URL:');
  console.log('   - Neon: postgresql://user:pass@ep-xxx.neon.tech/dbname?sslmode=require');
  console.log('   - Supabase: postgresql://postgres:pass@db.xxx.supabase.co:5432/postgres');
  console.log('   - Railway: postgresql://postgres:pass@xxx.railway.app:5432/railway');
  console.log('');

  const databaseUrl = await question('DATABASE_URL: ');

  if (!databaseUrl) {
    console.error('');
    console.error('❌ DATABASE_URL обязателен для production!');
    rl.close();
    process.exit(1);
  }

  // Формируем .env
  const envContent = `# ============================================
# PRODUCTION CONFIGURATION
# Сгенерировано: ${new Date().toISOString()}
# ============================================

# Режим работы
NODE_ENV=production
PORT=${port}

# URL фронтенда (для CORS)
FRONTEND_URL=${frontendUrl}

# ============================================
# БАЗА ДАННЫХ PostgreSQL
# ============================================

DATABASE_URL=${databaseUrl}

# ============================================
# БЕЗОПАСНОСТЬ (автоматически сгенерировано)
# ============================================

# JWT секрет (64 байта hex)
JWT_SECRET=${jwtSecret}

# Секрет сессии (32 байта hex)
SESSION_SECRET=${sessionSecret}

# ============================================
# АДМИНИСТРАТОР
# ============================================

ADMIN_EMAIL=${adminEmail}
ADMIN_PASSWORD=${adminPassword}

# ============================================
# RATE LIMITING
# ============================================

RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# ============================================
# ДОПОЛНИТЕЛЬНО
# ============================================

VERIFICATION_ENABLED=false
`;

  // Сохраняем
  fs.writeFileSync(envPath, envContent);

  console.log('');
  console.log('✅ Файл .env создан с безопасными настройками!');
  console.log('');
  console.log('┌─────────────────────────────────────────────────────┐');
  console.log('│  🔐 СОХРАНИТЕ ЭТИ ДАННЫЕ В НАДЕЖНОМ МЕСТЕ!         │');
  console.log('├─────────────────────────────────────────────────────┤');
  console.log(`│  📧 Admin Email:    ${adminEmail.padEnd(30)}│`);
  console.log(`│  🔑 Admin Password: ${adminPassword.padEnd(30)}│`);
  console.log('└─────────────────────────────────────────────────────┘');
  console.log('');
  console.log('📋 Следующие шаги:');
  console.log('   1. Сохраните пароль администратора');
  console.log('   2. Запустите: npm run db:init');
  console.log('   3. Запустите: npm start');
  console.log('');
  console.log('🔒 JWT_SECRET и SESSION_SECRET сохранены в .env');
  console.log('   Никогда не публикуйте этот файл!');
  console.log('');

  rl.close();
}

main().catch(err => {
  console.error('Ошибка:', err);
  rl.close();
  process.exit(1);
});
