import { createPool } from 'mysql2/promise';
import { database as _database, api, logging, dataRetention } from './config.js';

let pool;

// Database configuration
const dbConfig = {
  host: _database.host,
  port: _database.port,
  user: _database.user,
  password: _database.password,
  database: _database.database,
  waitForConnections: true,
  connectionLimit: _database.connectionLimit,
  queueLimit: _database.queueLimit,
  acquireTimeout: _database.acquireTimeout,
  timeout: _database.timeout,
  reconnect: _database.reconnect,
  charset: _database.charset,
  timezone: '+00:00' // Store all dates in UTC
};

// Initialize database
async function initDatabase() {
  try {
    pool = createPool(dbConfig);
    
    // Test connection
    const connection = await pool.getConnection();
    console.log('Database connection established successfully');
    connection.release();
    
    // Create table if it doesn't exist
    await createTables();
    
    // Create indexes for better performance
    await createIndexes();
    
    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  }
}

// Create tables
async function createTables() {
  const createSensorDataTable = `
    CREATE TABLE IF NOT EXISTS sensor_data (
      id INT AUTO_INCREMENT PRIMARY KEY,
      device_id VARCHAR(255) NOT NULL,
      device_name VARCHAR(255) NOT NULL,
      data_value TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `;

  await pool.execute(createSensorDataTable);
}

// Create indexes for better performance
async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_device_id ON sensor_data (device_id)',
    'CREATE INDEX IF NOT EXISTS idx_timestamp ON sensor_data (timestamp)',
    'CREATE INDEX IF NOT EXISTS idx_device_timestamp ON sensor_data (device_id, timestamp DESC)',
    'CREATE INDEX IF NOT EXISTS idx_created_at ON sensor_data (created_at)'
  ];

  for (const indexQuery of indexes) {
    try {
      await pool.execute(indexQuery);
    } catch (error) {
      // Index might already exist, ignore duplicate key errors
      if (error.code !== 'ER_DUP_KEYNAME') {
        console.warn('Index creation warning:', error.message);
      }
    }
  }
}

// Get database pool
function getPool() {
  if (!pool) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return pool;
}

// Insert sensor data
async function insertSensorData(deviceId, deviceName, dataValue) {
  const query = `
    INSERT INTO sensor_data (device_id, device_name, data_value) 
    VALUES (?, ?, ?)
  `;
  
  const processedDataValue = typeof dataValue === 'object' 
    ? JSON.stringify(dataValue) 
    : String(dataValue);
  
  const [result] = await pool.execute(query, [deviceId, deviceName, processedDataValue]);
  return result;
}

// Get latest data for all devices
async function getLatestDevicesData() {
  const query = `
    SELECT 
      device_id,
      device_name,
      data_value,
      timestamp,
      ROW_NUMBER() OVER (PARTITION BY device_id ORDER BY timestamp DESC) as rn
    FROM sensor_data
  `;
  
  const [rows] = await pool.execute(query);
  
  // Filter to get only the latest record for each device
  return rows.filter(row => row.rn === 1).map(row => ({
    device_id: row.device_id,
    device_name: row.device_name,
    data_value: row.data_value,
    timestamp: row.timestamp
  }));
}

// Get device history with pagination
async function getDeviceHistory(deviceId, limit = 100, offset = 0) {
  // Ensure parameters are valid
  const validLimit = Math.max(1, Math.min(limit, api.maxLimit));
  const validOffset = Math.max(0, offset);
  
  const query = `
    SELECT device_id, device_name, data_value, timestamp 
    FROM sensor_data 
    WHERE device_id = ? 
    ORDER BY timestamp DESC 
    LIMIT ? OFFSET ?
  `;
  
  // Convert to strings for MySQL 8.0.22+ compatibility
  const [rows] = await pool.execute(query, [deviceId, String(validLimit), String(validOffset)]);
  return rows || [];
}

// Get filtered sensor data
async function getFilteredData(filters = {}) {
  const { device_id, from_date, to_date, limit = 100, offset = 0 } = filters;
  
  // Validate and sanitize parameters
  const validLimit = Math.max(1, Math.min(limit, api.maxLimit));
  const validOffset = Math.max(0, offset);
  
  let query = 'SELECT * FROM sensor_data WHERE 1=1';
  const params = [];
  
  if (device_id) {
    query += ' AND device_id = ?';
    params.push(device_id);
  }
  
  if (from_date) {
    query += ' AND timestamp >= ?';
    params.push(from_date);
  }
  
  if (to_date) {
    query += ' AND timestamp <= ?';
    params.push(to_date);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ? OFFSET ?';
  params.push(String(validLimit), String(validOffset));
  
  if (logging.enableSqlLogging) {
    console.log('Executing query:', query);
    console.log('Parameters:', params);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows || [];
}

// Get total record count
async function getTotalRecordCount(deviceId = null) {
  let query = 'SELECT COUNT(*) as count FROM sensor_data';
  const params = [];
  
  if (deviceId) {
    query += ' WHERE device_id = ?';
    params.push(deviceId);
  }
  
  const [rows] = await pool.execute(query, params);
  return rows[0].count;
}

// Clean up old data based on retention policy
async function cleanupOldData() {
  if (!dataRetention.enabled) {
    return 0;
  }

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - dataRetention.retentionDays);
  
  const query = `
    DELETE FROM sensor_data 
    WHERE created_at < ? 
    LIMIT ?
  `;
  
  let totalDeleted = 0;
  let batchDeleted = 0;
  
  do {
    const [result] = await pool.execute(query, [
      cutoffDate.toISOString().slice(0, 19).replace('T', ' '),
      String(dataRetention.batchSize)
    ]);
    
    batchDeleted = result.affectedRows;
    totalDeleted += batchDeleted;
    
    if (batchDeleted > 0) {
      console.log(`Deleted ${batchDeleted} records in this batch (${totalDeleted} total)`);
      
      // Small delay to avoid overwhelming the database
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  } while (batchDeleted === dataRetention.batchSize);
  
  return totalDeleted;
}

// Database health check
async function healthCheck() {
  try {
    const [rows] = await pool.execute('SELECT 1 as status');
    const totalRecords = await getTotalRecordCount();
    
    return {
      status: 'healthy',
      totalRecords,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  }
}

// Close database connection
async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('Database connection closed');
  }
}

export {
  initDatabase,
  getPool,
  insertSensorData,
  getLatestDevicesData,
  getDeviceHistory,
  getFilteredData,
  getTotalRecordCount,
  cleanupOldData,
  healthCheck,
  closeDatabase
};