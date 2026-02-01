const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { uploadCampaignImage, uploadReportReceipt } = require('../config/cloudinary');
const {
  validateDonation,
  validateCampaign,
  validateReport,
  validateLogin
} = require('../middleware/validation');
const authController = require('../controllers/auth');
const donationsController = require('../controllers/donations');
const campaignsController = require('../controllers/campaigns');
const reportsController = require('../controllers/reports');

// Auth (без требования токена)
router.post('/login', validateLogin, authController.login);

// Все остальные роуты требуют авторизации
router.use(authenticateToken);

// Auth (с токеном)
router.get('/verify', authController.verifyToken);
router.post('/change-password', authController.changePassword);

// Donations
router.get('/donations', donationsController.getAllDonations);
router.post('/donations', validateDonation, donationsController.createDonation);

// Campaigns (с загрузкой изображений через Cloudinary)
router.get('/campaigns', campaignsController.getAllCampaigns);
router.post('/campaigns', uploadCampaignImage, validateCampaign, campaignsController.createCampaign);
router.put('/campaigns/:id', uploadCampaignImage, validateCampaign, campaignsController.updateCampaign);
router.delete('/campaigns/:id', campaignsController.deleteCampaign);

// Reports (с загрузкой чеков через Cloudinary)
router.get('/reports', reportsController.getAllReports);
router.post('/reports', uploadReportReceipt, validateReport, reportsController.createReport);
router.put('/reports/:id', uploadReportReceipt, reportsController.updateReport);
router.delete('/reports/:id', reportsController.deleteReport);

module.exports = router;
