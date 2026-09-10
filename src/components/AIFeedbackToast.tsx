import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useGhostMode } from '@/components/Presence/usePresenceState';

export interface ToastData {
  id: string;
  message: string;
  detail?: string;
  source: 'Voice' | 'Photo' | 'Input' | 'Sync';
  type: 'food' | 'activity';
  onAdjust?: () => void;
}

interface AIFeedbackToastProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
}

const sourceIcons: Record<string, { icon: string; color: string; ghostColor: string }> = {
  Voice: { icon: '🎙', color: '#AF82FF', ghostColor: 'rgba(160,160,160,0.5)' },
  Photo: { icon: '📸', color: '#30D158', ghostColor: 'rgba(160,160,160,0.5)' },
  Input: { icon: '⌨️', color: '#64D2FF', ghostColor: 'rgba(160,160,160,0.5)' },
  Sync: { icon: '🔄', color: '#FF9500', ghostColor: 'rgba(160,160,160,0.5)' },
};

export function AIFeedbackToast({ toasts, onDismiss }: AIFeedbackToastProps) {
  const ghostMode = useGhostMode();

  return (
    <div className="fixed top-20 left-0 right-0 z-[200] flex flex-col items-center gap-2 pointer-events-none px-4">
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            ghostMode={ghostMode}
            onDismiss={() => onDismiss(toast.id)}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}

function ToastItem({
  toast,
  ghostMode,
  onDismiss,
}: {
  toast: ToastData;
  ghostMode: boolean;
  onDismiss: () => void;
}) {
  const [visible, setVisible] = useState(true);
  const src = sourceIcons[toast.source] || sourceIcons.Input;
  const dotColor = ghostMode ? src.ghostColor : src.color;

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      setTimeout(onDismiss, 400);
    }, 4000);
    return () => clearTimeout(timer);
  }, [onDismiss]);

  if (!visible) return null;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="pointer-events-auto w-full max-w-sm rounded-2xl border px-4 py-3 flex items-center gap-3"
      style={{
        background: ghostMode ? "rgba(20,20,20,0.95)" : "rgba(8,12,10,0.95)",
        borderColor: ghostMode ? "rgba(160,160,160,0.1)" : `${src.color}30`,
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        boxShadow: ghostMode
          ? "0 4px 24px rgba(0,0,0,0.4)"
          : `0 4px 24px rgba(0,0,0,0.4), 0 0 20px ${src.color}15`,
      }}
    >
      {/* Source indicator dot */}
      <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full" style={{
        background: `${dotColor}18`,
        border: `1px solid ${dotColor}30`,
      }}>
        <span className="text-sm" style={{ filter: ghostMode ? "grayscale(1) opacity(0.5)" : "none" }}>
          {src.icon}
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-medium leading-tight truncate" style={{
          color: ghostMode ? "rgba(220,220,220,0.8)" : "rgba(255,255,255,0.9)",
        }}>
          {toast.message}
        </p>
        {toast.detail && (
          <p className="text-[11px] mt-0.5 truncate" style={{
            color: ghostMode ? "rgba(160,160,160,0.4)" : "rgba(255,255,255,0.35)",
          }}>
            {toast.detail}
          </p>
        )}
      </div>

      {/* Adjust button */}
      {toast.onAdjust && (
        <button
          onClick={(e) => { e.stopPropagation(); toast.onAdjust?.(); }}
          className="flex-shrink-0 px-3 py-1.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider transition-all duration-200 active:scale-95"
          style={{
            color: ghostMode ? "rgba(160,160,160,0.6)" : src.color,
            background: ghostMode ? "rgba(160,160,160,0.06)" : `${src.color}12`,
            border: `1px solid ${ghostMode ? "rgba(160,160,160,0.1)" : `${src.color}25`}`,
          }}
        >
          Adjust
        </button>
      )}

      {/* Dismiss */}
      <button
        onClick={onDismiss}
        className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors duration-200"
        style={{ color: ghostMode ? "rgba(160,160,160,0.3)" : "rgba(255,255,255,0.2)" }}
      >
        ✕
      </button>
    </motion.div>
  );
}
