type VisionDetection = {
  issueType: string;
  severity: number;
  aiDescription: string;
};

const DEFAULT_DETECTION: VisionDetection = {
  issueType: 'garbage',
  severity: 5,
  aiDescription: 'Issue detected from WhatsApp report image.',
};

function normalizeIssueType(raw: string | undefined) {
  if (!raw) return DEFAULT_DETECTION.issueType;
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
  if (!normalized) return DEFAULT_DETECTION.issueType;
  return normalized;
}

function normalizeSeverity(raw: number | undefined) {
  if (!raw || Number.isNaN(raw)) return DEFAULT_DETECTION.severity;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

function parseJsonFromText(rawText: string): Record<string, unknown> | null {
  const fenced = rawText.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const jsonCandidate = fenced ? fenced[1] : rawText;

  try {
    return JSON.parse(jsonCandidate) as Record<string, unknown>;
  } catch {
    const firstBrace = rawText.indexOf('{');
    const lastBrace = rawText.lastIndexOf('}');
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(rawText.slice(firstBrace, lastBrace + 1)) as Record<string, unknown>;
      } catch {
        return null;
      }
    }

    return null;
  }
}

export async function detectIssueFromImage(params: {
  imageBase64: string;
  mimeType: string;
  geminiApiKey?: string;
}): Promise<VisionDetection> {
  if (!params.geminiApiKey) {
    return DEFAULT_DETECTION;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(params.geminiApiKey)}`;

  const prompt = [
    'You are classifying civic issues from a single citizen photo for municipal routing.',
    'Return only JSON with keys: issueType, severity, aiDescription.',
    'issueType must be one of: garbage, pothole, broken_streetlight, water_leakage, illegal_dump, unknown.',
    'severity must be integer 1-10.',
    'aiDescription should be max 200 chars.',
  ].join(' ');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: params.mimeType,
                data: params.imageBase64,
              },
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return DEFAULT_DETECTION;
  }

  const payload = await response.json().catch(() => null) as any;
  const modelText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!modelText || typeof modelText !== 'string') {
    return DEFAULT_DETECTION;
  }

  const parsed = parseJsonFromText(modelText);
  if (!parsed) {
    return DEFAULT_DETECTION;
  }

  return {
    issueType: normalizeIssueType(typeof parsed.issueType === 'string' ? parsed.issueType : undefined),
    severity: normalizeSeverity(typeof parsed.severity === 'number' ? parsed.severity : undefined),
    aiDescription: typeof parsed.aiDescription === 'string' && parsed.aiDescription.trim().length
      ? parsed.aiDescription.trim().slice(0, 200)
      : DEFAULT_DETECTION.aiDescription,
  };
}
