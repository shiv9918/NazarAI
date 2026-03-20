import cors from 'cors';
import express from 'express';
import { env } from './config/env';
import { pool, testConnection } from './config/db';
import { runMigrations } from './db/runMigrations';
import authRoutes from './routes/authRoutes';
import reportRoutes from './routes/reportRoutes';

async function startServer() {
  await testConnection();
  await runMigrations();

  const app = express();

  app.use(cors({
    origin: ['http://localhost:3000', 'http://127.0.0.1:3000'],
    credentials: true,
  }));
  app.use(express.json({ limit: '20mb' }));
  app.use(express.urlencoded({ extended: true, limit: '20mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, service: 'nazarai-backend' });
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/reports', reportRoutes);

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
  await pool.end();
  process.exit(0);
});
