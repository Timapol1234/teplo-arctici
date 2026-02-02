const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('../config/database');
const { auditLog, sanitizeForLog, AuditActions } = require('../utils/auditLog');
const { validatePassword } = require('../utils/passwordValidator');

// Константы для блокировки аккаунта
const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MINUTES = 30;

// Авторизация администратора
async function login(req, res) {
  try {
    const { email, password } = req.body;

    // Находим администратора с полями блокировки
    const result = await db.query(
      `SELECT id, email, password_hash, full_name, role, is_active,
              failed_login_attempts, locked_until
       FROM admins WHERE email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      // Логируем неудачную попытку входа
      await auditLog({
        adminId: null,
        action: AuditActions.LOGIN_FAILED,
        resourceType: 'admin',
        newValues: { email },
        req
      });
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const admin = result.rows[0];

    // Проверяем, не заблокирован ли аккаунт
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      const remainingMinutes = Math.ceil((new Date(admin.locked_until) - new Date()) / 60000);
      await auditLog({
        adminId: admin.id,
        action: AuditActions.LOGIN_FAILED,
        resourceType: 'admin',
        resourceId: admin.id,
        newValues: { email, reason: 'Account locked' },
        req
      });
      return res.status(423).json({
        error: `Аккаунт временно заблокирован. Попробуйте через ${remainingMinutes} мин.`
      });
    }

    // Проверяем активен ли аккаунт
    if (admin.is_active === false) {
      await auditLog({
        adminId: admin.id,
        action: AuditActions.LOGIN_FAILED,
        resourceType: 'admin',
        resourceId: admin.id,
        newValues: { email, reason: 'Account deactivated' },
        req
      });
      return res.status(401).json({ error: 'Аккаунт деактивирован' });
    }

    // Проверяем пароль
    const passwordValid = await bcrypt.compare(password, admin.password_hash);

    if (!passwordValid) {
      // Увеличиваем счётчик неудачных попыток
      const newAttempts = (admin.failed_login_attempts || 0) + 1;
      let lockUntil = null;

      if (newAttempts >= MAX_LOGIN_ATTEMPTS) {
        // Блокируем аккаунт
        lockUntil = new Date(Date.now() + LOCKOUT_DURATION_MINUTES * 60 * 1000);
      }

      await db.query(
        'UPDATE admins SET failed_login_attempts = $1, locked_until = $2 WHERE id = $3',
        [newAttempts, lockUntil, admin.id]
      );

      await auditLog({
        adminId: admin.id,
        action: AuditActions.LOGIN_FAILED,
        resourceType: 'admin',
        resourceId: admin.id,
        newValues: {
          email,
          reason: 'Invalid password',
          attempts: newAttempts,
          locked: lockUntil ? true : false
        },
        req
      });

      if (lockUntil) {
        return res.status(423).json({
          error: `Слишком много неудачных попыток. Аккаунт заблокирован на ${LOCKOUT_DURATION_MINUTES} минут.`
        });
      }

      const remainingAttempts = MAX_LOGIN_ATTEMPTS - newAttempts;
      return res.status(401).json({
        error: `Неверный email или пароль. Осталось попыток: ${remainingAttempts}`
      });
    }

    // Успешный вход - сбрасываем счётчик и блокировку
    const ipAddress = req.headers['x-forwarded-for']?.split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.ip
      || null;

    await db.query(
      `UPDATE admins SET
        last_login = CURRENT_TIMESTAMP,
        last_login_ip = $1,
        failed_login_attempts = 0,
        locked_until = NULL
       WHERE id = $2`,
      [ipAddress, admin.id]
    );

    // Генерируем JWT токен
    const token = jwt.sign(
      {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role || 'admin'
      },
      process.env.JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '24h' }
    );

    // Логируем успешный вход
    await auditLog({
      adminId: admin.id,
      action: AuditActions.LOGIN_SUCCESS,
      resourceType: 'admin',
      resourceId: admin.id,
      req
    });

    res.json({
      success: true,
      token,
      admin: {
        id: admin.id,
        email: admin.email,
        full_name: admin.full_name,
        role: admin.role || 'admin'
      }
    });
  } catch (error) {
    console.error('Ошибка при авторизации:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Проверка токена
async function verifyToken(req, res) {
  try {
    // Токен уже проверен middleware, просто возвращаем данные пользователя
    res.json({
      success: true,
      user: req.user
    });
  } catch (error) {
    console.error('Ошибка при проверке токена:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Изменение пароля
async function changePassword(req, res) {
  try {
    const { old_password, new_password } = req.body;
    const userId = req.user.id;

    // Получаем текущий хеш пароля
    const result = await db.query(
      'SELECT password_hash FROM admins WHERE id = $1',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Пользователь не найден' });
    }

    // Проверяем старый пароль
    const passwordValid = await bcrypt.compare(old_password, result.rows[0].password_hash);

    if (!passwordValid) {
      return res.status(401).json({ error: 'Неверный текущий пароль' });
    }

    // Валидация нового пароля
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.isValid) {
      return res.status(400).json({
        error: `Новый пароль не соответствует требованиям: ${passwordValidation.errors.join(', ')}`
      });
    }

    // Хешируем новый пароль
    const newPasswordHash = await bcrypt.hash(new_password, 12);

    // Обновляем пароль
    await db.query(
      'UPDATE admins SET password_hash = $1 WHERE id = $2',
      [newPasswordHash, userId]
    );

    // Логируем смену пароля
    await auditLog({
      adminId: userId,
      action: AuditActions.PASSWORD_CHANGE,
      resourceType: 'admin',
      resourceId: userId,
      req
    });

    res.json({ success: true, message: 'Пароль успешно изменен' });
  } catch (error) {
    console.error('Ошибка при изменении пароля:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  login,
  verifyToken,
  changePassword
};
