import { motion } from 'framer-motion';

/* ── Constants ── */
const CYAN = '#00F2FF';
const PURPLE = '#BF5AF2';
const CYAN_DIM = 'rgba(0,242,255,';
const PURPLE_DIM = 'rgba(191,90,242,';
const GOLD = '#FFD700';
const GREEN = '#30D158';

const CATEGORY_COLORS: Record<string, string> = {
  supplements: PURPLE,
  recovery: CYAN,
  sleep: '#6B8AFF',
  performance: GOLD,
  methylation: '#FF6BFF',
};

/* ── Standby Glow Wrapper ── */
function StandbyGlow({ children, color, ghostMode }: { children: React.ReactNode; color: string; ghostMode: boolean }) {
  return (
    <div className="relative">
      {/* Outer breathing glow */}
      {!ghostMode && (
        <motion.div
          className="absolute -inset-[1px] rounded-2xl pointer-events-none"
          animate={{
            boxShadow: [
              `0 0 8px ${color}10, 0 0 20px ${color}05, inset 0 0 8px ${color}03`,
              `0 0 14px ${color}18, 0 0 32px ${color}08, inset 0 0 12px ${color}05`,
              `0 0 8px ${color}10, 0 0 20px ${color}05, inset 0 0 8px ${color}03`,
            ],
          }}
          transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {children}
    </div>
  );
}

/* ── Standby Badge ── */
function StandbyBadge({ ghostMode, status }: { ghostMode: boolean; status?: 'scheduled' | 'standby' | 'pivoted' }) {
  const isPivoted = status === 'pivoted';
  const isStandby = status === 'standby';
  const label = isPivoted ? 'Pivoted' : isStandby ? 'Standby' : 'Scheduled';
  const dotColor = isPivoted
    ? (ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,179,107,0.7)')
    : isStandby
    ? (ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(107,138,255,0.7)')
    : (ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(191,90,242,0.6)');
  const textColor = isPivoted
    ? (ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,179,107,0.7)')
    : isStandby
    ? (ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(107,138,255,0.65)')
    : (ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(191,90,242,0.65)');
  const bgColor = isPivoted
    ? (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,179,107,0.06)')
    : isStandby
    ? (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(107,138,255,0.06)')
    : (ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(191,90,242,0.06)');
  const borderColor = isPivoted
    ? (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,179,107,0.15)')
    : isStandby
    ? (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(107,138,255,0.12)')
    : (ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(191,90,242,0.12)');

  return (
    <div className="flex items-center gap-1.5">
      <motion.div
        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
        style={{ background: dotColor, boxShadow: ghostMode ? 'none' : `0 0 6px ${dotColor}` }}
        animate={ghostMode ? {} : { opacity: [0.5, 1, 0.5], scale: [0.9, 1.1, 0.9] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />
      <span
        className="text-[8px] font-mono font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full"
        style={{ color: textColor, background: bgColor, border: `1px solid ${borderColor}` }}
      >
        {label}
      </span>
    </div>
  );
}

/* ── Scheduled Timeline Node (diamond with standby pulse) ── */
export function ScheduledTimelineNode({ type, ghostMode, protocolCategory }: {
  type: 'fueling' | 'movement' | 'protocol';
  ghostMode: boolean;
  protocolCategory?: string;
}) {
  const color = type === 'protocol'
    ? (CATEGORY_COLORS[protocolCategory || 'supplements'] || GOLD)
    : type === 'movement' ? CYAN : PURPLE;

  return (
    <div className="relative flex items-center justify-center" style={{ width: 14, height: 14 }}>
      {/* Standby breathing ring */}
      {!ghostMode && (
        <motion.div
          className="absolute rounded-full"
          style={{ width: 20, height: 20, border: `1px dashed ${color}30` }}
          animate={{
            scale: [1, 1.4, 1],
            opacity: [0.3, 0.6, 0.3],
          }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        />
      )}
      {/* Hollow node (not filled — indicates scheduled, not logged) */}
      {type === 'protocol' ? (
        <div
          className="relative z-10"
          style={{
            width: 8,
            height: 8,
            border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.25)' : `${color}55`}`,
            borderRadius: 2,
            transform: 'rotate(45deg)',
            background: ghostMode ? 'transparent' : `${color}08`,
            boxShadow: ghostMode ? 'none' : `0 0 6px ${color}20`,
          }}
        />
      ) : (
        <div
          className="rounded-full relative z-10"
          style={{
            width: 8,
            height: 8,
            border: `1.5px solid ${ghostMode ? 'rgba(160,160,160,0.25)' : `${color}55`}`,
            background: ghostMode ? 'transparent' : `${color}08`,
            boxShadow: ghostMode ? 'none' : `0 0 6px ${color}20`,
          }}
        />
      )}
    </div>
  );
}

/* ── Scheduled Fueling Card ── */
export function ScheduledFuelingCard({ entry, ghostMode, status }: {
  entry: {
    name: string;
    calories?: number;
    protein?: number;
    carbs?: number;
    fat?: number;
    time: string;
    notes?: string;
    pivotedFrom?: string;
  };
  ghostMode: boolean;
  status?: 'scheduled' | 'standby' | 'pivoted';
}) {
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.5)' : 'rgba(255,255,255,0.65)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(255,255,255,0.2)';

  return (
    <StandbyGlow color={PURPLE} ghostMode={ghostMode}>
      <div
        className="rounded-2xl p-4 relative overflow-hidden backdrop-blur-md"
        style={{
          background: ghostMode ? 'rgba(20,20,22,0.35)' : 'rgba(18,10,28,0.3)',
          border: `1px dashed ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(191,90,242,0.15)'}`,
          opacity: ghostMode ? 0.6 : 0.75,
        }}
      >
        {/* Subtle top accent — dashed for "planned" feel */}
        {!ghostMode && (
          <div className="absolute top-0 left-6 right-6 h-[1px]" style={{
            background: `linear-gradient(90deg, transparent, ${PURPLE}25, ${PURPLE}15, transparent)`,
          }} />
        )}

        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.04)' : `${PURPLE_DIM}0.06)`,
                border: `1px dashed ${ghostMode ? 'rgba(160,160,160,0.08)' : `${PURPLE_DIM}0.12)`}`,
              }}
            >
              {'\uD83C\uDF7D'}
            </div>
            <span className="text-[7px] font-mono uppercase tracking-[0.15em]" style={{ color: ghostMode ? 'rgba(160,160,160,0.2)' : `${PURPLE_DIM}0.35)` }}>
              Plan
            </span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>
                {entry.name}
              </span>
              <StandbyBadge ghostMode={ghostMode} status={status} />
            </div>

            {/* Pivoted-from note */}
            {entry.pivotedFrom && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[8px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,179,107,0.45)' }}>
                  {'\u21B3'} Moved from {entry.pivotedFrom}
                </span>
              </div>
            )}

            {/* Macros */}
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.4)' : `${PURPLE_DIM}0.6)` }}>
                {entry.calories} kcal
              </span>
            </div>

            <div className="flex gap-2 mt-2.5">
              {[
                { label: 'P', value: `${entry.protein || 0}g`, color: '#00FFCC' },
                { label: 'C', value: `${entry.carbs || 0}g`, color: '#6B8AFF' },
                { label: 'F', value: `${entry.fat || 0}g`, color: '#FFB86B' },
              ].map(m => (
                <span
                  key={m.label}
                  className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full"
                  style={{
                    color: ghostMode ? 'rgba(160,160,160,0.35)' : `${m.color}88`,
                    border: `1px dashed ${ghostMode ? 'rgba(160,160,160,0.06)' : `${m.color}12`}`,
                    background: ghostMode ? 'rgba(160,160,160,0.02)' : `${m.color}05`,
                  }}
                >
                  <span style={{ opacity: 0.5 }}>{m.label}</span>
                  <span className="tabular-nums font-semibold">{m.value}</span>
                </span>
              ))}
            </div>

            {entry.notes && (
              <p className="text-[9px] font-mono mt-2" style={{ color: textTertiary, fontStyle: 'italic' }}>
                {entry.notes}
              </p>
            )}
          </div>
        </div>
      </div>
    </StandbyGlow>
  );
}

/* ── Scheduled Movement Card ── */
export function ScheduledMovementCard({ entry, ghostMode, status }: {
  entry: {
    name: string;
    duration?: number;
    activityType?: string;
    notes?: string;
    time: string;
    pivotedFrom?: string;
  };
  ghostMode: boolean;
  status?: 'scheduled' | 'standby' | 'pivoted';
}) {
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.5)' : 'rgba(255,255,255,0.65)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(255,255,255,0.2)';

  const activityIcons: Record<string, string> = {
    Running: '\uD83C\uDFC3',
    Strength: '\uD83D\uDCAA',
    Cycling: '\uD83D\uDEB4',
    Yoga: '\uD83E\uDDD8',
    HIIT: '\u26A1',
    Walking: '\uD83D\uDEB6',
  };
  const icon = activityIcons[entry.activityType || ''] || '\uD83C\uDFC3';

  return (
    <StandbyGlow color={CYAN} ghostMode={ghostMode}>
      <div
        className="rounded-2xl p-4 relative overflow-hidden backdrop-blur-md"
        style={{
          background: ghostMode ? 'rgba(20,20,22,0.35)' : 'rgba(8,18,22,0.3)',
          border: `1px dashed ${ghostMode ? 'rgba(160,160,160,0.08)' : `${CYAN_DIM}0.15)`}`,
          opacity: ghostMode ? 0.6 : 0.75,
        }}
      >
        {!ghostMode && (
          <div className="absolute top-0 left-6 right-6 h-[1px]" style={{
            background: `linear-gradient(90deg, transparent, ${CYAN}20, ${CYAN}12, transparent)`,
          }} />
        )}

        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
              style={{
                background: ghostMode ? 'rgba(160,160,160,0.04)' : `${CYAN_DIM}0.05)`,
                border: `1px dashed ${ghostMode ? 'rgba(160,160,160,0.08)' : `${CYAN_DIM}0.1)`}`,
              }}
            >
              {icon}
            </div>
            <span className="text-[7px] font-mono uppercase tracking-[0.15em]" style={{ color: ghostMode ? 'rgba(160,160,160,0.2)' : `${CYAN_DIM}0.35)` }}>
              Plan
            </span>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>
                {entry.name}
              </span>
              <StandbyBadge ghostMode={ghostMode} status={status} />
            </div>

            {entry.pivotedFrom && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[8px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,179,107,0.45)' }}>
                  {'\u21B3'} Moved from {entry.pivotedFrom}
                </span>
              </div>
            )}

            <div className="flex items-center gap-3 mt-1.5">
              {entry.duration && (
                <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.4)' : `${CYAN_DIM}0.55)` }}>
                  {entry.duration}m
                </span>
              )}
              {entry.activityType && (
                <>
                  <span className="text-[10px] font-mono" style={{ color: textTertiary }}>{'\u00B7'}</span>
                  <span
                    className="text-[9px] font-mono uppercase tracking-[0.1em] px-1.5 py-0.5 rounded-full"
                    style={{
                      color: ghostMode ? 'rgba(160,160,160,0.35)' : `${CYAN_DIM}0.5)`,
                      background: ghostMode ? 'rgba(160,160,160,0.03)' : `${CYAN_DIM}0.05)`,
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.05)' : `${CYAN_DIM}0.1)`}`,
                    }}
                  >
                    {entry.activityType}
                  </span>
                </>
              )}
            </div>

            {entry.notes && (
              <p className="text-[9px] font-mono mt-2 leading-relaxed" style={{ color: textTertiary, fontStyle: 'italic' }}>
                {entry.notes}
              </p>
            )}
          </div>
        </div>
      </div>
    </StandbyGlow>
  );
}

/* ── Scheduled Protocol Card ── */
export function ScheduledProtocolCard({ entry, ghostMode, status }: {
  entry: {
    name: string;
    category?: string;
    protocolId?: string;
    items?: string[];
    time: string;
    pivotedFrom?: string;
  };
  ghostMode: boolean;
  status?: 'scheduled' | 'standby' | 'pivoted';
}) {
  const catColor = CATEGORY_COLORS[entry.category || 'supplements'] || GOLD;
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.5)' : 'rgba(255,255,255,0.65)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.25)' : 'rgba(255,255,255,0.2)';

  const protocolIcons: Record<string, string> = {
    'morning-protocol': '\u2600\uFE0F',
    'evening-protocol': '\uD83C\uDF19',
    'methyl-b-protocol': '\uD83E\uDDEC',
  };
  const icon = protocolIcons[entry.protocolId || ''] || '\uD83D\uDC8A';

  return (
    <StandbyGlow color={catColor} ghostMode={ghostMode}>
      <div
        className="rounded-2xl p-3.5 relative overflow-hidden backdrop-blur-md"
        style={{
          background: ghostMode ? 'rgba(20,20,22,0.35)' : 'rgba(12,12,18,0.28)',
          border: `1px dashed ${ghostMode ? 'rgba(160,160,160,0.08)' : `${catColor}15`}`,
          opacity: ghostMode ? 0.6 : 0.75,
        }}
      >
        {!ghostMode && (
          <div className="absolute top-0 left-4 right-4 h-[1px]" style={{
            background: `linear-gradient(90deg, transparent, ${catColor}20, ${catColor}12, transparent)`,
          }} />
        )}

        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
            style={{
              background: ghostMode ? 'rgba(160,160,160,0.04)' : `${catColor}06`,
              border: `1px dashed ${ghostMode ? 'rgba(160,160,160,0.08)' : `${catColor}12`}`,
            }}
          >
            {icon}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>
                  {entry.name}
                </span>
              </div>
              <StandbyBadge ghostMode={ghostMode} status={status} />
            </div>

            {entry.pivotedFrom && (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-[8px] font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,179,107,0.45)' }}>
                  {'\u21B3'} Moved from {entry.pivotedFrom}
                </span>
              </div>
            )}

            {entry.items && entry.items.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {entry.items.slice(0, 3).map((item, i) => (
                  <span
                    key={i}
                    className="text-[9px] font-mono px-1.5 py-0.5 rounded-md"
                    style={{
                      color: ghostMode ? 'rgba(160,160,160,0.3)' : `${catColor}50`,
                      background: ghostMode ? 'rgba(160,160,160,0.02)' : `${catColor}04`,
                      border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.04)' : `${catColor}08`}`,
                    }}
                  >
                    {item}
                  </span>
                ))}
                {entry.items.length > 3 && (
                  <span className="text-[9px] font-mono px-1.5 py-0.5 rounded-md" style={{ color: textTertiary }}>
                    +{entry.items.length - 3} more
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </StandbyGlow>
  );
}
