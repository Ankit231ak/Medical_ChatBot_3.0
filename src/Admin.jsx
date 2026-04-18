import { useState, useEffect } from "react";

export default function Admin() {
  const [token, setToken] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [userIdToBlock, setUserIdToBlock] = useState("");
  const [activeTab, setActiveTab] = useState("engine");
  const [notification, setNotification] = useState(null);
  const [sysStatus, setSysStatus] = useState({ enabled: true, model: "gemini", blockedUsers: [], models: [] });
  const [newModelId, setNewModelId] = useState("");
  const [newModelLabel, setNewModelLabel] = useState("");
  const [newModelProvider, setNewModelProvider] = useState("huggingface");
  const [removeData, setRemoveData] = useState(false);
  // Email search
  const [searchEmail, setSearchEmail] = useState("");
  const [searchResult, setSearchResult] = useState(null);  // null | { success, userId, ... } | { success: false, message }
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!token) return;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/admin/status", { headers: { Authorization: token } });
        const data = await res.json();
        if (data.success) {
          setSysStatus({ enabled: data.enabled, model: data.model, blockedUsers: data.blockedUsers, models: data.models || [] });
        }
      } catch (err) {
        console.error("Failed to sync admin status", err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [token]);

  const showNotification = (type, text) => {
    setNotification({ type, text });
    setTimeout(() => setNotification(null), 5000);
  };

  const login = async () => {
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) { showNotification("error", "Login failed. Wrong username or password."); return; }
      const data = await res.json();
      if (data.success) { setToken(data.token); showNotification("success", "Authenticated! Welcome to Admin Dashboard."); }
      else showNotification("error", "Login failed.");
    } catch { showNotification("error", "Network Error: Cannot reach the server!"); }
  };

  const toggleLLM = async () => {
    const res = await fetch("/api/admin/toggle-llm", { method: "POST", headers: { Authorization: token } });
    if (res.ok) {
      const data = await res.json();
      setSysStatus(prev => ({ ...prev, enabled: data.enabled }));
      showNotification("success", `AI Engine is now ${data.enabled ? "Active ✅" : "Halted 🔴"}`);
    } else showNotification("error", "Unauthorized or error toggling AI Engine.");
  };

  const setModel = async (model) => {
    if (!model.trim()) return showNotification("error", "Model name cannot be empty.");
    const res = await fetch("/api/admin/set-model", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ model }),
    });
    if (res.ok) {
      const data = await res.json();
      setSysStatus(prev => ({ ...prev, model: data.model }));
      showNotification("success", `Default model → ${data.model}`);
    } else showNotification("error", "Unauthorized or error setting model.");
  };

  const addModel = async () => {
    if (!newModelId.trim() || !newModelLabel.trim()) { showNotification("error", "Model ID and label are required."); return; }
    const res = await fetch("/api/admin/add-model", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ id: newModelId.trim(), label: newModelLabel.trim(), provider: newModelProvider }),
    });
    if (res.ok) {
      const data = await res.json();
      setSysStatus(prev => ({ ...prev, models: data.models }));
      setNewModelId(""); setNewModelLabel(""); setNewModelProvider("huggingface");
      showNotification("success", `"${newModelLabel}" published to frontend dropdown!`);
    } else showNotification("error", "Failed to add model.");
  };

  const blockUser = async () => {
    if (!userIdToBlock) { showNotification("error", "Please enter a User ID."); return; }
    const res = await fetch("/api/admin/block-user", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userIdToBlock, removeData }),
    });
    if (res.ok) {
      showNotification("success", `User banned.${removeData ? " All data erased." : ""}`);
      setUserIdToBlock("");
      setSearchResult(null);
      const s = await fetch("/api/admin/status", { headers: { Authorization: token } });
      if (s.ok) { const d = await s.json(); setSysStatus(prev => ({ ...prev, blockedUsers: d.blockedUsers })); }
    } else showNotification("error", "Unauthorized or error banning user.");
  };

  const unblockUser = async () => {
    if (!userIdToBlock) { showNotification("error", "Please enter a User ID."); return; }
    const res = await fetch("/api/admin/unblock-user", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userIdToBlock }),
    });
    if (res.ok) {
      showNotification("success", `User ${userIdToBlock} is now unblocked ✅`);
      setUserIdToBlock("");
      setSearchResult(null);
      const s = await fetch("/api/admin/status", { headers: { Authorization: token } });
      if (s.ok) { const d = await s.json(); setSysStatus(prev => ({ ...prev, blockedUsers: d.blockedUsers })); }
    } else showNotification("error", "Unauthorized or error unblocking user.");
  };

  const deleteUserData = async () => {
    if (!userIdToBlock) { showNotification("error", "Please enter a User ID."); return; }
    const res = await fetch("/api/admin/delete-user-data", {
      method: "POST",
      headers: { Authorization: token, "Content-Type": "application/json" },
      body: JSON.stringify({ userId: userIdToBlock }),
    });
    if (res.ok) {
      const data = await res.json();
      showNotification("success", `Erased ${data.deleted} message(s) for that user.`);
      setUserIdToBlock("");
      setSearchResult(null);
    } else showNotification("error", "Unauthorized or error deleting user data.");
  };

  const findUserByEmail = async () => {
    if (!searchEmail.trim()) { showNotification("error", "Please enter an email address."); return; }
    setSearching(true);
    setSearchResult(null);
    try {
      const res = await fetch(`/api/admin/find-user?email=${encodeURIComponent(searchEmail.trim())}`, {
        headers: { Authorization: token },
      });
      const data = await res.json();
      setSearchResult(data);
      if (data.success) {
        showNotification("success", `User found: ${data.email}`);
      } else {
        showNotification("error", data.message || "User not found.");
      }
    } catch {
      showNotification("error", "Failed to reach server.");
    } finally {
      setSearching(false);
    }
  };

  const navItems = [
    { id: "engine", icon: "⚡", label: "AI Engine" },
    { id: "models", icon: "🧠", label: "Models" },
    { id: "moderation", icon: "🛡️", label: "Moderation" },
  ];

  // ─────────────────────────── LOGIN PAGE ───────────────────────────
  if (!token) {
    return (
      <div className="min-h-screen bg-[#050b14] flex items-center justify-center p-4">
        <div className="fixed inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-blue-600/8 rounded-full blur-3xl" />
          <div className="absolute bottom-[-5%] right-[-5%] w-96 h-96 bg-cyan-600/8 rounded-full blur-3xl" />
        </div>

        {notification && (
          <div className="fixed top-8 left-1/2 -translate-x-1/2 z-[100] animate-message-in">
            <div className={`px-6 py-4 rounded-2xl border backdrop-blur-2xl flex items-center gap-3 shadow-2xl ${notification.type === "success" ? "bg-green-950/90 border-green-500/50 text-green-300" : "bg-red-950/90 border-red-500/50 text-red-300"}`}>
              <span className="text-xl">{notification.type === "success" ? "✅" : "⚠️"}</span>
              <span className="font-semibold text-sm">{notification.text}</span>
            </div>
          </div>
        )}

        <div className="w-full max-w-sm relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600/30 to-cyan-600/20 border border-white/10 flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(6,182,212,0.2)]">
              <img src="/videos/imgi_139_number-nine-logo-modern-vector-logo-number-9_303861-1011.jpg" alt="Logo" className="w-10 h-8 object-cover invert opacity-90 rounded" />
            </div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Admin <span className="text-cyan-400">Portal</span></h1>
            <p className="text-slate-500 text-sm mt-1">Restricted access. Authorized personnel only.</p>
          </div>

          <div className="bg-white/3 backdrop-blur-xl border border-white/8 rounded-3xl p-7 space-y-4 shadow-2xl">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Username</label>
              <input type="text" placeholder="admin username" autoComplete="username"
                className="w-full bg-[#070d1a] border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/60 transition-all placeholder:text-slate-600"
                value={username} onChange={(e) => setUsername(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 mb-2 uppercase tracking-widest">Password</label>
              <input type="password" placeholder="••••••••" autoComplete="current-password"
                className="w-full bg-[#070d1a] border border-white/8 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-cyan-500/60 transition-all placeholder:text-slate-600"
                value={password} onChange={(e) => setPassword(e.target.value)} onKeyDown={(e) => e.key === "Enter" && login()} />
            </div>
            <button onClick={login}
              className="w-full mt-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:from-blue-500 hover:to-cyan-400 text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_24px_rgba(6,182,212,0.35)] hover:shadow-[0_4px_30px_rgba(6,182,212,0.5)] active:scale-[0.98] text-sm tracking-wide">
              Authenticate →
            </button>
          </div>
          <a href="/" className="block text-center mt-6 text-sm text-slate-600 hover:text-slate-300 transition-colors">← Back to Application</a>
        </div>
      </div>
    );
  }

  // ─────────────────────────── DASHBOARD ───────────────────────────
  return (
    <div className="min-h-screen bg-[#050b14] flex flex-col md:flex-row">
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-10%] left-[-5%] w-[500px] h-[500px] bg-blue-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-[-5%] right-[-5%] w-96 h-96 bg-cyan-600/5 rounded-full blur-3xl" />
      </div>

      {notification && (
        <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] animate-message-in">
          <div className={`px-5 py-3.5 rounded-2xl border backdrop-blur-2xl flex items-center gap-3 shadow-2xl whitespace-nowrap ${notification.type === "success" ? "bg-green-950/90 border-green-500/50 text-green-300" : "bg-red-950/90 border-red-500/50 text-red-300"}`}>
            <span>{notification.type === "success" ? "✅" : "⚠️"}</span>
            <span className="font-semibold text-sm">{notification.text}</span>
          </div>
        </div>
      )}

      {/* ── Sidebar ── */}
      <aside className="relative z-10 w-full md:w-60 bg-[#060d1a] border-b md:border-b-0 md:border-r border-white/5 flex md:flex-col p-4 md:p-6 gap-2 shrink-0">
        <div className="hidden md:flex items-center gap-2.5 mb-8">
          <img src="/videos/imgi_139_number-nine-logo-modern-vector-logo-number-9_303861-1011.jpg" alt="Logo" className="w-8 h-6 object-cover invert opacity-80 rounded" />
          <div>
            <div className="text-white font-bold text-sm">Admin Panel</div>
            <div className={`text-[10px] font-semibold ${sysStatus.enabled ? "text-green-400" : "text-red-400"}`}>{sysStatus.enabled ? "● Online" : "● AI Halted"}</div>
          </div>
        </div>

        {navItems.map(item => (
          <button key={item.id} onClick={() => setActiveTab(item.id)}
            className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${activeTab === item.id ? "bg-cyan-500/15 text-cyan-300 border border-cyan-500/25" : "text-slate-400 hover:text-white hover:bg-white/5"}`}>
            <span className="text-base">{item.icon}</span>{item.label}
          </button>
        ))}

        <div className="flex-1" />

        <div className="hidden md:grid grid-cols-2 gap-2 mb-4">
          <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-white">{sysStatus.models.length || 2}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Models</div>
          </div>
          <div className="bg-white/3 border border-white/5 rounded-xl p-3 text-center">
            <div className="text-lg font-bold text-red-400">{sysStatus.blockedUsers.length}</div>
            <div className="text-[9px] text-slate-500 uppercase tracking-wider">Banned</div>
          </div>
        </div>

        <button onClick={() => setToken("")}
          className="hidden md:flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-500 hover:text-white hover:bg-white/5 transition-all uppercase tracking-wider">
          ← Sign Out
        </button>
      </aside>

      {/* ── Main ── */}
      <main className="relative z-10 flex-1 overflow-y-auto p-4 md:p-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-white">{navItems.find(i => i.id === activeTab)?.icon} {navItems.find(i => i.id === activeTab)?.label}</h1>
            <p className="text-slate-500 text-xs mt-0.5">MediAI system controls</p>
          </div>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wide border ${sysStatus.enabled ? "bg-green-500/10 text-green-400 border-green-500/25" : "bg-red-500/10 text-red-400 border-red-500/25"}`}>
            <div className={`w-1.5 h-1.5 rounded-full ${sysStatus.enabled ? "bg-green-400 animate-pulse" : "bg-red-400"}`} />
            {sysStatus.enabled ? "AI Operational" : "AI Halted"}
          </div>
        </div>

        {/* ── AI ENGINE TAB ── */}
        {activeTab === "engine" && (
          <div className="max-w-xl space-y-5 animate-message-in">
            <div className="bg-[#070f1e] border border-white/6 rounded-2xl p-6">
              <div className="flex justify-between items-start mb-5">
                <div>
                  <h3 className="text-white font-semibold">Global AI Engine</h3>
                  <p className="text-slate-500 text-xs mt-1">Controls all AI responses system-wide</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${sysStatus.enabled ? "bg-green-500/15 text-green-400" : "bg-red-500/15 text-red-400"}`}>
                  {sysStatus.enabled ? "Active" : "Halted"}
                </div>
              </div>
              <div className="flex items-center justify-between p-4 bg-white/3 rounded-xl border border-white/5 mb-4">
                <div>
                  <div className="text-sm font-medium text-white">{sysStatus.enabled ? "Engine Running" : "Engine Stopped"}</div>
                  <div className="text-xs text-slate-500 mt-0.5">{sysStatus.enabled ? "Users can send messages" : "AI responses are blocked"}</div>
                </div>
                <button onClick={toggleLLM}
                  className={`relative w-14 h-7 rounded-full border transition-all duration-300 ${sysStatus.enabled ? "bg-green-500/30 border-green-500/50" : "bg-slate-700/50 border-white/10"}`}>
                  <div className={`absolute top-1 w-5 h-5 rounded-full transition-all duration-300 shadow-lg ${sysStatus.enabled ? "left-8 bg-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]" : "left-1 bg-slate-400"}`} />
                </button>
              </div>
              <button onClick={toggleLLM}
                className={`w-full py-3 rounded-xl font-semibold text-sm border transition-all active:scale-[0.98] ${sysStatus.enabled ? "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/25 hover:border-red-500/50" : "bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/25 hover:border-green-500/50"}`}>
                {sysStatus.enabled ? "🔴 Disable AI Engine" : "🟢 Activate AI Engine"}
              </button>
            </div>
            <div className="bg-[#070f1e] border border-white/6 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Current Default Model</h3>
              <p className="text-slate-500 text-xs mb-4">Active model for all AI requests</p>
              <div className="flex items-center gap-3 bg-cyan-500/8 border border-cyan-500/20 rounded-xl px-4 py-3">
                <div className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
                <span className="text-cyan-300 font-mono text-sm truncate">{sysStatus.model}</span>
              </div>
            </div>
          </div>
        )}

        {/* ── MODELS TAB ── */}
        {activeTab === "models" && (
          <div className="max-w-xl space-y-5 animate-message-in">
            <div className="bg-[#070f1e] border border-white/6 rounded-2xl p-6">
              <h3 className="text-white font-semibold mb-1">Available Models</h3>
              <p className="text-slate-500 text-xs mb-4">Click any model to set as global default</p>
              <div className="space-y-2">
                {(sysStatus.models.length > 0 ? sysStatus.models : [
                  { id: "gemini", label: "✨ Gemini 2.5 (Google)" },
                  { id: "google/gemma-2-2b-it:novita", label: "🤗 Gemma-2 2B (HuggingFace)" },
                ]).map(m => (
                  <button key={m.id} onClick={() => setModel(m.id)}
                    className={`w-full text-left px-4 py-3 rounded-xl text-sm font-medium transition-all border flex items-center justify-between group ${sysStatus.model === m.id ? "bg-cyan-600/15 text-cyan-300 border-cyan-500/35" : "bg-white/3 text-slate-400 hover:text-white border-white/5 hover:border-white/15 hover:bg-white/6"}`}>
                    <div className="flex items-center gap-3">
                      {sysStatus.model === m.id && <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />}
                      <span>{m.label}</span>
                    </div>
                    {sysStatus.model === m.id
                      ? <span className="text-[10px] text-cyan-400 font-bold tracking-widest uppercase">Default</span>
                      : <span className="text-[10px] text-slate-600 group-hover:text-slate-400 transition-colors">Set Default →</span>}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-[#070f1e] border border-white/6 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-semibold">Add New Model</h3>
                <p className="text-slate-500 text-xs mt-1">Published models appear in the user dropdown immediately</p>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Model Hub ID</label>
                  <input type="text" placeholder="e.g. meta-llama/Meta-Llama-3-8B-Instruct"
                    className="w-full bg-[#050b14] border border-white/8 rounded-xl px-4 py-2.5 text-white text-xs font-mono outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                    value={newModelId} onChange={(e) => setNewModelId(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Display Label</label>
                  <input type="text" placeholder="e.g. 🦙 Llama 3 8B"
                    className="w-full bg-[#050b14] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                    value={newModelLabel} onChange={(e) => setNewModelLabel(e.target.value)} />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Provider</label>
                  <select value={newModelProvider} onChange={(e) => setNewModelProvider(e.target.value)}
                    className="w-full bg-[#050b14] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/50 transition-all">
                    <option value="huggingface">🤗 HuggingFace Router</option>
                    <option value="gemini">✨ Google Gemini API</option>
                  </select>
                </div>
                <button onClick={addModel}
                  className="w-full bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 hover:border-cyan-500/60 py-3 rounded-xl transition-all text-sm font-bold tracking-wide active:scale-[0.98]">
                  + Publish to Frontend
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MODERATION TAB ── */}
        {activeTab === "moderation" && (
          <div className="max-w-xl space-y-5 animate-message-in">

            {/* Email Search Card */}
            <div className="bg-[#070f1e] border border-white/6 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-semibold">Find User by Email</h3>
                <p className="text-slate-500 text-xs mt-1">Look up a Clerk User ID from their email address</p>
              </div>
              <div className="flex gap-2">
                <input
                  type="email"
                  placeholder="user@example.com"
                  className="flex-1 bg-[#050b14] border border-white/8 rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-cyan-500/50 transition-all placeholder:text-slate-600"
                  value={searchEmail}
                  onChange={(e) => setSearchEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && findUserByEmail()}
                />
                <button
                  onClick={findUserByEmail}
                  disabled={searching}
                  className="bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-400 border border-cyan-500/30 px-4 rounded-xl transition-all text-sm font-bold tracking-wide disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
                >
                  {searching ? (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  ) : "🔍"} Find
                </button>
              </div>

              {/* Search Result */}
              {searchResult && (
                <div className={`rounded-xl border p-4 animate-message-in ${searchResult.success ? "bg-cyan-500/5 border-cyan-500/20" : "bg-red-500/5 border-red-500/20"}`}>
                  {searchResult.success ? (
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        {searchResult.imageUrl ? (
                          <img src={searchResult.imageUrl} alt="avatar" className="w-10 h-10 rounded-full border border-white/10 object-cover" />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600/40 to-cyan-600/40 border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                            {(searchResult.firstName?.[0] || searchResult.email?.[0] || "?").toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="text-white font-semibold text-sm truncate">
                            {[searchResult.firstName, searchResult.lastName].filter(Boolean).join(" ") || "Unknown Name"}
                          </div>
                          <div className="text-slate-400 text-xs truncate">{searchResult.email}</div>
                        </div>
                      </div>
                      <div className="bg-[#050b14] border border-white/8 rounded-lg px-3 py-2 flex items-center justify-between gap-2">
                        <span className="text-cyan-300 font-mono text-xs truncate">{searchResult.userId}</span>
                        <button
                          onClick={() => { setUserIdToBlock(searchResult.userId); showNotification("success", "User ID copied to ban field ✅"); }}
                          className="text-[10px] text-cyan-400 hover:text-white font-bold uppercase tracking-wider border border-cyan-500/30 px-2 py-1 rounded-md hover:bg-cyan-600/20 transition-all whitespace-nowrap shrink-0"
                        >
                          Use ID →
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 text-red-400 text-sm">
                      <span>⚠️</span>
                      <span>{searchResult.message}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            {sysStatus.blockedUsers.length > 0 && (
              <div className="bg-[#070f1e] border border-white/6 rounded-2xl p-6">
                <h3 className="text-white font-semibold mb-4">Banned Users
                  <span className="ml-2 text-xs text-red-400 bg-red-500/10 px-2 py-0.5 rounded-full border border-red-500/20">{sysStatus.blockedUsers.length}</span>
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
                  {sysStatus.blockedUsers.map(uid => (
                    <div key={uid} className="flex items-center gap-3 bg-red-500/5 border border-red-500/15 rounded-lg px-3 py-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                      <span className="text-xs text-slate-400 font-mono truncate flex-1">{uid}</span>
                      <button
                        onClick={() => { setUserIdToBlock(uid); showNotification("success", `ID loaded → click Unblock`); }}
                        className="text-[10px] text-green-400 hover:text-white font-bold uppercase tracking-wider border border-green-500/30 px-2 py-1 rounded-md hover:bg-green-600/20 transition-all whitespace-nowrap shrink-0"
                      >
                        Unblock →
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="bg-[#070f1e] border border-white/6 rounded-2xl p-6 space-y-4">
              <div>
                <h3 className="text-white font-semibold">User Actions</h3>
                <p className="text-slate-500 text-xs mt-1">Search by email above or paste a User ID directly</p>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 uppercase tracking-wider mb-1">Clerk User ID</label>
                <input type="text" placeholder="user_2ZxK..."
                  className="w-full bg-[#050b14] border border-white/8 rounded-xl px-4 py-2.5 text-white text-xs font-mono outline-none focus:border-cyan-500/40 transition-all placeholder:text-slate-600"
                  value={userIdToBlock} onChange={(e) => setUserIdToBlock(e.target.value)} />
              </div>

              {/* 3 Action Buttons */}
              <div className="grid grid-cols-1 gap-2">
                {/* Delete Data */}
                <button onClick={deleteUserData}
                  className="w-full bg-orange-500/8 hover:bg-orange-500/15 text-orange-400 border border-orange-500/25 hover:border-orange-500/50 py-3 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  Delete All Data  <span className="text-[10px] text-orange-500/70 font-normal">(keeps account active)</span>
                </button>

                {/* Block User */}
                <button onClick={blockUser}
                  className="w-full bg-red-500/8 hover:bg-red-500/15 text-red-400 border border-red-500/25 hover:border-red-500/50 py-3 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
                  </svg>
                  Block User  <span className="text-[10px] text-red-500/70 font-normal">(ban without deleting)</span>
                </button>

                {/* Unblock User */}
                <button onClick={unblockUser}
                  className="w-full bg-green-500/8 hover:bg-green-500/15 text-green-400 border border-green-500/25 hover:border-green-500/50 py-3 rounded-xl transition-all font-semibold text-sm flex items-center justify-center gap-2 active:scale-[0.98]">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Unblock User  <span className="text-[10px] text-green-500/70 font-normal">(restore access)</span>
                </button>
              </div>
            </div>
            <button onClick={() => setToken("")}
              className="md:hidden w-full py-3 text-slate-500 hover:text-white text-sm transition-colors font-bold uppercase tracking-wider">
              ← Sign Out
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
