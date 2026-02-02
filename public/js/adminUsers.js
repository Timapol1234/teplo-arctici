// API для управления администраторами
const AdminUsersAPI = {
  async getAdmins(includeInactive = false) {
    const url = `/api/admin/users${includeInactive ? '?include_inactive=true' : ''}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${TokenManager.get()}`,
        'Content-Type': 'application/json'
      }
    });

    if (response.status === 403) {
      throw new Error('ACCESS_DENIED');
    }

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

  async createAdmin(adminData) {
    const response = await fetch('/api/admin/users', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${TokenManager.get()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adminData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка создания администратора');
    }

    return data;
  },

  async updateAdmin(id, adminData) {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${TokenManager.get()}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(adminData)
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка обновления администратора');
    }

    return data;
  },

  async deactivateAdmin(id) {
    const response = await fetch(`/api/admin/users/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${TokenManager.get()}`,
        'Content-Type': 'application/json'
      }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Ошибка деактивации администратора');
    }

    return data;
  }
};

// Состояние страницы
let currentAdminId = null;
let isEditMode = false;
let adminsData = [];

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

  // Проверяем роль пользователя
  const adminData = TokenManager.getAdminData();
  if (adminData?.role !== 'super_admin') {
    showAccessDenied();
    return;
  }

  await loadAdmins();
  initEventListeners();
});

// Показать сообщение о недостаточных правах
function showAccessDenied() {
  document.getElementById('access-denied').classList.remove('hidden');
  document.getElementById('add-admin-btn').classList.add('hidden');
  document.getElementById('filter-section').classList.add('hidden');
  document.getElementById('admins-section').classList.add('hidden');
}

// Инициализация обработчиков событий
function initEventListeners() {
  // Кнопка добавления
  document.getElementById('add-admin-btn').addEventListener('click', openCreateModal);

  // Фильтр деактивированных
  document.getElementById('show-inactive').addEventListener('change', (e) => {
    loadAdmins(e.target.checked);
  });

  // Форма
  document.getElementById('admin-form').addEventListener('submit', handleSubmit);
  document.getElementById('cancel-btn').addEventListener('click', closeModal);

  // Модальное окно подтверждения деактивации
  document.getElementById('cancel-deactivate').addEventListener('click', closeDeactivateModal);
  document.getElementById('confirm-deactivate').addEventListener('click', handleDeactivate);

  // Закрытие модальных окон по клику на фон
  document.getElementById('admin-modal').addEventListener('click', (e) => {
    if (e.target.id === 'admin-modal') closeModal();
  });
  document.getElementById('deactivate-modal').addEventListener('click', (e) => {
    if (e.target.id === 'deactivate-modal') closeDeactivateModal();
  });
}

// Загрузка списка администраторов
async function loadAdmins(includeInactive = false) {
  try {
    adminsData = await AdminUsersAPI.getAdmins(includeInactive);
    renderAdmins(adminsData);
  } catch (error) {
    if (error.message === 'ACCESS_DENIED') {
      showAccessDenied();
    } else {
      UI.showError('Ошибка загрузки администраторов: ' + error.message);
    }
  }
}

// Отрисовка таблицы администраторов
function renderAdmins(admins) {
  const tbody = document.getElementById('admins-table');

  if (admins.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="6" class="px-6 py-8 text-center text-slate-500">
          <div class="flex flex-col items-center gap-2">
            <span class="material-symbols-outlined text-4xl">group_off</span>
            <p>Нет администраторов</p>
          </div>
        </td>
      </tr>
    `;
    return;
  }

  const currentAdminData = TokenManager.getAdminData();

  tbody.innerHTML = admins.map(admin => {
    const isCurrentUser = admin.id === currentAdminData?.id;
    const roleLabel = admin.role === 'super_admin' ? 'Супер-админ' : 'Администратор';
    const roleBadge = admin.role === 'super_admin'
      ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
      : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';

    const statusBadge = admin.is_active
      ? '<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"><span class="w-1.5 h-1.5 rounded-full bg-green-500"></span> Активен</span>'
      : '<span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400"><span class="w-1.5 h-1.5 rounded-full bg-slate-400"></span> Деактивирован</span>';

    const lastLogin = admin.last_login
      ? UI.formatDateTime(admin.last_login)
      : '<span class="text-slate-400">Никогда</span>';

    return `
      <tr class="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors ${!admin.is_active ? 'opacity-60' : ''}">
        <td class="px-6 py-4">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-full ${admin.role === 'super_admin' ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'} flex items-center justify-center">
              <span class="material-symbols-outlined">${admin.role === 'super_admin' ? 'shield_person' : 'person'}</span>
            </div>
            <div>
              <div class="font-semibold text-slate-900 dark:text-white">${admin.full_name || 'Без имени'}</div>
              <div class="text-sm text-slate-500">${admin.email}</div>
            </div>
          </div>
        </td>
        <td class="px-6 py-4">
          <span class="inline-flex py-1 px-2.5 rounded-full text-xs font-medium ${roleBadge}">${roleLabel}</span>
        </td>
        <td class="px-6 py-4">${statusBadge}</td>
        <td class="px-6 py-4">
          <div class="text-sm text-slate-600 dark:text-slate-400">${lastLogin}</div>
          ${admin.last_login_ip ? `<div class="text-xs text-slate-400">${admin.last_login_ip}</div>` : ''}
        </td>
        <td class="px-6 py-4">
          <div class="text-sm text-slate-600 dark:text-slate-400">${UI.formatDate(admin.created_at)}</div>
        </td>
        <td class="px-6 py-4 text-right">
          <div class="flex items-center justify-end gap-2">
            <button onclick="openEditModal(${admin.id})"
                    class="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 transition-colors"
                    title="Редактировать">
              <span class="material-symbols-outlined text-lg">edit</span>
            </button>
            ${!isCurrentUser && admin.is_active ? `
              <button onclick="openDeactivateModal(${admin.id}, '${admin.email}')"
                      class="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 transition-colors"
                      title="Деактивировать">
                <span class="material-symbols-outlined text-lg">person_off</span>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Открыть модальное окно создания
function openCreateModal() {
  isEditMode = false;
  currentAdminId = null;

  document.getElementById('modal-title').textContent = 'Добавить администратора';
  document.getElementById('admin-form').reset();
  document.getElementById('admin-password').required = true;
  document.getElementById('password-hint').textContent = '(минимум 8 символов)';
  document.getElementById('status-field').classList.add('hidden');

  document.getElementById('admin-modal').classList.remove('hidden');
  document.getElementById('admin-modal').classList.add('flex');
}

// Открыть модальное окно редактирования
function openEditModal(id) {
  const admin = adminsData.find(a => a.id === id);
  if (!admin) return;

  isEditMode = true;
  currentAdminId = id;

  document.getElementById('modal-title').textContent = 'Редактировать администратора';
  document.getElementById('admin-id').value = id;
  document.getElementById('admin-email').value = admin.email;
  document.getElementById('admin-name').value = admin.full_name || '';
  document.getElementById('admin-password').value = '';
  document.getElementById('admin-password').required = false;
  document.getElementById('password-hint').textContent = '(оставьте пустым, чтобы не менять)';
  document.getElementById('admin-role').value = admin.role || 'admin';
  document.getElementById('admin-active').checked = admin.is_active;
  document.getElementById('status-field').classList.remove('hidden');

  document.getElementById('admin-modal').classList.remove('hidden');
  document.getElementById('admin-modal').classList.add('flex');
}

// Закрыть модальное окно
function closeModal() {
  document.getElementById('admin-modal').classList.add('hidden');
  document.getElementById('admin-modal').classList.remove('flex');
}

// Открыть модальное окно подтверждения деактивации
function openDeactivateModal(id, email) {
  currentAdminId = id;
  document.getElementById('deactivate-email').textContent = email;
  document.getElementById('deactivate-modal').classList.remove('hidden');
  document.getElementById('deactivate-modal').classList.add('flex');
}

// Закрыть модальное окно деактивации
function closeDeactivateModal() {
  document.getElementById('deactivate-modal').classList.add('hidden');
  document.getElementById('deactivate-modal').classList.remove('flex');
  currentAdminId = null;
}

// Обработка отправки формы
async function handleSubmit(e) {
  e.preventDefault();

  const formData = new FormData(e.target);
  const data = {
    email: formData.get('email'),
    full_name: formData.get('full_name') || null,
    role: formData.get('role')
  };

  const password = formData.get('password');
  if (password) {
    if (password.length < 8) {
      UI.showError('Пароль должен быть минимум 8 символов');
      return;
    }
    data.password = password;
  }

  if (isEditMode) {
    data.is_active = document.getElementById('admin-active').checked;
  }

  try {
    if (isEditMode) {
      await AdminUsersAPI.updateAdmin(currentAdminId, data);
      UI.showNotification('Администратор обновлен');
    } else {
      if (!password) {
        UI.showError('Пароль обязателен для нового администратора');
        return;
      }
      await AdminUsersAPI.createAdmin(data);
      UI.showNotification('Администратор создан');
    }

    closeModal();
    const includeInactive = document.getElementById('show-inactive').checked;
    await loadAdmins(includeInactive);
  } catch (error) {
    UI.showError(error.message);
  }
}

// Обработка деактивации
async function handleDeactivate() {
  if (!currentAdminId) return;

  try {
    await AdminUsersAPI.deactivateAdmin(currentAdminId);
    UI.showNotification('Администратор деактивирован');
    closeDeactivateModal();
    const includeInactive = document.getElementById('show-inactive').checked;
    await loadAdmins(includeInactive);
  } catch (error) {
    UI.showError(error.message);
  }
}

// Экспорт функций для onclick
window.openEditModal = openEditModal;
window.openDeactivateModal = openDeactivateModal;

console.log('adminUsers.js loaded');
