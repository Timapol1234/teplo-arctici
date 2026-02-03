const { createMockRequest, createMockResponse, testData, mockQueryResult } = require('../../setup/mocks');

jest.mock('../../../config/database', () => ({
  query: jest.fn()
}));

jest.mock('../../../utils/auditLog', () => ({
  auditLog: jest.fn().mockResolvedValue({ id: 1 }),
  AuditActions: {
    CREATE_CAMPAIGN: 'CREATE_CAMPAIGN',
    UPDATE_CAMPAIGN: 'UPDATE_CAMPAIGN',
    DELETE_CAMPAIGN: 'DELETE_CAMPAIGN'
  }
}));

const db = require('../../../config/database');
const campaignsController = require('../../../controllers/campaigns');

describe('Campaigns Controller', () => {
  let mockReq;
  let mockRes;

  beforeEach(() => {
    mockReq = createMockRequest();
    mockRes = createMockResponse();
    mockReq.user = { id: 1 };
    jest.clearAllMocks();
  });

  describe('getActiveCampaigns', () => {
    it('should return active campaigns with progress percentage', async () => {
      const campaigns = [
        { ...testData.campaign, progress_percentage: 50 },
        { ...testData.campaign, id: 2, title: 'Second Campaign', progress_percentage: 75 }
      ];
      db.query.mockResolvedValue(mockQueryResult(campaigns));

      await campaignsController.getActiveCampaigns(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('is_active = true'));
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ id: 1, progress_percentage: 50 }),
          expect.objectContaining({ id: 2, progress_percentage: 75 })
        ])
      );
    });

    it('should return empty array when no active campaigns', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await campaignsController.getActiveCampaigns(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith([]);
    });

    it('should return 500 on database error', async () => {
      db.query.mockRejectedValue(new Error('Database error'));

      await campaignsController.getActiveCampaigns(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Ошибка сервера' });
    });
  });

  describe('getCampaignById', () => {
    it('should return campaign by id', async () => {
      mockReq.params = { id: '1' };
      db.query.mockResolvedValue(mockQueryResult([testData.campaign]));

      await campaignsController.getCampaignById(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(expect.any(String), ['1']);
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 1,
          title: 'Test Campaign'
        })
      );
    });

    it('should return 404 if campaign not found', async () => {
      mockReq.params = { id: '999' };
      db.query.mockResolvedValue(mockQueryResult([]));

      await campaignsController.getCampaignById(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Сбор не найден' });
    });
  });

  describe('createCampaign', () => {
    beforeEach(() => {
      mockReq.body = {
        title: 'New Campaign',
        description: 'Test description',
        goal_amount: 50000,
        is_active: true
      };
    });

    it('should create new campaign', async () => {
      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await campaignsController.createCampaign(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO campaigns'),
        expect.arrayContaining(['New Campaign', 'Test description', 50000])
      );
      expect(mockRes.status).toHaveBeenCalledWith(201);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        campaign: expect.objectContaining({ id: 1 })
      });
    });

    it('should handle image upload from Cloudinary', async () => {
      mockReq.file = { path: 'https://cloudinary.com/image.jpg' };
      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await campaignsController.createCampaign(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining(['https://cloudinary.com/image.jpg'])
      );
    });

    it('should convert string is_active to boolean', async () => {
      mockReq.body.is_active = 'false';
      db.query.mockResolvedValue(mockQueryResult([{ id: 1, created_at: new Date() }]));

      await campaignsController.createCampaign(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.any(String),
        expect.arrayContaining([false])
      );
    });
  });

  describe('updateCampaign', () => {
    beforeEach(() => {
      mockReq.params = { id: '1' };
      mockReq.body = {
        title: 'Updated Campaign',
        description: 'Updated description',
        goal_amount: 75000,
        is_active: true
      };
    });

    it('should update existing campaign', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([testData.campaign])) // Get full campaign for audit
        .mockResolvedValueOnce(mockQueryResult([{ ...testData.campaign, title: 'Updated Campaign' }]));

      await campaignsController.updateCampaign(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledTimes(2);
      expect(mockRes.json).toHaveBeenCalledWith({
        success: true,
        campaign: expect.any(Object)
      });
    });

    it('should return 404 if campaign not found', async () => {
      db.query.mockResolvedValue(mockQueryResult([]));

      await campaignsController.updateCampaign(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Сбор не найден' });
    });

    it('should preserve existing image if no new image provided', async () => {
      db.query
        .mockResolvedValueOnce(mockQueryResult([{ ...testData.campaign, image_url: 'existing-image.jpg' }]))
        .mockResolvedValueOnce(mockQueryResult([testData.campaign]));

      await campaignsController.updateCampaign(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE campaigns'),
        expect.arrayContaining(['existing-image.jpg'])
      );
    });
  });

  describe('deleteCampaign', () => {
    it('should delete campaign', async () => {
      mockReq.params = { id: '1' };
      // Оптимизировано: один запрос DELETE RETURNING вместо SELECT + DELETE
      db.query.mockResolvedValue(mockQueryResult([testData.campaign]));

      await campaignsController.deleteCampaign(mockReq, mockRes);

      expect(mockRes.json).toHaveBeenCalledWith({ success: true, message: 'Сбор удален' });
    });

    it('should return 404 if campaign not found', async () => {
      mockReq.params = { id: '999' };
      // DELETE RETURNING возвращает пустой массив если запись не найдена
      db.query.mockResolvedValue(mockQueryResult([]));

      await campaignsController.deleteCampaign(mockReq, mockRes);

      expect(mockRes.status).toHaveBeenCalledWith(404);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Сбор не найден' });
    });
  });

  describe('getAllCampaigns', () => {
    it('should return all campaigns including inactive', async () => {
      const campaigns = [
        { ...testData.campaign, is_active: true },
        { ...testData.campaign, id: 2, is_active: false }
      ];
      db.query.mockResolvedValue(mockQueryResult(campaigns));

      await campaignsController.getAllCampaigns(mockReq, mockRes);

      expect(db.query).toHaveBeenCalledWith(expect.stringContaining('FROM campaigns'));
      expect(mockRes.json).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ is_active: true }),
          expect.objectContaining({ is_active: false })
        ])
      );
    });
  });
});
