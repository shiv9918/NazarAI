import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { LoginPortalRole, PublicUser, UserRecord, UserRole, USER_ROLES } from '../types/auth';
import { signToken } from '../utils/token';

const signupSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
  phone: z.string().trim().min(8).max(20),
  role: z.enum(USER_ROLES).default('citizen'),
  department: z.string().trim().optional().nullable(),
});

const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  portalRole: z.enum(['citizen', 'municipal', 'department']).optional(),
  department: z.string().trim().optional().nullable(),
});

const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1).max(120).optional(),
  email: z.string().trim().email().optional(),
  phone: z.string().trim().max(30).optional().nullable(),
  location: z.string().trim().max(200).optional().nullable(),
  bio: z.string().trim().max(500).optional().nullable(),
  department: z.string().trim().optional().nullable(),
  notifyIssueUpdates: z.boolean().optional(),
  notifyNewRewards: z.boolean().optional(),
  notifyCityAlerts: z.boolean().optional(),
  preferredTheme: z.enum(['light', 'dark']).optional(),
  preferredLanguage: z.enum(['en', 'hi']).optional(),
  currentPassword: z.string().min(1).optional(),
  newPassword: z.string().min(6).optional(),
});

function toPublicUser(record: UserRecord): PublicUser {
  const normalizedDepartment = normalizeDepartment(record.department);

  return {
    uid: record.id,
    name: `${record.first_name} ${record.last_name}`.trim(),
    email: record.email,
    role: record.role,
    department: normalizedDepartment || undefined,
    points: record.points,
    avatar: record.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(`${record.first_name} ${record.last_name}`.trim())}&background=random`,
    phone: record.phone || undefined,
    location: record.location || undefined,
    bio: record.bio || undefined,
    notifyIssueUpdates: record.notify_issue_updates,
    notifyNewRewards: record.notify_new_rewards,
    notifyCityAlerts: record.notify_city_alerts,
    preferredTheme: record.preferred_theme || undefined,
    preferredLanguage: record.preferred_language || undefined,
  };
}

function normalizeDepartment(value?: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'road') return 'roads';
  if (normalized === 'electric') return 'electrical';
  if (normalized === 'admin') return 'administration';
  return normalized;
}

function matchesPortalRole(portalRole: LoginPortalRole | undefined, userRole: UserRole) {
  if (!portalRole) return true;
  if (portalRole === 'municipal') {
    return userRole === 'municipal' || userRole === 'admin';
  }
  return portalRole === userRole;
}

const router = Router();

router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid signup payload.' });
  }

  const { firstName, lastName, email, password, role } = parsed.data;
  const department = normalizeDepartment(parsed.data.department);
  const phone = parsed.data.phone.trim();
  const normalizedEmail = email.toLowerCase();

  if (role === 'department' && !department) {
    return res.status(400).json({ message: 'Department is required for department role.' });
  }

  if (role !== 'department' && department) {
    return res.status(400).json({ message: 'Department is only allowed for department role.' });
  }

  const existing = await pool.query<{ id: string }>('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
  if (existing.rowCount) {
    return res.status(409).json({ message: 'Email is already registered.' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const points = role === 'citizen' ? 0 : 0;
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(`${firstName} ${lastName}`)}&background=random`;

  const inserted = await pool.query<UserRecord>(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, department, points, avatar, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, first_name, last_name, email, role, department, points, avatar, phone, location, bio, notify_issue_updates, notify_new_rewards, notify_city_alerts, preferred_theme, preferred_language, created_at, updated_at, last_login_at`,
    [firstName, lastName, normalizedEmail, passwordHash, role, role === 'department' ? department : null, points, avatar, phone]
  );

  const user = toPublicUser(inserted.rows[0]);
  const token = signToken({ sub: user.uid, email: user.email, role: user.role });

  return res.status(201).json({ token, user });
});

router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid login payload.' });
  }

  const { email, password, portalRole } = parsed.data;
  const requestedDepartment = normalizeDepartment(parsed.data.department);
  const normalizedEmail = email.toLowerCase();

  const found = await pool.query<UserRecord & { password_hash: string }>(
    `SELECT id, first_name, last_name, email, role, department, points, avatar, phone, location, bio, notify_issue_updates, notify_new_rewards, notify_city_alerts, preferred_theme, preferred_language, created_at, updated_at, last_login_at, password_hash
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );

  if (!found.rowCount) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  const record = found.rows[0];
  const validPassword = await bcrypt.compare(password, record.password_hash);

  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  if (!matchesPortalRole(portalRole, record.role)) {
    return res.status(403).json({ message: 'Selected portal does not match your role.' });
  }

  if (portalRole === 'department' && requestedDepartment && normalizeDepartment(record.department) !== requestedDepartment) {
    return res.status(403).json({ message: 'Selected department does not match your account.' });
  }

  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [record.id]);

  const user = toPublicUser(record);
  const token = signToken({ sub: user.uid, email: user.email, role: user.role });

  return res.json({ token, user });
});

router.get('/me', requireAuth, async (req, res) => {
  const userId = req.auth?.uid;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const found = await pool.query<UserRecord>(
    `SELECT id, first_name, last_name, email, role, department, points, avatar, phone, location, bio, notify_issue_updates, notify_new_rewards, notify_city_alerts, preferred_theme, preferred_language, created_at, updated_at, last_login_at
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  if (!found.rowCount) {
    return res.status(404).json({ message: 'User not found.' });
  }

  return res.json({ user: toPublicUser(found.rows[0]) });
});

router.patch('/me', requireAuth, async (req, res) => {
  const userId = req.auth?.uid;

  if (!userId) {
    return res.status(401).json({ message: 'Unauthorized.' });
  }

  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid profile update payload.' });
  }

  const existing = await pool.query<UserRecord & { password_hash: string }>(
    `SELECT id, first_name, last_name, email, role, department, points, avatar, phone, location, bio, notify_issue_updates, notify_new_rewards, notify_city_alerts, preferred_theme, preferred_language, created_at, updated_at, last_login_at, password_hash
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  if (!existing.rowCount) {
    return res.status(404).json({ message: 'User not found.' });
  }

  const currentUser = existing.rows[0];
  const payload = parsed.data;

  let firstName = currentUser.first_name;
  let lastName = currentUser.last_name;

  if (payload.fullName) {
    const parts = payload.fullName.trim().split(/\s+/).filter(Boolean);
    firstName = parts.shift() || currentUser.first_name;
    lastName = parts.join(' ') || currentUser.last_name;
  }

  const normalizedEmail = payload.email ? payload.email.toLowerCase() : currentUser.email;

  if (normalizedEmail !== currentUser.email.toLowerCase()) {
    const duplicate = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
      [normalizedEmail, userId]
    );

    if (duplicate.rowCount) {
      return res.status(409).json({ message: 'Email is already registered by another account.' });
    }
  }

  let phone = currentUser.phone;
  let location = currentUser.location;
  let bio = currentUser.bio;
  let notifyIssueUpdates = currentUser.notify_issue_updates;
  let notifyNewRewards = currentUser.notify_new_rewards;
  let notifyCityAlerts = currentUser.notify_city_alerts;
  let preferredTheme = currentUser.preferred_theme;
  let preferredLanguage = currentUser.preferred_language;
  let passwordHash = currentUser.password_hash;

  if (currentUser.role === 'citizen') {
    if (payload.phone !== undefined) phone = payload.phone || null;
    if (payload.location !== undefined) location = payload.location || null;
    if (payload.bio !== undefined) bio = payload.bio || null;
    if (payload.notifyIssueUpdates !== undefined) notifyIssueUpdates = payload.notifyIssueUpdates;
    if (payload.notifyNewRewards !== undefined) notifyNewRewards = payload.notifyNewRewards;
    if (payload.notifyCityAlerts !== undefined) notifyCityAlerts = payload.notifyCityAlerts;
    if (payload.preferredTheme !== undefined) preferredTheme = payload.preferredTheme;
    if (payload.preferredLanguage !== undefined) preferredLanguage = payload.preferredLanguage;

    if (payload.newPassword !== undefined) {
      if (!payload.currentPassword) {
        return res.status(400).json({ message: 'Current password is required to set a new password.' });
      }

      const validPassword = await bcrypt.compare(payload.currentPassword, currentUser.password_hash);
      if (!validPassword) {
        return res.status(400).json({ message: 'Current password is incorrect.' });
      }

      passwordHash = await bcrypt.hash(payload.newPassword, 10);
    }
  }

  let department = currentUser.department;
  if ((currentUser.role === 'department' || currentUser.role === 'admin') && payload.department !== undefined) {
    department = normalizeDepartment(payload.department) || null;
  }

  const updated = await pool.query<UserRecord>(
    `UPDATE users
     SET first_name = $1,
         last_name = $2,
         email = $3,
         department = $4,
         phone = $5,
         location = $6,
         bio = $7,
         notify_issue_updates = $8,
         notify_new_rewards = $9,
         notify_city_alerts = $10,
         preferred_theme = $11,
         preferred_language = $12,
         password_hash = $13
     WHERE id = $14
     RETURNING id, first_name, last_name, email, role, department, points, avatar, phone, location, bio, notify_issue_updates, notify_new_rewards, notify_city_alerts, preferred_theme, preferred_language, created_at, updated_at, last_login_at`,
    [
      firstName,
      lastName,
      normalizedEmail,
      department,
      phone,
      location,
      bio,
      notifyIssueUpdates,
      notifyNewRewards,
      notifyCityAlerts,
      preferredTheme,
      preferredLanguage,
      passwordHash,
      userId,
    ]
  );

  return res.json({ user: toPublicUser(updated.rows[0]) });
});

router.post('/forgot-password', async (_req, res) => {
  return res.status(501).json({ message: 'Forgot password flow is not configured yet.' });
});

export default router;
