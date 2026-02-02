-- Migration 001: Audit Logs and Admin Roles
-- Дата: 2026-02-02
-- Описание: Добавляет таблицу аудит логов и поля ролей для админов

-- 1. Добавляем новые поля в таблицу admins (если их нет)
ALTER TABLE admins ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'admin';
ALTER TABLE admins ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login TIMESTAMP;
ALTER TABLE admins ADD COLUMN IF NOT EXISTS last_login_ip VARCHAR(45);
ALTER TABLE admins ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES admins(id);

-- 2. Обновляем существующего админа до super_admin
UPDATE admins SET role = 'super_admin' WHERE role IS NULL OR role = 'admin' LIMIT 1;

-- 3. Создаём таблицу аудит логов
CREATE TABLE IF NOT EXISTS audit_logs (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER REFERENCES admins(id),
  action VARCHAR(50) NOT NULL,
  resource_type VARCHAR(50),
  resource_id INTEGER,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 4. Создаём индексы для аудит логов
CREATE INDEX IF NOT EXISTS idx_audit_logs_admin_id ON audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);

-- 5. Проверка результата
SELECT 'Migration completed successfully' as status;
