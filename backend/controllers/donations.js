const db = require('../config/database');
const { encryptEmail, decryptEmail } = require('../utils/crypto');

// Получить последние пожертвования для live-ленты
async function getRecentDonations(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 20;

    const result = await db.query(
      `SELECT
        d.id,
        d.amount,
        d.is_anonymous,
        d.donor_email_encrypted,
        d.payment_method,
        d.created_at,
        c.title as campaign_title,
        c.id as campaign_id
      FROM donations d
      JOIN campaigns c ON d.campaign_id = c.id
      WHERE d.status = 'completed'
      ORDER BY d.created_at DESC
      LIMIT $1`,
      [limit]
    );

    // Формируем ответ с расшифрованными email (только для неанонимных)
    const donations = result.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      donor: row.is_anonymous
        ? 'Анонимный донор'
        : row.donor_email_encrypted
          ? decryptEmail(row.donor_email_encrypted)
          : 'Анонимный донор',
      campaign: row.campaign_title,
      campaign_id: row.campaign_id,
      payment_method: row.payment_method,
      timestamp: row.created_at
    }));

    res.json(donations);
  } catch (error) {
    console.error('Ошибка при получении пожертвований:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить статистику
async function getStatistics(req, res) {
  try {
    const result = await db.query(`
      SELECT
        COALESCE(SUM(amount), 0) as total_amount,
        COUNT(DISTINCT CASE WHEN NOT is_anonymous THEN donor_email_encrypted END) as unique_donors,
        COUNT(*) as total_donations
      FROM donations
      WHERE status = 'completed'
    `);

    const stats = result.rows[0];

    res.json({
      total_amount: parseFloat(stats.total_amount),
      unique_donors: parseInt(stats.unique_donors),
      total_donations: parseInt(stats.total_donations)
    });
  } catch (error) {
    console.error('Ошибка при получении статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Создать новое пожертвование (админ)
async function createDonation(req, res) {
  try {
    const { amount, campaign_id, donor_email, is_anonymous, payment_method } = req.body;

    // Проверяем существование сбора
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1',
      [campaign_id]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден' });
    }

    // Шифруем email, если он есть
    const encryptedEmail = (donor_email && !is_anonymous)
      ? encryptEmail(donor_email)
      : null;

    const result = await db.query(
      `INSERT INTO donations
       (campaign_id, amount, donor_email_encrypted, is_anonymous, payment_method, status)
       VALUES ($1, $2, $3, $4, $5, 'completed')
       RETURNING id, created_at`,
      [campaign_id, amount, encryptedEmail, is_anonymous || false, payment_method || 'manual']
    );

    res.status(201).json({
      success: true,
      donation: {
        id: result.rows[0].id,
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Ошибка при создании пожертвования:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить все пожертвования (админ)
async function getAllDonations(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    const result = await db.query(
      `SELECT
        d.id,
        d.amount,
        d.donor_email_encrypted,
        d.is_anonymous,
        d.payment_method,
        d.status,
        d.created_at,
        c.title as campaign_title,
        c.id as campaign_id
      FROM donations d
      JOIN campaigns c ON d.campaign_id = c.id
      ORDER BY d.created_at DESC
      LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    // Получаем общее количество
    const countResult = await db.query('SELECT COUNT(*) FROM donations');
    const total = parseInt(countResult.rows[0].count);

    const donations = result.rows.map(row => ({
      id: row.id,
      amount: parseFloat(row.amount),
      donor_email: row.is_anonymous || !row.donor_email_encrypted
        ? null
        : decryptEmail(row.donor_email_encrypted),
      is_anonymous: row.is_anonymous,
      campaign: row.campaign_title,
      campaign_id: row.campaign_id,
      payment_method: row.payment_method,
      status: row.status,
      created_at: row.created_at
    }));

    res.json({
      donations,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка при получении списка пожертвований:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Создать публичное пожертвование (для обычных пользователей)
async function createPublicDonation(req, res) {
  try {
    const { amount, campaign_id, donor_name, donor_email, is_anonymous } = req.body;

    // Проверяем существование и активность сбора
    const campaignCheck = await db.query(
      'SELECT id, title FROM campaigns WHERE id = $1 AND is_active = true',
      [campaign_id]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден или неактивен' });
    }

    // Шифруем email, если он есть и не анонимно
    const encryptedEmail = (donor_email && !is_anonymous)
      ? encryptEmail(donor_email)
      : null;

    const result = await db.query(
      `INSERT INTO donations
       (campaign_id, amount, donor_email_encrypted, is_anonymous, payment_method, status)
       VALUES ($1, $2, $3, $4, 'card', 'completed')
       RETURNING id, created_at`,
      [campaign_id, amount, encryptedEmail, is_anonymous || false]
    );

    res.status(201).json({
      success: true,
      message: 'Спасибо за ваше пожертвование!',
      donation: {
        id: result.rows[0].id,
        amount: amount,
        campaign: campaignCheck.rows[0].title,
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Ошибка при создании пожертвования:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  getRecentDonations,
  getStatistics,
  createDonation,
  createPublicDonation,
  getAllDonations
};
