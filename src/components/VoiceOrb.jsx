import { useEffect, useRef, useState } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATE_COLORS = {
  normal:    ['#3b82f6', '#6366f1', '#8b5cf6', '#06b6d4'],
  listening: ['#06b6d4', '#10b981', '#3b82f6', '#a78bfa'],
  loading:   ['#6366f1', '#8b5cf6', '#ec4899', '#3b82f6'],
  error:     ['#ef4444', '#f97316', '#fbbf24', '#dc2626'],
};

const STATE_SPEED = {
  normal:    0.4,
  listening: 1.8,
  loading:   1.0,
  error:     1.2,
};

const STATE_RADIUS = {
  normal:    0.34,
  listening: 0.40,
  loading:   0.36,
  error:     0.36,
};

// ─── Blob class ───────────────────────────────────────────────────────────────

class Blob {
  constructor(canvas, color, offset, speed, radiusFactor) {
    this.canvas = canvas;
    this.color = color;
    this.offset = offset;
    this.speed = speed;
    this.radiusFactor = radiusFactor;
    this.t = Math.random() * Math.PI * 2;
    this.ox = (Math.random() - 0.5) * 0.3;
    this.oy = (Math.random() - 0.5) * 0.3;
  }

  update(dt, audioLevel = 0) {
    this.t += dt * this.speed;
  }

  draw(ctx, size, audioLevel = 0) {
    const cx = size / 2 + Math.cos(this.t * 0.7 + this.offset) * size * (0.12 + this.ox * 0.5);
    const cy = size / 2 + Math.sin(this.t * 0.5 + this.offset * 1.3) * size * (0.12 + this.oy * 0.5);
    const r = size * (this.radiusFactor + audioLevel * 0.08 + Math.sin(this.t * 1.1) * 0.03);

    const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
    grad.addColorStop(0, this.color + 'ff');
    grad.addColorStop(0.5, this.color + 'aa');
    grad.addColorStop(1, this.color + '00');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

// ─── Canvas renderer ──────────────────────────────────────────────────────────

function useVoiceCanvas(canvasRef, state, audioLevel) {
  const blobsRef = useRef([]);
  const rafRef = useRef(null);
  const lastRef = useRef(null);
  const shakeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const size = canvas.width;

    // Re-create blobs when state changes
    const colors = STATE_COLORS[state];
    const speed = STATE_SPEED[state];
    const radius = STATE_RADIUS[state];

    blobsRef.current = colors.map((color, i) =>
      new Blob(canvas, color, (i / colors.length) * Math.PI * 2, speed, radius)
    );

    if (state === 'error') shakeRef.current = 1;

    function draw(ts) {
      if (!lastRef.current) lastRef.current = ts;
      const dt = Math.min((ts - lastRef.current) / 1000, 0.05);
      lastRef.current = ts;

      ctx.clearRect(0, 0, size, size);

      // Clip to circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
      ctx.clip();

      // Background gradient per state
      const bgGrad = ctx.createRadialGradient(size/2, size/2, 0, size/2, size/2, size/2);
      if (state === 'error') {
        bgGrad.addColorStop(0, '#1a0505');
        bgGrad.addColorStop(1, '#0d0000');
      } else if (state === 'listening') {
        bgGrad.addColorStop(0, '#021a12');
        bgGrad.addColorStop(1, '#010d1a');
      } else if (state === 'loading') {
        bgGrad.addColorStop(0, '#0d0a1a');
        bgGrad.addColorStop(1, '#050310');
      } else {
        bgGrad.addColorStop(0, '#060c1a');
        bgGrad.addColorStop(1, '#030610');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, size, size);

      // Shake offset for error
      let sx = 0;
      if (shakeRef.current > 0) {
        shakeRef.current -= dt * 3;
        sx = Math.sin(ts / 30) * shakeRef.current * 8;
      }
      ctx.translate(sx, 0);

      // Draw blobs
      ctx.globalCompositeOperation = 'screen';
      blobsRef.current.forEach((b) => {
        b.update(dt, audioLevel);
        b.draw(ctx, size, audioLevel);
      });

      // Extra reactive ring for listening
      if (state === 'listening' && audioLevel > 0.2) {
        ctx.globalCompositeOperation = 'screen';
        const ringR = size * (0.45 + audioLevel * 0.05);
        const ringGrad = ctx.createRadialGradient(size/2, size/2, ringR - 4, size/2, size/2, ringR + 4);
        ringGrad.addColorStop(0, `rgba(6,182,212,${audioLevel * 0.6})`);
        ringGrad.addColorStop(1, 'rgba(6,182,212,0)');
        ctx.fillStyle = ringGrad;
        ctx.beginPath();
        ctx.arc(size/2, size/2, ringR + 4, 0, Math.PI * 2);
        ctx.fill();
      }

      // Loading orbit dot
      if (state === 'loading') {
        ctx.globalCompositeOperation = 'screen';
        const angle = (ts / 800) * Math.PI * 2;
        const orbitR = size * 0.3;
        const dotX = size/2 + Math.cos(angle) * orbitR;
        const dotY = size/2 + Math.sin(angle) * orbitR;
        const dotR = size * 0.07;
        const dg = ctx.createRadialGradient(dotX, dotY, 0, dotX, dotY, dotR);
        dg.addColorStop(0, '#fff');
        dg.addColorStop(0.4, 'rgba(168,139,250,0.9)');
        dg.addColorStop(1, 'rgba(99,102,241,0)');
        ctx.fillStyle = dg;
        ctx.beginPath();
        ctx.arc(dotX, dotY, dotR, 0, Math.PI * 2);
        ctx.fill();

        const angle2 = angle + (Math.PI * 2 / 3);
        const dotX2 = size/2 + Math.cos(angle2) * orbitR;
        const dotY2 = size/2 + Math.sin(angle2) * orbitR;
        const dg2 = ctx.createRadialGradient(dotX2, dotY2, 0, dotX2, dotY2, dotR * 0.8);
        dg2.addColorStop(0, 'rgba(236,72,153,0.9)');
        dg2.addColorStop(1, 'rgba(236,72,153,0)');
        ctx.fillStyle = dg2;
        ctx.beginPath();
        ctx.arc(dotX2, dotY2, dotR * 0.8, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      // Vignette overlay
      const vigGrad = ctx.createRadialGradient(size/2, size/2, size * 0.25, size/2, size/2, size/2);
      vigGrad.addColorStop(0, 'rgba(0,0,0,0)');
      vigGrad.addColorStop(1, 'rgba(0,0,0,0.55)');
      ctx.fillStyle = vigGrad;
      ctx.fillRect(0, 0, size, size);

      ctx.restore();

      rafRef.current = requestAnimationFrame(draw);
    }

    lastRef.current = null;
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(rafRef.current);
      lastRef.current = null;
    };
  }, [state, canvasRef]);

  // Keep audioLevel in sync without restarting loop
  const audioRef = useRef(audioLevel);
  useEffect(() => { audioRef.current = audioLevel; }, [audioLevel]);
}

// ─── Waveform bars (inside orb for listening) ─────────────────────────────────

function WaveBars({ audioLevel }) {
  const bars = 12;
  return (
    <div className="flex items-center justify-center gap-[2px] h-9 w-20">
      {Array.from({ length: bars }).map((_, i) => {
        const phase = (i / bars) * Math.PI * 2;
        const base = 4;
        const reactive = audioLevel * 28;
        const wave = Math.abs(Math.sin(phase)) * 10;
        return (
          <div
            key={i}
            className="rounded-full bg-white/80"
            style={{
              width: 2.5,
              height: base + wave + reactive,
              transition: 'height 0.07s ease',
            }}
          />
        );
      })}
    </div>
  );
}

// ─── Main VoiceOrb component ──────────────────────────────────────────────────

export default function VoiceOrb({ isListening, isSpeaking, isLoading, isError, onClick }) {
  const canvasRef = useRef(null);
  const [audioLevel, setAudioLevel] = useState(0);

  // Derive state
  const state = isError ? 'error'
    : isLoading ? 'loading'
    : isListening ? 'listening'
    : 'normal';

  // Simulate audio reactivity
  useEffect(() => {
    if (!isListening && !isSpeaking) { setAudioLevel(0); return; }
    const id = setInterval(() => setAudioLevel(Math.random()), 80);
    return () => clearInterval(id);
  }, [isListening, isSpeaking]);

  useVoiceCanvas(canvasRef, state, audioLevel);

  // Outer ring glow colors per state
  const ringColor = {
    normal:    'rgba(59,130,246,0.25)',
    listening: 'rgba(6,182,212,0.35)',
    loading:   'rgba(139,92,246,0.30)',
    error:     'rgba(239,68,68,0.35)',
  }[state];

  const ringColor2 = {
    normal:    'rgba(99,102,241,0.15)',
    listening: 'rgba(16,185,129,0.20)',
    loading:   'rgba(236,72,153,0.20)',
    error:     'rgba(249,115,22,0.20)',
  }[state];

  const glowColor = {
    normal:    'rgba(59,130,246,0.20)',
    listening: 'rgba(6,182,212,0.30)',
    loading:   'rgba(139,92,246,0.25)',
    error:     'rgba(239,68,68,0.30)',
  }[state];

  const labelText = isError ? '✕ Error — try again'
    : isLoading ? '◌ Processing...'
    : isListening ? '● Listening...'
    : isSpeaking ? '◈ Speaking...'
    : 'Tap to speak';

  const labelColor = isError ? 'text-red-400'
    : isLoading ? 'text-purple-400'
    : isListening ? 'text-cyan-400'
    : isSpeaking ? 'text-blue-400'
    : 'text-slate-500';

  return (
    <div className="flex flex-col items-center gap-4 select-none">
      <div
        className="relative flex items-center justify-center cursor-pointer"
        onClick={onClick}
        style={{ width: 140, height: 140 }}
      >
        {/* Ambient glow */}
        <div
          className="absolute rounded-full blur-2xl transition-all duration-700"
          style={{
            width: 140, height: 140,
            background: glowColor,
            transform: isListening ? `scale(${1.1 + audioLevel * 0.15})` : 'scale(1)',
          }}
        />

        {/* Pulse rings */}
        {(isListening || isSpeaking || isLoading) && (
          <>
            <div
              className="absolute rounded-full animate-pulse-ring"
              style={{
                width: 140, height: 140,
                border: `1.5px solid ${ringColor}`,
              }}
            />
            <div
              className="absolute rounded-full animate-pulse-ring"
              style={{
                width: 120, height: 120,
                border: `1.5px solid ${ringColor2}`,
                animationDelay: '0.7s',
              }}
            />
          </>
        )}

        {/* Canvas orb */}
        <canvas
          ref={canvasRef}
          width={112}
          height={112}
          className="relative z-10 rounded-full transition-transform duration-200 hover:scale-105 active:scale-95"
          style={{
            boxShadow: `0 0 32px ${glowColor}, 0 0 8px rgba(0,0,0,0.6)`,
          }}
        />

        {/* Overlay: waveform for listening */}
        {isListening && (
          <div className="absolute z-20 flex items-center justify-center pointer-events-none">
            <WaveBars audioLevel={audioLevel} />
          </div>
        )}

        {/* Overlay: spinner ring for loading */}
        {isLoading && (
          <div
            className="absolute z-20 rounded-full animate-spin pointer-events-none"
            style={{
              width: 104, height: 104,
              border: '2px solid transparent',
              borderTopColor: 'rgba(139,92,246,0.7)',
              borderRightColor: 'rgba(236,72,153,0.4)',
            }}
          />
        )}

        {/* Overlay: X icon for error */}
        {isError && (
          <div className="absolute z-20 flex items-center justify-center pointer-events-none">
            <svg className="w-10 h-10 text-red-300 drop-shadow-lg" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/>
            </svg>
          </div>
        )}

        {/* Overlay: mic icon for normal/speaking */}
        {!isListening && !isLoading && !isError && (
          <div className="absolute z-20 flex items-center justify-center pointer-events-none">
            <svg
              className="w-9 h-9 drop-shadow-lg transition-all duration-300"
              style={{ color: isSpeaking ? '#67e8f9' : 'rgba(255,255,255,0.85)' }}
              fill="currentColor"
              viewBox="0 0 24 24"
            >
              <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4zm0 2a2 2 0 0 0-2 2v6a2 2 0 0 0 4 0V5a2 2 0 0 0-2-2zm8 7a1 1 0 0 1 1 1 9 9 0 0 1-8 8.94V22h2a1 1 0 0 1 0 2H9a1 1 0 0 1 0-2h2v-2.06A9 9 0 0 1 3 11a1 1 0 0 1 2 0 7 7 0 0 0 14 0 1 1 0 0 1 1-1z"/>
            </svg>
          </div>
        )}
      </div>

      {/* Status label */}
      <span className={`text-xs font-medium tracking-widest uppercase transition-colors duration-300 ${labelColor}`}>
        {labelText}
      </span>
    </div>
  );
}
