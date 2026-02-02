const { createMockRequest, createMockResponse, testData, mockQueryResult } = require('../../setup/mocks');

// Mock dependencies before requiring controller
jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));
jest.mock('bcrypt');
jest.mock('jsonwebtoken');
jest.mock('../../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  sanitizeForLog: jest.fn(obj => obj),
  AuditActions: {
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE'
  }
}));

const db = require('../../../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const authController = require('../../../controllers/auth');

describe('Auth Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return 401 for non-existent user', async () => {
      mockReq.body = { email: 'nonexistent@example.com', password: 'password123' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Неверный email или пароль' });
    });

    it('should return 401 for invalid password', async () => {
      mockReq.body = { email: 'admin@example.com', password: 'wrongpassword' };
      db.query.mockResolvedValue(mockQueryResult([testData.admin]));
      bcrypt.compare.mockResolvedValue(false);

      await authController.login(mockReq, mockRes);

      expect(bcrypt.compare).toHaveBeenCalledWith('wrongpassword', testData.admin.password_hash);
      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Неверный email или пароль' });
    });

    it('should return token and admin data for valid credentials', async () => {
      mockReq.body = { email: 'admin@example.com', password: 'correctpassword' };
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.admin]))
        .mockResolvedValueOnce(mockQueryResult([])); // Update last_login
      bcrypt.compare.mockResolvedValue(true);
      jwt.sign.mockReturnValue('mock-jwt-token');

      await authController.login(mockReq, mockRes);

      expect(bcrypt.compare).toHaveBeenCalledWith('correctpassword', testData.admin.password_hash);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          id: testData.admin.id,
          email: testData.admin.email
        }),
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        token: 'mock-jwt-token',
        admin: {
          id: testData.admin.id,
          email: testData.admin.email,
          full_name: testData.admin.full_name,
          role: testData.admin.role
        }
      });
    });

    it('should return 500 on database error', async () => {
      mockReq.body = { email: 'admin@example.com', password: 'password' };
      db.query.mockRejectedValue(new Error('Database error'));

      await authController.login(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Ошибка сервера' });
    });
  });

  describe('verifyToken', () => {
    it('should return user data from request', async () => {
      mockReq.user = { id: 1, email: 'admin@example.com', full_name: 'Admin' };

      await authController.verifyToken(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        user: mockReq.user
      });
    });
  });

  describe('changePassword', () => {
    beforeEach(() => {
      mockReq.user = { id: 1 };
    });

    it('should return 404 if user not found', async () => {
      mockReq.body = { old_password: 'oldpass', new_password: 'newpass123' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Пользователь не найден' });
    });

    it('should return 401 if old password is incorrect', async () => {
      mockReq.body = { old_password: 'wrongpass', new_password: 'newpass123' };
      db.query.mockResolvedValue(mockQueryResult([{ password_hash: 'hashedpass' }]));
      bcrypt.compare.mockResolvedValue(false);

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Неверный текущий пароль' });
    });

    it('should successfully change password', async () => {
      mockReq.body = { old_password: 'oldpass', new_password: 'newpass123' };
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ password_hash: 'oldhash' }]))
        .mockResolvedValueOnce(mockQueryResult([])); // Update password
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('newhash');

      await authController.changePassword(mockReq, mockRes);

      expect(bcrypt.hash).toHaveBeenCalledWith('newpass123', 10);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Пароль успешно изменен'
      });
    });

    it('should return 500 on database error', async () => {
      mockReq.body = { old_password: 'oldpass', new_password: 'newpass123' };
      db.query.mockRejectedValue(new Error('Database error'));

      await authController.changePassword(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Ошибка сервера' });
    });
  });
});
