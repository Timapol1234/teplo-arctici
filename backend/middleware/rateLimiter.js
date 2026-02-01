const rateLimit = require('express-rate-limit');

// Ограничение для публичных API
const publicLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 минут
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 запросов
  message: 'Слишком много запросов с этого IP, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

// Более строгое ограничение для админ API
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Слишком много попыток авторизации, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

// Ограничение для login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5, // Только 5 попыток входа за 15 минут
  message: 'Слишком много попыток входа, попробуйте позже',
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = {
  publicLimiter,
  adminLimiter,
  loginLimiter
};
