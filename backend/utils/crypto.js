const crypto = require('crypto');

/**
 * Генерация SHA-256 хеша для транзакций за день
 * @param {Array} transactions - Массив транзакций
 * @returns {string} - SHA-256 хеш
 */
function generateDailyHash(transactions) {
  if (!transactions || transactions.length === 0) {
    return null;
  }

  // Формируем строку из всех транзакций
  const dataString = transactions
    .map(t => `${t.id}|${t.amount}|${t.timestamp}|${t.campaign_id}`)
    .join('\n');

  // Вычисляем SHA-256 хеш
  const hash = crypto
    .createHash('sha256')
    .update(dataString)
    .digest('hex');

  return hash;
}

/**
 * Проверка хеша транзакций
 * @param {Array} transactions - Массив транзакций
 * @param {string} expectedHash - Ожидаемый хеш
 * @returns {boolean} - Результат проверки
 */
function verifyDailyHash(transactions, expectedHash) {
  const calculatedHash = generateDailyHash(transactions);
  return calculatedHash === expectedHash;
}

/**
 * Шифрование email донора (AES-256)
 * @param {string} email - Email адрес
 * @returns {string} - Зашифрованный email
 */
function encryptEmail(email) {
  if (!email) return null;

  const algorithm = 'aes-256-cbc';
  const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);
  const iv = crypto.randomBytes(16);

  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(email, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

/**
 * Расшифровка email донора
 * @param {string} encryptedEmail - Зашифрованный email
 * @returns {string} - Расшифрованный email
 */
function decryptEmail(encryptedEmail) {
  if (!encryptedEmail) return null;

  try {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.JWT_SECRET, 'salt', 32);

    const parts = encryptedEmail.split(':');
    if (parts.length !== 2) return null;

    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];

    const decipher = crypto.createDecipheriv(algorithm, key, iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  } catch (error) {
    console.error('Ошибка расшифровки email:', error.message);
    return null;
  }
}

module.exports = {
  generateDailyHash,
  verifyDailyHash,
  encryptEmail,
  decryptEmail
};
