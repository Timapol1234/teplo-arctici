// Конфигурация API
const API_BASE_URL = '/api/admin';

// Утилиты для работы с токеном
const TokenManager = {
  get() {
    return localStorage.getItem('admin_token');
  },

  set(token) {
    localStorage.setItem('admin_token', token);
  },

  remove() {
    localStorage.removeItem('admin_token');
  },

  getAdminData() {
    const data = localStorage.getItem('admin_data');
    return data ? JSON.parse(data) : null;
  },

  setAdminData(data) {
    localStorage.setItem('admin_data', JSON.stringify(data));
  }
};

// Получить заголовки с токеном
function getHeaders() {
  const token = TokenManager.get();
  const headers = {
    'Content-Type': 'application/json'
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  return headers;
}

// Универсальный метод для API запросов
async function apiRequest(endpoint, options = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const config = {
    ...options,
    headers: getHeaders()
  };

  try {
    const response = await fetch(url, config);

    // Если 401 - неавторизован, перенаправляем на login
    if (response.status === 401) {
      TokenManager.remove();
      window.location.href = '/admin/';
      throw new Error('Не авторизован');
    }

    const data = await response.json();

    if (!response.ok) {
      // Обработка ошибок валидации (массив errors)
      if (data.errors && Array.isArray(data.errors)) {
        const messages = data.errors.map(e => e.msg || e.message).join(', ');
        throw new Error(messages);
      }
      throw new Error(data.error || 'Ошибка сервера');
    }

    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Метод для запросов с FormData (загрузка файлов)
async function apiRequestFormData(endpoint, formData, method = 'POST') {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = TokenManager.get();

  const headers = {};
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  // Content-Type не указываем - браузер сам установит multipart/form-data с boundary

  try {
    const response = await fetch(url, {
      method,
      headers,
      body: formData
    });

    if (response.status === 401) {
      TokenManager.remove();
      window.location.href = '/admin/';
      throw new Error('Не авторизован');
    }

    const data = await response.json();

    if (!response.ok) {
      if (data.errors && Array.isArray(data.errors)) {
        const messages = data.errors.map(e => e.msg || e.message).join(', ');
        throw new Error(messages);
      }
      throw new Error(data.error || 'Ошибка сервера');
    }

    return data;
  } catch (error) {
    console.error('API FormData Error:', error);
    throw error;
  }
}

// API объект с методами
const AdminAPI = {
  // Авторизация
  async login(email, password) {
    const data = await apiRequest('/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.success && data.token) {
      TokenManager.set(data.token);
      TokenManager.setAdminData(data.admin);
    }

    return data;
  },

  // Проверка токена
  async verifyToken() {
    return await apiRequest('/verify');
  },

  // Выход
  logout() {
    TokenManager.remove();
    window.location.href = '/admin/';
  },

  // Транзакции/Пожертвования
  async getDonations(page = 1, limit = 50) {
    return await apiRequest(`/donations?page=${page}&limit=${limit}`);
  },

  async createDonation(donationData) {
    return await apiRequest('/donations', {
      method: 'POST',
      body: JSON.stringify(donationData)
    });
  },

  // Сборы
  async getCampaigns() {
    return await apiRequest('/campaigns');
  },

  async createCampaign(data) {
    return await apiRequest('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateCampaign(id, data) {
    return await apiRequest(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteCampaign(id) {
    return await apiRequest(`/campaigns/${id}`, {
      method: 'DELETE'
    });
  },

  // Отчеты
  async getReports() {
    return await apiRequest('/reports');
  },

  async createReport(reportData) {
    return await apiRequest('/reports', {
      method: 'POST',
      body: JSON.stringify(reportData)
    });
  },

  async updateReport(id, reportData) {
    return await apiRequest(`/reports/${id}`, {
      method: 'PUT',
      body: JSON.stringify(reportData)
    });
  },

  async deleteReport(id) {
    return await apiRequest(`/reports/${id}`, {
      method: 'DELETE'
    });
  }
};

// Функция проверки авторизации
async function checkAuth() {
  const token = TokenManager.get();

  if (!token) {
    window.location.href = '/admin/';
    return false;
  }

  try {
    const result = await AdminAPI.verifyToken();
    if (result.success) {
      return true;
    } else {
      window.location.href = '/admin/';
      return false;
    }
  } catch (error) {
    console.error('Auth check failed:', error);
    window.location.href = '/admin/';
    return false;
  }
}

// Утилиты для UI
const UI = {
  showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-50 px-6 py-4 rounded-lg shadow-lg text-white transition-all transform translate-x-0 ${
      type === 'success' ? 'bg-green-500' : 'bg-red-500'
    }`;
    notification.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined">${type === 'success' ? 'check_circle' : 'error'}</span>
        <p class="font-medium">${message}</p>
      </div>
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.transform = 'translateX(400px)';
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  },

  showError(message) {
    this.showNotification(message, 'error');
  },

  async confirm(message) {
    return confirm(message);
  },

  formatAmount(amount) {
    return new Intl.NumberFormat('ru-RU').format(amount) + ' ₽';
  },

  formatDate(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  },

  formatDateTime(dateString) {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  },

  getStatusBadge(status) {
    const statusConfig = {
      completed: {
        text: 'Исполнено',
        class: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
        dotClass: 'bg-green-500'
      },
      pending: {
        text: 'В обработке',
        class: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
        dotClass: 'bg-blue-500'
      },
      failed: {
        text: 'Ошибка',
        class: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
        dotClass: 'bg-red-500'
      }
    };

    const config = statusConfig[status] || statusConfig.pending;

    return `
      <span class="inline-flex items-center gap-1.5 py-1 px-2.5 rounded-full text-xs font-medium ${config.class}">
        <span class="w-1.5 h-1.5 rounded-full ${config.dotClass}"></span> ${config.text}
      </span>
    `;
  }
};

// Инициализация выхода из системы
function initLogout() {
  const logoutButtons = document.querySelectorAll('[data-logout]');
  logoutButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      if (confirm('Вы уверены, что хотите выйти?')) {
        AdminAPI.logout();
      }
    });
  });
}

// Инициализация переключения темы
function initThemeToggle() {
  const themeToggle = document.querySelector('[data-theme-toggle]');
  if (themeToggle) {
    themeToggle.addEventListener('click', () => {
      document.documentElement.classList.toggle('dark');
      localStorage.setItem('theme', document.documentElement.classList.contains('dark') ? 'dark' : 'light');
    });
  }

  const savedTheme = localStorage.getItem('theme');
  if (savedTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }
}

// Экспортируем в глобальную область
window.AdminAPI = AdminAPI;
window.TokenManager = TokenManager;
window.checkAuth = checkAuth;
window.UI = UI;
window.initLogout = initLogout;
window.initThemeToggle = initThemeToggle;

// Отладка
console.log('✅ admin.js v4 loaded');
console.log('AdminAPI methods:', Object.keys(AdminAPI));
