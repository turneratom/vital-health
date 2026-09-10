import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getTwinSessionId } from '@/lib/twinSession';
import { useQuery } from 'convex/react';
import { api } from '../../../convex/_generated/api';
import { generateArchitectResponse, buildBioContext, SCANNING_PHASES, TOTAL_SCAN_DURATION } from '@/lib/useAI';
import type { BioSnapshot, AIAction } from '@/lib/useAI';
import { SuggestedActions, ScanningBioVault } from '@/components/Chat/SuggestedActions';

/* ── Theme ── */
const CYAN = '#00F0FF';
const CYAN_DIM = 'rgba(0,240,255,';

/* ── Types ── */
interface BriefInsight {
  icon: string;
  text: string;
  type: 'positive' | 'neutral' | 'action';
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  actions?: AIAction[];
  timestamp: number;
}

/* ── Generate Today's Brief from real data ── */
function generateBriefInsights(ctx: any): BriefInsight[] {
  if (!ctx) return [];
  const insights: BriefInsight[] = [];

  // 1. Protein gap insight
  if (ctx.nutrition) {
    const { proteinGap, totalProtein, proteinTarget } = ctx.nutrition;
    if (totalProtein === 0) {
      insights.push({
        icon: '\uD83C\uDF73',
        text: "You haven't logged any meals yet today. A protein-rich breakfast sets the tone for the whole day.",
        type: 'action',
      });
    } else if (proteinGap > 30) {
      insights.push({
        icon: '\uD83E\uDD69',
        text: `You're ${proteinGap}g short on protein (${totalProtein}g of ${proteinTarget}g). Try adding a high-protein snack to close the gap.`,
        type: 'action',
      });
    } else if (proteinGap <= 0) {
      insights.push({
        icon: '\u2705',
        text: `Great job \u2014 you've hit your protein target of ${proteinTarget}g today.`,
        type: 'positive',
      });
    } else {
      insights.push({
        icon: '\uD83D\uDCAA',
        text: `Almost there \u2014 just ${proteinGap}g more protein to hit your ${proteinTarget}g goal.`,
        type: 'neutral',
      });
    }
  }

  // 2. HRV / Recovery insight
  if (ctx.vitals?.hrvCurrent != null) {
    const { hrvCurrent, hrvDelta, hrvAvg7d } = ctx.vitals;
    if (hrvDelta != null && hrvDelta > 8) {
      insights.push({
        icon: '\uD83D\uDCC8',
        text: `Your HRV is up ${hrvDelta}% from your weekly average (${hrvCurrent}ms vs ${hrvAvg7d}ms). Your body is well-recovered \u2014 great day for a tough workout.`,
        type: 'positive',
      });
    } else if (hrvDelta != null && hrvDelta < -10) {
      insights.push({
        icon: '\uD83D\uDECC',
        text: `HRV is ${Math.abs(hrvDelta)}% below your baseline (${hrvCurrent}ms vs ${hrvAvg7d}ms). Consider a lighter day \u2014 your body is still recovering.`,
        type: 'action',
      });
    } else {
      insights.push({
        icon: '\u2764\uFE0F',
        text: `HRV is steady at ${hrvCurrent}ms, right around your weekly average. You're in a good rhythm.`,
        type: 'neutral',
      });
    }
  }

  // 3. Sleep insight
  if (ctx.sleep?.hours != null) {
    const hrs = ctx.sleep.hours;
    if (hrs >= 8) {
      insights.push({
        icon: '\uD83C\uDF1F',
        text: `You got ${hrs} hours of sleep last night \u2014 that's excellent for recovery and focus.`,
        type: 'positive',
      });
    } else if (hrs >= 7) {
      insights.push({
        icon: '\uD83D\uDE34',
        text: `${hrs} hours of sleep is solid. Aim for 8+ tonight to maximize your recovery window.`,
        type: 'neutral',
      });
    } else {
      insights.push({
        icon: '\u26A0\uFE0F',
        text: `Only ${hrs} hours of sleep last night. Prioritize an early bedtime tonight \u2014 sleep is your #1 recovery tool.`,
        type: 'action',
      });
    }
  }

  // 4. Activity insight (if no sleep data to fill slot 3)
  if (insights.length < 3 && ctx.activity) {
    const { totalMinutes, totalCaloriesBurned, activityCount } = ctx.activity;
    if (activityCount === 0) {
      insights.push({
        icon: '\uD83C\uDFC3',
        text: "No exercise logged yet today. Even a 20-minute walk can boost your mood and metabolism.",
        type: 'action',
      });
    } else {
      insights.push({
        icon: '\uD83D\uDD25',
        text: `You've burned ${totalCaloriesBurned} cal across ${totalMinutes} minutes of activity today. Nice work!`,
        type: 'positive',
      });
    }
  }

  // 5. Supplement adherence (if still need more)
  if (insights.length < 3 && ctx.supplements) {
    const { completedCount } = ctx.supplements;
    if (completedCount === 0) {
      insights.push({
        icon: '\uD83D\uDC8A',
        text: "Don't forget your supplement stack today. Consistency is what makes them work.",
        type: 'action',
      });
    } else {
      insights.push({
        icon: '\u2728',
        text: `${completedCount} supplement${completedCount > 1 ? 's' : ''} logged today. Keep up the consistency.`,
        type: 'positive',
      });
    }
  }

  // 6. Vitality score change
  if (insights.length < 3 && ctx.vitals?.vitalityDelta != null) {
    const delta = ctx.vitals.vitalityDelta;
    const score = ctx.vitals.vitalityScore;
    if (delta > 0) {
      insights.push({
        icon: '\uD83D\uDE80',
        text: `Your Vive Score is up ${delta} points to ${score}. Your habits are paying off.`,
        type: 'positive',
      });
    } else if (delta < -5) {
      insights.push({
        icon: '\uD83D\uDCC9',
        text: `Vive Score dropped ${Math.abs(delta)} points to ${score}. Focus on sleep and nutrition to bounce back.`,
        type: 'action',
      });
    }
  }

  // 7. Bio-flag warnings
  if (insights.length < 3 && ctx.bioFlags) {
    if (ctx.bioFlags.vitaminD != null && ctx.bioFlags.vitaminD < 40) {
      insights.push({
        icon: '\u2600\uFE0F',
        text: `Your Vitamin D is at ${ctx.bioFlags.vitaminD} ng/mL \u2014 below the optimal range. Consider supplementing with D3.`,
        type: 'action',
      });
    }
    if (insights.length < 3 && ctx.bioFlags.crp != null && ctx.bioFlags.crp > 1.0) {
      insights.push({
        icon: '\uD83E\uDDA0',
        text: `Your inflammation marker (CRP) is elevated at ${ctx.bioFlags.crp} mg/L. Anti-inflammatory foods like salmon and turmeric can help.`,
        type: 'action',
      });
    }
  }

  // Fallback if no data at all
  if (insights.length === 0) {
    insights.push(
      { icon: '\uD83D\uDC4B', text: "Welcome! Start logging meals and activities to get personalized insights here.", type: 'neutral' },
      { icon: '\uD83C\uDF73', text: "Log your first meal to see nutrition insights.", type: 'action' },
      { icon: '\u2764\uFE0F', text: "Connect a wearable to see HRV and sleep data.", type: 'action' },
    );
  }

  return insights.slice(0, 3);
}

/* ── Build BioSnapshot from briefing context ── */
function buildSnapshotFromContext(ctx: any): BioSnapshot {
  if (!ctx) return {};
  return {
    vitalityScore: ctx.vitals?.vitalityScore ?? undefined,
    fuelingPoints: ctx.vitals?.fuelingPoints ?? undefined,
    movementPoints: ctx.vitals?.movementPoints ?? undefined,
    hrvPoints: ctx.vitals?.hrvPoints ?? undefined,
    basePoints: ctx.vitals?.basePoints ?? undefined,
    hrv: ctx.vitals?.hrvCurrent ?? undefined,
    hrvAvg7d: ctx.vitals?.hrvAvg7d ?? undefined,
    recovery: ctx.sleep?.recovery ?? undefined,
    sleepHours: ctx.sleep?.hours ?? undefined,
    sleepScore: ctx.sleep?.score ?? undefined,
    todayCalories: ctx.nutrition?.totalCalories ?? undefined,
    todayProtein: ctx.nutrition?.totalProtein ?? undefined,
    todayActivityMinutes: ctx.activity?.totalMinutes ?? undefined,
    vitaminD: ctx.bioFlags?.vitaminD,
    ferritin: ctx.bioFlags?.ferritin,
    crp: ctx.bioFlags?.crp,
    hba1c: ctx.bioFlags?.hba1c,
    mthfrVariant: ctx.bioFlags?.mthfrVariant,
    apoe4: ctx.bioFlags?.apoe4,
    caffeineSensitivity: ctx.bioFlags?.caffeineSensitivity,
  };
}

/* ══════════════════════════════════════════════════════════════
   BriefingView — Today's Brief + AI Chat
   Warm, human, Cyan Blue (#00F0FF) theme
   ══════════════════════════════════════════════════════════════ */
const BriefingView = () => {
  const [mounted, setMounted] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [scanPhase, setScanPhase] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Twin session (auth-bound)
  const sessionId = useMemo(() => getTwinSessionId(), []);

  // Fetch briefing context from Convex
  const briefingCtx = useQuery(api.queries.getBriefingContext, { sessionId });

  // Generate insights from real data
  const insights = useMemo(() => generateBriefInsights(briefingCtx), [briefingCtx]);

  // Build bio snapshot for chat context
  const bioSnapshot = useMemo(() => buildSnapshotFromContext(briefingCtx), [briefingCtx]);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isThinking]);

  // Scanning animation during "thinking"
  useEffect(() => {
    if (!isThinking) return;
    setScanPhase(0);
    let phase = 0;
    const timers: ReturnType<typeof setTimeout>[] = [];
    let elapsed = 0;
    for (const p of SCANNING_PHASES) {
      const delay = elapsed;
      timers.push(setTimeout(() => { phase++; setScanPhase(phase); }, delay + p.duration));
      elapsed += p.duration;
    }
    return () => timers.forEach(clearTimeout);
  }, [isThinking]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isThinking) return;

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      text,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setIsThinking(true);

    // Simulate AI processing delay with scanning animation
    await new Promise((r) => setTimeout(r, TOTAL_SCAN_DURATION + 200));

    const { text: responseText, actions } = generateArchitectResponse(text, bioSnapshot);
    const assistantMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      text: responseText,
      actions,
      timestamp: Date.now(),
    };
    setMessages((prev) => [...prev, assistantMsg]);
    setIsThinking(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const insightColor = (type: BriefInsight['type']) =>
    type === 'positive' ? '#30D158' : type === 'action' ? '#FF9F0A' : CYAN;

  const insightBg = (type: BriefInsight['type']) =>
    type === 'positive' ? 'rgba(48,209,88,0.08)' : type === 'action' ? 'rgba(255,159,10,0.08)' : `${CYAN_DIM}0.06)`;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div
      className="flex flex-col h-full max-w-[640px] mx-auto"
      style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Inter", "Segoe UI", sans-serif',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'all 0.6s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      {/* ── Today's Brief ── */}
      <div className="px-5 pt-3 pb-2 flex-shrink-0">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{
              background: CYAN,
              boxShadow: `0 0 8px ${CYAN_DIM}0.5)`,
              animation: 'pulse 2.5s ease-in-out infinite',
            }}
          />
          <span className="text-[11px] font-semibold tracking-wide uppercase" style={{ color: `${CYAN_DIM}0.7)` }}>
            Today's Brief
          </span>
          <span className="text-[10px] ml-auto" style={{ color: `${CYAN_DIM}0.3)` }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
          </span>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent('vive-open-morning-brief'))}
            className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded-md ml-2"
            style={{ color: CYAN, border: `1px solid ${CYAN_DIM}0.25)`, background: `${CYAN_DIM}0.08)` }}
          >
            Morning Brief
          </button>
        </div>

        <p className="text-[13px] mb-3" style={{ color: 'rgba(255,255,255,0.45)' }}>
          {greeting()}. Here's what stands out today:
        </p>

        <div className="flex flex-col gap-2 mb-3">
          {insights.map((insight, i) => (
            <div
              key={i}
              className="flex items-start gap-3 rounded-xl px-3.5 py-3 transition-all duration-300"
              style={{
                background: insightBg(insight.type),
                border: `1px solid ${insightColor(insight.type)}18`,
                opacity: mounted ? 1 : 0,
                transform: mounted ? 'translateX(0)' : 'translateX(-8px)',
                transition: `all 0.4s ease ${i * 0.1 + 0.2}s`,
              }}
            >
              <span className="text-[16px] flex-shrink-0 mt-0.5">{insight.icon}</span>
              <p className="text-[13px] leading-[1.55] m-0" style={{ color: 'rgba(255,255,255,0.75)' }}>
                {insight.text}
              </p>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div className="h-px w-full" style={{ background: `${CYAN_DIM}0.08)` }} />
      </div>

      {/* ── Chat Messages ── */}
      <div className="flex-1 overflow-y-auto px-5 py-3 space-y-3" style={{ minHeight: 0 }}>
        {messages.length === 0 && !isThinking && (
          <div
            className="flex flex-col items-center justify-center py-10 text-center"
            style={{ opacity: mounted ? 1 : 0, transition: 'opacity 0.5s ease 0.5s' }}
          >
            <div className="text-[32px] mb-3" style={{ filter: `drop-shadow(0 0 12px ${CYAN_DIM}0.3))` }}>
              {'\uD83D\uDCAC'}
            </div>
            <p className="text-[14px] font-medium mb-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
              Ask me anything about your health
            </p>
            <p className="text-[12px] max-w-[280px]" style={{ color: 'rgba(255,255,255,0.3)' }}>
              I'll reference your vitals, meals, and biomarkers to give you personalized guidance.
            </p>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 mt-5 justify-center max-w-[340px]">
              {[
                { label: 'How am I doing today?', icon: '\uD83D\uDCCA' },
                { label: 'What should I eat next?', icon: '\uD83C\uDF7D\uFE0F' },
                { label: 'Am I ready to train?', icon: '\uD83C\uDFCB\uFE0F' },
                { label: 'How was my sleep?', icon: '\uD83D\uDE34' },
              ].map((prompt) => (
                <button
                  key={prompt.label}
                  onClick={() => { setInput(prompt.label); setTimeout(() => inputRef.current?.focus(), 50); }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] font-medium transition-all duration-200 hover:scale-[1.03] active:scale-95 cursor-pointer"
                  style={{
                    background: `${CYAN_DIM}0.06)`,
                    border: `1px solid ${CYAN_DIM}0.12)`,
                    color: `${CYAN_DIM}0.7)`,
                  }}
                >
                  <span>{prompt.icon}</span>
                  {prompt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="rounded-2xl px-4 py-3 max-w-[85%] transition-all duration-300"
              style={
                msg.role === 'user'
                  ? {
                      background: `linear-gradient(135deg, ${CYAN_DIM}0.15), ${CYAN_DIM}0.08))`,
                      border: `1px solid ${CYAN_DIM}0.2)`,
                      borderBottomRightRadius: '6px',
                    }
                  : {
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderBottomLeftRadius: '6px',
                    }
              }
            >
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-1.5 mb-1.5">
                  <span className="text-[10px]">{'\u2728'}</span>
                  <span className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: `${CYAN_DIM}0.5)` }}>
                    Vive
                  </span>
                </div>
              )}
              <p
                className="text-[13px] leading-[1.6] m-0 whitespace-pre-wrap"
                style={{ color: msg.role === 'user' ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.75)' }}
              >
                {msg.text}
              </p>
              {msg.actions && msg.actions.length > 0 && (
                <SuggestedActions actions={msg.actions} compact />
              )}
              <div className="mt-1.5 text-right">
                <span className="text-[9px]" style={{ color: 'rgba(255,255,255,0.2)' }}>
                  {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            </div>
          </div>
        ))}

        {/* Scanning / Thinking indicator */}
        {isThinking && (
          <div className="flex justify-start">
            <ScanningBioVault
              phases={SCANNING_PHASES}
              currentPhase={scanPhase}
              dataPointCount={briefingCtx?.journalEventCount24h ?? undefined}
              flags={
                briefingCtx?.bioFlags
                  ? [
                      ...(briefingCtx.bioFlags.vitaminD != null && briefingCtx.bioFlags.vitaminD < 40
                        ? [`Vit D: ${briefingCtx.bioFlags.vitaminD}`]
                        : []),
                      ...(briefingCtx.bioFlags.crp != null && briefingCtx.bioFlags.crp > 1.0
                        ? [`CRP: ${briefingCtx.bioFlags.crp}`]
                        : []),
                    ]
                  : undefined
              }
            />
          </div>
        )}

        <div ref={chatEndRef} />
      </div>

      {/* ── Input Bar ── */}
      <div
        className="flex-shrink-0 px-4 pb-4 pt-2"
        style={{ borderTop: `1px solid ${CYAN_DIM}0.06)` }}
      >
        <div
          className="flex items-center gap-2 rounded-2xl px-4 py-2.5 transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1px solid ${CYAN_DIM}${input ? '0.25' : '0.1'})`,
            boxShadow: input ? `0 0 12px ${CYAN_DIM}0.06)` : 'none',
          }}
        >
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your health..."
            disabled={isThinking}
            className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-white/25"
            style={{ color: 'rgba(255,255,255,0.85)', caretColor: CYAN }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || isThinking}
            className="flex items-center justify-center w-8 h-8 rounded-full transition-all duration-200 cursor-pointer disabled:opacity-30 disabled:cursor-default hover:scale-105 active:scale-95"
            style={{
              background: input.trim() ? `${CYAN_DIM}0.2)` : 'transparent',
              border: `1px solid ${input.trim() ? `${CYAN_DIM}0.3)` : 'transparent'}`,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={CYAN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>

        <p className="text-center text-[10px] mt-2" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Insights are based on your logged data. Always consult a healthcare professional.
        </p>
      </div>

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.3); }
        }
      `}</style>
    </div>
  );
};

export default BriefingView;
