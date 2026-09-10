import { motion } from 'framer-motion';
import type { AIAction } from '@/lib/useAI';

/* ── Constants ── */
const CYAN = '#00F2FF';
const PURPLE = '#BF5AF2';

/* ══════════════════════════════════════════════════════════════
   SuggestedActions — Clickable UI actions inside chat bubbles
   
   Renders action buttons parsed from AI responses via
   [ACTION:type:target] tags. Each button can navigate to a
   view, log data, or update a protocol.
   ══════════════════════════════════════════════════════════════ */

interface SuggestedActionsProps {
  actions: AIAction[];
  onAction?: (action: AIAction) => void;
  ghostMode?: boolean;
  compact?: boolean;
}

export function SuggestedActions({ actions, onAction, ghostMode = false, compact = false }: SuggestedActionsProps) {
  if (!actions || actions.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-1.5 ${compact ? 'mt-1' : 'mt-2'}`}>
      {actions.map((action, idx) => (
        <motion.button
          key={action.id}
          initial={{ opacity: 0, scale: 0.9, y: 4 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.25, delay: idx * 0.06, ease: [0.4, 0, 0.2, 1] }}
          className={`flex items-center gap-1.5 rounded-lg transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer group ${
            compact ? 'px-2 py-1' : 'px-2.5 py-1.5'
          }`}
          style={{
            background: ghostMode
              ? 'rgba(160,160,160,0.06)'
              : `${action.color}12`,
            border: `1px solid ${
              ghostMode
                ? 'rgba(160,160,160,0.12)'
                : `${action.color}30`
            }`,
            boxShadow: ghostMode
              ? 'none'
              : `0 0 8px ${action.color}08`,
          }}
          onClick={() => onAction?.(action)}
        >
          {/* Icon */}
          <span className={compact ? 'text-[10px]' : 'text-[11px]'}>
            {action.icon}
          </span>

          {/* Label */}
          <span
            className={`font-semibold tracking-wide ${
              compact ? 'text-[9px]' : 'text-[10px]'
            }`}
            style={{
              color: ghostMode ? 'rgba(160,160,160,0.6)' : action.color,
            }}
          >
            {action.label}
          </span>

          {/* Arrow indicator */}
          <svg
            width={compact ? 8 : 10}
            height={compact ? 8 : 10}
            viewBox="0 0 24 24"
            fill="none"
            stroke={ghostMode ? 'rgba(160,160,160,0.4)' : action.color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="transition-transform duration-200 group-hover:translate-x-0.5"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>

          {/* Hover glow */}
          {!ghostMode && (
            <div
              className="absolute inset-0 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at center, ${action.color}08, transparent 70%)`,
              }}
            />
          )}
        </motion.button>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ScanningBioVault — Animated loading state for chat
   
   Shows a multi-phase scanning animation that reinforces
   the psychological value that the AI is reading the user's
   DNA, blood labs, and vitals before responding.
   ══════════════════════════════════════════════════════════════ */

interface ScanningPhase {
  label: string;
  detail: string;
  icon: string;
  duration: number;
}

interface ScanningBioVaultProps {
  phases: readonly ScanningPhase[];
  currentPhase: number;
  ghostMode?: boolean;
  /** Optional: data points count from Bio-Snapshot */
  dataPointCount?: number;
  /** Optional: flagged biomarkers */
  flags?: string[];
}

export function ScanningBioVault({
  phases,
  currentPhase,
  ghostMode = false,
  dataPointCount,
  flags,
}: ScanningBioVaultProps) {
  const neon = ghostMode ? 'rgba(160,160,160,' : 'rgba(0,242,255,';
  const neonSolid = ghostMode ? '#a0a0a0' : CYAN;
  const greenSolid = ghostMode ? '#a0a0a0' : '#30D158';

  return (
    <div
      className="rounded-2xl px-4 py-3.5 max-w-[85%] relative overflow-hidden"
      style={{
        background: ghostMode
          ? 'rgba(20,20,22,0.6)'
          : 'rgba(0,242,255,0.04)',
        border: `1px solid ${
          ghostMode ? 'rgba(160,160,160,0.12)' : 'rgba(0,242,255,0.12)'
        }`,
        borderBottomLeftRadius: '6px',
        boxShadow: ghostMode
          ? 'none'
          : '0 0 20px rgba(0,242,255,0.04)',
      }}
    >
      {/* Scanning sweep effect */}
      {!ghostMode && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(0,242,255,0.03) 50%, transparent 100%)',
          }}
          animate={{ y: ['-100%', '100%'] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
        />
      )}

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 relative z-10">
        <motion.div
          className="w-2 h-2 rounded-full flex-shrink-0"
          style={{
            background: neonSolid,
            boxShadow: ghostMode
              ? 'none'
              : `0 0 8px rgba(0,242,255,0.6)`,
          }}
          animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 0.8, repeat: Infinity }}
        />
        <span
          className="text-[10px] uppercase tracking-[0.2em] font-bold"
          style={{ color: ghostMode ? 'rgba(200,200,200,0.7)' : 'rgba(0,242,255,0.9)' }}
        >
          Scanning Bio-Vault
        </span>
        {dataPointCount !== undefined && dataPointCount > 0 && (
          <span
            className="text-[8px] font-mono ml-auto"
            style={{ color: `${neon}0.45)` }}
          >
            {dataPointCount} data points
          </span>
        )}
      </div>

      {/* Phase list */}
      <div className="flex flex-col gap-1.5 relative z-10">
        {phases.map((phase, i) => {
          const isActive = i === currentPhase;
          const isDone = i < currentPhase;
          const isPending = i > currentPhase;

          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: isPending ? 0.3 : 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.05 }}
              className="flex items-center gap-2"
            >
              {/* Status indicator */}
              {isDone ? (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={greenSolid}
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M20 6L9 17l-5-5" />
                  </svg>
                </motion.div>
              ) : isActive ? (
                <motion.div
                  className="w-3 h-3 rounded-full border-[1.5px] border-t-transparent"
                  style={{
                    borderColor: `${neon}0.6)`,
                    borderTopColor: 'transparent',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{
                    duration: 0.6,
                    repeat: Infinity,
                    ease: 'linear',
                  }}
                />
              ) : (
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: 'rgba(255,255,255,0.06)' }}
                />
              )}

              {/* Phase text */}
              <div className="flex flex-col">
                <span
                  className="text-[10px] font-semibold"
                  style={{
                    color: isDone
                      ? ghostMode
                        ? 'rgba(160,160,160,0.6)'
                        : 'rgba(48,209,88,0.8)'
                      : isActive
                      ? ghostMode
                        ? 'rgba(200,200,200,0.8)'
                        : 'rgba(0,242,255,0.9)'
                      : 'rgba(255,255,255,0.25)',
                  }}
                >
                  {phase.icon} {phase.label}
                </span>
                {isActive && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-[8px] font-mono"
                    style={{ color: `${neon}0.45)` }}
                  >
                    {phase.detail}
                  </motion.span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Flagged biomarkers (shown during scan) */}
      {flags && flags.length > 0 && currentPhase >= 1 && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.3 }}
          className="flex flex-wrap gap-1 mt-2 relative z-10"
        >
          {flags.map((flag) => (
            <span
              key={flag}
              className="text-[7px] font-mono px-1.5 py-0.5 rounded"
              style={{
                background: ghostMode
                  ? 'rgba(160,160,160,0.06)'
                  : 'rgba(255,69,58,0.08)',
                color: ghostMode
                  ? 'rgba(160,160,160,0.5)'
                  : 'rgba(255,69,58,0.7)',
                border: `1px solid ${
                  ghostMode
                    ? 'rgba(160,160,160,0.1)'
                    : 'rgba(255,69,58,0.12)'
                }`,
              }}
            >
              {flag}
            </span>
          ))}
        </motion.div>
      )}

      {/* Progress bar */}
      <div
        className="mt-3 h-[2px] rounded-full overflow-hidden relative z-10"
        style={{ background: 'rgba(255,255,255,0.04)' }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{
            background: ghostMode
              ? 'linear-gradient(90deg, #a0a0a0, #c0c0c0)'
              : `linear-gradient(90deg, ${CYAN}, #00FFCC)`,
            boxShadow: ghostMode
              ? 'none'
              : `0 0 6px rgba(0,242,255,0.4)`,
          }}
          initial={{ width: '0%' }}
          animate={{
            width: `${Math.min(
              100,
              ((currentPhase + 1) / phases.length) * 100
            )}%`,
          }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}

export default SuggestedActions;
