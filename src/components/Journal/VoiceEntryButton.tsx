import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceCategorizer, type CategorizedEntry, type VoiceCategory } from '@/lib/useAI';

const CYAN = '#00F2FF';
const PURPLE = '#BF5AF2';

const CATEGORY_STYLES: Record<VoiceCategory, { bg: string; border: string; glow: string }> = {
  Mood: { bg: 'rgba(107,138,255,0.08)', border: 'rgba(107,138,255,0.25)', glow: 'rgba(107,138,255,0.3)' },
  Pain: { bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.25)', glow: 'rgba(255,107,107,0.3)' },
  Energy: { bg: 'rgba(255,215,0,0.08)', border: 'rgba(255,215,0,0.25)', glow: 'rgba(255,215,0,0.3)' },
};

interface VoiceEntryButtonProps {
  ghostMode: boolean;
  onEntryComplete: (entry: CategorizedEntry) => void;
  disabled?: boolean;
}

export function VoiceEntryButton({ ghostMode, onEntryComplete, disabled }: VoiceEntryButtonProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [result, setResult] = useState<CategorizedEntry | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { categorize } = useVoiceCategorizer();

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  // Auto-dismiss result after 4s
  useEffect(() => {
    if (result) {
      const t = setTimeout(() => setResult(null), 4000);
      return () => clearTimeout(t);
    }
  }, [result]);

  const startListening = useCallback(async () => {
    if (isListening || isProcessing || disabled) return;
    setError(null);
    setResult(null);
    setTranscript('');

    // Check for Web Speech API support
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      // Fallback: simulate voice input for demo
      setIsListening(true);
      const demoTranscripts = [
        'Feeling really energized after my morning run today',
        'My lower back is a bit sore from yesterday\'s deadlifts',
        'Mood is great, slept really well last night',
        'Energy crashed after lunch, feeling sluggish',
        'Knee pain is improving, less stiff than yesterday',
        'Feeling anxious about the week ahead but trying to stay calm',
      ];
      const picked = demoTranscripts[Math.floor(Math.random() * demoTranscripts.length)];
      
      // Simulate listening for 2s then transcribe
      timeoutRef.current = setTimeout(async () => {
        setTranscript(picked);
        setIsListening(false);
        setIsProcessing(true);
        
        try {
          const categorized = await categorize(picked);
          setResult(categorized);
          onEntryComplete(categorized);
        } catch {
          setError('Could not process entry');
        } finally {
          setIsProcessing(false);
        }
      }, 2200);
      return;
    }

    // Real Web Speech API
    try {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      recognition.maxAlternatives = 1;
      recognitionRef.current = recognition;

      let finalTranscript = '';

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const t = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += t;
          } else {
            interim += t;
          }
        }
        setTranscript(finalTranscript || interim);
      };

      recognition.onend = async () => {
        setIsListening(false);
        const text = finalTranscript.trim();
        if (!text) {
          setError('No speech detected. Try again.');
          return;
        }
        setIsProcessing(true);
        try {
          const categorized = await categorize(text);
          setResult(categorized);
          onEntryComplete(categorized);
        } catch {
          setError('Could not process entry');
        } finally {
          setIsProcessing(false);
        }
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (event.error === 'no-speech') {
          setError('No speech detected. Tap to try again.');
        } else if (event.error === 'not-allowed') {
          setError('Microphone access denied.');
        } else {
          setError('Voice error. Tap to retry.');
        }
      };

      recognition.start();

      // Auto-stop after 10s
      timeoutRef.current = setTimeout(() => {
        try { recognition.stop(); } catch {}
      }, 10000);
    } catch {
      setError('Voice not available on this device');
    }
  }, [isListening, isProcessing, disabled, categorize, onEntryComplete]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      try { recognitionRef.current.stop(); } catch {}
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // If in demo mode (no real recognition), trigger processing
    if (isListening && !recognitionRef.current) {
      // Already handled by timeout
    }
  }, [isListening]);

  const handleTap = useCallback(() => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  }, [isListening, startListening, stopListening]);

  const isActive = isListening || isProcessing;
  const buttonColor = ghostMode ? 'rgba(160,160,160,0.5)' : PURPLE;
  const glowColor = ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(191,90,242,0.35)';

  return (
    <div className="flex flex-col gap-2">
      {/* ── Mic Button ── */}
      <div className="relative flex items-center justify-center">
        {/* Pulse rings when active */}
        <AnimatePresence>
          {isListening && !ghostMode && (
            <>
              <motion.div
                key="pulse1"
                className="absolute rounded-full"
                style={{ width: 56, height: 56, border: `2px solid ${PURPLE}` }}
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 2.2, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
              />
              <motion.div
                key="pulse2"
                className="absolute rounded-full"
                style={{ width: 56, height: 56, border: `1.5px solid ${CYAN}` }}
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 1.8, opacity: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.4 }}
              />
            </>
          )}
        </AnimatePresence>

        <motion.button
          onClick={handleTap}
          disabled={disabled || isProcessing}
          whileTap={{ scale: 0.9 }}
          animate={{
            scale: isListening ? [1, 1.06, 1] : 1,
            boxShadow: isListening
              ? `0 0 24px ${glowColor}, 0 0 48px ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(191,90,242,0.12)'}`
              : `0 0 8px ${ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(191,90,242,0.08)'}`,
          }}
          transition={isListening ? { scale: { duration: 0.8, repeat: Infinity, ease: 'easeInOut' } } : { duration: 0.2 }}
          className="relative z-10 w-[52px] h-[52px] min-w-[44px] min-h-[44px] rounded-full flex items-center justify-center transition-colors duration-300"
          style={{
            background: isListening
              ? (ghostMode ? 'rgba(160,160,160,0.15)' : `linear-gradient(135deg, ${PURPLE}, ${CYAN})`)
              : (ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(191,90,242,0.1)'),
            border: `1.5px solid ${isListening
              ? (ghostMode ? 'rgba(160,160,160,0.3)' : PURPLE)
              : (ghostMode ? 'rgba(160,160,160,0.15)' : 'rgba(191,90,242,0.25)')}`,
          }}
          aria-label={isListening ? 'Stop recording' : 'Speak your entry'}
        >
          {isProcessing ? (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="w-5 h-5 rounded-full border-2 border-t-transparent"
              style={{ borderColor: `${buttonColor} transparent ${buttonColor} ${buttonColor}` }}
            />
          ) : isListening ? (
            /* Stop icon (square) */
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="w-4 h-4 rounded-sm"
              style={{ background: 'rgba(255,255,255,0.9)' }}
            />
          ) : (
            /* Mic icon */
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={buttonColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" x2="12" y1="19" y2="22" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* ── Label ── */}
      <AnimatePresence mode="wait">
        {isListening && (
          <motion.span
            key="listening"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[9px] font-mono uppercase tracking-[0.15em] text-center"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : PURPLE }}
          >
            Listening...
          </motion.span>
        )}
        {isProcessing && (
          <motion.span
            key="processing"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[9px] font-mono uppercase tracking-[0.15em] text-center"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : CYAN }}
          >
            Categorizing...
          </motion.span>
        )}
        {!isActive && !result && !error && (
          <motion.span
            key="idle"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-[9px] font-mono uppercase tracking-[0.15em] text-center"
            style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(191,90,242,0.4)' }}
          >
            Speak
          </motion.span>
        )}
      </AnimatePresence>

      {/* ── Live Transcript ── */}
      <AnimatePresence>
        {transcript && isActive && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="text-[11px] font-mono text-center px-2 leading-relaxed"
            style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : 'rgba(255,255,255,0.6)' }}
          >
            &quot;{transcript}&quot;
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Error ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="text-[10px] font-mono text-center px-2"
            style={{ color: 'rgba(255,107,107,0.7)' }}
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/* ── Categorized Result Card — shown in timeline after voice entry ── */
export function VoiceEntryCard({ entry, ghostMode }: { entry: CategorizedEntry; ghostMode: boolean }) {
  const styles = CATEGORY_STYLES[entry.category];
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.92)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.28)';

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
      className="rounded-2xl p-4 relative overflow-hidden backdrop-blur-md"
      style={{
        background: ghostMode ? 'rgba(20,20,22,0.6)' : styles.bg,
        border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : styles.border}`,
        boxShadow: ghostMode ? '0 2px 12px rgba(0,0,0,0.3)' : `0 2px 16px rgba(0,0,0,0.35), 0 0 20px ${styles.glow}`,
      }}
    >
      {/* Top accent */}
      {!ghostMode && (
        <div className="absolute top-0 left-4 right-4 h-[1px]" style={{
          background: `linear-gradient(90deg, transparent, ${entry.color}66, ${entry.color}44, transparent)`,
        }} />
      )}

      <div className="flex items-start gap-3">
        {/* Category icon */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.06)' : `${entry.color}15`,
              border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${entry.color}30`}`,
              boxShadow: ghostMode ? 'none' : `0 0 12px ${entry.color}20`,
            }}>
            {entry.icon}
          </div>
          <span className="text-[7px] font-mono uppercase tracking-[0.15em]" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${entry.color}88` }}>
            {entry.category}
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[8px] font-mono font-bold uppercase tracking-[0.15em] px-2 py-0.5 rounded-full"
              style={{
                color: ghostMode ? 'rgba(160,160,160,0.6)' : entry.color,
                background: ghostMode ? 'rgba(160,160,160,0.06)' : `${entry.color}12`,
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${entry.color}25`}`,
              }}>
              {entry.category} Check-in
            </span>
            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
              style={{
                color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(48,209,88,0.8)',
                background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(48,209,88,0.08)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(48,209,88,0.15)'}`,
              }}>
              🎤 Voice
            </span>
          </div>

          {/* Summary */}
          <p className="text-[13px] font-semibold mb-1" style={{ color: textPrimary }}>
            {entry.summary}
          </p>

          {/* Original text */}
          <p className="text-[11px] font-mono leading-relaxed" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,255,255,0.4)' }}>
            &quot;{entry.originalText}&quot;
          </p>

          {/* Confidence bar */}
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[8px] font-mono uppercase tracking-[0.12em]" style={{ color: textTertiary }}>Confidence</span>
            <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.04)' }}>
              <motion.div
                className="h-full rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${entry.confidence * 100}%` }}
                transition={{ duration: 0.8, ease: [0.4, 0, 0.2, 1] }}
                style={{
                  background: ghostMode ? 'rgba(160,160,160,0.25)' : `linear-gradient(90deg, ${entry.color}66, ${entry.color})`,
                  boxShadow: ghostMode ? 'none' : `0 0 8px ${entry.color}30`,
                }}
              />
            </div>
            <span className="text-[9px] font-mono font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : entry.color }}>
              {Math.round(entry.confidence * 100)}%
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
