require('dotenv').config();
const path = require('path');

const config = {
  port: parseInt(process.env.PORT || '8080', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: (process.env.NODE_ENV || 'development') === 'production',

  corsOrigins: (process.env.CORS_ORIGINS || '*').split(',').map((s) => s.trim()),

  uploadDir: path.resolve(process.cwd(), process.env.UPLOAD_DIR || './storage/uploads'),
  resultDir: path.resolve(process.cwd(), process.env.RESULT_DIR || './storage/results'),

  fileRetentionMinutes: parseInt(process.env.FILE_RETENTION_MINUTES || '60', 10),

  maxImageSizeMb: parseInt(process.env.MAX_IMAGE_SIZE_MB || '20', 10),
  maxVideoSizeMb: parseInt(process.env.MAX_VIDEO_SIZE_MB || '200', 10),

  aiProvider: process.env.AI_PROVIDER || 'mock',
  falKey: process.env.FAL_KEY || '',
};

module.exports = config;
