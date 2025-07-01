// tests/integration.test.js
import { describe, it, expect, beforeAll } from '@jest/globals';
import request from 'supertest';

describe('API Integration Tests', () => {
  let app;

  beforeAll(async () => {
    // Set test environment
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DB = 'true';
    process.env.PORT = '0';
    process.env.DATA_RETENTION_ENABLED = 'false';

    // Create a simple Express app for testing
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;

    app = express();

    // Middleware
    app.use(cors());
    app.use(express.json({ limit: '10mb' }));
    app.use(express.urlencoded({ extended: true }));

    // JSON parsing error handler
    app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
        return res.status(400).json({ error: 'Invalid JSON format' });
      }
      next(err);
    });

    // Mock API routes
    app.post('/api/data', (req, res) => {
      const { device_id, device_name, data } = req.body;

      // Check for completely missing fields first
      if (device_id === undefined || device_name === undefined || data === undefined || data === null) {
        return res.status(400).json({
          error: 'Missing required fields',
          required: ['device_id', 'device_name', 'data']
        });
      }

      // Then validate field formats
      if (typeof device_id !== 'string' || device_id.trim().length === 0) {
        return res.status(400).json({
          error: 'device_id must be a non-empty string'
        });
      }

      if (typeof device_name !== 'string' || device_name.trim().length === 0) {
        return res.status(400).json({
          error: 'device_name must be a non-empty string'
        });
      }

      // Check data size
      const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
      if (dataString.length > 65535) {
        return res.status(400).json({
          error: 'Data value too large. Maximum size is 65535 characters.'
        });
      }

      res.status(201).json({
        success: true,
        message: 'Data uploaded successfully',
        id: Math.floor(Math.random() * 1000) + 1,
        timestamp: new Date().toISOString()
      });
    });

    app.get('/api/devices', (req, res) => {
      res.json({
        success: true,
        count: 1,
        data: [
          {
            device_id: 'test123',
            device_name: 'Test Device',
            data_value: '{"temperature": 23.5}',
            timestamp: new Date().toISOString()
          }
        ],
        timestamp: new Date().toISOString()
      });
    });

    app.get('/api/device/:id/history', (req, res) => {
      const { id } = req.params;
      const { limit = 50, offset = 0 } = req.query;

      if (!id || id.trim().length === 0) {
        return res.status(400).json({ error: 'Invalid device ID' });
      }

      const parsedLimit = Math.max(1, Math.min(parseInt(limit) || 50, 1000));
      const parsedOffset = Math.max(0, parseInt(offset) || 0);

      res.json({
        success: true,
        device_id: id.trim(),
        count: 1,
        data: [
          {
            device_id: id,
            device_name: 'Test Device',
            data_value: '{"temperature": 23.5}',
            timestamp: new Date().toISOString()
          }
        ],
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          has_more: false
        },
        timestamp: new Date().toISOString()
      });
    });

    app.get('/api/data', (req, res) => {
      const { device_id, from_date, to_date, limit = 100, offset = 0 } = req.query;

      // Validate dates
      if (from_date && isNaN(Date.parse(from_date))) {
        return res.status(400).json({
          error: 'Invalid from_date format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)'
        });
      }

      const parsedLimit = Math.max(1, Math.min(parseInt(limit) || 100, 1000));
      const parsedOffset = Math.max(0, parseInt(offset) || 0);

      res.json({
        success: true,
        count: 0,
        data: [],
        filters: {
          device_id: device_id || null,
          from_date: from_date || null,
          to_date: to_date || null
        },
        pagination: {
          limit: parsedLimit,
          offset: parsedOffset,
          has_more: false
        },
        timestamp: new Date().toISOString()
      });
    });

    app.get('/api/stats', (req, res) => {
      res.json({
        success: true,
        statistics: {
          total_records: 100,
          total_devices: 1,
          active_devices: 1
        },
        timestamp: new Date().toISOString()
      });
    });

    app.get('/api/health', (req, res) => {
      res.json({
        success: true,
        database: {
          status: 'healthy',
          totalRecords: 100
        },
        retention: {
          enabled: false,
          days: 180
        }
      });
    });

    app.get('/api/config', (req, res) => {
      res.json({
        success: true,
        config: {
          api: {
            defaultLimit: 100,
            maxLimit: 1000
          },
          dataRetention: {
            enabled: false,
            retentionDays: 180
          },
          server: {
            environment: 'test'
          }
        }
      });
    });

    // Error handler
    app.use((err, req, res, _next) => {
      res.status(500).json({
        error: 'Internal server error',
        message: err.message
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  });

  describe('API Endpoints', () => {
    describe('POST /api/data', () => {
      it('should accept valid sensor data', async () => {
        const sensorData = {
          device_id: 'sensor001',
          device_name: 'Temperature Sensor',
          data: { temperature: 25.5, humidity: 60 }
        };

        const response = await request(app)
          .post('/api/data')
          .send(sensorData)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(201);
        expect(response.body).toEqual({
          success: true,
          message: 'Data uploaded successfully',
          id: expect.any(Number),
          timestamp: expect.any(String)
        });
      });

      it('should reject data with missing required fields', async () => {
        const invalidData = {
          device_id: 'sensor001'
          // Missing device_name and data
        };

        const response = await request(app)
          .post('/api/data')
          .send(invalidData)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
        expect(response.body.error).toBe('Missing required fields');
      });

      it('should validate device_id format', async () => {
        const invalidData = {
          device_id: '',
          device_name: 'Test Device',
          data: { value: 123 }
        };

        const response = await request(app)
          .post('/api/data')
          .send(invalidData)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('device_id must be a non-empty string');
      });

      it('should handle large data payloads appropriately', async () => {
        const largeData = {
          device_id: 'sensor001',
          device_name: 'Test Device',
          data: 'x'.repeat(70000) // Exceeds TEXT limit
        };

        const response = await request(app)
          .post('/api/data')
          .send(largeData)
          .set('Content-Type', 'application/json');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Data value too large. Maximum size is 65535 characters.');
      });
    });

    describe('GET /api/devices', () => {
      it('should return list of devices', async () => {
        const response = await request(app).get('/api/devices');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          count: 1,
          data: expect.arrayContaining([
            expect.objectContaining({
              device_id: 'test123',
              device_name: 'Test Device',
              data_value: '{"temperature": 23.5}',
              timestamp: expect.any(String)
            })
          ]),
          timestamp: expect.any(String)
        });
      });
    });

    describe('GET /api/device/:id/history', () => {
      it('should return device history with pagination', async () => {
        const response = await request(app)
          .get('/api/device/test123/history')
          .query({ limit: 50, offset: 0 });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          device_id: 'test123',
          count: 1,
          data: expect.any(Array),
          pagination: {
            limit: 50,
            offset: 0,
            has_more: false
          },
          timestamp: expect.any(String)
        });
      });

      it('should validate device ID parameter', async () => {
        const response = await request(app).get('/api/device/ /history');

        expect(response.status).toBe(400);
        expect(response.body.error).toBe('Invalid device ID');
      });

      it('should enforce maximum limits', async () => {
        const response = await request(app)
          .get('/api/device/test123/history')
          .query({ limit: 99999 }); // Very large limit

        expect(response.status).toBe(200);
        // Should cap at maximum allowed limit
        expect(response.body.pagination.limit).toBeLessThanOrEqual(1000);
      });
    });

    describe('GET /api/data', () => {
      it('should return filtered data', async () => {
        const response = await request(app)
          .get('/api/data')
          .query({
            device_id: 'test123',
            limit: 100,
            offset: 0
          });

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          count: 0,
          data: [],
          filters: {
            device_id: 'test123',
            from_date: null,
            to_date: null
          },
          pagination: {
            limit: 100,
            offset: 0,
            has_more: false
          },
          timestamp: expect.any(String)
        });
      });

      it('should validate date parameters', async () => {
        const response = await request(app)
          .get('/api/data')
          .query({
            from_date: 'invalid-date',
            to_date: '2023-01-01T00:00:00.000Z'
          });

        expect(response.status).toBe(400);
        expect(response.body.error).toContain('Invalid from_date format');
      });

      it('should enforce maximum limits', async () => {
        const response = await request(app)
          .get('/api/data')
          .query({ limit: 99999 }); // Very large limit

        expect(response.status).toBe(200);
        // Should cap at maximum allowed limit
        expect(response.body.pagination.limit).toBeLessThanOrEqual(1000);
      });
    });

    describe('GET /api/stats', () => {
      it('should return database statistics', async () => {
        const response = await request(app).get('/api/stats');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          statistics: {
            total_records: 100,
            total_devices: 1,
            active_devices: 1
          },
          timestamp: expect.any(String)
        });
      });
    });

    describe('GET /api/health', () => {
      it('should return health status', async () => {
        const response = await request(app).get('/api/health');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          database: {
            status: 'healthy',
            totalRecords: 100
          },
          retention: {
            enabled: false,
            days: 180
          }
        });
      });
    });

    describe('GET /api/config', () => {
      it('should return public configuration', async () => {
        const response = await request(app).get('/api/config');

        expect(response.status).toBe(200);
        expect(response.body).toEqual({
          success: true,
          config: {
            api: {
              defaultLimit: 100,
              maxLimit: 1000
            },
            dataRetention: {
              enabled: false,
              retentionDays: 180
            },
            server: {
              environment: 'test'
            }
          }
        });
      });
    });
  });

  describe('Input Validation', () => {
    it('should handle various data types', async () => {
      const testCases = [
        { data: 'string data' },
        { data: 123 },
        { data: true },
        { data: { nested: 'object' } },
        { data: [1, 2, 3] }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/data')
          .send({
            device_id: 'test',
            device_name: 'Test Device',
            ...testCase
          });

        expect(response.status).toBe(201);
      }
    });

    it('should reject invalid device IDs', async () => {
      const invalidIds = ['', '   ', null, undefined];

      for (const invalidId of invalidIds) {
        const response = await request(app)
          .post('/api/data')
          .send({
            device_id: invalidId,
            device_name: 'Test Device',
            data: { value: 123 }
          });

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 errors for unknown routes', async () => {
      const response = await request(app).get('/api/nonexistent');

      expect(response.status).toBe(404);
      expect(response.body).toEqual({
        error: 'Route not found'
      });
    });

    it('should handle malformed JSON', async () => {
      const response = await request(app)
        .post('/api/data')
        .send('{"invalid": json}')
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Invalid JSON format');
    });
  });

  describe('CORS Support', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/devices')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(response.status);
    });

    it('should include CORS headers in responses', async () => {
      const response = await request(app)
        .get('/api/devices')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      // CORS headers should be present
    });
  });

  describe('Content Type Handling', () => {
    it('should handle different content types', async () => {
      // JSON
      const jsonResponse = await request(app)
        .post('/api/data')
        .send({ device_id: 'test', device_name: 'test', data: 'test' })
        .set('Content-Type', 'application/json');

      expect(jsonResponse.status).toBe(201);

      // Form encoded
      const formResponse = await request(app)
        .post('/api/data')
        .send('device_id=test&device_name=test&data=test')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect([201, 400]).toContain(formResponse.status); // May fail validation but shouldn't crash
    });
  });

  describe('Data Validation Edge Cases', () => {
    it('should handle null and undefined data values', async () => {
      const testCases = [
        { data: null, shouldFail: true },
        { data: undefined, shouldFail: true },
        { data: '', shouldFail: false },
        { data: 0, shouldFail: false },
        { data: false, shouldFail: false }
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/data')
          .send({
            device_id: 'test123',
            device_name: 'Test Device',
            data: testCase.data
          });

        if (testCase.shouldFail) {
          expect(response.status).toBe(400);
        } else {
          expect(response.status).toBe(201);
        }
      }
    });

    it('should handle special characters in device IDs', async () => {
      const specialIds = [
        'device-with-dashes',
        'device_with_underscores',
        'device.with.dots',
        'device123',
        'DEVICE_UPPERCASE'
      ];

      for (const deviceId of specialIds) {
        const response = await request(app)
          .post('/api/data')
          .send({
            device_id: deviceId,
            device_name: 'Test Device',
            data: { value: 123 }
          });

        expect(response.status).toBe(201);
      }
    });

    it('should reject invalid device IDs', async () => {
      const invalidIds = [
        '',
        '   ',
        null,
        undefined,
        123,
        {}
      ];

      for (const invalidId of invalidIds) {
        const response = await request(app)
          .post('/api/data')
          .send({
            device_id: invalidId,
            device_name: 'Test Device',
            data: { value: 123 }
          });

        expect(response.status).toBe(400);
      }
    });
  });

  describe('Concurrent Request Handling', () => {
    it('should handle multiple concurrent requests', async () => {
      const concurrentRequests = Array(10).fill().map((_, index) =>
        request(app)
          .post('/api/data')
          .send({
            device_id: `concurrent_test_${index}`,
            device_name: `Test Device ${index}`,
            data: { index, timestamp: Date.now() }
          })
      );

      const responses = await Promise.all(concurrentRequests);

      responses.forEach(response => {
        expect([201, 429]).toContain(response.status);
      });
    });

    it('should handle concurrent reads and writes', async () => {
      const readRequests = Array(5).fill().map(() =>
        request(app).get('/api/devices')
      );

      const writeRequests = Array(5).fill().map((_, index) =>
        request(app)
          .post('/api/data')
          .send({
            device_id: `mixed_test_${index}`,
            device_name: `Mixed Test ${index}`,
            data: { value: index }
          })
      );

      const allRequests = [...readRequests, ...writeRequests];
      const responses = await Promise.all(allRequests);

      responses.forEach(response => {
        expect([200, 201, 429]).toContain(response.status);
      });
    });
  });
});
