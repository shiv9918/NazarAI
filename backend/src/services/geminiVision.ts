type VisionDetection = {
  issueType: string;
  severity: number;
  aiDescription: string;
};

const DEFAULT_DETECTION: VisionDetection = {
  issueType: 'unknown',
  severity: 3,
  aiDescription: 'Issue detected from WhatsApp report image.',
};

const ISSUE_ALIASES: Record<string, string> = {
  garbage: 'garbage',
  trash: 'garbage',
  litter: 'garbage',
  waste: 'garbage',
  pothole: 'pothole',
  road_damage: 'pothole',
  road_crack: 'pothole',
  broken_streetlight: 'broken_streetlight',
  streetlight: 'broken_streetlight',
  street_light: 'broken_streetlight',
  light_outage: 'broken_streetlight',
  water_leakage: 'water_leakage',
  water_leak: 'water_leakage',
  waterlogging: 'water_leakage',
  water_logging: 'water_leakage',
  pipe_leakage: 'water_leakage',
  sewage_leakage: 'water_leakage',
  illegal_dump: 'illegal_dump',
  illegal_dumping: 'illegal_dump',
  dump: 'illegal_dump',
  unknown: 'unknown',
};

function normalizeIssueType(raw: string | undefined) {
  if (!raw) return DEFAULT_DETECTION.issueType;
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
  if (!normalized) return DEFAULT_DETECTION.issueType;
  return ISSUE_ALIASES[normalized] || DEFAULT_DETECTION.issueType;
}

function normalizeSeverity(raw: number | undefined) {
  if (!raw || Number.isNaN(raw)) return DEFAULT_DETECTION.severity;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

function hasWaterLeakageHints(text?: string) {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes('water') ||
    t.includes('leak') ||
    t.includes('pipeline') ||
    t.includes('pipe') ||
    t.includes('tap') ||
    t.includes('sewage') ||
    t.includes('drain')
  );
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
  reportText?: string;
}): Promise<VisionDetection> {
  if (!params.geminiApiKey) {
    return DEFAULT_DETECTION;
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(params.geminiApiKey)}`;

  const prompt = [
    'You are classifying civic issues from a single citizen photo for municipal routing.',
    'Return only JSON with keys: issueType, severity, aiDescription.',
    'issueType must be one of: garbage, pothole, broken_streetlight, water_leakage, illegal_dump, unknown.',
    'Choose unknown if image is unclear instead of guessing.',
    'If visible flowing/spraying water from pipe/tap/drain is present, prefer water_leakage (not garbage).',
    'Use garbage only when trash/litter is the dominant issue in the image.',
    'severity must be integer 1-10.',
    'aiDescription should be max 200 chars.',
    params.reportText ? `Citizen note: ${params.reportText}` : '',
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
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json',
      },
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

  let issueType = normalizeIssueType(typeof parsed.issueType === 'string' ? parsed.issueType : undefined);
  const severityValue =
    typeof parsed.severity === 'number'
      ? parsed.severity
      : typeof parsed.severity === 'string'
      ? Number(parsed.severity)
      : undefined;

  // If user text strongly suggests leakage and model guessed generic/incorrect class,
  // bias toward water leakage to avoid common garbage false-positives.
  if (hasWaterLeakageHints(params.reportText) && (issueType === 'unknown' || issueType === 'garbage')) {
    issueType = 'water_leakage';
  }

  return {
    issueType,
    severity: normalizeSeverity(severityValue),
    aiDescription:
      typeof parsed.aiDescription === 'string' && parsed.aiDescription.trim().length
        ? parsed.aiDescription.trim().slice(0, 200)
        : DEFAULT_DETECTION.aiDescription,
  };
}
