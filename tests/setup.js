// Set NODE_ENV to test
process.env.NODE_ENV = 'test';

// Set test database configuration
process.env.DB_HOST = 'localhost';
process.env.DB_PORT = '3306';
process.env.DB_USER = 'test_user';
process.env.DB_PASSWORD = 'test_password';
process.env.DB_NAME = 'test_iot_data';
process.env.PORT = '0'; // Use random port for testing
process.env.SKIP_DB = 'true'; // Skip database initialization in tests
process.env.SHOW_ERROR_DETAILS = 'true';
process.env.DATA_RETENTION_ENABLED = 'false';

// Suppress console.log in tests but keep errors
const originalConsoleLog = console.log;

beforeEach(() => {
  if (global.jest) {
    console.log = global.jest.fn();
  }
});

afterEach(() => {
  console.log = originalConsoleLog;
  if (global.jest) {
    global.jest.clearAllMocks();
  }
});
