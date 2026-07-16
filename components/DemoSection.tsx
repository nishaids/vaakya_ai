"use client";

import React, { useState, useCallback, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload,
  FileText,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
  Check,
  ExternalLink,
} from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";
import { downloadLegalNotice, downloadFullReport } from "@/lib/generatePDF";
import {
  INLINE_UPLOAD_MIME_TYPES,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_LABEL,
  TEXT_UPLOAD_EXTENSIONS,
  UPLOAD_ACCEPT_ATTR,
} from "@/lib/config";

const sampleDocuments: { label: string; type: string; id: string; isTamil?: boolean }[] = [
  { label: "sample1", type: "rental", id: "sample-rental" },
  { label: "sample2", type: "insurance", id: "sample-insurance" },
  { label: "sample3", type: "bank", id: "sample-bank" },
  { label: "sampleTamil", type: "rental-ta", id: "sample-tamil", isTamil: true },
];

const agentSteps = [
  { agent: "DRISHTI", task: "Reading document...", delay: 0, color: "#0EA5E9" },
  { agent: "NYAYA", task: "Checking 50,000+ laws...", delay: 1500, color: "#F59E0B" },
  { agent: "SATYA", task: "Detecting violations...", delay: 3000, color: "#EF4444" },
  { agent: "SHAKTI", task: "Drafting legal actions...", delay: 4500, color: "#10B981" },
];

interface GeminiViolation {
  severity: string;
  title: string;
  description: string;
  law: string;
  amount_recoverable: string;
}

interface GeminiRight {
  title: string;
  description: string;
  law: string;
}

interface GeminiAction {
  title: string;
  type: string;
  description: string;
  url?: string;
}

interface GeminiResponse {
  summary: {
    type: string;
    parties: string[];
    date: string;
    duration: string;
  };
  violations: GeminiViolation[];
  rights: GeminiRight[];
  legal_actions: GeminiAction[];
}

const sampleData: Record<string, GeminiResponse> = {
  rental: {
    summary: {
      type: "Residential Rental Agreement",
      parties: ["Ramesh Kumar (Landlord)", "Priya Venkatesh (Tenant)"],
      date: "January 2026",
      duration: "11 months",
    },
    violations: [
      {
        severity: "ILLEGAL",
        title: "Illegal Security Deposit",
        description:
          "Security deposit of ₹45,000 equals 3 months rent — exceeds the 2-month legal maximum",
        law: "Model Tenancy Act 2021, Section 11(2)",
        amount_recoverable: "₹15,000",
      },
      {
        severity: "ILLEGAL",
        title: "No Notice Period for Landlord Entry",
        description:
          "Clause 8 permits landlord entry without prior notice — this clause is void under law",
        law: "Model Tenancy Act 2021, Section 17",
        amount_recoverable: "Injunction Relief",
      },
      {
        severity: "SUSPICIOUS",
        title: "Unilateral Rent Hike Clause",
        description:
          "Clause 14 allows landlord to raise rent by any amount with just 7 days notice — legally unconscionable",
        law: "Rent Control Act, Section 9",
        amount_recoverable: "Negotiable",
      },
    ],
    rights: [
      {
        title: "Right to Peaceful Enjoyment",
        description:
          "Landlord cannot enter without 24-hour written notice except in genuine emergency",
        law: "Model Tenancy Act 2021, Section 17",
      },
      {
        title: "Security Deposit Recovery Right",
        description:
          "Full deposit must be returned within 1 month of vacating, minus documented deductions only",
        law: "Model Tenancy Act 2021, Section 11(4)",
      },
    ],
    legal_actions: [
      {
        title: "Legal Notice to Landlord",
        type: "Download",
        description: "Demand ₹15,000 excess deposit refund within 15 days",
      },
      {
        title: "Rent Authority Complaint",
        type: "File Now",
        description:
          "File at District Rent Authority — mandatory resolution in 60 days",
        url: "https://www.mhrera.com",
      },
      {
        title: "Consumer Court Filing",
        type: "View Draft",
        description:
          "eDaakhil complaint — claim ₹15,000 + ₹10,000 compensation for harassment",
      },
    ],
  },
  insurance: {
    summary: {
      type: "Health Insurance Claim Rejection Letter",
      parties: ["Star Health Insurance Ltd", "Arjun Sharma (Policyholder)"],
      date: "March 2026",
      duration: "Policy No. SH-2024-88421",
    },
    violations: [
      {
        severity: "ILLEGAL",
        title: "Wrongful Pre-existing Condition Rejection",
        description:
          "Claim rejected citing pre-existing condition that was disclosed at policy inception — rejection is legally invalid",
        law: "IRDA Circular IRDA/HLT/REG/CIR/200/09/2020, Clause 5.3",
        amount_recoverable: "₹85,000 (full claim)",
      },
      {
        severity: "ILLEGAL",
        title: "Missing Appeal Timeline",
        description:
          "Rejection letter does not state reason code or appeal deadline — mandatory IRDA disclosure violated",
        law: "IRDAI Health Insurance Regulations 2016, Regulation 17",
        amount_recoverable: "₹5,000 penalty",
      },
      {
        severity: "WARNING",
        title: "Undefined Medical Term Used",
        description:
          'Rejection cites \'metabolic disorder\' — term not defined anywhere in the policy document',
        law: "Consumer Protection Act 2019, Section 2(47)",
        amount_recoverable: "Negotiable",
      },
    ],
    rights: [
      {
        title: "Right to Appeal Rejection",
        description:
          "Insurer must provide 30-day appeal window and respond within 15 days of receiving your appeal",
        law: "IRDAI Grievance Regulations 2017",
      },
      {
        title: "Free Insurance Ombudsman Escalation",
        description:
          "Escalate to Insurance Ombudsman at zero cost — binding resolution within 3 months guaranteed",
        law: "Ombudsman Rules 2017, Rule 14",
      },
    ],
    legal_actions: [
      {
        title: "IRDA Grievance Portal",
        type: "File Now",
        description: "File online — insurer must respond within 15 days by law",
        url: "https://igms.irda.gov.in",
      },
      {
        title: "Insurance Ombudsman",
        type: "File Now",
        description:
          "Chennai jurisdiction — free filing, binding order within 3 months",
        url: "https:// cioins.co.in",
      },
      {
        title: "Consumer Court Complaint",
        type: "View Draft",
        description: "Claim ₹85,000 + ₹25,000 mental agony compensation",
      },
    ],
  },
  bank: {
    summary: {
      type: "Home Loan EMI Statement",
      parties: ["HDFC Bank Ltd", "Meena Krishnamurthy (Borrower)"],
      date: "Q1 2026",
      duration: "Loan A/C HL-2021-49382",
    },
    violations: [
      {
        severity: "ILLEGAL",
        title: "Illegal Foreclosure Penalty",
        description:
          "₹8,500 prepayment penalty charged on floating rate home loan — banned by RBI since 2012 for individual borrowers",
        law: "RBI Master Circular DBOD.No.Dir.BC.9/13.03.00/2012-13",
        amount_recoverable: "₹8,500",
      },
      {
        severity: "ILLEGAL",
        title: "Undisclosed Processing Fee",
        description:
          "₹2,340 processing fee deducted in Month 14 with no prior written consent or intimation",
        law: "RBI Fair Practices Code 2010, Clause 4(ii)",
        amount_recoverable: "₹2,340",
      },
      {
        severity: "WARNING",
        title: "EMI Change Without Notice",
        description:
          "EMI amount increased in October 2025 with no 30-day prior written intimation to borrower",
        law: "RBI Customer Service Guidelines 2022",
        amount_recoverable: "Refund of excess EMI",
      },
    ],
    rights: [
      {
        title: "Zero Prepayment Penalty Right",
        description:
          "RBI mandates absolutely no foreclosure charges on floating rate home loans for individual borrowers",
        law: "RBI Circular 2012 — effective immediately, no exceptions",
      },
      {
        title: "Full Statement on Demand",
        description:
          "Bank must provide complete amortization schedule and fee breakdown within 7 working days of written request",
        law: "RBI Customer Service Guidelines 2022, Section 3",
      },
    ],
    legal_actions: [
      {
        title: "RBI Banking Ombudsman",
        type: "File Now",
        description:
          "File online — resolution in 30 days, RBI issues binding order to bank",
        url: "https://cms.rbi.org.in",
      },
      {
        title: "Legal Notice to HDFC Bank",
        type: "Download",
        description:
          "Demand ₹10,840 full refund (penalty + fee) within 15 days or face consumer court",
      },
      {
        title: "Consumer Court Filing",
        type: "View Draft",
        description:
          "Claim ₹10,840 + ₹15,000 compensation for deficiency in banking service",
      },
    ],
  },
  "rental-ta": {
    summary: {
      type: "Residential Rental Agreement",
      parties: ["ரமேஷ் குமார் (வீட்டு உரிமையாளர்)", "பிரியா வெங்கடேஷ் (குத்தகைதாரர்)"],
      date: "January 2026",
      duration: "11 months",
    },
    violations: [
      {
        severity: "ILLEGAL",
        title: "Illegal Security Deposit",
        description:
          "Security deposit of ₹45,000 equals 3 months rent — exceeds the 2-month legal maximum",
        law: "Model Tenancy Act 2021, Section 11(2)",
        amount_recoverable: "₹15,000",
      },
      {
        severity: "ILLEGAL",
        title: "No Notice Period for Landlord Entry",
        description:
          "Clause 8 permits landlord entry without prior notice — this clause is void under law",
        law: "Model Tenancy Act 2021, Section 17",
        amount_recoverable: "Injunction Relief",
      },
      {
        severity: "SUSPICIOUS",
        title: "Unilateral Rent Hike Clause",
        description:
          "Clause 14 allows landlord to raise rent by any amount with just 7 days notice — legally unconscionable",
        law: "Rent Control Act, Section 9",
        amount_recoverable: "Negotiable",
      },
    ],
    rights: [
      {
        title: "Right to Peaceful Enjoyment",
        description:
          "Landlord cannot enter without 24-hour written notice except in genuine emergency",
        law: "Model Tenancy Act 2021, Section 17",
      },
      {
        title: "Security Deposit Recovery Right",
        description:
          "Full deposit must be returned within 1 month of vacating, minus documented deductions only",
        law: "Model Tenancy Act 2021, Section 11(4)",
      },
    ],
    legal_actions: [
      {
        title: "Legal Notice to Landlord",
        type: "Download",
        description: "Demand ₹15,000 excess deposit refund within 15 days",
      },
      {
        title: "Rent Authority Complaint",
        type: "File Now",
        description:
          "File at District Rent Authority — mandatory resolution in 60 days",
        url: "https://www.mhrera.com",
      },
      {
        title: "Consumer Court Filing",
        type: "View Draft",
        description:
          "eDaakhil complaint — claim ₹15,000 + ₹10,000 compensation for harassment",
      },
    ],
  },
};

function getRecoverableTotal(violations: GeminiViolation[]): number {
  return violations.reduce((sum, v) => {
    const match = v.amount_recoverable.match(/₹([\d,]+)/);
    if (match) {
      return sum + parseInt(match[1].replace(/,/g, ""), 10);
    }
    return sum;
  }, 0);
}

function getSeverityColors(severity: string) {
  switch (severity) {
    case "ILLEGAL":
      return {
        bg: "rgba(239,68,68,0.07)",
        border: "#EF4444",
        badge: "rgba(239,68,68,0.15)",
        badgeText: "#EF4444",
        badgeBorder: "rgba(239,68,68,0.3)",
        icon: "🚨",
      };
    case "SUSPICIOUS":
      return {
        bg: "rgba(245,158,11,0.07)",
        border: "#F59E0B",
        badge: "rgba(245,158,11,0.15)",
        badgeText: "#F59E0B",
        badgeBorder: "rgba(245,158,11,0.3)",
        icon: "⚠",
      };
    case "WARNING":
      return {
        bg: "rgba(234,179,8,0.07)",
        border: "#EAB308",
        badge: "rgba(234,179,8,0.15)",
        badgeText: "#EAB308",
        badgeBorder: "rgba(234,179,8,0.3)",
        icon: "ℹ",
      };
    default:
      return {
        bg: "rgba(239,68,68,0.07)",
        border: "#EF4444",
        badge: "rgba(239,68,68,0.15)",
        badgeText: "#EF4444",
        badgeBorder: "rgba(239,68,68,0.3)",
        icon: "🚨",
      };
  }
}

function ShimmerCard() {
  return (
    <div className="bg-bg-card/30 border border-white/[0.06] rounded-[20px] p-6">
      <div className="animate-pulse space-y-4">
        <div className="h-4 bg-white/[0.08] rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-3 bg-white/[0.05] rounded w-full" />
          <div className="h-3 bg-white/[0.05] rounded w-5/6" />
          <div className="h-3 bg-white/[0.05] rounded w-4/5" />
        </div>
        <div className="h-4 bg-white/[0.08] rounded w-1/4 mt-6" />
        <div className="space-y-2">
          <div className="h-12 bg-white/[0.04] rounded-xl" />
          <div className="h-12 bg-white/[0.04] rounded-xl" />
        </div>
      </div>
    </div>
  );
}



type UploadKind =
  | { kind: "inline"; mimeType: string }
  | { kind: "text" }
  | { kind: "unsupported" };

function classifyUpload(file: File): UploadKind {
  const ext = file.name.toLowerCase().split(".").pop() ?? "";
  const mimeType = INLINE_UPLOAD_MIME_TYPES[ext];
  if (mimeType) return { kind: "inline", mimeType };
  if (TEXT_UPLOAD_EXTENSIONS.includes(ext)) return { kind: "text" };
  return { kind: "unsupported" };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1]);
    };
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsDataURL(file);
  });
}

function fileToText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('FileReader failed'));
    reader.readAsText(file);
  });
}

type AnalyzePayload =
  | { base64Data: string; mimeType: string }
  | { textData: string };

class AnalyzeApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = "AnalyzeApiError";
  }
}

function analyzeErrorMessage(status: number, serverMessage?: string): string {
  switch (status) {
    case 413:
      return `This file is too large for online analysis. Please upload a file under ${MAX_UPLOAD_LABEL}.`;
    case 429:
      return "Too many requests right now — please wait a minute and try again.";
    case 422:
      // The server sends a specific reason (e.g. unsupported document type
      // with what it detected) — show it verbatim.
      return serverMessage || "This document couldn't be analyzed. Try a clearer scan or a different file.";
    case 503:
      return "The AI models are temporarily unavailable. Please try again later.";
    case 504:
      return "The analysis timed out. Please try again.";
    default:
      return serverMessage || `Analysis failed (error ${status}).`;
  }
}

async function analyzeWithGemini(payload: AnalyzePayload): Promise<GeminiResponse> {
  console.log('[VAAKYA] Calling backend /api/analyze —', 'textData' in payload ? 'text upload' : `mimeType: ${payload.mimeType}`);

  let response: Response;
  try {
    response = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error('[VAAKYA] Network error calling /api/analyze:', err);
    throw new AnalyzeApiError("Could not reach the analysis server. Check your connection and try again.", 0);
  }

  console.log('[VAAKYA] Backend response status:', response.status);

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
    console.error('[VAAKYA] Backend error:', response.status, errorData);
    throw new AnalyzeApiError(
      analyzeErrorMessage(response.status, typeof errorData.error === "string" ? errorData.error : undefined),
      response.status
    );
  }

  const parsed = await response.json();
  console.log('[VAAKYA] ✅ Got parsed analysis from backend:', JSON.stringify(parsed).substring(0, 200));
  return parsed as GeminiResponse;
}

const thinkingLogLines = [
  { text: "> VAAKYA AI v2.0 — Initializing agents...", delay: 0, color: "#8B5CF6" },
  { text: "> DRISHTI [OCR Agent] → Receiving document...", delay: 400, color: "#0EA5E9" },
  { text: "> DRISHTI → Parsing document structure...", delay: 900, color: "#0EA5E9" },
  { text: "> DRISHTI → Language detected: English [confidence: 0.98]", delay: 1400, color: "#0EA5E9" },
  { text: "> DRISHTI → Text extraction complete — 847 tokens", delay: 1900, color: "#0EA5E9" },
  { text: "> NYAYA [Rights Analyzer] → Querying legal database...", delay: 2300, color: "#F59E0B" },
  { text: "> NYAYA → Checking Consumer Protection Act 2019...", delay: 2800, color: "#F59E0B" },
  { text: "> NYAYA → Checking IRDAI Health Insurance Regulations...", delay: 3200, color: "#F59E0B" },
  { text: "> NYAYA → Cross-referencing 50,000+ court precedents...", delay: 3700, color: "#F59E0B" },
  { text: "> SATYA [Fraud Detector] → Scanning for violations...", delay: 4100, color: "#EF4444" },
  { text: "> SATYA → ILLEGAL clause detected [severity: HIGH]", delay: 4500, color: "#EF4444" },
  { text: "> SATYA → ILLEGAL clause detected [severity: HIGH]", delay: 4900, color: "#EF4444" },
  { text: "> SATYA → WARNING clause detected [severity: LOW]", delay: 5200, color: "#EF4444" },
  { text: "> SHAKTI [Action Agent] → Drafting legal notice...", delay: 5500, color: "#10B981" },
  { text: "> SHAKTI → Pre-filling eDaakhil complaint form...", delay: 5900, color: "#10B981" },
  { text: "> SHAKTI → Generating consumer court filing...", delay: 6200, color: "#10B981" },
  { text: "> ✓ Analysis complete in 6.6 seconds", delay: 6600, color: "#8B5CF6" },
  { text: "> ✓ 3 violations found | 2 rights identified | 3 actions ready", delay: 7000, color: "#8B5CF6" },
];

function AgentThinkingLog({ onComplete }: { onComplete?: () => void }) {
  const [lines, setLines] = useState<{ text: string; color: string; typed: boolean }[]>([]);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);
  const [currentCharIndex, setCurrentCharIndex] = useState(0);
  const logContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeouts: NodeJS.Timeout[] = [];

    thinkingLogLines.forEach((line, idx) => {
      const t1 = setTimeout(() => {
        setCurrentLineIndex(idx);
        setCurrentCharIndex(0);
      }, line.delay);
      timeouts.push(t1);

      const t2 = setTimeout(() => {
        setLines((prev) => [...prev, { text: line.text, color: line.color, typed: true }]);
        setCurrentLineIndex(-1);
        if (logContainerRef.current) {
          logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
        }
        if (idx === thinkingLogLines.length - 1 && onComplete) {
          setTimeout(onComplete, 500);
        }
      }, line.delay + 400);
      timeouts.push(t2);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [onComplete]);

  useEffect(() => {
    if (currentLineIndex >= 0) {
      const lineText = thinkingLogLines[currentLineIndex].text;
      if (currentCharIndex < lineText.length) {
        const t = setTimeout(() => {
          setCurrentCharIndex((prev) => prev + 1);
        }, 15);
        return () => clearTimeout(t);
      }
    }
  }, [currentLineIndex, currentCharIndex]);

  return (
    <div
      ref={logContainerRef}
      className="bg-[#030409] border border-[rgba(139,92,246,0.3)] rounded-[12px] p-5 overflow-y-auto"
      style={{
        maxHeight: "320px",
        fontFamily: "var(--font-ibm-plex), monospace",
        fontSize: "12px",
      }}
    >
      {lines.map((line, idx) => (
        <div key={idx} className="mb-1" style={{ color: line.color }}>
          {line.text}
        </div>
      ))}
      {currentLineIndex >= 0 && (
        <div style={{ color: thinkingLogLines[currentLineIndex].color }}>
          {thinkingLogLines[currentLineIndex].text.slice(0, currentCharIndex)}
          <span className="animate-pulse">▋</span>
        </div>
      )}
    </div>
  );
}

export default function DemoSection() {
  const { t, lang } = useLanguage();
  const [activeDemo, setActiveDemo] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [showResults, setShowResults] = useState(false);
  const [showThinkingLog, setShowThinkingLog] = useState(false);
  const [expandedSections, setExpandedSections] = useState<number[]>([0, 1, 2]);
  const [results, setResults] = useState<GeminiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  // True while the document is being sent to the API and analyzed — shows the
  // live progress panel immediately so users know work is happening.
  const [isUploading, setIsUploading] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const timeoutsRef = useRef<NodeJS.Timeout[]>([]);

  const clearAllTimeouts = useCallback(() => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  }, []);

  const runAnalysisSequence = useCallback(
    (data: GeminiResponse) => {
      clearAllTimeouts();
      setIsAnalyzing(true);
      setCompletedSteps([]);
      setActiveStep(-1);
      setShowResults(false);
      setShowThinkingLog(true);
      setExpandedSections([0, 1, 2]);
      setResults(null);

      const finishTimeout = setTimeout(() => {
        setShowThinkingLog(false);
        setIsAnalyzing(false);
        setResults(data);
        setShowResults(true);
      }, 7500);
      timeoutsRef.current.push(finishTimeout);
    },
    [clearAllTimeouts]
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (isUploading) return;
      setError(null);
      setActiveDemo("upload");

      const upload = classifyUpload(file);
      if (upload.kind === "unsupported") {
        setError("Unsupported file type. Please upload a PDF, JPG, PNG, WEBP, or TXT file.");
        return;
      }
      // Vercel serverless rejects request bodies over ~4.5MB, and base64
      // inflates files ~33% — so cap uploads before they ever leave the browser.
      if (file.size > MAX_UPLOAD_BYTES) {
        setError(`File too large. Please upload a file under ${MAX_UPLOAD_LABEL}.`);
        return;
      }

      console.log('[VAAKYA] Uploading file:', file.name, 'size:', file.size, 'type:', file.type);

      // Clear any previous results right away and show the progress panel so
      // the user sees the upload was received and analysis is running.
      clearAllTimeouts();
      setShowResults(false);
      setResults(null);
      setShowThinkingLog(false);
      setIsAnalyzing(false);
      setUploadedFileName(file.name);
      setIsUploading(true);

      try {
        const payload: AnalyzePayload =
          upload.kind === "text"
            ? { textData: await fileToText(file) }
            : { base64Data: await fileToBase64(file), mimeType: upload.mimeType };
        const data = await analyzeWithGemini(payload);
        console.log('[VAAKYA] ✅ Gemini returned real analysis results:', JSON.stringify(data).substring(0, 200));
        setIsUploading(false);
        runAnalysisSequence(data);
      } catch (err: unknown) {
        console.error('[VAAKYA] ❌ Document analysis failed:', err);
        if (err instanceof Error) {
          console.error('[VAAKYA] Error message:', err.message);
          console.error('[VAAKYA] Error stack:', err.stack);
        }
        const message =
          err instanceof AnalyzeApiError
            ? err.message
            : "Could not analyze your document. Please try again.";
        // Never show fabricated results for a real upload — surface the real
        // reason and return to the empty state so the user can retry.
        setIsUploading(false);
        setUploadedFileName(null);
        setActiveDemo(null);
        setError(message);
        setTimeout(() => setError(null), 12000);
      }
    },
    [runAnalysisSequence, clearAllTimeouts, isUploading]
  );

  const handleNewUpload = useCallback(() => {
    clearAllTimeouts();
    setShowResults(false);
    setResults(null);
    setShowThinkingLog(false);
    setIsAnalyzing(false);
    setIsUploading(false);
    setActiveDemo(null);
    setError(null);
    setUploadedFileName(null);
    fileInputRef.current?.click();
  }, [clearAllTimeouts]);

  const startDemo = useCallback(
    (type: string) => {
      setActiveDemo(type);
      setError(null);
      const data = sampleData[type] || sampleData.rental;
      runAnalysisSequence(data);
    },
    [runAnalysisSequence]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      const file = e.dataTransfer.files[0];
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      // Reset so picking the same file again still fires onChange.
      e.target.value = "";
      if (file) handleFileUpload(file);
    },
    [handleFileUpload]
  );

  const toggleSection = (idx: number) => {
    setExpandedSections((prev) =>
      prev.includes(idx) ? prev.filter((s) => s !== idx) : [...prev, idx]
    );
  };

  const handleActionClick = (action: GeminiAction) => {
    if (!results) return;
    if (action.type === "File Now" && action.url) {
      window.open(action.url, "_blank");
    } else {
      downloadLegalNotice(
        { title: action.title, type: action.type, description: action.description },
        results.summary,
        results.violations
      );
    }
  };

  return (
    <section
      id="demo"
      className="relative py-32 bg-bg-secondary overflow-hidden"
    >
      <div className="max-w-7xl mx-auto px-6">
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-[12px] font-semibold tracking-[1.2px] uppercase text-text-secondary font-body text-center mb-6"
        >
          {t("demoLabel")}
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="font-display text-[36px] sm:text-[44px] md:text-[52px] font-[800] leading-[1.15] text-text-primary text-center mb-16"
        >
          {t("demoHeading")}
        </motion.h2>

        {/* Error toast */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="mb-6 mx-auto max-w-md bg-accent-secondary/10 border border-accent-secondary/30 rounded-xl p-4 flex items-center gap-3"
            >
              <AlertTriangle className="w-5 h-5 text-accent-secondary flex-shrink-0" />
              <span className="font-body text-[13px] text-accent-secondary">
                {error}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid grid-cols-1 lg:grid-cols-[45%_55%] gap-8">
          {/* Left panel — Upload */}
          <div>
            <h3 className="font-display text-[24px] font-bold text-text-primary mb-6">
              {t("dropTitle")}
            </h3>

            <input
              ref={fileInputRef}
              type="file"
              accept={UPLOAD_ACCEPT_ATTR}
              onChange={handleFileSelect}
              className="hidden"
            />

            <div
              onClick={() => !isUploading && fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className={`upload-zone relative border-2 border-dashed border-accent-primary/30 rounded-[20px] min-h-[200px] flex flex-col items-center justify-center gap-4 bg-accent-primary/[0.03] transition-all duration-300 group mb-6 ${
                isUploading
                  ? "opacity-60 cursor-wait"
                  : "hover:bg-accent-primary/[0.08] hover:border-solid hover:border-accent-primary/60 hover:scale-[1.01] cursor-pointer"
              }`}
            >
              <span className="corner-tl border-accent-primary/30" />
              <span className="corner-tr border-accent-primary/30" />
              {isUploading ? (
                <>
                  <div
                    className="w-8 h-8 border-[3px] rounded-full animate-spin"
                    style={{ borderColor: "#8B5CF6", borderTopColor: "transparent" }}
                  />
                  <div className="text-center">
                    <p className="text-text-primary text-[14px] font-body font-semibold">
                      Analyzing your document…
                    </p>
                    <p className="text-text-muted text-[12px] font-body mt-1">
                      Working in the background — usually 10–30 seconds
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-accent-primary/50 group-hover:text-accent-primary transition-colors" />
                  <div className="text-center">
                    <p className="text-text-secondary text-[14px] font-body group-hover:text-text-primary transition-colors">
                      {t("dropMain")}
                    </p>
                    <p className="text-text-muted text-[12px] font-body mt-1">
                      {t("dropFormat")}
                    </p>
                  </div>
                </>
              )}
            </div>

            <p className="text-text-muted text-[13px] font-body mb-3">
              {t("sampleLabel")}
            </p>
            <div className="flex flex-wrap gap-2">
              {(lang === 'ta' 
                ? [...sampleDocuments].sort((a, b) => (b.isTamil ? 1 : 0) - (a.isTamil ? 1 : 0))
                : sampleDocuments.filter(d => !d.isTamil)
              ).map((doc) => (
                <button
                  key={doc.type}
                  id={doc.id}
                  onClick={() => startDemo(doc.type)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border font-body text-[13px] font-medium transition-all duration-200 min-h-[44px] ${
                    activeDemo === doc.type
                      ? "border-[#8B5CF6] text-[#8B5CF6]"
                      : doc.isTamil
                        ? "bg-bg-card/40 border-[rgba(245,158,11,0.5)] text-text-secondary hover:border-accent-primary/30 hover:text-text-primary"
                        : "bg-bg-card/40 border-white/[0.06] text-text-secondary hover:border-accent-primary/30 hover:text-text-primary"
                  }`}
                  style={
                    activeDemo === doc.type
                      ? {
                          background: "rgba(139,92,246,0.2)",
                          borderColor: "#8B5CF6",
                          color: "#8B5CF6",
                        }
                      : doc.isTamil
                        ? {
                            borderColor: "rgba(245,158,11,0.5)",
                          }
                        : undefined
                  }
                >
                  <FileText className="w-4 h-4" />
                  {t(doc.label)}
                  {doc.isTamil && <span className="text-[10px]">🇮🇳 Tamil</span>}
                </button>
              ))}
            </div>
          </div>

          {/* Right panel — Results */}
          <div className="relative min-h-[500px]">
            <AnimatePresence mode="wait">
              {!activeDemo && !isAnalyzing && !showResults && !showThinkingLog && !isUploading && (
                <motion.div
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0 rounded-[20px] bg-bg-card/20 border border-white/[0.04] grid-bg flex items-center justify-center"
                >
                  <p className="text-text-muted text-[14px] font-body">
                    {t("demoPlaceholder")}
                  </p>
                </motion.div>
              )}

              {isUploading && (
                <motion.div
                  key="uploading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-bg-card/30 border border-white/[0.06] rounded-[20px] p-6"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div
                      className="w-5 h-5 border-2 rounded-full animate-spin flex-shrink-0"
                      style={{ borderColor: "#8B5CF6", borderTopColor: "transparent" }}
                    />
                    <h4 className="font-mono text-[14px] text-accent-primary">
                      Analyzing your document…
                    </h4>
                  </div>
                  <div className="flex items-center gap-2 py-3 px-4 rounded-xl bg-bg-card/50 border border-white/[0.05] mb-3">
                    <FileText className="w-4 h-4 text-accent-primary flex-shrink-0" />
                    <span className="text-text-primary text-[13px] font-body truncate">
                      {uploadedFileName}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5 text-[12px] font-body flex-shrink-0" style={{ color: "#10B981" }}>
                      <Check className="w-3.5 h-3.5" /> Uploaded
                    </span>
                  </div>
                  <p className="text-text-secondary text-[13px] font-body leading-relaxed mb-6">
                    VAAKYA AI agents are reading every clause and checking it against
                    Indian law. This usually takes <strong>10–30 seconds</strong> —
                    please keep this page open.
                  </p>
                  <ShimmerCard />
                </motion.div>
              )}

              {showThinkingLog && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="absolute inset-0"
                >
                  <AgentThinkingLog />
                </motion.div>
              )}

              {isAnalyzing && !showThinkingLog && (
                <motion.div
                  key="analyzing"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="bg-bg-card/30 border border-white/[0.06] rounded-[20px] p-6"
                >
                  <h4 className="font-mono text-[14px] text-accent-primary mb-4">
                    Analyzing Document...
                  </h4>
                  <div className="flex flex-col gap-2">
                    {agentSteps.map((step, idx) => (
                      <motion.div
                        key={step.agent}
                        initial={{ opacity: 0, x: -20 }}
                        animate={
                          activeStep === idx || completedSteps.includes(idx)
                            ? { opacity: 1, x: 0 }
                            : { opacity: 0, x: -20 }
                        }
                        transition={{ duration: 0.4, ease: "easeOut" }}
                        className="flex items-center gap-3 py-3 px-4 rounded-xl bg-bg-card/50 border border-white/[0.05]"
                      >
                        {completedSteps.includes(idx) ? (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 500, damping: 25 }}
                          >
                            <Check className="w-4 h-4" style={{ color: "#10B981" }} />
                          </motion.div>
                        ) : activeStep === idx ? (
                          <div
                            className="w-4 h-4 border-2 rounded-full animate-spin"
                            style={{
                              borderColor: step.color,
                              borderTopColor: "transparent",
                            }}
                          />
                        ) : (
                          <div className="w-4 h-4 rounded-full bg-[#6B6880]" />
                        )}

                        <span className="font-mono text-[13px] text-accent-primary font-medium flex-shrink-0">
                          {step.agent}
                        </span>
                        <span className="text-text-secondary text-[13px] flex-1">
                          {step.task}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-6">
                    <ShimmerCard />
                  </div>
                </motion.div>
              )}

              {showResults && results && (
                <motion.div
                  key="results"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-bg-card/30 border border-white/[0.06] rounded-[20px] p-6 max-h-[700px] overflow-y-auto"
                >
                  {/* Header: analysis done + start over */}
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <span className="flex items-center gap-2 text-[13px] font-body" style={{ color: "#10B981" }}>
                      <Check className="w-4 h-4" />
                      Analysis complete
                      {uploadedFileName && activeDemo === "upload" && (
                        <span className="text-text-muted truncate max-w-[180px]">
                          — {uploadedFileName}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={handleNewUpload}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl border border-[rgba(139,92,246,0.4)] text-[#8B5CF6] hover:bg-[rgba(139,92,246,0.12)] font-body text-[13px] font-semibold transition-colors flex-shrink-0"
                    >
                      <Upload className="w-4 h-4" />
                      Upload New Document
                    </button>
                  </div>

                  {/* Summary Bar */}
                  {(() => {
                    const total = getRecoverableTotal(results.violations);
                    return (
                      <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        style={{
                          background: "rgba(239,68,68,0.1)",
                          border: "1px solid rgba(239,68,68,0.2)",
                          borderRadius: 10,
                          padding: "12px 20px",
                          display: "flex",
                          gap: 24,
                          alignItems: "center",
                          marginBottom: 16,
                        }}
                      >
                        <span
                          style={{
                            background: "rgba(239,68,68,0.15)",
                            color: "#EF4444",
                            padding: "6px 14px",
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          🚨 {results.violations.length} Violations
                        </span>
                        <span
                          style={{
                            background: "rgba(16,185,129,0.15)",
                            color: "#10B981",
                            padding: "6px 14px",
                            borderRadius: 20,
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        >
                          ✅ {results.rights.length} Rights Protected
                        </span>
                        {total > 0 && (
                          <span
                            style={{
                              background: "rgba(245,158,11,0.15)",
                              color: "#F59E0B",
                              padding: "6px 14px",
                              borderRadius: 20,
                              fontSize: 13,
                              fontWeight: 600,
                            }}
                          >
                            💰 ₹{total.toLocaleString("en-IN")} Recoverable
                          </span>
                        )}
                      </motion.div>
                    );
                  })()}

                  {/* Section A: Document Summary */}
                  <div
                    style={{
                      background: "#12111E",
                      border: "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 12,
                      padding: 20,
                      marginBottom: 20,
                    }}
                  >
                    <div className="mb-3">
                      <button
                        onClick={() => toggleSection(0)}
                        className="flex items-center justify-between w-full text-left min-h-[44px]"
                      >
                        <span
                          style={{
                            fontFamily: "var(--font-ibm-plex), monospace",
                            fontSize: 11,
                            color: "#6B6880",
                            textTransform: "uppercase",
                            letterSpacing: 1,
                          }}
                        >
                          {t("demoDocOverview")}
                        </span>
                        {expandedSections.includes(0) ? (
                          <ChevronUp className="w-4 h-4 text-text-muted" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-text-muted" />
                        )}
                      </button>
                      <AnimatePresence>
                        {expandedSections.includes(0) && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                          >
                            <div
                              className="mt-3 grid grid-cols-2 gap-3"
                              style={{ fontFamily: "var(--font-ibm-plex), monospace" }}
                            >
                              {[
                                { label: "Type", value: results.summary.type },
                                {
                                  label: "Parties",
                                  value: Array.isArray(results.summary.parties)
                                    ? results.summary.parties.join(" | ")
                                    : results.summary.parties,
                                },
                                { label: "Date", value: results.summary.date },
                                { label: "Reference", value: results.summary.duration },
                              ].map((field) => (
                                <div key={field.label}>
                                  <div
                                    style={{
                                      fontSize: 11,
                                      color: "#6B6880",
                                      textTransform: "uppercase",
                                      marginBottom: 4,
                                    }}
                                  >
                                    {field.label}
                                  </div>
                                  <div style={{ fontSize: 14, color: "#F8F7FF" }}>
                                    {field.value}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Section B: Violations */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleSection(1)}
                      className="flex items-center justify-between w-full text-left min-h-[44px] mb-3"
                    >
                      <div className="flex items-center gap-3">
                        <h4
                          style={{
                            fontSize: 16,
                            color: "#F8F7FF",
                            fontWeight: 600,
                          }}
                        >
                          ⚠ {t("demoViolations")}
                        </h4>
                        <span
                          style={{
                            background: "rgba(239,68,68,0.15)",
                            color: "#EF4444",
                            border: "1px solid rgba(239,68,68,0.3)",
                            padding: "2px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {results.violations.length} Found
                        </span>
                      </div>
                      {expandedSections.includes(1) ? (
                        <ChevronUp className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                    <AnimatePresence>
                      {expandedSections.includes(1) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 flex flex-col gap-3">
                            {results.violations.map(
                              (v: GeminiViolation, idx: number) => {
                                const colors = getSeverityColors(v.severity);
                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      background: colors.bg,
                                      borderLeft: `4px solid ${colors.border}`,
                                      borderRadius: 12,
                                      padding: "16px 20px",
                                    }}
                                  >
                                    <div className="flex items-center gap-2 mb-2">
                                      <span
                                        style={{
                                          background: colors.badge,
                                          color: colors.badgeText,
                                          border: `1px solid ${colors.badgeBorder}`,
                                          padding: "2px 10px",
                                          borderRadius: 20,
                                          fontSize: 11,
                                          fontWeight: 700,
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        {colors.icon} {v.severity}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 15,
                                          color: "#F8F7FF",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {v.title}
                                      </span>
                                    </div>
                                    <p
                                      style={{
                                        fontSize: 14,
                                        color: "#A09DB8",
                                        lineHeight: 1.6,
                                      }}
                                    >
                                      {v.description}
                                    </p>
                                    <div className="flex items-center gap-1 mt-2">
                                      <span style={{ fontSize: 13 }}>⚖</span>
                                      <span
                                        style={{
                                          fontSize: 13,
                                          color: "#6B6880",
                                          fontFamily: "var(--font-ibm-plex), monospace",
                                        }}
                                      >
                                        {v.law}
                                      </span>
                                    </div>
                                    {v.amount_recoverable && (
                                      <div
                                        className="mt-2"
                                        style={{ fontSize: 13 }}
                                      >
                                        <span>💰 Recoverable: </span>
                                        <span
                                          style={{
                                            color: "#10B981",
                                            fontWeight: 600,
                                          }}
                                        >
                                          {v.amount_recoverable}
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                );
                              }
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section C: Your Rights */}
                  <div className="mb-4">
                    <button
                      onClick={() => toggleSection(2)}
                      className="flex items-center justify-between w-full text-left min-h-[44px] mb-3"
                    >
                      <div className="flex items-center gap-3">
                        <h4
                          style={{
                            fontSize: 16,
                            color: "#F8F7FF",
                            fontWeight: 600,
                          }}
                        >
                          ✅ {t("demoRights")}
                        </h4>
                        <span
                          style={{
                            background: "rgba(16,185,129,0.15)",
                            color: "#10B981",
                            border: "1px solid rgba(16,185,129,0.3)",
                            padding: "2px 10px",
                            borderRadius: 20,
                            fontSize: 11,
                            fontWeight: 600,
                          }}
                        >
                          {results.rights.length} Protected
                        </span>
                      </div>
                      {expandedSections.includes(2) ? (
                        <ChevronUp className="w-4 h-4 text-text-muted" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-text-muted" />
                      )}
                    </button>
                    <AnimatePresence>
                      {expandedSections.includes(2) && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1 flex flex-col gap-3">
                            {results.rights.map(
                              (r: GeminiRight, idx: number) => (
                                <div
                                  key={idx}
                                  style={{
                                    background: "rgba(16,185,129,0.05)",
                                    borderLeft: "4px solid #10B981",
                                    borderRadius: 12,
                                    padding: "16px 20px",
                                  }}
                                >
                                  <p
                                    style={{
                                      fontSize: 15,
                                      color: "#F8F7FF",
                                      fontWeight: 600,
                                      marginBottom: 6,
                                    }}
                                  >
                                    {r.title}
                                  </p>
                                  <p
                                    style={{
                                      fontSize: 14,
                                      color: "#A09DB8",
                                      lineHeight: 1.6,
                                    }}
                                  >
                                    {r.description}
                                  </p>
                                  <div className="flex items-center gap-1 mt-2">
                                    <span style={{ fontSize: 13 }}>⚖</span>
                                    <span
                                      style={{
                                        fontSize: 13,
                                        color: "#6B6880",
                                        fontFamily: "var(--font-ibm-plex), monospace",
                                      }}
                                    >
                                      {r.law}
                                    </span>
                                  </div>
                                </div>
                              )
                            )}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Section D: Legal Actions */}
                  <div className="mb-6">
                    <h4
                      style={{
                        fontSize: 16,
                        color: "#F8F7FF",
                        fontWeight: 600,
                        marginBottom: 12,
                      }}
                    >
                      ⚡ {t("demoActions")}
                    </h4>
                    <div className="flex flex-col gap-3">
                      {results.legal_actions.map(
                        (a: GeminiAction, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              background: "rgba(139,92,246,0.08)",
                              border: "1px solid rgba(139,92,246,0.25)",
                              borderRadius: 12,
                              padding: "16px 20px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <div>
                              <p
                                style={{
                                  fontSize: 15,
                                  color: "#F8F7FF",
                                  fontWeight: 600,
                                }}
                              >
                                {a.title}
                              </p>
                              <p
                                style={{
                                  fontSize: 13,
                                  color: "#A09DB8",
                                  marginTop: 4,
                                }}
                              >
                                {a.description}
                              </p>
                            </div>
                            {a.type === "Download" && (
                              <button
                                onClick={() => handleActionClick(a)}
                                style={{
                                  background: "transparent",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  color: "#F8F7FF",
                                  padding: "8px 16px",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {a.type}
                              </button>
                            )}
                            {a.type === "File Now" && (
                              <button
                                onClick={() => handleActionClick(a)}
                                style={{
                                  background: "#8B5CF6",
                                  border: "none",
                                  color: "white",
                                  padding: "8px 16px",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 6,
                                }}
                              >
                                {a.type}
                                <ExternalLink className="w-3 h-3" />
                              </button>
                            )}
                            {a.type === "View Draft" && (
                              <button
                                onClick={() => handleActionClick(a)}
                                style={{
                                  background: "transparent",
                                  border: "1px solid #8B5CF6",
                                  color: "#8B5CF6",
                                  padding: "8px 16px",
                                  borderRadius: 10,
                                  fontSize: 13,
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {a.type}
                              </button>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {/* Download Full Report */}
                  <button
                    onClick={() => {
                      if (results) {
                        downloadFullReport(
                          results.summary,
                          results.violations,
                          results.rights,
                          results.legal_actions
                        );
                      }
                    }}
                    style={{
                      width: "100%",
                      background: "linear-gradient(135deg, #F59E0B, #D97706)",
                      color: "#04030A",
                      fontWeight: 700,
                      border: "none",
                      borderRadius: 10,
                      padding: "14px 20px",
                      fontSize: 15,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 8,
                    }}
                  >
                    <Download className="w-4 h-4" />
                    {t("demoDownload")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  );
}