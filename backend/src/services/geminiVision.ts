type VisionDetection = {
  issueType: string;
  severity: number;
  aiDescription: string;
  confidence?: number;
  diagnosticCode?:
    | 'ok'
    | 'missing_api_key'
    | 'gemini_quota_exceeded'
    | 'gemini_access_denied'
    | 'gemini_request_failed'
    | 'no_model_text'
    | 'model_output_parse_failed'
    | 'low_confidence';
  geminiStatus?: number;
};

type IssueType =
  | 'garbage'
  | 'pothole'
  | 'broken_streetlight'
  | 'water_leakage'
  | 'illegal_dump'
  | 'fallen_tree'
  | 'hanging_wire'
  | 'park_broken_equipment'
  | 'public_bench_broken'
  | 'unknown';

const DEFAULT_DETECTION: VisionDetection = {
  issueType: 'unknown',
  severity: 3,
  aiDescription: 'Issue detected from WhatsApp report image.',
};

function logGemini(message: string, meta?: Record<string, unknown>) {
  if (meta) {
    console.log(`[GeminiVision] ${message}`, meta);
    return;
  }
  console.log(`[GeminiVision] ${message}`);
}

const ISSUE_ALIASES: Record<string, string> = {
  garbage: 'garbage',
  garbage_overflow: 'garbage',
  overflowing_garbage: 'garbage',
  trash_bin_overflow: 'garbage',
  trash: 'garbage',
  litter: 'garbage',
  waste: 'garbage',
  kachra: 'garbage',
  pothole: 'pothole',
  potholes: 'pothole',
  gaddha: 'pothole',
  road_damage: 'pothole',
  road_crack: 'pothole',
  road_pothole: 'pothole',
  broken_streetlight: 'broken_streetlight',
  streetlight: 'broken_streetlight',
  street_light_broken: 'broken_streetlight',
  streetlight_not_working: 'broken_streetlight',
  light_not_working: 'broken_streetlight',
  street_light: 'broken_streetlight',
  light_outage: 'broken_streetlight',
  bijli: 'broken_streetlight',
  water_leakage: 'water_leakage',
  water_leakage_issue: 'water_leakage',
  water_leak: 'water_leakage',
  waterlogging: 'water_leakage',
  water_logging: 'water_leakage',
  pipe_leakage: 'water_leakage',
  sewage_leakage: 'water_leakage',
  pani: 'water_leakage',
  leakage: 'water_leakage',
  illegal_dump: 'illegal_dump',
  illegal_dumping: 'illegal_dump',
  construction_dump: 'illegal_dump',
  debris_dump: 'illegal_dump',
  dump: 'illegal_dump',
  fallen_tree: 'fallen_tree',
  tree_fallen: 'fallen_tree',
  tree_down: 'fallen_tree',
  tree_fall: 'fallen_tree',
  hanging_wire: 'hanging_wire',
  loose_wire: 'hanging_wire',
  wire_down: 'hanging_wire',
  park_broken_equipment: 'park_broken_equipment',
  broken_park_equipment: 'park_broken_equipment',
  public_bench_broken: 'public_bench_broken',
  broken_bench: 'public_bench_broken',
  unknown: 'unknown',
};

const KEYWORD_HINTS: Record<Exclude<IssueType, 'unknown'>, string[]> = {
  water_leakage: ['water', 'leak', 'leakage', 'pipeline', 'pipe', 'drain', 'sewage', 'pani', 'paani', 'nal'],
  pothole: ['pothole', 'potholes', 'gaddha', 'road crack', 'road damage', 'sadak'],
  broken_streetlight: ['streetlight', 'street light', 'light not working', 'light outage', 'dark road', 'bijli'],
  garbage: ['garbage', 'trash', 'waste', 'litter', 'kachra', 'dustbin overflow'],
  illegal_dump: ['illegal dump', 'debris', 'construction waste', 'dumping', 'malba'],
  fallen_tree: ['fallen tree', 'tree fallen', 'tree down', 'uprooted tree', 'tree branches', 'tree trunk'],
  hanging_wire: ['hanging wire', 'loose wire', 'wire down', 'electric wire', 'fallen wire'],
  park_broken_equipment: ['park equipment', 'broken swing', 'broken slide', 'damaged play equipment'],
  public_bench_broken: ['broken bench', 'damaged bench', 'park bench', 'bench broken'],
};

function inferIssueTypeFromKeywords(text?: string | null): IssueType {
  if (!text) return 'unknown';
  const t = text.toLowerCase();

  const priority: Exclude<IssueType, 'unknown'>[] = [
    'water_leakage',
    'pothole',
    'broken_streetlight',
    'fallen_tree',
    'hanging_wire',
    'park_broken_equipment',
    'public_bench_broken',
    'garbage',
    'illegal_dump',
  ];

  for (const type of priority) {
    if (KEYWORD_HINTS[type].some((token) => t.includes(token))) {
      return type;
    }
  }

  return 'unknown';
}

function normalizeIssueType(raw: string | undefined) {
  if (!raw) return DEFAULT_DETECTION.issueType;
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
  if (!normalized) return DEFAULT_DETECTION.issueType;

  if (ISSUE_ALIASES[normalized]) {
    return ISSUE_ALIASES[normalized];
  }

  // Handle model outputs like "pothole issue", "water leakage problem", etc.
  const inferred = inferIssueTypeFromKeywords(normalized.replace(/_/g, ' '));
  return inferred !== 'unknown' ? inferred : DEFAULT_DETECTION.issueType;
}

function normalizeSeverity(raw: number | undefined) {
  if (!raw || Number.isNaN(raw)) return DEFAULT_DETECTION.severity;
  return Math.max(1, Math.min(10, Math.round(raw)));
}

function normalizeConfidence(raw: number | undefined) {
  if (typeof raw !== 'number' || Number.isNaN(raw)) {
    return undefined;
  }

  const normalized = raw > 1 ? raw / 100 : raw;
  return Math.max(0, Math.min(1, normalized));
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

function pickStringField(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function pickNumberField(obj: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'number' && !Number.isNaN(value)) {
      return value;
    }
    if (typeof value === 'string' && value.trim()) {
      const n = Number(value);
      if (!Number.isNaN(n)) return n;
    }
  }
  return undefined;
}

function pickConfidenceField(obj: Record<string, unknown>, keys: string[]): number | undefined {
  return normalizeConfidence(pickNumberField(obj, keys));
}

async function classifyIssueTypeStrict(params: {
  endpoint: string;
  imageBase64: string;
  mimeType: string;
  reportText?: string;
}): Promise<IssueType> {
  const strictPrompt = [
    'Classify this civic issue image.',
    'Respond with exactly one label only from this list:',
    'garbage, pothole, broken_streetlight, water_leakage, illegal_dump, fallen_tree, hanging_wire, park_broken_equipment, public_bench_broken, unknown',
    'If the image is not a civic issue or is unclear, return unknown.',
    'Do not return JSON. Do not add explanation.',
    params.reportText ? `Citizen note: ${params.reportText}` : '',
  ].join(' ');

  const strictResponse = await fetch(params.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            { text: strictPrompt },
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
        temperature: 0,
      },
    }),
  });

  if (!strictResponse.ok) {
    return 'unknown';
  }

  const strictPayload = (await strictResponse.json().catch(() => null)) as any;
  const strictText = strictPayload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!strictText || typeof strictText !== 'string') {
    return 'unknown';
  }

  const normalized = normalizeIssueType(strictText);
  if (normalized !== 'unknown') {
    return normalized as IssueType;
  }

  const inferred = inferIssueTypeFromKeywords(strictText);
  return inferred;
}

export async function detectIssueFromImage(params: {
  imageBase64: string;
  mimeType: string;
  geminiApiKey?: string;
  geminiModel?: string;
  reportText?: string;
}): Promise<VisionDetection> {
  const modelName = (params.geminiModel || 'gemini-2.5-flash').trim();

  logGemini('Detection started', {
    hasApiKey: Boolean(params.geminiApiKey),
    modelName,
    mimeType: params.mimeType,
    reportTextPreview: (params.reportText || '').slice(0, 80),
    imageBytesApprox: Math.round((params.imageBase64?.length || 0) * 0.75),
  });

  if (!params.geminiApiKey) {
    const textFallback = inferIssueTypeFromKeywords(params.reportText || '');
    logGemini('No GEMINI_API_KEY. Using text fallback when possible.', {
      textFallback,
    });
    return {
      issueType: textFallback,
      severity: DEFAULT_DETECTION.severity,
      aiDescription: DEFAULT_DETECTION.aiDescription,
      diagnosticCode: 'missing_api_key',
    };
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelName)}:generateContent?key=${encodeURIComponent(params.geminiApiKey)}`;

  const prompt = [
    'You are classifying civic issues from a single citizen photo for municipal routing in Indian cities.',
    'Return only JSON with keys: issueType, severity, confidence, aiDescription.',
    'issueType must be one of: garbage, pothole, broken_streetlight, water_leakage, illegal_dump, fallen_tree, hanging_wire, park_broken_equipment, public_bench_broken, unknown.',
    'Choose the closest matching issueType from allowed list. Use unknown only when image has no visible civic issue.',
    'Do not overuse unknown. If any visible issue exists, pick the closest label.',
    'If a tree is fallen, uprooted, broken, or blocking an area, choose fallen_tree instead of garbage or illegal_dump.',
    'If a wire is hanging down, choose hanging_wire.',
    'If visible flowing/spraying water from pipe/tap/drain is present, prefer water_leakage (not garbage).',
    'Even if scene is indoor or private-looking, visible active water leakage/spray still maps to water_leakage.',
    'Use garbage only when trash/litter is the dominant issue in the image.',
    'If road surface hole/crater is visible, prefer pothole.',
    'If street light pole/lamp is not working or broken, prefer broken_streetlight.',
    'If the image is blurry, partially blocked, too dark, or ambiguous, reduce confidence and use unknown if you cannot identify the issue reliably.',
    '',
    'SEVERITY SCORING (1-10 scale):',
    '1-2: MINOR - No safety risk, cosmetic issue, small localized trash, very minor street damage',
    '3-4: LOW - Small damage/issue, minimal public impact, single light out on well-lit street',
    '5-6: MODERATE - Noticeable damage, potential inconvenience, needs fix soon (minor pothole, partial blockage)',
    '7-8: HIGH - Safety concern, public health risk, major damage affecting traffic/safety (large pothole, blocked drainage causing flooding, multiple lights out on dark road)',
    '9-10: CRITICAL EMERGENCY - Immediate danger to public, severe safety hazard, active hazard (large open hole in road, water gushing/flowing blocking area, total darkness on busy street, severe water overflow causing flooding)',
    '',
    'Severity factors to consider:',
    '• Size/extent: Larger = higher severity',
    '• Safety hazard: Exposed hole, dark area, water flow = higher severity',
    '• Public impact: How many people affected, traffic disruption = higher severity',
    '• Health/environmental risk: Water overflow, contamination = higher severity',
    '• Urgency: How soon must it be fixed = reflects in severity',
    '',
    'confidence must be a decimal from 0 to 1 indicating how certain you are.',
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
    const errorBody = await response.text().catch(() => '');
    const diagnosticCode = response.status === 429
      ? 'gemini_quota_exceeded'
      : (response.status === 401 || response.status === 403 ? 'gemini_access_denied' : 'gemini_request_failed');

    logGemini('Primary API call failed', {
      status: response.status,
      statusText: response.statusText,
      diagnosticCode,
      errorPreview: errorBody.slice(0, 400),
    });
    const strictRetry = await classifyIssueTypeStrict({
      endpoint,
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      reportText: params.reportText,
    });
    return {
      issueType: strictRetry,
      severity: strictRetry === 'unknown' ? DEFAULT_DETECTION.severity : 5,
      aiDescription: DEFAULT_DETECTION.aiDescription,
      diagnosticCode,
      geminiStatus: response.status,
    };
  }

  const payload = await response.json().catch(() => null) as any;
  const modelText = payload?.candidates?.[0]?.content?.parts?.[0]?.text;

  logGemini('Primary API response received', {
    hasText: Boolean(modelText),
    textPreview: typeof modelText === 'string' ? modelText.slice(0, 220) : null,
  });

  if (!modelText || typeof modelText !== 'string') {
    logGemini('Model returned no text. Running strict retry.');
    const strictRetry = await classifyIssueTypeStrict({
      endpoint,
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      reportText: params.reportText,
    });

    const fallbackIssue = strictRetry !== 'unknown'
      ? strictRetry
      : inferIssueTypeFromKeywords(params.reportText || '');

    return {
      issueType: fallbackIssue,
      severity: DEFAULT_DETECTION.severity,
      aiDescription: DEFAULT_DETECTION.aiDescription,
      diagnosticCode: 'no_model_text',
    };
  }

  const parsed = parseJsonFromText(modelText);
  if (!parsed) {
    logGemini('JSON parse failed. Falling back to keyword inference.', {
      modelTextPreview: modelText.slice(0, 220),
    });

    const strictRetry = await classifyIssueTypeStrict({
      endpoint,
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      reportText: params.reportText,
    });

    const fallbackFromModelText = inferIssueTypeFromKeywords(modelText);
    const fallbackFromReportText = inferIssueTypeFromKeywords(params.reportText || '');
    const fallbackIssue = strictRetry !== 'unknown'
      ? strictRetry
      : (fallbackFromModelText !== 'unknown' ? fallbackFromModelText : fallbackFromReportText);

    return {
      issueType: fallbackIssue,
      severity: DEFAULT_DETECTION.severity,
      aiDescription: DEFAULT_DETECTION.aiDescription,
      diagnosticCode: 'model_output_parse_failed',
    };
  }

  const rawIssueType = pickStringField(parsed, ['issueType', 'issue_type', 'type', 'issue', 'category', 'label']);
  let issueType = normalizeIssueType(rawIssueType);
  const severityValue = pickNumberField(parsed, ['severity', 'priority', 'level', 'score']);
  const confidenceValue = pickConfidenceField(parsed, ['confidence', 'confidenceScore', 'certainty', 'probability']);
  const rawAiDescription = pickStringField(parsed, ['aiDescription', 'ai_description', 'description', 'reason', 'summary']);
  const normalizedConfidence = confidenceValue ?? (issueType === 'unknown' ? 0.2 : rawIssueType ? 0.7 : 0.5);

  // Final hard fallback: if still unknown, ask model for a strict single-label answer.
  if (issueType === 'unknown') {
    logGemini('Issue still unknown after primary pass. Running strict retry.');
    const strictRetry = await classifyIssueTypeStrict({
      endpoint,
      imageBase64: params.imageBase64,
      mimeType: params.mimeType,
      reportText: params.reportText,
    });
    if (strictRetry !== 'unknown') {
      issueType = strictRetry;
    }
    logGemini('Strict retry completed', { strictRetry, finalIssueType: issueType });
  }

  const finalConfidence = issueType === 'unknown'
    ? Math.min(normalizedConfidence, 0.35)
    : normalizedConfidence;
  const shouldRequestClearImage = issueType === 'unknown' || finalConfidence < 0.75;

  logGemini('Detection finished', {
    issueType,
    severity: normalizeSeverity(severityValue),
    aiDescription: typeof rawAiDescription === 'string' ? rawAiDescription.slice(0, 120) : null,
    confidence: finalConfidence,
    shouldRequestClearImage,
  });

  if (shouldRequestClearImage) {
    return {
      issueType: 'unknown',
      severity: DEFAULT_DETECTION.severity,
      aiDescription: typeof rawAiDescription === 'string' && rawAiDescription.trim().length
        ? rawAiDescription.trim().slice(0, 200)
        : DEFAULT_DETECTION.aiDescription,
      confidence: finalConfidence,
      diagnosticCode: 'low_confidence',
    };
  }

  return {
    issueType,
    severity: normalizeSeverity(severityValue),
    aiDescription:
      typeof rawAiDescription === 'string' && rawAiDescription.trim().length
        ? rawAiDescription.trim().slice(0, 200)
        : DEFAULT_DETECTION.aiDescription,
    confidence: finalConfidence,
    diagnosticCode: 'ok',
  };
}
