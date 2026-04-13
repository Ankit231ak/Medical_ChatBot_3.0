import { UserButton } from '@clerk/clerk-react';

export default function Sidebar({ isOpen, onClose, sessions = [], currentSessionId, onSelectSession, onNewChat }) {
  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`
        fixed lg:relative inset-y-0 left-0 z-30
        w-64 h-full flex flex-col
        bg-[#070d1a] border-r border-white/5
        transform transition-transform duration-300
        ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 px-5 py-5 border-b border-white/5">
          <img
            src="/videos/imgi_139_number-nine-logo-modern-vector-logo-number-9_303861-1011.jpg"
            alt="MediAI Nine Logo"
            className="w-20 h-8 rounded-md object-cover shadow-lg shadow-blue-900/40 shrink-0 invert"
          />
          <div>
            <div className="text-white font-semibold text-sm">MediAI Nine</div>
            <div className="text-xs text-cyan-400">Medical Assistant</div>
          </div>
        </div>

        {/* Nav */}
        <nav className="p-3 space-y-1">
          <button
            onClick={onNewChat}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 bg-gradient-to-r from-blue-600/30 to-cyan-600/20 text-white border border-blue-500/20 cursor-pointer"
          >
            <span className="text-base">💬</span>
            New Chat
          </button>
        </nav>

        {/* Recent */}
        <div className="px-4 pt-4 pb-2 flex-1 overflow-y-auto scrollbar-thin">
          <div className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-2">Recent Chats</div>
          <div className="space-y-1.5">
            {sessions.length === 0 ? (
              <div className="text-xs text-slate-500 px-2 py-2">No history yet.</div>
            ) : (
              sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => onSelectSession(session.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all truncate cursor-pointer shadow-sm border ${
                    currentSessionId === session.id 
                    ? 'bg-white/10 text-white border-white/10 shadow-blue-500/20' 
                    : 'text-slate-300 hover:text-white bg-white/5 hover:bg-white/10 border-white/5'
                  }`}
                >
                  💬 {session.title}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="flex-1" />

        {/* Bottom */}
        <div className="p-4 border-t border-white/5 flex items-center justify-center">
          <div className="w-full flex items-center justify-between px-4 py-2 bg-slate-800/40 rounded-xl border border-white/5">
            <span className="font-medium text-sm text-slate-300">Account</span>
            <UserButton afterSignOutUrl="/" appearance={{ elements: { userButtonAvatarBox: "w-8 h-8" } }} />
          </div>
        </div>
      </aside>
    </>
  );
}
