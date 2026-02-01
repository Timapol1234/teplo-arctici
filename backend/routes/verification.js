const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const verificationController = require('../controllers/verification');

// Публичные endpoints верификации (работают только если верификация включена)
router.get(
  '/hash/:date',
  verificationController.checkVerificationEnabled,
  verificationController.getHashByDate
);

router.get(
  '/data/:date',
  verificationController.checkVerificationEnabled,
  verificationController.getTransactionsCSV
);

router.get(
  '/hashes',
  verificationController.checkVerificationEnabled,
  verificationController.getAllHashes
);

// Всегда доступный endpoint для проверки статуса
router.get('/status', verificationController.getVerificationStatus);

// Административные endpoints
router.post(
  '/generate',
  authenticateToken,
  verificationController.checkVerificationEnabled,
  verificationController.generateHashForDate
);

router.post(
  '/toggle',
  authenticateToken,
  verificationController.toggleVerification
);

module.exports = router;
