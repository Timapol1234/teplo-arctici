const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { Pool } = require('pg');
require('dotenv').config();

// Проверка надежности пароля
function checkPasswordStrength(password) {
  const issues = [];

  if (password.length < 10) {
    issues.push('Пароль должен быть минимум 10 символов');
  }
  if (!/[A-Z]/.test(password)) {
    issues.push('Пароль должен содержать заглавные буквы');
  }
  if (!/[a-z]/.test(password)) {
    issues.push('Пароль должен содержать строчные буквы');
  }
  if (!/[0-9]/.test(password)) {
    issues.push('Пароль должен содержать цифры');
  }
  if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
    issues.push('Рекомендуется добавить спецсимволы (!@#$%^&*)');
  }

  // Проверка на известные слабые пароли
  const weakPasswords = ['admin123', 'password', '123456', 'admin', 'qwerty', 'change_this'];
  if (weakPasswords.some(weak => password.toLowerCase().includes(weak))) {
    issues.push('Пароль содержит известную слабую комбинацию');
  }

  return issues;
}

// Генерация случайного пароля
function generateSecurePassword() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*';
  let password = '';
  const randomBytes = crypto.randomBytes(16);
  for (let i = 0; i < 16; i++) {
    password += chars[randomBytes[i] % chars.length];
  }
  return password;
}

async function initDatabase() {
  console.log('');
  console.log('╔════════════════════════════════════════════╗');
  console.log('║   🗄️  Инициализация базы данных PostgreSQL ║');
  console.log('╚════════════════════════════════════════════╝');
  console.log('');

  if (!process.env.DATABASE_URL) {
    console.error('❌ Ошибка: DATABASE_URL не установлен в .env');
    console.error('');
    console.error('Пример для локального PostgreSQL:');
    console.error('DATABASE_URL=postgresql://user:password@localhost:5432/teplo_arctici');
    console.error('');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    // Проверяем подключение
    await pool.query('SELECT NOW()');
    console.log('✅ Подключение к PostgreSQL успешно');

    // Читаем SQL схему
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Выполняем SQL схему
    await pool.query(schema);
    console.log('✅ Схема базы данных создана');

    // Настройки администратора
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@teplo-arctici.ru';
    let adminPassword = process.env.ADMIN_PASSWORD;
    let passwordGenerated = false;

    // Если пароль не задан или это дефолтный - генерируем новый
    if (!adminPassword || adminPassword === 'admin123' || adminPassword.includes('CHANGE_THIS')) {
      adminPassword = generateSecurePassword();
      passwordGenerated = true;
      console.log('');
      console.log('⚠️  Пароль не задан в .env - сгенерирован автоматически');
    } else {
      // Проверяем надежность заданного пароля
      const passwordIssues = checkPasswordStrength(adminPassword);
      if (passwordIssues.length > 0) {
        console.log('');
        console.log('⚠️  ПРЕДУПРЕЖДЕНИЯ О ПАРОЛЕ:');
        passwordIssues.forEach(issue => console.log(`   - ${issue}`));

        if (process.env.NODE_ENV === 'production') {
          console.error('');
          console.error('❌ В production режиме требуется надежный пароль!');
          await pool.end();
          process.exit(1);
        }
      }
    }

    const passwordHash = await bcrypt.hash(adminPassword, 12);

    // Создаем или обновляем администратора с ролью super_admin
    await pool.query(
      `INSERT INTO admins (email, password_hash, full_name, role, is_active)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (email) DO UPDATE SET password_hash = $2, full_name = $3, role = $4, is_active = $5`,
      [adminEmail, passwordHash, 'Администратор', 'super_admin', true]
    );
    console.log('✅ Супер-администратор создан/обновлен');

    console.log('');
    console.log('┌─────────────────────────────────────────────┐');
    console.log('│  🔐 ДАННЫЕ ДЛЯ ВХОДА В АДМИН-ПАНЕЛЬ        │');
    console.log('├─────────────────────────────────────────────┤');
    console.log(`│  📧 Email:  ${adminEmail.padEnd(30)}│`);
    console.log(`│  🔑 Пароль: ${adminPassword.padEnd(30)}│`);
    console.log('└─────────────────────────────────────────────┘');

    if (passwordGenerated) {
      console.log('');
      console.log('📝 СОХРАНИТЕ ЭТОТ ПАРОЛЬ! Он не будет показан снова.');
      console.log('   Рекомендуется добавить его в .env файл:');
      console.log(`   ADMIN_PASSWORD=${adminPassword}`);
    }

    console.log('');
    console.log('⚠️  ВАЖНО: Смените пароль после первого входа!');
    console.log('');
    console.log('🎉 Инициализация завершена успешно!');
    console.log('');

    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Ошибка при инициализации базы данных:', error.message);
    await pool.end();
    process.exit(1);
  }
}

initDatabase();
