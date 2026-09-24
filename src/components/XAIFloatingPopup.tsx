import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MessageSquare,
  Bot,
  User,
  Send,
  X,
  Maximize2,
  Trash2,
  Sparkles,
  Waves,
} from 'lucide-react';
import { sendChat } from '../api/oceanApi';
import { useTheme } from '../contexts/ThemeContext';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const INITIAL_MESSAGE: ChatMessage = {
  id: 'init-0',
  role: 'assistant',
  content:
    "👋 Hello! I'm **X AI**, your North Indian Ocean digital twin copilot.\n\nAsk me about **subsurface temperatures**, **SST & SSS**, **cyclone-related ocean information**, **model architecture**, **ARGO validation**, or **model performance**.",
  timestamp: new Date(),
};

const SUGGESTIONS = [
  'Show 0–1000m thermal profile',
  'What is current SST in Bay of Bengal?',
  'Explain Mixed Layer Depth (MLD)',
  'Is there any active cyclone warning?',
  'How does the 15-layer neural model work?',
];

// Backend-only response handling.
// IMPORTANT: No synthetic/fabricated ocean values are generated here.
function getBackendErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim()) {
    return `⚠️ **X AI Backend Unavailable**\n\n${error.message}\n\nPlease make sure the OceanEmbed backend is running and try again.`;
  }

  return (
    '⚠️ **X AI Backend Unavailable**\n\n' +
    'The production XAI service could not be reached.\n\n' +
    'Please make sure the OceanEmbed backend is running and try again.'
  );
}

// Markdown formatting helper with clean light theme contrast
function formatMarkdown(text: string) {
  return text.split('\n').map((line, i) => {
    const parts = line.split(/\*\*(.*?)\*\*/g);

    return (
      <span key={i} className="block min-h-[1.2em]">
        {parts.map((part, j) =>
          j % 2 === 1 ? (
            <strong key={j} className="text-[#005088] font-bold">
              {part}
            </strong>
          ) : (
            part
          ),
        )}
      </span>
    );
  });
}

export default function XAIFloatingPopup() {
  const navigate = useNavigate();
  const { language } = useTheme();

  const [isOpen, setIsOpen] = useState(false);
  const [showGreeting, setShowGreeting] = useState(false);
  const [hasInteracted, setHasInteracted] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([INITIAL_MESSAGE]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);

  const chatBottomRef = useRef<HTMLDivElement>(null);

  // Keep language consumed so existing ThemeContext behavior remains intact.
  void language;

  // Proactive greeting pop-up:
  // shows 1.5s after load, disappears after 15s if untouched.
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!hasInteracted) {
        setShowGreeting(true);
      }
    }, 1500);

    const dismissTimer = setTimeout(() => {
      setShowGreeting(false);
    }, 15000);

    return () => {
      clearTimeout(timer);
      clearTimeout(dismissTimer);
    };
  }, [hasInteracted]);

  // Listen to global events: 'open-xai-chat' and 'toggle-xai-chat'
  useEffect(() => {
    const handleOpen = () => {
      setIsOpen(true);
      setShowGreeting(false);
      setHasInteracted(true);
    };

    const handleToggle = () => {
      setIsOpen(prev => !prev);
      setShowGreeting(false);
      setHasInteracted(true);
    };

    window.addEventListener('open-xai-chat', handleOpen);
    window.addEventListener('toggle-xai-chat', handleToggle);

    return () => {
      window.removeEventListener('open-xai-chat', handleOpen);
      window.removeEventListener('toggle-xai-chat', handleToggle);
    };
  }, []);

  // Auto-scroll chat to bottom
  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, isTyping]);

  const handleSendMessage = async (textToSend: string) => {
    const clean = textToSend.trim();

    if (!clean || isTyping) {
      return;
    }

    setHasInteracted(true);
    setShowGreeting(false);

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: clean,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      // Production backend:
      // POST /chat
      const res = await sendChat(clean);

      const reply =
        typeof res?.reply === 'string'
          ? res.reply.trim()
          : '';

      if (!reply) {
        throw new Error('The XAI backend returned an empty reply.');
      }

      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-assistant`,
        role: 'assistant',
        content: reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (error) {
      const assistantMsg: ChatMessage = {
        id: `${Date.now()}-error`,
        role: 'assistant',
        content: getBackendErrorMessage(error),
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClearChat = () => {
    setMessages([
      {
        ...INITIAL_MESSAGE,
        timestamp: new Date(),
      },
    ]);
  };

  const handleOpenFullPage = () => {
    setIsOpen(false);
    navigate('/chat');
  };

  return (
    <aside
      aria-label="X AI Floating Assistant"
      className="fixed bottom-6 right-4 sm:right-6 z-50 select-none"
    >
      {/* ──────────────────────────────────────────────────────────
          1. PROACTIVE WELCOME POPUP BUBBLE
      ────────────────────────────────────────────────────────── */}
      {showGreeting && !isOpen && (
        <div className="absolute bottom-16 right-0 w-[300px] sm:w-[340px] p-4 rounded-2xl bg-white border border-slate-200 shadow-2xl text-left animate-in fade-in slide-in-from-bottom-3 duration-300 z-50">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-[#005088] flex items-center justify-center text-white shadow-sm">
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              </div>

              <div>
                <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                  <span>X AI Ocean Copilot</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                </div>

                <div className="text-[10px] text-slate-500 font-mono">
                  Digital Twin Assistant
                </div>
              </div>
            </div>

            <button
              onClick={() => setShowGreeting(false)}
              className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors cursor-pointer"
              title="Dismiss"
              type="button"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <p className="text-xs text-slate-600 leading-relaxed mb-3">
            👋 <strong>Hi there!</strong> I'm X AI, your oceanographic digital
            twin assistant. Ask about subsurface profiles, SST, model
            performance, validation, or other available ocean information.
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setIsOpen(true);
                setShowGreeting(false);
                setHasInteracted(true);
              }}
              className="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold text-white bg-[#005088] hover:bg-[#003d66] flex items-center justify-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              type="button"
            >
              <MessageSquare className="w-3 h-3" />
              <span>Ask a Question</span>
            </button>

            <button
              onClick={() => setShowGreeting(false)}
              className="py-1.5 px-2.5 rounded-lg text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
              type="button"
            >
              Later
            </button>
          </div>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          2. EXPANDED FLOATING CHAT POPUP WINDOW
      ────────────────────────────────────────────────────────── */}
      {isOpen && (
        <div
          className="
            absolute bottom-0 right-0
            w-[92vw] sm:w-[410px] h-[550px] max-h-[85vh]
            rounded-2xl border border-slate-300
            bg-white
            shadow-[0_20px_60px_rgba(0,0,0,0.18),0_0_20px_rgba(0,80,136,0.12)]
            flex flex-col overflow-hidden
            animate-in fade-in zoom-in-95 duration-200
            z-50
          "
        >
          {/* Top Bar Header */}
          <div className="p-3.5 bg-[#005088] text-white flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="relative">
                <div className="w-8 h-8 rounded-lg bg-white/15 border border-white/20 flex items-center justify-center text-white">
                  <Bot className="w-4.5 h-4.5" />
                </div>

                <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400 border border-[#005088]" />
              </div>

              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-white tracking-tight">
                    X AI Copilot
                  </h3>

                  <span className="text-[9.5px] px-1.5 py-0.2 rounded font-mono font-bold bg-amber-400 text-slate-950">
                    LIVE
                  </span>
                </div>

                <p className="text-[10px] text-blue-100 font-mono">
                  0–1000m Subsurface Intelligence
                </p>
              </div>
            </div>

            {/* Header Control Icons */}
            <div className="flex items-center gap-1">
              <button
                onClick={handleClearChat}
                title="Clear Conversation"
                className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                type="button"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={handleOpenFullPage}
                title="Expand to Full Page"
                className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                type="button"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsOpen(false)}
                title="Minimize / Close"
                className="p-1.5 rounded text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Chat Messages Body */}
          <div className="flex-1 p-3.5 overflow-y-auto space-y-3 bg-[#f8fafc] scrollbar-thin scrollbar-thumb-slate-300 scrollbar-track-transparent">
            {messages.map(msg => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${
                  msg.role === 'user'
                    ? 'justify-end'
                    : 'justify-start'
                }`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-7 h-7 rounded-lg bg-[#005088] flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-xs">
                    <Waves className="w-3.5 h-3.5" />
                  </div>
                )}

                <div
                  className={`max-w-[84%] p-3 rounded-xl text-xs leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#005088] text-white rounded-br-none shadow-xs'
                      : 'bg-white border border-slate-200 text-slate-800 rounded-bl-none shadow-xs'
                  }`}
                >
                  <div className="break-words space-y-1">
                    {formatMarkdown(msg.content)}
                  </div>

                  <div
                    className={`text-[9px] mt-1 font-mono ${
                      msg.role === 'user'
                        ? 'text-blue-200 text-right'
                        : 'text-slate-400 text-left'
                    }`}
                  >
                    {msg.timestamp.toLocaleTimeString([], {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </div>

                {msg.role === 'user' && (
                  <div className="w-7 h-7 rounded-lg bg-slate-700 flex items-center justify-center text-white flex-shrink-0 mt-0.5 shadow-xs">
                    <User className="w-3.5 h-3.5" />
                  </div>
                )}
              </div>
            ))}

            {isTyping && (
              <div className="flex items-center gap-2 text-[#005088] text-xs pl-9">
                <span className="w-2 h-2 rounded-full bg-[#005088] animate-bounce" />
                <span className="w-2 h-2 rounded-full bg-[#005088] animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 rounded-full bg-[#005088] animate-bounce [animation-delay:0.4s]" />

                <span className="text-[11px] text-slate-500 font-mono ml-1">
                  Analyzing ocean layers...
                </span>
              </div>
            )}

            <div ref={chatBottomRef} />
          </div>

          {/* Quick Suggestion Chips */}
          <div className="px-3 py-2 border-t border-slate-200 bg-slate-100/90 overflow-x-auto scrollbar-none flex gap-1.5">
            {SUGGESTIONS.map(s => (
              <button
                key={s}
                onClick={() => handleSendMessage(s)}
                className="whitespace-nowrap px-2.5 py-1 rounded-full text-[10.5px] font-medium bg-white hover:bg-[#005088] border border-slate-300 hover:border-[#005088] text-slate-700 hover:text-white transition-all cursor-pointer shrink-0 shadow-2xs"
                type="button"
                disabled={isTyping}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Input Footer Bar */}
          <form
            onSubmit={e => {
              e.preventDefault();
              void handleSendMessage(input);
            }}
            className="p-2.5 border-t border-slate-200 bg-white flex items-center gap-2"
          >
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask X AI about ocean depths, SST, cyclones..."
              className="flex-1 bg-slate-50 border border-slate-300 focus:border-[#005088] focus:bg-white rounded-lg px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none transition-all shadow-inner"
              disabled={isTyping}
            />

            <button
              type="submit"
              disabled={!input.trim() || isTyping}
              className="w-8.5 h-8.5 rounded-lg bg-[#005088] hover:bg-[#003d66] text-white flex items-center justify-center cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-colors shrink-0"
            >
              <Send className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>
      )}

      {/* ──────────────────────────────────────────────────────────
          3. PERSISTENT FLOATING LAUNCHER BUTTON
      ────────────────────────────────────────────────────────── */}
      {!isOpen && (
        <button
          onClick={() => {
            setIsOpen(true);
            setShowGreeting(false);
            setHasInteracted(true);
          }}
          className="
            group relative flex items-center gap-2.5 px-3.5 py-2.5 rounded-xl
            bg-[#005088] hover:bg-[#003d66]
            border border-[#003d66] shadow-lg
            text-white cursor-pointer transition-all
          "
          aria-label="Open X AI Ocean Copilot"
          type="button"
        >
          {/* Pulsing beacon glow */}
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
          </span>

          <div className="w-6 h-6 rounded-lg bg-white/20 flex items-center justify-center text-white shadow-xs group-hover:scale-105 transition-transform">
            <Bot className="w-3.5 h-3.5" />
          </div>

          <div className="flex flex-col text-left">
            <span className="text-xs font-bold text-white tracking-tight flex items-center gap-1">
              <span>X AI Copilot</span>
              <Sparkles className="w-3 h-3 text-amber-300" />
            </span>

            <span className="text-[9px] text-blue-200 font-mono">
              Ocean Intelligence
            </span>
          </div>
        </button>
      )}
    </aside>
  );
}