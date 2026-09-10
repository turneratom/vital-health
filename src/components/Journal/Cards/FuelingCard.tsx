import { motion } from 'framer-motion';

export interface TimelineEntry {
  id: string;
  type: 'fueling' | 'movement' | 'protocol';
  time: string;
  timestamp: number;
  name: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fuelScore?: number;
  source?: 'Voice' | 'Photo' | 'Input' | 'Sync' | 'Protocol';
  duration?: number;
  distance?: number;
  avgHR?: number;
  maxHR?: number;
  strain?: number;
  activityType?: string;
  caloriesBurned?: number;
  zones?: { z1: number; z2: number; z3: number; z4: number; z5: number };
  protocolId?: string;
  protocolCategory?: string;
  photoUrl?: string;
  quickAnalysis?: string[];
}

const PURPLE = '#BF5AF2';
const PURPLE_DIM = 'rgba(191,90,242,';

export function FuelingCard({ entry, ghostMode }: { entry: TimelineEntry; ghostMode: boolean }) {
  const scoreColor = (entry.fuelScore || 0) >= 8 ? '#30D158' : (entry.fuelScore || 0) >= 6 ? '#00FFCC' : (entry.fuelScore || 0) >= 4 ? '#FBBF24' : '#FF6B6B';
  const displayScoreColor = ghostMode ? 'rgba(160,160,160,0.5)' : scoreColor;
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.92)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.28)';

  return (
    <div className="rounded-2xl p-4 relative overflow-hidden backdrop-blur-md"
      style={{
        background: ghostMode ? 'rgba(20,20,22,0.6)' : 'rgba(18,10,28,0.55)',
        border: '1px solid transparent',
        backgroundClip: 'padding-box',
        boxShadow: ghostMode ? '0 2px 12px rgba(0,0,0,0.3)' : '0 2px 20px rgba(0,0,0,0.4), inset 0 0 0 1px rgba(191,90,242,0.12)',
      }}>
      {!ghostMode && <div className="absolute top-0 left-4 right-4 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${PURPLE}66, ${PURPLE}44, transparent)` }} />}
      <div className="flex items-start gap-3">
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
            style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : `${PURPLE_DIM}0.1)`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${PURPLE_DIM}0.18)`}` }}>
            {"\uD83C\uDF7D"}
          </div>
          <span className="text-[7px] font-mono uppercase tracking-[0.15em]" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${PURPLE_DIM}0.5)` }}>Fuel</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>{entry.name}</span>
            <span className="text-[9px] font-bold font-mono px-1.5 py-0.5 rounded" style={{ color: displayScoreColor, background: ghostMode ? 'rgba(160,160,160,0.06)' : `${scoreColor}12`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${scoreColor}22`}` }}>{"\u26A1"}{entry.fuelScore}</span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : PURPLE }}>{entry.calories} kcal</span>
            <span className="text-[10px] font-mono" style={{ color: textTertiary }}>{"\u00B7"}</span>
            <span className="text-[10px] font-mono tabular-nums tracking-wider" style={{ color: ghostMode ? 'rgba(160,160,160,0.45)' : 'rgba(255,255,255,0.4)' }}>{entry.time}</span>
            {entry.source && (
              <>
                <span className="text-[10px] font-mono" style={{ color: textTertiary }}>{"\u00B7"}</span>
                <span className="text-[8px] font-mono uppercase tracking-wider" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${PURPLE_DIM}0.4)` }}>
                  {entry.source === 'Voice' ? '\uD83C\uDF99' : entry.source === 'Photo' ? '\uD83D\uDCF8' : entry.source === 'Sync' ? '\uD83D\uDD04' : '\u2328\uFE0F'} {entry.source}
                </span>
              </>
            )}
          </div>
          <div className="flex gap-2 mt-2.5">
            {[
              { label: 'P', value: `${entry.protein || 0}g`, color: '#00FFCC' },
              { label: 'C', value: `${entry.carbs || 0}g`, color: '#6B8AFF' },
              { label: 'F', value: `${entry.fat || 0}g`, color: '#FFB86B' },
            ].map(m => (
              <span key={m.label} className="inline-flex items-center gap-1 text-[9px] font-mono px-2 py-0.5 rounded-full border"
                style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : `${m.color}CC`, borderColor: ghostMode ? 'rgba(160,160,160,0.08)' : `${m.color}15`, background: ghostMode ? 'rgba(160,160,160,0.03)' : `${m.color}08` }}>
                <span style={{ opacity: 0.5 }}>{m.label}</span>
                <span className="tabular-nums font-semibold">{m.value}</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
