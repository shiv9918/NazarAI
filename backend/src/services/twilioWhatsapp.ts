// This file sends SMS and WhatsApp messages to users through Twilio's API.
import { env } from '../config/env';

// Result shape returned after trying to send an SMS.
export type SmsSendResult = {
  ok: boolean;
  internalReason?: string;
  providerCode?: number;
  providerMessage?: string;
};

// Result shape returned after trying to send a WhatsApp message.
export type WhatsAppSendResult = {
  ok: boolean;
  internalReason?: 'MISSING_TWILIO_CONFIG' | 'TWILIO_RATE_LIMITED' | 'TWILIO_REQUEST_FAILED';
  httpStatus?: number;
  providerCode?: number;
  providerMessage?: string;
};

// Build the "Authorization" header Twilio needs, using the account SID and auth token.
function getTwilioAuthHeader() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    return null;
  }

  const credentials = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  return `Basic ${credentials}`;
}

// Get the WhatsApp sender number, making sure it has the "whatsapp:" prefix Twilio expects.
function getTwilioWhatsappFromNumber() {
  if (!env.twilioWhatsappNumber) {
    return null;
  }

  if (env.twilioWhatsappNumber.startsWith('whatsapp:')) {
    return env.twilioWhatsappNumber;
  }

  return `whatsapp:${env.twilioWhatsappNumber}`;
}

// Get the plain SMS sender number, if one is configured.
function getTwilioSmsFromNumber() {
  if (!env.twilioSmsNumber) {
    return null;
  }

  return env.twilioSmsNumber.trim();
}

// Get the Twilio "Messaging Service" ID, an alternative way to send SMS without a fixed number.
function getTwilioMessagingServiceSid() {
  if (!env.twilioMessagingServiceSid) {
    return null;
  }

  return env.twilioMessagingServiceSid.trim();
}

// Clean up a phone number into the international "+countrycode..." format Twilio needs.
function normalizeSmsToNumber(raw: string) {
  const trimmed = raw.trim().replace(/^whatsapp:/i, '');
  if (!trimmed) return null;

  if (trimmed.startsWith('+')) {
    return trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  if (!digits) return null;

  // India local number fallback.
  if (digits.length === 10) {
    return `+91${digits}`;
  }

  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }

  return `+${digits}`;
}

// Send a WhatsApp message (with optional images/media) and return a detailed result,
// including the reason if it failed.
export async function sendTwilioWhatsAppMessageDetailed(params: {
  to: string;
  message: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
}): Promise<WhatsAppSendResult> {
  const authHeader = getTwilioAuthHeader();
  const fromNumber = getTwilioWhatsappFromNumber();
  if (!authHeader || !fromNumber || !env.twilioAccountSid) {
    console.error('[Twilio] Missing credentials or from number configuration', {
      hasAuthHeader: Boolean(authHeader),
      hasFromNumber: Boolean(fromNumber),
      hasAccountSid: Boolean(env.twilioAccountSid),
    });
    return {
      ok: false,
      internalReason: 'MISSING_TWILIO_CONFIG',
    };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`;
  const form = new URLSearchParams({
    From: fromNumber,
    To: params.to,
    Body: params.message,
  });

  const mediaUrls = [
    ...(params.mediaUrl ? [params.mediaUrl] : []),
    ...(params.mediaUrls || []),
  ].filter((url) => /^https?:\/\//i.test(url));

  for (const mediaUrl of mediaUrls) {
    form.append('MediaUrl', mediaUrl);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  // If Twilio rejected the request, try to read its error details before giving up.
  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let providerCode: number | undefined;
    let providerMessage: string | undefined;

    try {
      const parsed = JSON.parse(errorBody) as { code?: number; message?: string };
      providerCode = parsed.code;
      providerMessage = parsed.message;
    } catch {
      providerMessage = errorBody.slice(0, 300);
    }

    const isRateLimited = response.status === 429 || providerCode === 20429;

    console.error('[Twilio] Message send failed', {
      status: response.status,
      statusText: response.statusText,
      to: params.to,
      from: fromNumber,
      messagePreview: params.message.slice(0, 120),
      providerCode,
      providerMessage,
      errorPreview: errorBody.slice(0, 500),
    });
    return {
      ok: false,
      internalReason: isRateLimited ? 'TWILIO_RATE_LIMITED' : 'TWILIO_REQUEST_FAILED',
      httpStatus: response.status,
      providerCode,
      providerMessage,
    };
  }

  console.log('[Twilio] Message sent', {
    to: params.to,
    messagePreview: params.message.slice(0, 100),
    mediaCount: mediaUrls.length,
  });

  return { ok: true };
}

// Simple version of the WhatsApp sender that just returns true/false success.
export async function sendTwilioWhatsAppMessage(params: {
  to: string;
  message: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
}) {
  const result = await sendTwilioWhatsAppMessageDetailed(params);
  return result.ok;
}

// Send a plain SMS text message through Twilio.
export async function sendTwilioSmsMessage(params: {
  to: string;
  message: string;
}): Promise<SmsSendResult> {
  const authHeader = getTwilioAuthHeader();
  const fromNumber = getTwilioSmsFromNumber();
  const messagingServiceSid = getTwilioMessagingServiceSid();
  const toNumber = normalizeSmsToNumber(params.to);

  if (!authHeader || !toNumber || !env.twilioAccountSid) {
    console.error('[Twilio][SMS] Missing credentials or number configuration', {
      hasAuthHeader: Boolean(authHeader),
      hasFromNumber: Boolean(fromNumber),
      hasMessagingServiceSid: Boolean(messagingServiceSid),
      hasToNumber: Boolean(toNumber),
      hasAccountSid: Boolean(env.twilioAccountSid),
    });
    return {
      ok: false,
      internalReason: 'MISSING_TWILIO_CONFIG',
    };
  }

  if (!fromNumber && !messagingServiceSid) {
    return {
      ok: false,
      internalReason: 'MISSING_SMS_SENDER',
    };
  }

  const endpoint = `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(env.twilioAccountSid)}/Messages.json`;
  const form = new URLSearchParams({ To: toNumber, Body: params.message });
  if (messagingServiceSid) {
    form.append('MessagingServiceSid', messagingServiceSid);
  } else if (fromNumber) {
    form.append('From', fromNumber);
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form,
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    let providerCode: number | undefined;
    let providerMessage: string | undefined;
    try {
      const parsed = JSON.parse(errorBody) as { code?: number; message?: string };
      providerCode = parsed.code;
      providerMessage = parsed.message;
    } catch {
      providerMessage = errorBody.slice(0, 300);
    }

    console.error('[Twilio][SMS] Message send failed', {
      status: response.status,
      statusText: response.statusText,
      to: toNumber,
      from: fromNumber,
      messagingServiceSid,
      providerCode,
      providerMessage,
      errorPreview: errorBody.slice(0, 500),
    });
    return {
      ok: false,
      internalReason: 'TWILIO_REQUEST_FAILED',
      providerCode,
      providerMessage,
    };
  }

  console.log('[Twilio][SMS] Message sent', {
    to: toNumber,
    via: messagingServiceSid ? 'messaging-service' : 'from-number',
  });

  return { ok: true };
}
