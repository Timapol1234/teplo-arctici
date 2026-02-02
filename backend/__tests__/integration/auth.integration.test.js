const request = require('supertest');
const { createTestApp } = require('../setup/testApp');
const { mockQueryResult, testData } = require('../setup/mocks');

// Mock database
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn()
}));

// Mock auditLog
jest.mock('../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  sanitizeForLog: jest.fn(obj => obj),
  AuditActions: {
    LOGIN_SUCCESS: 'LOGIN_SUCCESS',
    LOGIN_FAILED: 'LOGIN_FAILED',
    PASSWORD_CHANGE: 'PASSWORD_CHANGE'
  }
}));

const db = require('../../config/database');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

describe('Auth API Integration Tests', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/admin/login', () => {
    it('should return 400 for missing credentials', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({});

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 400 for invalid email format', async () => {
      const response = await request(app)
        .post('/api/admin/login')
        .send({ email: 'invalid-email', password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should return 401 for non-existent user', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .post('/api/admin/login')
        .send({ email: 'nonexistent@example.com', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Неверный email или пароль');
    });

    it('should return 401 for wrong password', async () => {
      db.query.mockResolvedValue(mockQueryResult([testData.admin]));
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/admin/login')
        .send({ email: 'admin@teplo-arctici.ru', password: 'wrongpassword' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Неверный email или пароль');
    });

    it('should return 401 for deactivated account', async () => {
      db.query.mockResolvedValue(mockQueryResult([{ ...testData.admin, is_active: false }]));
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/admin/login')
        .send({ email: 'admin@teplo-arctici.ru', password: 'password123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Аккаунт деактивирован');
    });

    it('should return token for valid credentials', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.admin]))
        .mockResolvedValueOnce(mockQueryResult([])); // Update last_login
      bcrypt.compare.mockResolvedValue(true);

      const response = await request(app)
        .post('/api/admin/login')
        .send({ email: 'admin@teplo-arctici.ru', password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.token).toBeDefined();
      expect(response.body.admin).toMatchObject({
        id: testData.admin.id,
        email: testData.admin.email
      });
    });
  });

  describe('GET /api/admin/verify', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/admin/verify');

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Требуется авторизация');
    });

    it('should return 403 for invalid token', async () => {
      const response = await request(app)
        .get('/api/admin/verify')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Недействительный токен');
    });

    it('should return user data for valid token', async () => {
      const token = jwt.sign(
        { id: 1, email: 'admin@example.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      const response = await request(app)
        .get('/api/admin/verify')
        .set('Authorization', `Bearer ${token}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toMatchObject({
        id: 1,
        email: 'admin@example.com'
      });
    });
  });

  describe('POST /api/admin/change-password', () => {
    let validToken;

    beforeAll(() => {
      validToken = jwt.sign(
        { id: 1, email: 'admin@example.com', role: 'admin' },
        process.env.JWT_SECRET,
        { expiresIn: '1h' }
      );
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/admin/change-password')
        .send({ old_password: 'old', new_password: 'new12345' });

      expect(response.status).toBe(401);
    });

    it('should return 404 if user not found', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .post('/api/admin/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ old_password: 'oldpass', new_password: 'newpass123' });

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Пользователь не найден');
    });

    it('should return 401 for wrong old password', async () => {
      db.query.mockResolvedValue(mockQueryResult([{ password_hash: 'hash' }]));
      bcrypt.compare.mockResolvedValue(false);

      const response = await request(app)
        .post('/api/admin/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ old_password: 'wrongold', new_password: 'newpass123' });

      expect(response.status).toBe(401);
      expect(response.body.error).toBe('Неверный текущий пароль');
    });

    it('should successfully change password', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ password_hash: 'oldhash' }]))
        .mockResolvedValueOnce(mockQueryResult([]));
      bcrypt.compare.mockResolvedValue(true);
      bcrypt.hash.mockResolvedValue('newhash');

      const response = await request(app)
        .post('/api/admin/change-password')
        .set('Authorization', `Bearer ${validToken}`)
        .send({ old_password: 'oldpass', new_password: 'newpass123' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Пароль успешно изменен');
    });
  });
});
