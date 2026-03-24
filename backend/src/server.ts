import cors from 'cors';
import express from 'express';
import rateLimit from 'express-rate-limit';
import { env } from './config/env';
import { pool, testConnection } from './config/db';
import { runMigrations } from './db/runMigrations';
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';
import whatsappRoutes from './routes/whatsappRoutes';
import weatherRoutes from './routes/weatherRoutes';
import { sendPendingFeedbackReminders } from './services/whatsappResolutionFlow';

let feedbackReminderInterval: NodeJS.Timeout | null = null;

function normalizeOrigin(origin: string) {
  return origin.trim().toLowerCase().replace(/\/$/, '');
}

function isAllowedOrigin(origin: string) {
  const normalizedOrigin = normalizeOrigin(origin);
  const allowedFromEnv = env.corsOrigins.map(normalizeOrigin);

  if (allowedFromEnv.includes(normalizedOrigin)) {
    return true;
  }

  // Allow Vercel preview and production deployments.
  if (/^https:\/\/[a-z0-9-]+\.vercel\.app$/i.test(normalizedOrigin)) {
    return true;
  }

  return false;
}

async function startServer() {
  await testConnection();
  await runMigrations();

  const app = express();

  app.use(cors({
    origin: (origin, callback) => {
      // Allow non-browser requests (curl, health checks, server-to-server).
      if (!origin) {
        callback(null, true);
        return;
      }

      if (isAllowedOrigin(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error(`CORS blocked for origin: ${origin}`));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  // Rate limiting middleware
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // limit each IP to 100 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api/', limiter);

  // Stricter rate limiting for reports (polling endpoints)
  const reportsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // limit each IP to 20 requests per minute for reports
    message: 'Too many report requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nazarai-backend' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportsLimiter, reportRoutes);
  app.use('/api/whatsapp', whatsappRoutes);
  app.use('/api/weather', weatherRoutes);

  // Periodically remind citizens to submit satisfaction feedback after resolution.
  feedbackReminderInterval = setInterval(() => {
    sendPendingFeedbackReminders().catch((error) => {
      console.error('Feedback reminder loop failed:', error);
    });
  }, 15 * 60 * 1000);

  void sendPendingFeedbackReminders();

  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Backend running at http://localhost:${env.port}`);
  });
}

startServer().catch(async (error) => {
  console.error('Failed to start backend:', error);
  await pool.end();
  process.exit(1);
});

process.on('SIGINT', async () => {
  if (feedbackReminderInterval) {
    clearInterval(feedbackReminderInterval);
  }
  await pool.end();
  process.exit(0);
});
