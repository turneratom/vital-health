import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

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

const CYAN = '#00F2FF';
const PURPLE = '#BF5AF2';
const CYAN_DIM = 'rgba(0,242,255,';

function GlowBar({ value, max, color, ghostMode }: { value: number; max: number; color: string; ghostMode: boolean }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-[5px] rounded-full overflow-hidden flex-1" style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : 'rgba(255,255,255,0.03)' }}>
      <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
        style={{ background: ghostMode ? 'rgba(160,160,160,0.3)' : `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: ghostMode ? 'none' : `0 0 10px ${color}40, 0 0 20px ${color}15` }} />
    </div>
  );
}

function HRZoneBar({ zone, label, minutes, maxMinutes, color, ghostMode }: { zone: number; label: string; minutes: number; maxMinutes: number; color: string; ghostMode: boolean }) {
  const pct = Math.min(100, (minutes / maxMinutes) * 100);
  return (
    <div className="flex items-center gap-2">
      <span className="text-[9px] font-bold w-5 text-center font-mono" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : color }}>Z{zone}</span>
      <span className="text-[9px] font-mono w-8 truncate" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : 'rgba(255,255,255,0.2)' }}>{label}</span>
      <div className="h-[5px] rounded-full overflow-hidden flex-1" style={{ background: ghostMode ? 'rgba(160,160,160,0.04)' : 'rgba(255,255,255,0.025)' }}>
        <motion.div className="h-full rounded-full" initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: [0.4, 0, 0.2, 1] }}
          style={{ background: ghostMode ? 'rgba(160,160,160,0.25)' : `linear-gradient(90deg, ${color}88, ${color})`, boxShadow: ghostMode ? 'none' : `0 0 8px ${color}35` }} />
      </div>
      <span className="text-[10px] font-bold font-mono tabular-nums w-8 text-right" style={{ color: ghostMode ? 'rgba(160,160,160,0.5)' : 'rgba(255,255,255,0.45)' }}>{minutes}m</span>
    </div>
  );
}

export function MovementCard({ entry, ghostMode }: { entry: TimelineEntry; ghostMode: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const strainVal = entry.strain || 0;
  const strainColor = strainVal >= 14 ? (ghostMode ? 'rgba(160,160,160,0.5)' : '#FF5A5A') : strainVal >= 8 ? (ghostMode ? 'rgba(160,160,160,0.5)' : '#FFB86B') : (ghostMode ? 'rgba(160,160,160,0.5)' : CYAN);
  const textPrimary = ghostMode ? 'rgba(220,220,220,0.7)' : 'rgba(255,255,255,0.92)';
  const textSecondary = ghostMode ? 'rgba(180,180,180,0.5)' : 'rgba(255,255,255,0.5)';
  const textTertiary = ghostMode ? 'rgba(160,160,160,0.35)' : 'rgba(255,255,255,0.28)';
  const activityIcons: Record<string, string> = { Running: '\uD83C\uDFC3', Strength: '\uD83D\uDCAA', Cycling: '\uD83D\uDEB4', Yoga: '\uD83E\uDDD8', HIIT: '\u26A1' };
  const icon = activityIcons[entry.activityType || ''] || '\uD83C\uDFC3';
  const zoneColors = [
    ghostMode ? 'rgba(160,160,160,0.3)' : '#6B8AFF', ghostMode ? 'rgba(160,160,160,0.35)' : '#00FFCC',
    ghostMode ? 'rgba(160,160,160,0.4)' : '#FFB86B', ghostMode ? 'rgba(160,160,160,0.45)' : '#FF8A5C',
    ghostMode ? 'rgba(160,160,160,0.5)' : '#FF5A5A',
  ];
  const zones = entry.zones || { z1: 0, z2: 0, z3: 0, z4: 0, z5: 0 };
  const maxZoneMin = Math.max(zones.z1, zones.z2, zones.z3, zones.z4, zones.z5, 1);

  return (
    <div className="rounded-2xl overflow-hidden relative backdrop-blur-md"
      style={{ background: ghostMode ? 'rgba(20,20,22,0.6)' : 'rgba(8,18,22,0.55)', boxShadow: ghostMode ? '0 2px 12px rgba(0,0,0,0.3)' : `0 2px 20px rgba(0,0,0,0.4), inset 0 0 0 1px ${CYAN_DIM}0.1)` }}
      onClick={() => setExpanded(!expanded)}>
      {!ghostMode && <div className="absolute top-0 left-4 right-4 h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${CYAN}55, ${CYAN}35, transparent)` }} />}
      <div className="p-4 flex items-start gap-3 cursor-pointer">
        <div className="flex flex-col items-center gap-1 flex-shrink-0 mt-0.5">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
            style={{ background: ghostMode ? 'rgba(160,160,160,0.06)' : `${CYAN_DIM}0.08)`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.1)' : `${CYAN_DIM}0.15)`}` }}>
            {icon}
          </div>
          <span className="text-[7px] font-mono uppercase tracking-[0.15em]" style={{ color: ghostMode ? 'rgba(160,160,160,0.3)' : `${CYAN_DIM}0.5)` }}>Move</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[13px] font-semibold truncate" style={{ color: textPrimary }}>{entry.name}</span>
            <span className="text-[9px] font-bold font-mono px-2 py-0.5 rounded-full flex-shrink-0" style={{ color: strainColor, background: ghostMode ? 'rgba(160,160,160,0.06)' : `${strainColor}12`, border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.08)' : `${strainColor}22`}` }}>
              {strainVal.toFixed(1)} strain
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] font-mono font-bold tabular-nums" style={{ color: ghostMode ? 'rgba(200,200,200,0.6)' : CYAN }}>{entry.duration}m</span>
            {entry.distance && (<><span className="text-[10px] font-mono" style={{ color: textTertiary }}>{"\u00B7"}</span><span className="text-[11px] font-mono tabular-nums" style={{ color: textSecondary }}>{entry.distance} mi</span></>)}
            <span className="text-[10px] font-mono" style={{ color: textTertiary }}>{"\u00B7"}</span>
            <span className="text-[10px] font-mono tabular-nums tracking-wider" style={{ color: ghostMode ? 'rgba(160,160,160,0.45)' : 'rgba(255,255,255,0.4)' }}>{entry.time}</span>
            <span className="text-[10px] font-mono" style={{ color: textTertiary }}>{"\u00B7"}</span>
            <span className="text-[11px] font-mono tabular-nums" style={{ color: ghostMode ? 'rgba(160,160,160,0.4)' : 'rgba(255,90,90,0.55)' }}>{entry.caloriesBurned} cal</span>
          </div>
          <div className="flex items-center gap-2 mt-2.5">
            <span className="text-[9px] font-mono uppercase tracking-[0.12em] flex-shrink-0" style={{ color: textTertiary }}>Intensity</span>
            <GlowBar value={strainVal} max={21} color={strainColor} ghostMode={ghostMode} />
          </div>
        </div>
        <motion.span animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }} className="text-[10px] mt-2 flex-shrink-0" style={{ color: textTertiary }}>{"\u25BC"}</motion.span>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }} className="overflow-hidden">
            <div className="px-4 pb-4 pt-1" style={{ borderTop: `0.5px solid ${ghostMode ? 'rgba(160,160,160,0.06)' : `${CYAN_DIM}0.08)`}` }}>
              <div className="grid grid-cols-3 gap-3 mb-4 mt-3">
                {[
                  { label: 'Calories', value: `${entry.caloriesBurned}`, color: ghostMode ? 'rgba(160,160,160,0.5)' : '#FF5A5A' },
                  { label: 'Avg HR', value: `${entry.avgHR}`, color: ghostMode ? 'rgba(160,160,160,0.5)' : PURPLE },
                  { label: 'Max HR', value: `${entry.maxHR}`, color: ghostMode ? 'rgba(160,160,160,0.5)' : CYAN },
                ].map((stat, i) => (
                  <div key={i} className="flex flex-col items-center gap-0.5 rounded-xl py-2" style={{ background: ghostMode ? 'rgba(160,160,160,0.03)' : 'rgba(255,255,255,0.02)', border: `1px solid ${ghostMode ? 'rgba(160,160,160,0.05)' : 'rgba(255,255,255,0.04)'}` }}>
                    <span className="text-[18px] font-bold font-mono tabular-nums" style={{ color: stat.color }}>{stat.value}</span>
                    <span className="text-[8px] font-mono uppercase tracking-[0.15em]" style={{ color: textTertiary }}>{stat.label}</span>
                  </div>
                ))}
              </div>
              <div className="mb-2"><span className="text-[9px] font-mono font-bold uppercase tracking-[0.15em]" style={{ color: textTertiary }}>Heart Rate Zones</span></div>
              <div className="flex flex-col gap-1.5">
                <HRZoneBar zone={1} label="Rest" minutes={zones.z1} maxMinutes={maxZoneMin} color={zoneColors[0]} ghostMode={ghostMode} />
                <HRZoneBar zone={2} label="Light" minutes={zones.z2} maxMinutes={maxZoneMin} color={zoneColors[1]} ghostMode={ghostMode} />
                <HRZoneBar zone={3} label="Mod" minutes={zones.z3} maxMinutes={maxZoneMin} color={zoneColors[2]} ghostMode={ghostMode} />
                <HRZoneBar zone={4} label="Hard" minutes={zones.z4} maxMinutes={maxZoneMin} color={zoneColors[3]} ghostMode={ghostMode} />
                <HRZoneBar zone={5} label="Max" minutes={zones.z5} maxMinutes={maxZoneMin} color={zoneColors[4]} ghostMode={ghostMode} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
