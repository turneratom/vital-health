import { useCallback } from 'react';
import { useAction } from 'convex/react';
import { api } from '../../convex/_generated/api';

/* ═══════════════════════════════════════════════════════════════
   THE CLINICAL PERFORMANCE ARCHITECT — AI Engine v3 (LLM-Powered)
   
   Now powered by real LLM via Shipper AI.
   Falls back to local engine if AI action unavailable.
   ═══════════════════════════════════════════════════════════════ */

/* ── Voice Journal Types (preserved) ── */
export type VoiceCategory = 'Mood' | 'Pain' | 'Energy';

export interface CategorizedEntry {
  category: VoiceCategory;
  summary: string;
  originalText: string;
  confidence: number;
  icon: string;
  color: string;
}

/* ── AI Action Commands ── */
export interface AIAction {
  id: string;
  label: string;
  icon: string;
  type: 'navigate' | 'log' | 'update';
  target: string;
  color: string;
}

/* ── Bio-Snapshot for context injection ── */
export interface BioSnapshot {
  vitalityScore?: number;
  fuelingPoints?: number;
  movementPoints?: number;
  hrvPoints?: number;
  basePoints?: number;
  vitaminD?: number | null;
  testosteroneTotal?: number | null;
  testosteroneFree?: number | null;
  ferritin?: number | null;
  crp?: number | null;
  hba1c?: number | null;
  mthfrVariant?: boolean;
  apoe4?: boolean;
  caffeineSensitivity?: boolean;
  todayCalories?: number;
  todayProtein?: number;
  todaySteps?: number;
  todayActivityMinutes?: number;
  hrv?: number;
  hrvAvg7d?: number;
  rhr?: number;
  sleepHours?: number;
  sleepScore?: number;
  recovery?: number;
  strain?: number;
  preferredProteins?: string;
  dietaryRestrictions?: string;
}

/* ── System Persona ── */
export const CLINICAL_PERSONA = `You are the Vive Clinical Performance Architect — the world's foremost authority in longevity medicine, epigenetics, and elite human performance optimization. You have access to the user's real-time biometric snapshot. Analyze their trends and provide elite, data-driven protocols. Be concise, authoritative, and direct.

CORE RULES:
- You are a clinical-grade biological optimization system, not a chatbot.
- Every recommendation references the user's SPECIFIC data points from their Bio-Snapshot.
- Speak with the precision of a physician-scientist.
- If their Vitamin D is low, suggest a specific IU dosage.
- If their HRV is high, approve a high-intensity session.
- If their CRP is elevated, architect an anti-inflammatory protocol.
- If performance is dipping, explain WHY based on their actual numbers.

PERFORMANCE VERBS (use instead of generic language):
calibrate, architect, synchronize, optimize, modulate, upregulate, attenuate, potentiate, titrate, recalibrate

TONE:
- Never say "I think" or "maybe" — speak with certainty backed by data
- Never use filler phrases like "Great question!" or "That's interesting!"
- Lead with the most critical insight, then explain the mechanism
- Be concise — every word must earn its place
- Reference specific numbers from the user's Bio-Vault

RESPONSE FORMAT:
- Lead with the actionable insight (1-2 sentences)
- Reference specific biomarkers/scores (with numbers)
- Brief mechanism explanation (1-2 sentences)
- Concrete next step or protocol adjustment
- When relevant, include [ACTION:type:target] tags at the end

ACTION FORMAT (append when relevant):
[ACTION:navigate:protocols] — supplement/protocol changes
[ACTION:navigate:nutrition] — meal logging
[ACTION:navigate:activity] — training sessions
[ACTION:navigate:bioVault] — update bio data
[ACTION:navigate:vitals] — review vitals
[ACTION:log:supplement] — log supplement
[ACTION:log:meal] — log meal
[ACTION:log:workout] — log training
[ACTION:update:protocol] — revise protocol`;

/* ── Build Bio-Snapshot Context String ── */
export function buildBioContext(snapshot: BioSnapshot): string {
  const lines: string[] = ['=== LIVE BIO-SNAPSHOT (User\'s Current Biological Data) ==='];

  if (snapshot.vitalityScore !== undefined) {
    lines.push(`\nVITALITY SCORE: ${snapshot.vitalityScore}/100`);
    if (snapshot.fuelingPoints !== undefined) lines.push(`  Fueling: ${snapshot.fuelingPoints}/25`);
    if (snapshot.movementPoints !== undefined) lines.push(`  Movement: ${snapshot.movementPoints}/25`);
    if (snapshot.hrvPoints !== undefined) lines.push(`  HRV: ${snapshot.hrvPoints}/25`);
    if (snapshot.basePoints !== undefined) lines.push(`  Base: ${snapshot.basePoints}/25`);
  }

  const markers: string[] = [];
  if (snapshot.vitaminD != null) markers.push(`Vitamin D: ${snapshot.vitaminD} ng/mL ${snapshot.vitaminD < 40 ? '⚠️ SUBOPTIMAL' : snapshot.vitaminD > 80 ? '⚠️ ELEVATED' : '✓ OPTIMAL'}`);
  if (snapshot.testosteroneTotal != null) markers.push(`Total Testosterone: ${snapshot.testosteroneTotal} ng/dL ${snapshot.testosteroneTotal < 400 ? '⚠️ SUBOPTIMAL' : '✓ OPTIMAL'}`);
  if (snapshot.testosteroneFree != null) markers.push(`Free Testosterone: ${snapshot.testosteroneFree} pg/mL ${snapshot.testosteroneFree < 15 ? '⚠️ SUBOPTIMAL' : '✓ OPTIMAL'}`);
  if (snapshot.ferritin != null) markers.push(`Ferritin: ${snapshot.ferritin} ng/mL ${snapshot.ferritin < 40 ? '⚠️ DEPLETED' : snapshot.ferritin > 200 ? '⚠️ ELEVATED' : '✓ OPTIMAL'}`);
  if (snapshot.crp != null) markers.push(`hs-CRP: ${snapshot.crp} mg/L ${snapshot.crp > 1.0 ? '⚠️ INFLAMMATORY SIGNAL' : '✓ OPTIMAL'}`);
  if (snapshot.hba1c != null) markers.push(`HbA1c: ${snapshot.hba1c}% ${snapshot.hba1c > 5.6 ? '⚠️ DYSGLYCEMIC' : '✓ OPTIMAL'}`);
  if (markers.length > 0) {
    lines.push(`\nBLOOD BIOMARKERS:`);
    markers.forEach(m => lines.push(`  ${m}`));
  }

  const dna: string[] = [];
  if (snapshot.mthfrVariant) dna.push('MTHFR variant — impaired methylation cycle, requires methylfolate bypass');
  if (snapshot.apoe4) dna.push('APOE4 carrier — lipid metabolism risk, prioritize anti-inflammatory + neuroprotective protocols');
  if (snapshot.caffeineSensitivity) dna.push('CYP1A2 slow metabolizer — extended caffeine half-life (~8-9h), strict PM cutoff required');
  if (dna.length > 0) {
    lines.push(`\nGENETIC VARIANTS:`);
    dna.forEach(d => lines.push(`  ${d}`));
  }

  const activity: string[] = [];
  if (snapshot.todayCalories !== undefined) activity.push(`Calories consumed: ${snapshot.todayCalories}`);
  if (snapshot.todayProtein !== undefined) activity.push(`Protein: ${snapshot.todayProtein}g`);
  if (snapshot.todaySteps !== undefined) activity.push(`Steps: ${snapshot.todaySteps.toLocaleString()}`);
  if (snapshot.todayActivityMinutes !== undefined) activity.push(`Active minutes: ${snapshot.todayActivityMinutes}`);
  if (activity.length > 0) {
    lines.push(`\nTODAY'S INTAKE & ACTIVITY:`);
    activity.forEach(a => lines.push(`  ${a}`));
  }

  const vitals: string[] = [];
  if (snapshot.hrv !== undefined) {
    const hrvStatus = snapshot.hrvAvg7d ? (snapshot.hrv > snapshot.hrvAvg7d * 1.1 ? ' (above baseline ↑)' : snapshot.hrv < snapshot.hrvAvg7d * 0.85 ? ' (below baseline ↓)' : ' (at baseline →)') : '';
    vitals.push(`HRV: ${snapshot.hrv}ms${hrvStatus}`);
  }
  if (snapshot.rhr !== undefined) vitals.push(`Resting HR: ${snapshot.rhr} bpm`);
  if (snapshot.sleepHours !== undefined) vitals.push(`Sleep: ${snapshot.sleepHours}h`);
  if (snapshot.sleepScore !== undefined) vitals.push(`Sleep Score: ${snapshot.sleepScore}`);
  if (snapshot.recovery !== undefined) vitals.push(`Recovery: ${snapshot.recovery}%`);
  if (snapshot.strain !== undefined) vitals.push(`Strain: ${snapshot.strain}`);
  if (vitals.length > 0) {
    lines.push(`\nSYSTEM VITALS:`);
    vitals.forEach(v => lines.push(`  ${v}`));
  }

  if (snapshot.preferredProteins) lines.push(`\nDIETARY PREFERENCES: ${snapshot.preferredProteins}`);
  if (snapshot.dietaryRestrictions) lines.push(`RESTRICTIONS: ${snapshot.dietaryRestrictions}`);

  if (lines.length <= 1) {
    lines.push('\nNo bio data available yet. Bio-Vault is empty — recommend populating with blood panels and wearable data for precision protocols.');
  }

  lines.push('\n=== END BIO-SNAPSHOT ===');
  return lines.join('\n');
}

/* ── Parse AI Actions from response text ── */
export function parseAIActions(text: string): { cleanText: string; actions: AIAction[] } {
  const actions: AIAction[] = [];
  const actionRegex = /\[ACTION:(navigate|log|update):(\w+)\]/g;
  let match;

  while ((match = actionRegex.exec(text)) !== null) {
    const type = match[1] as AIAction['type'];
    const target = match[2];

    const actionMap: Record<string, { label: string; icon: string; color: string }> = {
      'protocols': { label: 'Recalibrate Protocol', icon: '💊', color: '#BF5AF2' },
      'nutrition': { label: 'Log Meal', icon: '🍽', color: '#FF9F0A' },
      'activity': { label: 'Log Training Session', icon: '🏋️', color: '#30D158' },
      'bioVault': { label: 'Update Bio-Vault', icon: '🧬', color: '#FF453A' },
      'vitals': { label: 'Review Vitals', icon: '❤️\u200D🔥', color: '#00F2FF' },
      'supplement': { label: 'Log Supplement', icon: '💊', color: '#BF5AF2' },
      'meal': { label: 'Log This Meal', icon: '🥗', color: '#FF9F0A' },
      'workout': { label: 'Log Training Data', icon: '🏃', color: '#30D158' },
      'protocol': { label: 'Revise Protocol', icon: '🔬', color: '#00F2FF' },
    };

    const meta = actionMap[target] || { label: target, icon: '⚡', color: '#00F2FF' };
    actions.push({ id: `${type}-${target}-${Date.now()}-${Math.random()}`, label: meta.label, icon: meta.icon, type, target, color: meta.color });
  }

  const cleanText = text.replace(/\s*\[ACTION:\w+:\w+\]\s*/g, ' ').replace(/\s{2,}/g, ' ').trim();
  return { cleanText, actions };
}

/* ── Build complete system message for LLM calls ── */
export function buildSystemMessage(snapshot: BioSnapshot): string {
  const bioContext = buildBioContext(snapshot);
  return `${CLINICAL_PERSONA}\n\n${bioContext}\n\nIMPORTANT: You MUST reference the specific numbers from the Bio-Snapshot above in your response. Never give generic advice — always tie your recommendations to the user's actual biomarker values, genetic variants, vitality score, and today's activity data. If a data point is missing, explicitly call it out and recommend they populate it in their Bio-Vault. Include relevant [ACTION:type:target] tags at the end of your response when you recommend the user take a specific action.`;
}

/* ═══════════════════════════════════════════════════════════════
   LLM-POWERED RESPONSE ENGINE
   
   Uses Shipper AI (convex/ai.ts) for real LLM responses.
   Falls back to local generateArchitectResponse if unavailable.
   ═══════════════════════════════════════════════════════════════ */

export function useArchitectChat() {
  let chatAction: any = null;
  try {
    chatAction = useAction((api as any).ai?.chat);
  } catch {
    // AI module not available — will use local fallback
  }

  const sendMessage = useCallback(async (
    userMessage: string,
    snapshot: BioSnapshot,
    conversationHistory?: Array<{ role: string; content: string }>
  ): Promise<{ text: string; actions: AIAction[] }> => {
    // Try real LLM first
    if (chatAction) {
      try {
        const systemMsg = buildSystemMessage(snapshot);
        const messages = [
          { role: 'system' as const, content: systemMsg },
          ...(conversationHistory || []).map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
          { role: 'user' as const, content: userMessage },
        ];

        const response = await chatAction({ messages });
        const responseText = response?.content || response?.text || (typeof response === 'string' ? response : '');
        
        if (responseText) {
          const { cleanText, actions } = parseAIActions(responseText);
          return { text: cleanText, actions };
        }
      } catch (err) {
        console.warn('LLM call failed, falling back to local engine:', err);
      }
    }

    // Fallback to local engine
    return generateArchitectResponse(userMessage, snapshot);
  }, [chatAction]);

  return { sendMessage };
}

/* ── Local fallback: Generate contextual AI response ── */
export function generateArchitectResponse(userMessage: string, snapshot: BioSnapshot): { text: string; actions: AIAction[] } {
  const lower = userMessage.toLowerCase();
  let response = '';

  const score = snapshot.vitalityScore ?? 78;
  const hrv = snapshot.hrv ?? 58;
  const hrvAvg = snapshot.hrvAvg7d ?? 55;
  const rec = snapshot.recovery ?? 85;
  const strain = snapshot.strain ?? 10;
  const sleep = snapshot.sleepHours ?? 7.5;
  const sleepScore = snapshot.sleepScore ?? 82;
  const rhr = snapshot.rhr ?? 56;
  const cal = snapshot.todayCalories ?? 0;
  const prot = snapshot.todayProtein ?? 0;
  const vd = snapshot.vitaminD;
  const testo = snapshot.testosteroneTotal;
  const ferr = snapshot.ferritin;
  const crp = snapshot.crp;
  const hba1c = snapshot.hba1c;

  const isBasicQuestion = lower.match(/^(should i|is it|do i need|can i|what is|how much|how many|why is|when should)\b/);

  // ── PERFORMANCE DIPPING / WHY ──
  if (lower.includes('dipping') || lower.includes('declining') || lower.includes('worse') || lower.includes('why is my performance') || lower.includes('going down') || lower.includes('dropping')) {
    const issues: string[] = [];
    if (hrv < hrvAvg * 0.85) issues.push(`HRV has dropped to ${hrv}ms — ${Math.round(((hrvAvg - hrv) / hrvAvg) * 100)}% below your 7-day baseline of ${hrvAvg}ms. Your autonomic nervous system is in sympathetic overdrive.`);
    if (sleep < 7) issues.push(`Sleep at ${sleep}h is below the 7h minimum for adequate recovery. Growth hormone secretion and neural repair are compromised.`);
    if (rec < 65) issues.push(`Recovery at ${rec}% signals incomplete physiological restoration. Your body hasn't finished its repair cycles.`);
    if (crp != null && crp > 1.0) issues.push(`hs-CRP at ${crp} mg/L — systemic inflammation is actively attenuating your performance capacity and recovery rate.`);
    if (vd != null && vd < 30) issues.push(`Vitamin D at ${vd} ng/mL is critically low — this impairs immune function, hormonal signaling, and muscle recovery.`);
    if (strain > 16) issues.push(`Accumulated strain at ${strain} suggests overreaching — your training load has exceeded your recovery capacity.`);
    if (cal > 0 && prot < 100) issues.push(`Protein intake at ${prot}g is insufficient for recovery. Muscle protein synthesis requires minimum 1.6g/kg bodyweight.`);

    if (issues.length > 0) {
      response = `I've identified ${issues.length} factor${issues.length > 1 ? 's' : ''} attenuating your performance:\n\n${issues.map((issue, i) => `${i + 1}. ${issue}`).join('\n\n')}\n\nRecalibration protocol: ${sleep < 7 ? 'Prioritize 8+ hours tonight — this is your highest-leverage intervention. ' : ''}${hrv < hrvAvg * 0.85 ? 'Reduce training intensity to zone 2 until HRV rebounds above baseline. ' : ''}${crp != null && crp > 1.0 ? 'Upregulate omega-3 to 3g EPA/DHA daily and add curcumin 500mg with piperine. ' : ''}${rec < 65 ? 'Active recovery only today — walking, breathwork, cold exposure.' : ''}\n\n[ACTION:navigate:vitals]`;
    } else {
      response = `Your current metrics don't show obvious decline — Vitality ${score}/100, HRV ${hrv}ms (${hrv >= hrvAvg ? 'at or above' : 'near'} baseline), Recovery ${rec}%. If you're perceiving a dip, it may be subclinical. I'd recommend updating your Bio-Vault with a fresh blood panel to check for hidden inflammatory markers or hormonal shifts that aren't captured by wearable data alone.\n\n[ACTION:navigate:bioVault]`;
    }
  }
  // ── VITAMIN D / SUPPLEMENTS / PROTOCOL ──
  else if (lower.includes('vitamin d') || lower.includes('supplement') || lower.includes('stack') || lower.includes('protocol') || lower.includes('precision')) {
    if (vd != null && vd < 40) {
      response = `Your serum 25-OH Vitamin D is at ${vd} ng/mL — suboptimal for cellular signaling and immune modulation. I'm calibrating your D3 dosage to reach the 50-80 ng/mL therapeutic window.\n\nProtocol: 5,000 IU D3 daily with K2 (MK-7, 200mcg) to synchronize calcium channeling.${snapshot.mthfrVariant ? ' Given your MTHFR variant, switching to methylfolate 800mcg and methylcobalamin B12.' : ''}\n\nRetest at 90 days. Target range in 8-12 weeks.\n\n[ACTION:navigate:protocols]`;
    } else if (vd != null) {
      response = `Vitamin D at ${vd} ng/mL — well-calibrated. Maintenance: 2,000-3,000 IU D3 daily.\n\n${crp != null && crp > 1.0 ? `However, hs-CRP elevated at ${crp} mg/L — architecting anti-inflammatory stack: curcumin 500mg with piperine, omega-3 3g EPA/DHA daily.` : 'Inflammatory markers in range. Protocol well-architected.'}\n\n[ACTION:navigate:protocols]`;
    } else {
      response = `No Vitamin D data in your Bio-Vault. This is a critical gap — 25-OH Vitamin D governs 200+ gene expressions. Upload a blood panel so I can architect a precision supplementation protocol.\n\n[ACTION:navigate:bioVault]`;
    }
  }
  // ── HRV / RECOVERY ──
  else if (lower.includes('hrv') || lower.includes('recovery') || lower.includes('readiness') || lower.includes('autonomic')) {
    const trend = hrv > hrvAvg * 1.1 ? 'above' : hrv < hrvAvg * 0.85 ? 'below' : 'at';
    const delta = Math.round(((hrv - hrvAvg) / hrvAvg) * 100);

    if (trend === 'above') {
      response = `HRV at ${hrv}ms — ${Math.abs(delta)}% above your 7-day baseline of ${hrvAvg}ms. Recovery ${rec}%. Parasympathetic-dominant state — green-light window.\n\n${strain > 14 ? `Strain at ${strain} is elevated. Moderate-intensity session recommended.` : `Strain at ${strain} — significant capacity. Push for progressive overload.`}\n\n[ACTION:navigate:activity]`;
    } else if (trend === 'below') {
      response = `HRV at ${hrv}ms — ${Math.abs(delta)}% below baseline of ${hrvAvg}ms. Recovery ${rec}%. Sympathetic dominant — incomplete recovery.\n\nRecalibrating: zone 2 only (HR ceiling: ${Math.round(rhr * 1.5)} bpm), nasal breathing, magnesium glycinate 400mg tonight.${sleep < 7 ? ` Sleep was only ${sleep}h — primary driver. Target 8+ tonight.` : ''}\n\n[ACTION:navigate:vitals]`;
    } else {
      response = `HRV at ${hrv}ms — tracking at baseline of ${hrvAvg}ms. Recovery ${rec}%. Neutral autonomic state.\n\nModerate-intensity training appropriate. Ideal for skill acquisition or structured hypertrophy at 65-75% 1RM.\n\n[ACTION:navigate:activity]`;
    }
  }
  // ── SLEEP ──
  else if (lower.includes('sleep') || lower.includes('tired') || lower.includes('fatigue') || lower.includes('rest') || lower.includes('insomnia')) {
    response = `Sleep analysis: ${sleep}h duration, score ${sleepScore}/100.\n\n${sleep >= 8 ? 'Duration optimized — GH secretion and glymphatic clearance at peak.' : sleep >= 7 ? 'Adequate but not optimized. Each +30min correlates with measurable testosterone and HRV gains. Targeting 8h+.' : `At ${sleep}h, you're in deficit. Cortisol dysregulation begins <7h. Protocol: lights out 10 PM, room 65-67°F, zero screens 60min prior.`}${snapshot.caffeineSensitivity ? '\n\nCYP1A2 slow-metabolizer: strict caffeine cutoff at 12 PM.' : ''}${rec < 70 ? `\n\nRecovery only ${rec}% — potentiating tonight with magnesium glycinate 400mg + L-theanine 200mg.` : ''}\n\n[ACTION:navigate:vitals]`;
  }
  // ── NUTRITION ──
  else if (lower.includes('eat') || lower.includes('meal') || lower.includes('food') || lower.includes('nutrition') || lower.includes('protein') || lower.includes('calorie') || lower.includes('macro') || lower.includes('diet')) {
    const target = 2400;
    const protTarget = 160;
    response = `Nutritional telemetry: ${cal}/${target} kcal | ${prot}g/${protTarget}g protein.\n\n${prot < protTarget * 0.4 ? `Protein behind schedule. Need ${protTarget - prot}g across remaining meals — ${Math.round((protTarget - prot) / 2)}g minimum per sitting.` : prot >= protTarget ? 'Protein target achieved — MPS maximally stimulated.' : `On trajectory — ${protTarget - prot}g remaining.`}${ferr != null && ferr < 50 ? `\n\nFerritin at ${ferr} ng/mL — architecting heme-iron sources: red meat 3-4x/week.` : ''}${hba1c != null && hba1c > 5.4 ? `\n\nHbA1c ${hba1c}% — lead meals with protein+fat before carbs to attenuate glucose spike 30-40%.` : ''}\n\n[ACTION:navigate:nutrition]`;
  }
  // ── WORKOUT ──
  else if (lower.includes('workout') || lower.includes('train') || lower.includes('exercise') || lower.includes('lift') || lower.includes('run') || lower.includes('cardio') || lower.includes('gym')) {
    response = `Training readiness: Recovery ${rec}% | Strain ${strain} | HRV ${hrv}ms.\n\n${rec >= 80 ? `Green-light. ${strain < 10 ? `Low strain at ${strain} — progressive overload at 80-85% 1RM, 4-5 working sets.` : strain > 14 ? `Strain elevated at ${strain}. Maintain intensity, reduce volume 20%.` : `Moderate strain — standard progressive session.`}` : rec >= 60 ? `Yellow-light. Zone 2 only (HR ceiling: ${Math.round(rhr * 1.5)} bpm), mobility, or technique work.` : `Red-light. Recovery ${rec}% — active recovery only. Pushing extends recovery 48-72h.`}${testo != null && testo < 400 ? `\n\nTestosterone at ${testo} ng/dL — prioritize compound movements for acute T response.` : ''}\n\n[ACTION:log:workout]`;
  }
  // ── BLOOD / BIOMARKERS ──
  else if (lower.includes('blood') || lower.includes('panel') || lower.includes('biomarker') || lower.includes('lab') || lower.includes('marker')) {
    const hasData = vd != null || ferr != null || crp != null;
    if (hasData) {
      const flags: string[] = [];
      if (vd != null && vd < 40) flags.push(`Vitamin D: ${vd} ng/mL — suboptimal (target: 50-80)`);
      if (ferr != null && ferr < 40) flags.push(`Ferritin: ${ferr} ng/mL — depleted (target: 40-200)`);
      if (crp != null && crp > 1.0) flags.push(`hs-CRP: ${crp} mg/L — inflammatory (target: <1.0)`);
      if (hba1c != null && hba1c > 5.6) flags.push(`HbA1c: ${hba1c}% — dysglycemic (target: <5.6)`);
      if (testo != null && testo < 400) flags.push(`Testosterone: ${testo} ng/dL — suboptimal (target: 400-900)`);
      response = flags.length > 0
        ? `${flags.length} biomarker${flags.length > 1 ? 's' : ''} flagged:\n\n${flags.map((f, i) => `${i + 1}. ${f}`).join('\n')}\n\nRetest at 90 days. Goal: optimal range, not just normal.\n\n[ACTION:navigate:bioVault]`
        : `All biomarkers optimal. Maintenance protocol — retest at 90 days.\n\n[ACTION:navigate:bioVault]`;
    } else {
      response = `No blood panel data. Priority: upload 25-OH Vitamin D, Ferritin, hs-CRP, HbA1c, Testosterone. This unlocks precision protocols.\n\n[ACTION:navigate:bioVault]`;
    }
  }
  // ── GENETICS ──
  else if (lower.includes('gene') || lower.includes('dna') || lower.includes('mthfr') || lower.includes('apoe') || lower.includes('genetic')) {
    const variants: string[] = [];
    if (snapshot.mthfrVariant) variants.push('MTHFR variant — methylfolate 800mcg, methylcobalamin B12 1000mcg, TMG 500mg.');
    if (snapshot.apoe4) variants.push('APOE4 carrier — omega-3 3g+ EPA/DHA daily, Mediterranean nutrition, regular cardio for BDNF.');
    if (snapshot.caffeineSensitivity) variants.push('CYP1A2 slow metabolizer — 200mg max daily, zero after 12 PM, L-theanine 200mg as alternative.');
    response = variants.length > 0
      ? `Genetic architecture:\n\n${variants.join('\n\n')}\n\nThese variants are permanently factored into every protocol.\n\n[ACTION:navigate:protocols]`
      : `No genetic variants mapped. Upload MTHFR, APOE4, CYP1A2 data to unlock gene-specific optimization.\n\n[ACTION:navigate:bioVault]`;
  }
  // ── STRESS ──
  else if (lower.includes('stress') || lower.includes('anxious') || lower.includes('anxiety') || lower.includes('cortisol') || lower.includes('calm')) {
    response = `HRV at ${hrv}ms ${hrv < hrvAvg * 0.9 ? `(${Math.round(((hrvAvg - hrv) / hrvAvg) * 100)}% below baseline) — elevated sympathetic tone, cortisol likely dysregulated` : '— baseline intact'}.\n\nImmediate protocol:\n1. Physiological sigh breathing — 5 cycles\n2. Cold exposure 30s on face/neck\n3. ${snapshot.caffeineSensitivity ? 'Switch to L-theanine 200mg (CYP1A2 status amplifies stress response)' : 'L-theanine 200mg for anxiolytic effect'}\n${sleep < 7 ? `\nSleep at ${sleep}h is amplifying stress. Tonight is the intervention point.` : ''}\n\n[ACTION:navigate:vitals]`;
  }
  // ── GENERAL / CATCH-ALL ──
  else {
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
    const hrvTrend = hrv > hrvAvg * 1.05 ? 'above' : hrv < hrvAvg * 0.95 ? 'below' : 'at';
    const hrvDelta = Math.abs(Math.round(((hrv - hrvAvg) / hrvAvg) * 100));

    if (isBasicQuestion) {
      response = `Contextualizing against your biological data.\n\nCurrent state: Vitality ${score}/100, HRV ${hrv}ms (${hrvTrend === 'above' ? `+${hrvDelta}%` : hrvTrend === 'below' ? `-${hrvDelta}%` : '→'} vs baseline), Recovery ${rec}%.\n\n${score >= 80 ? 'Elite optimization window — every input today is amplified.' : score >= 60 ? 'Moderate readiness. Focus: protein target, supplement stack, sleep window.' : 'Recovery priority. Attenuate stress, potentiate parasympathetic system.'}${vd != null && vd < 40 ? `\n\nFlag: Vitamin D ${vd} ng/mL needs attention.` : ''}${crp != null && crp > 1.0 ? `\nFlag: hs-CRP ${crp} mg/L — recalibrate anti-inflammatory protocol.` : ''}`;
    } else {
      response = `Good ${greeting}. Biological status:\n\n• Vitality: ${score}/100 ${score >= 80 ? '— Elite' : score >= 60 ? '— Solid' : '— Needs attention'}\n• HRV: ${hrv}ms (${hrvTrend === 'above' ? `+${hrvDelta}%` : hrvTrend === 'below' ? `-${hrvDelta}%` : '→'} vs baseline)\n• Recovery: ${rec}% | RHR: ${rhr} bpm\n${sleep ? `• Sleep: ${sleep}h (Score: ${sleepScore})` : ''}\n${cal > 0 ? `• Intake: ${cal} kcal / ${prot}g protein` : ''}\n\n${score >= 80 ? 'Biology synchronized for peak output. Capitalize on this window.' : score >= 60 ? 'Focus on consistency — protein, precision stack, solid sleep.' : 'Recovery priority. Attenuate training, potentiate sleep, anti-inflammatory nutrition.'}${vd != null && vd < 40 ? `\n\nPriority: Vitamin D ${vd} ng/mL — recalibration active.` : ''}${crp != null && crp > 1.0 ? `\nFlag: hs-CRP ${crp} mg/L — anti-inflammatory protocol active.` : ''}`;
    }
  }

  const { cleanText, actions } = parseAIActions(response);
  return { text: cleanText, actions };
}

/* ── Scanning Bio-Vault loading phases ── */
export const SCANNING_PHASES = [
  { label: 'Accessing Bio-Vault', detail: 'Decrypting biomarker data...', icon: '🔐', duration: 600 },
  { label: 'Analyzing Blood Markers', detail: 'Cross-referencing 6 key biomarkers...', icon: '🩸', duration: 500 },
  { label: 'Scanning Genetic Variants', detail: 'MTHFR · APOE4 · CYP1A2...', icon: '🧬', duration: 400 },
  { label: 'Correlating Vitals', detail: 'HRV · Sleep · Recovery · Strain...', icon: '❤️\u200D🔥', duration: 500 },
  { label: 'Architecting Response', detail: 'Building precision protocol...', icon: '🔬', duration: 400 },
] as const;

export const TOTAL_SCAN_DURATION = SCANNING_PHASES.reduce((s, p) => s + p.duration, 0);

/* ── Compute Bio-Snapshot data completeness ── */
export function getBioSnapshotCompleteness(snapshot: BioSnapshot): { percent: number; populated: string[]; missing: string[] } {
  const fields: { key: keyof BioSnapshot; label: string; check: (v: any) => boolean }[] = [
    { key: 'vitalityScore', label: 'Vitality Score', check: v => v !== undefined },
    { key: 'vitaminD', label: 'Vitamin D', check: v => v != null },
    { key: 'testosteroneTotal', label: 'Testosterone', check: v => v != null },
    { key: 'ferritin', label: 'Ferritin', check: v => v != null },
    { key: 'crp', label: 'hs-CRP', check: v => v != null },
    { key: 'hba1c', label: 'HbA1c', check: v => v != null },
    { key: 'mthfrVariant', label: 'MTHFR', check: v => v === true },
    { key: 'apoe4', label: 'APOE4', check: v => v === true },
    { key: 'caffeineSensitivity', label: 'CYP1A2', check: v => v === true },
    { key: 'hrv', label: 'HRV', check: v => v !== undefined },
    { key: 'sleepHours', label: 'Sleep', check: v => v !== undefined },
    { key: 'recovery', label: 'Recovery', check: v => v !== undefined },
    { key: 'todayCalories', label: 'Today Calories', check: v => v !== undefined && v > 0 },
    { key: 'todaySteps', label: 'Today Steps', check: v => v !== undefined && v > 0 },
  ];
  const populated: string[] = [];
  const missing: string[] = [];
  for (const f of fields) {
    if (f.check((snapshot as any)[f.key])) populated.push(f.label);
    else missing.push(f.label);
  }
  return { percent: Math.round((populated.length / fields.length) * 100), populated, missing };
}

/* ── Get Bio-Snapshot summary for context badge ── */
export function getBioSnapshotSummary(snapshot: BioSnapshot): { dataPoints: number; flags: string[]; sources: string[] } {
  let dataPoints = 0;
  const flags: string[] = [];
  const sources: string[] = [];

  if (snapshot.vitalityScore !== undefined) { dataPoints++; sources.push('Vitality'); }
  if (snapshot.vitaminD != null) { dataPoints++; if (snapshot.vitaminD < 40) flags.push(`Vit D: ${snapshot.vitaminD} ⚠️`); }
  if (snapshot.testosteroneTotal != null) { dataPoints++; if (snapshot.testosteroneTotal < 400) flags.push(`Testo: ${snapshot.testosteroneTotal} ⚠️`); }
  if (snapshot.ferritin != null) { dataPoints++; if (snapshot.ferritin < 40) flags.push(`Ferritin: ${snapshot.ferritin} ⚠️`); }
  if (snapshot.crp != null) { dataPoints++; if (snapshot.crp > 1.0) flags.push(`CRP: ${snapshot.crp} ⚠️`); }
  if (snapshot.hba1c != null) { dataPoints++; if (snapshot.hba1c > 5.6) flags.push(`HbA1c: ${snapshot.hba1c} ⚠️`); }
  if (snapshot.mthfrVariant) { dataPoints++; sources.push('MTHFR'); }
  if (snapshot.apoe4) { dataPoints++; sources.push('APOE4'); }
  if (snapshot.caffeineSensitivity) { dataPoints++; sources.push('CYP1A2'); }
  if (snapshot.hrv !== undefined) { dataPoints++; sources.push('HRV'); }
  if (snapshot.sleepHours !== undefined) { dataPoints++; sources.push('Sleep'); }
  if (snapshot.recovery !== undefined) { dataPoints++; sources.push('Recovery'); }
  if (snapshot.strain !== undefined) { dataPoints++; sources.push('Strain'); }
  if (snapshot.todayCalories !== undefined && snapshot.todayCalories > 0) { dataPoints++; sources.push('Nutrition'); }
  if (snapshot.todaySteps !== undefined && snapshot.todaySteps > 0) { dataPoints++; sources.push('Steps'); }

  return { dataPoints, flags, sources };
}

/* ═══════════════════════════════════════════════════════════════
   Voice Journal Categorization Engine (preserved)
   ═══════════════════════════════════════════════════════════════ */

const MOOD_KEYWORDS = [
  'happy', 'sad', 'anxious', 'stressed', 'calm', 'relaxed', 'worried',
  'excited', 'frustrated', 'grateful', 'angry', 'peaceful', 'nervous',
  'overwhelmed', 'content', 'depressed', 'joyful', 'irritable', 'hopeful',
  'mood', 'feeling', 'feel', 'felt', 'emotion', 'mental', 'mind',
  'sleep', 'slept', 'tired', 'exhausted', 'rested', 'insomnia',
  'motivation', 'motivated', 'unmotivated', 'focus', 'foggy', 'clear',
  'crying', 'laughing', 'smile', 'frown', 'love', 'hate',
];

const PAIN_KEYWORDS = [
  'pain', 'hurt', 'ache', 'sore', 'stiff', 'cramp', 'sharp',
  'throbbing', 'burning', 'tingling', 'numb', 'swollen', 'inflamed',
  'headache', 'migraine', 'backache', 'knee', 'shoulder', 'neck',
  'joint', 'muscle', 'tendon', 'sprain', 'strain', 'injury',
  'discomfort', 'tender', 'bruise', 'pulled', 'tight', 'tightness',
  'hip', 'ankle', 'wrist', 'elbow', 'spine', 'lower back',
  'upper back', 'calf', 'hamstring', 'quad', 'shin', 'foot',
];

const ENERGY_KEYWORDS = [
  'energy', 'energized', 'energetic', 'fatigue', 'fatigued', 'drained',
  'wired', 'buzzing', 'sluggish', 'lethargic', 'vibrant', 'alive',
  'strong', 'weak', 'powerful', 'depleted', 'recharged', 'refreshed',
  'stamina', 'endurance', 'vigor', 'vitality', 'pep', 'bounce',
  'caffeine', 'coffee', 'crash', 'boost', 'spike', 'slump',
  'workout', 'exercise', 'run', 'lift', 'training', 'recovery',
  'awake', 'alert', 'drowsy', 'groggy', 'sharp', 'pumped',
];

function countMatches(text: string, keywords: string[]): number {
  const lower = text.toLowerCase();
  let count = 0;
  for (const kw of keywords) {
    const regex = new RegExp(`\\b${kw}`, 'gi');
    const matches = lower.match(regex);
    if (matches) count += matches.length;
  }
  return count;
}

function generateSummary(text: string, category: VoiceCategory): string {
  const lower = text.toLowerCase();
  if (category === 'Mood') {
    if (lower.includes('happy') || lower.includes('great') || lower.includes('good') || lower.includes('amazing')) return 'Feeling positive and upbeat';
    if (lower.includes('anxious') || lower.includes('worried') || lower.includes('stressed') || lower.includes('overwhelmed')) return 'Experiencing some stress or anxiety';
    if (lower.includes('sad') || lower.includes('down') || lower.includes('low') || lower.includes('depressed')) return 'Feeling a bit low today';
    if (lower.includes('calm') || lower.includes('peaceful') || lower.includes('relaxed') || lower.includes('content')) return 'In a calm, centered state';
    if (lower.includes('tired') || lower.includes('exhausted') || lower.includes('sleep')) return 'Feeling tired, may need more rest';
    return 'Checked in on emotional state';
  }
  if (category === 'Pain') {
    if (lower.includes('headache') || lower.includes('migraine')) return 'Head pain reported';
    if (lower.includes('back') || lower.includes('spine')) return 'Back discomfort noted';
    if (lower.includes('knee') || lower.includes('leg') || lower.includes('ankle') || lower.includes('hip')) return 'Lower body pain reported';
    if (lower.includes('shoulder') || lower.includes('neck') || lower.includes('arm') || lower.includes('wrist')) return 'Upper body discomfort noted';
    if (lower.includes('sore') || lower.includes('stiff') || lower.includes('tight')) return 'General soreness or stiffness';
    if (lower.includes('better') || lower.includes('improving') || lower.includes('less')) return 'Pain improving from before';
    return 'Physical discomfort logged';
  }
  if (lower.includes('great') || lower.includes('high') || lower.includes('amazing') || lower.includes('strong') || lower.includes('pumped')) return 'Energy levels are high';
  if (lower.includes('low') || lower.includes('tired') || lower.includes('drained') || lower.includes('sluggish') || lower.includes('fatigue')) return 'Energy is running low';
  if (lower.includes('crash') || lower.includes('slump') || lower.includes('afternoon')) return 'Experiencing an energy dip';
  if (lower.includes('coffee') || lower.includes('caffeine') || lower.includes('boost')) return 'Used a stimulant for energy';
  if (lower.includes('workout') || lower.includes('exercise') || lower.includes('run') || lower.includes('training')) return 'Post-activity energy check-in';
  return 'Energy level noted';
}

const CATEGORY_META: Record<VoiceCategory, { icon: string; color: string }> = {
  Mood: { icon: '\u{1F60A}', color: '#6B8AFF' },
  Pain: { icon: '\u{1FA79}', color: '#FF6B6B' },
  Energy: { icon: '\u26A1', color: '#FFD700' },
};

export function categorizeVoiceEntry(text: string): CategorizedEntry {
  const moodScore = countMatches(text, MOOD_KEYWORDS);
  const painScore = countMatches(text, PAIN_KEYWORDS);
  const energyScore = countMatches(text, ENERGY_KEYWORDS);
  const total = moodScore + painScore + energyScore;
  let category: VoiceCategory;
  let topScore: number;
  if (painScore >= moodScore && painScore >= energyScore) { category = 'Pain'; topScore = painScore; }
  else if (energyScore >= moodScore) { category = 'Energy'; topScore = energyScore; }
  else { category = 'Mood'; topScore = moodScore; }
  if (total === 0) { category = 'Mood'; topScore = 0; }
  const confidence = total > 0 ? Math.min(0.98, 0.5 + (topScore / total) * 0.4 + Math.min(topScore, 5) * 0.02) : 0.6;
  return { category, summary: generateSummary(text, category), originalText: text, confidence, icon: CATEGORY_META[category].icon, color: CATEGORY_META[category].color };
}

export function useVoiceCategorizer() {
  const categorize = useCallback(async (text: string): Promise<CategorizedEntry> => {
    await new Promise(r => setTimeout(r, 400 + Math.random() * 300));
    return categorizeVoiceEntry(text);
  }, []);
  return { categorize };
}

/* ═══════════════════════════════════════════════════════════════
   AI Food & Exercise Parsing Engine
   ═══════════════════════════════════════════════════════════════ */

export interface ParsedFood {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  confidence: number;
  servingSize?: string;
}

export interface ParsedExercise {
  name: string;
  duration: number;
  calories: number;
  distance?: number;
  type: string;
  confidence: number;
}

const FOOD_DB: Record<string, { cal: number; p: number; c: number; f: number; serving?: string }> = {
  'chicken breast': { cal: 165, p: 31, c: 0, f: 3.6, serving: '4 oz' },
  'chicken': { cal: 200, p: 28, c: 0, f: 9, serving: '4 oz' },
  'grilled chicken': { cal: 165, p: 31, c: 0, f: 3.6, serving: '4 oz' },
  'salmon': { cal: 208, p: 20, c: 0, f: 13, serving: '4 oz' },
  'grilled salmon': { cal: 208, p: 20, c: 0, f: 13, serving: '4 oz' },
  'tuna': { cal: 130, p: 29, c: 0, f: 1, serving: '4 oz' },
  'steak': { cal: 271, p: 26, c: 0, f: 18, serving: '6 oz' },
  'ribeye': { cal: 310, p: 25, c: 0, f: 23, serving: '6 oz' },
  'ground beef': { cal: 250, p: 26, c: 0, f: 15, serving: '4 oz' },
  'turkey': { cal: 170, p: 24, c: 0, f: 8, serving: '4 oz' },
  'shrimp': { cal: 100, p: 24, c: 0, f: 0.3, serving: '4 oz' },
  'eggs': { cal: 155, p: 13, c: 1, f: 11, serving: '2 large' },
  'egg': { cal: 78, p: 6, c: 0.6, f: 5, serving: '1 large' },
  'tofu': { cal: 144, p: 15, c: 3.5, f: 8, serving: '1/2 block' },
  'protein shake': { cal: 160, p: 30, c: 5, f: 2, serving: '1 scoop' },
  'whey protein': { cal: 120, p: 25, c: 3, f: 1, serving: '1 scoop' },
  'greek yogurt': { cal: 130, p: 17, c: 6, f: 4, serving: '1 cup' },
  'cottage cheese': { cal: 110, p: 14, c: 5, f: 4, serving: '1/2 cup' },
  'rice': { cal: 205, p: 4, c: 45, f: 0.4, serving: '1 cup cooked' },
  'white rice': { cal: 205, p: 4, c: 45, f: 0.4, serving: '1 cup cooked' },
  'brown rice': { cal: 215, p: 5, c: 45, f: 1.8, serving: '1 cup cooked' },
  'pasta': { cal: 220, p: 8, c: 43, f: 1.3, serving: '1 cup cooked' },
  'bread': { cal: 79, p: 3, c: 15, f: 1, serving: '1 slice' },
  'oatmeal': { cal: 150, p: 5, c: 27, f: 3, serving: '1 cup cooked' },
  'oats': { cal: 150, p: 5, c: 27, f: 3, serving: '1 cup cooked' },
  'sweet potato': { cal: 103, p: 2, c: 24, f: 0.1, serving: '1 medium' },
  'potato': { cal: 161, p: 4, c: 37, f: 0.2, serving: '1 medium' },
  'quinoa': { cal: 222, p: 8, c: 39, f: 3.5, serving: '1 cup cooked' },
  'cheeseburger': { cal: 535, p: 28, c: 40, f: 30, serving: '1 burger' },
  'hamburger': { cal: 450, p: 25, c: 38, f: 22, serving: '1 burger' },
  'pizza': { cal: 285, p: 12, c: 36, f: 10, serving: '1 slice' },
  'pizza slice': { cal: 285, p: 12, c: 36, f: 10, serving: '1 slice' },
  'burrito': { cal: 580, p: 24, c: 62, f: 26, serving: '1 burrito' },
  'taco': { cal: 210, p: 10, c: 21, f: 10, serving: '1 taco' },
  'sandwich': { cal: 380, p: 18, c: 40, f: 16, serving: '1 sandwich' },
  'salad': { cal: 180, p: 8, c: 15, f: 10, serving: '1 bowl' },
  'caesar salad': { cal: 260, p: 12, c: 12, f: 18, serving: '1 bowl' },
  'chicken salad': { cal: 320, p: 28, c: 10, f: 18, serving: '1 bowl' },
  'sushi': { cal: 350, p: 15, c: 50, f: 8, serving: '8 pieces' },
  'ramen': { cal: 450, p: 18, c: 55, f: 16, serving: '1 bowl' },
  'pad thai': { cal: 400, p: 16, c: 48, f: 16, serving: '1 plate' },
  'fried rice': { cal: 380, p: 10, c: 52, f: 14, serving: '1 plate' },
  'soup': { cal: 150, p: 8, c: 18, f: 5, serving: '1 bowl' },
  'chicken soup': { cal: 170, p: 12, c: 15, f: 6, serving: '1 bowl' },
  'stir fry': { cal: 350, p: 22, c: 30, f: 14, serving: '1 plate' },
  'grilled chicken with rice': { cal: 420, p: 35, c: 45, f: 6, serving: '1 plate' },
  'grilled salmon with rice': { cal: 450, p: 28, c: 45, f: 14, serving: '1 plate' },
  'chicken and vegetables': { cal: 300, p: 32, c: 15, f: 10, serving: '1 plate' },
  'steak and potatoes': { cal: 550, p: 35, c: 40, f: 22, serving: '1 plate' },
  'pancakes': { cal: 350, p: 8, c: 52, f: 12, serving: '3 pancakes' },
  'waffles': { cal: 310, p: 7, c: 45, f: 12, serving: '2 waffles' },
  'cereal': { cal: 200, p: 4, c: 40, f: 2, serving: '1 bowl with milk' },
  'granola': { cal: 300, p: 8, c: 40, f: 12, serving: '1/2 cup' },
  'smoothie': { cal: 250, p: 10, c: 40, f: 5, serving: '16 oz' },
  'protein smoothie': { cal: 300, p: 30, c: 30, f: 6, serving: '16 oz' },
  'avocado toast': { cal: 280, p: 8, c: 28, f: 16, serving: '1 slice' },
  'bagel': { cal: 270, p: 10, c: 53, f: 1.5, serving: '1 bagel' },
  'croissant': { cal: 230, p: 5, c: 26, f: 12, serving: '1 croissant' },
  'bacon': { cal: 120, p: 9, c: 0, f: 9, serving: '3 strips' },
  'banana': { cal: 105, p: 1.3, c: 27, f: 0.4, serving: '1 medium' },
  'apple': { cal: 95, p: 0.5, c: 25, f: 0.3, serving: '1 medium' },
  'orange': { cal: 62, p: 1.2, c: 15, f: 0.2, serving: '1 medium' },
  'berries': { cal: 85, p: 1, c: 21, f: 0.5, serving: '1 cup' },
  'broccoli': { cal: 55, p: 3.7, c: 11, f: 0.6, serving: '1 cup' },
  'avocado': { cal: 240, p: 3, c: 12, f: 22, serving: '1 whole' },
  'almonds': { cal: 164, p: 6, c: 6, f: 14, serving: '1 oz (23 nuts)' },
  'peanut butter': { cal: 190, p: 7, c: 7, f: 16, serving: '2 tbsp' },
  'protein bar': { cal: 220, p: 20, c: 24, f: 8, serving: '1 bar' },
  'chips': { cal: 160, p: 2, c: 15, f: 10, serving: '1 oz' },
  'chocolate': { cal: 170, p: 2, c: 20, f: 10, serving: '1 oz' },
  'ice cream': { cal: 270, p: 5, c: 32, f: 14, serving: '1 cup' },
  'cookie': { cal: 150, p: 2, c: 20, f: 7, serving: '1 large' },
  'coffee': { cal: 5, p: 0, c: 0, f: 0, serving: '1 cup black' },
  'latte': { cal: 190, p: 10, c: 18, f: 7, serving: '12 oz' },
  'orange juice': { cal: 112, p: 2, c: 26, f: 0.5, serving: '8 oz' },
  'milk': { cal: 150, p: 8, c: 12, f: 8, serving: '1 cup' },
  'beer': { cal: 153, p: 2, c: 13, f: 0, serving: '12 oz' },
  'wine': { cal: 125, p: 0, c: 4, f: 0, serving: '5 oz' },
};

const EXERCISE_DB: Record<string, { calPerMin: number; type: string }> = {
  'running': { calPerMin: 11.5, type: 'cardio' },
  'run': { calPerMin: 11.5, type: 'cardio' },
  'ran': { calPerMin: 11.5, type: 'cardio' },
  'jogging': { calPerMin: 8, type: 'cardio' },
  'jog': { calPerMin: 8, type: 'cardio' },
  'jogged': { calPerMin: 8, type: 'cardio' },
  'walking': { calPerMin: 4.5, type: 'cardio' },
  'walk': { calPerMin: 4.5, type: 'cardio' },
  'walked': { calPerMin: 4.5, type: 'cardio' },
  'cycling': { calPerMin: 9, type: 'cardio' },
  'biking': { calPerMin: 9, type: 'cardio' },
  'bike': { calPerMin: 9, type: 'cardio' },
  'biked': { calPerMin: 9, type: 'cardio' },
  'swimming': { calPerMin: 10, type: 'cardio' },
  'swim': { calPerMin: 10, type: 'cardio' },
  'swam': { calPerMin: 10, type: 'cardio' },
  'hiit': { calPerMin: 13, type: 'cardio' },
  'crossfit': { calPerMin: 12, type: 'strength' },
  'weightlifting': { calPerMin: 6, type: 'strength' },
  'weights': { calPerMin: 6, type: 'strength' },
  'lifting': { calPerMin: 6, type: 'strength' },
  'lifted': { calPerMin: 6, type: 'strength' },
  'strength training': { calPerMin: 6, type: 'strength' },
  'push ups': { calPerMin: 7, type: 'strength' },
  'pushups': { calPerMin: 7, type: 'strength' },
  'pull ups': { calPerMin: 8, type: 'strength' },
  'pullups': { calPerMin: 8, type: 'strength' },
  'squats': { calPerMin: 7, type: 'strength' },
  'deadlifts': { calPerMin: 7, type: 'strength' },
  'bench press': { calPerMin: 6, type: 'strength' },
  'yoga': { calPerMin: 3.5, type: 'flexibility' },
  'pilates': { calPerMin: 4, type: 'flexibility' },
  'stretching': { calPerMin: 2.5, type: 'flexibility' },
  'rowing': { calPerMin: 10, type: 'cardio' },
  'elliptical': { calPerMin: 8, type: 'cardio' },
  'stairmaster': { calPerMin: 9, type: 'cardio' },
  'jump rope': { calPerMin: 12, type: 'cardio' },
  'boxing': { calPerMin: 11, type: 'cardio' },
  'kickboxing': { calPerMin: 10, type: 'cardio' },
  'tennis': { calPerMin: 8, type: 'sports' },
  'basketball': { calPerMin: 9, type: 'sports' },
  'soccer': { calPerMin: 10, type: 'sports' },
  'football': { calPerMin: 9, type: 'sports' },
  'golf': { calPerMin: 4, type: 'sports' },
  'hiking': { calPerMin: 7, type: 'cardio' },
  'hiked': { calPerMin: 7, type: 'cardio' },
  'hike': { calPerMin: 7, type: 'cardio' },
  'dancing': { calPerMin: 6.5, type: 'cardio' },
  'rock climbing': { calPerMin: 10, type: 'strength' },
  'climbing': { calPerMin: 10, type: 'strength' },
  'spin': { calPerMin: 10, type: 'cardio' },
  'spin class': { calPerMin: 10, type: 'cardio' },
  'peloton': { calPerMin: 10, type: 'cardio' },
  'treadmill': { calPerMin: 9, type: 'cardio' },
};

function findBestFoodMatch(input: string): { key: string; data: typeof FOOD_DB[string] } | null {
  const lower = input.toLowerCase().trim();
  if (FOOD_DB[lower]) return { key: lower, data: FOOD_DB[lower] };
  const sorted = Object.keys(FOOD_DB).sort((a, b) => b.length - a.length);
  for (const key of sorted) {
    if (lower.includes(key)) return { key, data: FOOD_DB[key] };
  }
  return null;
}

function extractQuantity(input: string): number {
  const lower = input.toLowerCase();
  const numMatch = lower.match(/^(\d+\.?\d*)\s*(x\s*)?/);
  if (numMatch) return parseFloat(numMatch[1]);
  if (lower.includes('couple') || lower.includes('two') || lower.includes('double')) return 2;
  if (lower.includes('three') || lower.includes('triple')) return 3;
  if (lower.includes('half')) return 0.5;
  return 1;
}

export function parseFood(input: string): ParsedFood {
  const qty = extractQuantity(input);
  const match = findBestFoodMatch(input);

  if (match) {
    const lower = input.toLowerCase();
    let totalCal = match.data.cal;
    let totalP = match.data.p;
    let totalC = match.data.c;
    let totalF = match.data.f;
    let name = match.key;

    const withMatch = lower.match(/with\s+(.+)/);
    if (withMatch) {
      const sideText = withMatch[1];
      const sideMatch = findBestFoodMatch(sideText);
      if (sideMatch) {
        totalCal += sideMatch.data.cal;
        totalP += sideMatch.data.p;
        totalC += sideMatch.data.c;
        totalF += sideMatch.data.f;
        name = `${match.key} with ${sideMatch.key}`;
      }
    }

    const displayName = name.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    return {
      name: displayName,
      calories: Math.round(totalCal * qty),
      protein: Math.round(totalP * qty),
      carbs: Math.round(totalC * qty),
      fat: Math.round(totalF * qty),
      confidence: 0.92,
      servingSize: qty > 1 ? `${qty} servings` : match.data.serving,
    };
  }

  const lower = input.toLowerCase();
  const isSnack = lower.includes('snack') || lower.includes('bar') || lower.includes('handful');
  const isMeal = lower.includes('meal') || lower.includes('plate') || lower.includes('bowl') || lower.includes('dinner') || lower.includes('lunch');
  const isLight = lower.includes('light') || lower.includes('small') || lower.includes('salad') || lower.includes('fruit');

  const baseCal = isSnack ? 180 : isMeal ? 500 : isLight ? 200 : 350;
  const displayName = input.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

  return {
    name: displayName,
    calories: Math.round(baseCal * qty),
    protein: Math.round((baseCal * 0.2 / 4) * qty),
    carbs: Math.round((baseCal * 0.45 / 4) * qty),
    fat: Math.round((baseCal * 0.35 / 9) * qty),
    confidence: 0.55,
    servingSize: '1 serving (estimated)',
  };
}

function extractDuration(input: string): number | null {
  const lower = input.toLowerCase();
  const minMatch = lower.match(/(\d+\.?\d*)\s*(minutes?|mins?|m\b)/);
  if (minMatch) return parseFloat(minMatch[1]);
  const hrMatch = lower.match(/(\d+\.?\d*)\s*(hours?|hrs?|h\b)/);
  if (hrMatch) return parseFloat(hrMatch[1]) * 60;
  const colonMatch = lower.match(/(\d+):(\d{2})/);
  if (colonMatch) return parseInt(colonMatch[1]) * 60 + parseInt(colonMatch[2]);
  return null;
}

function extractDistance(input: string): { value: number; unit: string } | null {
  const lower = input.toLowerCase();
  const miMatch = lower.match(/(\d+\.?\d*)\s*(miles?|mi\b)/);
  if (miMatch) return { value: parseFloat(miMatch[1]), unit: 'miles' };
  const kmMatch = lower.match(/(\d+\.?\d*)\s*(kilometers?|km\b|k\b)/);
  if (kmMatch) return { value: parseFloat(kmMatch[1]), unit: 'km' };
  return null;
}

export function parseExercise(input: string): ParsedExercise {
  const lower = input.toLowerCase().trim();
  const duration = extractDuration(input);
  const distanceInfo = extractDistance(input);

  let exerciseMatch: { key: string; data: typeof EXERCISE_DB[string] } | null = null;
  const sortedKeys = Object.keys(EXERCISE_DB).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      exerciseMatch = { key, data: EXERCISE_DB[key] };
      break;
    }
  }

  let finalDuration = duration ?? 30;
  if (!duration && distanceInfo && exerciseMatch) {
    const milesPerMin = exerciseMatch.key.includes('walk') ? 1/20 : exerciseMatch.key.includes('run') || exerciseMatch.key.includes('ran') ? 1/10 : exerciseMatch.key.includes('bik') || exerciseMatch.key.includes('cycl') ? 1/4 : 1/12;
    const miles = distanceInfo.unit === 'km' ? distanceInfo.value * 0.621 : distanceInfo.value;
    finalDuration = Math.round(miles / milesPerMin);
  }

  if (exerciseMatch) {
    const calories = Math.round(exerciseMatch.data.calPerMin * finalDuration);
    const displayName = exerciseMatch.key.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const distMiles = distanceInfo ? (distanceInfo.unit === 'km' ? distanceInfo.value * 0.621 : distanceInfo.value) : undefined;

    return {
      name: displayName,
      duration: finalDuration,
      calories,
      distance: distMiles ? +distMiles.toFixed(1) : undefined,
      type: exerciseMatch.data.type,
      confidence: 0.9,
    };
  }

  const displayName = input.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  return {
    name: displayName,
    duration: finalDuration,
    calories: Math.round(6 * finalDuration),
    type: 'cardio',
    confidence: 0.5,
  };
}

/* ═══════════════════════════════════════════════════════════════
   Contextual Brief Hook — Calls convex/aiBrain.ts
   
   Pulls latest labResults, protocolLogs, and bioVault data
   to generate a 3-sentence clinical summary with:
     - One Positive Trend
     - One Required Adjustment
   ═══════════════════════════════════════════════════════════════ */

export interface ContextualBrief {
  brief: string;
  positiveTrend: string;
  requiredAdjustment: string;
  dataPoints: number;
  generatedAt: number;
  source: 'llm' | 'local';
}

export function useContextualBrief() {
  let briefAction: any = null;
  try {
    briefAction = useAction((api as any).aiBrain?.generateContextualBrief);
  } catch {
    // aiBrain module not available
  }

  const generateBrief = useCallback(async (
    sessionId: string
  ): Promise<ContextualBrief> => {
    // Try real AI Brain action first
    if (briefAction) {
      try {
        const result = await briefAction({ sessionId });
        if (result?.brief) {
          return result as ContextualBrief;
        }
      } catch (err) {
        console.warn('[ContextualBrief] AI Brain action failed, using fallback:', err);
      }
    }

    // Local fallback when action is unavailable
    return {
      brief: 'Biological baseline establishing. Populate Bio-Vault with blood panel and wearable data to unlock precision analysis. Protocol adherence is the primary lever for biomarker optimization.',
      positiveTrend: 'System baseline established — data collection phase active',
      requiredAdjustment: 'Expand Bio-Vault with fresh blood panel data to unlock precision protocol adjustments',
      dataPoints: 0,
      generatedAt: Date.now(),
      source: 'local',
    };
  }, [briefAction]);

  return { generateBrief };
}

export function useAIFoodParser() {
  const parse = useCallback(async (input: string): Promise<ParsedFood> => {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
    return parseFood(input);
  }, []);
  return { parse };
}

export function useAIExerciseParser() {
  const parse = useCallback(async (input: string): Promise<ParsedExercise> => {
    await new Promise(r => setTimeout(r, 300 + Math.random() * 400));
    return parseExercise(input);
  }, []);
  return { parse };
}
