import { Router } from 'express';
import { z } from 'zod';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { UserRole } from '../types/auth';

type DbUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  department: string | null;
};

type DbReport = {
  id: string;
  department: string;
  citizen_id: string;
  status: 'reported' | 'in_progress' | 'resolved';
  proof_image_url: string | null;
};

type LeaderboardRow = {
  id: string;
  name: string;
  reportsCount: number;
  resolvedCount: number;
  points: number;
  rank: number;
};

const reportPayloadSchema = z.object({
  id: z.string().uuid().optional(),
  type: z.string().trim().min(1),
  severity: z.number().int().min(1).max(10).default(5),
  lat: z.number(),
  lng: z.number(),
  location: z.string().trim().min(1),
  ward: z.string().trim().optional().nullable(),
  department: z.string().trim().optional().nullable(),
  description: z.string().trim().optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  isDuplicate: z.boolean().optional().default(false),
  isEmergency: z.boolean().optional().default(false),
  aiDescription: z.string().trim().optional().nullable(),
});

const updateStatusSchema = z.object({
  status: z.enum(['reported', 'in_progress', 'resolved']),
  proofImageUrl: z.string().trim().optional().nullable(),
});

const updateReportSchema = z.object({
  status: z.enum(['reported', 'in_progress', 'resolved']).optional(),
  department: z.string().trim().optional(),
  resolutionNotes: z.string().trim().optional().nullable(),
  proofImageUrl: z.string().trim().optional().nullable(),
  isEmergency: z.boolean().optional(),
});

const departmentByType: Record<string, string> = {
  garbage: 'sanitation',
  garbage_overflow: 'sanitation',
  illegal_dump: 'sanitation',
  dump: 'sanitation',
  pothole: 'roads',
  road: 'roads',
  broken_streetlight: 'electrical',
  streetlight: 'electrical',
  electrical: 'electrical',
  water: 'water',
  water_leakage: 'water',
  leakage: 'water',
};

const validDepartments = new Set(['sanitation', 'roads', 'electrical', 'water', 'administration']);

function normalizeDepartment(value?: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase().trim();
  if (normalized === 'road') return 'roads';
  if (normalized === 'electric') return 'electrical';
  if (normalized === 'admin') return 'administration';
  return normalized;
}

const selectReportProjection = `
  id,
  type,
  severity,
  lat,
  lng,
  location,
  ward,
  department,
  description,
  image_url AS "imageUrl",
  is_duplicate AS "isDuplicate",
  is_emergency AS "isEmergency",
  status,
  resolution_notes AS "resolutionNotes",
  proof_image_url AS "proofImageUrl",
  resolved_at AS "resolvedAt",
  reported_at AS "reportedAt",
  updated_at AS "updatedAt",
  citizen_id AS "citizenId",
  citizen_name AS "citizenName",
  citizen_email AS "citizenEmail",
  ai_description AS "aiDescription"
`;

function isValidProofImage(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed);
}

function assignDepartment(issueType: string, requestedDepartment?: string | null) {
  const normalizedType = issueType.toLowerCase().trim().replace(/\s+/g, '_');
  if (departmentByType[normalizedType]) {
    return departmentByType[normalizedType];
  }

  if (normalizedType.includes('dump') || normalizedType.includes('garbage')) return 'sanitation';
  if (normalizedType.includes('pothole') || normalizedType.includes('road')) return 'roads';
  if (normalizedType.includes('light') || normalizedType.includes('electric')) return 'electrical';
  if (normalizedType.includes('water') || normalizedType.includes('leak')) return 'water';

  const fallback = normalizeDepartment(requestedDepartment) || '';
  if (validDepartments.has(fallback)) return fallback;

  return 'administration';
}

async function getCurrentUser(userId: string) {
  const result = await pool.query<DbUser>(
    `SELECT id, first_name, last_name, email, role, department
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [userId]
  );

  return result.rows[0] || null;
}

const router = Router();

router.use(requireAuth);

router.post('/', async (req, res) => {
  const parsed = reportPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid report payload.' });
  }

  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (currentUser.role !== 'citizen') {
    return res.status(403).json({ message: 'Only citizens can create reports.' });
  }

  const report = parsed.data;
  const assignedDepartment = assignDepartment(report.type, report.department);
  const citizenName = `${currentUser.first_name} ${currentUser.last_name}`.trim();

  const inserted = await pool.query(
    `INSERT INTO reports (
      id,
      type,
      severity,
      lat,
      lng,
      location,
      ward,
      department,
      description,
      image_url,
      is_duplicate,
      is_emergency,
      status,
      reported_at,
      citizen_id,
      citizen_name,
      citizen_email,
      ai_description
    )
    VALUES (
      COALESCE($1::uuid, gen_random_uuid()),
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      $9,
      $10,
      $11,
      $12,
      'reported',
      NOW(),
      $13,
      $14,
      $15,
      $16
    )
    RETURNING
      ${selectReportProjection}`,
    [
      report.id ?? null,
      report.type,
      report.severity,
      report.lat,
      report.lng,
      report.location,
      report.ward ?? null,
      assignedDepartment,
      report.description ?? null,
      report.imageUrl ?? null,
      report.isDuplicate,
      report.isEmergency,
      currentUser.id,
      citizenName,
      currentUser.email,
      report.aiDescription ?? null,
    ]
  );

  return res.status(201).json({ report: inserted.rows[0] });
});

router.get('/', async (req, res) => {
  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  let queryText = `SELECT ${selectReportProjection} FROM reports`;
  const params: string[] = [];

  if (currentUser.role === 'citizen') {
    queryText += ' WHERE citizen_id = $1';
    params.push(currentUser.id);
  } else if (currentUser.role === 'department' && currentUser.department) {
    queryText += ' WHERE department = $1';
    params.push(normalizeDepartment(currentUser.department) || currentUser.department);
  }

  queryText += ' ORDER BY reported_at DESC';

  const result = await pool.query(queryText, params);
  return res.json({ reports: result.rows });
});

router.get('/leaderboard', async (req, res) => {
  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  const leadersResult = await pool.query<LeaderboardRow>(
    `WITH citizen_stats AS (
      SELECT
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) AS name,
        COUNT(r.id)::int AS "reportsCount",
        COUNT(*) FILTER (WHERE r.status = 'resolved')::int AS "resolvedCount",
        (COUNT(r.id) * 20 + COUNT(*) FILTER (WHERE r.status = 'resolved') * 10)::int AS points
      FROM users u
      LEFT JOIN reports r ON r.citizen_id = u.id
      WHERE u.role = 'citizen'
      GROUP BY u.id, u.first_name, u.last_name
    ),
    ranked AS (
      SELECT
        id,
        name,
        "reportsCount",
        "resolvedCount",
        points,
        ROW_NUMBER() OVER (ORDER BY points DESC, "reportsCount" DESC, name ASC) AS rank
      FROM citizen_stats
      WHERE "reportsCount" > 0
    )
    SELECT id, name, "reportsCount", "resolvedCount", points, rank
    FROM ranked
    ORDER BY rank
    LIMIT 50`
  );

  const currentUserResult = await pool.query<LeaderboardRow>(
    `WITH citizen_stats AS (
      SELECT
        u.id,
        CONCAT(u.first_name, ' ', u.last_name) AS name,
        COUNT(r.id)::int AS "reportsCount",
        COUNT(*) FILTER (WHERE r.status = 'resolved')::int AS "resolvedCount",
        (COUNT(r.id) * 20 + COUNT(*) FILTER (WHERE r.status = 'resolved') * 10)::int AS points
      FROM users u
      LEFT JOIN reports r ON r.citizen_id = u.id
      WHERE u.role = 'citizen'
      GROUP BY u.id, u.first_name, u.last_name
    ),
    ranked AS (
      SELECT
        id,
        name,
        "reportsCount",
        "resolvedCount",
        points,
        ROW_NUMBER() OVER (ORDER BY points DESC, "reportsCount" DESC, name ASC) AS rank
      FROM citizen_stats
    )
    SELECT id, name, "reportsCount", "resolvedCount", points, rank
    FROM ranked
    WHERE id = $1
    LIMIT 1`,
    [currentUser.id]
  );

  return res.json({
    leaders: leadersResult.rows,
    currentUser: currentUserResult.rows[0] || null,
  });
});

router.get('/:id', async (req, res) => {
  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  const reportResult = await pool.query<DbReport>(
    `SELECT id, department, citizen_id, status, proof_image_url
     FROM reports
     WHERE id = $1
     LIMIT 1`,
    [req.params.id]
  );

  if (!reportResult.rowCount) {
    return res.status(404).json({ message: 'Report not found.' });
  }

  const reportMeta = reportResult.rows[0];
  const currentUserDepartment = normalizeDepartment(currentUser.department);
  const reportDepartment = normalizeDepartment(reportMeta.department);

  if (currentUser.role === 'citizen' && reportMeta.citizen_id !== currentUser.id) {
    return res.status(404).json({ message: 'Report not found.' });
  }

  if (currentUser.role === 'department' && currentUserDepartment !== reportDepartment) {
    return res.status(404).json({ message: 'Report not found.' });
  }

  const fullReport = await pool.query(
    `SELECT ${selectReportProjection}
     FROM reports
     WHERE id = $1
     LIMIT 1`,
    [req.params.id]
  );

  return res.json({ report: fullReport.rows[0] });
});

router.patch('/:id', async (req, res) => {
  const parsed = updateReportSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid report update payload.' });
  }

  const hasAnyUpdate =
    parsed.data.status !== undefined ||
    parsed.data.department !== undefined ||
    parsed.data.resolutionNotes !== undefined ||
    parsed.data.proofImageUrl !== undefined ||
    parsed.data.isEmergency !== undefined;

  if (!hasAnyUpdate) {
    return res.status(400).json({ message: 'No fields provided to update.' });
  }

  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (currentUser.role === 'citizen') {
    return res.status(403).json({ message: 'Citizens cannot update report details.' });
  }

  const reportResult = await pool.query<DbReport>(
    `SELECT id, department, citizen_id, status, proof_image_url
     FROM reports
     WHERE id = $1
     LIMIT 1`,
    [req.params.id]
  );

  if (!reportResult.rowCount) {
    return res.status(404).json({ message: 'Report not found.' });
  }

  const existingReport = reportResult.rows[0];
  const currentUserDepartment = normalizeDepartment(currentUser.department);
  const reportDepartment = normalizeDepartment(existingReport.department);

  if (currentUser.role === 'department' && currentUserDepartment !== reportDepartment) {
    return res.status(403).json({ message: 'You cannot update reports outside your department.' });
  }

  const normalizedDepartment = parsed.data.department !== undefined
    ? normalizeDepartment(parsed.data.department)
    : undefined;

  if (normalizedDepartment !== undefined && (!normalizedDepartment || !validDepartments.has(normalizedDepartment))) {
    return res.status(400).json({ message: 'Invalid department value.' });
  }

  const nextStatus = parsed.data.status ?? existingReport.status;
  const nextProofImage = parsed.data.proofImageUrl !== undefined
    ? parsed.data.proofImageUrl
    : existingReport.proof_image_url;

  if (nextStatus === 'resolved' && !nextProofImage) {
    return res.status(400).json({ message: 'Proof image is required when marking issue as resolved.' });
  }

  if (nextStatus === 'resolved' && nextProofImage && !isValidProofImage(nextProofImage)) {
    return res.status(400).json({ message: 'A valid proof image is required when marking issue as resolved.' });
  }

  const updated = await pool.query(
    `UPDATE reports
     SET status = CASE WHEN $1::boolean THEN $2::report_status ELSE status END,
         department = CASE WHEN $3::boolean THEN $4 ELSE department END,
         resolution_notes = CASE WHEN $5::boolean THEN $6 ELSE resolution_notes END,
         proof_image_url = CASE WHEN $7::boolean THEN $8 ELSE proof_image_url END,
         is_emergency = CASE WHEN $9::boolean THEN $10 ELSE is_emergency END,
         resolved_at = CASE
           WHEN (CASE WHEN $1::boolean THEN $2::report_status ELSE status END) = 'resolved'::report_status
             THEN COALESCE(resolved_at, NOW())
           ELSE NULL
         END
     WHERE id = $11
     RETURNING ${selectReportProjection}`,
    [
      parsed.data.status !== undefined,
      parsed.data.status ?? null,
      normalizedDepartment !== undefined,
      normalizedDepartment ?? null,
      parsed.data.resolutionNotes !== undefined,
      parsed.data.resolutionNotes ?? null,
      parsed.data.proofImageUrl !== undefined,
      parsed.data.proofImageUrl ?? null,
      parsed.data.isEmergency !== undefined,
      parsed.data.isEmergency ?? null,
      req.params.id,
    ]
  );

  return res.json({ report: updated.rows[0] });
});

router.patch('/:id/status', async (req, res) => {
  const parsed = updateStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ message: parsed.error.issues[0]?.message || 'Invalid status payload.' });
  }

  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (currentUser.role === 'citizen') {
    return res.status(403).json({ message: 'Citizens cannot update issue status.' });
  }

  // Require proof image when marking as resolved
  if (parsed.data.status === 'resolved' && !parsed.data.proofImageUrl) {
    return res.status(400).json({ message: 'Proof image is required when marking issue as resolved.' });
  }

  if (parsed.data.status === 'resolved' && parsed.data.proofImageUrl && !isValidProofImage(parsed.data.proofImageUrl)) {
      return res.status(400).json({ message: 'A valid proof image is required when marking issue as resolved.' });
  }

  const reportResult = await pool.query<DbReport>(
    `SELECT id, department, citizen_id, status, proof_image_url
     FROM reports
     WHERE id = $1
     LIMIT 1`,
    [req.params.id]
  );

  if (!reportResult.rowCount) {
    return res.status(404).json({ message: 'Report not found.' });
  }

  const report = reportResult.rows[0];
  const currentUserDepartment = normalizeDepartment(currentUser.department);
  const reportDepartment = normalizeDepartment(report.department);

  if (currentUser.role === 'department' && currentUserDepartment !== reportDepartment) {
    return res.status(403).json({ message: 'You cannot update reports outside your department.' });
  }

  // Update with proof image if provided
  const updated = await pool.query(
    `UPDATE reports
     SET status = $1::report_status,
         proof_image_url = $2,
         resolved_at = CASE
           WHEN $1::report_status = 'resolved'::report_status THEN NOW()
           ELSE resolved_at
         END
     WHERE id = $3
     RETURNING ${selectReportProjection}`,
    [parsed.data.status, parsed.data.proofImageUrl || null, req.params.id]
  );

  return res.json({ report: updated.rows[0] });
});

export default router;