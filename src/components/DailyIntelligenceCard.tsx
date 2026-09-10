/* ══════════════════════════════════════════════════════════════════
   DAILY INTELLIGENCE CARD — Minimalist High-Contrast Feed Cards
   
   Three card types:
   • AlertCard — biometric alerts with Quick Add to store
   • WinCard — positive biometric wins / streaks
   • ProtocolCard — recommended actions from BioIntelligence
     with "Why This Works" dropdown and optimization progress
   ══════════════════════════════════════════════════════════════════ */

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import type { Intervention, RiskFlag, SystemAssessment } from '@/lib/BioIntelligence';
import type { ScoredCategory } from '@/lib/RecommendationEngine';

/* ── Design Tokens ── */
const T = {
  bg: '#050505',
  card: 'rgba(12, 12, 16, 0.65)',
  cardHover: 'rgba(16, 16, 22, 0.80)',
  glass: 'rgba(255, 255, 255, 0.03)',
  text: '#F0F0F4',
  textSec: 'rgba(255, 255, 255, 0.55)',
  textTer: 'rgba(255, 255, 255, 0.28)',
  border: 'rgba(255, 255, 255, 0.06)',
  borderHi: 'rgba(255, 255, 255, 0.12)',
  accent: '#00FFCC',
  gold: '#FFD700',
  orange: '#E8976C',
  red: '#FF6B6B',
  blue: '#6B8AFF',
  purple: '#AF82FF',
  green: '#00DC82',
  cyan: '#00D4FF',
};

/* ══════════════════════════════════════════════════════════════════
   ALERT CARD — Biometric warnings with Quick Add
   ══════════════════════════════════════════════════════════════════ */

export interface AlertCardProps {
  flag: RiskFlag;
  linkedIntervention?: Intervention;
  onQuickAdd?: (interventionId: string) => void;
}

export function AlertCard({ flag, linkedIntervention, onQuickAdd }: AlertCardProps) {
  const severityColor = flag.severity === 'critical' ? T.red
    : flag.severity === 'alert' ? T.orange : T.gold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: T.card,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${severityColor}22`,
        borderRadius: 16,
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Severity accent line */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${severityColor}, transparent)`,
        opacity: 0.6,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        {/* Icon */}
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${severityColor}12`,
          border: `1px solid ${severityColor}20`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {flag.icon}
        </div>

        {/* Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: severityColor, fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}>
              {flag.severity}
            </span>
            <span style={{
              fontSize: 9, color: T.textTer, fontFamily: 'monospace',
            }}>
              {flag.marker}
            </span>
          </div>
          <p style={{
            fontSize: 13, color: T.text, lineHeight: 1.45,
            margin: 0, fontWeight: 500,
          }}>
            {flag.message}
          </p>
        </div>

        {/* Quick Add button */}
        {linkedIntervention && onQuickAdd && (
          <button
            onClick={() => onQuickAdd(linkedIntervention.id)}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              fontSize: 10,
              fontWeight: 700,
              fontFamily: 'monospace',
              letterSpacing: '0.05em',
              color: T.accent,
              background: `${T.accent}10`,
              border: `1px solid ${T.accent}25`,
              borderRadius: 8,
              cursor: 'pointer',
              transition: 'all 0.2s',
              whiteSpace: 'nowrap',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `${T.accent}20`;
              e.currentTarget.style.borderColor = `${T.accent}40`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `${T.accent}10`;
              e.currentTarget.style.borderColor = `${T.accent}25`;
            }}
          >
            + {linkedIntervention.name.split(' ')[0]}
          </button>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   WIN CARD — Positive biometric achievements
   ══════════════════════════════════════════════════════════════════ */

export interface WinData {
  id: string;
  icon: string;
  title: string;
  detail: string;
  metric?: string;
  delta?: string;
  system: string;
}

export interface WinCardProps {
  win: WinData;
}

export function WinCard({ win }: WinCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: T.card,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${T.green}15`,
        borderRadius: 16,
        padding: '16px 18px',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* Green accent */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, ${T.green}, transparent)`,
        opacity: 0.4,
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: `${T.green}10`,
          border: `1px solid ${T.green}18`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16, flexShrink: 0,
        }}>
          {win.icon}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{
              fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
              color: T.green, fontFamily: 'monospace',
              textTransform: 'uppercase',
            }}>
              WIN
            </span>
            <span style={{ fontSize: 9, color: T.textTer, fontFamily: 'monospace' }}>
              {win.system}
            </span>
          </div>
          <p style={{
            fontSize: 13, color: T.text, lineHeight: 1.45,
            margin: 0, fontWeight: 500,
          }}>
            {win.title}
          </p>
          <p style={{
            fontSize: 11, color: T.textSec, lineHeight: 1.4,
            margin: '4px 0 0', fontFamily: 'monospace',
          }}>
            {win.detail}
          </p>
        </div>

        {win.delta && (
          <div style={{
            flexShrink: 0, textAlign: 'right',
          }}>
            <div style={{
              fontSize: 16, fontWeight: 700, color: T.green,
              fontFamily: 'monospace', lineHeight: 1,
            }}>
              {win.delta}
            </div>
            {win.metric && (
              <div style={{
                fontSize: 9, color: T.textTer, fontFamily: 'monospace',
                marginTop: 2,
              }}>
                {win.metric}
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PROTOCOL CARD — Recommended action with "Why This Works"
   ══════════════════════════════════════════════════════════════════ */

export interface ProtocolCardProps {
  intervention: Intervention;
  rank: number;
  optimizationPct: number;
  onQuickAdd?: (interventionId: string) => void;
}

export function ProtocolCard({ intervention, rank, optimizationPct, onQuickAdd }: ProtocolCardProps) {
  const [expanded, setExpanded] = useState(false);

  const urgencyColor = intervention.urgency === 'critical' ? T.red
    : intervention.urgency === 'high' ? T.orange
    : intervention.urgency === 'moderate' ? T.gold : T.accent;

  const confidencePct = Math.min(100, Math.max(0, intervention.confidence));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: rank * 0.06, ease: [0.25, 0.1, 0.25, 1] }}
      style={{
        background: T.card,
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${T.border}`,
        borderRadius: 16,
        overflow: 'hidden',
        transition: 'border-color 0.3s',
      }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = `${urgencyColor}30`;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.borderColor = T.border;
      }}
    >
      {/* Main content */}
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          {/* Rank + Icon */}
          <div style={{ flexShrink: 0, textAlign: 'center' }}>
            <div style={{
              width: 42, height: 42, borderRadius: 12,
              background: `${intervention.color}10`,
              border: `1px solid ${intervention.color}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 18, position: 'relative',
            }}>
              {intervention.icon}
              {/* Rank badge */}
              <div style={{
                position: 'absolute', top: -4, right: -4,
                width: 16, height: 16, borderRadius: '50%',
                background: T.bg, border: `1px solid ${T.border}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 8, fontWeight: 800, color: T.textSec,
                fontFamily: 'monospace',
              }}>
                {rank}
              </div>
            </div>
          </div>

          {/* Content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{
                fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                color: urgencyColor, fontFamily: 'monospace',
                textTransform: 'uppercase',
              }}>
                {intervention.urgency}
              </span>
              <span style={{
                fontSize: 9, color: T.textTer, fontFamily: 'monospace',
              }}>
                {intervention.category}
              </span>
              <span style={{
                fontSize: 9, color: intervention.color, fontFamily: 'monospace',
                marginLeft: 'auto',
              }}>
                {confidencePct}% confidence
              </span>
            </div>

            {/* Name */}
            <h3 style={{
              fontSize: 14, fontWeight: 600, color: T.text,
              margin: '0 0 6px', lineHeight: 1.3,
            }}>
              {intervention.name}
            </h3>

            {/* Rationale preview */}
            <p style={{
              fontSize: 12, color: T.textSec, lineHeight: 1.5,
              margin: 0,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}>
              {intervention.rationale}
            </p>

            {/* Optimization progress bar */}
            <div style={{ marginTop: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{
                  fontSize: 9, fontFamily: 'monospace', color: T.textTer,
                  letterSpacing: '0.05em',
                }}>
                  BIOLOGICAL OPTIMIZATION
                </span>
                <span style={{
                  fontSize: 9, fontFamily: 'monospace', color: T.accent,
                  fontWeight: 700,
                }}>
                  {optimizationPct}%
                </span>
              </div>
              <div style={{
                height: 3, borderRadius: 2,
                background: 'rgba(255,255,255,0.06)',
                overflow: 'hidden',
              }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${optimizationPct}%` }}
                  transition={{ duration: 1.2, delay: rank * 0.1, ease: [0.25, 0.1, 0.25, 1] }}
                  style={{
                    height: '100%', borderRadius: 2,
                    background: `linear-gradient(90deg, ${T.accent}80, ${T.accent})`,
                  }}
                />
              </div>
            </div>

            {/* Action row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12 }}>
              <button
                onClick={() => setExpanded(!expanded)}
                style={{
                  padding: '5px 10px',
                  fontSize: 10,
                  fontWeight: 600,
                  fontFamily: 'monospace',
                  letterSpacing: '0.03em',
                  color: T.textSec,
                  background: T.glass,
                  border: `1px solid ${T.border}`,
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                  display: 'flex', alignItems: 'center', gap: 4,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = T.borderHi;
                  e.currentTarget.style.color = T.text;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = T.border;
                  e.currentTarget.style.color = T.textSec;
                }}
              >
                <span style={{
                  display: 'inline-block',
                  transition: 'transform 0.2s',
                  transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)',
                  fontSize: 8,
                }}>
                  ▶
                </span>
                Why This Works
              </button>

              {onQuickAdd && (
                <button
                  onClick={() => onQuickAdd(intervention.id)}
                  style={{
                    padding: '5px 10px',
                    fontSize: 10,
                    fontWeight: 700,
                    fontFamily: 'monospace',
                    letterSpacing: '0.03em',
                    color: T.accent,
                    background: `${T.accent}08`,
                    border: `1px solid ${T.accent}20`,
                    borderRadius: 6,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    marginLeft: 'auto',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = `${T.accent}18`;
                    e.currentTarget.style.borderColor = `${T.accent}40`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = `${T.accent}08`;
                    e.currentTarget.style.borderColor = `${T.accent}20`;
                  }}
                >
                  + Quick Add
                </button>
              )}

              {/* Dosing pill */}
              <span style={{
                fontSize: 9, fontFamily: 'monospace', color: T.textTer,
                padding: '3px 8px', background: T.glass, borderRadius: 4,
                marginLeft: onQuickAdd ? 0 : 'auto',
              }}>
                {intervention.dosing.length > 30
                  ? intervention.dosing.slice(0, 30) + '\u2026'
                  : intervention.dosing}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* "Why This Works" expandable section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <div style={{
              padding: '0 18px 16px',
              borderTop: `1px solid ${T.border}`,
              marginTop: 0,
              paddingTop: 14,
            }}>
              {/* Mechanism */}
              <div style={{ marginBottom: 12 }}>
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                  color: T.textTer, fontFamily: 'monospace',
                  marginBottom: 4, textTransform: 'uppercase',
                }}>
                  MECHANISM OF ACTION
                </div>
                <p style={{
                  fontSize: 12, color: T.textSec, lineHeight: 1.5,
                  margin: 0,
                }}>
                  {intervention.mechanism}
                </p>
              </div>

              {/* Timing + Duration */}
              <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: T.textTer, fontFamily: 'monospace',
                    marginBottom: 3, textTransform: 'uppercase',
                  }}>
                    TIMING
                  </div>
                  <p style={{ fontSize: 11, color: T.text, margin: 0, fontFamily: 'monospace' }}>
                    {intervention.timing}
                  </p>
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: T.textTer, fontFamily: 'monospace',
                    marginBottom: 3, textTransform: 'uppercase',
                  }}>
                    DURATION
                  </div>
                  <p style={{ fontSize: 11, color: T.text, margin: 0, fontFamily: 'monospace' }}>
                    {intervention.duration}
                  </p>
                </div>
              </div>

              {/* Expected Outcomes */}
              {intervention.expectedOutcomes.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: T.textTer, fontFamily: 'monospace',
                    marginBottom: 6, textTransform: 'uppercase',
                  }}>
                    EXPECTED OUTCOMES
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {intervention.expectedOutcomes.slice(0, 4).map((outcome, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                        <span style={{ color: T.accent, fontSize: 8, marginTop: 3 }}>●</span>
                        <span style={{ fontSize: 11, color: T.textSec, lineHeight: 1.4 }}>
                          {outcome}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Synergies */}
              {intervention.synergies.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: T.textTer, fontFamily: 'monospace',
                    marginBottom: 6, textTransform: 'uppercase',
                  }}>
                    SYNERGISTIC COMPOUNDS
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {intervention.synergies.map((syn, i) => (
                      <span key={i} style={{
                        fontSize: 10, fontFamily: 'monospace',
                        padding: '2px 8px', borderRadius: 4,
                        background: `${T.purple}10`,
                        border: `1px solid ${T.purple}18`,
                        color: T.purple,
                      }}>
                        {syn}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Triggers */}
              {intervention.triggers.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: T.textTer, fontFamily: 'monospace',
                    marginBottom: 6, textTransform: 'uppercase',
                  }}>
                    TRIGGERED BY
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {intervention.triggers.map((trigger, i) => (
                      <span key={i} style={{
                        fontSize: 10, fontFamily: 'monospace',
                        padding: '2px 8px', borderRadius: 4,
                        background: `${T.orange}10`,
                        border: `1px solid ${T.orange}18`,
                        color: T.orange,
                      }}>
                        {trigger}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Citations */}
              {intervention.citations.length > 0 && (
                <div>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: T.textTer, fontFamily: 'monospace',
                    marginBottom: 6, textTransform: 'uppercase',
                  }}>
                    CITATIONS
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                    {intervention.citations.slice(0, 3).map((cite, i) => (
                      <div key={i} style={{
                        fontSize: 10, color: T.textTer, fontFamily: 'monospace',
                        lineHeight: 1.4,
                      }}>
                        [{i + 1}] {cite.authors} ({cite.year}). <em>{cite.title}</em>. {cite.journal}.
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Cautions */}
              {intervention.cautions.length > 0 && (
                <div style={{
                  marginTop: 12, padding: '8px 12px', borderRadius: 8,
                  background: `${T.red}06`, border: `1px solid ${T.red}12`,
                }}>
                  <div style={{
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.1em',
                    color: T.red, fontFamily: 'monospace',
                    marginBottom: 4, textTransform: 'uppercase',
                  }}>
                    ⚠ CAUTIONS
                  </div>
                  {intervention.cautions.map((c, i) => (
                    <div key={i} style={{
                      fontSize: 10, color: `${T.red}cc`, lineHeight: 1.4,
                      fontFamily: 'monospace',
                    }}>
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SYSTEM STATUS PILL — Compact system health indicator
   ══════════════════════════════════════════════════════════════════ */

export interface SystemPillProps {
  system: SystemAssessment;
}

export function SystemPill({ system }: SystemPillProps) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 8,
      background: `${system.color}08`,
      border: `1px solid ${system.color}15`,
    }}>
      <span style={{ fontSize: 12 }}>{system.icon}</span>
      <span style={{
        fontSize: 10, fontFamily: 'monospace', fontWeight: 600,
        color: system.color,
      }}>
        {system.score}
      </span>
      <span style={{
        fontSize: 9, fontFamily: 'monospace', color: T.textTer,
        textTransform: 'uppercase', letterSpacing: '0.05em',
      }}>
        {system.label.split(' ')[0]}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   OPTIMIZATION SCORE HEADER — Composite bio-optimization %
   ══════════════════════════════════════════════════════════════════ */

export interface OptScoreHeaderProps {
  score: number;
  label: string;
  systems: SystemAssessment[];
}

export function OptScoreHeader({ score, label, systems }: OptScoreHeaderProps) {
  const scoreColor = score >= 80 ? T.accent : score >= 60 ? T.blue : score >= 40 ? T.orange : T.red;

  return (
    <div style={{
      background: T.card,
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: `1px solid ${T.border}`,
      borderRadius: 20,
      padding: '20px 22px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Subtle gradient glow */}
      <div style={{
        position: 'absolute', top: -40, right: -40,
        width: 120, height: 120, borderRadius: '50%',
        background: `radial-gradient(circle, ${scoreColor}08, transparent)`,
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
        {/* Score ring */}
        <div style={{ position: 'relative', width: 64, height: 64, flexShrink: 0 }}>
          <svg width="64" height="64" viewBox="0 0 64 64">
            <circle cx="32" cy="32" r="28" fill="none"
              stroke="rgba(255,255,255,0.06)" strokeWidth="3" />
            <motion.circle
              cx="32" cy="32" r="28" fill="none"
              stroke={scoreColor} strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 28}`}
              initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - score / 100) }}
              transition={{ duration: 1.5, ease: [0.25, 0.1, 0.25, 1] }}
              transform="rotate(-90 32 32)"
            />
          </svg>
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
          }}>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              style={{
                fontSize: 18, fontWeight: 800, color: scoreColor,
                fontFamily: 'monospace', lineHeight: 1,
              }}
            >
              {score}
            </motion.span>
            <span style={{
              fontSize: 7, color: T.textTer, fontFamily: 'monospace',
              letterSpacing: '0.1em', marginTop: 1,
            }}>
              OPT%
            </span>
          </div>
        </div>

        {/* Label + systems */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
            color: T.textTer, fontFamily: 'monospace',
            textTransform: 'uppercase', marginBottom: 4,
          }}>
            BIOLOGICAL OPTIMIZATION
          </div>
          <div style={{
            fontSize: 13, color: T.text, fontWeight: 500,
            lineHeight: 1.4, marginBottom: 10,
          }}>
            {label}
          </div>

          {/* System pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {systems.slice(0, 5).map((sys) => (
              <SystemPill key={sys.system} system={sys} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SECTION DIVIDER — Minimal feed section header
   ══════════════════════════════════════════════════════════════════ */

export interface SectionDividerProps {
  label: string;
  count?: number;
  color?: string;
}

export function SectionDivider({ label, count, color = T.textTer }: SectionDividerProps) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 0',
    }}>
      <span style={{
        fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
        color, fontFamily: 'monospace',
        textTransform: 'uppercase',
      }}>
        {label}
      </span>
      {count !== undefined && (
        <span style={{
          fontSize: 9, fontFamily: 'monospace',
          color: T.textTer,
          padding: '1px 6px', borderRadius: 4,
          background: 'rgba(255,255,255,0.04)',
        }}>
          {count}
        </span>
      )}
      <div style={{
        flex: 1, height: 1,
        background: 'rgba(255,255,255,0.04)',
      }} />
    </div>
  );
}
