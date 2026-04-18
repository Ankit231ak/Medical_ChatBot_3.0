import { useState } from 'react';
import ReactMarkdown from 'react-markdown';

function FilePreview({ file }) {
  if (file.type === 'image') {
    return (
      <div className="mt-2 rounded-xl overflow-hidden max-w-xs border border-white/10">
        <img src={file.url} alt={file.name} className="w-full h-40 object-cover" />
        <div className="px-2 py-1 bg-white/5 text-xs text-slate-400">{file.name}</div>
      </div>
    );
  }
  if (file.type === 'pdf') {
    return (
      <div className="mt-2 flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-xl px-3 py-2 max-w-xs">
        <svg className="w-8 h-8 text-red-400 shrink-0" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 4h5v7h7v9H6V4zm2 8v1h8v-1H8zm0 3v1h8v-1H8zm0-6v1h3V9H8z" />
        </svg>
        <div>
          <div className="text-xs font-medium text-red-300">{file.name}</div>
          <div className="text-xs text-slate-500">PDF Document</div>
        </div>
      </div>
    );
  }
  return null;
}

function TypingIndicator() {
  return (
    <div className="flex items-center gap-1.5 py-3 px-4">
      <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
      <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
      <div className="w-2 h-2 rounded-full bg-cyan-400 typing-dot" />
    </div>
  );
}

function DisclaimerBadge() {
  return (
    <div className="flex items-center gap-1 mt-2 text-xs text-amber-400/70">
      <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
      </svg>
      Not a substitute for professional medical advice
    </div>
  );
}

export default function ChatMessage({ message }) {
  const [copied, setCopied] = useState(false);
  const isAI = message.role === 'assistant';

  const copy = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={`flex gap-3 animate-message-in ${isAI ? 'justify-start' : 'justify-end'}`}>
      {/* AI Avatar */}
      {isAI && (
        <div className="shrink-0 w-9 h-9 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 flex items-center justify-center shadow-lg shadow-blue-900/30">
          <img
            src="/videos/mimo.png"
            alt="AI Avatar"
            className="w-full h-full object-cover rounded-4xl"
          />
        </div>
      )}

      <div className={`flex flex-col max-w-[80%] gap-1 ${isAI ? 'items-start' : 'items-end'}`}>
        {/* File previews */}
        {message.files?.map((f, i) => <FilePreview key={i} file={f} />)}

        {/* Bubble */}
        {message.isTyping ? (
          <div className="bg-slate-800/80 border border-white/5 rounded-2xl rounded-tl-sm">
            <TypingIndicator />
          </div>
        ) : message.content && (
          <div className={`relative group rounded-2xl px-6 py-3 leading-relaxed text-sm ${isAI
            ? 'bg-slate-800/80 border border-white/5 text-slate-200 rounded-tl-sm'
            : 'bg-gradient-to-br from-blue-600 to-cyan-600 text-white rounded-tr-sm shadow-lg shadow-blue-900/30'
            }`}>
            {/* Shimmer overlay for AI */}
            {isAI && <div className="absolute inset-0 rounded-2xl animate-shimmer pointer-events-none rounded-tl-sm" />}

            <div className={`relative flex-1 w-full text-[15px] leading-relaxed
              [&>p]:mb-3 [&>p:last-child]:mb-0
              [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:my-2
              [&>ol]:list-decimal [&>ol]:pl-5 [&>ol]:my-2
              [&>h1]:font-bold [&>h1]:text-xl [&>h1]:mt-4 [&>h1]:mb-2
              [&>h2]:font-bold [&>h2]:text-lg [&>h2]:mt-3 [&>h2]:mb-2
              [&>h3]:font-semibold [&>h3]:text-base [&>h3]:mt-2 [&>h3]:mb-1
              [&>strong]:font-bold [&>strong]:text-cyan-200
            `}>
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>

            {/* Copy button */}
            {isAI && (
              <button
                onClick={copy}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white"
              >
                {copied
                  ? <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                  : <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1" /></svg>
                }
              </button>
            )}
          </div>
        )}

        {isAI && !message.isTyping && message.content && <DisclaimerBadge />}

        {/* Timestamp */}
        {message.time && (
          <div className="text-xs text-slate-600 px-1">{message.time}</div>
        )}
      </div>

      {/* User Avatar */}
      {!isAI && (
        <div className="shrink-0 w-9 h-9 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
          </svg>
        </div>
      )}
    </div>
  );
}
