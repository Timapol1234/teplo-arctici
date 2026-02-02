// Centralized mocks for tests

// Mock database query results
const mockQueryResult = (rows = []) => ({
  rows,
  rowCount: rows.length
});

// Create mock database module
const createMockDb = () => {
  const mockQuery = jest.fn();
  return {
    query: mockQuery,
    pool: {
      query: mockQuery,
      end: jest.fn()
    },
    mockQuery,
    mockQueryResult
  };
};

// Create mock request object
const createMockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: null,
  ip: '127.0.0.1',
  get: jest.fn((header) => {
    if (header === 'user-agent') return 'Test-Agent/1.0';
    return null;
  }),
  ...overrides
});

// Create mock response object
const createMockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
};

// Create mock next function
const createMockNext = () => jest.fn();

// Mock bcrypt
const createMockBcrypt = () => ({
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
  compare: jest.fn().mockResolvedValue(true)
});

// Mock jsonwebtoken
const createMockJwt = () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token'),
  verify: jest.fn((token, secret, callback) => {
    if (token === 'valid-token') {
      callback(null, { id: 1, email: 'test@example.com', role: 'admin' });
    } else if (token === 'super-admin-token') {
      callback(null, { id: 1, email: 'admin@example.com', role: 'super_admin' });
    } else {
      callback(new Error('Invalid token'), null);
    }
  })
});

// Mock cloudinary
const createMockCloudinary = () => ({
  config: jest.fn(),
  uploader: {
    upload: jest.fn().mockResolvedValue({ secure_url: 'https://cloudinary.com/image.jpg' }),
    destroy: jest.fn().mockResolvedValue({ result: 'ok' })
  }
});

// Sample test data
const testData = {
  admin: {
    id: 1,
    email: 'admin@teplo-arctici.ru',
    password_hash: '$2b$10$hashedpassword',
    full_name: 'Test Admin',
    role: 'super_admin',
    is_active: true
  },
  campaign: {
    id: 1,
    title: 'Test Campaign',
    description: 'Test description for campaign',
    goal_amount: 100000,
    current_amount: 50000,
    is_active: true,
    image_url: null,
    end_date: null,
    created_at: new Date().toISOString()
  },
  donation: {
    id: 1,
    campaign_id: 1,
    amount: 1000,
    donor_email_encrypted: null,
    is_anonymous: true,
    payment_method: 'card',
    status: 'completed',
    created_at: new Date().toISOString()
  },
  report: {
    id: 1,
    campaign_id: 1,
    expense_date: new Date().toISOString().split('T')[0],
    amount: 5000,
    description: 'Test expense report',
    receipt_url: null,
    vendor_name: 'Test Vendor',
    created_at: new Date().toISOString()
  }
};

module.exports = {
  createMockDb,
  createMockRequest,
  createMockResponse,
  createMockNext,
  createMockBcrypt,
  createMockJwt,
  createMockCloudinary,
  mockQueryResult,
  testData
};
