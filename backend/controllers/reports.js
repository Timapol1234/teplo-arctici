const db = require('../config/database');

// Получить отчеты для конкретного сбора
async function getReportsByCampaign(req, res) {
  try {
    const { campaignId } = req.params;

    // Проверяем существование сбора
    const campaignCheck = await db.query(
      'SELECT id, title FROM campaigns WHERE id = $1',
      [campaignId]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Сбор не найден' });
    }

    const result = await db.query(
      `SELECT
        r.id,
        r.expense_date,
        r.amount,
        r.description,
        r.receipt_url,
        r.vendor_name,
        r.created_at
      FROM reports r
      WHERE r.campaign_id = $1
      ORDER BY r.expense_date DESC`,
      [campaignId]
    );

    const reports = result.rows.map(row => ({
      id: row.id,
      expense_date: row.expense_date,
      amount: parseFloat(row.amount),
      description: row.description,
      receipt_url: row.receipt_url,
      vendor_name: row.vendor_name,
      created_at: row.created_at
    }));

    // Получаем общую сумму расходов
    const totalResult = await db.query(
      'SELECT COALESCE(SUM(amount), 0) as total FROM reports WHERE campaign_id = $1',
      [campaignId]
    );

    res.json({
      campaign: {
        id: campaignCheck.rows[0].id,
        title: campaignCheck.rows[0].title
      },
      reports,
      total_expenses: parseFloat(totalResult.rows[0].total)
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

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Отчет не найден' });
    }

    res.json({
      success: true,
      report: result.rows[0]
    });
  } catch (error) {
    console.error('Ошибка при обновлении отчета:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
}

// Удалить отчет (админ)
async function deleteReport(req, res) {
  try {
    const { id } = req.params;

    const result = await db.query('DELETE FROM reports WHERE id = $1 RETURNING id', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Отчет не найден' });
    }

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
