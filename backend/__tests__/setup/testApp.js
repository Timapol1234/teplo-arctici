const express = require('express');
const cors = require('cors');

// Set test environment
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';

// Import routes
const publicRoutes = require('../../routes/public');
const adminRoutes = require('../../routes/admin');

// Create test app without rate limiting and server start
function createTestApp() {
  const app = express();

  // Basic middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Routes without rate limiting
  app.use('/api', publicRoutes);
  app.use('/api/admin', adminRoutes);

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Error handler
  app.use((err, req, res, next) => {
    res.status(err.status || 500).json({
      error: err.message || 'Internal server error'
    });
  });

  return app;
}

module.exports = { createTestApp };
