const db = require('../config/database');
const { generateDailyHash, verifyDailyHash } = require('../utils/crypto');

// Middleware для проверки, включена ли верификация
async function checkVerificationEnabled(req, res, next) {
  try {
    const result = await db.query(
      "SELECT value FROM settings WHERE key = 'verification_enabled'"
    );

    if (result.rows.length === 0 || result.rows[0].value !== 'true') {
      return res.status(404).json({ error: 'Система верификации отключена' });
    }

    next();
  } catch (error) {
    console.error('Ошибка при проверке настроек верификации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить хеш за конкретную дату
async function getHashByDate(req, res) {
  try {
    const { date } = req.params;

    const result = await db.query(
      'SELECT * FROM daily_hashes WHERE date = $1',
      [date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Хеш за эту дату не найден' });
    }

    res.json({
      date: result.rows[0].date,
      hash: result.rows[0].hash,
      transactions_count: result.rows[0].transactions_count,
      created_at: result.rows[0].created_at
    });
  } catch (error) {
    console.error('Ошибка при получении хеша:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить транзакции за дату в CSV формате
async function getTransactionsCSV(req, res) {
  try {
    const { date } = req.params;

    const result = await db.query(
      `SELECT
        id,
        campaign_id,
        amount,
        created_at as timestamp
      FROM donations
      WHERE DATE(created_at) = $1 AND status = 'completed'
      ORDER BY id`,
      [date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Транзакций за эту дату не найдено' });
    }

    // Формируем CSV
    let csv = 'ID,Campaign ID,Amount,Timestamp\n';
    result.rows.forEach(row => {
      csv += `${row.id},${row.campaign_id},${row.amount},${row.timestamp}\n`;
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="transactions_${date}.csv"`);
    res.send(csv);
  } catch (error) {
    console.error('Ошибка при получении транзакций:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Сгенерировать хеш за конкретную дату (админ)
async function generateHashForDate(req, res) {
  try {
    const { date } = req.body;

    // Получаем все транзакции за день
    const result = await db.query(
      `SELECT
        id,
        amount,
        created_at as timestamp,
        campaign_id
      FROM donations
      WHERE DATE(created_at) = $1 AND status = 'completed'
      ORDER BY id`,
      [date]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Транзакций за эту дату не найдено' });
    }

    // Генерируем хеш
    const hash = generateDailyHash(result.rows);

    // Сохраняем в базу
    await db.query(
      `INSERT INTO daily_hashes (date, hash, transactions_count)
       VALUES ($1, $2, $3)
       ON CONFLICT (date) DO UPDATE
       SET hash = $2, transactions_count = $3`,
      [date, hash, result.rows.length]
    );

    res.json({
      success: true,
      date,
      hash,
      transactions_count: result.rows.length
    });
  } catch (error) {
    console.error('Ошибка при генерации хеша:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить все хеши
async function getAllHashes(req, res) {
  try {
    const result = await db.query(
      'SELECT * FROM daily_hashes ORDER BY date DESC'
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении всех хешей:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Переключить систему верификации (админ)
async function toggleVerification(req, res) {
  try {
    const { enabled } = req.body;

    await db.query(
      `UPDATE settings
       SET value = $1
       WHERE key = 'verification_enabled'`,
      [enabled ? 'true' : 'false']
    );

    res.json({
      success: true,
      verification_enabled: enabled
    });
  } catch (error) {
    console.error('Ошибка при переключении верификации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить статус верификации
async function getVerificationStatus(req, res) {
  try {
    const result = await db.query(
      "SELECT value FROM settings WHERE key = 'verification_enabled'"
    );

    const enabled = result.rows.length > 0 && result.rows[0].value === 'true';

    res.json({ verification_enabled: enabled });
  } catch (error) {
    console.error('Ошибка при получении статуса верификации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  checkVerificationEnabled,
  getHashByDate,
  getTransactionsCSV,
  generateHashForDate,
  getAllHashes,
  toggleVerification,
  getVerificationStatus
};
