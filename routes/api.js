import { Router } from 'express';
import rateLimit from 'express-rate-limit';
const router = Router();
import { insertSensorData, getLatestDevicesData, getDeviceHistory, getFilteredData, getTotalRecordCount, healthCheck } from '../database.js';
import { logging, server as _server, api as _api, dataRetention as _dataRetention } from '../config.js';

// Utility function for DRY pagination logic
function parsePagination(limit, offset, config = _api) {
  const parsedLimit = limit ? parseInt(limit, 10) : config.defaultLimit;
  const parsedOffset = offset ? parseInt(offset, 10) : config.defaultOffset;

  return {
    limit: isNaN(parsedLimit) ? config.defaultLimit :
      Math.max(1, Math.min(parsedLimit, config.maxLimit)),
    offset: isNaN(parsedOffset) ? 0 : Math.max(0, parsedOffset)
  };
}

// Utility function for date validation
function validateDate(dateString, fieldName) {
  if (!dateString) {return null;}
  if (isNaN(Date.parse(dateString))) {
    throw new Error(`Invalid ${fieldName} format. Use ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ)`);
  }
  return dateString;
}

// Rate limiting for expensive endpoints
const expensiveEndpointLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 requests per minute
  message: { error: 'Too many requests to this endpoint, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Rate limiting for write operations
const writeOperationLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 writes per minute
  message: { error: 'Too many data uploads, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

// Middleware for request logging
router.use((req, res, next) => {
  if (logging.level === 'debug') {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`, {
      query: req.query,
      body: req.body
    });
  }
  next();
});

// POST /api/data - Upload sensor data
router.post('/data', writeOperationLimiter, async (req, res) => {
  try {
    const { device_id, device_name, data } = req.body;

    // Validation
    if (!device_id || !device_name || data === undefined || data === null) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['device_id', 'device_name', 'data'],
        received: { device_id, device_name, data: data !== undefined ? 'provided' : 'missing' }
      });
    }

    // Additional validation
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

    // Limit data size to prevent abuse
    const dataString = typeof data === 'object' ? JSON.stringify(data) : String(data);
    if (dataString.length > 65535) { // TEXT column limit
      return res.status(400).json({
        error: 'Data value too large. Maximum size is 65535 characters.'
      });
    }

    const result = await insertSensorData(
      device_id.trim(),
      device_name.trim(),
      data
    );

    res.status(201).json({
      success: true,
      message: 'Data uploaded successfully',
      id: result.insertId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error uploading data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: _server.showErrorDetails ? error.message : 'Failed to upload data'
    });
  }
});

// GET /api/devices - Get all devices with latest data
router.get('/devices', async (req, res) => {
  try {
    const devices = await getLatestDevicesData();

    res.json({
      success: true,
      count: devices.length,
      data: devices,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching devices:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: _server.showErrorDetails ? error.message : 'Failed to fetch devices',
      data: []
    });
  }
});

// GET /api/device/:id/history - Get device history with pagination
router.get('/device/:id/history', expensiveEndpointLimiter, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit, offset, count } = req.query;

    // Validate device ID
    if (!id || typeof id !== 'string' || id.trim().length === 0) {
      return res.status(400).json({
        error: 'Invalid device ID'
      });
    }

    // Parse pagination parameters using utility function
    const pagination = parsePagination(limit, offset);

    console.log(`Fetching history for device: ${id}, limit: ${pagination.limit}, offset: ${pagination.offset}`);

    // Fetch data
    const history = await getDeviceHistory(id.trim(), pagination.limit, pagination.offset);

    // Optionally include total count
    let totalCount = null;
    if (count === 'true') {
      totalCount = await getTotalRecordCount(id.trim());
    }

    const response = {
      success: true,
      device_id: id.trim(),
      count: history.length,
      data: history,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: history.length === pagination.limit
      },
      timestamp: new Date().toISOString()
    };

    if (totalCount !== null) {
      response.total_count = totalCount;
    }

    console.log(`Found ${history.length} records for device ${id}`);
    res.json(response);

  } catch (error) {
    console.error('Error fetching device history:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: _server.showErrorDetails ? error.message : 'Failed to fetch device history',
      data: []
    });
  }
});

// GET /api/data - Get filtered data with pagination
router.get('/data', expensiveEndpointLimiter, async (req, res) => {
  try {
    const { device_id, from_date, to_date, limit, offset, count } = req.query;

    // Parse pagination parameters using utility function
    const pagination = parsePagination(limit, offset);

    // Validate date parameters using utility function
    try {
      validateDate(from_date, 'from_date');
      validateDate(to_date, 'to_date');
    } catch (dateError) {
      return res.status(400).json({
        error: dateError.message
      });
    }

    const filters = {
      device_id: device_id?.trim(),
      from_date,
      to_date,
      limit: pagination.limit,
      offset: pagination.offset
    };

    // Remove undefined values
    Object.keys(filters).forEach(key => {
      if (filters[key] === undefined || filters[key] === '') {
        delete filters[key];
      }
    });

    const data = await getFilteredData(filters);

    // Optionally include total count
    let totalCount = null;
    if (count === 'true') {
      totalCount = await getTotalRecordCount(device_id?.trim());
    }

    const response = {
      success: true,
      count: data.length,
      data: data,
      filters: {
        device_id: device_id?.trim() || null,
        from_date: from_date || null,
        to_date: to_date || null
      },
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        has_more: data.length === pagination.limit
      },
      timestamp: new Date().toISOString()
    };

    if (totalCount !== null) {
      response.total_count = totalCount;
    }

    res.json(response);

  } catch (error) {
    console.error('Error fetching data:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: _server.showErrorDetails ? error.message : 'Failed to fetch data',
      data: []
    });
  }
});

// GET /api/stats - Get database statistics
router.get('/stats', async (req, res) => {
  try {
    const totalRecords = await getTotalRecordCount();
    const devices = await getLatestDevicesData();

    // Calculate active devices with null-check safeguard
    const activeDevices = devices.filter(d => {
      if (!d.timestamp) {return false;}

      const lastSeen = new Date(d.timestamp);
      const now = new Date();
      const diffHours = (now - lastSeen) / (1000 * 60 * 60);
      return diffHours <= 24; // Consider device active if seen in last 24 hours
    }).length;

    res.json({
      success: true,
      statistics: {
        total_records: totalRecords,
        total_devices: devices.length,
        active_devices: activeDevices
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: _server.showErrorDetails ? error.message : 'Failed to fetch statistics'
    });
  }
});

// GET /api/health - Database health check
router.get('/health', async (req, res) => {
  try {
    const health = await healthCheck();

    if (health.status === 'healthy') {
      res.json({
        success: true,
        database: health,
        retention: {
          enabled: _dataRetention.enabled,
          days: _dataRetention.retentionDays
        }
      });
    } else {
      res.status(503).json({
        success: false,
        database: health
      });
    }
  } catch (error) {
    console.error('Health check failed:', error);
    res.status(503).json({
      success: false,
      error: 'Health check failed',
      message: _server.showErrorDetails ? error.message : 'Database unavailable'
    });
  }
});

// GET /api/config - Get public configuration
router.get('/config', (req, res) => {
  res.json({
    success: true,
    config: {
      api: {
        defaultLimit: _api.defaultLimit,
        maxLimit: _api.maxLimit
      },
      dataRetention: {
        enabled: _dataRetention.enabled,
        retentionDays: _dataRetention.retentionDays
      },
      server: {
        environment: _server.environment
      }
    }
  });
});

export default router;
