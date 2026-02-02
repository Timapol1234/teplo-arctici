const { createMockRequest, createMockResponse, mockQueryResult, testData } = require('../../setup/mocks');

jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('bcrypt');

jest.mock('../../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  sanitizeForLog: jest.fn(obj => obj),
  AuditActions: {
    CREATE_ADMIN: 'CREATE_ADMIN',
    UPDATE_ADMIN: 'UPDATE_ADMIN',
    DEACTIVATE_ADMIN: 'DEACTIVATE_ADMIN'
  }
}));

const db = require('../../../config/database');
const bcrypt = require('bcrypt');
const adminUsersController = require('../../../controllers/adminUsers');

describe('AdminUsers Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockReq.user = { id: 1, role: 'super_admin' };
    jest.clearAllMocks();
  });

  describe('getAllAdmins', () => {
    it('should return all active admins by default', async () => {
      const admins = [testData.admin, { ...testData.admin, id: 2, email: 'admin2@test.com' }];
      db.query.mockResolvedValue(mockQueryResult(admins));

      await adminUsersController.getAllAdmins(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_active = true'));
      expect(mockRes.json).toHaveBeenCalledWith(admins);
    });

    it('should include inactive admins when requested', async () => {
      mockReq.query = { include_inactive: 'true' };
      db.query.mockResolvedValue(mockQueryResult([testData.admin]));

      await adminUsersController.getAllAdmins(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(expect.not.stringContaining('is_active = true'));
    });
  });

  describe('getAdminById', () => {
    it('should return admin by id', async () => {
      mockReq.params = { id: '1' };
      db.query.mockResolvedValue(mockQueryResult([testData.admin]));

      await adminUsersController.getAdminById(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith(testData.admin);
    });

    it('should return 404 if admin not found', async () => {
      mockReq.params = { id: '999' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await adminUsersController.getAdminById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Администратор не найден' });
    });
  });

  describe('createAdmin', () => {
    beforeEach(() => {
      mockReq.body = {
        email: 'new@example.com',
        password: 'Password123!',
        full_name: 'New Admin',
        role: 'admin'
      };
    });

    it('should create new admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([])) // Check existing
        .mockResolvedValueOnce(mockQueryResult([{ id: 2, email: 'new@example.com' }])); // Insert

      bcrypt.hash.mockResolvedValue('hashed_password');

      await adminUsersController.createAdmin(mockReq, mockRes);

      expect(bcrypt.hash).toHaveBeenCalledWith('Password123!', 12);
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        admin: expect.any(Object)
      });
    });

    it('should return 400 if email missing', async () => {
      mockReq.body = { password: 'Password123!' };

      await adminUsersController.createAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Email и пароль обязательны' });
    });

    it('should return 400 if password does not meet requirements', async () => {
      mockReq.body.password = 'short';

      await adminUsersController.createAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          error: expect.stringContaining('Пароль не соответствует требованиям')
        })
      );
    });

    it('should return 400 if email already exists', async () => {
      db.query.mockResolvedValue(mockQueryResult([{ id: 1 }]));

      await adminUsersController.createAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Администратор с таким email уже существует' });
    });

    it('should default to admin role for invalid roles', async () => {
      mockReq.body.role = 'invalid_role';
      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 2 }]));

      bcrypt.hash.mockResolvedValue('hashed');

      await adminUsersController.createAdmin(mockReq, mockRes);

      expect(db.query).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining(['admin'])
      );
    });
  });

  describe('updateAdmin', () => {
    beforeEach(() => {
      mockReq.params = { id: '2' };
      mockReq.body = {
        full_name: 'Updated Name'
      };
    });

    it('should update admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.admin]))
        .mockResolvedValueOnce(mockQueryResult([{ ...testData.admin, full_name: 'Updated Name' }]));

      await adminUsersController.updateAdmin(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        admin: expect.any(Object)
      });
    });

    it('should return 404 if admin not found', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await adminUsersController.updateAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should check email uniqueness when changing email', async () => {
      mockReq.body.email = 'new@example.com';
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.admin]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 3 }])); // Another admin with same email

      await adminUsersController.updateAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Администратор с таким email уже существует' });
    });

    it('should hash new password if provided', async () => {
      mockReq.body.password = 'NewPassword123!';
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.admin]))
        .mockResolvedValueOnce(mockQueryResult([testData.admin]));

      bcrypt.hash.mockResolvedValue('new_hashed');

      await adminUsersController.updateAdmin(mockReq, mockRes);

      expect(bcrypt.hash).toHaveBeenCalledWith('NewPassword123!', 12);
    });

    it('should return 400 if no data to update', async () => {
      mockReq.body = {};
      db.query.mockResolvedValue(mockQueryResult([testData.admin]));

      await adminUsersController.updateAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Нет данных для обновления' });
    });
  });

  describe('deactivateAdmin', () => {
    beforeEach(() => {
      mockReq.params = { id: '2' };
    });

    it('should deactivate admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ ...testData.admin, id: 2, role: 'admin' }]))
        .mockResolvedValueOnce(mockQueryResult([]));

      await adminUsersController.deactivateAdmin(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Администратор деактивирован'
      });
    });

    it('should not allow deactivating self', async () => {
      mockReq.params = { id: '1' }; // Same as mockReq.user.id

      await adminUsersController.deactivateAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Нельзя деактивировать свой аккаунт' });
    });

    it('should return 404 if admin not found', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await adminUsersController.deactivateAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
    });

    it('should not allow deactivating last super_admin', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 2, role: 'super_admin', email: 'test@test.com' }]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }])); // No other super_admins

      await adminUsersController.deactivateAdmin(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(400);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Нельзя деактивировать последнего супер-администратора'
      });
    });

    it('should allow deactivating super_admin if others exist', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 2, role: 'super_admin', email: 'test@test.com' }]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '1' }])) // Another super_admin exists
        .mockResolvedValueOnce(mockQueryResult([]));

      await adminUsersController.deactivateAdmin(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Администратор деактивирован'
      });
    });
  });
});
