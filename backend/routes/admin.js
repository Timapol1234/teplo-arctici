const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { handleReceiptUpload, handleCampaignImageUpload } = require('../middleware/upload');
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

// Campaigns
router.get('/campaigns', campaignsController.getAllCampaigns);
router.post('/campaigns', handleCampaignImageUpload, validateCampaign, campaignsController.createCampaign);
router.put('/campaigns/:id', handleCampaignImageUpload, validateCampaign, campaignsController.updateCampaign);
router.delete('/campaigns/:id', campaignsController.deleteCampaign);

// Reports
router.get('/reports', reportsController.getAllReports);
router.post('/reports', handleReceiptUpload, validateReport, reportsController.createReport);
router.put('/reports/:id', handleReceiptUpload, reportsController.updateReport);
router.delete('/reports/:id', reportsController.deleteReport);

module.exports = router;
