// const suggestions = [
//   { icon: '🫀', label: 'Chest pain and shortness of breath', color: 'from-red-500/20 to-pink-500/10 border-red-500/20' },
//   { icon: '💊', label: 'Drug interactions checker', color: 'from-violet-500/20 to-purple-500/10 border-violet-500/20' },
//   { icon: '🩻', label: 'Analyze my X-ray or MRI scan', color: 'from-blue-500/20 to-cyan-500/10 border-blue-500/20' },
//   { icon: '🧪', label: 'Interpret blood test results', color: 'from-green-500/20 to-emerald-500/10 border-green-500/20' },
//   { icon: '🧠', label: 'Headache and migraine symptoms', color: 'from-amber-500/20 to-yellow-500/10 border-amber-500/20' },
//   { icon: '📋', label: 'Upload a PDF medical report', color: 'from-cyan-500/20 to-teal-500/10 border-cyan-500/20' },
// ];

import AssistantAvatar from './AssistantAvatar.jsx';

export default function WelcomeScreen({ onSuggest, assistantState = 'normal' }) {
  return (
    <div className="flex flex-col items-center justify-center flex-1 px-4 py-4 sm:py-8 animate-fadeIn min-h-full">
      {/* Animated logo */}
      {/* Animated Video Avatar */}
      <div className="relative mb-5 sm:mb-8 flex justify-center mt-1 sm:mt-4">
        {/* Glow behind the avatar */}
        <div className="absolute inset-0 w-56 h-56 sm:w-80 sm:h-80 mx-auto rounded-full bg-cyan-600/30 blur-[46px] sm:blur-[60px] animate-blob pointer-events-none" />
        <div className="absolute inset-0 w-52 h-52 sm:w-72 sm:h-72 mx-auto rounded-full bg-blue-600/20 blur-3xl animate-spin-slow pointer-events-none" />

        <AssistantAvatar
          state={assistantState}
          hoverToListen
          className="w-52 h-52 sm:w-72 sm:h-72 drop-shadow-[0_0_32px_rgba(34,211,238,0.55)] sm:drop-shadow-[0_0_40px_rgba(34,211,238,0.6)]"
        />
      </div>

      <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight text-center">
        MediAI Nine <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">Assistant</span>
      </h1>
      <p className="text-slate-400 text-xs sm:text-sm text-center max-w-xs mb-4 sm:mb-6 leading-relaxed">
        Your AI-powered medical companion. Ask questions, upload reports, or use voice to describe your symptoms.
      </p>

      {/* Feature pills */}
      <div className="flex flex-wrap gap-2 justify-center mb-4 sm:mb-8 max-w-xs sm:max-w-none">
        {[
          { icon: '🎙️', text: 'Voice Chat' },
          { icon: '🖼️', text: 'Image Analysis' },
          { icon: '📄', text: 'PDF Reports' },
          { icon: '🔬', text: 'Symptom Check' },
        ].map((f) => (
          <div key={f.text} className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] sm:text-xs text-slate-300">
            <span>{f.icon}</span>
            {f.text}
          </div>
        ))}
      </div>

      {/* Suggestion cards
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 w-full max-w-2xl">
        {suggestions.map((s) => (
          <button
            key={s.label}
            onClick={() => onSuggest(s.label)}
            className={`flex items-center gap-3 px-4 py-3 rounded-2xl bg-gradient-to-br ${s.color} border text-left text-sm text-slate-200 hover:scale-105 hover:brightness-110 active:scale-95 transition-all duration-200 group`}
          >
            <span className="text-xl">{s.icon}</span>
            <span className="group-hover:text-white transition-colors">{s.label}</span>
          </button>
        ))}
      </div> */}

      {/* Disclaimer */}
      <div className="mt-3 sm:mt-10 hidden sm:flex items-start gap-2 bg-amber-500/5 border border-amber-500/15 rounded-xl px-4 py-3 max-w-md">
        <svg className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" fill="currentColor" viewBox="0 0 20 20">
          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
        </svg>
        <p className="text-xs text-amber-400/80">
          MediAI Nine provides educational information only. It is <strong>not</strong> a substitute for professional medical advice, diagnosis, or treatment.
        </p>
      </div>
    </div>
  );
}
