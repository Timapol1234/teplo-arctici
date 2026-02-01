// API base URL
const API_BASE = window.location.origin + '/api';

// Утилиты
const formatNumber = (num) => {
  return new Intl.NumberFormat('ru-RU').format(num);
};

const formatDate = (dateString) => {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Только что';
  if (diffMins < 60) return `${diffMins} мин назад`;
  if (diffHours < 24) return `${diffHours} ч назад`;
  if (diffDays < 7) return `${diffDays} дн назад`;

  return date.toLocaleDateString('ru-RU');
};

// Загрузка статистики
async function loadStatistics() {
  try {
    const response = await fetch(`${API_BASE}/donations/statistics`);
    const data = await response.json();

    const heroStats = document.getElementById('heroStats');
    heroStats.innerHTML = `
      <div class="flex flex-col gap-1 rounded-xl p-6 bg-white/10 backdrop-blur-lg border border-white/10 text-left">
        <p class="text-white/70 text-sm font-medium uppercase tracking-wider">Собрано всего</p>
        <div class="flex items-end gap-2">
          <p class="text-white text-3xl font-black leading-tight">${formatNumber(data.total_amount)}₽</p>
        </div>
      </div>
      <div class="flex flex-col gap-1 rounded-xl p-6 bg-white/10 backdrop-blur-lg border border-white/10 text-left">
        <p class="text-white/70 text-sm font-medium uppercase tracking-wider">Количество пожертвований</p>
        <div class="flex items-end gap-2">
          <p class="text-white text-3xl font-black leading-tight">${formatNumber(data.total_donations)}</p>
        </div>
      </div>
    `;
  } catch (error) {
    console.error('Ошибка при загрузке статистики:', error);
  }
}

// Загрузка активных сборов
async function loadCampaigns() {
  try {
    const response = await fetch(`${API_BASE}/campaigns`);
    const campaigns = await response.json();

    const campaignsList = document.getElementById('campaignsList');

    if (campaigns.length === 0) {
      campaignsList.innerHTML = '<p class="text-slate-500 col-span-2">Нет активных сборов</p>';
      return;
    }

    campaignsList.innerHTML = campaigns.map(campaign => `
      <div class="group flex flex-col bg-white dark:bg-slate-900 rounded-xl overflow-hidden border border-[#e7edf3] dark:border-slate-800 shadow-sm hover:shadow-md transition-all">
        <div class="h-48 overflow-hidden bg-slate-200">
          ${campaign.image_url ? `
            <img
              alt="${campaign.title}"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 campaign-img"
              src="${campaign.image_url}"
            />
          ` : `
            <div class="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5">
              <span class="material-symbols-outlined text-6xl text-primary/50">volunteer_activism</span>
            </div>
          `}
        </div>
        <div class="p-5 flex flex-col flex-1">
          <h3 class="text-lg font-bold mb-2">${campaign.title}</h3>
          <p class="text-slate-500 dark:text-slate-400 text-sm mb-6 line-clamp-2">
            ${campaign.description}
          </p>
          <div class="mt-auto">
            <div class="flex justify-between text-sm font-bold mb-2">
              <span>Собрано ${campaign.progress_percentage}%</span>
              <span class="text-primary">${formatNumber(campaign.current_amount)}₽ / ${formatNumber(campaign.goal_amount)}₽</span>
            </div>
            <div class="w-full bg-slate-100 dark:bg-slate-800 h-2 rounded-full mb-6">
              <div class="bg-primary h-full rounded-full transition-all duration-500" style="width: ${Math.min(campaign.progress_percentage, 100)}%"></div>
            </div>
            <button
              data-donate-campaign="${campaign.id}"
              data-campaign-title="${campaign.title.replace(/"/g, '&quot;')}"
              class="w-full h-11 bg-primary/10 text-primary hover:bg-primary hover:text-white font-bold rounded-lg transition-all"
            >
              Помочь
            </button>
          </div>
        </div>
      </div>
    `).join('');

    // Привязываем обработчики для кнопок "Помочь"
    attachDonateButtons();
  } catch (error) {
    console.error('Ошибка при загрузке сборов:', error);
    document.getElementById('campaignsList').innerHTML = `
      <div class="col-span-2 text-center py-8 text-slate-500">
        Ошибка при загрузке сборов. Попробуйте обновить страницу.
      </div>
    `;
  }
}

// Привязка обработчиков для кнопок "Помочь"
function attachDonateButtons() {
  document.querySelectorAll('[data-donate-campaign]').forEach(btn => {
    btn.addEventListener('click', () => {
      const campaignId = parseInt(btn.dataset.donateCampaign);
      const campaignTitle = btn.dataset.campaignTitle;
      showDonationModal(campaignId, campaignTitle);
    });
  });

  // Обработка ошибок загрузки изображений
  document.querySelectorAll('.campaign-img').forEach(img => {
    img.addEventListener('error', () => {
      img.style.display = 'none';
    });
  });
}

// Модальное окно для пожертвования
let selectedCampaignId = null;

function showDonationModal(campaignId, campaignTitle) {
  selectedCampaignId = campaignId;
  document.getElementById('modal-campaign-title').textContent = campaignTitle;
  document.getElementById('donation-modal').classList.remove('hidden');
  document.getElementById('donation-amount').focus();
}

function hideDonationModal() {
  document.getElementById('donation-modal').classList.add('hidden');
  document.getElementById('donation-form').reset();
  document.getElementById('donation-error').classList.add('hidden');
  document.getElementById('donation-success').classList.add('hidden');
  selectedCampaignId = null;
}

// Обработка формы пожертвования
async function handleDonationSubmit(e) {
  e.preventDefault();

  const form = e.target;
  const submitBtn = form.querySelector('button[type="submit"]');
  const errorDiv = document.getElementById('donation-error');
  const successDiv = document.getElementById('donation-success');

  errorDiv.classList.add('hidden');
  successDiv.classList.add('hidden');

  const amount = parseFloat(form.amount.value);
  const donorName = form.donor_name.value.trim();
  const donorEmail = form.donor_email.value.trim();
  const isAnonymous = form.is_anonymous.checked;

  if (amount < 100) {
    errorDiv.textContent = 'Минимальная сумма пожертвования — 100₽';
    errorDiv.classList.remove('hidden');
    return;
  }

  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="animate-pulse">Обработка...</span>';

  try {
    const response = await fetch(`${API_BASE}/donations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        campaign_id: selectedCampaignId,
        amount: amount,
        donor_name: isAnonymous ? null : donorName,
        donor_email: isAnonymous ? null : donorEmail,
        is_anonymous: isAnonymous
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMsg = data.errors
        ? data.errors.map(e => e.msg).join(', ')
        : data.error || 'Ошибка сервера';
      throw new Error(errorMsg);
    }

    // Успех!
    successDiv.innerHTML = `
      <div class="flex items-center gap-3">
        <span class="material-symbols-outlined text-green-500">check_circle</span>
        <div>
          <p class="font-bold">Спасибо за ваше пожертвование!</p>
          <p class="text-sm text-slate-600">Сумма ${formatNumber(amount)}₽ добавлена к сбору.</p>
        </div>
      </div>
    `;
    successDiv.classList.remove('hidden');
    form.reset();

    // Обновляем статистику, сборы и live-ленту
    loadStatistics();
    loadCampaigns();
    if (typeof loadLiveFeed === 'function') {
      loadLiveFeed();
    }

    // Закрываем модал через 3 секунды
    setTimeout(hideDonationModal, 3000);

  } catch (error) {
    errorDiv.textContent = error.message;
    errorDiv.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = 'Пожертвовать';
  }
}

// Переключение анонимности
function toggleAnonymous(checkbox) {
  const nameInput = document.getElementById('donor-name');
  const emailInput = document.getElementById('donor-email');

  if (checkbox.checked) {
    nameInput.disabled = true;
    emailInput.disabled = true;
    nameInput.value = '';
    emailInput.value = '';
  } else {
    nameInput.disabled = false;
    emailInput.disabled = false;
  }
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
  loadStatistics();
  loadCampaigns();

  // Обновляем статистику каждые 30 секунд
  setInterval(loadStatistics, 30000);

  // Обработчики модального окна
  const modal = document.getElementById('donation-modal');
  const closeBtn = document.getElementById('close-donation-modal');
  const form = document.getElementById('donation-form');
  const anonymousCheckbox = document.getElementById('is-anonymous');

  // Закрытие по кнопке
  if (closeBtn) {
    closeBtn.addEventListener('click', hideDonationModal);
  }

  // Закрытие по клику на фон
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        hideDonationModal();
      }
    });
  }

  // Отправка формы
  if (form) {
    form.addEventListener('submit', handleDonationSubmit);
  }

  // Переключение анонимности
  if (anonymousCheckbox) {
    anonymousCheckbox.addEventListener('change', function() {
      toggleAnonymous(this);
    });
  }

  // Кнопки быстрого выбора суммы
  const amountPresets = document.getElementById('amount-presets');
  if (amountPresets) {
    amountPresets.querySelectorAll('[data-amount]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('donation-amount').value = btn.dataset.amount;
      });
    });
  }
});
