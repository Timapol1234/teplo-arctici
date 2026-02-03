const db = require('../config/database');
const { auditLog, AuditActions } = require('../utils/auditLog');

// Получить отчеты для конкретного сбора (оптимизировано: 1 запрос вместо 3)
async function getReportsByCampaign(req, res) {
  try {
    const { campaignId } = req.params;

    // Один запрос: получаем кампанию, все отчёты и общую сумму
    const result = await db.query(
      `SELECT
        c.id as campaign_id,
        c.title as campaign_title,
        r.id,
        r.expense_date,
        r.amount,
        r.description,
        r.receipt_url,
        r.vendor_name,
        r.created_at,
        COALESCE(SUM(r.amount) OVER(), 0) as total_expenses
      FROM campaigns c
      LEFT JOIN reports r ON r.campaign_id = c.id
      WHERE c.id = $1
      ORDER BY r.expense_date DESC NULLS LAST`,
      [campaignId]
    );

    // Если кампания не найдена
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден' });
    }

    const firstRow = result.rows[0];

    // Формируем отчёты (фильтруем NULL если нет отчётов)
    const reports = result.rows
      .filter(row => row.id !== null)
      .map(row => ({
        id: row.id,
        expense_date: row.expense_date,
        amount: parseFloat(row.amount),
        description: row.description,
        receipt_url: row.receipt_url,
        vendor_name: row.vendor_name,
        created_at: row.created_at
      }));

    res.json({
      campaign: {
        id: firstRow.campaign_id,
        title: firstRow.campaign_title
      },
      reports,
      total_expenses: parseFloat(firstRow.total_expenses) || 0
    });
  } catch (error) {
    console.error('Ошибка при получении отчетов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Получить все отчеты (админ)
async function getAllReports(req, res) {
  try {
    const result = await db.query(
      `SELECT
        r.id,
        r.expense_date,
        r.amount,
        r.description,
        r.receipt_url,
        r.vendor_name,
        r.created_at,
        c.title as campaign_title,
        c.id as campaign_id
      FROM reports r
      JOIN campaigns c ON r.campaign_id = c.id
      ORDER BY r.expense_date DESC`
    );

    const reports = result.rows.map(row => ({
      id: row.id,
      expense_date: row.expense_date,
      amount: parseFloat(row.amount),
      description: row.description,
      receipt_url: row.receipt_url,
      vendor_name: row.vendor_name,
      campaign_title: row.campaign_title,
      campaign_id: row.campaign_id,
      created_at: row.created_at
    }));

    res.json(reports);
  } catch (error) {
    console.error('Ошибка при получении всех отчетов:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Создать новый отчет (админ)
async function createReport(req, res) {
  try {
    const { campaign_id, expense_date, amount, description, receipt_url, vendor_name } = req.body;

    // Проверяем существование сбора
    const campaignCheck = await db.query(
      'SELECT id FROM campaigns WHERE id = $1',
      [campaign_id]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден' });
    }

    // Определяем URL документа: загруженный файл имеет приоритет над ссылкой
    let finalReceiptUrl = receipt_url || null;
    if (req.file) {
      finalReceiptUrl = `/uploads/receipts/${req.file.filename}`;
    }

    const result = await db.query(
      `INSERT INTO reports
       (campaign_id, expense_date, amount, description, receipt_url, vendor_name, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, created_at`,
      [campaign_id, expense_date, amount, description, finalReceiptUrl, vendor_name || null, req.user?.id || null]
    );

    // Логируем создание отчета
    await auditLog({
      adminId: req.user?.id,
      action: AuditActions.CREATE_REPORT,
      resourceType: 'report',
      resourceId: result.rows[0].id,
      newValues: {
        campaign_id,
        expense_date,
        amount,
        description,
        vendor_name: vendor_name || null
      },
      req
    });

    res.status(201).json({
      success: true,
      report: {
        id: result.rows[0].id,
        created_at: result.rows[0].created_at
      }
    });
  } catch (error) {
    console.error('Ошибка при создании отчета:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Обновить отчет (админ)
async function updateReport(req, res) {
  try {
    const { id } = req.params;
    const { expense_date, amount, description, receipt_url, vendor_name } = req.body;

    // Получаем текущие данные для аудита
    const checkResult = await db.query('SELECT * FROM reports WHERE id = $1', [id]);
    if (checkResult.rows.length === 0) {
      return res.status(404).json({ error: 'Отчет не найден' });
    }

    const oldReport = checkResult.rows[0];

    // Определяем URL документа: загруженный файл имеет приоритет над ссылкой
    let finalReceiptUrl = receipt_url;
    if (req.file) {
      finalReceiptUrl = `/uploads/receipts/${req.file.filename}`;
    }

    const result = await db.query(
      `UPDATE reports
       SET
         expense_date = COALESCE($1, expense_date),
         amount = COALESCE($2, amount),
         description = COALESCE($3, description),
         receipt_url = COALESCE($4, receipt_url),
         vendor_name = COALESCE($5, vendor_name)
       WHERE id = $6
       RETURNING *`,
      [expense_date, amount, description, finalReceiptUrl, vendor_name, id]
    );

    // Логируем обновление отчета
    await auditLog({
      adminId: req.user?.id,
      action: AuditActions.UPDATE_REPORT,
      resourceType: 'report',
      resourceId: parseInt(id),
      oldValues: {
        expense_date: oldReport.expense_date,
        amount: oldReport.amount,
        description: oldReport.description,
        vendor_name: oldReport.vendor_name
      },
      newValues: { expense_date, amount, description, vendor_name },
      req
    });

    res.json({
      success: true,
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка при обновлении отчета:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Удалить отчет (админ) - оптимизировано: 1 запрос вместо 2
async function deleteReport(req, res) {
  try {
    const { id } = req.params;

    // Удаляем и получаем данные для аудита одним запросом
    const result = await db.query(
      'DELETE FROM reports WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Отчет не найден' });
    }

    const oldReport = result.rows[0];

    // Логируем удаление отчета
    await auditLog({
      adminId: req.user?.id,
      action: AuditActions.DELETE_REPORT,
      resourceType: 'report',
      resourceId: parseInt(id),
      oldValues: {
        campaign_id: oldReport.campaign_id,
        expense_date: oldReport.expense_date,
        amount: oldReport.amount,
        description: oldReport.description,
        vendor_name: oldReport.vendor_name
      },
      req
    });

    res.json({ success: true, message: 'Отчет удален' });
  } catch (error) {
    console.error('Ошибка при удалении отчета:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

module.exports = {
  getReportsByCampaign,
  getAllReports,
  createReport,
  updateReport,
  deleteReport
};
