import { pool } from '../config/db';
import { sendTwilioWhatsAppMessage } from './twilioWhatsapp';

type ResolutionWhatsappRow = {
  id: string;
  type: string;
  location: string;
  department: string;
  image_url: string | null;
  proof_image_url: string | null;
  resolution_notes: string | null;
  resolved_by_officer: string | null;
  reported_at: Date;
  resolved_at: Date | null;
  citizen_id: string;
  citizen_phone: string | null;
};

type PendingFeedbackRow = {
  report_id: string;
  citizen_id: string;
  to_phone: string;
  status: 'pending' | 'satisfied' | 'unsatisfied';
  reminder_sent: boolean;
  due_at: Date;
  resolution_notes: string | null;
};

function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, '').trim();
}

function ensureWhatsappTo(phone: string) {
  if (phone.startsWith('whatsapp:')) {
    return phone;
  }

  const normalized = normalizePhone(phone);
  const withPlus = normalized.startsWith('+') ? normalized : `+${normalized}`;
  return `whatsapp:${withPlus}`;
}

function issueTypeToHindi(issueType: string) {
  const map: Record<string, string> = {
    garbage: 'कचरा',
    illegal_dump: 'गैरकानूनी कचरा डंप',
    pothole: 'सड़क का गड्ढा',
    broken_streetlight: 'खराब स्ट्रीट लाइट',
    water_leakage: 'पानी का रिसाव',
    unknown: 'अनिर्धारित समस्या',
  };

  return map[issueType] || issueType.replace(/_/g, ' ');
}

function formatDuration(from: Date, to: Date) {
  const totalHours = Math.max(0, Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60)));
  const days = Math.floor(totalHours / 24);
  const hours = totalHours % 24;

  if (days > 0) {
    return `${days} day${days === 1 ? '' : 's'} ${hours} hour${hours === 1 ? '' : 's'}`;
  }

  return `${hours} hour${hours === 1 ? '' : 's'}`;
}

function complaintDisplayId(reportId: string) {
  const short = reportId.replace(/-/g, '').slice(-8).toUpperCase();
  const year = new Date().getFullYear();
  return `NAZ-${year}-${short}`;
}

async function upsertPendingFeedback(params: { reportId: string; citizenId: string; toPhone: string }) {
  await pool.query(
    `INSERT INTO whatsapp_feedback_requests (
      report_id,
      citizen_id,
      to_phone,
      status,
      reminder_sent,
      due_at,
      created_at,
      updated_at,
      responded_at
    )
    VALUES ($1, $2, $3, 'pending', FALSE, NOW() + INTERVAL '24 hours', NOW(), NOW(), NULL)
    ON CONFLICT (report_id)
    DO UPDATE SET
      citizen_id = EXCLUDED.citizen_id,
      to_phone = EXCLUDED.to_phone,
      status = 'pending',
      reminder_sent = FALSE,
      due_at = NOW() + INTERVAL '24 hours',
      updated_at = NOW(),
      responded_at = NULL`,
    [params.reportId, params.citizenId, params.toPhone]
  );
}

function ratingPrompt(reportId: string) {
  return [
    'Kya aap problem resolution se satisfied hain?',
    `Complaint: #${reportId}`,
    'Reply karein:',
    '👍 HAAN - satisfied',
    '👎 NAHI - not resolved',
  ].join('\n');
}

function reminderPrompt(reportId: string) {
  return [
    '📊 *Feedback yaad hai?*',
    '',
    `Aapki shikayat #${reportId}`,
    'resolve mark ki gayi hai.',
    '',
    'Kya sahi se theek hua?',
    '👍 HAAN — satisfied',
    '👎 NAHI — not resolved',
  ].join('\n');
}

export async function sendResolvedWhatsappNotificationWithFeedback(reportId: string) {
  const result = await pool.query<ResolutionWhatsappRow>(
    `SELECT
      r.id,
      r.type,
      r.location,
      r.department,
      r.image_url,
      r.proof_image_url,
      r.resolution_notes,
      r.resolved_by_officer,
      r.reported_at,
      r.resolved_at,
      r.citizen_id,
      u.phone AS citizen_phone
     FROM reports r
     JOIN users u ON u.id = r.citizen_id
     WHERE r.id = $1
     LIMIT 1`,
    [reportId]
  );

  const report = result.rows[0];
  if (!report || !report.citizen_phone) {
    return;
  }

  const to = ensureWhatsappTo(report.citizen_phone);
  const resolvedAt = report.resolved_at || new Date();
  const timeTaken = formatDuration(report.reported_at, resolvedAt);
  const officerName = report.resolved_by_officer || 'Field Officer';
  const hindiIssue = issueTypeToHindi(report.type);

  const details = [
    'Shikayat update:',
    `📋 *ID:* #${complaintDisplayId(report.id)}`,
    `🔍 *Issue:* ${hindiIssue}`,
    `📍 *Location:* ${report.location}`,
    `👷 *Officer:* ${officerName}`,
    `⏱️ *Time taken:* ${timeTaken}`,
    report.resolution_notes ? `📝 *Resolution notes:* ${report.resolution_notes}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const mediaUrls: string[] = [];
  if (report.image_url && /^https?:\/\//i.test(report.image_url)) {
    mediaUrls.push(report.image_url);
  }
  if (report.proof_image_url && /^https?:\/\//i.test(report.proof_image_url)) {
    mediaUrls.push(report.proof_image_url);
  }

  await sendTwilioWhatsAppMessage({
    to,
    message: details,
    mediaUrls,
  });

  await sendTwilioWhatsAppMessage({
    to,
    message: ratingPrompt(complaintDisplayId(report.id)),
  });

  await upsertPendingFeedback({
    reportId: report.id,
    citizenId: report.citizen_id,
    toPhone: to,
  });
}

function parseFeedbackChoice(message: string): 'satisfied' | 'unsatisfied' | null {
  const text = message.toLowerCase();

  const yesPatterns = ['haan', 'ha', 'yes', 'satisfied', '👍'];
  const noPatterns = ['nahi', 'nahin', 'no', 'unsatisfied', 'not resolved', '👎'];

  if (yesPatterns.some((token) => text.includes(token))) {
    return 'satisfied';
  }

  if (noPatterns.some((token) => text.includes(token))) {
    return 'unsatisfied';
  }

  return null;
}

export async function handleIncomingResolutionFeedback(params: {
  citizenId: string;
  fromPhone: string;
  bodyText: string;
}) {
  const pending = await pool.query<PendingFeedbackRow>(
    `SELECT
      w.report_id,
      w.citizen_id,
      w.to_phone,
      w.status,
      w.reminder_sent,
      w.due_at,
      r.resolution_notes
     FROM whatsapp_feedback_requests w
     JOIN reports r ON r.id = w.report_id
     WHERE w.citizen_id = $1
       AND w.status = 'pending'
     ORDER BY w.created_at DESC
     LIMIT 1`,
    [params.citizenId]
  );

  const row = pending.rows[0];
  if (!row) {
    return { handled: false as const };
  }

  const feedback = parseFeedbackChoice(params.bodyText);
  if (!feedback) {
    return { handled: false as const };
  }

  if (feedback === 'satisfied') {
    await pool.query(
      `UPDATE reports
       SET citizen_rating = 'satisfied',
           citizen_feedback = $2,
           updated_at = NOW()
       WHERE id = $1`,
      [row.report_id, params.bodyText.trim() || null]
    );

    await pool.query(
      `UPDATE whatsapp_feedback_requests
       SET status = 'satisfied', responded_at = NOW(), updated_at = NOW()
       WHERE report_id = $1`,
      [row.report_id]
    );

    return {
      handled: true as const,
      message: `Dhanyavaad! Complaint #${complaintDisplayId(row.report_id)} ko closed maana gaya hai.`,
    };
  }

  await pool.query(
    `UPDATE reports
     SET status = 'in_progress',
         is_reopened = TRUE,
         reopen_votes = COALESCE(reopen_votes, 0) + 1,
         citizen_rating = 'unsatisfied',
         citizen_feedback = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [row.report_id, params.bodyText.trim() || null]
  );

  await pool.query(
    `UPDATE whatsapp_feedback_requests
     SET status = 'unsatisfied', responded_at = NOW(), updated_at = NOW()
     WHERE report_id = $1`,
    [row.report_id]
  );

  return {
    handled: true as const,
    message: `Complaint #${complaintDisplayId(row.report_id)} reopen kar diya gaya hai. Team isko dobara process karegi.`,
  };
}

export async function sendPendingFeedbackReminders() {
  const dueRows = await pool.query<PendingFeedbackRow>(
    `SELECT report_id, citizen_id, to_phone, status, reminder_sent, due_at, NULL::text as resolution_notes
     FROM whatsapp_feedback_requests
     WHERE status = 'pending'
       AND reminder_sent = FALSE
       AND due_at <= NOW()
     ORDER BY due_at ASC
     LIMIT 200`
  );

  for (const row of dueRows.rows) {
    await sendTwilioWhatsAppMessage({
      to: row.to_phone,
      message: reminderPrompt(complaintDisplayId(row.report_id)),
    });

    await pool.query(
      `UPDATE whatsapp_feedback_requests
       SET reminder_sent = TRUE,
           updated_at = NOW()
       WHERE report_id = $1`,
      [row.report_id]
    );
  }
}
