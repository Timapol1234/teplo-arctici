const express = require('express');
const router = express.Router();
const donationsController = require('../controllers/donations');
const campaignsController = require('../controllers/campaigns');
const reportsController = require('../controllers/reports');
const { validatePublicDonation } = require('../middleware/validation');

// Donations
router.get('/donations/recent', donationsController.getRecentDonations);
router.get('/donations/statistics', donationsController.getStatistics);
router.post('/donations', validatePublicDonation, donationsController.createPublicDonation);

// Campaigns
router.get('/campaigns', campaignsController.getActiveCampaigns);
router.get('/campaigns/:id', campaignsController.getCampaignById);

// Reports
router.get('/reports/:campaignId', reportsController.getReportsByCampaign);

module.exports = router;
