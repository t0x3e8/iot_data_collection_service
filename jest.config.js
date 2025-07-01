// jest.config.js
export default {
  // Test environment
  testEnvironment: 'node',

  // Setup files
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],

  // Test file patterns
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],

  // Test file ignores
  testPathIgnorePatterns: [
    '/node_modules/',
    '/coverage/',
    '/public/',
    '/scripts/'
  ],

  // Coverage configuration
  collectCoverageFrom: [
    '*.js',
    'routes/*.js',
    '!node_modules/**',
    '!tests/**',
    '!coverage/**',
    '!jest.config.js',
    '!eslint.config.js',
    '!server.js' // Exclude for now due to complex mocking
  ],

  // Lower coverage thresholds for initial setup
  coverageThreshold: {
    global: {
      branches: 18,
      functions: 0,
      lines: 5,
      statements: 5
    }
  },

  // Coverage reporters
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],

  // Test timeout
  testTimeout: 30000,

  // Verbose output
  verbose: true,

  // Clear mocks between tests
  clearMocks: true,

  // Restore mocks after each test
  restoreMocks: true,

  // Maximum worker processes
  maxWorkers: 1, // Use single worker to avoid port conflicts

  // Detect open handles
  detectOpenHandles: true,

  // Force exit after tests
  forceExit: true
};
