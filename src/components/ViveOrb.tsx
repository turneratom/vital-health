import { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

export type LogSource = 'Voice' | 'Photo' | 'Input' | 'Sync';

export interface OrbLogResult {
  type: 'food' | 'activity';
  name: string;
  calories: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  duration?: number;
  distance?: number;
  activityType?: string;
  source: LogSource;
}

interface ViveOrbModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLog: (result: OrbLogResult) => void;
  onVisionMirror?: () => void;
  initialMode?: 'idle' | 'voice' | 'photo';
}

/* ── Mock AI parsers ── */
function parseVoiceInput(transcript: string): OrbLogResult {
  const lower = transcript.toLowerCase();
  if (lower.includes('run') || lower.includes('jog') || lower.includes('mile')) {
    const miles = parseFloat(lower.match(/(\d+\.?\d*)\s*mile/)?.[1] || '3');
    return { type: 'activity', name: `${miles} mile run`, calories: Math.round(miles * 100), duration: Math.round(miles * 10), distance: miles, activityType: 'Running', source: 'Voice' };
  }
  if (lower.includes('walk')) {
    return { type: 'activity', name: 'Walking', calories: 180, duration: 30, distance: 1.5, activityType: 'Walking', source: 'Voice' };
  }
  if (lower.includes('workout') || lower.includes('gym') || lower.includes('lift')) {
    return { type: 'activity', name: 'Strength Training', calories: 320, duration: 45, activityType: 'Strength', source: 'Voice' };
  }
  const name = transcript.charAt(0).toUpperCase() + transcript.slice(1);
  if (lower.includes('burger') || lower.includes('hamburger')) {
    return { type: 'food', name: 'Hamburger', calories: 600, protein: 32, carbs: 45, fat: 34, source: 'Voice' };
  }
  if (lower.includes('salad')) {
    return { type: 'food', name: 'Garden Salad', calories: 220, protein: 12, carbs: 18, fat: 14, source: 'Voice' };
  }
  if (lower.includes('chicken')) {
    return { type: 'food', name: 'Grilled Chicken', calories: 420, protein: 48, carbs: 12, fat: 18, source: 'Voice' };
  }
  if (lower.includes('coffee') || lower.includes('latte')) {
    return { type: 'food', name: 'Coffee Latte', calories: 150, protein: 8, carbs: 18, fat: 6, source: 'Voice' };
  }
  return { type: 'food', name, calories: 350, protein: 20, carbs: 35, fat: 15, source: 'Voice' };
}

function parsePhotoInput(): OrbLogResult {
  const foods = [
    { name: 'Avocado Toast', calories: 380, protein: 12, carbs: 42, fat: 22 },
    { name: 'Acai Bowl', calories: 420, protein: 8, carbs: 65, fat: 14 },
    { name: 'Grilled Salmon', calories: 450, protein: 46, carbs: 4, fat: 28 },
  ];
  const pick = foods[Math.floor(Math.random() * foods.length)];
  return { type: 'food', ...pick, source: 'Photo' };
}

export function ViveOrbModal({ isOpen, onClose, onLog, onVisionMirror, initialMode = 'idle' }: ViveOrbModalProps) {
  const ghostMode = useGhostMode();
  const [mode, setMode] = useState<'idle' | 'voice' | 'menu' | 'text' | 'photo'>('idle');
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [textInput, setTextInput] = useState('');
  const [photoProcessing, setPhotoProcessing] = useState(false);
  const [waveformBars, setWaveformBars] = useState<number[]>(Array(24).fill(0.15));
  const holdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const animFrameRef = useRef(0);
  const wavePhaseRef = useRef(0);
  const initialModeAppliedRef = useRef(false);

  const neon = ghostMode ? "rgba(160,160,160," : "rgba(0,255,204,";
  const neonHex = ghostMode ? "#a0a0a0" : "#00FFCC";

  // Apply initialMode when modal opens
  useEffect(() => {
    if (isOpen) {
      setTranscript('');
      setTextInput('');
      setPhotoProcessing(false);
      initialModeAppliedRef.current = false;

      if (initialMode === 'voice') {
        setMode('voice');
        setIsListening(true);
        initialModeAppliedRef.current = true;
      } else if (initialMode === 'photo') {
        setMode('photo');
        setPhotoProcessing(true);
        initialModeAppliedRef.current = true;
        // Simulate photo capture + AI recognition
        setTimeout(() => {
          setPhotoProcessing(false);
          const result = parsePhotoInput();
          onLog(result);
          onClose();
        }, 1800);
      } else {
        // idle → show menu immediately
        setMode('menu');
        setIsListening(false);
      }
    }
  }, [isOpen, initialMode, onLog, onClose]);

  // Waveform animation when listening
  useEffect(() => {
    if (!isListening) {
      setWaveformBars(Array(24).fill(0.15));
      return;
    }
    const animate = () => {
      wavePhaseRef.current += 0.08;
      const phase = wavePhaseRef.current;
      const bars = Array.from({ length: 24 }, (_, i) => {
        const base = 0.2;
        const wave1 = Math.sin(phase + i * 0.4) * 0.3;
        const wave2 = Math.sin(phase * 1.7 + i * 0.25) * 0.2;
        const wave3 = Math.cos(phase * 0.6 + i * 0.6) * 0.15;
        const noise = Math.random() * 0.1;
        return Math.max(0.08, Math.min(1, base + wave1 + wave2 + wave3 + noise));
      });
      setWaveformBars(bars);
      animFrameRef.current = requestAnimationFrame(animate);
    };
    animFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [isListening]);

  const handleOrbPointerDown = useCallback(() => {
    if (mode !== 'menu' && mode !== 'idle') return;
    holdTimerRef.current = setTimeout(() => {
      setMode('voice');
      setIsListening(true);
      setTranscript('');
    }, 400);
  }, [mode]);

  const handleOrbPointerUp = useCallback(() => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current);
      holdTimerRef.current = null;
    }
    if (isListening) {
      setIsListening(false);
      const mockTranscripts = ['Logging hamburger', '3 mile run this morning', 'Grilled chicken salad for lunch', 'Coffee latte'];
      const picked = mockTranscripts[Math.floor(Math.random() * mockTranscripts.length)];
      setTranscript(picked);
      setTimeout(() => {
        const result = parseVoiceInput(picked);
        onLog(result);
        onClose();
      }, 1200);
    }
  }, [isListening, onLog, onClose]);

  const handleOrbClick = useCallback(() => {
    if (!isListening && mode === 'idle') {
      setMode('menu');
    }
  }, [isListening, mode]);

  const handlePhotoLog = useCallback(() => {
    setMode('photo');
    setPhotoProcessing(true);
    setTimeout(() => {
      setPhotoProcessing(false);
      const result = parsePhotoInput();
      onLog(result);
      onClose();
    }, 1800);
  }, [onLog, onClose]);

  const handleVoiceMode = useCallback(() => {
    setMode('voice');
    setIsListening(true);
    setTranscript('');
  }, []);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    const result = parseVoiceInput(textInput);
    result.source = 'Input';
    onLog(result);
    onClose();
  }, [textInput, onLog, onClose]);

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[300] flex items-center justify-center"
        onClick={onClose}
      >
        {/* Backdrop */}
        <div className="absolute inset-0" style={{
          background: ghostMode ? "rgba(0,0,0,0.85)" : "rgba(0,0,0,0.8)",
          backdropFilter: "blur(20px)",
        }} />

        {/* Content */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          className="relative z-10 flex flex-col items-center gap-6 px-8 py-10 max-w-sm w-full"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ── Voice transcript feedback ── */}
          <AnimatePresence mode="wait">
            {mode === 'voice' && (
              <motion.div
                key="voice-feedback"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <p className="text-[11px] font-mono uppercase tracking-widest mb-2" style={{ color: `${neon}0.5)` }}>
                  {isListening ? "Listening..." : "Processing..."}
                </p>
                {transcript && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[15px] font-medium"
                    style={{ color: ghostMode ? "rgba(220,220,220,0.8)" : "rgba(255,255,255,0.9)" }}
                  >
                    &ldquo;{transcript}&rdquo;
                  </motion.p>
                )}
              </motion.div>
            )}

            {/* ── Photo processing feedback ── */}
            {mode === 'photo' && (
              <motion.div
                key="photo-feedback"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="text-center"
              >
                <p className="text-[11px] font-mono uppercase tracking-widest mb-2" style={{ color: ghostMode ? "rgba(160,160,160,0.5)" : "rgba(48,209,88,0.6)" }}>
                  {photoProcessing ? "Analyzing photo..." : "Identified!"}
                </p>
                {photoProcessing && (
                  <div className="flex justify-center mt-3">
                    <div className="w-6 h-6 rounded-full border-2 border-t-transparent"
                      style={{
                        borderColor: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(48,209,88,0.4)",
                        borderTopColor: 'transparent',
                        animation: 'spin 0.8s linear infinite',
                      }} />
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Central Orb ── */}
          <div className="relative flex items-center justify-center" style={{ width: 140, height: 140 }}>
            {/* Ambient glow */}
            <div
              className="absolute rounded-full pointer-events-none"
              style={{
                width: 160, height: 160,
                background: isListening
                  ? `radial-gradient(circle, ${neon}0.3) 0%, transparent 70%)`
                  : mode === 'photo'
                    ? `radial-gradient(circle, ${ghostMode ? "rgba(160,160,160,0.2)" : "rgba(48,209,88,0.25)"} 0%, transparent 70%)`
                    : `radial-gradient(circle, ${neon}0.12) 0%, transparent 70%)`,
                filter: "blur(20px)",
                transition: "all 0.5s ease",
              }}
            />

            {/* Pulse rings when listening */}
            {isListening && (
              <>
                <motion.div
                  className="absolute rounded-full pointer-events-none"
                  animate={{ scale: [1, 2], opacity: [0.3, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
                  style={{ width: 100, height: 100, border: `1.5px solid ${neon}0.25)` }}
                />
                <motion.div
                  className="absolute rounded-full pointer-events-none"
                  animate={{ scale: [1, 2.2], opacity: [0.2, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
                  style={{ width: 100, height: 100, border: `1px solid ${neon}0.15)` }}
                />
              </>
            )}

            {/* Photo scan rings */}
            {mode === 'photo' && photoProcessing && (
              <motion.div
                className="absolute rounded-full pointer-events-none"
                animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                transition={{ duration: 1.2, repeat: Infinity, ease: "easeOut" }}
                style={{ width: 100, height: 100, border: `2px solid ${ghostMode ? "rgba(160,160,160,0.3)" : "rgba(48,209,88,0.35)"}` }}
              />
            )}

            {/* Main orb */}
            <motion.button
              onPointerDown={handleOrbPointerDown}
              onPointerUp={handleOrbPointerUp}
              onPointerLeave={handleOrbPointerUp}
              onClick={handleOrbClick}
              animate={{
                scale: isListening ? 1.1 : mode === 'photo' ? 1.05 : 1,
                boxShadow: isListening
                  ? `0 0 40px ${neon}0.4), 0 0 80px ${neon}0.15), inset 0 0 20px ${neon}0.1)`
                  : `0 0 20px ${neon}0.2), 0 0 40px ${neon}0.08), inset 0 0 12px ${neon}0.05)`,
              }}
              transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
              className="relative z-10 rounded-full flex items-center justify-center cursor-pointer"
              style={{
                width: 100, height: 100,
                background: isListening
                  ? `radial-gradient(circle at 35% 35%, ${neon}0.25) 0%, ${neon}0.1) 40%, rgba(10,10,10,0.9) 100%)`
                  : mode === 'photo'
                    ? `radial-gradient(circle at 35% 35%, ${ghostMode ? "rgba(160,160,160,0.15)" : "rgba(48,209,88,0.15)"} 0%, rgba(10,10,10,0.95) 100%)`
                    : `radial-gradient(circle at 35% 35%, ${neon}0.12) 0%, ${neon}0.04) 40%, rgba(10,10,10,0.95) 100%)`,
                border: `2px solid ${neon}${isListening ? '0.5)' : '0.2)'}`,
              }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Waveform inside orb */}
              <div className="flex items-center justify-center gap-[1.5px]" style={{ width: '65%', height: '45%' }}>
                {waveformBars.map((bar, i) => (
                  <motion.div
                    key={i}
                    className="rounded-full"
                    animate={{
                      height: `${bar * 100}%`,
                      opacity: isListening ? 0.6 + bar * 0.4 : 0.2 + bar * 0.15,
                    }}
                    transition={{ duration: 0.08 }}
                    style={{
                      width: 2, minHeight: 2,
                      background: isListening ? `${neon}${0.5 + bar * 0.5})` : `${neon}0.25)`,
                      boxShadow: isListening ? `0 0 ${bar * 4}px ${neon}${bar * 0.3})` : 'none',
                    }}
                  />
                ))}
              </div>
            </motion.button>
          </div>

          {/* ── Instruction text for voice mode ── */}
          {mode === 'voice' && !transcript && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-[12px] font-mono text-center"
              style={{ color: `${neon}0.4)` }}
            >
              {isListening ? "Speak now... release to process" : "Hold the orb to speak"}
            </motion.p>
          )}

          {/* ── Menu mode: 3 options ── */}
          <AnimatePresence>
            {mode === 'menu' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                transition={{ duration: 0.25 }}
                className="flex flex-col gap-3 w-full"
              >
                {/* Ask / Text */}
                <button
                  onClick={() => setMode('text')}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: ghostMode ? "rgba(255,255,255,0.03)" : "rgba(100,210,255,0.06)",
                    borderColor: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(100,210,255,0.15)",
                  }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                    background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(100,210,255,0.12)",
                  }}>
                    <span className="text-lg" style={{ filter: ghostMode ? "grayscale(1) opacity(0.5)" : "none" }}>💬</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] font-medium" style={{ color: ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.9)" }}>
                      Ask
                    </span>
                    <span className="text-[11px]" style={{ color: `${neon}0.35)` }}>
                      Type food, activity, or a question
                    </span>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : "#64D2FF" }} />
                </button>

                {/* Photo */}
                <button
                  onClick={handlePhotoLog}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: ghostMode ? "rgba(255,255,255,0.03)" : "rgba(48,209,88,0.06)",
                    borderColor: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(48,209,88,0.15)",
                  }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                    background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(48,209,88,0.12)",
                  }}>
                    <span className="text-lg" style={{ filter: ghostMode ? "grayscale(1) opacity(0.5)" : "none" }}>📸</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] font-medium" style={{ color: ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.9)" }}>
                      Photo
                    </span>
                    <span className="text-[11px]" style={{ color: `${neon}0.35)` }}>
                      AI identifies your meal instantly
                    </span>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : "#30D158" }} />
                </button>

                {/* Voice */}
                <button
                  onClick={handleVoiceMode}
                  className="flex items-center gap-4 px-5 py-4 rounded-2xl border transition-all duration-200 active:scale-[0.98]"
                  style={{
                    background: ghostMode ? "rgba(255,255,255,0.03)" : "rgba(0,255,204,0.06)",
                    borderColor: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,255,204,0.15)",
                  }}
                >
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{
                    background: ghostMode ? "rgba(160,160,160,0.08)" : "rgba(0,255,204,0.12)",
                  }}>
                    <span className="text-lg" style={{ filter: ghostMode ? "grayscale(1) opacity(0.5)" : "none" }}>🎙️</span>
                  </div>
                  <div className="flex flex-col items-start">
                    <span className="text-[14px] font-medium" style={{ color: ghostMode ? "rgba(220,220,220,0.7)" : "rgba(255,255,255,0.9)" }}>
                      Voice
                    </span>
                    <span className="text-[11px]" style={{ color: `${neon}0.35)` }}>
                      Speak to log or ask anything
                    </span>
                  </div>
                  <div className="ml-auto w-2 h-2 rounded-full" style={{ background: ghostMode ? "rgba(160,160,160,0.3)" : neonHex }} />
                </button>

                {/* Vision Mirror shortcut */}
                {onVisionMirror && (
                  <button
                    onClick={() => { onVisionMirror(); onClose(); }}
                    className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[11px] font-mono uppercase tracking-wider transition-all duration-200 active:scale-[0.98] mt-1"
                    style={{
                      background: 'rgba(255,255,255,0.02)',
                      border: '1px solid rgba(255,255,255,0.06)',
                      color: 'rgba(255,255,255,0.3)',
                    }}
                  >
                    <span style={{ fontSize: 14 }}>🧠</span>
                    Open Briefing Room
                  </button>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── Text input mode ── */}
          <AnimatePresence>
            {mode === 'text' && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
                className="w-full flex flex-col gap-3"
              >
                <p className="text-[11px] font-mono uppercase tracking-widest text-center" style={{ color: `${neon}0.4)` }}>
                  Describe your food or activity
                </p>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleTextSubmit()}
                    placeholder="e.g. Grilled chicken salad..."
                    autoFocus
                    className="flex-1 px-4 py-3 rounded-xl text-[14px] outline-none"
                    style={{
                      background: ghostMode ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.06)",
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : "rgba(0,255,204,0.15)"}`,
                      color: ghostMode ? "rgba(220,220,220,0.8)" : "rgba(255,255,255,0.9)",
                    }}
                  />
                  <button
                    onClick={handleTextSubmit}
                    className="px-5 py-3 rounded-xl font-semibold text-[13px] transition-all duration-200 active:scale-95"
                    style={{
                      background: ghostMode ? "rgba(160,160,160,0.15)" : "rgba(0,255,204,0.15)",
                      color: neonHex,
                      border: `1px solid ${ghostMode ? "rgba(160,160,160,0.2)" : "rgba(0,255,204,0.25)"}`,
                    }}
                  >
                    Log
                  </button>
                </div>
                <button
                  onClick={() => setMode('menu')}
                  className="text-[11px] font-mono uppercase tracking-wider self-center mt-1"
                  style={{ color: `${neon}0.35)` }}
                >
                  ← Back
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
