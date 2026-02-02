/**
 * Валидация сложности пароля
 * Требования: минимум 8 символов, заглавная буква, строчная буква, цифра, спецсимвол
 */
function validatePassword(password) {
  const errors = [];

  if (!password || password.length < 8) {
    errors.push('минимум 8 символов');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('хотя бы одна заглавная буква');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('хотя бы одна строчная буква');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('хотя бы одна цифра');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('хотя бы один спецсимвол (!@#$%^&*...)');
  }

  return {
    isValid: errors.length === 0,
    errors
  };
}

module.exports = { validatePassword };
