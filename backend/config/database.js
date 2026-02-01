const { Pool } = require('pg');
require('dotenv').config();

// Создаём пул соединений с PostgreSQL
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

// Проверка подключения при старте
pool.on('connect', () => {
  console.log('📁 Подключено к PostgreSQL');
});

pool.on('error', (err) => {
  console.error('Ошибка PostgreSQL:', err);
});

// Функция для выполнения запросов
const query = async (sql, params = []) => {
  try {
    const result = await pool.query(sql, params);
    return result;
  } catch (error) {
    console.error('Database query error:', error);
    console.error('SQL:', sql);
    console.error('Params:', params);
    throw error;
  }
};

// Закрытие пула при завершении процесса
process.on('SIGINT', async () => {
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await pool.end();
  process.exit(0);
});

module.exports = {
  query,
  pool
};
