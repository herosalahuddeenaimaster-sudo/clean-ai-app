const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const logger = require('./logger');
const { ensureDirs } = require('./services/storage');
const cleanupService = require('./services/cleanupService');

const healthRoutes = require('./routes/health.routes');
const uploadRoutes = require('./routes/upload.routes');
const jobsRoutes = require('./routes/jobs.routes');

const notFound = require('./middleware/notFound');
const errorHandler = require('./middleware/errorHandler');

ensureDirs();

const app = express();

app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
app.use(morgan(config.isProd ? 'combined' : 'dev'));
app.use(express.json({ limit: '1mb' })); // JSON bodies only (job creation) — file bytes go through multer, not JSON

app.use('/api', healthRoutes);
app.use('/api', uploadRoutes);
app.use('/api', jobsRoutes);

app.use(notFound);
app.use(errorHandler);

app.listen(config.port, () => {
  logger.info(`Clean AI backend listening on port ${config.port} (${config.nodeEnv})`);
  logger.info(`AI_PROVIDER=${config.aiProvider}`);
  cleanupService.start();
});

module.exports = app;
