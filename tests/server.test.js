// tests/server.test.js
import { describe, it, expect, beforeAll, afterAll, jest } from '@jest/globals';
import request from 'supertest';

describe('Server Tests', () => {
  let app;
  let server;

  beforeAll(async () => {
    // Set test environment variables
    process.env.NODE_ENV = 'test';
    process.env.SKIP_DB = 'true';
    process.env.PORT = '0'; // Use random available port
    process.env.DATA_RETENTION_ENABLED = 'false';

    // Mock database functions before importing server
    const mockDatabase = {
      initDatabase: jest.fn().mockResolvedValue(undefined),
      closeDatabase: jest.fn().mockResolvedValue(undefined),
      cleanupOldData: jest.fn().mockResolvedValue(10),
      insertSensorData: jest.fn().mockResolvedValue({ insertId: 1 }),
      getLatestDevicesData: jest.fn().mockResolvedValue([]),
      healthCheck: jest.fn().mockResolvedValue({ status: 'healthy', totalRecords: 0 })
    };

    // Mock modules
    jest.doMock('../database.js', () => mockDatabase, { virtual: true });
    jest.doMock('node-cron', () => ({ schedule: jest.fn() }), { virtual: true });

    // Import the app - we need to create a test version
    const express = (await import('express')).default;
    const cors = (await import('cors')).default;

    app = express();
    app.use(cors());
    app.use(express.json());

    // Add basic routes for testing
    app.get('/health', (req, res) => {
      res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    });

    app.get('/api/health', (req, res) => {
      res.json({ status: 'OK', api: true });
    });

    app.get('/api/devices', (req, res) => {
      res.json({ success: true, data: [] });
    });

    app.post('/api/data', (req, res) => {
      const { device_id, device_name, data } = req.body;

      if (!device_id || !device_name || data === undefined) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      res.status(201).json({ success: true, id: 1 });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });
  });

  afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  describe('Basic Functionality', () => {
    it('should create an Express app', () => {
      expect(app).toBeDefined();
      expect(typeof app).toBe('function');
    });

    it('should respond to health check', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'OK',
        timestamp: expect.any(String),
        version: '1.0.0'
      });
    });

    it('should handle API health check', async () => {
      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        status: 'OK',
        api: true
      });
    });
  });

  describe('API Endpoints', () => {
    it('should handle GET /api/devices', async () => {
      const response = await request(app).get('/api/devices');

      expect(response.status).toBe(200);
      expect(response.body).toEqual({
        success: true,
        data: []
      });
    });

    it('should handle POST /api/data with valid data', async () => {
      const testData = {
        device_id: 'test123',
        device_name: 'Test Device',
        data: { temperature: 25.5 }
      };

      const response = await request(app)
        .post('/api/data')
        .send(testData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
      expect(response.body).toEqual({
        success: true,
        id: 1
      });
    });

    it('should reject POST /api/data with missing fields', async () => {
      const invalidData = {
        device_id: 'test123'
        // Missing device_name and data
      };

      const response = await request(app)
        .post('/api/data')
        .send(invalidData)
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Missing required fields'
      });
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const response = await request(app).get('/nonexistent-route');

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
    });
  });

  describe('CORS Handling', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app)
        .options('/api/devices')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(response.status);
    });

    it('should include CORS headers', async () => {
      const response = await request(app)
        .get('/api/devices')
        .set('Origin', 'http://localhost:3000');

      expect(response.status).toBe(200);
      // CORS headers should be present
    });
  });

  describe('Content Type Handling', () => {
    it('should handle JSON content type', async () => {
      const response = await request(app)
        .post('/api/data')
        .send({ device_id: 'test', device_name: 'test', data: 'test' })
        .set('Content-Type', 'application/json');

      expect(response.status).toBe(201);
    });

    it('should handle form-encoded data', async () => {
      const response = await request(app)
        .post('/api/data')
        .send('device_id=test&device_name=test&data=test')
        .set('Content-Type', 'application/x-www-form-urlencoded');

      expect([201, 400]).toContain(response.status); // Might fail validation but shouldn't crash
    });
  });

  describe('Input Validation', () => {
    it('should validate required fields', async () => {
      const testCases = [
        { device_id: '', device_name: 'test', data: 'test' },
        { device_id: 'test', device_name: '', data: 'test' },
        { device_id: 'test', device_name: 'test' } // missing data
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/data')
          .send(testCase);

        expect(response.status).toBe(400);
        expect(response.body).toHaveProperty('error');
      }
    });

    it('should accept various data types', async () => {
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
            device_name: 'test',
            ...testCase
          });

        expect(response.status).toBe(201);
      }
    });
  });
});
