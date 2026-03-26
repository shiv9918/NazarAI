
export async function handleReopenedComplaintDetailedFeedback(params: {
  citizenId: string;
  bodyText: string;
}): Promise<{ handled: boolean; message?: string }> {
  // Look for the most recent complaint where citizen already said "unsatisfied"
  // and we are waiting for detailed explanation.
  const reopenedResult = await pool.query<{
    id: string;
    complaint_code: string;
    routed_department: string;
  }>(
    `SELECT 
      r.id,
      'CMP-' || TO_CHAR(r.reported_at, 'YYYY') || '-' || 
      LPAD(COALESCE(r.complaint_number, 0)::text, 6, '0') AS complaint_code,
      COALESCE(r.original_department, r.department, 'administration') AS routed_department
     FROM reports r
     JOIN whatsapp_feedback_requests w ON w.report_id = r.id
     WHERE r.citizen_id = $1
       AND w.status = 'unsatisfied'
       AND r.citizen_feedback LIKE '%विस्तृत प्रतिक्रिया की प्रतीक्षा में%'
       AND r.updated_at > NOW() - INTERVAL '4 hours'
     ORDER BY r.updated_at DESC
     LIMIT 1`,
    [params.citizenId]
  );

  const reopened = reopenedResult.rows[0];
  if (!reopened) {
    return { handled: false };
  }

  // If text is meaningful (more than 5 chars), store as feedback
  const textLength = params.bodyText.trim().length;
  if (textLength < 5) {
    return { handled: false };
  }

  // Now reopen and route back to the responsible/original department.
  await pool.query(
    `UPDATE reports
     SET status = 'reported',
         is_reopened = TRUE,
         original_department = COALESCE(original_department, $2),
         department = COALESCE(original_department, $2),
         reopen_votes = COALESCE(reopen_votes, 0) + 1,
         citizen_rating = 'unsatisfied',
         citizen_feedback = $3,
         updated_at = NOW()
     WHERE id = $1`,
    [reopened.id, reopened.routed_department, `विस्तृत प्रतिक्रिया: ${params.bodyText.trim()}`]
  );

  return {
    handled: true,
    message: `✅ *आपकी प्रतिक्रिया दर्ज हो गई*\n\n📝 आपकी जानकारी:\n"${params.bodyText.trim()}"\n\n${getReopenRoutedMessage(reopened.complaint_code, reopened.routed_department)}\n\nधन्यवाद! 🙏`,
  };
}
import { pool } from '../config/db';
import { sendTwilioWhatsAppMessage } from './twilioWhatsapp';

type ResolutionWhatsappRow = {
  id: string;
  complaint_code: string;
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
  complaint_code: string;
  citizen_id: string;
  to_phone: string;
  status: 'pending' | 'satisfied' | 'unsatisfied';
  reminder_sent: boolean;
  due_at: Date;
  resolution_notes: string | null;
};

function departmentToLabel(department: string) {
  const map: Record<string, string> = {
    roads: 'Roads Department',
    sanitation: 'Sanitation Department',
    electrical: 'Electrical Department',
    water: 'Water Department',
    administration: 'Administration Department',
  };

  return map[department] || `${department} Department`;
}

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
    '🔍 *क्या आपकी शिकायत सही से ठीक हो गई?*',
    `शिकायत ID: #${reportId}`,
    '',
    'कृपया जवाब दें:',
    '✅ हाँ — समस्या ठीक हो गई',
    '❌ नहीं — समस्या अभी बाकी है',
  ].join('\n');
}

function reminderPrompt(reportId: string) {
  return [
    '⏰ *समीक्षा के लिए अनुस्मारक*',
    '',
    `आपकी शिकायत #${reportId}`,
    'को समाधान के रूप में चिह्नित किया गया था।',
    '',
    'क्या समस्या पूरी तरह ठीक हो गई?',
    '',
    '✅ हाँ — समस्या ठीक हो गई',
    '❌ नहीं — समस्या अभी बाकी है',
  ].join('\n');
}

function askForReopenDetails(reportId: string) {
  return [
    '❌ *समस्या अभी बाकी है?*',
    `शिकायत ID: #${reportId}`,
    '',
    'कृपया बताएं कि क्या समस्या अभी भी है:',
    '',
    '📝 उदाहरण:',
    '"गड्ढा अभी भी मौजूद है"',
    '"स्ट्रीट लाइट अभी भी बंद है"',
    '"पानी का रिसाव अभी जारी है"',
    '',
    'आपकी सटीक समस्या लिखें:',
  ].join('\n');
}

function getReopenConfirmationMessage(reportId: string, hindiIssue: string) {
  return [
    '🔄 *आपकी शिकायत फिर से खोली गई है*',
    ``,
    `शिकायत ID: #${reportId}`,
    `समस्या: ${hindiIssue}`,
    '',
    'आपकी प्रतिक्रिया के अनुसार यह समस्या पूरी तरह ठीक नहीं हुई है।',
    '',
    '👷 प्रशासन द्वारा इसका पुनः मूल्यांकन किया जाएगा।',
    '',
    'हम जल्द ही आपको अपडेट देंगे। धन्यवाद! 🙏',
  ].join('\n');
}

function getReopenRoutedMessage(reportId: string, department: string) {
  return [
    '🔄 *आपकी शिकायत फिर से खोली गई है*',
    `शिकायत ID: #${reportId}`,
    '',
    `✅ यह शिकायत ${departmentToLabel(department)} को दोबारा भेज दी गई है।`,
    '👷 संबंधित विभाग इसे पुनः जांचेगा।',
  ].join('\n');
}

export async function sendResolvedWhatsappNotificationWithFeedback(reportId: string) {
  const result = await pool.query<ResolutionWhatsappRow>(
    `SELECT
      r.id,
      (
        'CMP-'
        || TO_CHAR(COALESCE(r.reported_at, NOW()), 'YYYY')
        || '-'
        || LPAD(COALESCE(r.complaint_number, 0)::text, 6, '0')
      ) AS complaint_code,
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
    '✅ *Aapki Sikayat Samadhan Kar Di Gyi Hai*',
    `📋 ID: #${report.complaint_code}`,
    `🔧 Samadhan: ${hindiIssue}`,
    `📍 Jagah: ${report.location}`,
    `👷 Officer: ${officerName}`,
    `⏱️  Samay Laga: ${timeTaken}`,
    report.resolution_notes ? `📝 Vivaran: ${report.resolution_notes}` : null,
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
    message: ratingPrompt(report.complaint_code),
  });

  await upsertPendingFeedback({
    reportId: report.id,
    citizenId: report.citizen_id,
    toPhone: to,
  });
}

function parseFeedbackChoice(message: string): 'satisfied' | 'unsatisfied' | null {
  const text = message.toLowerCase();

  const yesPatterns = ['haan', 'ha', 'yes', 'satisfied', 'हाँ', 'है', '👍'];
  const noPatterns = ['nahi', 'nahin', 'no', 'unsatisfied', 'not resolved', 'नहीं', '👎'];

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
      (
        'CMP-'
        || TO_CHAR(COALESCE(r.reported_at, NOW()), 'YYYY')
        || '-'
        || LPAD(COALESCE(r.complaint_number, 0)::text, 6, '0')
      ) AS complaint_code,
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
      [row.report_id, 'समस्या पूरी तरह ठीक हो गई।']
    );

    await pool.query(
      `UPDATE whatsapp_feedback_requests
       SET status = 'satisfied', responded_at = NOW(), updated_at = NOW()
       WHERE report_id = $1`,
      [row.report_id]
    );

    return {
      handled: true as const,
      message: `🎉 *धन्यवाद!*\n\nआपकी शिकायत #${row.complaint_code} को समाधान के रूप में चिह्नित कर दिया गया है।\n\nनज़र एआई के साथ जुड़े रहें! 🙏`,
    };
  }

  // Mark intent as unsatisfied and wait for detailed feedback.
  // Reopen happens only after citizen sends detailed text.
  await pool.query(
    `UPDATE reports
     SET citizen_rating = 'unsatisfied',
         citizen_feedback = $2,
         updated_at = NOW()
     WHERE id = $1`,
    [row.report_id, `नागरिक प्रतिक्रिया - नहीं: शिकायत पुनः खुली (विस्तृत प्रतिक्रिया की प्रतीक्षा में)`]
  );

  await pool.query(
    `UPDATE whatsapp_feedback_requests
     SET status = 'unsatisfied', responded_at = NOW(), updated_at = NOW()
     WHERE report_id = $1`,
    [row.report_id]
  );

  return {
    handled: true as const,
    message: askForReopenDetails(row.complaint_code),
  };
}

export async function sendPendingFeedbackReminders() {
  const dueRows = await pool.query<PendingFeedbackRow>(
    `SELECT
      w.report_id,
      (
        'CMP-'
        || TO_CHAR(COALESCE(r.reported_at, NOW()), 'YYYY')
        || '-'
        || LPAD(COALESCE(r.complaint_number, 0)::text, 6, '0')
      ) AS complaint_code,
      w.citizen_id,
      w.to_phone,
      w.status,
      w.reminder_sent,
      w.due_at,
      NULL::text as resolution_notes
     FROM whatsapp_feedback_requests
     w
     JOIN reports r ON r.id = w.report_id
     WHERE w.status = 'pending'
       AND w.reminder_sent = FALSE
       AND w.due_at <= NOW()
     ORDER BY w.due_at ASC
     LIMIT 200`
  );

  for (const row of dueRows.rows) {
    await sendTwilioWhatsAppMessage({
      to: row.to_phone,
      message: reminderPrompt(row.complaint_code),
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
