const { body, param, validationResult } = require('express-validator');

// Middleware для проверки результатов валидации
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Валидация для создания транзакции (админ)
const validateDonation = [
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Сумма должна быть положительным числом'),
  body('campaign_id')
    .isInt()
    .withMessage('ID сбора должен быть числом'),
  body('donor_email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Неверный формат email'),
  body('is_anonymous')
    .optional()
    .isBoolean()
    .withMessage('is_anonymous должен быть boolean'),
  validate
];

// Валидация для публичных пожертвований
const validatePublicDonation = [
  body('amount')
    .isFloat({ min: 100 })
    .withMessage('Минимальная сумма пожертвования — 100₽'),
  body('campaign_id')
    .isInt()
    .withMessage('Выберите сбор'),
  body('donor_name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .escape()
    .withMessage('Имя слишком длинное'),
  body('donor_email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Неверный формат email'),
  body('is_anonymous')
    .optional()
    .isBoolean(),
  validate
];

// Валидация для создания сбора
const validateCampaign = [
  body('title')
    .trim()
    .isLength({ min: 5, max: 200 })
    .withMessage('Название должно быть от 5 до 200 символов')
    .escape(),
  body('description')
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Описание должно быть от 20 до 5000 символов'),
  body('goal_amount')
    .isFloat({ min: 100 })
    .withMessage('Целевая сумма должна быть не менее 100₽'),
  body('is_active')
    .optional()
    .custom((value) => {
      // Принимаем boolean или строковые значения из FormData
      if (typeof value === 'boolean') return true;
      if (typeof value === 'string') {
        return ['true', 'false', 'on', 'off', '1', '0'].includes(value.toLowerCase());
      }
      return false;
    })
    .withMessage('is_active должен быть boolean'),
  body('end_date')
    .optional({ values: 'falsy' })
    .isISO8601()
    .withMessage('Неверный формат даты'),
  validate
];

// Валидация для создания отчета
const validateReport = [
  body('campaign_id')
    .isInt()
    .withMessage('ID сбора должен быть числом'),
  body('expense_date')
    .isISO8601()
    .withMessage('Неверный формат даты'),
  body('amount')
    .isFloat({ min: 1 })
    .withMessage('Сумма должна быть положительным числом'),
  body('description')
    .trim()
    .isLength({ min: 10, max: 1000 })
    .withMessage('Описание должно быть от 10 до 1000 символов'),
  validate
];

// Валидация для логина
const validateLogin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Неверный формат email'),
  body('password')
    .isLength({ min: 6 })
    .withMessage('Пароль должен быть не менее 6 символов'),
  validate
];

// Санирование HTML для защиты от XSS
const sanitizeHtml = (text) => {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

module.exports = {
  validate,
  validateDonation,
  validatePublicDonation,
  validateCampaign,
  validateReport,
  validateLogin,
  sanitizeHtml
};
