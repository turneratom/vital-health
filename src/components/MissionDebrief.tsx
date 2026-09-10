import { useState, useMemo } from 'react'
import { useQuery } from 'convex/react'
import { api } from '../../convex/_generated/api'
import { Sparkline } from './Sparkline'

/* ═══════════════════════════════════════════════════════════════
   MISSION DEBRIEF — Weekly Squad Performance Report
   
   Generates every Sunday at 8 PM. High-end tactical report:
   • Squad Lead crowned (highest avg Elite Score)
   • Per-member performance rankings with sparklines
   • Missed Objectives — most-skipped habits by the group
   • Squad Readiness Score (0-100) composite
   ═══════════════════════════════════════════════════════════════ */

const TIER_COLORS: Record<string, { color: string; bg: string; border: string }> = {
  APEX:       { color: '#FFD700', bg: 'rgba(255,215,0,0.08)',  border: 'rgba(255,215,0,0.25)' },
  TITAN:      { color: '#00FFCC', bg: 'rgba(0,255,204,0.06)',  border: 'rgba(0,255,204,0.2)' },
  VANGUARD:   { color: '#E8976C', bg: 'rgba(232,151,108,0.06)', border: 'rgba(232,151,108,0.2)' },
  RECRUIT:    { color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.03)', border: 'rgba(255,255,255,0.08)' },
}

const GRADE_CONFIG: Record<string, { label: string; color: string; icon: string }> = {
  APEX:          { label: 'APEX READINESS',    color: '#FFD700', icon: '⚡' },
  COMBAT_READY:  { label: 'COMBAT READY',      color: '#00FFCC', icon: '🎯' },
  RECOVERING:    { label: 'RECOVERING',         color: '#E8976C', icon: '🔄' },
  COMPROMISED:   { label: 'COMPROMISED',        color: '#FF5F56', icon: '⚠️' },
}

const SEVERITY_COLORS: Record<string, { color: string; bg: string }> = {
  critical: { color: '#FF3B30', bg: 'rgba(255,59,48,0.08)' },
  high:     { color: '#FF5F56', bg: 'rgba(255,95,86,0.06)' },
  medium:   { color: '#FFB86B', bg: 'rgba(255,184,107,0.06)' },
  low:      { color: 'rgba(255,255,255,0.3)', bg: 'rgba(255,255,255,0.02)' },
}

interface MissionDebriefProps {
  onClose?: () => void
}

export default function MissionDebrief({ onClose }: MissionDebriefProps) {
  const sessionId = typeof window !== 'undefined'
    ? localStorage.getItem('vive-session-id') || 'guest-user'
    : 'guest-user'

  const debrief = useQuery(api.weeklyTacticalReport.getMissionDebrief, { sessionId })
  const [expandedSection, setExpandedSection] = useState<string | null>('rankings')

  const gradeConfig = useMemo(() => {
    if (!debrief) return GRADE_CONFIG.RECOVERING
    return GRADE_CONFIG[debrief.readinessGrade] || GRADE_CONFIG.RECOVERING
  }, [debrief])

  if (!debrief) {
    return (
      <div style={{
        background: '#050505', minHeight: '100vh', display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16,
        padding: 24,
      }}>
        <div style={{
          width: 48, height: 48, border: '2px solid rgba(232,151,108,0.15)',
          borderTopColor: '#E8976C', borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
        }} />
        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13, fontFamily: 'monospace' }}>
          Compiling Mission Debrief\u2026
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  const toggleSection = (id: string) => {
    setExpandedSection(expandedSection === id ? null : id)
  }

  return (
    <div style={{
      background: '#050505', minHeight: '100vh', padding: '0 0 120px 0',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", sans-serif',
    }}>
      {/* ── Header ── */}
      <div style={{
        padding: '20px 20px 0',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 8,
            background: 'rgba(232,151,108,0.12)', border: '1px solid rgba(232,151,108,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 16,
          }}>
            📋
          </div>
          <div>
            <div style={{
              fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
              color: '#E8976C', fontFamily: 'monospace', textTransform: 'uppercase',
            }}>
              MISSION DEBRIEF
            </div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
              {debrief.reportPeriod.start} \u2192 {debrief.reportPeriod.end}
            </div>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 8,
              background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
              color: 'rgba(255,255,255,0.5)', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            \u2715
          </button>
        )}
      </div>

      {/* ── Squad Readiness Score ── */}
      <div style={{ padding: '20px 20px 0' }}>
        <div style={{
          background: 'rgba(10,10,10,0.8)',
          border: `1px solid ${gradeConfig.color}22`,
          borderRadius: 16, padding: 24,
          position: 'relative', overflow: 'hidden',
        }}>
          {/* Glow */}
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 120, height: 120, borderRadius: '50%',
            background: `radial-gradient(circle, ${gradeConfig.color}15, transparent 70%)`,
            pointerEvents: 'none',
          }} />

          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
            color: gradeConfig.color, fontFamily: 'monospace',
            marginBottom: 12,
          }}>
            {gradeConfig.icon} SQUAD READINESS
          </div>

          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 8 }}>
            <span style={{
              fontSize: 56, fontWeight: 800, color: gradeConfig.color,
              lineHeight: 1, fontFamily: 'monospace',
            }}>
              {debrief.squadReadinessScore}
            </span>
            <span style={{
              fontSize: 18, color: 'rgba(255,255,255,0.3)', fontWeight: 600,
              marginBottom: 8, fontFamily: 'monospace',
            }}>
              /100
            </span>
          </div>

          <div style={{
            fontSize: 11, fontWeight: 700, letterSpacing: '0.1em',
            color: gradeConfig.color, fontFamily: 'monospace',
            padding: '4px 10px', borderRadius: 6,
            background: `${gradeConfig.color}12`,
            display: 'inline-block', marginBottom: 16,
          }}>
            {gradeConfig.label}
          </div>

          {/* Squad sparkline */}
          <div style={{ marginTop: 8 }}>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', marginBottom: 6 }}>
              7-DAY SQUAD TREND
            </div>
            <Sparkline
              data={debrief.squadDailyAvg.map((d) => d.avgScore)}
              width={280}
              height={36}
              color={gradeConfig.color}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              {debrief.squadDailyAvg.map((d, i) => (
                <span key={i} style={{
                  fontSize: 8, color: 'rgba(255,255,255,0.2)', fontFamily: 'monospace',
                }}>
                  {d.date.slice(5)}
                </span>
              ))}
            </div>
          </div>

          {/* Quick stats row */}
          <div style={{
            display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
            gap: 12, marginTop: 16,
          }}>
            {[
              { label: 'AVG SCORE', value: debrief.squadAvgScore, suffix: '' },
              { label: 'PEAK', value: debrief.squadPeakScore, suffix: '' },
              { label: 'MEMBERS', value: debrief.totalMembers, suffix: '' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'rgba(255,255,255,0.02)', borderRadius: 8,
                padding: '8px 10px', textAlign: 'center',
                border: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace', letterSpacing: '0.08em' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>
                  {stat.value}{stat.suffix}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Squad Lead Crown ── */}
      {debrief.squadLead && (
        <div style={{ padding: '16px 20px 0' }}>
          <div style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.06), rgba(255,215,0,0.02))',
            border: '1px solid rgba(255,215,0,0.2)',
            borderRadius: 14, padding: 18,
            position: 'relative', overflow: 'hidden',
          }}>
            <div style={{
              position: 'absolute', top: -20, left: -20,
              width: 80, height: 80, borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(255,215,0,0.12), transparent 70%)',
              pointerEvents: 'none',
            }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14,
                background: 'rgba(255,215,0,0.1)', border: '2px solid rgba(255,215,0,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 24,
              }}>
                👑
              </div>
              <div style={{ flex: 1 }}>
                <div style={{
                  fontSize: 10, fontWeight: 700, letterSpacing: '0.12em',
                  color: '#FFD700', fontFamily: 'monospace',
                }}>
                  SQUAD LEAD OF THE WEEK
                </div>
                <div style={{
                  fontSize: 17, fontWeight: 700, color: '#fff', marginTop: 2,
                }}>
                  {debrief.squadLead.isCurrentUser ? 'You' : debrief.squadLead.operatorLabel}
                </div>
                <div style={{
                  fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', marginTop: 2,
                }}>
                  Avg Score: {debrief.squadLead.avgScore} \u00B7 Peak: {debrief.squadLead.peakScore} \u00B7 {debrief.squadLead.tier}
                </div>
              </div>
              <div style={{
                fontSize: 28, fontWeight: 800, color: '#FFD700',
                fontFamily: 'monospace', lineHeight: 1,
              }}>
                {debrief.squadLead.avgScore}
              </div>
            </div>

            {debrief.squadLead.isCurrentUser && (
              <div style={{
                marginTop: 12, padding: '8px 12px', borderRadius: 8,
                background: 'rgba(255,215,0,0.06)', border: '1px solid rgba(255,215,0,0.12)',
                fontSize: 11, color: 'rgba(255,215,0,0.8)', fontFamily: 'monospace',
                textAlign: 'center',
              }}>
                \uD83C\uDF1F You led the squad this week. Keep the momentum.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Your Position (if not Squad Lead) ── */}
      {debrief.currentUserProfile && !debrief.currentUserProfile.isCurrentUser !== undefined && debrief.currentUserRank && debrief.currentUserRank > 1 && (
        <div style={{ padding: '12px 20px 0' }}>
          <div style={{
            background: 'rgba(232,151,108,0.04)',
            border: '1px solid rgba(232,151,108,0.15)',
            borderRadius: 12, padding: 14,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 36, height: 36, borderRadius: 10,
              background: 'rgba(232,151,108,0.1)', border: '1px solid rgba(232,151,108,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14, fontWeight: 800, color: '#E8976C', fontFamily: 'monospace',
            }}>
              #{debrief.currentUserRank}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Your Position</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>
                Score: {debrief.currentUserProfile.avgScore} \u00B7 {debrief.currentUserProfile.tier} \u00B7 Trend: {debrief.currentUserProfile.trend === 'up' ? '\u2191' : debrief.currentUserProfile.trend === 'down' ? '\u2193' : '\u2192'}
              </div>
            </div>
            <div style={{
              fontSize: 22, fontWeight: 800, color: '#E8976C', fontFamily: 'monospace',
            }}>
              {debrief.currentUserProfile.avgScore}
            </div>
          </div>
        </div>
      )}

      {/* ── Performance Rankings ── */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => toggleSection('rankings')}
          style={{
            width: '100%', background: 'rgba(10,10,10,0.6)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
            padding: '14px 16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>🏆</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              Performance Rankings
            </span>
            <span style={{
              fontSize: 10, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace',
              background: 'rgba(255,255,255,0.04)', padding: '2px 8px', borderRadius: 4,
            }}>
              {debrief.memberProfiles.length} members
            </span>
          </div>
          <span style={{
            fontSize: 14, color: 'rgba(255,255,255,0.3)',
            transform: expandedSection === 'rankings' ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>
            \u25BC
          </span>
        </button>

        {expandedSection === 'rankings' && (
          <div style={{
            marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {debrief.memberProfiles.map((member, idx) => {
              const tierStyle = TIER_COLORS[member.tier] || TIER_COLORS.RECRUIT
              return (
                <div
                  key={member.sessionId}
                  style={{
                    background: member.isCurrentUser ? 'rgba(232,151,108,0.06)' : 'rgba(10,10,10,0.5)',
                    border: `1px solid ${member.isCurrentUser ? 'rgba(232,151,108,0.2)' : 'rgba(255,255,255,0.04)'}`,
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  {/* Rank */}
                  <div style={{
                    width: 28, height: 28, borderRadius: 8,
                    background: idx === 0 ? 'rgba(255,215,0,0.12)' : idx === 1 ? 'rgba(192,192,192,0.08)' : idx === 2 ? 'rgba(205,127,50,0.08)' : 'rgba(255,255,255,0.03)',
                    border: `1px solid ${idx === 0 ? 'rgba(255,215,0,0.3)' : idx === 1 ? 'rgba(192,192,192,0.2)' : idx === 2 ? 'rgba(205,127,50,0.2)' : 'rgba(255,255,255,0.06)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 11, fontWeight: 800, fontFamily: 'monospace',
                    color: idx === 0 ? '#FFD700' : idx === 1 ? '#C0C0C0' : idx === 2 ? '#CD7F32' : 'rgba(255,255,255,0.4)',
                  }}>
                    {idx + 1}
                  </div>

                  {/* Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: member.isCurrentUser ? '#E8976C' : '#fff' }}>
                        {member.isCurrentUser ? 'You' : member.operatorLabel}
                      </span>
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                        color: tierStyle.color, background: tierStyle.bg,
                        border: `1px solid ${tierStyle.border}`,
                        padding: '1px 5px', borderRadius: 3, fontFamily: 'monospace',
                      }}>
                        {member.tier}
                      </span>
                      {member.trend === 'up' && <span style={{ fontSize: 10, color: '#00FFCC' }}>\u2191</span>}
                      {member.trend === 'down' && <span style={{ fontSize: 10, color: '#FF5F56' }}>\u2193</span>}
                    </div>
                    <div style={{ marginTop: 4 }}>
                      <Sparkline
                        data={member.dailyScores.map((d) => d.score)}
                        width={120}
                        height={18}
                        color={tierStyle.color}
                      />
                    </div>
                  </div>

                  {/* Score */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{
                      fontSize: 20, fontWeight: 800, color: tierStyle.color,
                      fontFamily: 'monospace', lineHeight: 1,
                    }}>
                      {member.avgScore}
                    </div>
                    <div style={{
                      fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace',
                    }}>
                      peak {member.peakScore}
                    </div>
                  </div>
                </div>
              )
            })}

            {debrief.memberProfiles.length === 0 && (
              <div style={{
                padding: 24, textAlign: 'center',
                color: 'rgba(255,255,255,0.3)', fontSize: 12, fontFamily: 'monospace',
              }}>
                No squad data yet. Complete protocols to generate rankings.
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Missed Objectives ── */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => toggleSection('missed')}
          style={{
            width: '100%', background: 'rgba(10,10,10,0.6)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
            padding: '14px 16px', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 16 }}>⚠️</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
              Missed Objectives
            </span>
            <span style={{
              fontSize: 10, color: debrief.missedObjectives.length > 0 ? '#FF5F56' : 'rgba(255,255,255,0.3)',
              fontFamily: 'monospace',
              background: debrief.missedObjectives.length > 0 ? 'rgba(255,95,86,0.08)' : 'rgba(255,255,255,0.04)',
              padding: '2px 8px', borderRadius: 4,
            }}>
              {debrief.missedObjectives.length} flagged
            </span>
          </div>
          <span style={{
            fontSize: 14, color: 'rgba(255,255,255,0.3)',
            transform: expandedSection === 'missed' ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}>
            \u25BC
          </span>
        </button>

        {expandedSection === 'missed' && (
          <div style={{
            marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            {debrief.missedObjectives.map((obj, idx) => {
              const sev = SEVERITY_COLORS[obj.severity] || SEVERITY_COLORS.low
              return (
                <div
                  key={idx}
                  style={{
                    background: sev.bg,
                    border: `1px solid ${sev.color}20`,
                    borderRadius: 12, padding: '12px 14px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 16 }}>{obj.icon}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{obj.name}</span>
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: '0.08em',
                        color: sev.color, fontFamily: 'monospace',
                        textTransform: 'uppercase',
                      }}>
                        {obj.severity}
                      </span>
                    </div>
                    <span style={{
                      fontSize: 14, fontWeight: 800, color: sev.color, fontFamily: 'monospace',
                    }}>
                      {obj.completionRate}%
                    </span>
                  </div>

                  {/* Completion bar */}
                  <div style={{
                    height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.04)',
                    overflow: 'hidden', marginBottom: 8,
                  }}>
                    <div style={{
                      height: '100%', borderRadius: 2,
                      width: `${obj.completionRate}%`,
                      background: sev.color,
                      transition: 'width 0.5s ease',
                    }} />
                  </div>

                  <div style={{ display: 'flex', gap: 16 }}>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                      {obj.category}
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                      {obj.membersMissed}/{obj.membersAssigned} members missed
                    </div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                      {obj.missRate}% miss rate
                    </div>
                  </div>
                </div>
              )
            })}

            {debrief.missedObjectives.length === 0 && (
              <div style={{
                padding: 24, textAlign: 'center', borderRadius: 12,
                background: 'rgba(0,255,204,0.03)', border: '1px solid rgba(0,255,204,0.1)',
              }}>
                <span style={{ fontSize: 24 }}>\u2705</span>
                <div style={{
                  color: '#00FFCC', fontSize: 12, fontFamily: 'monospace',
                  fontWeight: 600, marginTop: 8,
                }}>
                  ALL OBJECTIVES MET
                </div>
                <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 4 }}>
                  Every protocol above 80% adherence this week.
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Top Performing Protocols ── */}
      {debrief.topPerformingProtocols.length > 0 && (
        <div style={{ padding: '16px 20px 0' }}>
          <button
            onClick={() => toggleSection('top')}
            style={{
              width: '100%', background: 'rgba(10,10,10,0.6)',
              border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12,
              padding: '14px 16px', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 16 }}>\u2705</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                Top Performing Protocols
              </span>
              <span style={{
                fontSize: 10, color: '#00FFCC', fontFamily: 'monospace',
                background: 'rgba(0,255,204,0.06)', padding: '2px 8px', borderRadius: 4,
              }}>
                {debrief.topPerformingProtocols.length} strong
              </span>
            </div>
            <span style={{
              fontSize: 14, color: 'rgba(255,255,255,0.3)',
              transform: expandedSection === 'top' ? 'rotate(180deg)' : 'rotate(0deg)',
              transition: 'transform 0.2s',
            }}>
              \u25BC
            </span>
          </button>

          {expandedSection === 'top' && (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {debrief.topPerformingProtocols.map((proto, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(0,255,204,0.03)',
                    border: '1px solid rgba(0,255,204,0.1)',
                    borderRadius: 12, padding: '12px 14px',
                    display: 'flex', alignItems: 'center', gap: 12,
                  }}
                >
                  <span style={{ fontSize: 18 }}>{proto.icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{proto.name}</div>
                    <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)', fontFamily: 'monospace' }}>
                      {proto.category}
                    </div>
                  </div>
                  <div style={{
                    fontSize: 16, fontWeight: 800, color: '#00FFCC', fontFamily: 'monospace',
                  }}>
                    {proto.completionRate}%
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Sleep Context ── */}
      <div style={{ padding: '16px 20px 0' }}>
        <div style={{
          background: 'rgba(10,10,10,0.5)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 12, padding: 16,
        }}>
          <div style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace',
            marginBottom: 12,
          }}>
            \uD83D\uDCA4 YOUR SLEEP CONTEXT
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#AF82FF', fontFamily: 'monospace' }}>
                {debrief.sleepContext.avgScore ?? '\u2014'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>AVG SCORE</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#AF82FF', fontFamily: 'monospace' }}>
                {debrief.sleepContext.avgHours ?? '\u2014'}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>AVG HOURS</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: '#AF82FF', fontFamily: 'monospace' }}>
                {debrief.sleepContext.nightsLogged}
              </div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' }}>NIGHTS</div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Report Footer ── */}
      <div style={{
        padding: '24px 20px 0', textAlign: 'center',
      }}>
        <div style={{
          fontSize: 9, color: 'rgba(255,255,255,0.15)', fontFamily: 'monospace',
          letterSpacing: '0.08em',
        }}>
          VIVE TACTICAL SYSTEMS \u00B7 MISSION DEBRIEF v2.0
        </div>
        <div style={{
          fontSize: 9, color: 'rgba(255,255,255,0.1)', fontFamily: 'monospace',
          marginTop: 4,
        }}>
          Generated {new Date(debrief.reportPeriod.generatedAt).toLocaleString()}
        </div>
      </div>
    </div>
  )
}
