const db = require('../config/database');

/**
 * Получить список аудит логов с фильтрацией и пагинацией
 */
async function getAuditLogs(req, res) {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;

    // Фильтры
    const { action, admin_id, resource_type, date_from, date_to } = req.query;

    let whereClause = '';
    const params = [];
    let paramIndex = 1;

    const conditions = [];

    if (action) {
      conditions.push(`al.action = $${paramIndex++}`);
      params.push(action);
    }

    if (admin_id) {
      conditions.push(`al.admin_id = $${paramIndex++}`);
      params.push(parseInt(admin_id));
    }

    if (resource_type) {
      conditions.push(`al.resource_type = $${paramIndex++}`);
      params.push(resource_type);
    }

    if (date_from) {
      conditions.push(`al.created_at >= $${paramIndex++}`);
      params.push(date_from);
    }

    if (date_to) {
      conditions.push(`al.created_at <= $${paramIndex++}`);
      params.push(date_to);
    }

    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }

    // Основной запрос с пагинацией
    const result = await db.query(
      `SELECT
        al.id,
        al.admin_id,
        al.action,
        al.resource_type,
        al.resource_id,
        al.old_values,
        al.new_values,
        al.ip_address,
        al.user_agent,
        al.created_at,
        a.email as admin_email,
        a.full_name as admin_name
      FROM audit_logs al
      LEFT JOIN admins a ON al.admin_id = a.id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}`,
      [...params, limit, offset]
    );

    // Подсчет общего количества
    const countResult = await db.query(
      `SELECT COUNT(*) FROM audit_logs al ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    res.json({
      logs: result.rows,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Ошибка при получении аудит логов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Получить один аудит лог по ID
 */
async function getAuditLogById(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        al.*,
        a.email as admin_email,
        a.full_name as admin_name
      FROM audit_logs al
      LEFT JOIN admins a ON al.admin_id = a.id
      WHERE al.id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Запись не найдена' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка при получении аудит лога:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Получить статистику по действиям
 */
async function getAuditStats(req, res) {
  try {
    // Безопасная валидация: только целые числа от 1 до 365
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365);

    // Статистика по типам действий (используем параметризованный запрос)
    const actionStats = await db.query(
      `SELECT action, COUNT(*) as count
       FROM audit_logs
       WHERE created_at >= NOW() - make_interval(days => $1)
       GROUP BY action
       ORDER BY count DESC`,
      [days]
    );

    // Статистика по админам
    const adminStats = await db.query(
      `SELECT
        a.email,
        a.full_name,
        COUNT(al.id) as actions_count
      FROM audit_logs al
      JOIN admins a ON al.admin_id = a.id
      WHERE al.created_at >= NOW() - make_interval(days => $1)
      GROUP BY a.id, a.email, a.full_name
      ORDER BY actions_count DESC
      LIMIT 10`,
      [days]
    );

    // Активность по дням
    const dailyActivity = await db.query(
      `SELECT
        DATE(created_at) as date,
        COUNT(*) as count
      FROM audit_logs
      WHERE created_at >= NOW() - make_interval(days => $1)
      GROUP BY DATE(created_at)
      ORDER BY date DESC`,
      [days]
    );

    res.json({
      period_days: days,
      by_action: actionStats.rows,
      by_admin: adminStats.rows,
      daily_activity: dailyActivity.rows
    });
  } catch (error) {
    console.error('Ошибка при получении статистики аудита:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  getAuditLogs,
  getAuditLogById,
  getAuditStats
};
