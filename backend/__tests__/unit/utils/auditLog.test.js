const { createMockRequest, mockQueryResult } = require('../../setup/mocks');

jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

const db = require('../../../config/database');
const { auditLog, sanitizeForLog, AuditActions } = require('../../../utils/auditLog');

describe('Audit Log Utils', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('auditLog', () => {
    it('should create audit log entry', async () => {
      const mockReq = createMockRequest({
        ip: '192.168.1.1',
        headers: {
          'user-agent': 'Mozilla/5.0 Test'
        }
      });

      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      const result = await auditLog({
        adminId: 1,
        action: AuditActions.LOGIN_SUCCESS,
        resourceType: 'admin',
        resourceId: 1,
        req: mockReq
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO audit_logs'),
        expect.arrayContaining([1, 'LOGIN_SUCCESS', 'admin', 1])
      );
      expect(result).toHaveProperty('id');
    });

    it('should handle X-Forwarded-For header for proxied requests', async () => {
      const mockReq = createMockRequest({
        ip: '10.0.0.1',
        headers: {
          'x-forwarded-for': '203.0.113.195, 70.41.3.18',
          'user-agent': 'Test Agent'
        }
      });

      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await auditLog({
        adminId: 1,
        action: AuditActions.CREATE_CAMPAIGN,
        req: mockReq
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['203.0.113.195'])
      );
    });

    it('should store old and new values as JSON', async () => {
      const mockReq = createMockRequest();
      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      const oldValues = { title: 'Old Title', amount: 1000 };
      const newValues = { title: 'New Title', amount: 2000 };

      await auditLog({
        adminId: 1,
        action: AuditActions.UPDATE_CAMPAIGN,
        resourceType: 'campaign',
        resourceId: 5,
        oldValues,
        newValues,
        req: mockReq
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([JSON.stringify(oldValues), JSON.stringify(newValues)])
      );
    });

    it('should handle null values for optional parameters', async () => {
      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await auditLog({
        action: AuditActions.LOGIN_FAILED
      });

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([null, 'LOGIN_FAILED', null, null, null, null, null, null])
      );
    });

    it('should not throw on database error', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      const result = await auditLog({
        adminId: 1,
        action: AuditActions.LOGIN_SUCCESS
      });

      expect(result).toBeNull();
    });
  });

  describe('sanitizeForLog', () => {
    it('should redact sensitive fields', () => {
      const obj = {
        email: 'test@example.com',
        password: 'secret123',
        full_name: 'Test User'
      };

      const sanitized = sanitizeForLog(obj);

      expect(sanitized.email).toBe('test@example.com');
      expect(sanitized.password).toBe('[REDACTED]');
      expect(sanitized.full_name).toBe('Test User');
    });

    it('should redact password_hash', () => {
      const obj = {
        email: 'test@example.com',
        password_hash: '$2b$10$...'
      };

      const sanitized = sanitizeForLog(obj);

      expect(sanitized.password_hash).toBe('[REDACTED]');
    });

    it('should redact multiple sensitive fields', () => {
      const obj = {
        old_password: 'oldpass',
        new_password: 'newpass',
        token: 'jwt-token'
      };

      const sanitized = sanitizeForLog(obj);

      expect(sanitized.old_password).toBe('[REDACTED]');
      expect(sanitized.new_password).toBe('[REDACTED]');
      expect(sanitized.token).toBe('[REDACTED]');
    });

    it('should return null for null input', () => {
      expect(sanitizeForLog(null)).toBeNull();
    });

    it('should return non-object input as-is', () => {
      expect(sanitizeForLog('string')).toBe('string');
      expect(sanitizeForLog(123)).toBe(123);
    });
  });

  describe('AuditActions', () => {
    it('should have all required action types', () => {
      expect(AuditActions.LOGIN_SUCCESS).toBe('LOGIN_SUCCESS');
      expect(AuditActions.LOGIN_FAILED).toBe('LOGIN_FAILED');
      expect(AuditActions.PASSWORD_CHANGE).toBe('PASSWORD_CHANGE');
      expect(AuditActions.CREATE_CAMPAIGN).toBe('CREATE_CAMPAIGN');
      expect(AuditActions.UPDATE_CAMPAIGN).toBe('UPDATE_CAMPAIGN');
      expect(AuditActions.DELETE_CAMPAIGN).toBe('DELETE_CAMPAIGN');
      expect(AuditActions.CREATE_DONATION).toBe('CREATE_DONATION');
      expect(AuditActions.CREATE_REPORT).toBe('CREATE_REPORT');
      expect(AuditActions.UPDATE_REPORT).toBe('UPDATE_REPORT');
      expect(AuditActions.DELETE_REPORT).toBe('DELETE_REPORT');
      expect(AuditActions.CREATE_ADMIN).toBe('CREATE_ADMIN');
      expect(AuditActions.UPDATE_ADMIN).toBe('UPDATE_ADMIN');
      expect(AuditActions.DEACTIVATE_ADMIN).toBe('DEACTIVATE_ADMIN');
    });
  });
});
