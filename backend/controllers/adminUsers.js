const bcrypt = require('bcrypt');
const db = require('../config/database');
const { auditLog, sanitizeForLog, AuditActions } = require('../utils/auditLog');

/**
 * Получить список всех администраторов
 */
async function getAllAdmins(req, res) {
  try {
    const { include_inactive } = req.query;

    let whereClause = '';
    if (include_inactive !== 'true') {
      whereClause = 'WHERE is_active = true';
    }

    const result = await db.query(
      `SELECT
        id,
        email,
        full_name,
        role,
        is_active,
        last_login,
        last_login_ip,
        created_by,
        created_at,
        updated_at
      FROM admins
      ${whereClause}
      ORDER BY created_at DESC`
    );

    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка при получении списка админов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Получить одного администратора по ID
 */
async function getAdminById(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        id,
        email,
        full_name,
        role,
        is_active,
        last_login,
        last_login_ip,
        created_by,
        created_at,
        updated_at
      FROM admins
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Администратор не найден' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка при получении админа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Создать нового администратора
 */
async function createAdmin(req, res) {
  try {
    const { email, password, full_name, role } = req.body;

    // Валидация
    if (!email || !password) {
      return res.status(400).json({ error: 'Email и пароль обязательны' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Пароль должен быть минимум 8 символов' });
    }

    // Проверяем уникальность email
    const existingAdmin = await db.query(
      'SELECT id FROM admins WHERE email = $1',
      [email.toLowerCase()]
    );

    if (existingAdmin.rows.length > 0) {
      return res.status(400).json({ error: 'Администратор с таким email уже существует' });
    }

    // Валидация роли
    const validRoles = ['admin', 'super_admin'];
    const adminRole = validRoles.includes(role) ? role : 'admin';

    // Хешируем пароль
    const passwordHash = await bcrypt.hash(password, 12);

    const result = await db.query(
      `INSERT INTO admins (email, password_hash, full_name, role, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email.toLowerCase(), passwordHash, full_name || null, adminRole, req.user.id]
    );

    const newAdmin = result.rows[0];

    // Логируем создание админа
    await auditLog({
      adminId: req.user.id,
      action: AuditActions.CREATE_ADMIN,
      resourceType: 'admin',
      resourceId: newAdmin.id,
      newValues: sanitizeForLog({ email, full_name, role: adminRole }),
      req
    });

    res.status(201).json({
      success: true,
      admin: newAdmin
    });
  } catch (error) {
    console.error('Ошибка при создании админа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Обновить администратора
 */
async function updateAdmin(req, res) {
  try {
    const { id } = req.params;
    const { email, password, full_name, role, is_active } = req.body;

    // Получаем текущие данные
    const checkResult = await db.query(
      'SELECT * FROM admins WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Администратор не найден' });
    }

    const oldAdmin = checkResult.rows[0];

    // Проверяем уникальность email, если он меняется
    if (email && email.toLowerCase() !== oldAdmin.email) {
      const existingAdmin = await db.query(
        'SELECT id FROM admins WHERE email = $1 AND id != $2',
        [email.toLowerCase(), id]
      );

      if (existingAdmin.rows.length > 0) {
        return res.status(400).json({ error: 'Администратор с таким email уже существует' });
      }
    }

    // Подготавливаем данные для обновления
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (email) {
      updates.push(`email = $${paramIndex++}`);
      values.push(email.toLowerCase());
    }

    if (password) {
      if (password.length < 8) {
        return res.status(400).json({ error: 'Пароль должен быть минимум 8 символов' });
      }
      const passwordHash = await bcrypt.hash(password, 12);
      updates.push(`password_hash = $${paramIndex++}`);
      values.push(passwordHash);
    }

    if (full_name !== undefined) {
      updates.push(`full_name = $${paramIndex++}`);
      values.push(full_name || null);
    }

    if (role !== undefined) {
      const validRoles = ['admin', 'super_admin'];
      if (validRoles.includes(role)) {
        updates.push(`role = $${paramIndex++}`);
        values.push(role);
      }
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex++}`);
      values.push(Boolean(is_active));
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'Нет данных для обновления' });
    }

    values.push(id);

    const result = await db.query(
      `UPDATE admins SET ${updates.join(', ')} WHERE id = $${paramIndex}
       RETURNING id, email, full_name, role, is_active, last_login, created_at, updated_at`,
      values
    );

    // Логируем обновление
    await auditLog({
      adminId: req.user.id,
      action: AuditActions.UPDATE_ADMIN,
      resourceType: 'admin',
      resourceId: parseInt(id),
      oldValues: sanitizeForLog({
        email: oldAdmin.email,
        full_name: oldAdmin.full_name,
        role: oldAdmin.role,
        is_active: oldAdmin.is_active
      }),
      newValues: sanitizeForLog({ email, full_name, role, is_active }),
      req
    });

    res.json({
      success: true,
      admin: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка при обновлении админа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

/**
 * Деактивировать администратора (мягкое удаление)
 */
async function deactivateAdmin(req, res) {
  try {
    const { id } = req.params;

    // Нельзя деактивировать самого себя
    if (parseInt(id) === req.user.id) {
      return res.status(400).json({ error: 'Нельзя деактивировать свой аккаунт' });
    }

    // Проверяем существование админа
    const checkResult = await db.query(
      'SELECT * FROM admins WHERE id = $1',
      [id]
    );

    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Администратор не найден' });
    }

    const admin = checkResult.rows[0];

    // Проверяем, не последний ли это super_admin
    if (admin.role === 'super_admin') {
      const superAdminCount = await db.query(
        'SELECT COUNT(*) FROM admins WHERE role = $1 AND is_active = true AND id != $2',
        ['super_admin', id]
      );

      if (parseInt(superAdminCount.rows[0].count) === 0) {
        return res.status(400).json({
          error: 'Нельзя деактивировать последнего супер-администратора'
        });
      }
    }

    // Деактивируем
    await db.query(
      'UPDATE admins SET is_active = false WHERE id = $1',
      [id]
    );

    // Логируем деактивацию
    await auditLog({
      adminId: req.user.id,
      action: AuditActions.DEACTIVATE_ADMIN,
      resourceType: 'admin',
      resourceId: parseInt(id),
      oldValues: { email: admin.email, is_active: true },
      newValues: { is_active: false },
      req
    });

    res.json({
      success: true,
      message: 'Администратор деактивирован'
    });
  } catch (error) {
    console.error('Ошибка при деактивации админа:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  getAllAdmins,
  getAdminById,
  createAdmin,
  updateAdmin,
  deactivateAdmin
};
