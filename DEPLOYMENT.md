# 🚀 Руководство по развертыванию в продакшн

Это руководство описывает шаги для развертывания платформы "Тепло Арктики" на production сервере.

## Требования к серверу

Согласно ТЗ, минимальные требования:
- **CPU**: 2 ядра
- **RAM**: 4 GB
- **Диск**: 50 GB SSD
- **ОС**: Ubuntu 22.04 LTS или новее

## Шаг 1: Подготовка сервера

### 1.1 Обновление системы

```bash
sudo apt update && sudo apt upgrade -y
```

### 1.2 Установка Node.js 18

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs
node --version  # Должно быть v18.x или выше
```

### 1.3 Установка PostgreSQL 14+

```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
```

### 1.4 Настройка firewall (UFW)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

## Шаг 2: Настройка PostgreSQL

```bash
# Войти в PostgreSQL
sudo -u postgres psql

# Создать пользователя и базу данных
CREATE USER teplo_user WITH PASSWORD 'сильный_пароль_здесь';
CREATE DATABASE teplo_arctici OWNER teplo_user;
GRANT ALL PRIVILEGES ON DATABASE teplo_arctici TO teplo_user;
\q
```

## Шаг 3: Клонирование и настройка проекта

```bash
# Создать папку для приложения
sudo mkdir -p /var/www/teplo-arctici
sudo chown -R $USER:$USER /var/www/teplo-arctici
cd /var/www/teplo-arctici

# Клонировать проект
git clone <your-repo-url> .

# Установить зависимости
npm install --production
```

## Шаг 4: Настройка переменных окружения

```bash
# Создать production .env файл
nano .env
```

Важные настройки для продакшн:

```env
# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=teplo_arctici
DB_USER=teplo_user
DB_PASSWORD=сильный_пароль_здесь

# Server
PORT=3000
NODE_ENV=production

# Security - ОБЯЗАТЕЛЬНО ИЗМЕНИТЬ!
JWT_SECRET=сгенерируйте_длинный_случайный_ключ_здесь
SESSION_SECRET=другой_длинный_случайный_ключ

# Admin - ОБЯЗАТЕЛЬНО ИЗМЕНИТЬ!
ADMIN_EMAIL=ваш_email@example.com
ADMIN_PASSWORD=сильный_пароль_для_админа

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# Verification (опционально)
VERIFICATION_ENABLED=false

# Cloudflare (если используете)
CLOUDFLARE_ZONE_ID=your_zone_id
CLOUDFLARE_API_TOKEN=your_api_token
```

**Генерация безопасных ключей:**

```bash
# Сгенерировать случайные ключи
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

## Шаг 5: Инициализация базы данных

```bash
npm run db:init
npm run db:seed  # Опционально, только для демо-данных
```

## Шаг 6: Настройка PM2 для автозапуска

```bash
# Установить PM2
sudo npm install -g pm2

# Запустить приложение
pm2 start backend/server.js --name teplo-arctici

# Настроить автозапуск при перезагрузке
pm2 startup systemd
pm2 save
```

**Полезные команды PM2:**

```bash
pm2 status              # Статус приложения
pm2 logs teplo-arctici  # Просмотр логов
pm2 restart teplo-arctici  # Перезапуск
pm2 stop teplo-arctici     # Остановка
pm2 delete teplo-arctici   # Удалить из PM2
```

## Шаг 7: Настройка Nginx как reverse proxy

```bash
# Установить Nginx
sudo apt install -y nginx

# Создать конфигурацию
sudo nano /etc/nginx/sites-available/teplo-arctici
```

Содержимое конфигурации:

```nginx
server {
    listen 80;
    server_name ваш-домен.ru www.ваш-домен.ru;

    # Основные настройки безопасности
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Ограничение размера загружаемых файлов
    client_max_body_size 10M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активировать конфигурацию:

```bash
# Создать символическую ссылку
sudo ln -s /etc/nginx/sites-available/teplo-arctici /etc/nginx/sites-enabled/

# Проверить конфигурацию
sudo nginx -t

# Перезапустить Nginx
sudo systemctl restart nginx
```

## Шаг 8: Настройка SSL с Let's Encrypt

```bash
# Установить Certbot
sudo apt install -y certbot python3-certbot-nginx

# Получить SSL сертификат
sudo certbot --nginx -d ваш-домен.ru -d www.ваш-домен.ru

# Автообновление сертификата (уже настроено автоматически)
sudo certbot renew --dry-run
```

## Шаг 9: Настройка Cloudflare DDoS защиты (опционально)

1. Зарегистрируйтесь на https://cloudflare.com
2. Добавьте ваш домен
3. Измените NS записи у регистратора домена на Cloudflare NS
4. В Cloudflare включите:
   - SSL/TLS → Full (Strict)
   - Firewall → Rate Limiting
   - Security → DDoS Protection

## Шаг 10: Резервное копирование

### Автоматический бэкап базы данных

```bash
# Создать скрипт бэкапа
sudo nano /usr/local/bin/backup-teplo-db.sh
```

Содержимое скрипта:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/teplo-arctici"
DATE=$(date +%Y%m%d_%H%M%S)
mkdir -p $BACKUP_DIR

# Бэкап PostgreSQL
sudo -u postgres pg_dump teplo_arctici > "$BACKUP_DIR/teplo_${DATE}.sql"

# Удалить бэкапы старше 7 дней
find $BACKUP_DIR -name "teplo_*.sql" -mtime +7 -delete

echo "Backup completed: teplo_${DATE}.sql"
```

Сделать исполняемым и добавить в cron:

```bash
sudo chmod +x /usr/local/bin/backup-teplo-db.sh

# Добавить в crontab (каждый день в 3:00)
sudo crontab -e
# Добавить строку:
0 3 * * * /usr/local/bin/backup-teplo-db.sh >> /var/log/teplo-backup.log 2>&1
```

## Шаг 11: Мониторинг

### Просмотр логов

```bash
# Логи PM2
pm2 logs teplo-arctici --lines 100

# Логи Nginx
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log

# Логи PostgreSQL
sudo tail -f /var/log/postgresql/postgresql-14-main.log
```

### Мониторинг производительности

```bash
# Использование ресурсов
pm2 monit

# Статус сервера
htop
```

## Шаг 12: Обновление приложения

```bash
cd /var/www/teplo-arctici

# Остановить приложение
pm2 stop teplo-arctici

# Получить обновления
git pull origin main

# Установить новые зависимости
npm install --production

# Запустить миграции (если есть)
npm run db:migrate

# Перезапустить
pm2 restart teplo-arctici
```

## Безопасность: Чек-лист

- [ ] Изменены все пароли по умолчанию
- [ ] JWT_SECRET и SESSION_SECRET сгенерированы случайно
- [ ] Firewall настроен (только 22, 80, 443)
- [ ] SSL сертификат установлен и работает
- [ ] PostgreSQL доступен только локально
- [ ] Rate limiting включен
- [ ] Регулярные бэкапы настроены
- [ ] Мониторинг логов настроен
- [ ] Cloudflare DDoS защита включена (опционально)
- [ ] Пароль администратора изменен через админ-панель

## Тестирование production

После развертывания проверьте:

1. **Публичный сайт**:
   - https://ваш-домен.ru
   - Live-лента обновляется
   - Сборы отображаются
   - Отчеты загружаются

2. **Админ-панель**:
   - https://ваш-домен.ru/admin/
   - Авторизация работает
   - Можно создать транзакцию
   - Можно создать сбор
   - Можно создать отчет

3. **API**:
   - https://ваш-домен.ru/api/campaigns
   - https://ваш-домен.ru/api/donations/recent
   - https://ваш-домен.ru/health

4. **Безопасность**:
   - SSL сертификат валиден (зеленый замок)
   - Rate limiting работает (проверить через ab)
   - HTTPS редирект работает

## Поддержка и устранение неполадок

### Сервер не запускается

```bash
# Проверить логи PM2
pm2 logs teplo-arctici --err

# Проверить подключение к БД
psql -U teplo_user -d teplo_arctici -h localhost
```

### Высокая нагрузка CPU/RAM

```bash
# Проверить процессы
pm2 list
htop

# Увеличить количество инстансов PM2
pm2 scale teplo-arctici 2
```

### База данных медленная

```bash
# Проверить активные запросы
sudo -u postgres psql teplo_arctici
SELECT * FROM pg_stat_activity;

# Пересоздать индексы
REINDEX DATABASE teplo_arctici;
```

## Контакты для поддержки

При возникновении проблем обращайтесь к документации:
- [CLAUDE.md](./CLAUDE.md) - Архитектура проекта
- [README.md](./README.md) - Основная документация
- [START.md](./START.md) - Быстрый старт локально
