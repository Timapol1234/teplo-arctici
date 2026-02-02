const { createMockRequest, createMockResponse, createMockNext } = require('../../setup/mocks');
const { checkRole, requireSuperAdmin, requireAdmin } = require('../../../middleware/checkRole');

describe('CheckRole Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
  });

  describe('checkRole', () => {
    it('should return 401 if no user in request', () => {
      mockReq.user = null;
      const middleware = checkRole('admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if user role not in allowed roles', () => {
      mockReq.user = { id: 1, role: 'admin' };
      const middleware = checkRole('super_admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Недостаточно прав для выполнения этого действия'
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next if user role is allowed', () => {
      mockReq.user = { id: 1, role: 'super_admin' };
      const middleware = checkRole('super_admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should accept multiple roles', () => {
      mockReq.user = { id: 1, role: 'admin' };
      const middleware = checkRole('admin', 'super_admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should default to admin role if user has no role', () => {
      mockReq.user = { id: 1 }; // No role property
      const middleware = checkRole('admin');

      middleware(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });

  describe('requireSuperAdmin', () => {
    it('should allow super_admin role', () => {
      mockReq.user = { id: 1, role: 'super_admin' };

      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should deny admin role', () => {
      mockReq.user = { id: 1, role: 'admin' };

      requireSuperAdmin(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('requireAdmin', () => {
    it('should allow admin role', () => {
      mockReq.user = { id: 1, role: 'admin' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });

    it('should allow super_admin role', () => {
      mockReq.user = { id: 1, role: 'super_admin' };

      requireAdmin(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
    });
  });
});
