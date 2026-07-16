"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, ChevronDown, Trash2, SendHorizontal, Scale } from "lucide-react";
import { useLanguage } from "@/lib/LanguageContext";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  /** True when the API was unreachable and this is a canned fallback reply. */
  offline?: boolean;
}

const quickSuggestions = [
  { key: "howItWorks", label: "How it works" },
  { key: "uploadDoc", label: "Upload document" },
  { key: "legalRights", label: "Legal rights" },
  { key: "demoGuide", label: "Demo" },
];

const quickActions = [
  { label: "What is VAAKYA AI?", prompt: "What is VAAKYA AI and how does it work?" },
  { label: "Rental rights", prompt: "What are my rights as a tenant under Indian law?" },
  { label: "Insurance rejected", prompt: "My insurance claim was rejected. What can I do under IRDA rules?" },
  { label: "Bank hidden fee", prompt: "My bank charged hidden fees illegally. How do I get a refund?" },
];

const getSmartResponse = (text: string): string => {
  const lower = text.toLowerCase();
  
  if (lower.includes('how') && (lower.includes('work') || lower.includes('use') || lower.includes('function'))) {
    return "VAAKYA AI analyzes your document using 4 AI agents:\n\n• DRISHTI reads your document (handwritten, printed, or scanned)\n• NYAYA checks against Indian laws (Consumer Act, RERA, IRDA, RBI)\n• SATYA finds illegal clauses and violations\n• SHAKTI drafts legal notice or complaint\n\nAll in under 15 seconds!";
  }
  
  if (lower.includes('what') && (lower.includes('document') || lower.includes('upload') || lower.includes('file'))) {
    return "You can upload:\n\n• Rental agreement\n• Insurance rejection letter\n• Bank statement\n• Job offer letter\n• Utility bill\n\nOr try the sample documents below for a demo!";
  }
  
  if (lower.includes('why') || lower.includes('useful') || lower.includes('benefit')) {
    return "Most people sign documents without understanding legal risks.\n\nVAAKYA AI helps you:\n• Detect illegal clauses instantly\n• Understand your rights\n• Take legal action\n\nNo lawyer needed. Free. Fast.";
  }
  
  if (lower.includes('rights') || lower.includes('legal')) {
    return "VAAKYA AI helps you understand your legal rights under:\n\n• Consumer Protection Act 2019\n• RERA (for rental disputes)\n• IRDA (insurance claims)\n• RBI (banking issues)\n\nUpload a document to detect specific violations.";
  }
  
  if (lower.includes('demo') || lower.includes('try') || lower.includes('sample')) {
    return "Try these sample documents:\n\n• Rental Agreement 🏠 - Check for illegal deposits\n• Insurance Rejection 🏥 - Find IRDA violations\n• Bank Statement 🏦 - Detect hidden fees\n\nClick any sample to see the analysis!";
  }
  
  if (lower.includes('what is') || lower.includes('vaakya')) {
    return "VAAKYA AI is an intelligent legal rights assistant that:\n\n• Analyzes documents in 12 Indian languages\n• Detects illegal clauses\n• Generates legal notices\n• Files complaints via eDaakhil\n\nAll in 15 seconds!";
  }
  
  if (lower.includes('deposit') || lower.includes('security') || lower.includes('rent')) {
    return "Under Model Tenancy Act 2021, maximum security deposit is 2 months rent. If charged more, it's illegal!\n\nUpload your rental agreement to check. VAAKYA AI will detect any violations.";
  }
  
  if (lower.includes('insurance') || lower.includes('claim') || lower.includes('rejected')) {
    return "IRDA mandates insurers provide rejection reasons and allow 30-day appeal period.\n\nUpload your rejection letter — VAAKYA AI will identify violations and help you file a complaint!";
  }
  
  if (lower.includes('bank') || lower.includes('loan') || lower.includes('foreclosure')) {
    return "RBI has banned foreclosure penalties on floating rate home loans since 2012.\n\nUpload your bank statement — we'll detect any illegal charges and help you recover funds!";
  }
  
  if (lower.includes('complaint') || lower.includes('court') || lower.includes('file')) {
    return "You can file complaints for free at edaakhil.nic.in — no lawyer needed for claims up to ₹50 lakhs.\n\nVAAKYA AI can pre-fill the form automatically!";
  }
  
  return "I can help you with:\n\n• How VAAKYA AI works\n• What documents to upload\n• Your legal rights\n• Demo guidance\n\nTry asking: 'How does this work?' or 'What documents should I upload?'";
};

const welcomeMessage = `Hi, I'm VAAKYA AI ⚖️\n\nI help you detect illegal clauses in documents and protect your legal rights.\n\nTry asking:\n• How does this work?\n• What document should I upload?\n• What are my rights?`;

export default function VaakyaChatbot() {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      const greetingMessage: Message = {
        id: "greeting",
        role: "assistant",
        content: welcomeMessage,
        timestamp: new Date(),
      };
      setMessages([greetingMessage]);
    }
  }, [isOpen, messages.length]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus();
    }
  }, [isOpen]);

  const sendMessage = async (userText: string) => {
    if (!userText.trim()) return;
    
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: userText,
      timestamp: new Date()
    }]);
    setInputValue("");
    setIsTyping(true);
    
    try {
      const conversationHistory = messages.slice(-8).map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.content }]
      }));
      
      conversationHistory.push({
        role: 'user',
        parts: [{ text: userText }]
      });

      console.log('[VAAKYA CHAT] Sending to /api/chat...');
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: conversationHistory })
      });
      
      console.log('[VAAKYA CHAT] Response status:', response.status);
      
      if (!response.ok || !response.body) {
        const errData = await response.json().catch(() => ({}));
        console.error('[VAAKYA CHAT] ❌ API error — status:', response.status, 'body:', errData);
        throw new Error(`API failed: ${response.status}`);
      }

      const streamingId = (Date.now() + 1).toString();
      setMessages(prev => [
        ...prev,
        { id: streamingId, role: 'assistant', content: '', timestamp: new Date() }
      ]);
      setIsTyping(false);

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        setMessages(prev =>
          prev.map(m => (m.id === streamingId ? { ...m, content: full } : m))
        );
      }
      
    } catch (err) {
      // Keep the canned fallback (good for expo demos) but flag it so the
      // operator can see the backend is actually down.
      console.error('[VAAKYA CHAT] ❌ API unavailable, falling back to offline responses:', err);
      setIsTyping(false);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: getSmartResponse(userText),
        timestamp: new Date(),
        offline: true
      }]);
    }
  };

  const handleSend = async () => {
    if (!inputValue.trim() || isTyping) return;
    await sendMessage(inputValue.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickSuggestion = async (suggestion: string) => {
    await sendMessage(suggestion);
  };

  const handleQuickAction = async (prompt: string) => {
    await sendMessage(prompt);
  };

  const handleClear = () => {
    setMessages([]);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  return (
    <>
      {/* Chat Trigger Button — bottom-24 on ALL sizes: on mobile the FAB
          (components/ui/FAB.tsx) occupies bottom-6 right-6 and was completely
          covering this button, which is why chat was invisible on phones.
          Deliberately a plain div with no entry animation: visibility must
          never depend on a JS animation running on the user's device. */}
      <div className="fixed bottom-24 right-6 z-50">
        {/* Tooltip */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileHover={{ opacity: 1, y: 0 }}
          className="absolute bottom-[70px] right-0 bg-[#12111E] text-[12px] font-body font-semibold px-3 py-1.5 rounded-full whitespace-nowrap border border-[rgba(139,92,246,0.3)] text-white mb-2"
        >
          {t("chatbotTooltip")}
        </motion.div>

        {/* Notification dot */}
        <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-[#8B5CF6] flex items-center justify-center">
          <div className="w-full h-full rounded-full bg-[#8B5CF6] animate-ping opacity-75" />
        </div>

        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 rounded-full bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] shadow-[0_8px_32px_rgba(139,92,246,0.4)] flex items-center justify-center text-white hover:shadow-[0_8px_40px_rgba(139,92,246,0.6)] active:scale-95 transition-all duration-200"
          aria-label="Open Chat"
        >
          <MessageCircle className="w-6 h-6" />
        </button>
      </div>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 z-[60] w-[calc(100vw-32px)] md:w-[380px] h-[520px] bg-[#04030A] border border-[rgba(139,92,246,0.3)] rounded-[20px] shadow-[0_24px_80px_rgba(0,0,0,0.6),0_0_40px_rgba(139,92,246,0.1)] overflow-hidden flex flex-col"
            style={{ maxWidth: "380px" }}
          >
            {/* Header */}
            <div className="flex-shrink-0 bg-gradient-to-r from-[#12111E] to-[#1A1830] border-b border-[rgba(139,92,246,0.2)] px-5 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-[#8B5CF6] flex items-center justify-center">
                    <Scale className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-white font-semibold text-sm">{t("chatbotTitle")}</p>
                    <p className="text-[#94A3B8] text-[11px]">{t("chatbotSubtitle")}</p>
                  </div>
                  <div className="w-2 h-2 rounded-full bg-green-500 ml-1">
                    <div className="w-full h-full rounded-full bg-green-500 animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={handleClear}
                    className="p-2 rounded-lg hover:bg-white/5 text-[#6B6880] hover:text-white transition-colors"
                    aria-label="Clear chat"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="p-2 rounded-lg hover:bg-white/5 text-[#6B6880] hover:text-white transition-colors"
                    aria-label="Minimize"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin">
              {messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {message.role === "assistant" && (
                    <div className="w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                      <Scale className="w-3 h-3 text-white" />
                    </div>
                  )}
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-[13px] ${
                      message.role === "user"
                        ? "bg-gradient-to-br from-[#8B5CF6] to-[#6D28D9] text-white rounded-br-4"
                        : "bg-[#12111E] border border-[rgba(139,92,246,0.15)] text-[#E2E8F0] rounded-bl-4"
                    }`}
                  >
                    {message.offline && (
                      <p className="text-[10px] text-[#F59E0B] mb-1 font-medium">⚡ offline mode</p>
                    )}
                    <p>{message.content}</p>
                    <p className="text-[#475569] text-[11px] mt-1">{formatTime(message.timestamp)}</p>
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex justify-start">
                  <div className="w-6 h-6 rounded-full bg-[#8B5CF6] flex items-center justify-center flex-shrink-0 mr-2 mt-1">
                    <Scale className="w-3 h-3 text-white" />
                  </div>
                  <div className="bg-[#12111E] border border-[rgba(139,92,246,0.15)] px-4 py-3 rounded-2xl rounded-bl-4">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" />
                      <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: "0.1s" }} />
                      <div className="w-2 h-2 rounded-full bg-[#8B5CF6] animate-bounce" style={{ animationDelay: "0.2s" }} />
                    </div>
                  </div>
                </div>
              )}

              {!isTyping && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {quickSuggestions.map((suggestion) => (
                    <button
                      key={suggestion.key}
                      onClick={() => handleQuickSuggestion(suggestion.label)}
                      className="px-3 py-1.5 rounded-full text-[11px] border border-[rgba(139,92,246,0.3)] text-[#A09DB8] hover:bg-[rgba(139,92,246,0.1)] hover:text-[#8B5CF6] transition-colors"
                    >
                      {suggestion.label}
                    </button>
                  ))}
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Actions */}
            <div className="flex-shrink-0 px-4 py-2 border-t border-[rgba(255,255,255,0.06)]">
              <div className="flex gap-2 overflow-x-auto pb-1">
                {quickActions.map((action) => (
                  <button
                    key={action.label}
                    onClick={() => handleQuickAction(action.prompt)}
                    className="px-3 py-1.5 rounded-full text-[10px] border border-[rgba(139,92,246,0.3)] text-[#A09DB8] hover:bg-[rgba(139,92,246,0.1)] hover:text-[#8B5CF6] transition-colors whitespace-nowrap"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input */}
            <div className="flex-shrink-0 bg-[#0C0B15] border-t border-[rgba(255,255,255,0.06)] px-4 py-3">
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t("chatbotPlaceholder")}
                  className="flex-1 bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.1)] rounded-xl px-4 py-2.5 text-[13px] text-[#E2E8F0] placeholder-[#475569] focus:border-[rgba(139,92,246,0.5)] focus:outline-none transition-colors"
                />
                <button
                  onClick={handleSend}
                  disabled={!inputValue.trim() || isTyping}
                  className="w-10 h-10 rounded-full bg-[#8B5CF6] flex items-center justify-center text-white hover:bg-[#7C3AED] hover:scale-105 disabled:opacity-40 disabled:hover:scale-100 transition-all"
                >
                  <SendHorizontal className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}