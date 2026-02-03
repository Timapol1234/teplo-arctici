const NodeCache = require('node-cache');

// Создаём кеш с проверкой каждые 60 секунд
const cache = new NodeCache({
  stdTTL: 300,           // По умолчанию 5 минут
  checkperiod: 60,       // Проверка устаревших ключей каждые 60 сек
  useClones: false       // Не клонировать объекты (быстрее)
});

// TTL для разных типов данных (в секундах)
const TTL = {
  STATISTICS: 300,       // 5 минут
  RECENT_DONATIONS: 60,  // 1 минута
  CAMPAIGNS: 900,        // 15 минут
  CAMPAIGN_DETAIL: 3600, // 1 час
  REPORTS: 1800,         // 30 минут
  AUDIT_STATS: 300       // 5 минут
};

// Ключи кеша
const KEYS = {
  STATISTICS: 'stats:donations',
  RECENT_DONATIONS: (limit) => `donations:recent:${limit}`,
  ACTIVE_CAMPAIGNS: 'campaigns:active',
  CAMPAIGN: (id) => `campaign:${id}`,
  CAMPAIGN_REPORTS: (id) => `reports:campaign:${id}`,
  AUDIT_STATS: (days) => `audit:stats:${days}`
};

/**
 * Получить данные из кеша или выполнить функцию и закешировать результат
 * @param {string} key - Ключ кеша
 * @param {Function} fetchFn - Функция для получения данных
 * @param {number} ttl - Время жизни в секундах
 */
async function getOrSet(key, fetchFn, ttl = TTL.STATISTICS) {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return { data: cached, fromCache: true };
  }

  const data = await fetchFn();
  cache.set(key, data, ttl);
  return { data, fromCache: false };
}

/**
 * Инвалидировать кеш по ключу или паттерну
 * @param {string|string[]} keys - Ключ или массив ключей
 */
function invalidate(keys) {
  if (Array.isArray(keys)) {
    keys.forEach(key => cache.del(key));
  } else {
    cache.del(keys);
  }
}

/**
 * Инвалидировать все ключи, содержащие подстроку
 * @param {string} pattern - Паттерн для поиска
 */
function invalidatePattern(pattern) {
  const keys = cache.keys();
  const matchingKeys = keys.filter(key => key.includes(pattern));
  matchingKeys.forEach(key => cache.del(key));
}

/**
 * Очистить весь кеш
 */
function flush() {
  cache.flushAll();
}

/**
 * Получить статистику кеша
 */
function getStats() {
  return cache.getStats();
}

// Инвалидация при изменении данных
const invalidateOnDonation = () => {
  invalidate(KEYS.STATISTICS);
  invalidate(KEYS.ACTIVE_CAMPAIGNS); // Явно инвалидируем активные кампании
  invalidatePattern('donations:recent');
  invalidatePattern('campaigns:'); // Обновляет current_amount в кампаниях
  invalidatePattern('campaign:');  // Инвалидируем детали отдельных кампаний
};

const invalidateOnCampaign = (campaignId = null) => {
  invalidate(KEYS.ACTIVE_CAMPAIGNS);
  if (campaignId) {
    invalidate(KEYS.CAMPAIGN(campaignId));
    invalidate(KEYS.CAMPAIGN_REPORTS(campaignId));
  }
  invalidatePattern('campaigns:');
};

const invalidateOnReport = (campaignId = null) => {
  if (campaignId) {
    invalidate(KEYS.CAMPAIGN_REPORTS(campaignId));
  }
  invalidatePattern('reports:');
};

module.exports = {
  cache,
  TTL,
  KEYS,
  getOrSet,
  invalidate,
  invalidatePattern,
  flush,
  getStats,
  invalidateOnDonation,
  invalidateOnCampaign,
  invalidateOnReport
};
