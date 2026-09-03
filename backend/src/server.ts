// This is the main entry point: it builds the Express app, sets up security
// (CORS, rate limiting), wires up all the routes, and starts the server.
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

// Handle to the background timer that sends feedback reminders, so we can stop it later.
let feedbackReminderInterval: NodeJS.Timeout | null = null;

// Make an origin URL consistent for comparison (lowercase, no trailing slash).
function normalizeOrigin(origin: string) {
  return origin.trim().toLowerCase().replace(/\/$/, '');
}

// Check if a website is allowed to call this backend (CORS check).
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

// Sets everything up and starts listening for requests.
async function startServer() {
  // Make sure the database is reachable and up to date before accepting requests.
  await testConnection();
  await runMigrations();

  const app = express();
  // Respect proxy headers on platforms like Render so req.ip is the real client IP.
  app.set('trust proxy', 1);

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

  // General API rate limiting middleware.
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 300, // limit each IP to 300 requests per windowMs
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    // Keep auth login independent from general API throttling.
    skip: (req) => req.originalUrl.startsWith('/api/auth/login'),
  });
  app.use('/api/', limiter);

  // Login-specific limiter: restrict brute-force while avoiding false positives for normal usage.
  const authLoginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20,
    message: 'Too many login attempts. Please wait a few minutes and try again.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: true,
  });

  // Stricter rate limiting for reports (polling endpoints)
  const reportsLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 20, // limit each IP to 20 requests per minute for reports
    message: 'Too many report requests, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  });

  // Simple endpoint to check the server is alive and which features are configured.
  app.get('/api/health', (_req, res) => {
    res.json({
      ok: true,
      service: 'nazarai-backend',
      runtime: {
        hasGeminiKey: Boolean(env.geminiApiKey),
        geminiModel: env.geminiModel,
        hasTwilioSid: Boolean(env.twilioAccountSid),
        hasTwilioAuthToken: Boolean(env.twilioAuthToken),
        hasTwilioWhatsappNumber: Boolean(env.twilioWhatsappNumber),
      },
    });
  });

  // Hook up all the route files under their URL prefixes.
  app.use('/api/auth/login', authLoginLimiter);
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

  // Start listening for incoming requests.
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`Backend running at http://localhost:${env.port}`);
  });
}

// Boot the server; if setup fails, log it and exit.
startServer().catch(async (error) => {
  console.error('Failed to start backend:', error);
  await pool.end();
  process.exit(1);
});

// Clean shutdown when the process is stopped (e.g. Ctrl+C).
process.on('SIGINT', async () => {
  if (feedbackReminderInterval) {
    clearInterval(feedbackReminderInterval);
  }
  await pool.end();
  process.exit(0);
});
