const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const { requireSuperAdmin } = require('../middleware/checkRole');
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
const auditLogController = require('../controllers/auditLog');
const adminUsersController = require('../controllers/adminUsers');

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

// Audit Logs (доступно всем авторизованным админам)
router.get('/audit-logs', auditLogController.getAuditLogs);
router.get('/audit-logs/stats', auditLogController.getAuditStats);
router.get('/audit-logs/:id', auditLogController.getAuditLogById);

// Admin Users Management (только для super_admin)
router.get('/users', requireSuperAdmin, adminUsersController.getAllAdmins);
router.get('/users/:id', requireSuperAdmin, adminUsersController.getAdminById);
router.post('/users', requireSuperAdmin, adminUsersController.createAdmin);
router.put('/users/:id', requireSuperAdmin, adminUsersController.updateAdmin);
router.delete('/users/:id', requireSuperAdmin, adminUsersController.deactivateAdmin);

module.exports = router;
