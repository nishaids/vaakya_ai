import { NextRequest, NextResponse } from "next/server";
import {
  callGeminiWithFallback,
  GeminiGenerateResponse,
} from "@/lib/gemini";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  ANALYZE_FETCH_TIMEOUT_MS,
  ANALYZE_MAX_OUTPUT_TOKENS,
  ANALYZE_RATE_LIMIT,
  ANALYZE_RETRY_DELAYS_MS,
  MAX_BASE64_LENGTH,
  MAX_UPLOAD_LABEL,
} from "@/lib/config";

export const runtime = "nodejs";
// Must be a literal (Next.js statically analyzes segment config) — keep in
// sync with ROUTE_MAX_DURATION_SECONDS in lib/config.ts.
export const maxDuration = 60;

const SYSTEM_PROMPT = `You are an expert Indian consumer rights and legal document analyzer.
Analyze this document carefully and return ONLY valid JSON matching this shape:

{
  "summary": {
    "type": "string describing document type",
    "parties": ["Party 1 name", "Party 2 name"],
    "date": "document date or Not specified",
    "duration": "duration or Not applicable"
  },
  "violations": [
    {
      "severity": "ILLEGAL",
      "title": "Short title of violation",
      "description": "Clear description of the problem",
      "law": "Exact Indian law section",
      "amount_recoverable": "Amount or type of relief"
    }
  ],
  "rights": [
    {
      "title": "Right name",
      "description": "What this right means",
      "law": "Exact law reference"
    }
  ],
  "legal_actions": [
    {
      "title": "Action name",
      "type": "Download",
      "description": "What this action does"
    }
  ]
}

Find ALL violations. Cite Consumer Protection Act 2019, RERA, IRDA,
RBI Master Circulars, IPC, Model Tenancy Act 2021, Rent Control Act.
Be specific. Return minimum 2 violations if any exist.
If the document is in Tamil or Hindi, still return JSON in English.`;

// Enforced via generationConfig.responseSchema so Gemini returns strict JSON
// instead of prose-wrapped markdown.
const RESPONSE_SCHEMA = {
  type: "OBJECT",
  properties: {
    summary: {
      type: "OBJECT",
      properties: {
        type: { type: "STRING" },
        parties: { type: "ARRAY", items: { type: "STRING" } },
        date: { type: "STRING" },
        duration: { type: "STRING" },
      },
      required: ["type", "parties", "date", "duration"],
    },
    violations: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          severity: { type: "STRING" },
          title: { type: "STRING" },
          description: { type: "STRING" },
          law: { type: "STRING" },
          amount_recoverable: { type: "STRING" },
        },
        required: ["severity", "title", "description", "law", "amount_recoverable"],
      },
    },
    rights: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          description: { type: "STRING" },
          law: { type: "STRING" },
        },
        required: ["title", "description", "law"],
      },
    },
    legal_actions: {
      type: "ARRAY",
      items: {
        type: "OBJECT",
        properties: {
          title: { type: "STRING" },
          type: { type: "STRING" },
          description: { type: "STRING" },
        },
        required: ["title", "type", "description"],
      },
    },
  },
  required: ["summary", "violations", "rights", "legal_actions"],
};

// Defensive fallback only — with responseMimeType: "application/json" the
// direct JSON.parse should succeed and this should rarely run.
function parseGeminiJson(rawText: string): Record<string, unknown> {
  let cleanText = rawText.trim();
  cleanText = cleanText.replace(/```json/g, "").replace(/```/g, "").trim();
  const jsonStart = cleanText.indexOf("{");
  const jsonEnd = cleanText.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error("No JSON found in response");
  }
  cleanText = cleanText.substring(jsonStart, jsonEnd + 1);
  return JSON.parse(cleanText);
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(
    `analyze:${ip}`,
    ANALYZE_RATE_LIMIT.limit,
    ANALYZE_RATE_LIMIT.windowMs
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = (await request.json()) as {
      base64Data?: unknown;
      mimeType?: unknown;
      textData?: unknown;
    };
    const base64Data =
      typeof body.base64Data === "string" ? body.base64Data : null;
    const mimeType = typeof body.mimeType === "string" ? body.mimeType : null;
    const textData = typeof body.textData === "string" ? body.textData : null;

    if (!textData && !(base64Data && mimeType)) {
      return NextResponse.json(
        { error: "Missing base64Data/mimeType or textData" },
        { status: 400 }
      );
    }

    // Vercel normally rejects oversized bodies with 413 before we run; this
    // guard covers local dev and keeps the contract explicit.
    if (base64Data && base64Data.length > MAX_BASE64_LENGTH) {
      return NextResponse.json(
        { error: `File too large. Maximum upload size is ${MAX_UPLOAD_LABEL}.` },
        { status: 413 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[VAAKYA ANALYZE] GEMINI_API_KEY is not set in this environment");
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured. Locally: add it to .env.local. On Vercel: set it under Project → Settings → Environment Variables (.env.local never deploys).",
        },
        { status: 500 }
      );
    }

    console.log("[VAAKYA ANALYZE] Starting document analysis...");

    const documentPart = textData
      ? { text: `Document text to analyze:\n\n${textData}` }
      : { inline_data: { mime_type: mimeType, data: base64Data } };

    const result = await callGeminiWithFallback({
      apiKey,
      endpoint: "generateContent",
      body: {
        contents: [{ parts: [documentPart, { text: SYSTEM_PROMPT }] }],
        generationConfig: {
          maxOutputTokens: ANALYZE_MAX_OUTPUT_TOKENS,
          temperature: 0.1,
          responseMimeType: "application/json",
          responseSchema: RESPONSE_SCHEMA,
        },
      },
      timeoutMs: ANALYZE_FETCH_TIMEOUT_MS,
      retryDelaysMs: ANALYZE_RETRY_DELAYS_MS,
      logTag: "VAAKYA ANALYZE",
    });

    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status }
      );
    }

    const data = (await result.response.json()) as GeminiGenerateResponse;

    // Legal documents can trip safety filters — surface that clearly instead
    // of a generic "empty response".
    const blockReason = data.promptFeedback?.blockReason;
    if (blockReason) {
      console.error(`[VAAKYA ANALYZE] Prompt blocked: ${blockReason}`);
      return NextResponse.json(
        {
          error: `This document could not be analyzed (blocked by content filter: ${blockReason}). Please try a different document.`,
        },
        { status: 422 }
      );
    }

    const candidate = data.candidates?.[0];
    if (!candidate) {
      console.error(
        "[VAAKYA ANALYZE] No candidates in response:",
        JSON.stringify(data).substring(0, 300)
      );
      return NextResponse.json(
        { error: "This document could not be analyzed. Please try a clearer copy or a different document." },
        { status: 422 }
      );
    }

    if (candidate.finishReason === "MAX_TOKENS") {
      console.error("[VAAKYA ANALYZE] Response truncated at MAX_TOKENS");
      return NextResponse.json(
        { error: "The analysis was too long and was cut off. Please try a shorter document." },
        { status: 502 }
      );
    }

    const rawText = (candidate.content?.parts ?? [])
      .map((p) => p.text ?? "")
      .join("");
    if (!rawText) {
      console.error(
        "[VAAKYA ANALYZE] No text in candidate:",
        JSON.stringify(data).substring(0, 300)
      );
      return NextResponse.json(
        { error: "This document could not be analyzed. Please try a different document." },
        { status: 422 }
      );
    }

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = parseGeminiJson(rawText);
    }

    console.log(`[VAAKYA ANALYZE] ✅ Parsed analysis (model=${result.model})`);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error("[VAAKYA ANALYZE] Server error:", error);
    return NextResponse.json(
      { error: "Internal server error", message: String(error) },
      { status: 500 }
    );
  }
}
