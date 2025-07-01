// tests/utils/testHelpers.js
import { jest, expect } from '@jest/globals';

/**
 * Creates a mock Express request object
 */
export function createMockRequest(overrides = {}) {
  return {
    method: 'GET',
    url: '/',
    path: '/',
    originalUrl: '/',
    headers: {},
    query: {},
    params: {},
    body: {},
    get: jest.fn((header) => {
      return overrides.headers?.[header.toLowerCase()] || null;
    }),
    ...overrides
  };
}

/**
 * Creates a mock Express response object
 */
export function createMockResponse() {
  const res = {
    status: jest.fn(() => res),
    json: jest.fn(() => res),
    send: jest.fn(() => res),
    sendFile: jest.fn(() => res),
    setHeader: jest.fn(() => res),
    getHeader: jest.fn(),
    end: jest.fn(() => res),
    redirect: jest.fn(() => res),
    cookie: jest.fn(() => res),
    clearCookie: jest.fn(() => res),
    locals: {},
    headersSent: false
  };
  return res;
}

/**
 * Creates a mock Express next function
 */
export function createMockNext() {
  return jest.fn();
}

/**
 * Creates sample sensor data for testing
 */
export function createSampleSensorData(overrides = {}) {
  return {
    device_id: 'test_device_001',
    device_name: 'Test Temperature Sensor',
    data: {
      temperature: 23.5,
      humidity: 65.2,
      timestamp: new Date().toISOString()
    },
    ...overrides
  };
}

/**
 * Creates sample device history records
 */
export function createSampleDeviceHistory(deviceId = 'test_device_001', count = 5) {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    device_id: deviceId,
    device_name: `Test Device ${deviceId}`,
    data_value: JSON.stringify({
      temperature: 20 + Math.random() * 10,
      humidity: 50 + Math.random() * 20,
      reading: index + 1
    }),
    timestamp: new Date(Date.now() - (index * 60000)).toISOString(),
    created_at: new Date(Date.now() - (index * 60000)).toISOString(),
    updated_at: new Date(Date.now() - (index * 60000)).toISOString()
  }));
}

/**
 * Creates a mock MySQL connection pool
 */
export function createMockPool() {
  const mockConnection = {
    execute: jest.fn(),
    release: jest.fn(),
    destroy: jest.fn()
  };

  const mockPool = {
    execute: jest.fn(),
    getConnection: jest.fn().mockResolvedValue(mockConnection),
    end: jest.fn(),
    on: jest.fn(),
    config: {
      connectionConfig: {
        host: 'localhost',
        port: 3306,
        user: 'test_user',
        database: 'test_db'
      }
    }
  };

  return { mockPool, mockConnection };
}

/**
 * Utility to wait for a specific amount of time
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Validates that an object has the expected IoT data structure
 */
export function validateIoTDataStructure(data) {
  expect(data).toHaveProperty('device_id');
  expect(data).toHaveProperty('device_name');
  expect(data).toHaveProperty('data_value');
  expect(data).toHaveProperty('timestamp');

  expect(typeof data.device_id).toBe('string');
  expect(typeof data.device_name).toBe('string');
  expect(typeof data.timestamp).toBe('string');

  // Validate timestamp format
  expect(new Date(data.timestamp).toISOString()).toBe(data.timestamp);
}

/**
 * Validates API response structure
 */
export function validateApiResponse(response, expectedStatus = 200) {
  expect(response.status).toBe(expectedStatus);
  expect(response.body).toHaveProperty('success');
  expect(response.body).toHaveProperty('timestamp');

  if (response.body.success) {
    expect(typeof response.body.timestamp).toBe('string');
  }
}

/**
 * Validates pagination structure in API responses
 */
export function validatePaginationStructure(pagination) {
  expect(pagination).toHaveProperty('limit');
  expect(pagination).toHaveProperty('offset');
  expect(pagination).toHaveProperty('has_more');

  expect(typeof pagination.limit).toBe('number');
  expect(typeof pagination.offset).toBe('number');
  expect(typeof pagination.has_more).toBe('boolean');

  expect(pagination.limit).toBeGreaterThan(0);
  expect(pagination.offset).toBeGreaterThanOrEqual(0);
}

/**
 * Creates test environment variables
 */
export function setupTestEnvironment() {
  const originalEnv = process.env;

  process.env = {
    ...originalEnv,
    NODE_ENV: 'test',
    PORT: '0',
    HOST: '127.0.0.1',
    DB_HOST: 'localhost',
    DB_PORT: '3306',
    DB_USER: 'test_user',
    DB_PASSWORD: 'test_password',
    DB_NAME: 'test_iot_data',
    SKIP_DB: 'true',
    SHOW_ERROR_DETAILS: 'true',
    DATA_RETENTION_ENABLED: 'false',
    RATE_LIMIT_WINDOW_MS: '60000',
    RATE_LIMIT_MAX_REQUESTS: '1000'
  };

  return () => {
    process.env = originalEnv;
  };
}

/**
 * Mock database operations for testing
 */
export function createDatabaseMocks() {
  return {
    initDatabase: jest.fn().mockResolvedValue(undefined),
    insertSensorData: jest.fn().mockImplementation(() =>
      Promise.resolve({ insertId: Math.floor(Math.random() * 1000) + 1, affectedRows: 1 })
    ),
    getLatestDevicesData: jest.fn().mockImplementation(() =>
      Promise.resolve(createSampleDeviceHistory('test_device', 1))
    ),
    getDeviceHistory: jest.fn().mockImplementation((deviceId, limit = 10) =>
      Promise.resolve(createSampleDeviceHistory(deviceId, Math.min(limit, 10)))
    ),
    getFilteredData: jest.fn().mockResolvedValue([]),
    getTotalRecordCount: jest.fn().mockResolvedValue(100),
    healthCheck: jest.fn().mockResolvedValue({
      status: 'healthy',
      totalRecords: 100,
      timestamp: new Date().toISOString()
    }),
    cleanupOldData: jest.fn().mockResolvedValue(5),
    closeDatabase: jest.fn().mockResolvedValue(undefined)
  };
}

/**
 * Custom Jest matcher for HTTP status codes
 */
export function expectHttpStatus(response, expectedStatus) {
  expect(response.status).toBe(expectedStatus);

  if (expectedStatus >= 400) {
    expect(response.body).toHaveProperty('error');
  } else {
    expect(response.body).not.toHaveProperty('error');
  }
}

/**
 * Helper to test rate limiting
 */
export async function testRateLimit(requestFn, maxRequests = 100) {
  const requests = Array.from({ length: maxRequests + 10 }, () => requestFn());
  const responses = await Promise.all(requests);

  const rateLimitedResponses = responses.filter(res => res.status === 429);
  const successfulResponses = responses.filter(res => res.status < 400);

  return {
    total: responses.length,
    successful: successfulResponses.length,
    rateLimited: rateLimitedResponses.length,
    responses
  };
}

/**
 * Utility to generate large test data
 */
export function generateLargeTestData(sizeInKB = 100) {
  const data = {
    device_id: 'large_data_test',
    device_name: 'Large Data Test Device',
    data: 'x'.repeat(sizeInKB * 1024) // Generate data of specified size
  };

  return data;
}

/**
 * Database test utilities
 */
export class DatabaseTestUtils {
  constructor(mockPool) {
    this.pool = mockPool;
  }

  mockSuccessfulQuery(result = []) {
    this.pool.execute.mockResolvedValueOnce([result]);
    return this;
  }

  mockFailedQuery(error = new Error('Database error')) {
    this.pool.execute.mockRejectedValueOnce(error);
    return this;
  }

  mockConnectionError(error = new Error('Connection failed')) {
    this.pool.getConnection.mockRejectedValueOnce(error);
    return this;
  }

  getLastQuery() {
    const calls = this.pool.execute.mock.calls;
    return calls[calls.length - 1];
  }

  getQueryCount() {
    return this.pool.execute.mock.calls.length;
  }

  reset() {
    this.pool.execute.mockClear();
    this.pool.getConnection.mockClear();
    return this;
  }
}

/**
 * Performance testing utilities
 */
export class PerformanceTestUtils {
  static async measureExecutionTime(fn) {
    const start = process.hrtime.bigint();
    const result = await fn();
    const end = process.hrtime.bigint();

    const executionTime = Number(end - start) / 1000000; // Convert to milliseconds

    return {
      result,
      executionTime,
      executionTimeFormatted: `${executionTime.toFixed(2)}ms`
    };
  }

  static async runConcurrentTests(fn, concurrency = 10, iterations = 100) {
    const batches = [];

    for (let i = 0; i < iterations; i += concurrency) {
      const batch = Array.from(
        { length: Math.min(concurrency, iterations - i) },
        () => this.measureExecutionTime(fn)
      );

      batches.push(Promise.all(batch));
    }

    const allResults = await Promise.all(batches);
    const flatResults = allResults.flat();

    const executionTimes = flatResults.map(r => r.executionTime);

    return {
      totalRequests: flatResults.length,
      averageTime: executionTimes.reduce((a, b) => a + b, 0) / executionTimes.length,
      minTime: Math.min(...executionTimes),
      maxTime: Math.max(...executionTimes),
      p95Time: this.percentile(executionTimes, 0.95),
      p99Time: this.percentile(executionTimes, 0.99),
      results: flatResults
    };
  }

  static percentile(arr, p) {
    const sorted = arr.slice().sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[index];
  }
}

/**
 * API testing utilities
 */
export class ApiTestUtils {
  static createHeaders(contentType = 'application/json', additional = {}) {
    return {
      'Content-Type': contentType,
      'Accept': 'application/json',
      'User-Agent': 'Test-Agent/1.0',
      ...additional
    };
  }

  static async testEndpointWithDifferentMethods(request, endpoint, data = {}) {
    const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    const results = {};

    for (const method of methods) {
      try {
        const response = await request[method.toLowerCase()](endpoint)
          .send(data)
          .set(this.createHeaders());

        results[method] = {
          status: response.status,
          body: response.body,
          headers: response.headers
        };
      } catch (error) {
        results[method] = {
          error: error.message,
          status: error.status || 500
        };
      }
    }

    return results;
  }
}
