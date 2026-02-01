// Live-лента пожертвований
// API_BASE уже объявлен в main.js

// Форматирование времени для live-ленты
function formatLiveTime(dateString) {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

// Иконки для методов оплаты
const paymentIcons = {
  'card': 'credit_card',
  'sbp': 'payments',
  'crypto': 'currency_bitcoin',
  'monthly': 'savings',
  'manual': 'volunteer_activism'
};

const paymentNames = {
  'card': 'Картой',
  'sbp': 'СБП',
  'crypto': 'Криптовалюта',
  'monthly': 'Ежемесячно',
  'manual': 'Вручную'
};

// Загрузка и отображение live-ленты
async function loadLiveFeed() {
  console.log('📡 Загрузка live-ленты...');
  try {
    const response = await fetch(`${API_BASE}/donations/recent?limit=15`);
    const donations = await response.json();
    console.log('📊 Получено пожертвований:', donations.length, donations);

    const liveFeed = document.getElementById('liveFeed');
    console.log('🎯 Элемент liveFeed:', liveFeed);

    if (donations.length === 0) {
      liveFeed.innerHTML = `
        <div class="text-center py-8 text-slate-500">
          <p class="text-sm">Пока нет пожертвований</p>
        </div>
      `;
      return;
    }

    liveFeed.innerHTML = donations.map((donation, index) => {
      const isLast = index === donations.length - 1;
      const icon = paymentIcons[donation.payment_method] || 'favorite';
      const paymentName = paymentNames[donation.payment_method] || 'Пожертвование';

      return `
        <div class="grid grid-cols-[40px_1fr] gap-x-3 group">
          <div class="flex flex-col items-center gap-1 ${index === 0 ? 'pt-2' : ''}">
            ${index > 0 ? '<div class="w-0.5 bg-slate-100 dark:bg-slate-800 h-2"></div>' : ''}
            <div class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
              <span class="material-symbols-outlined text-xl">${icon}</span>
            </div>
            ${!isLast ? '<div class="w-0.5 bg-slate-100 dark:bg-slate-800 h-10 grow"></div>' : ''}
          </div>
          <div class="flex flex-1 flex-col py-3 ${!isLast ? 'border-b border-slate-50 dark:border-slate-800/50' : ''}">
            <div class="flex justify-between items-start">
              <p class="text-[#0d141b] dark:text-white text-sm font-bold leading-normal">
                ${formatLiveTime(donation.timestamp)} — Поступило ${donation.amount.toLocaleString('ru-RU')}₽ ${donation.campaign ? `на сбор «${donation.campaign}»` : ''}
              </p>
            </div>
            <p class="text-primary text-xs font-medium mt-1">
              ${paymentName}${donation.donor && donation.donor !== 'Анонимный донор' ? ' • ' + donation.donor : ''}
            </p>
          </div>
        </div>
      `;
    }).join('');

    // Добавляем анимацию появления для новых элементов
    const items = liveFeed.querySelectorAll('.grid');
    items.forEach((item, index) => {
      item.style.opacity = '0';
      item.style.transform = 'translateY(-10px)';
      setTimeout(() => {
        item.style.transition = 'all 0.3s ease-out';
        item.style.opacity = '1';
        item.style.transform = 'translateY(0)';
      }, index * 50);
    });
  } catch (error) {
    console.error('Ошибка при загрузке live-ленты:', error);
    document.getElementById('liveFeed').innerHTML = `
      <div class="text-center py-8 text-slate-500">
        <p class="text-sm">Ошибка при загрузке ленты</p>
      </div>
    `;
  }
}

// Проверка на новые пожертвования
let lastDonationId = null;

async function checkNewDonations() {
  try {
    const response = await fetch(`${API_BASE}/donations/recent?limit=1`);
    const donations = await response.json();

    if (donations.length > 0) {
      const latestDonation = donations[0];

      // Если это новое пожертвование, обновляем ленту
      if (lastDonationId && latestDonation.id !== lastDonationId) {
        await loadLiveFeed();

        // Показываем уведомление о новом пожертвовании
        showNotification(latestDonation);
      }

      lastDonationId = latestDonation.id;
    }
  } catch (error) {
    console.error('Ошибка при проверке новых пожертвований:', error);
  }
}

// Показать уведомление о новом пожертвовании
function showNotification(donation) {
  // Создаем уведомление в правом верхнем углу
  const notification = document.createElement('div');
  notification.className = 'fixed top-20 right-4 bg-white dark:bg-slate-900 border-2 border-primary rounded-xl shadow-2xl p-4 max-w-sm z-50 animate-slide-in';
  notification.innerHTML = `
    <div class="flex items-start gap-3">
      <div class="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary flex-shrink-0">
        <span class="material-symbols-outlined">favorite</span>
      </div>
      <div class="flex-1">
        <p class="text-sm font-bold text-slate-900 dark:text-white">Новое пожертвование!</p>
        <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
          ${donation.amount.toLocaleString('ru-RU')}₽ на ${donation.campaign}
        </p>
      </div>
      <button class="notification-close text-slate-400 hover:text-slate-600">
        <span class="material-symbols-outlined text-lg">close</span>
      </button>
    </div>
  `;

  // Добавляем обработчик для кнопки закрытия
  notification.querySelector('.notification-close').addEventListener('click', () => {
    notification.remove();
  });

  // Добавляем стили для анимации
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slide-in {
      from {
        transform: translateX(100%);
        opacity: 0;
      }
      to {
        transform: translateX(0);
        opacity: 1;
      }
    }
    .animate-slide-in {
      animation: slide-in 0.3s ease-out;
    }
  `;
  document.head.appendChild(style);

  document.body.appendChild(notification);

  // Автоматически удаляем через 5 секунд
  setTimeout(() => {
    notification.style.transition = 'all 0.3s ease-out';
    notification.style.transform = 'translateX(100%)';
    notification.style.opacity = '0';
    setTimeout(() => notification.remove(), 300);
  }, 5000);
}

// Инициализация live-ленты
document.addEventListener('DOMContentLoaded', () => {
  loadLiveFeed();

  // Обновляем ленту каждые 5 секунд
  setInterval(checkNewDonations, 5000);
});
