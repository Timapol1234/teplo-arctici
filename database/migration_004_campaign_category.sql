-- Добавление категории к сборам (svo / children / general)
ALTER TABLE campaigns ADD COLUMN IF NOT EXISTS category VARCHAR(20) DEFAULT 'general';

-- Индекс для фильтрации по категории
CREATE INDEX IF NOT EXISTS idx_campaigns_category ON campaigns(category);
CREATE INDEX IF NOT EXISTS idx_campaigns_active_category ON campaigns(is_active, category, created_at DESC);
