const request = require('supertest');
const jwt = require('jsonwebtoken');
const { createTestApp } = require('../setup/testApp');
const { mockQueryResult, testData } = require('../setup/mocks');

// Mock database
jest.mock('../../config/database', () => ({
  query: jest.fn()
}));

// Mock cloudinary upload
jest.mock('../../config/cloudinary', () => ({
  uploadCampaignImage: (req, res, next) => next(),
  uploadReportReceipt: (req, res, next) => next()
}));

// Mock auditLog
jest.mock('../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  AuditActions: {
    CREATE_CAMPAIGN: 'CREATE_CAMPAIGN',
    UPDATE_CAMPAIGN: 'UPDATE_CAMPAIGN',
    DELETE_CAMPAIGN: 'DELETE_CAMPAIGN'
  }
}));

const db = require('../../config/database');

describe('Campaigns API Integration Tests', () => {
  let app;
  let adminToken;

  beforeAll(() => {
    app = createTestApp();
    adminToken = jwt.sign(
      { id: 1, email: 'admin@example.com', role: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    );
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/campaigns (public)', () => {
    it('should return active campaigns', async () => {
      const campaigns = [
        { ...testData.campaign, progress_percentage: 50 },
        { ...testData.campaign, id: 2, title: 'Second Campaign', progress_percentage: 75 }
      ];
      db.query.mockResolvedValue(mockQueryResult(campaigns));

      const response = await request(app)
        .get('/api/campaigns');

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should return empty array when no campaigns', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .get('/api/campaigns');

      expect(response.status).toBe(200);
      expect(response.body).toEqual([]);
    });
  });

  describe('GET /api/campaigns/:id (public)', () => {
    it('should return campaign by id', async () => {
      db.query.mockResolvedValue(mockQueryResult([testData.campaign]));

      const response = await request(app)
        .get('/api/campaigns/1');

      expect(response.status).toBe(200);
      expect(response.body.id).toBe(1);
      expect(response.body.title).toBe('Test Campaign');
    });

    it('should return 404 for non-existent campaign', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .get('/api/campaigns/999');

      expect(response.status).toBe(404);
      expect(response.body.error).toBe('Сбор не найден');
    });
  });

  describe('GET /api/admin/campaigns (admin)', () => {
    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/api/admin/campaigns');

      expect(response.status).toBe(401);
    });

    it('should return all campaigns for admin', async () => {
      const campaigns = [
        { ...testData.campaign, is_active: true },
        { ...testData.campaign, id: 2, is_active: false }
      ];
      db.query.mockResolvedValue(mockQueryResult(campaigns));

      const response = await request(app)
        .get('/api/admin/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.length).toBe(2);
    });
  });

  describe('POST /api/admin/campaigns (admin)', () => {
    const newCampaign = {
      title: 'New Test Campaign',
      description: 'This is a test campaign description that is long enough',
      goal_amount: 50000,
      is_active: true
    };

    it('should return 401 without token', async () => {
      const response = await request(app)
        .post('/api/admin/campaigns')
        .send(newCampaign);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/admin/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ title: 'Ab' }); // Too short

      expect(response.status).toBe(400);
      expect(response.body.errors).toBeDefined();
    });

    it('should create campaign with valid data', async () => {
      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      const response = await request(app)
        .post('/api/admin/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send(newCampaign);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.campaign.id).toBe(1);
    });
  });

  describe('PUT /api/admin/campaigns/:id (admin)', () => {
    it('should return 404 for non-existent campaign', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .put('/api/admin/campaigns/999')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Title That Is Long Enough',
          description: 'Updated description that is long enough for validation to pass',
          goal_amount: 50000
        });

      expect(response.status).toBe(404);
    });

    it('should update campaign', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.campaign]))
        .mockResolvedValueOnce(mockQueryResult([{ ...testData.campaign, title: 'Updated' }]));

      const response = await request(app)
        .put('/api/admin/campaigns/1')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'Updated Campaign Title Here',
          description: 'Updated description that is long enough for validation',
          goal_amount: 75000
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });
  });

  describe('DELETE /api/admin/campaigns/:id (admin)', () => {
    it('should return 404 for non-existent campaign', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      const response = await request(app)
        .delete('/api/admin/campaigns/999')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(404);
    });

    it('should delete campaign', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.campaign]))
        .mockResolvedValueOnce(mockQueryResult([{ id: 1 }]));

      const response = await request(app)
        .delete('/api/admin/campaigns/1')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Сбор удален');
    });
  });
});
