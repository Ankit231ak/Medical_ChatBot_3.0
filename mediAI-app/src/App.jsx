import { useState, useRef, useEffect, useCallback } from "react";
import Sidebar from "./components/Sidebar.jsx";
import ChatMessage from "./components/ChatMessage.jsx";
import InputBar from "./components/InputBar.jsx";
import WelcomeScreen from "./components/WelcomeScreen.jsx";
import AssistantAvatar from "./components/AssistantAvatar.jsx";
import { SignedIn, SignedOut, SignIn, useUser } from "@clerk/clerk-react";
import "./index.css";

// Backend API URL
const API_URL = "http://51.20.53.121:3001/api";

function nowTime() {
  return new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function App() {
  const { user } = useUser();
  const userId = user?.id || "default-user";

  const [messages, setMessages] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [sessionId, setSessionId] = useState(() => Date.now().toString());
  const [selectedModel, setSelectedModel] = useState("huggingface");
  const [isLoading, setIsLoading] = useState(false);
  const [isEngaged, setIsEngaged] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [voiceState, setVoiceState] = useState("idle");
  const [isThinking, setIsThinking] = useState(false);
  const bottomRef = useRef(null);

  let assistantState = "normal";
  if (isThinking) assistantState = "loading";
  else if (voiceState === "error") assistantState = "error";
  else if (voiceState === "listening") assistantState = "listening";

  const scrollDown = useCallback(() => {
    setTimeout(() => {
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }, 150);
  }, []);

  useEffect(() => {
    scrollDown();
    window.addEventListener("resize", scrollDown);
    return () => window.removeEventListener("resize", scrollDown);
  }, [messages, scrollDown]);

  const formatMessages = (msgs) =>
    msgs.map((m) => {
      let parsedFiles = [];
      if (m.attachments) {
        try {
          parsedFiles = JSON.parse(m.attachments);
        } catch (e) {}
      }
      return {
        ...m,
        files: parsedFiles,
        time: m.created_at
          ? new Date(m.created_at + "Z").toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })
          : nowTime(),
      };
    });

  const loadSessions = useCallback(async () => {
    if (!user) return;
    try {
      const res = await fetch(`${API_URL}/sessions/${userId}`);
      const data = await res.json();
      if (data.success && data.sessions) {
        setSessions(data.sessions);
      }
    } catch (e) {}
  }, [user, userId]);

  // Initial load for sessions
  useEffect(() => {
    if (!user) return;
    fetch(`${API_URL}/sessions/${userId}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.success && data.sessions && data.sessions.length > 0) {
          setSessions(data.sessions);
          setSessionId(data.sessions[0].id);
        }
      });
  }, [user, userId]);

  // Fetch history when sessionId changes
  useEffect(() => {
    if (!user || !sessionId) return;
    fetch(`${API_URL}/history/${userId}/${sessionId}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.messages)) {
          setMessages(formatMessages(data.messages));
        } else {
          setMessages([]);
        }
      })
      .catch((err) => console.error("Failed to load history", err));
  }, [user, userId, sessionId]);

  const handleNewChat = useCallback(() => {
    setSessionId(Date.now().toString());
    setMessages([]);
    setIsEngaged(false);
    loadSessions(); // Always refresh to pull any lost sessions!
  }, [loadSessions]);

  const handleDeleteSession = useCallback(async () => {
    if (!messages || messages.length === 0) return;
    if (
      !window.confirm(
        "Are you sure you want to delete this chat session? (Yes/No)",
      )
    )
      return;

    try {
      const res = await fetch(`${API_URL}/history/${userId}/${sessionId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setMessages([]);
        setSessionId(Date.now().toString());
        setIsEngaged(false);
        loadSessions(); // Reload sidebar to remove deleted session
      } else {
        alert("Failed to delete session. Server might be down.");
      }
    } catch (error) {
      console.error("Failed to clear session", error);
    }
  }, [userId, sessionId, messages, loadSessions]);

  const sendMessage = useCallback(
    async (text, files = []) => {
      if (!text && files.length === 0) return;

      // Optimistically add user message
      const tempId = Date.now();
      const userMsg = {
        id: tempId,
        role: "user",
        content: text,
        files,
        time: nowTime(),
      };
      const typingId = tempId + 1;
      const typingMsg = { id: typingId, role: "assistant", isTyping: true };

      setMessages((p) => [...p, userMsg, typingMsg]);
      setIsLoading(true);
      scrollDown();

      // Delay the face transitioning to loading state
      // const faceTimer = setTimeout(() => setIsThinking(true), 100);

      try {
        // Convert UI files to Base64 to send to server
        const base64FilesPromises = files.map((f) => {
          return new Promise((resolve) => {
            if (!f.file) return resolve(null);
            const reader = new FileReader();
            reader.readAsDataURL(f.file);
            reader.onload = () =>
              resolve({ type: f.type, name: f.name, url: reader.result });
            reader.onerror = () => resolve(null);
          });
        });
        const resolvedFiles = await Promise.all(base64FilesPromises);
        const validFiles = resolvedFiles.filter(Boolean);

        const response = await fetch(`${API_URL}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content: text,
            files: validFiles,
            modelChoice: selectedModel,
            userId,
            sessionId,
          }),
        });

        const data = await response.json();
        if (data.success && Array.isArray(data.messages)) {
          setMessages(formatMessages(data.messages));
        } else if (!data.success) {
          throw new Error(data.message || "Unknown error");
        }
      } catch (error) {
        console.error("Chat Error:", error);
        setMessages((p) =>
          p.map((m) =>
            m.id === typingId
              ? {
                  ...m,
                  isTyping: false,
                  content: `⚠️ Error: ${error.message || "Failed connecting to server."}`,
                  time: nowTime(),
                }
              : m,
          ),
        );
      } finally {
        setIsLoading(false);
        setIsThinking(false);
        loadSessions(); // Moved here so the sidebar updates even if HuggingFace 429 crashes the response!
      }
    },
    [scrollDown, selectedModel, userId, sessionId, loadSessions],
  );

  const hasMessages = messages.length > 0;

  return (
    <div className="flex h-screen bg-[#050b14] overflow-hidden">
      {/* Background ambient glows */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-96 h-96 bg-blue-600/10 rounded-full blur-3xl" />
        <div className="absolute bottom-[-10%] right-[-5%] w-80 h-80 bg-cyan-600/8 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-900/5 rounded-full blur-3xl" />
      </div>

      <SignedOut>
        <div className="fixed inset-0 flex items-center justify-center z-50 bg-[#050b14]/50 backdrop-blur-md">
          <SignIn routing="hash" />
        </div>
      </SignedOut>

      <SignedIn>
        {/* Sidebar */}
        <Sidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          sessions={sessions}
          currentSessionId={sessionId}
          onSelectSession={(id) => {
            setSessionId(id);
            setSidebarOpen(false);
          }}
          onNewChat={() => {
            handleNewChat();
            setSidebarOpen(false);
          }}
        />

        {/* Main content */}
        <div className="flex-1 flex flex-col min-w-0 relative">
          {/* Header */}
          <header className="absolute top-0 left-0 right-0 flex items-center gap-3 px-4 py-3 border-b border-white/5 bg-[#050b14]/80 backdrop-blur-xl z-20">
            <button
              onClick={() => setSidebarOpen(true)}
              className="w-9 h-9 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-white/5 transition-all lg:hidden"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>

            {/* Logo area */}
            <div className="flex items-center gap-2.5 flex-1 bg-transparent">
              <img
                src="/videos/imgi_139_number-nine-logo-modern-vector-logo-number-9_303861-1011.jpg"
                alt="MediAI Nine Logo"
                className="w-20 h-8 rounded-md object-cover shadow-lg shadow-blue-900/40 shrink-0 invert"
              />
              <div>
                <span className="text-white font-semibold text-sm">MediAI</span>
                {/* <span className="ml-2 text-slate-600 text-xs hidden sm:inline">Medical Assistant</span> */}
              </div>
              <div className="flex items-center gap-1.5 ml-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-xs text-green-400/70 hidden sm:inline">
                  Online
                </span>
              </div>
            </div>

            {/* Right controls */}
            <div className="flex items-center gap-2 relative z-50">
              <div className="hidden sm:block">
                <select
                  value={selectedModel}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  className="bg-[#050b14]/80 border border-white/10 text-slate-300 text-xs rounded-lg px-2 py-1.5 outline-none focus:border-cyan-500/50 transition-colors cursor-pointer mr-2"
                >
                  <option value="huggingface">🤖 Gemma 4 26B (HF)</option>
                  <option value="gemini">✨ Gemini 2.5 (Google)</option>
                </select>
              </div>
              <button
                onClick={handleDeleteSession}
                className="w-10 h-10 flex items-center justify-center rounded-xl text-red-500 hover:text-white bg-red-500/10 hover:bg-red-600 transition-all shadow-md ml-2"
                title="Delete this chat session"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                  />
                </svg>
              </button>
            </div>
          </header>

          {/* Chat area */}
          <div className="flex-1 overflow-y-auto flex flex-col scrollbar-thin pt-[68px]">
            {!hasMessages ? (
              isEngaged ? (
                <div className="max-w-3xl mx-auto pl-6 py-6 space-y-5 -translate-x-4 w-full h-full flex flex-col justify-end pb-8 animate-message-in">
                  <ChatMessage
                    message={{
                      id: "intro",
                      role: "assistant",
                      content:
                        "Hello! I’m **MediAI**, your AI medical assistant. \n\nI can help with symptoms, general health concerns, over-the-counter medicines, and skin issue analysis through uploaded images.\n\nHow can I help today?",
                    }}
                  />
                </div>
              ) : (
                <WelcomeScreen
                  onSuggest={(text) => sendMessage(text)}
                  assistantState={assistantState}
                />
              )
            ) : (
              <div className="max-w-3xl mx-auto pl-6 py-6 space-y-5 -translate-x-4 w-full">
                {messages.map((msg) => (
                  <ChatMessage key={msg.id} message={msg} />
                ))}
                <div ref={bottomRef} />
              </div>
            )}
          </div>

          {/* Input bar */}
          <div className="border-t border-white/5 bg-[#050b14]/90 backdrop-blur-xl px-4 py-4 z-10 w-full relative">
            <div className="max-w-3xl mx-auto">
              <InputBar
                onSend={sendMessage}
                isLoading={isLoading}
                onVoiceStateChange={setVoiceState}
                onEngage={() => setIsEngaged(true)}
              />
            </div>
          </div>

          {/* Floating Avatar */}
          {hasMessages && (
            <div className="absolute top-24 right-10 z-30 pointer-events-none hidden lg:block transition-all duration-700">
              <AssistantAvatar
                state={assistantState}
                className="w-48 h-48 drop-shadow-[0_0_40px_rgba(34,211,238,0.4)]"
              />
            </div>
          )}
        </div>
      </SignedIn>
    </div>
  );
}
