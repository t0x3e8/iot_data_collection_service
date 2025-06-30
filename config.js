import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: {
    port: parseInt(process.env.PORT) || 3000,
    host: process.env.HOST || '0.0.0.0',
    environment: process.env.NODE_ENV || 'development',
    bodyLimit: process.env.BODY_LIMIT || '10mb',
    allowInlineScripts: process.env.ALLOW_INLINE_SCRIPTS === 'true',
    showErrorDetails: process.env.SHOW_ERROR_DETAILS === 'true' || process.env.NODE_ENV === 'development'
  },

  database: {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT) || 3306,
    user: process.env.DB_USER || 'iot_user',
    password: process.env.DB_PASSWORD || 'iot_password',
    database: process.env.DB_NAME || 'iot_data',
    connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT) || 10,
    queueLimit: parseInt(process.env.DB_QUEUE_LIMIT) || 0,
    acquireTimeout: parseInt(process.env.DB_ACQUIRE_TIMEOUT) || 60000,
    timeout: parseInt(process.env.DB_TIMEOUT) || 60000,
    reconnect: process.env.DB_RECONNECT !== 'false',
    charset: process.env.DB_CHARSET || 'utf8mb4'
  },

  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 1000
  },

  cors: {
    origin: process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(',') : true,
    credentials: process.env.CORS_CREDENTIALS === 'true',
    methods: process.env.CORS_METHODS ? process.env.CORS_METHODS.split(',') : ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: process.env.CORS_ALLOWED_HEADERS ? process.env.CORS_ALLOWED_HEADERS.split(',') : ['Content-Type', 'Authorization']
  },

  dataRetention: {
    enabled: process.env.DATA_RETENTION_ENABLED === 'true',
    retentionDays: parseInt(process.env.DATA_RETENTION_DAYS) || 180,
    cleanupSchedule: process.env.DATA_CLEANUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    batchSize: parseInt(process.env.DATA_CLEANUP_BATCH_SIZE) || 1000
  },

  api: {
    defaultLimit: parseInt(process.env.API_DEFAULT_LIMIT) || 100,
    maxLimit: parseInt(process.env.API_MAX_LIMIT) || 1000,
    defaultOffset: parseInt(process.env.API_DEFAULT_OFFSET) || 0
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
    enableSqlLogging: process.env.ENABLE_SQL_LOGGING === 'true'
  }
};

// Validation
function validateConfig() {
  const required = [
    'DB_HOST',
    'DB_USER',
    'DB_PASSWORD',
    'DB_NAME'
  ];

  const missing = required.filter(key => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  // Validate numeric values
  if (config.server.port < 1 || config.server.port > 65535) {
    throw new Error('PORT must be between 1 and 65535');
  }

  if (config.dataRetention.retentionDays < 1) {
    throw new Error('DATA_RETENTION_DAYS must be at least 1');
  }

  if (config.database.connectionLimit < 1) {
    throw new Error('DB_CONNECTION_LIMIT must be at least 1');
  }
}

// Only validate in production or when explicitly required
if (process.env.NODE_ENV === 'production' || process.env.VALIDATE_CONFIG === 'true') {
  validateConfig();
}

// Named exports for individual sections
export const server = config.server;
export const database = config.database;
export const rateLimit = config.rateLimit;
export const cors = config.cors;
export const dataRetention = config.dataRetention;
export const api = config.api;
export const logging = config.logging;

// Default export for the entire config
export default config;
