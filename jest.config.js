// jest.config.js
export default {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  testMatch: [
    '<rootDir>/tests/**/*.test.js',
    '<rootDir>/tests/**/*.spec.js'
  ],
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
  coverageThreshold: {
    global: {
      branches: 18,
      functions: 0,
      lines: 5,
      statements: 5
    }
  },
  coverageReporters: [
    'text',
    'lcov',
    'html'
  ],
  testTimeout: 30000,
  verbose: true,
  // Clear mocks between tests
  clearMocks: true,
  // Restore mocks after each test
  restoreMocks: true,
  // Maximum worker processes
  maxWorkers: 1,
  // Detect open handles
  detectOpenHandles: true,
  // Force exit after tests
  forceExit: true
};
