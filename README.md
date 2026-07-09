VAAKYA AI ⚖️🤖
Autonomous Legal Rights Protection System

VAAKYA AI is an AI-powered multilingual legal assistant that analyzes documents, detects illegal clauses, identifies rights violations, and generates legal actions in seconds.

Designed to empower individuals to understand legal documents without requiring legal expertise.

🚀 Features
📄 Upload Legal Documents (PDF / Image / Text)
⚖️ Detect Illegal Clauses Automatically
🧠 Multi-Agent AI Architecture
🌍 Multilingual Support (English, Hindi, Tamil)
📊 Legal Risk Analysis Dashboard
📥 Download Legal Notices
⚡ Real-Time Document Analysis
📱 Mobile Friendly & Expo-Ready UI
🧠 AI Agent Architecture

VAAKYA AI uses 4 Autonomous AI Agents:

👁️ DRISHTI

Reads and extracts text from uploaded documents

⚖️ NYAYA

Matches clauses against Indian laws and regulations

🔍 SATYA

Detects violations and highlights risk levels

⚡ SHAKTI

Generates legal notices and suggested actions

📌 Supported Document Types
Rental Agreements
Insurance Rejection Letters
Bank Statements
Loan Agreements
Job Offer Letters
Legal Notices
🌍 Multilingual Support
English
Hindi
Tamil
Expandable to 12 Indian Languages
🛠️ Tech Stack

Frontend

Next.js
React
Tailwind CSS

AI & Backend

Gemini API
Agentic AI Architecture
OCR Processing

Deployment

Vercel
🎯 Use Cases
Tenant Rights Protection
Insurance Claim Disputes
Bank Hidden Charges Detection
Employment Contract Analysis
Consumer Rights Protection

🔑 API Key Setup (REQUIRED)

⚠️ The previous GEMINI_API_KEY was exposed (committed in .env.local inside a shared zip) and MUST be rotated:

1. Go to Google AI Studio (https://aistudio.google.com/apikey), delete the old key, and create a new one.
2. On Vercel: Project → Settings → Environment Variables → add GEMINI_API_KEY with the new key. (.env.local never deploys to Vercel — a key set only there causes "GEMINI_API_KEY is not configured" errors in production.)
3. Redeploy the project so the new variable takes effect.
4. For local development, put the new key in .env.local (it is gitignored).

Optional: set GEMINI_MODELS (comma-separated model IDs) to override the default model chain in lib/config.ts without a code change.

Clone Repository

git clone https://github.com/nishaids/VAAKYA-AI.git

Install Dependencies

npm install

Run Development Server

npm run dev

Open Browser

https://vaakya-ai.vercel.app

🎓 Project Info

Built for Project Expo 2026
AI Legal Protection Platform
Multilingual Autonomous AI System

📈 Future Improvements
More Indian languages
Real legal database integration
Government portal integration
Mobile app version
📄 License

This project is built for academic and research purposes.

⭐ VAAKYA AI

Empowering Every Indian To Understand Their Legal Rights.
