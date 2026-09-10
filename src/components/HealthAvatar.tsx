import { useState, useMemo, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useQuery, useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ═══════════════════════════════════════════════════════════════
   HEALTH AVATAR — Interactive Digital Twin Visualization
   
   SVG-based body silhouette with per-system heat map overlays,
   real-time score rings, and AI-powered "How am I doing?" persona.
   Updates reactively as somatic feedback or lab data changes.
   ═══════════════════════════════════════════════════════════════ */

/* ── Thermal Color Map ── */
const THERMAL_COLORS: Record<string, { fill: string; glow: string; ring: string }> = {
  cold:     { fill: 'rgba(59,130,246,0.35)',  glow: 'rgba(59,130,246,0.2)',  ring: '#3B82F6' },
  cool:     { fill: 'rgba(20,184,166,0.35)',  glow: 'rgba(20,184,166,0.2)',  ring: '#14B8A6' },
  neutral:  { fill: 'rgba(34,197,94,0.3)',    glow: 'rgba(34,197,94,0.15)',  ring: '#22C55E' },
  warm:     { fill: 'rgba(245,158,11,0.4)',   glow: 'rgba(245,158,11,0.25)', ring: '#F59E0B' },
  hot:      { fill: 'rgba(249,115,22,0.45)',  glow: 'rgba(249,115,22,0.3)',  ring: '#F97316' },
  critical: { fill: 'rgba(239,68,68,0.5)',    glow: 'rgba(239,68,68,0.35)',  ring: '#EF4444' },
};

const THERMAL_LABELS: Record<string, string> = {
  cold: 'Optimal', cool: 'Good', neutral: 'Baseline',
  warm: 'Attention', hot: 'Warning', critical: 'Critical',
};

/* ── Body Region SVG Paths (mapped to systems) ── */
const BODY_REGIONS: Record<string, { path: string; cx: number; cy: number; system: string }> = {
  brain:    { path: 'M90,18 Q100,8 110,18 Q114,26 110,34 Q100,38 90,34 Q86,26 90,18Z', cx: 100, cy: 24, system: 'nervous' },
  heart:    { path: 'M92,62 Q96,56 104,56 Q110,58 112,64 Q110,72 100,80 Q90,72 88,64 Q88,60 92,62Z', cx: 100, cy: 68, system: 'cardiovascular' },
  liver:    { path: 'M80,82 Q88,78 96,80 Q100,84 96,90 Q88,92 80,88 Q78,86 80,82Z', cx: 88, cy: 85, system: 'metabolic' },
  glands:   { path: 'M104,82 Q112,78 120,82 Q122,86 120,90 Q112,92 104,88 Q102,86 104,82Z', cx: 112, cy: 85, system: 'endocrine' },
  thymus:   { path: 'M94,48 Q100,44 106,48 Q108,54 106,58 Q100,60 94,58 Q92,54 94,48Z', cx: 100, cy: 52, system: 'immune' },
  muscles:  { path: 'M68,70 Q72,64 78,68 L80,96 Q74,100 68,94Z M120,70 Q128,64 132,68 L132,94 Q126,100 120,96Z', cx: 70, cy: 82, system: 'musculoskeletal' },
  gut:      { path: 'M88,94 Q94,90 106,90 Q112,94 112,104 Q108,112 100,114 Q92,112 88,104 Q86,100 88,94Z', cx: 100, cy: 102, system: 'digestive' },
  lungs:    { path: 'M82,50 Q86,44 92,48 L92,66 Q86,70 82,64Z M108,48 Q114,44 118,50 L118,64 Q114,70 108,66Z', cx: 82, cy: 57, system: 'respiratory' },
};

/* ── Score Ring Component ── */
function ScoreRing({ score, size, color, label, icon, thermal, onClick, isActive }: {
  score: number; size: number; color: string; label: string; icon: string;
  thermal: string; onClick: () => void; isActive: boolean;
}) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <motion.button
      onClick={onClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.95 }}
      className="flex flex-col items-center gap-1 relative"
      style={{ filter: isActive ? `drop-shadow(0 0 8px ${color})` : 'none' }}
    >
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="transform -rotate-90">
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={3} />
          <motion.circle
            cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={3}
            strokeLinecap="round" strokeDasharray={circ}
            initial={{ strokeDashoffset: circ }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center text-sm">
          {icon}
        </div>
      </div>
      <span className="text-[8px] font-mono uppercase tracking-wider" style={{
        color: isActive ? color : 'rgba(255,255,255,0.4)',
      }}>{label}</span>
      {isActive && (
        <motion.div
          layoutId="ring-indicator"
          className="absolute -bottom-1 w-1 h-1 rounded-full"
          style={{ background: color }}
        />
      )}
    </motion.button>
  );
}

/* ── Main HealthAvatar Component ── */
interface HealthAvatarProps {
  sessionId: string;
  compact?: boolean;
}

export function HealthAvatar({ sessionId, compact = false }: HealthAvatarProps) {
  const bioIdentity = useQuery(api.bioIdentity.getBioIdentityState, sessionId ? { sessionId } : 'skip');
  const generatePersona = useAction(api.bioIdentityAI.generatePersonaResponse);

  const [selectedSystem, setSelectedSystem] = useState<string | null>(null);
  const [personaResponse, setPersonaResponse] = useState<{
    headline: string; response: string; topRecommendation: string;
  } | null>(null);
  const [isAsking, setIsAsking] = useState(false);
  const [showPersona, setShowPersona] = useState(false);

  /* ── System map for quick lookup ── */
  const systemMap = useMemo(() => {
    const map: Record<string, any> = {};
    if (bioIdentity?.systems) {
      for (const sys of bioIdentity.systems) {
        map[sys.system] = sys;
      }
    }
    return map;
  }, [bioIdentity]);

  /* ── "How am I doing?" handler ── */
  const handleAskPersona = useCallback(async () => {
    if (isAsking) return;
    setIsAsking(true);
    setShowPersona(true);
    try {
      const result = await generatePersona({ sessionId });
      setPersonaResponse({
        headline: result.headline,
        response: result.response,
        topRecommendation: result.topRecommendation,
      });
    } catch (e) {
      console.error('[HealthAvatar] Persona error:', e);
      setPersonaResponse({
        headline: 'Digital Twin is calibrating',
        response: 'Add more biomarker data to unlock precision insights. Every data point sharpens your Digital Twin.',
        topRecommendation: 'Start by logging your latest blood panel in the Bio-Vault.',
      });
    } finally {
      setIsAsking(false);
    }
  }, [sessionId, generatePersona, isAsking]);

  /* ── Auto-refresh persona when bio-identity changes significantly ── */
  const prevScore = useMemo(() => bioIdentity?.overallScore ?? 0, [bioIdentity?.overallScore]);
  useEffect(() => {
    if (personaResponse && bioIdentity && Math.abs(bioIdentity.overallScore - prevScore) > 10) {
      setPersonaResponse(null);
    }
  }, [bioIdentity?.overallScore, prevScore, personaResponse]);

  const overallScore = bioIdentity?.overallScore ?? 60;
  const overallThermal = bioIdentity?.overallThermal ?? 'neutral';
  const overallColor = THERMAL_COLORS[overallThermal] || THERMAL_COLORS.neutral;
  const dataCompleteness = bioIdentity?.dataCompleteness ?? 0;

  /* ── Selected system detail ── */
  const selectedDetail = selectedSystem ? systemMap[selectedSystem] : null;
  const selectedColor = selectedDetail ? (THERMAL_COLORS[selectedDetail.thermal] || THERMAL_COLORS.neutral) : null;

  return (
    <div className="flex flex-col gap-4">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            className="w-10 h-10 rounded-xl flex items-center justify-center relative"
            animate={{
              boxShadow: [
                `0 0 12px ${overallColor.glow}`,
                `0 0 24px ${overallColor.glow}`,
                `0 0 12px ${overallColor.glow}`,
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: `linear-gradient(135deg, ${overallColor.fill}, rgba(168,85,247,0.08))`,
              border: `1px solid ${overallColor.ring}30`,
            }}
          >
            <span className="text-lg">🧬</span>
          </motion.div>
          <div>
            <h3 className="text-[14px] font-semibold tracking-wide" style={{ color: 'rgba(255,255,255,0.92)' }}>
              Digital Twin
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono uppercase tracking-[0.12em]" style={{ color: `${overallColor.ring}90` }}>
                {THERMAL_LABELS[overallThermal] || 'Baseline'} · {overallScore}/100
              </span>
              {dataCompleteness < 50 && (
                <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(245,158,11,0.1)', color: 'rgba(245,158,11,0.7)', border: '1px solid rgba(245,158,11,0.15)' }}>
                  {dataCompleteness}% mapped
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Bio Age Badge */}
        {bioIdentity?.biologicalAge != null && (
          <div className="text-right">
            <div className="text-[18px] font-bold tracking-tight" style={{
              color: (bioIdentity.ageDelta ?? 0) <= 0 ? '#00DCAA' : '#F59E0B',
            }}>
              {bioIdentity.biologicalAge.toFixed(1)}
            </div>
            <div className="text-[8px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.3)' }}>
              Bio Age {bioIdentity.ageDelta != null && (
                <span style={{ color: bioIdentity.ageDelta <= 0 ? '#00DCAA' : '#F59E0B' }}>
                  ({bioIdentity.ageDelta > 0 ? '+' : ''}{bioIdentity.ageDelta.toFixed(1)}y)
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Body Silhouette with Heat Map ── */}
      <div className="relative flex justify-center" style={{ minHeight: compact ? 180 : 240 }}>
        <svg
          viewBox="55 0 90 140"
          className="w-full"
          style={{ maxWidth: compact ? 160 : 220, maxHeight: compact ? 180 : 240 }}
        >
          <defs>
            {Object.entries(BODY_REGIONS).map(([key, region]) => {
              const sys = systemMap[region.system];
              const thermal = sys?.thermal || 'neutral';
              const colors = THERMAL_COLORS[thermal] || THERMAL_COLORS.neutral;
              return (
                <radialGradient key={`grad-${key}`} id={`heatGrad-${key}`} cx="50%" cy="50%" r="60%">
                  <stop offset="0%" stopColor={colors.fill} />
                  <stop offset="100%" stopColor="rgba(0,0,0,0)" />
                </radialGradient>
              );
            })}
            <filter id="bodyGlow">
              <feGaussianBlur stdDeviation="2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* Body outline */}
          <g opacity="0.15" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5" fill="none">
            {/* Head */}
            <ellipse cx="100" cy="20" rx="12" ry="14" />
            {/* Neck */}
            <rect x="96" y="34" width="8" height="8" rx="2" />
            {/* Torso */}
            <path d="M78,42 Q80,40 96,42 L104,42 Q120,40 122,42 L126,70 Q124,100 120,114 L80,114 Q76,100 74,70Z" />
            {/* Arms */}
            <path d="M74,46 Q66,48 60,60 Q56,72 58,90 Q60,96 64,98" />
            <path d="M126,46 Q134,48 140,60 Q144,72 142,90 Q140,96 136,98" />
            {/* Legs */}
            <path d="M84,114 Q82,130 80,150 Q78,160 82,170" />
            <path d="M116,114 Q118,130 120,150 Q122,160 118,170" />
          </g>

          {/* Heat map overlays */}
          {Object.entries(BODY_REGIONS).map(([key, region]) => {
            const sys = systemMap[region.system];
            const thermal = sys?.thermal || 'neutral';
            const colors = THERMAL_COLORS[thermal] || THERMAL_COLORS.neutral;
            const isSelected = selectedSystem === region.system;

            return (
              <g key={key}>
                <path
                  d={region.path}
                  fill={`url(#heatGrad-${key})`}
                  stroke={isSelected ? colors.ring : 'transparent'}
                  strokeWidth={isSelected ? 1.5 : 0}
                  filter={isSelected ? 'url(#bodyGlow)' : undefined}
                  style={{ cursor: 'pointer', transition: 'all 0.3s' }}
                  onClick={() => setSelectedSystem(selectedSystem === region.system ? null : region.system)}
                />
                {/* Pulse dot for critical/hot systems */}
                {(thermal === 'critical' || thermal === 'hot') && (
                  <circle cx={region.cx} cy={region.cy} r="2" fill={colors.ring}>
                    <animate attributeName="r" values="2;4;2" dur="1.5s" repeatCount="indefinite" />
                    <animate attributeName="opacity" values="1;0.3;1" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
              </g>
            );
          })}
        </svg>

        {/* Overall score ring overlay */}
        <div className="absolute top-2 right-2">
          <div className="relative" style={{ width: 48, height: 48 }}>
            <svg width={48} height={48} className="transform -rotate-90">
              <circle cx={24} cy={24} r={20} fill="rgba(0,0,0,0.4)" stroke="rgba(255,255,255,0.06)" strokeWidth={2.5} />
              <motion.circle
                cx={24} cy={24} r={20} fill="none" stroke={overallColor.ring} strokeWidth={2.5}
                strokeLinecap="round" strokeDasharray={2 * Math.PI * 20}
                initial={{ strokeDashoffset: 2 * Math.PI * 20 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 20 - (overallScore / 100) * 2 * Math.PI * 20 }}
                transition={{ duration: 1.5, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[11px] font-bold" style={{ color: overallColor.ring }}>{overallScore}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── System Score Rings ── */}
      <div className="flex flex-wrap justify-center gap-2 px-2">
        {(bioIdentity?.systems || []).map((sys: any) => {
          const colors = THERMAL_COLORS[sys.thermal] || THERMAL_COLORS.neutral;
          return (
            <ScoreRing
              key={sys.system}
              score={sys.score}
              size={36}
              color={colors.ring}
              label={sys.system.slice(0, 4).toUpperCase()}
              icon={sys.icon}
              thermal={sys.thermal}
              onClick={() => setSelectedSystem(selectedSystem === sys.system ? null : sys.system)}
              isActive={selectedSystem === sys.system}
            />
          );
        })}
      </div>

      {/* ── Selected System Detail Panel ── */}
      <AnimatePresence>
        {selectedDetail && selectedColor && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="rounded-xl p-3.5" style={{
              background: `${selectedColor.fill}08`,
              border: `1px solid ${selectedColor.ring}20`,
            }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-base">{selectedDetail.icon}</span>
                  <span className="text-[12px] font-semibold" style={{ color: 'rgba(255,255,255,0.9)' }}>
                    {selectedDetail.label}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full" style={{
                    background: `${selectedColor.ring}15`,
                    color: selectedColor.ring,
                    border: `1px solid ${selectedColor.ring}30`,
                  }}>
                    {THERMAL_LABELS[selectedDetail.thermal]} · {selectedDetail.score}/100
                  </span>
                </div>
              </div>

              {/* Markers */}
              {selectedDetail.markers?.length > 0 && (
                <div className="space-y-1.5 mt-2">
                  {selectedDetail.markers.map((m: any, i: number) => {
                    const statusColor = m.status === 'optimal' ? '#22C55E' : m.status === 'critical' ? '#EF4444' : '#F59E0B';
                    return (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px] font-mono" style={{ color: 'rgba(255,255,255,0.5)' }}>{m.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-medium" style={{ color: statusColor }}>{m.value}</span>
                          <div className="w-1.5 h-1.5 rounded-full" style={{ background: statusColor }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Primary driver */}
              <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(255,255,255,0.25)' }}>
                  Primary Driver: {selectedDetail.primaryDriver}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── "How am I doing?" Button ── */}
      <motion.button
        onClick={handleAskPersona}
        disabled={isAsking}
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 rounded-xl text-[12px] font-semibold tracking-wide transition-all duration-300 relative overflow-hidden"
        style={{
          background: showPersona && personaResponse
            ? 'linear-gradient(135deg, rgba(0,220,170,0.1), rgba(59,130,246,0.06))'
            : 'linear-gradient(135deg, rgba(0,242,255,0.12), rgba(168,85,247,0.08))',
          border: `1px solid ${showPersona && personaResponse ? 'rgba(0,220,170,0.2)' : 'rgba(0,242,255,0.15)'}`,
          color: showPersona && personaResponse ? '#00DCAA' : 'rgba(0,242,255,0.9)',
          boxShadow: `0 0 16px ${showPersona && personaResponse ? 'rgba(0,220,170,0.08)' : 'rgba(0,242,255,0.06)'}`,
          opacity: isAsking ? 0.7 : 1,
        }}
      >
        {isAsking ? (
          <span className="flex items-center justify-center gap-2">
            <motion.span
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
              className="inline-block w-3.5 h-3.5 border-2 rounded-full"
              style={{ borderColor: 'rgba(0,242,255,0.3)', borderTopColor: '#00F2FF' }}
            />
            Digital Twin is analyzing...
          </span>
        ) : showPersona && personaResponse ? (
          <span className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#00DCAA" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            Ask again
          </span>
        ) : (
          <span className="flex items-center justify-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="rgba(0,242,255,0.8)" strokeWidth="2" strokeLinecap="round">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
            </svg>
            How am I doing?
          </span>
        )}
      </motion.button>

      {/* ── AI Persona Response ── */}
      <AnimatePresence>
        {showPersona && personaResponse && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
            className="rounded-xl overflow-hidden"
            style={{
              background: 'rgba(0,220,170,0.03)',
              border: '1px solid rgba(0,220,170,0.1)',
            }}
          >
            {/* Headline */}
            <div className="px-4 pt-3.5 pb-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-6 h-6 rounded-lg flex items-center justify-center"
                  style={{ background: 'rgba(0,220,170,0.12)', border: '1px solid rgba(0,220,170,0.2)' }}>
                  <span className="text-xs">🧬</span>
                </div>
                <span className="text-[11px] font-mono uppercase tracking-[0.1em]" style={{ color: 'rgba(0,220,170,0.7)' }}>
                  Digital Twin Response
                </span>
              </div>
              <h4 className="text-[14px] font-bold tracking-tight" style={{ color: 'rgba(255,255,255,0.92)' }}>
                {personaResponse.headline}
              </h4>
            </div>

            {/* Response body */}
            <div className="px-4 pb-3">
              <p className="text-[11px] leading-[1.7]" style={{ color: 'rgba(255,255,255,0.6)' }}>
                {personaResponse.response}
              </p>
            </div>

            {/* Top Recommendation */}
            <div className="px-4 pb-3.5 pt-2" style={{ borderTop: '1px solid rgba(0,220,170,0.06)' }}>
              <div className="flex items-start gap-2">
                <div className="w-5 h-5 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5"
                  style={{ background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.15)' }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(168,85,247,0.8)" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div>
                  <span className="text-[9px] font-mono uppercase tracking-wider" style={{ color: 'rgba(168,85,247,0.5)' }}>
                    Top Recommendation
                  </span>
                  <p className="text-[10px] leading-[1.6] mt-0.5" style={{ color: 'rgba(255,255,255,0.5)' }}>
                    {personaResponse.topRecommendation}
                  </p>
                </div>
              </div>
            </div>

            {/* Dismiss */}
            <button
              onClick={() => setShowPersona(false)}
              className="w-full py-2 text-[9px] font-mono uppercase tracking-wider transition-colors"
              style={{ color: 'rgba(255,255,255,0.2)', borderTop: '1px solid rgba(255,255,255,0.03)' }}
            >
              Dismiss
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Critical Alerts ── */}
      {bioIdentity?.criticalAlerts && bioIdentity.criticalAlerts.length > 0 && (
        <div className="space-y-1.5">
          {bioIdentity.criticalAlerts.slice(0, 2).map((alert: string, i: number) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-start gap-2 px-3 py-2 rounded-lg"
              style={{
                background: 'rgba(239,68,68,0.04)',
                border: '1px solid rgba(239,68,68,0.1)',
              }}
            >
              <span className="text-[10px] mt-0.5">⚠️</span>
              <span className="text-[10px] leading-relaxed" style={{ color: 'rgba(239,68,68,0.7)' }}>
                {alert}
              </span>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
