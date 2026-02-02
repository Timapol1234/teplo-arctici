const { createMockRequest, createMockResponse, testData, mockQueryResult } = require('../../setup/mocks');

jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  AuditActions: {
    CREATE_REPORT: 'CREATE_REPORT',
    UPDATE_REPORT: 'UPDATE_REPORT',
    DELETE_REPORT: 'DELETE_REPORT'
  }
}));

const db = require('../../../config/database');
const reportsController = require('../../../controllers/reports');

describe('Reports Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    jest.clearAllMocks();
  });

  describe('getReportsByCampaign', () => {
    it('should return reports for specific campaign', async () => {
      mockReq.params = { campaignId: '1' };
      const campaign = { id: 1, title: 'Test Campaign' };
      const reports = [testData.report];

      db.query
        .mockResolvedValueOnce(mockQueryResult([campaign]))
        .mockResolvedValueOnce(mockQueryResult(reports))
        .mockResolvedValueOnce(mockQueryResult([{ total: '5000' }]));

      await reportsController.getReportsByCampaign(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        campaign: { id: 1, title: 'Test Campaign' },
        reports: expect.arrayContaining([
          expect.objectContaining({ id: 1, amount: 5000 })
        ]),
        total_expenses: 5000
      });
    });

    it('should return 404 if campaign not found', async () => {
      mockReq.params = { campaignId: '999' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await reportsController.getReportsByCampaign(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Сбор не найден' });
    });

    it('should return empty reports array for campaign without reports', async () => {
      mockReq.params = { campaignId: '1' };
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, title: 'Test' }]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ total: '0' }]));

      await reportsController.getReportsByCampaign(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        campaign: expect.any(Object),
        reports: [],
        total_expenses: 0
      });
    });
  });

  describe('getAllReports', () => {
    it('should return all reports with campaign info', async () => {
      const reports = [
        { ...testData.report, campaign_title: 'Campaign 1', campaign_id: 1 },
        { ...testData.report, id: 2, campaign_title: 'Campaign 2', campaign_id: 2 }
      ];
      db.query.mockResolvedValue(mockQueryResult(reports));

      await reportsController.getAllReports(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ campaign_title: 'Campaign 1' }),
          expect.objectContaining({ campaign_title: 'Campaign 2' })
        ])
      );
    });

    it('should return empty array when no reports', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await reportsController.getAllReports(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });
  });

  describe('createReport', () => {
    beforeEach(() => {
      mockReq.body = {
        campaign_id: 1,
        expense_date: '2024-01-15',
        amount: 3000,
        description: 'Test expense description',
        vendor_name: 'Test Vendor'
      };
      mockReq.user = { id: 1 };
    });

    it('should create new report', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1 }]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await reportsController.createReport(mockReq, mockRes);

      expect(db.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO reports'),
        expect.arrayContaining([1, '2024-01-15', 3000, 'Test expense description'])
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 404 if campaign not found', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await reportsController.createReport(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Сбор не найден' });
    });

    it('should handle file upload', async () => {
      mockReq.file = { filename: 'receipt-123.pdf' };
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1 }]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await reportsController.createReport(mockReq, mockRes);

      expect(db.query).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining(['/uploads/receipts/receipt-123.pdf'])
      );
    });

    it('should use receipt_url from body if no file uploaded', async () => {
      mockReq.body.receipt_url = 'https://example.com/receipt.pdf';
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1 }]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await reportsController.createReport(mockReq, mockRes);

      expect(db.query).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining(['https://example.com/receipt.pdf'])
      );
    });
  });

  describe('updateReport', () => {
    beforeEach(() => {
      mockReq.params = { id: '1' };
      mockReq.body = {
        expense_date: '2024-01-20',
        amount: 4000,
        description: 'Updated description'
      };
      mockReq.user = { id: 1 };
    });

    it('should update existing report', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.report])) // Get report for audit
        .mockResolvedValueOnce(mockQueryResult([{ ...testData.report, ...mockReq.body }]));

      await reportsController.updateReport(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        report: expect.any(Object)
      });
    });

    it('should return 404 if report not found', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await reportsController.updateReport(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Отчет не найден' });
    });

    it('should prioritize uploaded file over receipt_url', async () => {
      mockReq.body.receipt_url = 'https://old-url.com/receipt.pdf';
      mockReq.file = { filename: 'new-receipt.pdf' };
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.report]))
        .mockResolvedValueOnce(mockQueryResult([testData.report]));

      await reportsController.updateReport(mockReq, mockRes);

      expect(db.query).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining(['/uploads/receipts/new-receipt.pdf'])
      );
    });
  });

  describe('deleteReport', () => {
    beforeEach(() => {
      mockReq.user = { id: 1 };
    });

    it('should delete report', async () => {
      mockReq.params = { id: '1' };
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.report])) // Get report for audit
        .mockResolvedValueOnce(mockQueryResult([])); // Delete

      await reportsController.deleteReport(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: 'Отчет удален' });
    });

    it('should return 404 if report not found', async () => {
      mockReq.params = { id: '999' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await reportsController.deleteReport(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Отчет не найден' });
    });
  });
});
