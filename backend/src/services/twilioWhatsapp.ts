import { env } from '../config/env';

function getTwilioAuthHeader() {
  if (!env.twilioAccountSid || !env.twilioAuthToken) {
    return null;
  }

  const credentials = Buffer.from(`${env.twilioAccountSid}:${env.twilioAuthToken}`).toString('base64');
  return `Basic ${credentials}`;
}

function getTwilioWhatsappFromNumber() {
  if (!env.twilioWhatsappNumber) {
    return null;
  }

  if (env.twilioWhatsappNumber.startsWith('whatsapp:')) {
    return env.twilioWhatsappNumber;
  }

  return `whatsapp:${env.twilioWhatsappNumber}`;
}

export async function sendTwilioWhatsAppMessage(params: {
  to: string;
  message: string;
  mediaUrl?: string | null;
  mediaUrls?: string[];
}) {
  const authHeader = getTwilioAuthHeader();
  const fromNumber = getTwilioWhatsappFromNumber();
  if (!authHeader || !fromNumber || !env.twilioAccountSid) {
    return false;
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

  return response.ok;
}
