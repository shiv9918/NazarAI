// This file is the WhatsApp "chatbot" flow: it receives incoming WhatsApp messages
// from Twilio, walks a citizen through reporting an issue (photo -> location ->
// create report), and answers status checks and feedback replies.
import { Router } from 'express';
import { createHash } from 'node:crypto';
import { pool } from '../config/db';
import { env } from '../config/env';
import { assignDepartment } from '../utils/reportAssignment';
import { detectIssueFromImage } from '../services/geminiVision';
import { sendTwilioWhatsAppMessage, sendTwilioWhatsAppMessageDetailed } from '../services/twilioWhatsapp';
import { handleIncomingResolutionFeedback, handleReopenedComplaintDetailedFeedback } from '../services/whatsappResolutionFlow';
import { reverseGeocodeCoordinates } from '../services/geocodingService';

// Shape of a citizen user row read from the database.
type DbCitizen = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'citizen' | 'municipal' | 'department' | 'admin';
  phone: string | null;
};

// Shape of the in-progress "conversation state" for a citizen (what step they're on
// while building a report through WhatsApp).
type DbWhatsappSession = {
  citizen_id: string;
  from_phone: string;
  pending_body: string | null;
  pending_address: string | null;
  pending_lat: number | null;
  pending_lng: number | null;
  pending_media_url: string | null;
  flow_state: 'waiting_for_image' | 'waiting_for_location' | 'ready_to_process' | null;
};

// Shape of a report's info used when replying to a "check status" request.
type DbWhatsappStatusReport = {
  id: string;
  complaint_code: string;
  type: string;
  status: 'reported' | 'in_progress' | 'resolved';
  severity: number;
  department: string;
  location: string;
  description: string | null;
  reported_at: Date;
  resolved_at: Date | null;
  resolution_notes: string | null;
  resolved_by_officer: string | null;
  is_reopened: boolean;
  reopen_votes: number;
};

// Wrap a plain reply as the XML (TwiML) format Twilio expects for WhatsApp replies.
function xmlMessage(text: string) {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

// Send an immediate WhatsApp reply back through the webhook response itself.
async function respondWhatsAppMessage(res: any, _to: string, message: string) {
  // Respond with TwiML directly so inbound WhatsApp messages always get an immediate reply.
  res.type('text/xml');
  return res.status(200).send(xmlMessage(message));
}

// Strip everything from a phone number except digits and the leading "+".
function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, '').trim();
}

// Make a fingerprint (hash) of an uploaded image so we can detect duplicate photos.
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

// Remove the "whatsapp:" prefix Twilio adds to phone numbers.
function stripWhatsappPrefix(value: string) {
  return value.startsWith('whatsapp:') ? value.slice('whatsapp:'.length) : value;
}

// Turn Twilio's incoming "From" number into standard "+countrycode..." format.
function toE164FromIncoming(fromRaw: string) {
  const normalized = normalizePhone(stripWhatsappPrefix(fromRaw));
  if (!normalized) {
    return null;
  }

  if (normalized.startsWith('+')) {
    return normalized;
  }

  return `+${normalized}`;
}

// Keep the citizen's saved phone number in sync with whatever number they're
// actually messaging from on WhatsApp.
async function syncCitizenPhoneWithIncoming(citizenId: string, fromRaw: string, existingPhone?: string | null) {
  const incomingE164 = toE164FromIncoming(fromRaw);
  if (!incomingE164) {
    return;
  }

  const existingNormalized = existingPhone ? normalizePhone(existingPhone) : null;
  if (existingNormalized === incomingE164) {
    return;
  }

  await pool.query(
    `UPDATE users
     SET phone = $1, updated_at = NOW()
     WHERE id = $2`,
    [incomingE164, citizenId]
  );
}

// Try to find latitude/longitude numbers inside a text message (plain "lat,lng"
// or pasted Google Maps links).
function parseCoordinatesFromBody(bodyText: string) {
  const patterns = [
    /(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/, // plain: 28.61,77.20
    /[?&]q=(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i, // maps url q=
    /@(-?\d{1,2}\.\d+),(-?\d{1,3}\.\d+)/i, // maps url @lat,lng
  ];

  let match: RegExpMatchArray | null = null;
  for (const pattern of patterns) {
    match = bodyText.match(pattern);
    if (match) break;
  }

  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  return { lat, lng };
}

// Pull an address out of the citizen's message text, if they labeled it (e.g. "Address: ...").
function extractAddressText(bodyText: string, fallbackAddress?: string | null) {
  const fromLabel = bodyText.match(/(?:address|location|loc)\s*[:\-]\s*(.+)$/i);
  if (fromLabel?.[1]?.trim()) {
    return fromLabel[1].trim();
  }

  if (fallbackAddress && fallbackAddress.trim()) {
    return fallbackAddress.trim();
  }

  if (bodyText.trim()) {
    return bodyText.trim();
  }

  return null;
}

// Check if the message is a "status <complaint id>" command, and pull out the ID if so.
function extractStatusLookupId(bodyText: string) {
  const trimmed = bodyText.trim();
  if (!trimmed) {
    return null;
  }

  const match = trimmed.match(/^(?:status|track|स्थिति|स्टेटस)\s+(.+)$/i);
  if (!match?.[1]) {
    return null;
  }

  return match[1].trim().toUpperCase();
}

// Reply in Hindi if the citizen used the Hindi status command word.
function detectStatusCommandLanguage(bodyText: string): 'en' | 'hi' {
  const trimmed = bodyText.trim();
  if (/^(?:स्थिति|स्टेटस)\s+/i.test(trimmed)) {
    return 'hi';
  }

  return 'en';
}

// Friendly display text for a report status.
function getStatusLabel(status: 'reported' | 'in_progress' | 'resolved') {
  if (status === 'in_progress') {
    return 'IN PROGRESS';
  }

  return status.toUpperCase();
}

// Format a date for showing in a WhatsApp message, or "N/A" if there isn't one.
function toDisplayDate(value: Date | null) {
  if (!value) {
    return 'N/A';
  }

  return new Date(value).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

// Build the English "here's your complaint status" WhatsApp message.
function buildWhatsappStatusMessage(report: DbWhatsappStatusReport) {
  const lines = [
    `Complaint ID: ${report.complaint_code}`,
    `Status: ${getStatusLabel(report.status)}`,
    `Issue Type: ${report.type}`,
    `Severity: ${report.severity}/10`,
    `Department: ${report.department}`,
    `Location: ${report.location}`,
    `Reported On: ${toDisplayDate(report.reported_at)}`,
    `Resolved On: ${toDisplayDate(report.resolved_at)}`,
    `Reopened: ${report.is_reopened ? 'Yes' : 'No'} (Votes: ${report.reopen_votes})`,
  ];

  if (report.resolved_by_officer) {
    lines.push(`Resolved By: ${report.resolved_by_officer}`);
  }

  if (report.resolution_notes) {
    lines.push(`Resolution Notes: ${report.resolution_notes}`);
  }

  if (report.description) {
    lines.push(`Your Description: ${report.description}`);
  }

  return lines.join('\n');
}

// Same status message as above, but in Hindi.
function buildWhatsappStatusMessageHindi(report: DbWhatsappStatusReport) {
  const statusHindi = report.status === 'reported'
    ? 'दर्ज'
    : report.status === 'in_progress'
      ? 'कार्य प्रगति पर'
      : 'समाधान हो गया';

  const lines = [
    `शिकायत आईडी: ${report.complaint_code}`,
    `स्थिति: ${statusHindi}`,
    `समस्या प्रकार: ${report.type}`,
    `गंभीरता: ${report.severity}/10`,
    `विभाग: ${report.department}`,
    `स्थान: ${report.location}`,
    `दर्ज समय: ${toDisplayDate(report.reported_at)}`,
    `समाधान समय: ${toDisplayDate(report.resolved_at)}`,
    `दोबारा खोला गया: ${report.is_reopened ? 'हाँ' : 'नहीं'} (वोट: ${report.reopen_votes})`,
  ];

  if (report.resolved_by_officer) {
    lines.push(`समाधान अधिकारी: ${report.resolved_by_officer}`);
  }

  if (report.resolution_notes) {
    lines.push(`समाधान विवरण: ${report.resolution_notes}`);
  }

  if (report.description) {
    lines.push(`आपका विवरण: ${report.description}`);
  }

  return lines.join('\n');
}

// Find the citizen's report that matches a "status" lookup, by complaint code,
// database ID, or complaint number.
async function resolveReportForWhatsappStatus(citizenId: string, requestedId: string) {
  const complaintCodePattern = /^[A-Za-z]{3}-\d{4}-\d{4,6}$/;
  const uuidPattern = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

  let whereClause = '';
  let params: Array<string | number> = [citizenId];

  if (complaintCodePattern.test(requestedId)) {
    whereClause = `
      citizen_id = $1
      AND (
        'CMP-'
        || TO_CHAR(COALESCE(reported_at, NOW()), 'YYYY')
        || '-'
        || LPAD(COALESCE(complaint_number, 0)::text, 6, '0')
      ) = $2
    `;
    params.push(requestedId);
  } else if (uuidPattern.test(requestedId)) {
    whereClause = 'citizen_id = $1 AND id = $2';
    params.push(requestedId);
  } else if (/^\d+$/.test(requestedId)) {
    whereClause = 'citizen_id = $1 AND complaint_number = $2';
    params.push(Number(requestedId));
  } else {
    return null;
  }

  const result = await pool.query<DbWhatsappStatusReport>(
    `SELECT
      id,
      (
        'CMP-'
        || TO_CHAR(COALESCE(reported_at, NOW()), 'YYYY')
        || '-'
        || LPAD(COALESCE(complaint_number, 0)::text, 6, '0')
      ) AS complaint_code,
      type,
      status,
      severity,
      department,
      location,
      description,
      reported_at,
      resolved_at,
      resolution_notes,
      resolved_by_officer,
      is_reopened,
      reopen_votes
     FROM reports
     WHERE ${whereClause}
     ORDER BY reported_at DESC
     LIMIT 1`,
    params
  );

  return result.rows[0] || null;
}

// Build the "Authorization" header needed to download media files from Twilio.
function getTwilioAuthHeader() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    return null;
  }

  const credentials = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  return `Basic ${credentials}`;
}

// Find the citizen account matching the WhatsApp sender's phone number
// (tries an exact match first, then just the last 10 digits as a fallback).
async function resolveCitizenByPhone(fromRaw: string) {
  const incoming = normalizePhone(stripWhatsappPrefix(fromRaw));
  const incomingDigits = incoming.replace(/\D/g, '');
  const incomingLast10 = incomingDigits.slice(-10);

  const result = await pool.query<DbCitizen>(
    `SELECT id, first_name, last_name, email, role, phone
     FROM users
     WHERE role = 'citizen'
       AND (
         regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1
         OR RIGHT(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 10) = $2
       )
     ORDER BY
       CASE
         WHEN regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = $1 THEN 0
         ELSE 1
       END
     LIMIT 1`,
    [incomingDigits, incomingLast10]
  );

  return result.rows[0] || null;
}

// Download a photo the citizen sent on WhatsApp (from Twilio's media URL) and turn it
// into a data URL we can store and send to the AI for analysis.
async function fetchTwilioMediaAsDataUrl(mediaUrl: string): Promise<{ dataUrl: string; mimeType: string } | null> {
  const authHeader = getTwilioAuthHeader();
  if (!authHeader) {
    return null;
  }

  const trimmedUrl = mediaUrl.trim();
  const attemptUrls = [trimmedUrl];
  if (trimmedUrl.endsWith('.json')) {
    attemptUrls.push(trimmedUrl.replace(/\.json$/i, ''));
  }

  let response: Response | null = null;
  let resolvedFromUrl = trimmedUrl;

  for (const candidateUrl of attemptUrls) {
    const candidateResponse = await fetch(candidateUrl, {
      headers: {
        Authorization: authHeader,
      },
    });

    if (candidateResponse.ok) {
      response = candidateResponse;
      resolvedFromUrl = candidateUrl;
      break;
    }

    const errorBody = await candidateResponse.text().catch(() => '');
    console.warn('[WhatsApp] Twilio media download attempt failed', {
      status: candidateResponse.status,
      statusText: candidateResponse.statusText,
      urlPreview: candidateUrl.slice(0, 160),
      accountSidInUse: env.twilioAccountSid,
      errorBody: errorBody.slice(0, 500),
    });
  }

  if (!response) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentTypeHeader = response.headers.get('content-type') || 'image/jpeg';
  const normalizedMime = contentTypeHeader.split(';')[0].trim().toLowerCase();
  const mimeType = normalizedMime === 'image/jpg' ? 'image/jpeg' : normalizedMime;
  const safeMimeType = mimeType.startsWith('image/') ? mimeType : 'image/jpeg';
  const base64 = Buffer.from(arrayBuffer).toString('base64');

  console.log('[WhatsApp] Twilio media downloaded', {
    fromUrlPreview: resolvedFromUrl.slice(0, 160),
    contentTypeHeader,
    safeMimeType,
    bytes: arrayBuffer.byteLength,
  });

  return {
    dataUrl: `data:${safeMimeType};base64,${base64}`,
    mimeType: safeMimeType,
  };
}

// Check a string is a valid "data:image/..." URL and pull out its MIME type.
function parseImageDataUrl(input: string): { dataUrl: string; mimeType: string } | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith('data:image/')) {
    return null;
  }

  const commaIndex = trimmed.indexOf(',');
  if (commaIndex < 0) {
    return null;
  }

  const metadata = trimmed.slice(5, commaIndex); // image/png;base64
  const mimeType = metadata.split(';')[0]?.toLowerCase();
  if (!mimeType || !mimeType.startsWith('image/')) {
    return null;
  }

  return {
    dataUrl: trimmed,
    mimeType,
  };
}

// Everything needed to actually create the report once all steps are collected.
type ProcessingPayload = {
  from: string;
  bodyText: string;
  mediaUrl: string;
  lat: number;
  lng: number;
  address: string;
  citizen: DbCitizen;
};

// Issue types that are allowed to come in through the WhatsApp flow.
const WHATSAPP_ALLOWED_ISSUE_TYPES = new Set([
  'pothole',
  'garbage_overflow',
  'broken_streetlight',
  'water_leakage',
  'illegal_dumping',
  'fallen_tree',
  'hanging_wire',
  'park_broken_equipment',
  'public_bench_broken',
]);

// Maps other spellings of an issue type to the standard WhatsApp issue type.
const WHATSAPP_ISSUE_TYPE_ALIASES: Record<string, string> = {
  garbage: 'garbage_overflow',
  garbage_overflow: 'garbage_overflow',
  illegal_dump: 'illegal_dumping',
  illegal_dumping: 'illegal_dumping',
  pothole: 'pothole',
  broken_streetlight: 'broken_streetlight',
  water_leakage: 'water_leakage',
  tree: 'fallen_tree',
  tree_gira: 'fallen_tree',
  fallen_tree: 'fallen_tree',
  hanging_wire: 'hanging_wire',
  park_broken_equipment: 'park_broken_equipment',
  public_bench_broken: 'public_bench_broken',
};

// Which department should get each WhatsApp-reported issue type.
const WHATSAPP_ISSUE_TO_DEPARTMENT: Record<string, string> = {
  pothole: 'pwd',
  garbage_overflow: 'sanitation',
  broken_streetlight: 'bses',
  water_leakage: 'djb',
  illegal_dumping: 'sanitation',
  fallen_tree: 'forest_dept',
  hanging_wire: 'bses',
  // Kept under administration until dedicated department mapping is introduced.
  park_broken_equipment: 'administration',
  public_bench_broken: 'administration',
};

// Guess the issue type from the citizen's own message text (English/Hindi keywords).
function inferWhatsappIssueTypeFromText(text: string) {
  const t = text.toLowerCase();

  if (/(water|leak|leakage|pipe|pipeline|sewage|drain|pani|nal)/i.test(t)) return 'water_leakage';
  if (/(pothole|potholes|gaddha|road\s*crack|road\s*damage|sadak)/i.test(t)) return 'pothole';
  if (/(street\s*light|streetlight|light\s*out|not\s*working\s*light|bijli)/i.test(t)) return 'broken_streetlight';
  if (/(garbage|trash|waste|kachra|litter|dustbin)/i.test(t)) return 'garbage_overflow';
  if (/(illegal\s*dump|dumping|debris|construction\s*waste|malba)/i.test(t)) return 'illegal_dumping';
  if (/(fallen\s*tree|tree\s*fallen|ped\s*gira|tree\s*down)/i.test(t)) return 'fallen_tree';
  if (/(hanging\s*wire|loose\s*wire|wire\s*down|bijli\s*taar)/i.test(t)) return 'hanging_wire';

  return null;
}

// Clean up a raw issue type into one of the allowed WhatsApp issue types, or null if invalid.
function normalizeWhatsappIssueType(rawType: string | null | undefined) {
  if (!rawType) {
    return null;
  }

  const normalized = rawType.toLowerCase().trim().replace(/\s+/g, '_');
  const canonical = WHATSAPP_ISSUE_TYPE_ALIASES[normalized] || normalized;
  if (!WHATSAPP_ALLOWED_ISSUE_TYPES.has(canonical)) {
    return null;
  }

  return canonical;
}

// Get the department for an issue type, falling back to the general assignment logic.
function getWhatsappDepartmentFromIssueType(issueType: string) {
  return WHATSAPP_ISSUE_TO_DEPARTMENT[issueType] || assignDepartment(issueType, null);
}

// Load the citizen's in-progress WhatsApp report session, if one exists.
async function getWhatsappSession(citizenId: string, fromPhone: string) {
  const result = await pool.query<DbWhatsappSession>(
    `SELECT citizen_id, from_phone, pending_body, pending_address, pending_lat, pending_lng, pending_media_url, flow_state
     FROM whatsapp_sessions
     WHERE citizen_id = $1 AND from_phone = $2
     LIMIT 1`,
    [citizenId, fromPhone]
  );

  return result.rows[0] || null;
}

// Save (create or update) the citizen's in-progress WhatsApp report session.
async function upsertWhatsappSession(params: {
  citizenId: string;
  fromPhone: string;
  pendingBody: string | null;
  pendingAddress: string | null;
  pendingLat: number | null;
  pendingLng: number | null;
  pendingMediaUrl: string | null;
  flowState: 'waiting_for_image' | 'waiting_for_location' | 'ready_to_process' | null;
}) {
  await pool.query(
    `INSERT INTO whatsapp_sessions (
      citizen_id,
      from_phone,
      pending_body,
      pending_address,
      pending_lat,
      pending_lng,
      pending_media_url,
      flow_state,
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    ON CONFLICT (citizen_id, from_phone)
    DO UPDATE SET
      pending_body = EXCLUDED.pending_body,
      pending_address = EXCLUDED.pending_address,
      pending_lat = EXCLUDED.pending_lat,
      pending_lng = EXCLUDED.pending_lng,
      pending_media_url = EXCLUDED.pending_media_url,
      flow_state = EXCLUDED.flow_state,
      updated_at = NOW()`,
    [
      params.citizenId,
      params.fromPhone,
      params.pendingBody,
      params.pendingAddress,
      params.pendingLat,
      params.pendingLng,
      params.pendingMediaUrl,
      params.flowState,
    ]
  );
}

// Delete the citizen's in-progress session (used once a report is created or cancelled).
async function clearWhatsappSession(citizenId: string, fromPhone: string) {
  await pool.query(
    `DELETE FROM whatsapp_sessions
     WHERE citizen_id = $1 AND from_phone = $2`,
    [citizenId, fromPhone]
  );
}

// Build a message telling the citizen what's still missing (photo and/or location).
function buildMissingRequirementMessage(hasMedia: boolean, hasAddress: boolean, hasCoordinates: boolean) {
  const missing: string[] = [];
  if (!hasMedia) {
    missing.push('issue photo');
  }
  if (!hasAddress) {
    missing.push('address text');
  }
  if (!hasCoordinates) {
    missing.push('latitude,longitude coordinates');
  }

  return `Thanks! I still need: ${missing.join(', ')}. Please send remaining details. Example: Address: Connaught Place, Delhi Location: 28.6315,77.2167`;
}

// Once we have a photo + location from the citizen, this actually creates the report:
// downloads the photo, runs AI detection on it, checks for duplicates, then saves it
// and confirms back to the citizen over WhatsApp.
async function processIncomingWhatsappReport(payload: ProcessingPayload) {
  // Get the photo, either already inline or by downloading it from Twilio.
  const inlineImage = parseImageDataUrl(payload.mediaUrl);
  const image = inlineImage || await fetchTwilioMediaAsDataUrl(payload.mediaUrl);

  if (!image) {
    await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
    await sendTwilioWhatsAppMessage({
      to: payload.from,
      message: 'We received your report but could not download the image from Twilio. Please resend the photo and location.',
    });
    return;
  }

  // Ask the AI what civic issue this photo shows.
  const detection = await detectIssueFromImage({
    imageBase64: image.dataUrl.split(',')[1],
    mimeType: image.mimeType,
    geminiApiKey: env.geminiApiKey,
    geminiModel: env.geminiModel,
    reportText: payload.bodyText,
  });

  console.log('[WhatsApp] Gemini detection result', {
    issueType: detection.issueType,
    severity: detection.severity,
    aiDescription: detection.aiDescription?.slice(0, 160),
    confidence: detection.confidence,
    diagnosticCode: detection.diagnosticCode,
    geminiStatus: detection.geminiStatus,
    mimeType: image.mimeType,
    hasGeminiKey: Boolean(env.geminiApiKey),
  });

  // If the AI wasn't confident, ask for a clearer photo instead of guessing.
  if (detection.diagnosticCode === 'low_confidence' || (typeof detection.confidence === 'number' && detection.confidence < 0.75)) {
    await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
    await sendTwilioWhatsAppMessage({
      to: payload.from,
      message: 'I could not confidently identify the issue from this image. Please upload a clearer photo of the issue and send it again.',
    });
    return;
  }

  // If the AI's answer doesn't map to a valid type, try guessing from the citizen's own text.
  let normalizedIssueType = normalizeWhatsappIssueType(detection.issueType);
  if (!normalizedIssueType) {
    normalizedIssueType = inferWhatsappIssueTypeFromText(payload.bodyText || '');
  }

  // Still nothing usable: tell the citizen why and stop (with a specific reason if we know it).
  if (!normalizedIssueType) {
    let classificationMessage = 'I could not confidently identify the issue from this image. Please upload a clearer photo of the issue and send it again.';

    if (detection.diagnosticCode === 'missing_api_key') {
      classificationMessage = 'AI classification is temporarily unavailable (server key missing). Please upload a clearer photo of the issue and send it again.';
    } else if (detection.diagnosticCode === 'gemini_quota_exceeded') {
      classificationMessage = 'AI image limit is currently reached. Please upload a clearer photo of the issue and send it again.';
    } else if (detection.diagnosticCode === 'gemini_access_denied') {
      classificationMessage = 'AI service authentication failed temporarily. Please upload a clearer photo of the issue and send it again.';
    }

    await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
    await sendTwilioWhatsAppMessage({
      to: payload.from,
      message: classificationMessage,
    });
    return;
  }

  // Block near-duplicate reports: same citizen, same photo (or same spot), nearby location.
  const incomingImageHash = getDataUrlImageHash(image.dataUrl);
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
    [payload.citizen.id, image.dataUrl, payload.lat, payload.lng, incomingImageHash]
  );

  if (duplicateResult.rowCount) {
    const existingCode = duplicateResult.rows[0].complaint_code;
    await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
    await sendTwilioWhatsAppMessage({
      to: payload.from,
      message: `This report already has been submitted. Complaint ID: ${existingCode}.`,
    });
    return;
  }

  // No duplicate found: work out the department and save the new report.
  const assignedDepartment = getWhatsappDepartmentFromIssueType(normalizedIssueType);
  const citizenName = `${payload.citizen.first_name} ${payload.citizen.last_name}`.trim();

  const inserted = await pool.query<{ id: string; complaint_code: string }>(
    `INSERT INTO reports (
      type,
      severity,
      lat,
      lng,
      location,
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
      $1,
      $2,
      $3,
      $4,
      $5,
      $6,
      $7,
      $8,
      FALSE,
      FALSE,
      'reported',
      NOW(),
      $9,
      $10,
      $11,
      $12,
      $13
    )
    RETURNING
      id,
      (
        'CMP-'
        || TO_CHAR(reported_at, 'YYYY')
        || '-'
        || LPAD(COALESCE(complaint_number, 0)::text, 6, '0')
      ) AS complaint_code`,
    [
      normalizedIssueType,
      detection.severity,
      payload.lat,
      payload.lng,
      payload.address,
      assignedDepartment,
      payload.bodyText.trim() || null,
      image.dataUrl,
      payload.citizen.id,
      citizenName,
      payload.citizen.email,
      payload.citizen.phone,
      detection.aiDescription,
    ]
  );

  // Build a working "track your report" link, avoiding localhost URLs in production.
  const reportId = inserted.rows[0]?.id;
  const complaintCode = inserted.rows[0]?.complaint_code || reportId;
  const configuredTrackBase = env.whatsappTrackBaseUrl?.trim() || '';
  const fallbackTrackBase = env.frontendBaseUrl?.trim() || '';
  const selectedTrackBase = configuredTrackBase || fallbackTrackBase;
  const safeTrackBase = /localhost|127\.0\.0\.1/i.test(selectedTrackBase)
    ? 'https://www.nazarai.live'
    : selectedTrackBase;
  const trackBaseUrl = safeTrackBase.replace(/\/$/, '');
  const trackUrl = `${trackBaseUrl}/track?id=${encodeURIComponent(complaintCode || '')}`;
  const confirmationMessage = `Thanks! Your report has been registered. Complaint ID: ${complaintCode}. Issue type: ${normalizedIssueType}. Assigned department: ${assignedDepartment}. Track your report: ${trackUrl}`;
  const confirmationResult = await sendTwilioWhatsAppMessageDetailed({
    to: payload.from,
    message: confirmationMessage,
  });

  // If the full confirmation message fails to send, retry with a shorter one,
  // and if that's rate-limited too, at least tell the citizen it was saved.
  if (!confirmationResult.ok) {
    console.warn('[WhatsApp] Primary confirmation failed. Retrying with shorter message.', {
      complaintCode,
      to: payload.from,
      internalReason: confirmationResult.internalReason,
      providerCode: confirmationResult.providerCode,
      providerMessage: confirmationResult.providerMessage,
    });

    const shortRetry = await sendTwilioWhatsAppMessageDetailed({
      to: payload.from,
      message: `Complaint registered. ID: ${complaintCode}. Type: ${normalizedIssueType}. Dept: ${assignedDepartment}.`,
    });

    if (!shortRetry.ok && (shortRetry.internalReason === 'TWILIO_RATE_LIMITED' || shortRetry.providerCode === 20429 || shortRetry.httpStatus === 429)) {
      // Try once with a dedicated limit notice so the user knows complaint is saved.
      await sendTwilioWhatsAppMessageDetailed({
        to: payload.from,
        message: `Your complaint is registered (ID: ${complaintCode}), but WhatsApp delivery is delayed due to provider message limit. Please check again shortly.`,
      });
    }
  }

  await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
}

const router = Router();

// The single webhook Twilio calls for every incoming WhatsApp message. It routes the
// message to the right handler: status check, feedback reply, or the step-by-step
// "send photo, then location" report flow.
router.post('/webhook', async (req, res) => {
  const from = String(req.body?.From || '');
  const bodyText = String(req.body?.Body || '');
  const mediaCount = Number(req.body?.NumMedia || '0');

  // Extract location from Twilio (when citizen shares live location from WhatsApp)
  const latParam = req.body?.Latitude ?? req.body?.latitude;
  const lngParam = req.body?.Longitude ?? req.body?.longitude;
  const receivedLat = Number(latParam);
  const receivedLng = Number(lngParam);
  const isLocationMessage = !Number.isNaN(receivedLat) && !Number.isNaN(receivedLng);

  console.log(`[WhatsApp] Received - From: ${from}, Body: ${bodyText.substring(0, 100)}, Media: ${mediaCount}, IsLocation: ${isLocationMessage}`);

  if (!from) {
    return respondWhatsAppMessage(res, 'whatsapp:+0000000000', 'Unable to read sender number. Please retry.');
  }

  // Only known citizen accounts can use the WhatsApp flow.
  const citizen = await resolveCitizenByPhone(from);
  if (!citizen) {
    return respondWhatsAppMessage(
      res,
      from,
      'Your number is not linked to a citizen account. Please add this WhatsApp number in Settings and try again.'
    );
  }

  await syncCitizenPhoneWithIncoming(citizen.id, from, citizen.phone);

  const fromPhone = normalizePhone(stripWhatsappPrefix(from));

  // If the message is a "status <id>" command, answer it directly and stop.
  const statusLookupId = extractStatusLookupId(bodyText);
  if (statusLookupId) {
    const language = detectStatusCommandLanguage(bodyText);
    const report = await resolveReportForWhatsappStatus(citizen.id, statusLookupId);

    if (!report) {
      return respondWhatsAppMessage(
        res,
        from,
        language === 'hi'
          ? ` '${statusLookupId}' के लिए कोई शिकायत नहीं मिली। सही फॉर्मेट भेजें: स्थिति CMP-2026-000123`
          : `No complaint found for '${statusLookupId}'. Send exact format like: STATUS CMP-2026-000123`
      );
    }

    return respondWhatsAppMessage(
      res,
      from,
      language === 'hi' ? buildWhatsappStatusMessageHindi(report) : buildWhatsappStatusMessage(report)
    );
  }

  // Check if this is a resolution feedback (rating reply)
  const feedbackResult = await handleIncomingResolutionFeedback({
    citizenId: citizen.id,
    fromPhone,
    bodyText,
  });

  if (feedbackResult.handled) {
    return respondWhatsAppMessage(res, from, feedbackResult.message);
  }

  // Check if this is detailed feedback for a reopened complaint
  const detailedFeedbackResult = await handleReopenedComplaintDetailedFeedback({
    citizenId: citizen.id,
    bodyText,
  });

  if (detailedFeedbackResult.handled) {
    return respondWhatsAppMessage(res, from, detailedFeedbackResult.message || 'आपकी प्रतिक्रिया दर्ज हो गई।');
  }

  // Get existing session to check flow state
  const session = await getWhatsappSession(citizen.id, fromPhone);

  // ========== FLOW STATE: Waiting for Image ==========
  // If no session exists OR user is starting fresh
  if (!session || session.flow_state === null || session.flow_state === 'waiting_for_image') {
    // Check if image was sent
    const currentMediaUrl = mediaCount > 0 ? String(req.body?.MediaUrl0 || '') : '';

    if (!currentMediaUrl && !isLocationMessage) {
      // No image, no location - user just sent text
      // This is the first message, ask them to send image
      const welcomeMsg = `📸 Welcome to Nazar AI!\n\nPlease send us:\n1. A photo of the issue\n2. A brief description (optional)\n\nExample: Send a photo of a pothole, or flooded street.`;
      return respondWhatsAppMessage(res, from, welcomeMsg);
    }

    if (currentMediaUrl && !isLocationMessage) {
      // Image received, store it and ask for location
      console.log(`[WhatsApp] Image received for ${from}, now asking for location`);

      const downloadedMedia = await fetchTwilioMediaAsDataUrl(currentMediaUrl);
      const pendingMediaPayload = downloadedMedia?.dataUrl || currentMediaUrl;

      if (!downloadedMedia) {
        console.warn('[WhatsApp] Could not pre-download media. Will retry when location arrives.', {
          from,
          mediaUrlPreview: currentMediaUrl.slice(0, 160),
        });
      }

      await upsertWhatsappSession({
        citizenId: citizen.id,
        fromPhone,
        pendingBody: bodyText.trim() || null,
        pendingAddress: null,
        pendingLat: null,
        pendingLng: null,
        pendingMediaUrl: pendingMediaPayload,
        flowState: 'waiting_for_location',
      });

      const askLocationMsg = `✅ Got your photo and description!\n\n📍 Now please share your current location:\n1. Click the attachment button (+) in WhatsApp\n2. Select "Location"\n3. Share your live location or current location\n\nThis helps us pinpoint the exact issue location.`;
      return respondWhatsAppMessage(res, from, askLocationMsg);
    }

    return respondWhatsAppMessage(res, from, 'Thanks! Please send your photo and then your location to complete the report.');
  }

  // ========== FLOW STATE: Waiting for Location ==========
  if (session.flow_state === 'waiting_for_location') {
    const parsedLocation = parseCoordinatesFromBody(bodyText);
    const resolvedLat = isLocationMessage ? receivedLat : parsedLocation?.lat;
    const resolvedLng = isLocationMessage ? receivedLng : parsedLocation?.lng;

    if (resolvedLat === undefined || resolvedLng === undefined) {
      // User sent text instead of location, remind them
      return respondWhatsAppMessage(
        res,
        from,
        'Please share your current location using WhatsApp location feature (click +, select Location, then share your live location).'
      );
    }

    // Location received! Process the report
    console.log(`[WhatsApp] Location received: ${resolvedLat}, ${resolvedLng}`);

    // Reverse geocode the location to get address
    const geocodeResult = await reverseGeocodeCoordinates(resolvedLat, resolvedLng);
    const resolvedAddress = geocodeResult?.address || `Shared location (${resolvedLat.toFixed(6)}, ${resolvedLng.toFixed(6)})`;
    if (geocodeResult) {
      console.log(`[WhatsApp] Location geocoded: ${geocodeResult.address}`);
    } else {
      console.warn(`[WhatsApp] Geocoding failed. Falling back to coordinates: ${resolvedLat}, ${resolvedLng}`);
    }

    // Now we have everything, process the report
    const payload: ProcessingPayload = {
      from,
      bodyText: session.pending_body || '',
      mediaUrl: session.pending_media_url || '',
      lat: resolvedLat,
      lng: resolvedLng,
      address: resolvedAddress,
      citizen,
    };

    // Reply to Twilio immediately (below), and do the slower AI/report-creation
    // work in the background so the webhook doesn't time out.
    setImmediate(() => {
      processIncomingWhatsappReport(payload).catch(async (error) => {
        console.error('WhatsApp report processing failed:', error);
        await clearWhatsappSession(citizen.id, fromPhone);
        await sendTwilioWhatsAppMessage({
          to: from,
          message: '❌ We could not complete your report. Please try again in a moment.',
        });
      });
    });

    return respondWhatsAppMessage(res, from, '✅ Processing your report. You will receive a confirmation with your complaint ID shortly.');
  }

  // Anything else we don't recognize (shouldn't normally happen).
  return respondWhatsAppMessage(res, from, 'Thanks! We received your message. Please follow the steps to submit your report.');
});

export default router;
