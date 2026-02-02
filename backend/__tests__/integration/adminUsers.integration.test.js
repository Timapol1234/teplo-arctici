const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('../setup/testApp');
const { mockQueryResult, testData } = require('../setup/mocks');

// Mock database
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

// Mock bcrypt
jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn()
}));

// Mock cloudinary
jest.mock('../../config/cloudinary', () => ({
  uploadCampaignImage: (req, res, next) => next(),
  uploadReportReceipt: (req, res, next) => next()
}));

// Mock auditLog
jest.mock('../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  sanitizeForLog: jest.fn(obj => obj),
  AuditActions: {
    CREATE_ADMIN: 'CREATE_ADMIN',
    UPDATE_ADMIN: 'UPDATE_ADMIN',
    DEACTIVATE_ADMIN: 'DEACTIVATE_ADMIN'
  }
}));

const db = require('../../config/database');

describe('Admin Users API Integration Tests', () => {
  let app;
  let superAdminToken;
  let adminToken;

  beforeAll(() => {
    app = createTestApp();

    superAdminToken = jwt.sign(
      { id: 1, email: 'superadmin@example.com', role: 'super_admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    adminToken = jwt.sign(
      { id: 2, email: 'admin@example.com', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/admin/users', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/admin/users');

      expect(response.status).toBe(401);
    });

    it('should return 403 for regular admin', async () => {
      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error).toBe('Недостаточно прав для выполнения этого действия');
    });

    it('should return admins list for super_admin', async () => {
      const admins = [
        testData.admin,
        { ...testData.admin, id: 2, email: 'admin2@test.com', role: 'admin' }
      ];
      db.query.mockResolvedValue(mockQueryResult(admins));

      const response = await request(app)
        .get('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should include inactive admins when requested', async () => {
      db.query.mockResolvedValue(mockQueryResult([testData.admin]));

      const response = await request(app)
        .get('/api/admin/users?include_inactive=true')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(db.query).toHaveBeenCalledWith(
        expect.not.stringContaining('is_active = true')
      );
    });
  });

  describe('POST /api/admin/users', () => {
    const newAdmin = {
      email: 'newadmin@example.com',
      password: 'password123',
      full_name: 'New Admin',
      role: 'admin'
    };

    it('should return 403 for regular admin', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newAdmin);

      expect(response.status).toBe(403);
    });

    it('should return 400 if email missing', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Email и пароль обязательны');
    });

    it('should return 400 if password too short', async () => {
      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ email: 'test@test.com', password: 'short' });

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Пароль должен быть минимум 8 символов');
    });

    it('should return 400 if email already exists', async () => {
      db.query.mockResolvedValue(mockQueryResult([{ id: 1 }]));

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(newAdmin);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Администратор с таким email уже существует');
    });

    it('should create new admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([])) // Check existing
        .mockResolvedValueOnce(mockQueryResult([{ id: 3, email: newAdmin.email }])); // Insert

      const response = await request(app)
        .post('/api/admin/users')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send(newAdmin);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.admin.email).toBe(newAdmin.email);
    });
  });

  describe('PUT /api/admin/users/:id', () => {
    it('should return 403 for regular admin', async () => {
      const response = await request(app)
        .put('/api/admin/users/2')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ full_name: 'Updated Name' });

      expect(response.status).toBe(403);
    });

    it('should return 404 for non-existent admin', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .put('/api/admin/users/999')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ full_name: 'Updated Name' });

      expect(response.status).toBe(404);
    });

    it('should update admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.admin]))
        .mockResolvedValueOnce(mockQueryResult([{ ...testData.admin, full_name: 'Updated' }]));

      const response = await request(app)
        .put('/api/admin/users/1')
        .set('Authorization', `Bearer ${superAdminToken}`)
        .send({ full_name: 'Updated Name' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/users/:id', () => {
    it('should return 403 for regular admin', async () => {
      const response = await request(app)
        .delete('/api/admin/users/2')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(403);
    });

    it('should return 400 when trying to deactivate self', async () => {
      const response = await request(app)
        .delete('/api/admin/users/1') // Same as superAdminToken user id
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Нельзя деактивировать свой аккаунт');
    });

    it('should return 400 when deactivating last super_admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 2, role: 'super_admin', email: 'test@test.com' }]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }])); // No other super_admins

      const response = await request(app)
        .delete('/api/admin/users/2')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Нельзя деактивировать последнего супер-администратора');
    });

    it('should deactivate admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 3, role: 'admin', email: 'admin@test.com' }]))
        .mockResolvedValueOnce(mockQueryResult([]));

      const response = await request(app)
        .delete('/api/admin/users/3')
        .set('Authorization', `Bearer ${superAdminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Администратор деактивирован');
    });
  });
});
