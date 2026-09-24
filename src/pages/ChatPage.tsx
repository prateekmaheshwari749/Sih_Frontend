
import { useState, useRef, useEffect } from 'react';
import {
  Send,
  Bot,
  User,
  Waves,
  RefreshCw,
  Trash2,
  ChevronDown,
} from 'lucide-react';
import { format } from 'date-fns';

import PageLayout from '../components/PageLayout';
import { useTheme } from '../contexts/ThemeContext';

import {
  sendChat,
  checkBackendConnection,
} from '../api/oceanApi';

// ============================================================
// TYPES
// ============================================================

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

// ============================================================
// SUGGESTED QUESTIONS
// ============================================================

const SUGGESTIONS = [
  'Show me the current subsurface profile',
  'What is the Ocean Heat Content (OHC)?',
  'Explain the Mixed Layer Depth (MLD)',
  'How does the satellite embedding model work?',
  'What are the active cyclone alerts?',
  'Compare SST and SSH anomalies in Bay of Bengal',
];

// ============================================================
// SIMPLE MARKDOWN RENDERER
// ============================================================

function renderContent(text: string, isLight: boolean) {
  return text
    .split('\n')
    .map((line, i, arr) => {
      // FIXED:
      // Correctly detect **bold text**
      const parts = line.split(/\*\*(.*?)\*\*/g);

      return (
        <span key={i} className="block min-h-[1.2em]">
          {parts.map((part, j) =>
            j % 2 === 1 ? (
              <strong
                key={j}
                className={
                  isLight
                    ? 'text-[#005088] font-bold'
                    : 'text-cyan-300 font-bold'
                }
              >
                {part}
              </strong>
            ) : (
              part
            ),
          )}

          {i < arr.length - 1 && <br />}
        </span>
      );
    });
}

// ============================================================
// PAGE
// ============================================================

export default function ChatPage() {
  const { isLight, language } = useTheme();
  const isHi = language === 'hi';

  // ==========================================================
  // STATE
  // ==========================================================

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'assistant',
      content:
        "👋 Hello! I'm **X AI**, your North Indian Ocean subsurface intelligence digital twin.\n\nAsk me about ocean vertical profiles (0–1000m), SST, SSS, SSH altimetry, Ocean Heat Content (OHC), MLD, or cyclone rapid intensification tracking.",
      timestamp: new Date(),
    },
  ]);

  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(true);

  const [backendConnected, setBackendConnected] = useState<boolean | null>(
    null,
  );

  const [backendError, setBackendError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  // ==========================================================
  // BACKEND CONNECTION CHECK
  // ==========================================================

  useEffect(() => {
    let cancelled = false;

    async function checkBackend() {
      try {
        const result = await checkBackendConnection();

        if (cancelled) return;

        setBackendConnected(Boolean(result));
        setBackendError(null);
      } catch (error: unknown) {
        if (cancelled) return;

        setBackendConnected(false);

        setBackendError(
          error instanceof Error
            ? error.message
            : 'Backend unavailable',
        );
      }
    }

    checkBackend();

    return () => {
      cancelled = true;
    };
  }, []);

  // ==========================================================
  // AUTO SCROLL
  // ==========================================================

  useEffect(() => {
    bottomRef.current?.scrollIntoView({
      behavior: 'smooth',
    });
  }, [messages, isTyping]);

  // ==========================================================
  // SEND MESSAGE
  // ==========================================================

  const sendMessage = async (text: string) => {
    const cleanText = text.trim();

    if (!cleanText || isTyping) return;

    setShowSuggestions(false);

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: cleanText,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // ======================================================
      // REAL BACKEND REQUEST
      //
      // POST http://127.0.0.1:8000/chat
      //
      // Request:
      // {
      //   "message": "..."
      // }
      //
      // Response:
      // {
      //   "reply": "...",
      //   "source": "xai-rule-engine",
      //   "model": "CNN + Swin Transformer + 7-day ConvGRU"
      // }
      // ======================================================

      const result = await sendChat(cleanText);

      setBackendConnected(true);
      setBackendError(null);

      const reply = result?.reply;

      if (!reply || typeof reply !== 'string') {
        throw new Error(
          'Backend returned an empty or invalid chat response.',
        );
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (error: unknown) {
      console.error('[ChatPage] Chat request failed:', error);

      setBackendConnected(false);

      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Unable to contact the OceanEmbed backend.';

      setBackendError(errorMessage);

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          `**X AI Backend Error**\n\n` +
          `I could not connect to the OceanEmbed backend.\n\n` +
          `**Error:** ${errorMessage}\n\n` +
          `Please make sure the FastAPI server is running.`,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  // ==========================================================
  // ENTER KEY
  // ==========================================================

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // ==========================================================
  // CLEAR CHAT
  // ==========================================================

  const clearChat = () => {
    setMessages([
      {
        id: '0',
        role: 'assistant',
        content:
          '👋 Conversation refreshed. Ask me anything about ocean parameters or 0–1000m thermal strata.',
        timestamp: new Date(),
      },
    ]);

    setShowSuggestions(true);
    setBackendError(null);
  };

  // ==========================================================
  // BACKEND STATUS
  // ==========================================================

  const statusText =
    backendConnected === true
      ? 'Backend Connected'
      : backendConnected === false
        ? 'Backend Offline'
        : 'Checking Service...';

  const statusClass =
    backendConnected === true
      ? 'bg-emerald-500'
      : backendConnected === false
        ? 'bg-red-500'
        : 'bg-blue-500';

  // ==========================================================
  // UI
  // ==========================================================

  return (
    <PageLayout fullHeight>
      <div
        className="flex flex-col max-w-4xl mx-auto px-4 pb-4 w-full"
        style={{ height: 'calc(100vh - 64px)' }}
      >
        {/* ==================================================
            HEADER
        ================================================== */}

        <div
          className={`flex items-center justify-between py-4 border-b mb-3 ${
            isLight
              ? 'border-slate-200'
              : 'border-white/10'
          }`}
        >
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                isLight
                  ? 'bg-[#005088] text-white shadow-sm'
                  : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white'
              }`}
            >
              <Bot size={20} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span
                  className={`text-[10px] font-mono font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    isLight
                      ? 'bg-blue-50 text-[#005088] border border-blue-200'
                      : 'bg-cyan-500/15 border border-cyan-500/30 text-cyan-300'
                  }`}
                >
                  {isHi ? 'एआई सहायक' : 'CONVERSATIONAL AI'}
                </span>

                <span
                  className={`flex items-center gap-1 text-[11px] font-mono font-semibold ${
                    isLight
                      ? 'text-slate-600'
                      : 'text-white/50'
                  }`}
                >
                  <span
                    className={`w-2 h-2 rounded-full ${statusClass} ${
                      backendConnected === true
                        ? 'animate-pulse'
                        : ''
                    }`}
                  />

                  {statusText}
                </span>
              </div>

              <h1 className="font-black text-lg">
                <span className="bg-gradient-to-r from-white via-cyan-100 to-sky-200 bg-clip-text text-transparent">
                  X AI — Ocean Intelligence Copilot
                </span>
              </h1>
            </div>
          </div>

          <button
            onClick={clearChat}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer border ${
              isLight
                ? 'bg-white hover:bg-slate-100 text-slate-700 border-slate-300 shadow-2xs'
                : 'bg-white/10 hover:bg-white/20 text-white border-white/10'
            }`}
          >
            <Trash2 size={13} />
            <span>Clear Chat</span>
          </button>
        </div>

        {/* ==================================================
            BACKEND ERROR
        ================================================== */}

        {backendError && (
          <div
            className={`mb-3 px-3 py-2 rounded-lg text-[11px] font-mono border ${
              isLight
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-red-500/10 border-red-500/20 text-red-300'
            }`}
          >
            <strong>Backend:</strong> {backendError}
          </div>
        )}

        {/* ==================================================
            MESSAGES
        ================================================== */}

        <div className="flex-1 overflow-y-auto space-y-3.5 pr-1">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 ${
                msg.role === 'user'
                  ? 'flex-row-reverse'
                  : ''
              }`}
            >
              {/* AVATAR */}

              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 shadow-xs ${
                  msg.role === 'assistant'
                    ? isLight
                      ? 'bg-[#005088] text-white'
                      : 'bg-gradient-to-br from-cyan-400 to-blue-600 text-white'
                    : isLight
                      ? 'bg-slate-700 text-white'
                      : 'bg-gradient-to-br from-purple-500 to-pink-600 text-white'
                }`}
              >
                {msg.role === 'assistant' ? (
                  <Waves size={14} />
                ) : (
                  <User size={14} />
                )}
              </div>

              {/* MESSAGE CONTENT */}

              <div
                className={`max-w-[82%] flex flex-col gap-1 ${
                  msg.role === 'user'
                    ? 'items-end'
                    : 'items-start'
                }`}
              >
                <div
                  className={`rounded-xl px-4 py-3 text-xs sm:text-sm leading-relaxed ${
                    msg.role === 'assistant'
                      ? isLight
                        ? 'bg-white border border-slate-200 text-slate-800 shadow-xs rounded-tl-xs'
                        : 'bg-white/5 border border-white/10 text-white/90 rounded-tl-xs'
                      : isLight
                        ? 'bg-[#005088] text-white shadow-xs rounded-tr-xs'
                        : 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-xs'
                  }`}
                >
                  {renderContent(msg.content, isLight)}
                </div>

                <span
                  className={`text-[10px] font-mono px-1 ${
                    isLight
                      ? 'text-slate-400'
                      : 'text-white/30'
                  }`}
                >
                  {format(msg.timestamp, 'HH:mm')}
                </span>
              </div>
            </div>
          ))}

          {/* ==================================================
              TYPING INDICATOR
          ================================================== */}

          {isTyping && (
            <div className="flex gap-3 items-center">
              <div
                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                  isLight
                    ? 'bg-[#005088] text-white'
                    : 'bg-cyan-500 text-white'
                }`}
              >
                <Waves size={14} />
              </div>

              <div
                className={`p-3 rounded-xl border flex items-center gap-1.5 ${
                  isLight
                    ? 'bg-white border-slate-200 text-slate-600'
                    : 'bg-white/5 border-white/10 text-white'
                }`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-[#005088] animate-bounce" />

                <span className="w-1.5 h-1.5 rounded-full bg-[#005088] animate-bounce [animation-delay:0.2s]" />

                <span className="w-1.5 h-1.5 rounded-full bg-[#005088] animate-bounce [animation-delay:0.4s]" />

                <span className="text-xs font-mono ml-1">
                  Analyzing ocean parameters...
                </span>
              </div>
            </div>
          )}

          {/* ==================================================
              SUGGESTIONS
          ================================================== */}

          {showSuggestions && messages.length === 1 && (
            <div className="space-y-2 py-3">
              <p
                className={`text-xs font-bold flex items-center gap-1 ${
                  isLight
                    ? 'text-slate-500'
                    : 'text-white/40'
                }`}
              >
                <ChevronDown size={12} />
                Suggested Questions
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    className={`text-left px-3.5 py-2.5 rounded-xl border text-xs font-medium transition-all cursor-pointer ${
                      isLight
                        ? 'bg-white hover:bg-blue-50/50 border-slate-200 hover:border-[#005088] text-slate-700 hover:text-[#005088] shadow-2xs'
                        : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-white'
                    }`}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* ==================================================
            INPUT FORM
        ================================================== */}

        <div className="pt-3">
          <div
            className={`rounded-xl border transition-all p-2 flex items-end gap-2 shadow-xs ${
              isLight
                ? 'bg-white border-slate-300 focus-within:border-[#005088]'
                : 'bg-white/5 border-white/10 focus-within:border-cyan-400'
            }`}
          >
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about subsurface temperature, SST, OHC, MLD, ARGO validation, cyclone fuel..."
              rows={1}
              className={`flex-1 bg-transparent text-xs sm:text-sm resize-none outline-none min-h-[36px] max-h-32 py-1.5 ${
                isLight
                  ? 'text-slate-900 placeholder-slate-400'
                  : 'text-white placeholder-white/40'
              }`}
              onInput={(e) => {
                const t = e.target as HTMLTextAreaElement;
                t.style.height = 'auto';
                t.style.height = t.scrollHeight + 'px';
              }}
            />

            <button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isTyping}
              className={`w-9 h-9 rounded-lg flex items-center justify-center text-white transition-colors shrink-0 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed ${
                isLight
                  ? 'bg-[#005088] hover:bg-[#003d66]'
                  : 'bg-gradient-to-r from-cyan-500 to-blue-600 hover:opacity-90'
              }`}
            >
              {isTyping ? (
                <RefreshCw
                  size={14}
                  className="animate-spin"
                />
              ) : (
                <Send size={14} />
              )}
            </button>
          </div>
        </div>
      </div>
    </PageLayout>
  );
}

