// Global test setup
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key-for-testing-purposes-only';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test_db';

// Suppress console.error during tests unless debugging
const originalConsoleError = console.error;
console.error = (...args) => {
  if (process.env.DEBUG_TESTS) {
    originalConsoleError(...args);
  }
};

// Suppress console.log during tests unless debugging
const originalConsoleLog = console.log;
console.log = (...args) => {
  if (process.env.DEBUG_TESTS) {
    originalConsoleLog(...args);
  }
};

// Clean up after all tests
afterAll(() => {
  console.error = originalConsoleError;
  console.log = originalConsoleLog;
});

// Reset all mocks after each test
afterEach(() => {
  jest.clearAllMocks();
});
