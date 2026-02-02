const db = require('../config/database');

/**
 * Типы действий для логирования
 */
const AuditActions = {
  // Auth actions
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  PASSWORD_CHANGE: 'PASSWORD_CHANGE',

  // Campaign actions
  CREATE_CAMPAIGN: 'CREATE_CAMPAIGN',
  UPDATE_CAMPAIGN: 'UPDATE_CAMPAIGN',
  DELETE_CAMPAIGN: 'DELETE_CAMPAIGN',

  // Donation actions
  CREATE_DONATION: 'CREATE_DONATION',

  // Report actions
  CREATE_REPORT: 'CREATE_REPORT',
  UPDATE_REPORT: 'UPDATE_REPORT',
  DELETE_REPORT: 'DELETE_REPORT',

  // Admin management actions
  CREATE_ADMIN: 'CREATE_ADMIN',
  UPDATE_ADMIN: 'UPDATE_ADMIN',
  DEACTIVATE_ADMIN: 'DEACTIVATE_ADMIN'
};

/**
 * Записывает действие в аудит лог
 * @param {Object} options - Параметры логирования
 * @param {number|null} options.adminId - ID администратора (null для неудачного входа)
 * @param {string} options.action - Тип действия (из AuditActions)
 * @param {string|null} options.resourceType - Тип ресурса (campaign, donation, report, admin)
 * @param {number|null} options.resourceId - ID ресурса
 * @param {Object|null} options.oldValues - Предыдущие значения (для update/delete)
 * @param {Object|null} options.newValues - Новые значения (для create/update)
 * @param {Object} options.req - Express request объект (для IP и User-Agent)
 * @returns {Promise<Object>} - Созданная запись лога
 */
async function auditLog({
  adminId = null,
  action,
  resourceType = null,
  resourceId = null,
  oldValues = null,
  newValues = null,
  req = null
}) {
  try {
    // Извлекаем IP и User-Agent из запроса
    let ipAddress = null;
    let userAgent = null;

    if (req) {
      // Поддержка прокси (X-Forwarded-For для Vercel и других)
      ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || req.ip
        || req.connection?.remoteAddress
        || null;

      userAgent = req.get('user-agent') || null;
    }

    const result = await db.query(
      `INSERT INTO audit_logs
       (admin_id, action, resource_type, resource_id, old_values, new_values, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, created_at`,
      [
        adminId,
        action,
        resourceType,
        resourceId,
        oldValues ? JSON.stringify(oldValues) : null,
        newValues ? JSON.stringify(newValues) : null,
        ipAddress,
        userAgent
      ]
    );

    return result.rows[0];
  } catch (error) {
    // Логируем ошибку, но не прерываем основную операцию
    console.error('Ошибка записи аудит лога:', error);
    return null;
  }
}

/**
 * Безопасно удаляет чувствительные поля из объекта для логирования
 * @param {Object} obj - Исходный объект
 * @param {string[]} sensitiveFields - Поля для удаления
 * @returns {Object} - Очищенный объект
 */
function sanitizeForLog(obj, sensitiveFields = ['password', 'password_hash', 'token', 'new_password', 'old_password']) {
  if (!obj || typeof obj !== 'object') return obj;

  const sanitized = { ...obj };
  sensitiveFields.forEach(field => {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  });

  return sanitized;
}

module.exports = {
  auditLog,
  sanitizeForLog,
  AuditActions
};
