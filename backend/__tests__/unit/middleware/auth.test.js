const { createMockRequest, createMockResponse, createMockNext } = require('../../setup/mocks');

// Mock jsonwebtoken before requiring middleware
jest.mock('jsonwebtoken');

const jwt = require('jsonwebtoken');
const { authenticateToken } = require('../../../middleware/auth');

describe('Auth Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockNext = createMockNext();
    jest.clearAllMocks();
  });

  describe('authenticateToken', () => {
    it('should return 401 if no authorization header', () => {
      mockReq.headers = {};

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if authorization header is empty', () => {
      mockReq.headers = { authorization: '' };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 if no token after Bearer', () => {
      mockReq.headers = { authorization: 'Bearer ' };

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Требуется авторизация' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 403 if token verification fails', () => {
      mockReq.headers = { authorization: 'Bearer invalid-token' };
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(new Error('Invalid token'), null);
      });

      authenticateToken(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(
        'invalid-token',
        process.env.JWT_SECRET,
        expect.any(Function)
      );
      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Недействительный токен' });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should call next and set user for valid token', () => {
      const userData = { id: 1, email: 'admin@example.com', role: 'admin' };
      mockReq.headers = { authorization: 'Bearer valid-token' };
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(null, userData);
      });

      authenticateToken(mockReq, mockRes, mockNext);

      expect(jwt.verify).toHaveBeenCalledWith(
        'valid-token',
        process.env.JWT_SECRET,
        expect.any(Function)
      );
      expect(mockReq.user).toEqual(userData);
      expect(mockNext).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it('should handle expired token error', () => {
      mockReq.headers = { authorization: 'Bearer expired-token' };
      const expiredError = new Error('jwt expired');
      expiredError.name = 'TokenExpiredError';
      jwt.verify.mockImplementation((token, secret, callback) => {
        callback(expiredError, null);
      });

      authenticateToken(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(403);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Недействительный токен' });
      expect(mockNext).not.toHaveBeenCalled();
    });
  });
});
