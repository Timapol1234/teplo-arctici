const { createMockRequest, createMockResponse, mockQueryResult } = require('../../setup/mocks');

jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

const db = require('../../../config/database');
const auditLogController = require('../../../controllers/auditLog');

describe('AuditLog Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    jest.clearAllMocks();
  });

  describe('getAuditLogs', () => {
    it('should return paginated audit logs', async () => {
      mockReq.query = { page: '1', limit: '10' };
      const logs = [
        { id: 1, action: 'LOGIN_SUCCESS', admin_email: 'admin@test.com', created_at: new Date() },
        { id: 2, action: 'CREATE_CAMPAIGN', admin_email: 'admin@test.com', created_at: new Date() }
      ];

      db.query
        .mockResolvedValueOnce(mockQueryResult(logs))
        .mockResolvedValueOnce(mockQueryResult([{ count: '50' }]));

      await auditLogController.getAuditLogs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        logs: logs,
        pagination: {
          page: 1,
          limit: 10,
          total: 50,
          pages: 5
        }
      });
    });

    it('should apply action filter', async () => {
      mockReq.query = { action: 'LOGIN_SUCCESS' };

      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]));

      await auditLogController.getAuditLogs(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('al.action = $'),
        expect.arrayContaining(['LOGIN_SUCCESS'])
      );
    });

    it('should apply resource_type filter', async () => {
      mockReq.query = { resource_type: 'campaign' };

      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]));

      await auditLogController.getAuditLogs(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('al.resource_type = $'),
        expect.arrayContaining(['campaign'])
      );
    });

    it('should apply admin_id filter', async () => {
      mockReq.query = { admin_id: '1' };

      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]));

      await auditLogController.getAuditLogs(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('al.admin_id = $'),
        expect.arrayContaining([1])
      );
    });

    it('should apply date range filters', async () => {
      mockReq.query = {
        date_from: '2024-01-01',
        date_to: '2024-01-31'
      };

      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]));

      await auditLogController.getAuditLogs(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('al.created_at >= $'),
        expect.arrayContaining(['2024-01-01', '2024-01-31'])
      );
    });

    it('should use default pagination values', async () => {
      mockReq.query = {};

      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]));

      await auditLogController.getAuditLogs(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          pagination: expect.objectContaining({
            page: 1,
            limit: 50
          })
        })
      );
    });

    it('should return 500 on database error', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await auditLogController.getAuditLogs(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Ошибка сервера' });
    });
  });

  describe('getAuditLogById', () => {
    it('should return audit log by id', async () => {
      mockReq.params = { id: '1' };
      const log = {
        id: 1,
        action: 'LOGIN_SUCCESS',
        admin_id: 1,
        admin_email: 'admin@test.com',
        admin_name: 'Admin',
        created_at: new Date()
      };

      db.query.mockResolvedValue(mockQueryResult([log]));

      await auditLogController.getAuditLogById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(log);
    });

    it('should return 404 for non-existent log', async () => {
      mockReq.params = { id: '999' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await auditLogController.getAuditLogById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Запись не найдена' });
    });

    it('should return 500 on database error', async () => {
      mockReq.params = { id: '1' };
      db.query.mockRejectedValue(new Error('Database error'));

      await auditLogController.getAuditLogById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getAuditStats', () => {
    it('should return statistics for default 30 days', async () => {
      mockReq.query = {};

      const actionStats = [
        { action: 'LOGIN_SUCCESS', count: '50' },
        { action: 'CREATE_CAMPAIGN', count: '10' }
      ];
      const adminStats = [
        { email: 'admin@test.com', full_name: 'Admin', actions_count: '60' }
      ];
      const dailyActivity = [
        { date: '2024-01-15', count: '25' },
        { date: '2024-01-14', count: '35' }
      ];

      db.query
        .mockResolvedValueOnce(mockQueryResult(actionStats))
        .mockResolvedValueOnce(mockQueryResult(adminStats))
        .mockResolvedValueOnce(mockQueryResult(dailyActivity));

      await auditLogController.getAuditStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        period_days: 30,
        by_action: actionStats,
        by_admin: adminStats,
        daily_activity: dailyActivity
      });
    });

    it('should accept custom days parameter', async () => {
      mockReq.query = { days: '7' };

      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([]));

      await auditLogController.getAuditStats(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({ period_days: 7 })
      );
    });

    it('should return 500 on database error', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await auditLogController.getAuditStats(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
    });
  });
});
