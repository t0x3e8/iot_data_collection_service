import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import { join, dirname } from 'path';
import { schedule } from 'node-cron';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import dotenv from 'dotenv';
dotenv.config();

import { initDatabase, cleanupOldData, closeDatabase } from './database.js';
import apiRoutes from './routes/api.js';
import { server, rateLimit as _rateLimit, cors as _cors, dataRetention } from './config.js';

const app = express();

// Conditional security middleware
if (server.environment === 'production') {
  // Full helmet configuration for production
  const cspDirectives = {
    defaultSrc: ['\'self\''],
    scriptSrc: server.allowInlineScripts ? ['\'self\'', '\'unsafe-inline\''] : ['\'self\''],
    styleSrc: ['\'self\'', '\'unsafe-inline\''],
    imgSrc: ['\'self\'', 'data:', 'http:', 'https:'],
    connectSrc: ['\'self\''],
    fontSrc: ['\'self\''],
    objectSrc: ['\'none\''],
    mediaSrc: ['\'self\''],
    frameSrc: ['\'none\''],
    baseUri: ['\'self\''],
    formAction: ['\'self\'']
  };

  app.use(helmet({
    contentSecurityPolicy: {
      directives: cspDirectives
    },
    crossOriginEmbedderPolicy: false
  }));
} else {
  // Minimal helmet for development - no CSP
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: _rateLimit.windowMs,
  max: _rateLimit.maxRequests,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// Middleware
app.use(cors(_cors));
app.use(express.json({ limit: server.bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: server.bodyLimit }));

// Serve static files with proper MIME types - FIX: Use absolute path
const publicPath = join(__dirname, 'public');
console.log('Serving static files from:', publicPath);

app.use(express.static(publicPath, {
  index: false,
  setHeaders: (res, path, _stat) => {
    console.log('Serving file:', path);
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
  }
}));

// API Routes - MUST come before static routes
app.use('/api', apiRoutes);

// Serve static files with proper MIME types - moved before device routes
app.use(express.static(publicPath, {
  index: false,
  setHeaders: (res, path, _stat) => {
    console.log('Serving file:', path);
    if (path.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css');
    } else if (path.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript');
    } else if (path.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html');
    }
  }
}));

// Debug middleware to log all requests
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
  next();
});

// Serve the web UI - MOVED AFTER static files
app.get('/', (req, res) => {
  const indexPath = join(__dirname, 'public', 'index.html');
  console.log('Serving index.html from:', indexPath);
  res.sendFile(indexPath);
});

app.get('/device/:id', (req, res) => {
  const devicePath = join(__dirname, 'public', 'device.html');
  console.log('Serving device.html from:', devicePath);
  res.sendFile(devicePath);
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Error handling middleware
app.use((err, req, res, __dirnamenext) => {
  console.error('Error:', err.stack);
  res.status(500).json({
    error: 'Internal server error',
    message: server.showErrorDetails ? err.message : 'Something went wrong!'
  });
});

// 404 handler - THIS IS THE KEY FIX
app.use('*', (req, res) => {
  console.log('404 - File not found:', req.originalUrl);
  console.log('Looking for file at:', join(__dirname, 'public', req.originalUrl));
  res.status(404).json({ error: 'Route not found' });
});

// Schedule data cleanup job
if (dataRetention.enabled) {
  schedule(dataRetention.cleanupSchedule, async () => {
    console.log('Running scheduled data cleanup...');
    try {
      const deletedCount = await cleanupOldData();
      console.log(`Data cleanup completed. Deleted ${deletedCount} old records.`);
    } catch (error) {
      console.error('Data cleanup failed:', error);
    }
  });

  console.log(`Data retention enabled: ${dataRetention.retentionDays} days`);
  console.log(`Cleanup scheduled: ${dataRetention.cleanupSchedule}`);
}

// Graceful shutdown
async function shutdown() {
  console.log('Shutting down gracefully...');
  await closeDatabase();
  process.exit(0);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

process.on('unhandledRejection', err => {
  console.error('Unhandled rejection:', err);
  process.exit(1);
});

// Start server
async function startServer() {
  try {
    await initDatabase();

    app.listen(server.port, server.host, () => {
      console.log(`IoT Data Collector running on ${server.host}:${server.port}`);
      console.log(`Environment: ${server.environment}`);
      console.log('Security: CSP enabled with strict policy (no unsafe-inline for scripts)');
      console.log(`Static files served from: ${publicPath}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
