import { Router } from 'express';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { pool } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { UserRole } from '../types/auth';
import { assignDepartment, normalizeDepartment, validDepartments } from '../utils/reportAssignment';
import { sendResolvedWhatsappNotificationWithFeedback } from '../services/whatsappResolutionFlow';

type DbUser = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  role: UserRole;
  department: string | null;
};

type DbReport = {
  id: string;
  department: string;
  citizen_id: string;
  status: 'reported' | 'in_progress' | 'resolved';
  proof_image_url: string | null;
  reported_at: Date;
  resolution_notes: string | null;
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
  resolutionNotes: z.string().trim().optional().nullable(),
  resolvedByOfficer: z.string().trim().optional().nullable(),
});

const updateReportSchema = z.object({
  status: z.enum(['reported', 'in_progress', 'resolved']).optional(),
  department: z.string().trim().optional(),
  resolutionNotes: z.string().trim().optional().nullable(),
  proofImageUrl: z.string().trim().optional().nullable(),
  resolvedByOfficer: z.string().trim().optional().nullable(),
  isEmergency: z.boolean().optional(),
});

const allowedIssueTypes = new Set([
  // PWD (Public Works Dept) - Roads
  'pothole',
  'road_damage',
  'road_crack',
  
  // BSES / NDMC - Electrical & Wires
  'broken_streetlight',
  'street_light',
  'hanging_wire',
  'light_outage',
  
  // DJB (Delhi Jal Board) - Water & Sewage
  'water_leakage',
  'pipe_burst',
  'sewage_leak',
  'waterlogging',
  
  // Traffic Police
  'traffic_signal',
  
  // Forest Department
  'fallen_tree',
  'tree_gira',
  
  // Delhi Fire Services
  'fire',
  'accident',
  
  // Sanitation Department
  'garbage_overflow',
  'illegal_dumping',
  'dump',
]);


const selectReportProjection = `
  id,
  complaint_number AS "complaintNumber",
  (
    'CMP-'
    || TO_CHAR(COALESCE(reported_at, NOW()), 'YYYY')
    || '-'
    || LPAD(COALESCE(complaint_number, 0)::text, 6, '0')
  ) AS "complaintCode",
  type,
  severity,
  lat,
  lng,
  location,
  ward,
  department,
  original_department AS "originalDepartment",
  description,
  image_url AS "imageUrl",
  is_duplicate AS "isDuplicate",
  is_emergency AS "isEmergency",
  status,
  resolution_notes AS "resolutionNotes",
  proof_image_url AS "proofImageUrl",
  resolved_by_officer AS "resolvedByOfficer",
  resolution_time_taken_hours AS "resolutionTimeTakenHours",
  citizen_rating AS "citizenRating",
  citizen_feedback AS "citizenFeedback",
  reopen_votes AS "reopenVotes",
  is_reopened AS "isReopened",
  resolved_at AS "resolvedAt",
  reported_at AS "reportedAt",
  updated_at AS "updatedAt",
  citizen_id AS "citizenId",
  citizen_name AS "citizenName",
  citizen_email AS "citizenEmail",
  citizen_phone AS "citizenPhone",
  ai_description AS "aiDescription"
`;

function isValidProofImage(value: string) {
  const trimmed = value.trim();
  return trimmed.startsWith('data:image/') || /^https?:\/\//i.test(trimmed);
}

function isValidResolutionNotes(value: string | null | undefined) {
  if (!value) return false;
  return value.trim().length >= 20;
}

function getDataUrlImageHash(imageUrl?: string | null) {
  if (!imageUrl) return null;
  const trimmed = imageUrl.trim();
  if (!trimmed.startsWith('data:image/')) return null;
  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0) return null;
  const base64Payload = trimmed.slice(commaIndex + 1).replace(/\s+/g, '');
  if (!base64Payload) return null;

  return createHash('sha256').update(base64Payload).digest('hex');
}

async function getCurrentUser(userId: string) {
  const result = await pool.query<DbUser>(
    `SELECT id, first_name, last_name, email, phone, role, department
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
  if (!allowedIssueTypes.has(report.type)) {
    return res.status(400).json({
      message:
        'Invalid image category. Please upload a valid civic issue image (pothole, garbage overflow, broken streetlight, water leakage, illegal dumping, fallen tree, hanging wire, park broken equipment, public bench broken).',
    });
  }

  if (report.imageUrl) {
    const incomingImageHash = getDataUrlImageHash(report.imageUrl);
    const duplicateResult = await pool.query<{ id: string; complaint_code: string }>(
      `SELECT
         id,
         (
           'CMP-'
           || TO_CHAR(COALESCE(reported_at, NOW()), 'YYYY')
           || '-'
           || LPAD(COALESCE(complaint_number, 0)::text, 6, '0')
         ) AS complaint_code
       FROM reports
       WHERE citizen_id = $1
         AND ABS(lat - $3) <= 0.0007
         AND ABS(lng - $4) <= 0.0007
         AND (
           image_url = $2
           OR (
             $5::text IS NOT NULL
             AND image_url LIKE 'data:image/%;base64,%'
             AND encode(digest(split_part(image_url, ',', 2), 'sha256'), 'hex') = $5
           )
         )
       LIMIT 1`,
      [currentUser.id, report.imageUrl, report.lat, report.lng, incomingImageHash]
    );

    if (duplicateResult.rowCount) {
      return res.status(409).json({
        message: 'This report already has been submitted.',
        complaintCode: duplicateResult.rows[0].complaint_code,
      });
    }
  }

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
      citizen_phone,
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
      $16,
      $17
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
      currentUser.phone,
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

  const rawId = String(req.params.id).trim();
  const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  const complaintCodePattern = /^[A-Za-z]{3}-\d{4}-\d{4,6}$/;

  let idQueryText = '';
  let idQueryParams: any[] = [];

  let reportMeta = null;
  // 1. Try by UUID
  if (uuidPattern.test(rawId)) {
    const result = await pool.query<DbReport>(
      `SELECT * FROM reports WHERE id = $1 LIMIT 1`,
      [rawId]
    );
    if (result.rowCount) reportMeta = result.rows[0];
  }
  // 2. Try by full complaint code string
  if (!reportMeta && complaintCodePattern.test(rawId)) {
    const result = await pool.query<DbReport>(
      `SELECT * FROM reports WHERE ('CMP-' || TO_CHAR(COALESCE(reported_at, NOW()), 'YYYY') || '-' || LPAD(COALESCE(complaint_number, 0)::text, 6, '0')) = $1 LIMIT 1`,
      [rawId]
    );
    if (result.rowCount) reportMeta = result.rows[0];
  }
  // 3. Try by complaint number
  if (!reportMeta && /^\d+$/.test(rawId)) {
    const result = await pool.query<DbReport>(
      `SELECT * FROM reports WHERE complaint_number = $1 LIMIT 1`,
      [Number(rawId)]
    );
    if (result.rowCount) reportMeta = result.rows[0];
  }
  // 4. Not found
  if (!reportMeta) {
    return res.status(404).json({ message: 'Report not found.' });
  }

  // (For debugging: allow all users to view any report)
  // const currentUserDepartment = normalizeDepartment(currentUser.department);
  // const reportDepartment = normalizeDepartment(reportMeta.department);
  // if (currentUser.role === 'citizen' && reportMeta.citizen_id !== currentUser.id) {
  //   return res.status(404).json({ message: 'Report not found.' });
  // }
  // if (currentUser.role === 'department' && currentUserDepartment !== reportDepartment) {
  //   return res.status(404).json({ message: 'Report not found.' });
  // }

  const fullReport = await pool.query(
    `SELECT ${selectReportProjection}
     FROM reports
     WHERE id = $1
     LIMIT 1`,
    [reportMeta.id]
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
    parsed.data.resolvedByOfficer !== undefined ||
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

  const nextResolutionNotes = parsed.data.resolutionNotes !== undefined
    ? parsed.data.resolutionNotes
    : existingReport.resolution_notes ?? null;

  if (existingReport.status !== 'resolved' && nextStatus === 'resolved' && !isValidResolutionNotes(nextResolutionNotes)) {
    return res.status(400).json({ message: 'Resolution notes are mandatory and must be at least 20 characters.' });
  }

  const officerName = parsed.data.resolvedByOfficer && parsed.data.resolvedByOfficer.trim().length
    ? parsed.data.resolvedByOfficer.trim()
    : `${currentUser.first_name} ${currentUser.last_name}`.trim();

  const updated = await pool.query(
    `UPDATE reports
     SET status = CASE WHEN $1::boolean THEN $2::report_status ELSE status END,
         department = CASE WHEN $3::boolean THEN $4 ELSE department END,
         resolution_notes = CASE WHEN $5::boolean THEN $6 ELSE resolution_notes END,
         proof_image_url = CASE WHEN $7::boolean THEN $8 ELSE proof_image_url END,
         is_emergency = CASE WHEN $9::boolean THEN $10 ELSE is_emergency END,
         resolved_by_officer = CASE
           WHEN (CASE WHEN $1::boolean THEN $2::report_status ELSE status END) = 'resolved'::report_status
             THEN $11
           ELSE resolved_by_officer
         END,
         resolution_time_taken_hours = CASE
           WHEN (CASE WHEN $1::boolean THEN $2::report_status ELSE status END) = 'resolved'::report_status
             THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - reported_at)) / 3600.0))::int
           ELSE resolution_time_taken_hours
         END,
         is_reopened = CASE
           WHEN (CASE WHEN $1::boolean THEN $2::report_status ELSE status END) = 'resolved'::report_status
             THEN FALSE
           ELSE is_reopened
         END,
         resolved_at = CASE
           WHEN (CASE WHEN $1::boolean THEN $2::report_status ELSE status END) = 'resolved'::report_status
             THEN COALESCE(resolved_at, NOW())
           ELSE NULL
         END
     WHERE id = $12
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
      officerName,
      req.params.id,
    ]
  );

  if (existingReport.status !== 'resolved' && updated.rows[0]?.status === 'resolved') {
    await sendResolvedWhatsappNotificationWithFeedback(req.params.id);
  }

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
    `SELECT id, department, citizen_id, status, proof_image_url, reported_at, resolution_notes
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

  if (report.status !== 'resolved' && parsed.data.status === 'resolved' && !isValidResolutionNotes(parsed.data.resolutionNotes)) {
    return res.status(400).json({ message: 'Resolution notes are mandatory and must be at least 20 characters.' });
  }

  const officerName = parsed.data.resolvedByOfficer && parsed.data.resolvedByOfficer.trim().length
    ? parsed.data.resolvedByOfficer.trim()
    : `${currentUser.first_name} ${currentUser.last_name}`.trim();

  // Update with proof image if provided
  const updated = await pool.query(
    `UPDATE reports
     SET status = $1::report_status,
         proof_image_url = $2,
         resolution_notes = CASE WHEN $1::report_status = 'resolved'::report_status THEN $3 ELSE resolution_notes END,
         resolved_by_officer = CASE WHEN $1::report_status = 'resolved'::report_status THEN $4 ELSE resolved_by_officer END,
         resolution_time_taken_hours = CASE
           WHEN $1::report_status = 'resolved'::report_status
             THEN GREATEST(0, ROUND(EXTRACT(EPOCH FROM (NOW() - reported_at)) / 3600.0))::int
           ELSE resolution_time_taken_hours
         END,
         is_reopened = CASE WHEN $1::report_status = 'resolved'::report_status THEN FALSE ELSE is_reopened END,
         resolved_at = CASE
           WHEN $1::report_status = 'resolved'::report_status THEN NOW()
           ELSE resolved_at
         END
     WHERE id = $5
     RETURNING ${selectReportProjection}`,
    [
      parsed.data.status,
      parsed.data.proofImageUrl || null,
      parsed.data.resolutionNotes || null,
      officerName,
      req.params.id,
    ]
  );

  if (report.status !== 'resolved' && updated.rows[0]?.status === 'resolved') {
    await sendResolvedWhatsappNotificationWithFeedback(req.params.id);
  }

  return res.json({ report: updated.rows[0] });
});

// Reassign reopened complaint from admin to department
router.post('/:id/reassign', async (req, res) => {
  const parsed = z.object({
    department: z.string().trim().min(1),
    notes: z.string().trim().optional().nullable(),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid reassignment payload.' });
  }

  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  // Only admin/municipal can reassign
  if (currentUser.role !== 'admin' && currentUser.role !== 'municipal') {
    return res.status(403).json({ message: 'Only admin can reassign complaints.' });
  }

  const reportResult = await pool.query<{ id: string; is_reopened: boolean; citizen_feedback: string | null }>(
    `SELECT id, is_reopened, citizen_feedback FROM reports WHERE id = $1 LIMIT 1`,
    [req.params.id]
  );

  if (!reportResult.rowCount || !reportResult.rows[0]?.is_reopened) {
    return res.status(404).json({ message: 'Reopened report not found.' });
  }

  const normalizedDept = normalizeDepartment(parsed.data.department);
  if (!normalizedDept || !validDepartments.has(normalizedDept)) {
    return res.status(400).json({ message: 'Invalid department value.' });
  }

  // Reassign to department with admin notes
  const updated = await pool.query(
    `UPDATE reports
     SET department = $1,
         resolution_notes = CASE WHEN $2::text IS NOT NULL
           THEN COALESCE(resolution_notes, '') || '\\n[ADMIN NOTE] ' || $2
           ELSE resolution_notes
         END,
         updated_at = NOW()
     WHERE id = $3
     RETURNING ${selectReportProjection}`,
    [normalizedDept, parsed.data.notes || null, req.params.id]
  );

  return res.json({ report: updated.rows[0] });
});

// Submit satisfaction feedback on resolved report
router.post('/:id/satisfaction', async (req, res) => {
  const parsed = z.object({
    satisfied: z.boolean(),
    feedback: z.string().trim().optional().default(''),
  }).safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ message: 'Invalid satisfaction payload.' });
  }

  const currentUser = await getCurrentUser(req.auth!.uid);
  if (!currentUser) {
    return res.status(401).json({ message: 'Invalid user session.' });
  }

  if (currentUser.role !== 'citizen') {
    return res.status(403).json({ message: 'Only citizens can submit satisfaction feedback.' });
  }

  const reportResult = await pool.query<{
    id: string;
    citizen_id: string;
    status: string;
    type: string;
    department: string;
  }>(
    `SELECT id, citizen_id, status, type, department FROM reports WHERE id = $1 LIMIT 1`,
    [req.params.id]
  );

  if (!reportResult.rowCount) {
    return res.status(404).json({ message: 'Report not found.' });
  }

  const report = reportResult.rows[0];

  // Verify this is the citizen's report
  if (report.citizen_id !== currentUser.id) {
    return res.status(403).json({ message: 'You can only provide feedback on your own reports.' });
  }

  // Verify report is resolved
  if (report.status !== 'resolved') {
    return res.status(400).json({ message: 'Can only provide feedback on resolved reports.' });
  }

  if (parsed.data.satisfied) {
    // Mark as satisfied
    const updated = await pool.query(
      `UPDATE reports
       SET citizen_feedback = 'SATISFIED',
           updated_at = NOW()
       WHERE id = $1
       RETURNING ${selectReportProjection}`,
      [req.params.id]
    );
    return res.json({ report: updated.rows[0], message: 'Thank you for your feedback!' });
  } else {
    // Reopen the complaint
    if (!parsed.data.feedback || parsed.data.feedback.length < 10) {
      return res.status(400).json({ message: 'Please provide detailed feedback about what remains unresolved (at least 10 characters).' });
    }

    const updated = await pool.query(
      `UPDATE reports
       SET status = 'reported',
           is_reopened = TRUE,
           citizen_feedback = $1,
           department = 'administration',
           updated_at = NOW()
       WHERE id = $2
       RETURNING ${selectReportProjection}`,
      [parsed.data.feedback, req.params.id]
    );

    return res.json({
      report: updated.rows[0],
      message: 'Your complaint has been reopened and escalated to administration for reassessment.',
    });
  }
});

export default router;