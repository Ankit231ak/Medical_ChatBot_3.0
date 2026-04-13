import { useState, useRef, useCallback } from 'react';
import AssistantAvatar from './AssistantAvatar.jsx';

export default function InputBar({ onSend, isLoading, onVoiceStateChange, onEngage }) {
  const [text, setText] = useState('');
  const [files, setFiles] = useState([]);
  const [isListening, setIsListening] = useState(false);
  const [voiceError, setVoiceError] = useState(false);
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef(null);
  const recognitionRef = useRef(null);
  const textareaRef = useRef(null);
  const errorTimerRef = useRef(null);
  const initialTextRef = useRef('');

  const handleFile = useCallback((selected) => {
    const mapped = Array.from(selected).map((f) => ({
      file: f,
      name: f.name,
      type: f.type.startsWith('image/') ? 'image' : 'pdf',
      url: f.type.startsWith('image/') ? URL.createObjectURL(f) : null,
    }));
    setFiles((p) => [...p, ...mapped]);
  }, []);

  const removeFile = (i) => setFiles((p) => p.filter((_, idx) => idx !== i));

  const submit = () => {
    if (!text.trim() && files.length === 0) return;
    onSend(text.trim(), files);
    setText('');
    setFiles([]);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
  };

  const toggleVoice = () => {
    if (showVoicePanel) {
      setShowVoicePanel(false);
      stopListening();
    } else {
      setVoiceError(false);
      setShowVoicePanel(true);
    }
  };

  const triggerError = (errMessage) => {
    setIsListening(false);
    setVoiceError(errMessage || true);
    if (onVoiceStateChange) onVoiceStateChange('error');
    clearTimeout(errorTimerRef.current);
    errorTimerRef.current = setTimeout(() => {
      setVoiceError(false);
      if (onVoiceStateChange) onVoiceStateChange('idle');
    }, 4500);
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      triggerError("Speech recognition not supported on this browser context.");
      return;
    }
    setVoiceError(false);
    initialTextRef.current = text ? text + ' ' : '';

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = 'en-US';
    rec.onresult = (e) => {
      // Get all transcript chunks
      const chunks = Array.from(e.results).map((r) => r[0].transcript.trim());
      // Strip consecutive duplicates (often caused by Android Chrome bugs)
      const dedupedChunks = chunks.filter((chunk, i) => i === 0 || chunk.toLowerCase() !== chunks[i - 1].toLowerCase());
      
      setText(initialTextRef.current + dedupedChunks.join(' '));
    };
    rec.onerror = (e) => {
      let msg = "Microphone error.";
      if (e.error === 'not-allowed') msg = "Microphone access denied by browser.";
      if (e.error === 'network') msg = "Voice recognition requires an active network.";
      if (e.error === 'no-speech') msg = "No speech detected (timeout).";
      triggerError(msg);
    };
    rec.onend = () => {
      setIsListening(false);
      if (onVoiceStateChange) onVoiceStateChange('idle');
    };
    rec.start();
    recognitionRef.current = rec;
    setIsListening(true);
    if (onVoiceStateChange) onVoiceStateChange('listening');
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (onVoiceStateChange) onVoiceStateChange('idle');
  };

  const toggleListen = () => {
    if (isListening) stopListening();
    else startListening();
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files);
  };

  // Orb state: loading (AI processing) takes priority over listening/error
  const orbLoading = isLoading;
  const orbError = voiceError && !isLoading;
  const orbListening = isListening && !isLoading && !voiceError;

  return (
    <div className="relative">
      {/* Voice Panel */}
      {showVoicePanel && (
        <div className="mb-3 bg-[#070d1a]/95 backdrop-blur-xl border border-white/8 rounded-2xl p-6 flex flex-col items-center gap-5 animate-message-in">
          <div className="text-xs text-slate-500 uppercase tracking-widest font-semibold ">Voice Assistant</div>

          <div onClick={toggleListen} className="cursor-pointer hover:scale-105 transition-transform active:scale-95">
            <AssistantAvatar
              state={orbError ? 'error' : orbLoading ? 'loading' : (orbListening || showVoicePanel) ? 'listening' : 'normal'}
              className="w-32 h-32 drop-shadow-[0_0_20px_rgba(34,211,238,0.3)]"
            />
          </div>

          {/* Live transcript */}
          {text && (
            <div className="w-full max-w-sm">
              <div className="text-xs text-slate-600 mb-1.5 uppercase tracking-wider">Transcript</div>
              <div className={`text-sm text-slate-200 text-center rounded-xl px-4 py-2.5 border transition-colors duration-300 ${isListening ? 'bg-cyan-500/5 border-cyan-500/20' : 'bg-white/5 border-white/5'
                }`}>
                {text}
              </div>
            </div>
          )}

          {/* Error message */}
          {voiceError && (
            <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2 animate-message-in">
              {typeof voiceError === 'string' ? voiceError : 'Speech recognition unavailable — please type instead'}
            </div>
          )}

          {/* Controls */}
          <div className="flex gap-3 items-center">
            <button
              onClick={toggleListen}
              disabled={orbLoading || orbError}
              className={`cursor-pointer px-5 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${isListening
                ? 'bg-red-500/20 border border-red-500/30 text-red-400 hover:bg-red-500/30'
                : orbError
                  ? 'bg-slate-800 border border-slate-700 text-slate-500 cursor-not-allowed'
                  : 'bg-cyan-500/15 border border-cyan-500/25 text-cyan-400 hover:bg-cyan-500/25'
                }`}
            >
              {isListening ? 'Stop Recording' : 'Start Recording'}
            </button>
            {text && !isListening && (
              <button
                onClick={() => { submit(); setShowVoicePanel(false); stopListening(); }}
                className="px-5 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-blue-600 to-cyan-600 hover:brightness-110 text-white transition-all cursor-pointer"
              >
                Send
              </button>
            )}
          </div>
        </div>
      )}

      {/* File Preview Strip */}
      {files.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2 px-2">
          {files.map((f, i) => (
            <div key={i} className="relative group flex items-center gap-2 bg-slate-800 border border-white/10 rounded-xl px-3 py-2">
              {f.type === 'image'
                ? <img src={f.url} alt={f.name} className="w-8 h-8 rounded-lg object-cover" />
                : <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-400 text-xs font-bold">PDF</div>
              }
              <span className="text-xs text-slate-300 max-w-24 truncate">{f.name}</span>
              <button onClick={() => removeFile(i)} className="ml-1 text-slate-600 hover:text-red-400 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Main Input Box */}
      <div
        className={`group relative flex items-end gap-2 bg-slate-900/80 backdrop-blur-xl border rounded-2xl px-3 py-3 transition-all duration-500 focus-within:border-cyan-500/40 focus-within:shadow-[0_0_40px_rgba(34,211,238,0.1)] focus-within:-translate-y-1 focus-within:bg-[#0f172a] ${dragOver ? 'border-cyan-400/50 bg-cyan-400/5' : 'border-white/8 hover:border-white/15'
          }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
      >
        {/* Left controls */}
        <div className="flex items-center gap-1 pb-1">
          <button
            onClick={() => fileRef.current?.click()}
            className=" cursor-pointer w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
            title="Upload image or PDF"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
            </svg>
          </button>
          <input ref={fileRef} type="file" accept="image/*,.pdf" multiple className="hidden" onChange={(e) => handleFile(e.target.files)} />

          <button
            onClick={toggleVoice}
            className={`cursor-pointer w-8 h-8 flex items-center justify-center rounded-xl transition-all ${showVoicePanel || isListening
              ? 'text-cyan-400 bg-cyan-400/10'
              : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
              }`}
            title="Voice chat"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm8 7a1 1 0 0 1 1 1 9 9 0 0 1-8 8.94V22h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.06A9 9 0 0 1 3 11a1 1 0 0 1 2 0 7 7 0 0 0 14 0 1 1 0 0 1 1-1z" />
            </svg>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          onFocus={onEngage}
          value={text}
          onChange={(e) => { setText(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'; }}
          onKeyDown={handleKey}
          placeholder="Describe your symptoms or ask a medical question..."
          rows={1}
          className="flex-1 resize-none bg-transparent text-sm text-slate-200 placeholder-slate-600 outline-none leading-6 py-1 min-h-[32px] max-h-[160px] overflow-y-auto scrollbar-thin"
          style={{ height: '32px' }}
        />

        {/* Send Button */}
        <div className="flex items-center pb-1">
          <button
            onClick={submit}
            disabled={isLoading || (!text.trim() && files.length === 0)}
            className={`cursor-pointer w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${(text.trim() || files.length > 0) && !isLoading
              ? 'bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-lg shadow-blue-900/40 hover:scale-105 active:scale-95'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
              }`}
          >
            {isLoading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Hint */}
      <div className="flex items-center justify-between px-1 mt-1.5">
        {/* <div className="text-xs text-slate-700">Supports images & PDF • Drag & drop files</div> */}
        <div className="text-xs text-slate-700">Enter to send • Shift+Enter for newline</div>
      </div>
    </div>
  );
}
