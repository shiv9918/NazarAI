import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { UserRole } from '../types/auth';
import { getWeather48hSummary, RainfallSeverity } from '../services/weatherService';

const router = Router();

type DbUser = {
  id: string;
  first_name: string;
  last_name: string;
  role: UserRole;
  department: string | null;
};

type DbLatestAlert = {
  id: string;
  severity: RainfallSeverity;
  title: string;
  message: string;
  rainfall_48h_mm: number;
  source: string;
  target_departments: string[];
  created_at: string;
  expires_at: string;
  created_by_name: string;
};

type DbDepartmentNotification = {
  notification_id: string;
  alert_id: string;
  department: string;
  delivered_at: string;
  acknowledged_at: string | null;
  severity: RainfallSeverity;
  title: string;
  message: string;
  rainfall_48h_mm: number;
  source: string;
  created_at: string;
  expires_at: string;
};

const sendAlertSchema = z.object({
  message: z.string().trim().min(5).max(500).optional(),
  force: z.boolean().optional(),
});

const VALID_DEPARTMENTS = ['roads', 'sanitation', 'electrical', 'water', 'administration'] as const;

router.use(requireAuth);

async function getCurrentUser(userId: string) {
  const result = await pool.query<DbUser>(
    `SELECT id, first_name, last_name, role, department
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

async function getLatestActiveAlert() {
  const result = await pool.query<DbLatestAlert>(
    `SELECT
       a.id,
       a.severity,
       a.title,
       a.message,
       a.rainfall_48h_mm,
       a.source,
       a.target_departments,
       a.created_at,
       a.expires_at,
       COALESCE(u.first_name || ' ' || u.last_name, 'Admin Team') AS created_by_name
     FROM weather_department_alerts a
     LEFT JOIN users u ON u.id = a.created_by
     WHERE a.is_active = TRUE
       AND a.expires_at > NOW()
     ORDER BY a.created_at DESC
     LIMIT 1`
  );

  return result.rows[0] || null;
}

function canManageAlerts(role: UserRole) {
  return role === 'municipal' || role === 'admin';
}

router.get('/summary', async (req, res) => {
  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (!['municipal', 'admin', 'department'].includes(currentUser.role)) {
    return res.status(403).json({ message: 'Not allowed for this role.' });
  }

  const latestAlert = await getLatestActiveAlert().catch(() => null);

  try {
    const providerResult = await getWeather48hSummary();

    return res.json({
      weather: providerResult.weather,
      latestAlert,
      canSendAlert: canManageAlerts(currentUser.role),
      weatherUnavailable: false,
      weatherProvider: providerResult.provider,
      weatherWarning: providerResult.providerWarning || null,
      thresholds: {
        none: '< 20mm',
        watch: '20-40mm',
        warning: '40-75mm',
        emergency: '75mm+',
      },
    });
  } catch (error) {
    console.error('Weather summary fetch failed:', error);
    return res.status(500).json({ message: 'Failed to fetch live weather summary.' });
  }
});

router.post('/send-alert', async (req, res) => {
  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (!canManageAlerts(currentUser.role)) {
    return res.status(403).json({ message: 'Only municipal/admin can send alerts.' });
  }

  const parsed = sendAlertSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid alert payload.' });
  }

  try {
    const providerResult = await getWeather48hSummary();
    const weather = providerResult.weather;

    if (weather.severity === 'none' && !parsed.data.force) {
      return res.status(400).json({
        message: 'Rainfall is below alert threshold. Use force=true if you still want to send a preparedness note.',
      });
    }

    const title = `${weather.label}: ${weather.rainfall48hMm}mm rain expected in next 48h`;
    const message = parsed.data.message || `${weather.bannerText} Departments should pre-deploy teams before incidents escalate.`;

    const insertedAlert = await pool.query<DbLatestAlert>(
      `INSERT INTO weather_department_alerts (
         severity,
         title,
         message,
         rainfall_48h_mm,
         source,
         target_departments,
         created_by,
         expires_at,
         is_active
       )
       VALUES ($1, $2, $3, $4, $5, $6::text[], $7, NOW() + INTERVAL '48 hours', TRUE)
       RETURNING
         id,
         severity,
         title,
         message,
         rainfall_48h_mm,
         source,
         target_departments,
         created_at,
         expires_at,
         ''::text AS created_by_name`,
      [
        weather.severity,
        title,
        message,
        weather.rainfall48hMm,
        weather.source,
        VALID_DEPARTMENTS,
        currentUser.id,
      ]
    );

    const alert = insertedAlert.rows[0];

    await pool.query(
      `INSERT INTO weather_department_notifications (alert_id, department)
       SELECT $1, UNNEST($2::text[])
       ON CONFLICT (alert_id, department) DO NOTHING`,
      [alert.id, VALID_DEPARTMENTS]
    );

    return res.json({
      message: 'Alert sent to department dashboards successfully.',
      alert,
      weatherProvider: providerResult.provider,
      weatherWarning: providerResult.providerWarning || null,
    });
  } catch (error) {
    console.error('Failed to send weather alert:', error);
    return res.status(400).json({
      message: error instanceof Error
        ? `Cannot send alert until weather API is available. ${error.message}`
        : 'Cannot send alert until weather API is available.',
    });
  }
});

router.get('/department-notifications', async (req, res) => {
  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (currentUser.role !== 'department') {
    return res.status(403).json({ message: 'Only department users can view these notifications.' });
  }

  const department = currentUser.department;
  if (!department) {
    return res.status(400).json({ message: 'No department assigned for this user.' });
  }

  const result = await pool.query<DbDepartmentNotification>(
    `SELECT
       n.id AS notification_id,
       n.alert_id,
       n.department,
       n.delivered_at,
       n.acknowledged_at,
       a.severity,
       a.title,
       a.message,
       a.rainfall_48h_mm,
       a.source,
       a.created_at,
       a.expires_at
     FROM weather_department_notifications n
     INNER JOIN weather_department_alerts a ON a.id = n.alert_id
     WHERE n.department = $1
       AND a.is_active = TRUE
       AND a.expires_at > NOW()
     ORDER BY a.created_at DESC
     LIMIT 20`,
    [department]
  );

  return res.json({
    notifications: result.rows.map((row) => ({
      id: row.notification_id,
      alertId: row.alert_id,
      department: row.department,
      deliveredAt: row.delivered_at,
      acknowledgedAt: row.acknowledged_at,
      severity: row.severity,
      title: row.title,
      message: row.message,
      rainfall48hMm: row.rainfall_48h_mm,
      source: row.source,
      createdAt: row.created_at,
      expiresAt: row.expires_at,
    })),
  });
});

router.post('/department-notifications/:notificationId/ack', async (req, res) => {
  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (currentUser.role !== 'department') {
    return res.status(403).json({ message: 'Only department users can acknowledge notifications.' });
  }

  const department = currentUser.department;
  if (!department) {
    return res.status(400).json({ message: 'No department assigned for this user.' });
  }

  const updateResult = await pool.query(
    `UPDATE weather_department_notifications
     SET acknowledged_at = NOW()
     WHERE id = $1
       AND department = $2
       AND acknowledged_at IS NULL`,
    [req.params.notificationId, department]
  );

  if (!updateResult.rowCount) {
    return res.status(404).json({ message: 'Notification not found or already acknowledged.' });
  }

  return res.json({ message: 'Notification acknowledged.' });
});

export default router;
