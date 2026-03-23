import { Router } from 'express';
import { pool } from '../config/db';
import { env } from '../config/env';
import { assignDepartment } from '../utils/reportAssignment';
import { detectIssueFromImage } from '../services/geminiVision';
import { sendTwilioWhatsAppMessage } from '../services/twilioWhatsapp';
import { handleIncomingResolutionFeedback } from '../services/whatsappResolutionFlow';
import { reverseGeocodeCoordinates, formatGeocodeResult } from '../services/geocodingService';

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
  flow_state: 'waiting_for_image' | 'waiting_for_location' | 'ready_to_process' | null;
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
    `SELECT citizen_id, from_phone, pending_body, pending_address, pending_lat, pending_lng, pending_media_url, flow_state
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
    reportText: payload.bodyText,
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

  // Extract location from Twilio (when citizen shares live location from WhatsApp)
  const latParam = req.body?.Latitude ?? req.body?.latitude;
  const lngParam = req.body?.Longitude ?? req.body?.longitude;
  const receivedLat = Number(latParam);
  const receivedLng = Number(lngParam);
  const isLocationMessage = !Number.isNaN(receivedLat) && !Number.isNaN(receivedLng);

  console.log(`[WhatsApp] Received - From: ${from}, Body: ${bodyText.substring(0, 100)}, Media: ${mediaCount}, IsLocation: ${isLocationMessage}`);

  if (!from) {
    res.type('text/xml');
    return res.status(200).send(xmlMessage('Unable to read sender number. Please retry.'));
  }

  const citizen = await resolveCitizenByPhone(from);
  if (!citizen) {
    res.type('text/xml');
    return res.status(200).send(xmlMessage('Your number is not linked to a citizen account. Please add this WhatsApp number in Settings and try again.'));
  }

  const fromPhone = normalizePhone(stripWhatsappPrefix(from));

  // Check if this is a resolution feedback (rating reply)
  const feedbackResult = await handleIncomingResolutionFeedback({
    citizenId: citizen.id,
    fromPhone,
    bodyText,
  });

  if (feedbackResult.handled) {
    res.type('text/xml');
    return res.status(200).send(xmlMessage(feedbackResult.message));
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
      res.type('text/xml');
      return res.status(200).send(xmlMessage(welcomeMsg));
    }

    if (currentMediaUrl && !isLocationMessage) {
      // Image received, store it and ask for location
      console.log(`[WhatsApp] Image received for ${from}, now asking for location`);

      await upsertWhatsappSession({
        citizenId: citizen.id,
        fromPhone,
        pendingBody: bodyText.trim() || null,
        pendingAddress: null,
        pendingLat: null,
        pendingLng: null,
        pendingMediaUrl: currentMediaUrl,
        flowState: 'waiting_for_location',
      });

      const askLocationMsg = `✅ Got your photo and description!\n\n📍 Now please share your current location:\n1. Click the attachment button (+) in WhatsApp\n2. Select "Location"\n3. Share your live location or current location\n\nThis helps us pinpoint the exact issue location.`;
      res.type('text/xml');
      return res.status(200).send(xmlMessage(askLocationMsg));
    }

    res.type('text/xml');
    return res.status(200).send(xmlMessage('Thanks! Please send your photo and then your location to complete the report.'));
  }

  // ========== FLOW STATE: Waiting for Location ==========
  if (session.flow_state === 'waiting_for_location') {
    if (!isLocationMessage) {
      // User sent text instead of location, remind them
      res.type('text/xml');
      return res.status(200).send(xmlMessage('Please share your current location using WhatsApp location feature (click +, select Location, then share your live location).'));
    }

    // Location received! Process the report
    console.log(`[WhatsApp] Location received: ${receivedLat}, ${receivedLng}`);

    // Reverse geocode the location to get address
    const geocodeResult = await reverseGeocodeCoordinates(receivedLat, receivedLng);
    if (!geocodeResult) {
      await clearWhatsappSession(citizen.id, fromPhone);
      res.type('text/xml');
      return res.status(200).send(xmlMessage('We could not identify your location. Please try again with a different location.'));
    }

    console.log(`[WhatsApp] Location geocoded: ${geocodeResult.address}`);

    // Now we have everything, process the report
    const payload: ProcessingPayload = {
      from,
      bodyText: session.pending_body || '',
      mediaUrl: session.pending_media_url || '',
      lat: receivedLat,
      lng: receivedLng,
      address: geocodeResult.address,
      citizen,
    };

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

    res.type('text/xml');
    return res.status(200).send(xmlMessage('✅ Processing your report. You will receive a confirmation with your complaint ID shortly.'));
  }

  // Default fallback
  res.type('text/xml');
  return res.status(200).send(xmlMessage('Thanks! We received your message. Please follow the steps to submit your report.'));
});

export default router;
