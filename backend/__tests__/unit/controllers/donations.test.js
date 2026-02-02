const { createMockRequest, createMockResponse, testData, mockQueryResult } = require('../../setup/mocks');

jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/crypto', () => ({
  encryptEmail: jest.fn((email) => email ? `encrypted:${email}` : null),
  decryptEmail: jest.fn((encrypted) => encrypted ? encrypted.replace('encrypted:', '') : null)
}));

jest.mock('../../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  AuditActions: {
    CREATE_DONATION: 'CREATE_DONATION'
  }
}));

const db = require('../../../config/database');
const crypto = require('../../../utils/crypto');
const donationsController = require('../../../controllers/donations');

describe('Donations Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockReq.user = { id: 1 };
    jest.clearAllMocks();
  });

  describe('getRecentDonations', () => {
    it('should return recent donations with decrypted emails', async () => {
      const donations = [
        {
          id: 1,
          amount: 1000,
          is_anonymous: false,
          donor_email_encrypted: 'encrypted:test@example.com',
          payment_method: 'card',
          created_at: new Date(),
          campaign_title: 'Test Campaign',
          campaign_id: 1
        }
      ];
      db.query.mockResolvedValue(mockQueryResult(donations));

      await donationsController.getRecentDonations(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([
        expect.objectContaining({
          id: 1,
          amount: 1000,
          donor: 'test@example.com'
        })
      ]);
    });

    it('should show anonymous donor for anonymous donations', async () => {
      const donations = [
        {
          id: 1,
          amount: 1000,
          is_anonymous: true,
          donor_email_encrypted: 'encrypted:test@example.com',
          payment_method: 'card',
          created_at: new Date(),
          campaign_title: 'Test Campaign',
          campaign_id: 1
        }
      ];
      db.query.mockResolvedValue(mockQueryResult(donations));

      await donationsController.getRecentDonations(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([
        expect.objectContaining({
          donor: 'Анонимный донор'
        })
      ]);
    });

    it('should use limit from query params', async () => {
      mockReq.query = { limit: '10' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await donationsController.getRecentDonations(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(expect.any(String), [10]);
    });

    it('should default to 20 limit', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await donationsController.getRecentDonations(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(expect.any(String), [20]);
    });
  });

  describe('getStatistics', () => {
    it('should return donation statistics', async () => {
      const stats = {
        total_amount: '500000',
        unique_donors: '150',
        total_donations: '200'
      };
      db.query.mockResolvedValue(mockQueryResult([stats]));

      await donationsController.getStatistics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        total_amount: 500000,
        unique_donors: 150,
        total_donations: 200
      });
    });

    it('should return zeros for empty database', async () => {
      const stats = {
        total_amount: '0',
        unique_donors: '0',
        total_donations: '0'
      };
      db.query.mockResolvedValue(mockQueryResult([stats]));

      await donationsController.getStatistics(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({
        total_amount: 0,
        unique_donors: 0,
        total_donations: 0
      });
    });
  });

  describe('createDonation', () => {
    beforeEach(() => {
      mockReq.body = {
        amount: 5000,
        campaign_id: 1,
        donor_email: 'donor@example.com',
        is_anonymous: false,
        payment_method: 'card'
      };
    });

    it('should create donation with encrypted email', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1 }])) // Campaign check
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, created_at: new Date() }])); // Insert

      await donationsController.createDonation(mockReq, mockRes);

      expect(crypto.encryptEmail).toHaveBeenCalledWith('donor@example.com');
      expect(db.query).toHaveBeenLastCalledWith(
        expect.stringContaining('INSERT INTO donations'),
        expect.arrayContaining([1, 5000, 'encrypted:donor@example.com', false, 'card'])
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
    });

    it('should return 404 if campaign not found', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await donationsController.createDonation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Сбор не найден' });
    });

    it('should not encrypt email for anonymous donations', async () => {
      mockReq.body.is_anonymous = true;
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1 }]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await donationsController.createDonation(mockReq, mockRes);

      expect(db.query).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining([null, true])
      );
    });

    it('should use manual payment method by default', async () => {
      delete mockReq.body.payment_method;
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1 }]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await donationsController.createDonation(mockReq, mockRes);

      expect(db.query).toHaveBeenLastCalledWith(
        expect.any(String),
        expect.arrayContaining(['manual'])
      );
    });
  });

  describe('getAllDonations', () => {
    it('should return paginated donations', async () => {
      mockReq.query = { page: '2', limit: '10' };
      const donations = [{ ...testData.donation, campaign_title: 'Test', campaign_id: 1 }];
      db.query
        .mockResolvedValueOnce(mockQueryResult(donations))
        .mockResolvedValueOnce(mockQueryResult([{ count: '50' }]));

      await donationsController.getAllDonations(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [10, 10] // limit, offset (page 2 with limit 10 = offset 10)
      );
      expect(mockRes.json).toHaveBeenCalledWith({
        donations: expect.any(Array),
        pagination: {
          page: 2,
          limit: 10,
          total: 50,
          pages: 5
        }
      });
    });

    it('should default to page 1 and limit 50', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([]))
        .mockResolvedValueOnce(mockQueryResult([{ count: '0' }]));

      await donationsController.getAllDonations(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        [50, 0]
      );
    });
  });

  describe('createPublicDonation', () => {
    beforeEach(() => {
      mockReq.body = {
        amount: 1000,
        campaign_id: 1,
        donor_email: 'public@example.com',
        is_anonymous: false
      };
    });

    it('should create public donation for active campaign', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, title: 'Active Campaign' }]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await donationsController.createPublicDonation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        message: 'Спасибо за ваше пожертвование!',
        donation: expect.objectContaining({
          campaign: 'Active Campaign'
        })
      });
    });

    it('should return 404 for inactive campaign', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await donationsController.createPublicDonation(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Сбор не найден или неактивен' });
    });
  });
});
