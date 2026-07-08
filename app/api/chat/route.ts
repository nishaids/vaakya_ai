import { NextRequest, NextResponse } from "next/server";
import { callGeminiWithFallback } from "@/lib/gemini";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import {
  CHAT_FETCH_TIMEOUT_MS,
  CHAT_MAX_OUTPUT_TOKENS,
  CHAT_RATE_LIMIT,
  CHAT_RETRY_DELAYS_MS,
} from "@/lib/config";

export const runtime = "nodejs";
// Must be a literal (Next.js statically analyzes segment config) — keep in
// sync with ROUTE_MAX_DURATION_SECONDS in lib/config.ts.
export const maxDuration = 60;

const SYSTEM_INSTRUCTION = `You are VAAKYA Assistant, an expert AI legal rights advisor for India.

VAAKYA AI facts:
- Analyzes: rental agreements, insurance rejections, bank statements, job offers, utility bills
- 4 agents: DRISHTI (OCR), NYAYA (Rights Analyzer), SATYA (Fraud Detector), SHAKTI (Action)
- Laws: Consumer Protection Act 2019, RERA, IRDA, RBI Circulars, IPC, Model Tenancy Act 2021
- Generates legal notices, pre-fills eDaakhil forms
- Free, 15 seconds, 12 Indian languages

Rules:
- Answer ANY question the user asks, whether about VAAKYA or Indian law
- Be helpful, accurate, and cite specific law sections
- Keep answers under 5 sentences for simple questions
- For complex questions, give detailed step-by-step answers
- IMPORTANT: Detect the user's language from their message and respond in the SAME language
- If user writes in Tamil, respond in Tamil
- If user writes in Hindi, respond in Hindi
- If user writes in English, respond in English
- Always end with an actionable next step or suggestion
- Never refuse to answer legal rights questions
- For very complex cases, recommend uploading to VAAKYA for precise analysis`;

export async function POST(request: NextRequest) {
  const ip = getClientIp(request.headers);
  const rate = checkRateLimit(
    `chat:${ip}`,
    CHAT_RATE_LIMIT.limit,
    CHAT_RATE_LIMIT.windowMs
  );
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Too many messages. Please wait a minute and try again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } }
    );
  }

  try {
    const body = await request.json();
    const { messages } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: "Missing messages array" }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error("[VAAKYA CHAT] GEMINI_API_KEY is not set in this environment");
      return NextResponse.json(
        {
          error:
            "GEMINI_API_KEY is not configured. Locally: add it to .env.local. On Vercel: set it under Project → Settings → Environment Variables (.env.local never deploys).",
        },
        { status: 500 }
      );
    }

    const result = await callGeminiWithFallback({
      apiKey,
      endpoint: "streamGenerateContent",
      sse: true,
      body: {
        system_instruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
        contents: messages,
        generationConfig: {
          maxOutputTokens: CHAT_MAX_OUTPUT_TOKENS,
          temperature: 0.7,
        },
      },
      timeoutMs: CHAT_FETCH_TIMEOUT_MS,
      retryDelaysMs: CHAT_RETRY_DELAYS_MS,
      logTag: "VAAKYA CHAT",
    });

    if (!result.ok) {
      // 429 gets a specific body so the client can show "high traffic".
      return NextResponse.json(
        { error: result.error, details: result.details },
        { status: result.status }
      );
    }

    const upstream = result.response.body;
    if (!upstream) {
      return NextResponse.json(
        { error: "Empty stream from Gemini" },
        { status: 502 }
      );
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = upstream.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";
            for (const line of lines) {
              if (!line.startsWith("data: ")) continue;
              const json = line.slice(6).trim();
              if (!json || json === "[DONE]") continue;
              try {
                const parsed = JSON.parse(json);
                const text = parsed?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (text) controller.enqueue(encoder.encode(text));
              } catch {}
            }
          }
        } catch (err) {
          // Upstream aborted mid-stream (e.g. fetch timeout) — end what we have.
          console.error("[VAAKYA CHAT] Stream interrupted:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: { "Content-Type": "text/plain; charset=utf-8" },
    });
  } catch (error) {
    console.error("[VAAKYA CHAT] Error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
