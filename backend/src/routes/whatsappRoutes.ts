import { Router } from 'express';
import { pool } from '../config/db';
import { env } from '../config/env';
import { assignDepartment } from '../utils/reportAssignment';
import { detectIssueFromImage } from '../services/geminiVision';
import { sendTwilioWhatsAppMessage } from '../services/twilioWhatsapp';

type DbCitizen = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: 'citizen' | 'municipal' | 'department' | 'admin';
  phone: string | null;
};

type DbWhatsappSession = {
  citizen_id: string;
  from_phone: string;
  pending_body: string | null;
  pending_address: string | null;
  pending_lat: number | null;
  pending_lng: number | null;
  pending_media_url: string | null;
};

function xmlMessage(text: string) {
  const safe = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${safe}</Message></Response>`;
}

function normalizePhone(raw: string) {
  return raw.replace(/[^\d+]/g, '').trim();
}

function stripWhatsappPrefix(value: string) {
  return value.startsWith('whatsapp:') ? value.slice('whatsapp:'.length) : value;
}

function parseCoordinatesFromBody(bodyText: string) {
  const match = bodyText.match(/(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)/);
  if (!match) return null;

  const lat = Number(match[1]);
  const lng = Number(match[2]);
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null;
  return { lat, lng };
}

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

function getTwilioAuthHeader() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    return null;
  }

  const credentials = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  return `Basic ${credentials}`;
}

async function resolveCitizenByPhone(fromRaw: string) {
  const incoming = normalizePhone(stripWhatsappPrefix(fromRaw));

  const result = await pool.query<DbCitizen>(
    `SELECT id, first_name, last_name, email, role, phone
     FROM users
     WHERE role = 'citizen'
       AND regexp_replace(COALESCE(phone, ''), '[^0-9+]', '', 'g') = $1
     LIMIT 1`,
    [incoming]
  );

  return result.rows[0] || null;
}

async function fetchTwilioMediaAsDataUrl(mediaUrl: string): Promise<{ dataUrl: string; mimeType: string } | null> {
  const authHeader = getTwilioAuthHeader();
  if (!authHeader) {
    return null;
  }

  const response = await fetch(mediaUrl, {
    headers: {
      Authorization: authHeader,
    },
  });

  if (!response.ok) {
    return null;
  }

  const arrayBuffer = await response.arrayBuffer();
  const mimeType = response.headers.get('content-type') || 'image/jpeg';
  const base64 = Buffer.from(arrayBuffer).toString('base64');
  return {
    dataUrl: `data:${mimeType};base64,${base64}`,
    mimeType,
  };
}

type ProcessingPayload = {
  from: string;
  bodyText: string;
  mediaUrl: string;
  lat: number;
  lng: number;
  address: string;
  citizen: DbCitizen;
};

async function getWhatsappSession(citizenId: string, fromPhone: string) {
  const result = await pool.query<DbWhatsappSession>(
    `SELECT citizen_id, from_phone, pending_body, pending_address, pending_lat, pending_lng, pending_media_url
     FROM whatsapp_sessions
     WHERE citizen_id = $1 AND from_phone = $2
     LIMIT 1`,
    [citizenId, fromPhone]
  );

  return result.rows[0] || null;
}

async function upsertWhatsappSession(params: {
  citizenId: string;
  fromPhone: string;
  pendingBody: string | null;
  pendingAddress: string | null;
  pendingLat: number | null;
  pendingLng: number | null;
  pendingMediaUrl: string | null;
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
      updated_at
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
    ON CONFLICT (citizen_id, from_phone)
    DO UPDATE SET
      pending_body = EXCLUDED.pending_body,
      pending_address = EXCLUDED.pending_address,
      pending_lat = EXCLUDED.pending_lat,
      pending_lng = EXCLUDED.pending_lng,
      pending_media_url = EXCLUDED.pending_media_url,
      updated_at = NOW()`,
    [
      params.citizenId,
      params.fromPhone,
      params.pendingBody,
      params.pendingAddress,
      params.pendingLat,
      params.pendingLng,
      params.pendingMediaUrl,
    ]
  );
}

async function clearWhatsappSession(citizenId: string, fromPhone: string) {
  await pool.query(
    `DELETE FROM whatsapp_sessions
     WHERE citizen_id = $1 AND from_phone = $2`,
    [citizenId, fromPhone]
  );
}

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

async function processIncomingWhatsappReport(payload: ProcessingPayload) {
  const image = await fetchTwilioMediaAsDataUrl(payload.mediaUrl);

  if (!image) {
    await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
    await sendTwilioWhatsAppMessage({
      to: payload.from,
      message: 'We received your report but could not download the image from Twilio. Please resend the photo and location.',
    });
    return;
  }

  const detection = await detectIssueFromImage({
    imageBase64: image.dataUrl.split(',')[1],
    mimeType: image.mimeType,
    geminiApiKey: env.geminiApiKey,
  });

  const assignedDepartment = assignDepartment(detection.issueType, null);
  const citizenName = `${payload.citizen.first_name} ${payload.citizen.last_name}`.trim();

  const inserted = await pool.query<{ id: string }>(
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
      $12
    )
    RETURNING id`,
    [
      detection.issueType,
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
      detection.aiDescription,
    ]
  );

  const reportId = inserted.rows[0]?.id;
  await sendTwilioWhatsAppMessage({
    to: payload.from,
    message: `Thanks! Your report has been registered. Complaint ID: ${reportId}. Issue type: ${detection.issueType}. Assigned department: ${assignedDepartment}. You can track progress in the Nazar AI app.`,
  });

  await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
}

const router = Router();

router.post('/webhook', async (req, res) => {
  const from = String(req.body?.From || '');
  const bodyText = String(req.body?.Body || '');
  const mediaCount = Number(req.body?.NumMedia || '0');

  console.log(`[WhatsApp] Received message - From: ${from}, Body: ${bodyText.substring(0, 100)}, Media: ${mediaCount}`);

  if (!from) {
    res.type('text/xml');
    return res.status(200).send(xmlMessage('Unable to read sender number. Please retry.'));
  }

  const citizen = await resolveCitizenByPhone(from);
  console.log(`[WhatsApp] Citizen lookup for ${from}: ${citizen ? 'FOUND (' + citizen.id + ')' : 'NOT FOUND'}`);
  
  if (!citizen) {
    console.log(`[WhatsApp] Available citizens in DB with phone numbers:`);
    const allCitizens = await pool.query(`SELECT id, first_name, phone FROM users WHERE role = 'citizen' AND phone IS NOT NULL`);
    allCitizens.rows.forEach(c => console.log(`  - ${c.first_name} (${c.id}): ${c.phone}`));
    
    res.type('text/xml');
    return res.status(200).send(xmlMessage('Your number is not linked to a citizen account. Please add this WhatsApp number in Settings and try again.'));
  }

  const fromPhone = normalizePhone(stripWhatsappPrefix(from));
  const session = await getWhatsappSession(citizen.id, fromPhone);

  const currentMediaUrl = mediaCount > 0 ? String(req.body?.MediaUrl0 || '') : '';
  const mediaUrl = currentMediaUrl || session?.pending_media_url || '';

  const latParam = req.body?.Latitude ?? req.body?.latitude;
  const lngParam = req.body?.Longitude ?? req.body?.longitude;
  let lat = Number(latParam);
  let lng = Number(lngParam);

  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    const parsed = parseCoordinatesFromBody(bodyText);
    if (parsed) {
      lat = parsed.lat;
      lng = parsed.lng;
    }
  }

  const address = extractAddressText(bodyText, req.body?.Address || req.body?.address || null);

  const finalLat = Number.isNaN(lat) ? session?.pending_lat ?? null : lat;
  const finalLng = Number.isNaN(lng) ? session?.pending_lng ?? null : lng;
  const finalAddress = address || session?.pending_address || null;
  const finalBody = bodyText.trim() || session?.pending_body || null;

  const hasMedia = Boolean(mediaUrl);
  const hasAddress = Boolean(finalAddress);
  const hasCoordinates = finalLat !== null && finalLng !== null;

  if (!hasMedia || !hasAddress || !hasCoordinates) {
    await upsertWhatsappSession({
      citizenId: citizen.id,
      fromPhone,
      pendingBody: finalBody,
      pendingAddress: finalAddress,
      pendingLat: finalLat,
      pendingLng: finalLng,
      pendingMediaUrl: hasMedia ? mediaUrl : null,
    });

    const requirementMessage = buildMissingRequirementMessage(hasMedia, hasAddress, hasCoordinates);
    res.type('text/xml');
    return res.status(200).send(xmlMessage(requirementMessage));
  }

  const payload: ProcessingPayload = {
    from,
    bodyText: finalBody || '',
    mediaUrl,
    lat: finalLat as number,
    lng: finalLng as number,
    address: finalAddress as string,
    citizen,
  };

  setImmediate(() => {
    processIncomingWhatsappReport(payload).catch(async (error) => {
      console.error('WhatsApp report processing failed:', error);
      await clearWhatsappSession(payload.citizen.id, normalizePhone(stripWhatsappPrefix(payload.from)));
      await sendTwilioWhatsAppMessage({
        to: payload.from,
        message: 'We received your message but could not complete report creation. Please retry in a moment.',
      });
    });
  });

  res.type('text/xml');
  return res.status(200).send(xmlMessage('Thanks! We received your report and are processing it now. You will get a confirmation message shortly.'));
});

export default router;
