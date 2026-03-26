import { GoogleGenerativeAI } from "@google/generative-ai";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TYPESCRIPT INTERFACES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export interface GeminiImageResult {
  detected: boolean;
  issueType: string | null;
  confidence: number;
  severity: number;
  description: string;
  department: string | null;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  reasoning: string;
}

const ALLOWED_ISSUE_TYPES = new Set([
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

const ISSUE_TYPE_ALIASES: Record<string, string> = {
  garbage: 'garbage_overflow',
  garbage_overflow: 'garbage_overflow',
  illegal_dump: 'illegal_dumping',
  illegal_dumping: 'illegal_dumping',
  dump: 'illegal_dumping',
  streetlight: 'broken_streetlight',
  broken_streetlight: 'broken_streetlight',
  street_light: 'broken_streetlight',
  water: 'water_leakage',
  water_leakage: 'water_leakage',
  leakage: 'water_leakage',
  pothole: 'pothole',
  fallen_tree: 'fallen_tree',
  tree_fallen: 'fallen_tree',
  hanging_wire: 'hanging_wire',
  loose_wire: 'hanging_wire',
  park_broken_equipment: 'park_broken_equipment',
  broken_park_equipment: 'park_broken_equipment',
  public_bench_broken: 'public_bench_broken',
  broken_bench: 'public_bench_broken',
};

const ISSUE_TYPE_TO_DEPARTMENT: Record<string, string> = {
  garbage_overflow: 'sanitation',
  illegal_dumping: 'sanitation',
  pothole: 'roads',
  broken_streetlight: 'electrical',
  hanging_wire: 'electrical',
  water_leakage: 'water',
  fallen_tree: 'administration',
  park_broken_equipment: 'administration',
  public_bench_broken: 'administration',
};

function normalizeIssueType(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string') return null;
  const normalized = rawValue.toLowerCase().trim().replace(/\s+/g, '_');
  if (!normalized) return null;

  const aliased = ISSUE_TYPE_ALIASES[normalized] || normalized;
  if (!ALLOWED_ISSUE_TYPES.has(aliased)) return null;
  return aliased;
}

export interface GeminiTextResult {
  isComplaint: boolean;
  issueType: string | null;
  location: string | null;
  ward: string | null;
  area: string | null;
  landmark: string | null;
  duration: string | null;
  severity: number;
  department: string | null;
  language: string;
  summaryEnglish: string;
  summaryHindi: string;
  confidence: number;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GEMINI CLIENT INITIALIZATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
if (!apiKey) {
  console.error('VITE_GEMINI_API_KEY is not set in environment variables');
}

const client = new GoogleGenerativeAI(apiKey || '');
const MODEL_CANDIDATES = [
  'gemini-2.5-flash',
  'gemini-3-flash-preview',
];

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const errorText = (error: unknown) =>
  error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

const shouldTryNextModel = (error: unknown) => {
  const text = errorText(error);
  return text.includes('404') || text.includes('not found') || text.includes('not supported');
};

const isQuotaError = (error: unknown) => {
  const text = errorText(error);
  return text.includes('429') || text.includes('quota exceeded') || text.includes('rate limit');
};

const isApiConfigError = (error: unknown) => {
  const text = errorText(error);
  return text.includes('api key') || text.includes('permission denied') || text.includes('forbidden');
};

const generateContentWithFallback = async (input: string | Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>) => {
  let lastError: unknown;

  for (const modelName of MODEL_CANDIDATES) {
    const model = client.getGenerativeModel({ model: modelName });

    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await model.generateContent(input as any);
      } catch (error) {
        lastError = error;

        // Retry same model for transient 429/quota spikes with exponential backoff.
        if (isQuotaError(error) && attempt < 2) {
          const waitMs = 700 * Math.pow(2, attempt) + Math.floor(Math.random() * 250);
          await delay(waitMs);
          continue;
        }

        if (shouldTryNextModel(error)) break;
        if (isQuotaError(error)) break;
        throw error;
      }
    }
  }

  throw lastError || new Error('No compatible Gemini Flash model is currently available for this API key.');
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FUNCTION 1: analyzeIssueImage
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const analyzeIssueImage = async (
  imageBase64: string
): Promise<GeminiImageResult> => {
  try {
    // Extract base64 data if it has data URI prefix
    const base64Data = imageBase64.includes(',')
      ? imageBase64.split(',')[1]
      : imageBase64;

    const prompt = `You are a civic issue image classifier for Indian cities.

Analyze this image and detect if it shows a civic infrastructure problem.

Respond ONLY in this exact JSON format, no extra text:
{
  "detected": true or false,
  "issueType": "one of exactly: pothole / garbage_overflow / broken_streetlight / water_leakage / illegal_dumping / fallen_tree / hanging_wire / park_broken_equipment / public_bench_broken / null",
  "confidence": 0.0 to 1.0,
  "severity": 1 to 10,
  "description": "2-3 sentence description of what you see in English",
  "department": "one of exactly: sanitation / roads / electrical / water / administration / null",
  "urgency": "low / medium / high / critical",
  "reasoning": "why you classified it this way"
}

Classification rules:
- garbage_overflow → sanitation department
- pothole → roads department
- broken_streetlight → electrical department
- water_leakage → water department
- illegal_dumping → sanitation department
- fallen_tree / park_broken_equipment / public_bench_broken → administration department
- hanging_wire → electrical department

Severity rules:
- 1-3: Minor issue, no immediate danger
- 4-6: Moderate, needs attention soon
- 7-8: Serious, affects public safety
- 9-10: Critical emergency

Only JSON response. No markdown. No extra text.`;

    const response = await generateContentWithFallback([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Data,
        },
      },
      {
        text: prompt,
      },
    ]);

    const responseText = response.response.text();
    
    // Parse JSON response carefully
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsedResult = JSON.parse(jsonMatch[0]);
    const normalizedIssueType = normalizeIssueType(parsedResult.issueType);
    const resolvedDepartment = normalizedIssueType
      ? ISSUE_TYPE_TO_DEPARTMENT[normalizedIssueType] || null
      : null;

    // Validate and map response to interface
    const result: GeminiImageResult = {
      detected: Boolean(parsedResult.detected) && Boolean(normalizedIssueType),
      issueType: normalizedIssueType,
      confidence: Math.max(0, Math.min(1, Number(parsedResult.confidence) || 0)),
      severity: Number(parsedResult.severity) || 5,
      description: String(parsedResult.description || ''),
      department: resolvedDepartment,
      urgency: (parsedResult.urgency as 'low' | 'medium' | 'high' | 'critical') || 'low',
      reasoning: String(parsedResult.reasoning || ''),
    };

    return result;
  } catch (error) {
    if (isQuotaError(error) || isApiConfigError(error) || !apiKey) {
      return {
        detected: false,
        issueType: null,
        confidence: 0,
        severity: 5,
        description: 'Model scan is temporarily unavailable. Please try again with a clear issue photo.',
        department: null,
        urgency: 'medium',
        reasoning: 'Fallback used because model service is unavailable.',
      };
    }

    console.error('Image analysis error:', error);
    throw new Error(`Failed to analyze image: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FUNCTION 2: analyzeIssueText
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const analyzeIssueText = async (
  message: string
): Promise<GeminiTextResult> => {
  try {
    const prompt = `You are NazarAI complaint analyzer for Indian cities. Citizen sent this message in Hindi, Hinglish, or English:
'${message}'

Extract all information and respond ONLY in this exact JSON format:
{
  "isComplaint": true or false,
  "issueType": "garbage_overflow / pothole / broken_streetlight / water_leakage / illegal_dump / other / null",
  "location": "extracted location or null",
  "ward": "ward number as string or null",
  "area": "colony/sector name or null",
  "landmark": "nearby landmark or null",
  "duration": "how long problem exists or null",
  "severity": 1 to 10,
  "department": "sanitation / roads / electrical / water / administration / null",
  "language": "hindi / hinglish / english",
  "summaryEnglish": "one sentence in English",
  "summaryHindi": "ek line Hindi mein",
  "confidence": 0.0 to 1.0
}

Only JSON. No extra text.`;

    const response = await generateContentWithFallback(prompt);
    const responseText = response.response.text();

    // Parse JSON response carefully
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsedResult = JSON.parse(jsonMatch[0]);

    // Validate and map response to interface
    const result: GeminiTextResult = {
      isComplaint: Boolean(parsedResult.isComplaint),
      issueType: parsedResult.issueType || null,
      location: parsedResult.location || null,
      ward: parsedResult.ward || null,
      area: parsedResult.area || null,
      landmark: parsedResult.landmark || null,
      duration: parsedResult.duration || null,
      severity: Number(parsedResult.severity) || 5,
      department: parsedResult.department || null,
      language: String(parsedResult.language || 'english'),
      summaryEnglish: String(parsedResult.summaryEnglish || ''),
      summaryHindi: String(parsedResult.summaryHindi || ''),
      confidence: Number(parsedResult.confidence) || 0,
    };

    return result;
  } catch (error) {
    if (isQuotaError(error) || isApiConfigError(error) || !apiKey) {
      return {
        isComplaint: false,
        issueType: null,
        location: null,
        ward: null,
        area: null,
        landmark: null,
        duration: null,
        severity: 5,
        department: null,
        language: 'english',
        summaryEnglish: 'AI analysis is temporarily unavailable. Please enter issue details manually.',
        summaryHindi: 'AI seva abhi uplabdh nahin hai. Kripya vivaran manually bharen.',
        confidence: 0,
      };
    }

    console.error('Text analysis error:', error);
    throw new Error(`Failed to analyze text: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export const chatWithBot = async (message: string): Promise<string> => {
  if (!apiKey) {
    return 'Gemini API key is missing. Please set VITE_GEMINI_API_KEY and restart the app.';
  }

  try {
    const prompt = `You are CivicBot, an AI assistant for NazarAI, a smart civic issue reporting platform for Indian cities.
Respond in the same language as the user (Hindi, Hinglish, or English) and keep responses concise and helpful.
If complaint details are provided, guide the user on issue type, likely department, and next steps.

User message: ${message}`;

    const response = await generateContentWithFallback(prompt);
    return response.response.text() || 'I could not generate a response right now.';
  } catch (error) {
    console.error('CivicBot error:', error);
    return 'Unable to process your request right now. Please try again.';
  }
};
