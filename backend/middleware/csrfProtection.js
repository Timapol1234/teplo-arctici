/**
 * CSRF Protection Middleware
 *
 * Для JWT-based API основная защита от CSRF не требуется, так как токены
 * передаются через заголовок Authorization, а не cookies.
 *
 * Этот middleware добавляет дополнительную защиту через проверку
 * Origin/Referer заголовков для state-changing запросов (POST, PUT, DELETE).
 */

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000'
].filter(Boolean);

/**
 * Проверяет Origin заголовок для защиты от CSRF
 */
function csrfProtection(req, res, next) {
  // Пропускаем GET, HEAD, OPTIONS запросы
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    return next();
  }

  // В development режиме можно отключить проверку
  if (process.env.NODE_ENV === 'development' && process.env.DISABLE_CSRF === 'true') {
    return next();
  }

  const origin = req.headers.origin;
  const referer = req.headers.referer;

  // Если есть Origin, проверяем его
  if (origin) {
    if (ALLOWED_ORIGINS.some(allowed => origin === allowed || origin.startsWith(allowed))) {
      return next();
    }
    console.warn(`CSRF Protection: Blocked request from origin: ${origin}`);
    return res.status(403).json({ error: 'Запрос заблокирован (недопустимый источник)' });
  }

  // Если нет Origin, проверяем Referer
  if (referer) {
    const refererUrl = new URL(referer);
    const refererOrigin = refererUrl.origin;

    if (ALLOWED_ORIGINS.some(allowed => refererOrigin === allowed || refererOrigin.startsWith(allowed))) {
      return next();
    }
    console.warn(`CSRF Protection: Blocked request from referer: ${referer}`);
    return res.status(403).json({ error: 'Запрос заблокирован (недопустимый источник)' });
  }

  // Если нет ни Origin, ни Referer - это может быть API клиент
  // Проверяем наличие Authorization заголовка
  if (req.headers.authorization) {
    // Запрос с JWT токеном - разрешаем
    return next();
  }

  // Публичные endpoints без авторизации (например, donations/public)
  // разрешаем только если они явно помечены
  if (req.csrfExempt) {
    return next();
  }

  console.warn('CSRF Protection: Request without Origin/Referer/Authorization');
  return res.status(403).json({ error: 'Запрос заблокирован (отсутствует источник)' });
}

/**
 * Middleware для пометки route как исключения из CSRF проверки
 */
function csrfExempt(req, res, next) {
  req.csrfExempt = true;
  next();
}

module.exports = { csrfProtection, csrfExempt };
