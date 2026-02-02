const db = require('../config/database');
const { auditLog, AuditActions } = require('../utils/auditLog');

// Получить все активные сборы
async function getActiveCampaigns(req, res) {
  try {
    const result = await db.query(
      `SELECT
        id,
        title,
        description,
        goal_amount,
        current_amount,
        image_url,
        end_date,
        created_at,
        CASE
          WHEN goal_amount > 0 THEN ROUND((current_amount * 100.0 / goal_amount), 0)
          ELSE 0
        END as progress_percentage
      FROM campaigns
      WHERE is_active = true
      ORDER BY created_at DESC`
    );

    const campaigns = result.rows.map(row => ({
      id: row.id,
      title: row.title,
      description: row.description,
      goal_amount: parseFloat(row.goal_amount),
      current_amount: parseFloat(row.current_amount),
      image_url: row.image_url,
      end_date: row.end_date,
      created_at: row.created_at,
      progress_percentage: parseInt(row.progress_percentage)
    }));

    res.json(campaigns);
  } catch (error) {
    console.error('Ошибка при получении сборов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить один сбор по ID
async function getCampaignById(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        id,
        title,
        description,
        goal_amount,
        current_amount,
        image_url,
        is_active,
        end_date,
        created_at,
        updated_at
      FROM campaigns
      WHERE id = $1`,
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден' });
    }

    const campaign = result.rows[0];
    campaign.goal_amount = parseFloat(campaign.goal_amount);
    campaign.current_amount = parseFloat(campaign.current_amount);
    campaign.progress_percentage = campaign.goal_amount > 0
      ? Math.round((campaign.current_amount / campaign.goal_amount) * 100)
      : 0;

    res.json(campaign);
  } catch (error) {
    console.error('Ошибка при получении сбора:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Создать новый сбор (админ)
async function createCampaign(req, res) {
  try {
    const { title, description, goal_amount, is_active, end_date } = req.body;

    // Получаем URL изображения: из Cloudinary или из body
    let imageUrl = req.body.image_url || null;
    if (req.file && req.file.path) {
      imageUrl = req.file.path; // URL от Cloudinary
    }

    // Конвертируем is_active в boolean для PostgreSQL
    const isActiveValue = is_active !== false && is_active !== 'false';

    const result = await db.query(
      `INSERT INTO campaigns
       (title, description, goal_amount, image_url, is_active, end_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, created_at`,
      [title, description, goal_amount, imageUrl, isActiveValue, end_date || null]
    );

    // Логируем создание кампании
    await auditLog({
      adminId: req.user?.id,
      action: AuditActions.CREATE_CAMPAIGN,
      resourceType: 'campaign',
      resourceId: result.rows[0].id,
      newValues: { title, description, goal_amount, is_active: isActiveValue, image_url: imageUrl },
      req
    });

    res.status(201).json({
      success: true,
      campaign: {
        id: result.rows[0].id,
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Ошибка при создании сбора:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Обновить сбор (админ)
async function updateCampaign(req, res) {
  try {
    const { id } = req.params;
    const { title, description, goal_amount, is_active, end_date } = req.body;

    // Проверяем существование сбора и получаем текущие данные для аудита
    const checkResult = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден' });
    }

    const oldCampaign = checkResult.rows[0];

    // Получаем URL изображения
    let imageUrl = oldCampaign.image_url; // Сохраняем текущее по умолчанию
    if (req.file && req.file.path) {
      imageUrl = req.file.path; // Новое изображение от Cloudinary
    } else if (req.body.image_url !== undefined) {
      imageUrl = req.body.image_url || null; // URL из body или удаление
    }

    // Конвертируем is_active в boolean
    const isActive = is_active !== false && is_active !== 'false';

    const result = await db.query(
      `UPDATE campaigns
       SET
         title = COALESCE($1, title),
         description = COALESCE($2, description),
         goal_amount = COALESCE($3, goal_amount),
         image_url = $4,
         is_active = $5,
         end_date = $6
       WHERE id = $7
       RETURNING *`,
      [title, description, goal_amount, imageUrl, isActive, end_date || null, id]
    );

    // Логируем обновление кампании
    await auditLog({
      adminId: req.user?.id,
      action: AuditActions.UPDATE_CAMPAIGN,
      resourceType: 'campaign',
      resourceId: parseInt(id),
      oldValues: {
        title: oldCampaign.title,
        description: oldCampaign.description,
        goal_amount: oldCampaign.goal_amount,
        is_active: oldCampaign.is_active,
        image_url: oldCampaign.image_url
      },
      newValues: { title, description, goal_amount, is_active: isActive, image_url: imageUrl },
      req
    });

    res.json({
      success: true,
      campaign: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка при обновлении сбора:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить все сборы (админ)
async function getAllCampaigns(req, res) {
  try {
    const result = await db.query(
      `SELECT
        id,
        title,
        description,
        goal_amount,
        current_amount,
        image_url,
        is_active,
        end_date,
        created_at,
        updated_at
      FROM campaigns
      ORDER BY created_at DESC`
    );

    const campaigns = result.rows.map(row => ({
      ...row,
      goal_amount: parseFloat(row.goal_amount),
      current_amount: parseFloat(row.current_amount)
    }));

    res.json(campaigns);
  } catch (error) {
    console.error('Ошибка при получении всех сборов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Удалить сбор (админ)
async function deleteCampaign(req, res) {
  try {
    const { id } = req.params;

    // Получаем данные кампании для аудита перед удалением
    const checkResult = await db.query('SELECT * FROM campaigns WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден' });
    }

    const oldCampaign = checkResult.rows[0];

    const result = await db.query('DELETE FROM campaigns WHERE id = $1 RETURNING id', [id]);

    // Логируем удаление кампании
    await auditLog({
      adminId: req.user?.id,
      action: AuditActions.DELETE_CAMPAIGN,
      resourceType: 'campaign',
      resourceId: parseInt(id),
      oldValues: {
        title: oldCampaign.title,
        description: oldCampaign.description,
        goal_amount: oldCampaign.goal_amount,
        current_amount: oldCampaign.current_amount
      },
      req
    });

    res.json({ success: true, message: 'Сбор удален' });
  } catch (error) {
    console.error('Ошибка при удалении сбора:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  getActiveCampaigns,
  getCampaignById,
  createCampaign,
  updateCampaign,
  getAllCampaigns,
  deleteCampaign
};
