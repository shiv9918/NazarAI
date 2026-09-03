// This file has all the routes for signing up, logging in, viewing/updating
// a profile, and resetting a forgotten password with an OTP.
import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { randomInt } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { LoginPortalRole, PublicUser, UserRecord, UserRole, USER_ROLES } from '../types/auth';
import { signToken } from '../utils/token';
import { sendTwilioSmsMessage } from '../services/twilioWhatsapp';

// How long a password-reset OTP stays valid, and how many wrong tries are allowed.
const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;

// Rules for validating the signup form data.
const signupSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email(),
  password: z.string().min(6),
  phone: z.string().trim().min(8).max(20),
  role: z.enum(USER_ROLES).default('citizen'),
  department: z.string().trim().optional().nullable(),
});

// Rules for validating the login form data.
const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1),
  portalRole: z.enum(['citizen', 'municipal', 'department']).optional(),
  department: z.string().trim().optional().nullable(),
});

// Rules for validating profile-update data (all fields optional since it's a partial update).
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

// Rules for validating the "forgot password" request (just needs an email).
const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
});

// Rules for validating the "reset password with OTP" request.
const resetPasswordWithOtpSchema = z.object({
  email: z.string().trim().email(),
  otp: z.string().trim().length(6),
  newPassword: z.string().min(6),
});

// Make a random 6-digit one-time password.
function generateOtp() {
  return randomInt(100000, 1000000).toString();
}

// Hide most of a phone number, only show the last 4 digits (for safe display in messages).
function maskPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return '****';
  return `******${digits.slice(-4)}`;
}

// Turn a raw database user row into the safe shape we send back to the client
// (no password hash, friendlier field names).
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

// Clean up a department name and fix a few known shorthand/typo values.
function normalizeDepartment(value?: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'road') return 'roads';
  if (normalized === 'electric') return 'electrical';
  if (normalized === 'admin') return 'administration';
  return normalized;
}

// Check that the login portal picked on the frontend (citizen/municipal/department)
// actually matches this user's real role.
function matchesPortalRole(portalRole: LoginPortalRole | undefined, userRole: UserRole) {
  if (!portalRole) return true;
  if (portalRole === 'municipal') {
    return userRole === 'municipal' || userRole === 'admin';
  }
  return portalRole === userRole;
}

const router = Router();

// Create a new account.
router.post('/signup', async (req, res) => {
  const parsed = signupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid signup payload.' });
  }

  const { firstName, lastName, email, password, role } = parsed.data;
  const department = normalizeDepartment(parsed.data.department);
  const phone = parsed.data.phone.trim();
  const normalizedEmail = email.toLowerCase();

  // Department is required only for department-role accounts.
  if (role === 'department' && !department) {
    return res.status(400).json({ message: 'Department is required for department role.' });
  }

  if (role !== 'department' && department) {
    return res.status(400).json({ message: 'Department is only allowed for department role.' });
  }

  // Don't allow two accounts with the same email.
  const existing = await pool.query<{ id: string }>('SELECT id FROM users WHERE LOWER(email) = LOWER($1)', [normalizedEmail]);
  if (existing.rowCount) {
    return res.status(409).json({ message: 'Email is already registered.' });
  }

  // Never store the raw password, only a hashed version. Also make a default avatar image.
  const passwordHash = await bcrypt.hash(password, 10);
  const points = role === 'citizen' ? 0 : 0;
  const avatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(`${firstName} ${lastName}`)}&background=random`;

  // Save the new user in the database.
  const inserted = await pool.query<UserRecord>(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, department, points, avatar, phone)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, first_name, last_name, email, role, department, points, avatar, phone, location, bio, notify_issue_updates, notify_new_rewards, notify_city_alerts, preferred_theme, preferred_language, created_at, updated_at, last_login_at`,
    [firstName, lastName, normalizedEmail, passwordHash, role, role === 'department' ? department : null, points, avatar, phone]
  );

  // Give the new user a login token so they are signed in right after signup.
  const user = toPublicUser(inserted.rows[0]);
  const token = signToken({ sub: user.uid, email: user.email, role: user.role });

  return res.status(201).json({ token, user });
});

// Sign in with email and password.
router.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid login payload.' });
  }

  const { email, password, portalRole } = parsed.data;
  const requestedDepartment = normalizeDepartment(parsed.data.department);
  const normalizedEmail = email.toLowerCase();

  // Look up the user by email.
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
  // Check the password matches the stored hash.
  const validPassword = await bcrypt.compare(password, record.password_hash);

  if (!validPassword) {
    return res.status(401).json({ message: 'Invalid email or password.' });
  }

  // Make sure they logged in from the correct portal (citizen/municipal/department).
  if (!matchesPortalRole(portalRole, record.role)) {
    return res.status(403).json({ message: 'Selected portal does not match your role.' });
  }

  if (portalRole === 'department' && requestedDepartment && normalizeDepartment(record.department) !== requestedDepartment) {
    return res.status(403).json({ message: 'Selected department does not match your account.' });
  }

  // Remember when the user last logged in.
  await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [record.id]);

  const user = toPublicUser(record);
  const token = signToken({ sub: user.uid, email: user.email, role: user.role });

  return res.json({ token, user });
});

// Get the profile of the currently logged-in user.
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

// Update the profile of the currently logged-in user (name, email, phone, settings, password, etc).
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

  // Start with the current name, split "fullName" into first/last if it was sent.
  let firstName = currentUser.first_name;
  let lastName = currentUser.last_name;

  if (payload.fullName) {
    const parts = payload.fullName.trim().split(/\s+/).filter(Boolean);
    firstName = parts.shift() || currentUser.first_name;
    lastName = parts.join(' ') || currentUser.last_name;
  }

  const normalizedEmail = payload.email ? payload.email.toLowerCase() : currentUser.email;

  // If the email is changing, make sure no other account already uses it.
  if (normalizedEmail !== currentUser.email.toLowerCase()) {
    const duplicate = await pool.query<{ id: string }>(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2 LIMIT 1',
      [normalizedEmail, userId]
    );

    if (duplicate.rowCount) {
      return res.status(409).json({ message: 'Email is already registered by another account.' });
    }
  }

  // Keep current values as defaults; only overwrite the ones actually sent.
  let phone = currentUser.phone;
  let location = currentUser.location;
  let bio = currentUser.bio;
  let notifyIssueUpdates = currentUser.notify_issue_updates;
  let notifyNewRewards = currentUser.notify_new_rewards;
  let notifyCityAlerts = currentUser.notify_city_alerts;
  let preferredTheme = currentUser.preferred_theme;
  let preferredLanguage = currentUser.preferred_language;
  let passwordHash = currentUser.password_hash;

  // Only citizen accounts can update these extra profile fields and their password.
  if (currentUser.role === 'citizen') {
    if (payload.phone !== undefined) phone = payload.phone || null;
    if (payload.location !== undefined) location = payload.location || null;
    if (payload.bio !== undefined) bio = payload.bio || null;
    if (payload.notifyIssueUpdates !== undefined) notifyIssueUpdates = payload.notifyIssueUpdates;
    if (payload.notifyNewRewards !== undefined) notifyNewRewards = payload.notifyNewRewards;
    if (payload.notifyCityAlerts !== undefined) notifyCityAlerts = payload.notifyCityAlerts;
    if (payload.preferredTheme !== undefined) preferredTheme = payload.preferredTheme;
    if (payload.preferredLanguage !== undefined) preferredLanguage = payload.preferredLanguage;

    // To change the password, the current password must be given and correct.
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

  // Only department/admin accounts can change their department.
  let department = currentUser.department;
  if ((currentUser.role === 'department' || currentUser.role === 'admin') && payload.department !== undefined) {
    department = normalizeDepartment(payload.department) || null;
  }

  // Save all the updated fields back to the database.
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

// Start the "forgot password" process: find the user, make an OTP, and text it to them.
router.post('/forgot-password', async (req, res) => {
  const parsed = forgotPasswordSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid forgot-password payload.' });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();

  const userResult = await pool.query<UserRecord>(
    `SELECT id, first_name, last_name, email, role, department, points, avatar, phone, location, bio, notify_issue_updates, notify_new_rewards, notify_city_alerts, preferred_theme, preferred_language, created_at, updated_at, last_login_at
     FROM users
     WHERE LOWER(email) = LOWER($1)
     LIMIT 1`,
    [normalizedEmail]
  );

  // Always return success-like response to avoid user enumeration.
  if (!userResult.rowCount) {
    return res.json({ message: 'If an account exists for this email, an OTP has been sent.' });
  }

  const user = userResult.rows[0];
  const userPhone = (user.phone || '').trim();

  if (!userPhone) {
    return res.status(400).json({ message: 'No mobile number is registered with this account.' });
  }

  // Make a new OTP and store only its hash (never the plain OTP).
  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);

  // Cancel any older, still-active OTP for this user first.
  await pool.query(
    `UPDATE password_reset_otps
     SET consumed_at = NOW()
     WHERE user_id = $1
       AND consumed_at IS NULL`,
    [user.id]
  );

  await pool.query(
    `INSERT INTO password_reset_otps (user_id, otp_hash, expires_at)
     VALUES ($1, $2, NOW() + INTERVAL '${OTP_TTL_MINUTES} minutes')`,
    [user.id, otpHash]
  );

  // Text the OTP to the user's phone via Twilio.
  const smsBody = `Nazar AI OTP: ${otp}. Valid for ${OTP_TTL_MINUTES} minutes. Do not share this code.`;
  const smsResult = await sendTwilioSmsMessage({
    to: userPhone,
    message: smsBody,
  });

  // Report specific, helpful errors if the SMS could not be sent.
  if (!smsResult.ok) {
    if (smsResult.internalReason === 'MISSING_SMS_SENDER') {
      return res.status(500).json({
        message: 'SMS sender is not configured. Set TWILIO_SMS_NUMBER or TWILIO_MESSAGING_SERVICE_SID in backend env.',
      });
    }

    if (smsResult.providerCode === 21660) {
      return res.status(500).json({
        message: 'Twilio sender mismatch. Use a sender number or messaging service that belongs to your Twilio account.',
      });
    }

    const debugInfo = smsResult.providerCode
      ? ` (Twilio ${smsResult.providerCode}: ${smsResult.providerMessage || 'Unknown error'})`
      : '';

    return res.status(500).json({
      message: `Unable to send OTP SMS right now. Please try again shortly${process.env.NODE_ENV === 'production' ? '' : debugInfo}.`,
    });
  }

  return res.json({ message: `OTP sent to your registered mobile ending with ${maskPhoneNumber(userPhone)}.` });
});

// Finish the "forgot password" process: check the OTP, then set the new password.
router.post('/reset-password', async (req, res) => {
  const parsed = resetPasswordWithOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid reset-password payload.' });
  }

  const normalizedEmail = parsed.data.email.toLowerCase();
  const { otp, newPassword } = parsed.data;

  // Find the most recent, not-yet-used OTP for this email.
  const otpResult = await pool.query<{
    id: string;
    user_id: string;
    otp_hash: string;
    expires_at: string;
    consumed_at: string | null;
    attempts: number;
  }>(
    `SELECT pro.id, pro.user_id, pro.otp_hash, pro.expires_at, pro.consumed_at, pro.attempts
     FROM password_reset_otps pro
     JOIN users u ON u.id = pro.user_id
     WHERE LOWER(u.email) = LOWER($1)
       AND pro.consumed_at IS NULL
     ORDER BY pro.created_at DESC
     LIMIT 1`,
    [normalizedEmail]
  );

  if (!otpResult.rowCount) {
    return res.status(400).json({ message: 'Invalid or expired OTP.' });
  }

  const otpRecord = otpResult.rows[0];
  const isExpired = new Date(otpRecord.expires_at).getTime() < Date.now();

  // Reject if the OTP is too old.
  if (isExpired) {
    await pool.query('UPDATE password_reset_otps SET consumed_at = NOW() WHERE id = $1', [otpRecord.id]);
    return res.status(400).json({ message: 'Invalid or expired OTP.' });
  }

  // Reject if too many wrong OTPs were already tried.
  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await pool.query('UPDATE password_reset_otps SET consumed_at = NOW() WHERE id = $1', [otpRecord.id]);
    return res.status(400).json({ message: 'Too many invalid OTP attempts. Please request a new OTP.' });
  }

  const validOtp = await bcrypt.compare(otp, otpRecord.otp_hash);

  // Wrong OTP: count the attempt and reject.
  if (!validOtp) {
    await pool.query('UPDATE password_reset_otps SET attempts = attempts + 1 WHERE id = $1', [otpRecord.id]);
    return res.status(400).json({ message: 'Invalid or expired OTP.' });
  }

  // OTP is correct: set the new password and mark the OTP as used.
  const newPasswordHash = await bcrypt.hash(newPassword, 10);

  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [newPasswordHash, otpRecord.user_id]);
  await pool.query('UPDATE password_reset_otps SET consumed_at = NOW() WHERE id = $1', [otpRecord.id]);

  return res.json({ message: 'Password reset successful. Please login with your new password.' });
});

export default router;
