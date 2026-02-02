// API для аудит логов
const AuditLogsAPI = {
  async getLogs(params = {}) {
    const queryParams = new URLSearchParams();
    if (params.page) queryParams.set('page', params.page);
    if (params.limit) queryParams.set('limit', params.limit);
    if (params.action) queryParams.set('action', params.action);
    if (params.resource_type) queryParams.set('resource_type', params.resource_type);
    if (params.date_from) queryParams.set('date_from', params.date_from);
    if (params.date_to) queryParams.set('date_to', params.date_to);

    const url = `/api/admin/audit-logs?${queryParams.toString()}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TokenManager.get()}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 401) {
      TokenManager.remove();
      window.location.href = '/admin/';
      throw new Error('Не авторизован');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    return data;
  },

  async getStats(days = 30) {
    const response = await fetch(`/api/admin/audit-logs/stats?days=${days}`, {
      headers: {
        'Authorization': `Bearer ${TokenManager.get()}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    return data;
  },

  async getLogById(id) {
    const response = await fetch(`/api/admin/audit-logs/${id}`, {
      headers: {
        'Authorization': `Bearer ${TokenManager.get()}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка сервера');
    }

    return data;
  }
};

// Маппинг действий на русский
const actionLabels = {
  LOGIN_SUCCESS: { label: 'Успешный вход', color: 'green' },
  LOGIN_FAILED: { label: 'Неудачный вход', color: 'red' },
  PASSWORD_CHANGE: { label: 'Смена пароля', color: 'blue' },
  CREATE_CAMPAIGN: { label: 'Создание кампании', color: 'green' },
  UPDATE_CAMPAIGN: { label: 'Изменение кампании', color: 'amber' },
  DELETE_CAMPAIGN: { label: 'Удаление кампании', color: 'red' },
  CREATE_DONATION: { label: 'Создание пожертвования', color: 'green' },
  CREATE_REPORT: { label: 'Создание отчета', color: 'green' },
  UPDATE_REPORT: { label: 'Изменение отчета', color: 'amber' },
  DELETE_REPORT: { label: 'Удаление отчета', color: 'red' },
  CREATE_ADMIN: { label: 'Создание админа', color: 'green' },
  UPDATE_ADMIN: { label: 'Изменение админа', color: 'amber' },
  DEACTIVATE_ADMIN: { label: 'Деактивация админа', color: 'red' }
};

const resourceLabels = {
  admin: 'Администратор',
  campaign: 'Кампания',
  donation: 'Пожертвование',
  report: 'Отчет'
};

// Состояние
let currentPage = 1;
const ITEMS_PER_PAGE = 30;
let currentFilters = {};

// Инициализация
document.addEventListener('DOMContentLoaded', async () => {
  if (!window.AdminAPI) {
    console.error('AdminAPI не загружен');
    return;
  }

  const isAuth = await checkAuth();
  if (!isAuth) return;

  initLogout();
  initThemeToggle();
  initEventListeners();

  await loadStats();
  await loadLogs();
});

// Инициализация обработчиков
function initEventListeners() {
  document.getElementById('apply-filters').addEventListener('click', applyFilters);
  document.getElementById('reset-filters').addEventListener('click', resetFilters);
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('details-modal').addEventListener('click', (e) => {
    if (e.target.id === 'details-modal') closeModal();
  });
}

// Загрузка статистики
async function loadStats() {
  try {
    const stats = await AuditLogsAPI.getStats(30);

    // Подсчёт по категориям
    let logins = 0;
    let creates = 0;
    let updates = 0;

    stats.by_action.forEach(item => {
      if (item.action.includes('LOGIN')) {
        logins += parseInt(item.count);
      } else if (item.action.includes('CREATE')) {
        creates += parseInt(item.count);
      } else if (item.action.includes('UPDATE') || item.action.includes('DELETE') || item.action.includes('DEACTIVATE')) {
        updates += parseInt(item.count);
      }
    });

    document.getElementById('stat-logins').textContent = logins;
    document.getElementById('stat-creates').textContent = creates;
    document.getElementById('stat-updates').textContent = updates;
  } catch (error) {
    console.error('Ошибка загрузки статистики:', error);
  }
}

// Загрузка логов
async function loadLogs(page = 1) {
  try {
    const params = {
      page,
      limit: ITEMS_PER_PAGE,
      ...currentFilters
    };

    const data = await AuditLogsAPI.getLogs(params);
    currentPage = page;

    renderLogs(data.logs);
    renderPagination(data.pagination);
  } catch (error) {
    UI.showError('Ошибка загрузки логов: ' + error.message);
    document.getElementById('logs-table').innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-red-500">
          <div class="flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-4xl">error</span>
            <p>Ошибка загрузки данных</p>
          </div>
        </td>
      </tr>
    `;
  }
}

// Отрисовка логов
function renderLogs(logs) {
  const tbody = document.getElementById('logs-table');

  if (logs.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-slate-500">
          <div class="flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-4xl">inbox</span>
            <p>Нет записей</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = logs.map(log => {
    const actionInfo = actionLabels[log.action] || { label: log.action, color: 'slate' };
    const resourceLabel = resourceLabels[log.resource_type] || log.resource_type || '-';

    const colorClasses = {
      green: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
      red: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
      amber: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
      blue: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
      slate: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400'
    };

    return `
      <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
        <td class="px-6 py-4">
          <div class="text-sm font-medium text-slate-900 dark:text-white">${UI.formatDateTime(log.created_at)}</div>
        </td>
        <td class="px-6 py-4">
          <div class="flex items-center gap-2">
            <div class="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center text-slate-500">
              <span class="material-symbols-outlined text-lg">person</span>
            </div>
            <div>
              <div class="text-sm font-medium text-slate-900 dark:text-white">${log.admin_name || 'Система'}</div>
              <div class="text-xs text-slate-500">${log.admin_email || '-'}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex py-1 px-2.5 rounded-full text-xs font-medium ${colorClasses[actionInfo.color]}">${actionInfo.label}</span>
        </td>
        <td class="px-6 py-4">
          <div class="text-sm text-slate-600 dark:text-slate-400">${resourceLabel}</div>
          ${log.resource_id ? `<div class="text-xs text-slate-400">ID: ${log.resource_id}</div>` : ''}
        </td>
        <td class="px-6 py-4">
          <div class="text-sm text-slate-500 font-mono">${log.ip_address || '-'}</div>
        </td>
        <td class="px-6 py-4 text-right">
          <button onclick="showDetails(${log.id})" class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors" title="Подробнее">
            <span class="material-symbols-outlined text-lg">visibility</span>
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Отрисовка пагинации
function renderPagination(pagination) {
  const info = document.getElementById('pagination-info');
  const controls = document.getElementById('pagination-controls');

  const start = (pagination.page - 1) * pagination.limit + 1;
  const end = Math.min(pagination.page * pagination.limit, pagination.total);

  info.textContent = pagination.total > 0
    ? `Показано ${start}-${end} из ${pagination.total} записей`
    : 'Нет записей';

  if (pagination.pages <= 1) {
    controls.innerHTML = '';
    return;
  }

  let html = `
    <button data-page="${pagination.page - 1}"
            class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors disabled:opacity-50"
            ${pagination.page === 1 ? 'disabled' : ''}>
      <span class="material-symbols-outlined text-lg">chevron_left</span>
    </button>
  `;

  for (let i = 1; i <= pagination.pages; i++) {
    if (i === 1 || i === pagination.pages || (i >= pagination.page - 1 && i <= pagination.page + 1)) {
      html += `
        <button data-page="${i}"
                class="px-3 py-1 rounded text-xs font-bold ${i === pagination.page ? 'bg-primary text-white' : 'hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400'}">
          ${i}
        </button>
      `;
    } else if (i === pagination.page - 2 || i === pagination.page + 2) {
      html += '<span class="px-2 text-slate-400">...</span>';
    }
  }

  html += `
    <button data-page="${pagination.page + 1}"
            class="p-2 rounded hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-500 transition-colors disabled:opacity-50"
            ${pagination.page === pagination.pages ? 'disabled' : ''}>
      <span class="material-symbols-outlined text-lg">chevron_right</span>
    </button>
  `;

  controls.innerHTML = html;

  controls.querySelectorAll('[data-page]').forEach(btn => {
    btn.addEventListener('click', () => {
      const page = parseInt(btn.dataset.page);
      if (!btn.disabled && page >= 1) {
        loadLogs(page);
      }
    });
  });
}

// Применить фильтры
function applyFilters() {
  currentFilters = {};

  const action = document.getElementById('filter-action').value;
  const resource = document.getElementById('filter-resource').value;
  const dateFrom = document.getElementById('filter-date-from').value;
  const dateTo = document.getElementById('filter-date-to').value;

  if (action) currentFilters.action = action;
  if (resource) currentFilters.resource_type = resource;
  if (dateFrom) currentFilters.date_from = dateFrom;
  if (dateTo) currentFilters.date_to = dateTo;

  loadLogs(1);
}

// Сбросить фильтры
function resetFilters() {
  document.getElementById('filter-action').value = '';
  document.getElementById('filter-resource').value = '';
  document.getElementById('filter-date-from').value = '';
  document.getElementById('filter-date-to').value = '';
  currentFilters = {};
  loadLogs(1);
}

// Показать детали
async function showDetails(id) {
  try {
    const log = await AuditLogsAPI.getLogById(id);
    const actionInfo = actionLabels[log.action] || { label: log.action, color: 'slate' };

    const modalContent = document.getElementById('modal-content');
    modalContent.innerHTML = `
      <div class="space-y-4">
        <div class="grid grid-cols-2 gap-4">
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-1">Дата и время</p>
            <p class="text-sm font-medium">${UI.formatDateTime(log.created_at)}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-1">Действие</p>
            <p class="text-sm font-medium">${actionInfo.label}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-1">Администратор</p>
            <p class="text-sm font-medium">${log.admin_name || 'Система'}</p>
            <p class="text-xs text-slate-500">${log.admin_email || '-'}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-1">Ресурс</p>
            <p class="text-sm font-medium">${resourceLabels[log.resource_type] || log.resource_type || '-'}</p>
            ${log.resource_id ? `<p class="text-xs text-slate-500">ID: ${log.resource_id}</p>` : ''}
          </div>
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-1">IP адрес</p>
            <p class="text-sm font-mono">${log.ip_address || '-'}</p>
          </div>
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-1">User Agent</p>
            <p class="text-xs text-slate-600 break-all">${log.user_agent || '-'}</p>
          </div>
        </div>

        ${log.old_values ? `
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-2">Старые значения</p>
            <pre class="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs overflow-x-auto">${JSON.stringify(log.old_values, null, 2)}</pre>
          </div>
        ` : ''}

        ${log.new_values ? `
          <div>
            <p class="text-xs text-slate-500 uppercase font-bold mb-2">Новые значения</p>
            <pre class="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg text-xs overflow-x-auto">${JSON.stringify(log.new_values, null, 2)}</pre>
          </div>
        ` : ''}
      </div>
    `;

    document.getElementById('details-modal').classList.remove('hidden');
    document.getElementById('details-modal').classList.add('flex');
  } catch (error) {
    UI.showError('Ошибка загрузки деталей: ' + error.message);
  }
}

// Закрыть модальное окно
function closeModal() {
  document.getElementById('details-modal').classList.add('hidden');
  document.getElementById('details-modal').classList.remove('flex');
}

// Экспорт функций
window.showDetails = showDetails;

console.log('auditLogs.js loaded');
