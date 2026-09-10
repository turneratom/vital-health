import { motion } from 'framer-motion';

/* ── Shared Types ── */
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

const GOLD = '#FFD700';
const GREEN = '#30D158';

const CATEGORY_COLORS: Record<string, string> = {
  supplements: '#BF5AF2',
  recovery: '#00F2FF',
  sleep: '#6B8AFF',
  performance: GOLD,
  methylation: '#FF6BFF',
};

/* ── Protocol Timeline Card ── */
export function ProtocolCard({ entry, ghostMode }: { entry: TimelineEntry; ghostMode: boolean }) {
  const catColor = CATEGORY_COLORS[entry.protocolCategory || 'supplements'] || GOLD;
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.92)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.28)';

  const protocolMap: Record<string, { icon: string; desc: string }> = {
    'morning-protocol': { icon: '\u2600\uFE0F', desc: 'D3, Omega-3, Mag-T, Cold Plunge, Breathwork' },
    'evening-protocol': { icon: '\uD83C\uDF19', desc: 'Mag Glycinate, Apigenin, L-Theanine, Zinc, Ashwagandha' },
    'methyl-b-protocol': { icon: '\uD83E\uDDEC', desc: 'Methylfolate, Methyl-B12, P5P, TMG' },
  };
  const info = protocolMap[entry.protocolId || ''] || { icon: '\u2713', desc: entry.name };

  return (
    <div className="rounded-2xl p-3.5 relative overflow-hidden backdrop-blur-md"
      style={{
        background: ghostMode ? 'rgba(20,20,22,0.6)' : 'rgba(12,12,18,0.5)',
        boxShadow: ghostMode ? '0 2px 12px rgba(0,0,0,0.3)' : `0 2px 16px rgba(0,0,0,0.35), inset 0 0 0 1px ${catColor}15`,
      }}>
      {!ghostMode && (
        <div className="absolute top-0 left-4 right-4 h-[1px]" style={{
          background: `linear-gradient(90deg, transparent, ${catColor}55, ${catColor}35, transparent)`,
        }} />
      )}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm flex-shrink-0"
          style={{
            background: ghostMode ? 'rgba(160,160,160,0.06)' : `${catColor}10`,
            border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${catColor}20`}`,
          }}>
          {info.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>{entry.name}</span>
            <span className="text-[8px] font-mono font-bold uppercase tracking-[0.12em] px-1.5 py-0.5 rounded-full"
              style={{
                color: ghostMode ? 'rgba(160,160,160,0.5)' : GREEN,
                background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(48,209,88,0.1)',
                border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : 'rgba(48,209,88,0.2)'}`,
              }}>
              {'\u2713'} Logged
            </span>
          </div>
          <p className="text-[10px] font-mono mt-0.5" style={{ color: textTertiary }}>{info.desc}</p>
        </div>
      </div>
    </div>
  );
}
