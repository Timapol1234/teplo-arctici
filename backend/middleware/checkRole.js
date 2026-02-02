/**
 * Middleware для проверки роли администратора
 * @param {...string} allowedRoles - Разрешенные роли
 */
function checkRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const userRole = req.user.role || 'admin';

    if (!allowedRoles.includes(userRole)) {
      return res.status(403).json({
        error: 'Недостаточно прав для выполнения этого действия'
      });
    }

    next();
  };
}

/**
 * Middleware для проверки роли super_admin
 */
const requireSuperAdmin = checkRole('super_admin');

/**
 * Middleware, разрешающий доступ любому авторизованному админу
 */
const requireAdmin = checkRole('admin', 'super_admin');

module.exports = {
  checkRole,
  requireSuperAdmin,
  requireAdmin
};
