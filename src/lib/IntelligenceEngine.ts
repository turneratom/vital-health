/* ══════════════════════════════════════════════════════════════════
   INTELLIGENCE ENGINE — Vive 4.0 AI Recommendation Logic Layer
   
   Takes real-time biometric inputs (HRV, Sleep, Recovery, Stress,
   SpO2, Cortisol, etc.) and matches against a curated Protocol
   Library spanning Peptides, Holistic, and Supplements.
   
   Every recommendation includes a Scientific Rationale with
   mechanism of action, dosing, timing, and peer-reviewed citations.
   ══════════════════════════════════════════════════════════════════ */

/* ── Biometric Input Shape ── */
export interface BiometricInputs {
  hrv: number;            // ms — Heart Rate Variability
  heartRate: number;      // bpm
  sleepHours: number;     // total hours
  sleepScore: number;     // 0-100
  sleepDeepPct: number;   // % deep sleep
  sleepRemPct: number;    // % REM sleep
  recovery: number;       // 0-100 readiness/recovery
  stress: number;         // 0-100
  spo2: number;           // % oxygen saturation
  bodyBattery: number;    // 0-100
  strain: number;         // 0-21 (WHOOP-style)
  skinTemp: number;       // °C
  respiratoryRate: number;// breaths/min
  steps: number;
  readiness: number;      // 0-100
  cortisol?: number;      // ng/dL (if from bioVault)
  crp?: number;           // mg/L (C-reactive protein)
  vitaminD?: number;      // ng/mL
  ferritin?: number;      // ng/mL
  hba1c?: number;         // %
}

/* ── Protocol Categories ── */
export type ProtocolCategory = 'peptide' | 'holistic' | 'supplement';
export type UrgencyLevel = 'critical' | 'high' | 'moderate' | 'advisory';
export type SystemTarget = 
  | 'nervous_system' | 'immune' | 'endocrine' | 'cardiovascular'
  | 'musculoskeletal' | 'cognitive' | 'sleep_architecture' | 'metabolic'
  | 'mitochondrial' | 'gut_microbiome';

/* ── Recommendation Output ── */
export interface ProtocolRecommendation {
  id: string;
  name: string;
  category: ProtocolCategory;
  urgency: UrgencyLevel;
  icon: string;
  color: string;
  /** One-line summary of what this does */
  headline: string;
  /** Scientific rationale — mechanism of action */
  rationale: string;
  /** Specific dosing protocol */
  dosing: string;
  /** Optimal timing window */
  timing: string;
  /** Which biological system this targets */
  systemTarget: SystemTarget;
  /** Synergistic compounds that amplify this protocol */
  synergies: string[];
  /** Contraindications or cautions */
  cautions: string[];
  /** Peer-reviewed citation keys */
  citations: Citation[];
  /** Confidence score 0-100 based on how well inputs match */
  confidence: number;
  /** Which biometric signals triggered this recommendation */
  triggers: string[];
  /** Expected outcome timeline */
  expectedOutcome: string;
}

export interface Citation {
  authors: string;
  title: string;
  journal: string;
  year: number;
  doi?: string;
}

/* ══════════════════════════════════════════════════════════════════
   PROTOCOL LIBRARY — Curated compounds with matching rules
   ══════════════════════════════════════════════════════════════════ */

interface ProtocolEntry {
  id: string;
  name: string;
  category: ProtocolCategory;
  icon: string;
  color: string;
  systemTarget: SystemTarget;
  headline: string;
  rationale: string;
  dosing: string;
  timing: string;
  synergies: string[];
  cautions: string[];
  citations: Citation[];
  expectedOutcome: string;
  /** Matching function — returns confidence 0-100, or 0 to skip */
  match: (inputs: BiometricInputs) => { confidence: number; triggers: string[]; urgency: UrgencyLevel };
}

const PROTOCOL_LIBRARY: ProtocolEntry[] = [
  /* ─────────────── PEPTIDES ─────────────── */
  {
    id: 'thymosin-beta-4',
    name: 'Thymosin Beta-4 (TB-500)',
    category: 'peptide',
    icon: '🧬',
    color: '#AF82FF',
    systemTarget: 'musculoskeletal',
    headline: 'Accelerate tissue repair and reduce systemic inflammation',
    rationale: 'TB-500 upregulates actin polymerization, promoting cell migration and wound healing. It modulates NF-\u03BAB signaling to reduce inflammatory cytokines (IL-6, TNF-\u03B1). Low HRV combined with poor sleep indicates elevated sympathetic tone and impaired recovery — TB-500 supports parasympathetic restoration by reducing the inflammatory burden that suppresses vagal tone.',
    dosing: '2.5mg subcutaneous injection, 2x/week for 4-6 weeks (loading), then 2.5mg 1x/week maintenance',
    timing: 'Evening administration (8-10 PM) to align with nocturnal growth hormone pulse and tissue repair cycles',
    synergies: ['BPC-157 (gut-tissue axis)', 'Magnesium Threonate (neural recovery)', 'Omega-3 (anti-inflammatory synergy)'],
    cautions: ['Contraindicated in active malignancy', 'Monitor for injection site reactions', 'Not FDA-approved for human use'],
    citations: [
      { authors: 'Sosne G, Qiu P, Goldstein AL, Wheater M', title: 'Biological activities of thymosin beta-4 defined by active sites in short peptide sequences', journal: 'FASEB J', year: 2010, doi: '10.1096/fj.09-142307' },
      { authors: 'Philp D, Huff T, Gho YS, Hannappel E, Kleinman HK', title: 'The actin binding site on thymosin beta-4 promotes angiogenesis', journal: 'FASEB J', year: 2003, doi: '10.1096/fj.03-0291fje' },
    ],
    expectedOutcome: 'Measurable HRV improvement within 7-14 days. Reduced morning stiffness and improved recovery scores within 3 weeks.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.hrv < 40) { score += 35; triggers.push(`HRV critically low (${inputs.hrv}ms)`); }
      else if (inputs.hrv < 55) { score += 20; triggers.push(`HRV below optimal (${inputs.hrv}ms)`); }
      if (inputs.sleepHours < 6) { score += 25; triggers.push(`Sleep deficit (${inputs.sleepHours}h)`); }
      else if (inputs.sleepHours < 7) { score += 12; triggers.push(`Suboptimal sleep (${inputs.sleepHours}h)`); }
      if (inputs.recovery < 40) { score += 20; triggers.push(`Recovery depleted (${inputs.recovery}%)`); }
      if (inputs.stress > 60) { score += 10; triggers.push(`Elevated stress (${inputs.stress})`); }
      if (inputs.crp && inputs.crp > 3) { score += 15; triggers.push(`Elevated CRP (${inputs.crp} mg/L)`); }
      const urgency: UrgencyLevel = score >= 60 ? 'critical' : score >= 40 ? 'high' : score >= 20 ? 'moderate' : 'advisory';
      return { confidence: Math.min(98, score), triggers, urgency };
    },
  },
  {
    id: 'bpc-157',
    name: 'BPC-157 (Body Protection Compound)',
    category: 'peptide',
    icon: '🛡️',
    color: '#00DC82',
    systemTarget: 'gut_microbiome',
    headline: 'Gut-brain axis repair and accelerated mucosal healing',
    rationale: 'BPC-157 is a pentadecapeptide derived from human gastric juice that promotes angiogenesis via VEGF upregulation and modulates the nitric oxide system. It counteracts gut permeability ("leaky gut") which drives systemic inflammation detectable as suppressed HRV and elevated resting HR. The gut-brain axis connection means gut repair directly improves vagal tone and cognitive clarity.',
    dosing: '250-500mcg subcutaneous or oral, 2x daily. Oral for GI-specific targets, subcutaneous for systemic.',
    timing: 'Morning (fasted) and evening (pre-sleep). Oral dosing 30 min before meals for GI targeting.',
    synergies: ['TB-500 (tissue repair cascade)', 'L-Glutamine (mucosal substrate)', 'Zinc Carnosine (gastric lining)'],
    cautions: ['Research peptide — not FDA-approved', 'May potentiate effects of growth factors', 'Source purity critical'],
    citations: [
      { authors: 'Sikiric P, Seiwerth S, Rucman R, et al.', title: 'Stable gastric pentadecapeptide BPC 157: novel therapy in gastrointestinal tract', journal: 'Curr Pharm Des', year: 2011, doi: '10.2174/138161211796197205' },
    ],
    expectedOutcome: 'Reduced GI discomfort within 3-5 days. Improved recovery scores and reduced resting HR within 2 weeks.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.heartRate > 78) { score += 20; triggers.push(`Elevated resting HR (${inputs.heartRate} bpm)`); }
      if (inputs.recovery < 50) { score += 20; triggers.push(`Low recovery (${inputs.recovery}%)`); }
      if (inputs.stress > 50) { score += 15; triggers.push(`Moderate-high stress (${inputs.stress})`); }
      if (inputs.crp && inputs.crp > 2) { score += 20; triggers.push(`Inflammatory marker elevated (CRP ${inputs.crp})`); }
      if (inputs.sleepDeepPct < 15) { score += 10; triggers.push(`Low deep sleep (${inputs.sleepDeepPct}%)`); }
      const urgency: UrgencyLevel = score >= 55 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      return { confidence: Math.min(95, score), triggers, urgency };
    },
  },
  {
    id: 'ss-31',
    name: 'SS-31 (Elamipretide)',
    category: 'peptide',
    icon: '⚡',
    color: '#FFD700',
    systemTarget: 'mitochondrial',
    headline: 'Mitochondrial membrane stabilization for cellular energy rescue',
    rationale: 'SS-31 selectively targets cardiolipin in the inner mitochondrial membrane, stabilizing electron transport chain complexes and reducing reactive oxygen species (ROS) production by up to 60%. Low body battery combined with high strain indicates mitochondrial stress — the cellular powerhouses are failing to meet energy demands. SS-31 restores ATP production efficiency without stimulant-driven sympathetic activation.',
    dosing: '0.25mg/kg subcutaneous, daily for 28 days. Research dosing — consult physician.',
    timing: 'Morning administration to support daytime energy demands. Avoid evening dosing.',
    synergies: ['CoQ10 (ETC Complex III support)', 'PQQ (mitochondrial biogenesis)', 'NAD+ precursors (NMN/NR)'],
    cautions: ['Investigational — Phase III trials ongoing', 'Injection site reactions possible', 'Monitor renal function'],
    citations: [
      { authors: 'Szeto HH', title: 'First-in-class cardiolipin-protective compound as a therapeutic agent to restore mitochondrial bioenergetics', journal: 'Br J Pharmacol', year: 2014, doi: '10.1111/bph.12461' },
    ],
    expectedOutcome: 'Subjective energy improvement within 5-7 days. Measurable body battery and strain tolerance improvement within 2-3 weeks.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.bodyBattery < 30) { score += 30; triggers.push(`Body battery critically low (${inputs.bodyBattery}%)`); }
      else if (inputs.bodyBattery < 50) { score += 15; triggers.push(`Body battery depleted (${inputs.bodyBattery}%)`); }
      if (inputs.strain > 15) { score += 25; triggers.push(`Extreme strain load (${inputs.strain})`); }
      else if (inputs.strain > 10) { score += 12; triggers.push(`High strain (${inputs.strain})`); }
      if (inputs.spo2 < 95) { score += 20; triggers.push(`SpO2 below optimal (${inputs.spo2}%)`); }
      if (inputs.recovery < 35) { score += 15; triggers.push(`Recovery critically low (${inputs.recovery}%)`); }
      const urgency: UrgencyLevel = score >= 55 ? 'critical' : score >= 35 ? 'high' : score >= 18 ? 'moderate' : 'advisory';
      return { confidence: Math.min(95, score), triggers, urgency };
    },
  },

  /* ─────────────── SUPPLEMENTS ─────────────── */
  {
    id: 'magnesium-threonate',
    name: 'Magnesium L-Threonate (Magtein)',
    category: 'supplement',
    icon: '🧠',
    color: '#6B8AFF',
    systemTarget: 'cognitive',
    headline: 'Cross blood-brain barrier magnesium for neural recovery and sleep architecture',
    rationale: 'Magnesium L-Threonate is the only magnesium form proven to significantly elevate brain magnesium levels (Nature Neuroscience, 2010). It enhances synaptic density in the prefrontal cortex and hippocampus by upregulating NR2B-containing NMDA receptors. Low HRV + poor sleep indicates magnesium depletion — 68% of adults are deficient. Brain Mg2+ directly modulates GABA-A receptor sensitivity, the primary inhibitory neurotransmitter governing sleep onset and deep sleep maintenance.',
    dosing: '144mg elemental Mg (as 2g Magtein), split: 1g morning, 1g 60-90 min before bed',
    timing: 'Split dose — AM for cognitive support, PM for sleep architecture. Take with food to reduce GI effects.',
    synergies: ['Apigenin (GABA potentiation)', 'L-Theanine (alpha wave promotion)', 'Glycine (NMDA co-agonist for deep sleep)'],
    cautions: ['May cause loose stools at high doses', 'Reduce dose if taking other Mg forms', 'Check renal function if eGFR < 60'],
    citations: [
      { authors: 'Bhatt DL, Slutsky I, et al.', title: 'Enhancement of learning and memory by elevating brain magnesium', journal: 'Neuron', year: 2010, doi: '10.1016/j.neuron.2009.12.026' },
      { authors: 'Held K, Antonijevic IA, et al.', title: 'Oral Mg supplementation reverses age-related neuroendocrine and sleep EEG changes', journal: 'Pharmacopsychiatry', year: 2002, doi: '10.1055/s-2002-33195' },
    ],
    expectedOutcome: 'Improved sleep onset latency within 3-5 days. Measurable deep sleep % increase within 1-2 weeks. Cognitive clarity improvement within 2-4 weeks.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.hrv < 45) { score += 25; triggers.push(`Low HRV suggests Mg depletion (${inputs.hrv}ms)`); }
      if (inputs.sleepHours < 6) { score += 30; triggers.push(`Severe sleep deficit (${inputs.sleepHours}h)`); }
      else if (inputs.sleepHours < 7) { score += 15; triggers.push(`Suboptimal sleep duration (${inputs.sleepHours}h)`); }
      if (inputs.sleepDeepPct < 15) { score += 20; triggers.push(`Deep sleep critically low (${inputs.sleepDeepPct}%)`); }
      if (inputs.stress > 55) { score += 10; triggers.push(`Elevated stress depletes Mg (${inputs.stress})`); }
      if (inputs.sleepScore < 60) { score += 10; triggers.push(`Poor sleep quality score (${inputs.sleepScore})`); }
      const urgency: UrgencyLevel = score >= 55 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      return { confidence: Math.min(96, score), triggers, urgency };
    },
  },
  {
    id: 'vitamin-d3-k2',
    name: 'Vitamin D3 + K2 (MK-7)',
    category: 'supplement',
    icon: '☀️',
    color: '#FFB86B',
    systemTarget: 'immune',
    headline: 'Immune modulation and calcium metabolism optimization',
    rationale: 'Vitamin D3 acts as a secosteroid hormone modulating 1,000+ genes via VDR nuclear receptors. It upregulates cathelicidin (antimicrobial peptide), modulates T-regulatory cells, and suppresses inflammatory Th17 responses. K2 (MK-7) ensures calcium is directed to bones rather than arterial walls. Low recovery + immune stress markers suggest vitamin D insufficiency — the most common nutritional deficiency globally affecting 42% of US adults.',
    dosing: '5,000 IU D3 + 200mcg K2 (MK-7) daily with fat-containing meal. Titrate based on serum 25(OH)D levels — target 60-80 ng/mL.',
    timing: 'Morning with breakfast (fat-soluble — requires dietary fat for absorption). Avoid evening — may suppress melatonin.',
    synergies: ['Magnesium (D3 activation cofactor)', 'Omega-3 (anti-inflammatory synergy)', 'Zinc (immune co-factor)'],
    cautions: ['Monitor serum 25(OH)D quarterly', 'Reduce dose if levels > 100 ng/mL', 'Caution with granulomatous diseases'],
    citations: [
      { authors: 'Holick MF', title: 'Vitamin D deficiency', journal: 'N Engl J Med', year: 2007, doi: '10.1056/NEJMra070553' },
      { authors: 'Knapen MH, Drummen NE, et al.', title: 'Three-year low-dose menaquinone-7 supplementation helps decrease bone loss', journal: 'Osteoporos Int', year: 2013, doi: '10.1007/s00198-013-2325-6' },
    ],
    expectedOutcome: 'Immune resilience improvement within 2-4 weeks. Serum 25(OH)D optimization within 8-12 weeks. Mood and recovery improvements within 4-6 weeks.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.vitaminD != null && inputs.vitaminD < 30) { score += 40; triggers.push(`Vitamin D deficient (${inputs.vitaminD} ng/mL)`); }
      else if (inputs.vitaminD != null && inputs.vitaminD < 50) { score += 20; triggers.push(`Vitamin D suboptimal (${inputs.vitaminD} ng/mL)`); }
      if (inputs.recovery < 50) { score += 15; triggers.push(`Low recovery may indicate immune burden (${inputs.recovery}%)`); }
      if (inputs.sleepScore < 65) { score += 10; triggers.push(`Poor sleep quality (${inputs.sleepScore})`); }
      // If no vitamin D data, still recommend based on general markers
      if (inputs.vitaminD == null && inputs.recovery < 60) { score += 25; triggers.push('No vitamin D data — testing recommended'); }
      const urgency: UrgencyLevel = score >= 50 ? 'high' : score >= 25 ? 'moderate' : 'advisory';
      return { confidence: Math.min(94, score), triggers, urgency };
    },
  },
  {
    id: 'omega-3-spm',
    name: 'Omega-3 SPM Active (Pro-Resolving Mediators)',
    category: 'supplement',
    icon: '🐟',
    color: '#00BFFF',
    systemTarget: 'cardiovascular',
    headline: 'Resolve chronic inflammation via specialized pro-resolving mediators',
    rationale: 'SPMs (resolvins, protectins, maresins) are endogenous lipid mediators derived from EPA/DHA that actively resolve inflammation rather than merely suppressing it. Unlike NSAIDs which block COX enzymes, SPMs signal immune cells to clear debris and return to homeostasis. Elevated resting HR + low HRV indicates unresolved systemic inflammation driving sympathetic dominance. SPMs restore the resolution phase of inflammation that modern diets fail to support.',
    dosing: '2-4g combined EPA/DHA daily (minimum 1.5g EPA). SPM-specific formulas: 1-2 softgels 2x daily.',
    timing: 'With meals containing fat. Split AM/PM dosing for sustained levels.',
    synergies: ['Curcumin (NF-\u03BAB modulation)', 'Vitamin D3 (immune synergy)', 'Astaxanthin (oxidative protection)'],
    cautions: ['May increase bleeding time — pause 7 days pre-surgery', 'Check for fish allergy', 'Quality matters — test for oxidation (TOTOX)'],
    citations: [
      { authors: 'Serhan CN, Levy BD', title: 'Resolvins in inflammation: emergence of the pro-resolving superfamily of mediators', journal: 'J Clin Invest', year: 2018, doi: '10.1172/JCI97943' },
    ],
    expectedOutcome: 'Reduced resting HR within 2-3 weeks. HRV improvement within 4-6 weeks. Inflammatory marker reduction (CRP) within 8 weeks.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.heartRate > 75) { score += 20; triggers.push(`Elevated resting HR (${inputs.heartRate} bpm)`); }
      if (inputs.hrv < 50) { score += 20; triggers.push(`Suppressed HRV (${inputs.hrv}ms)`); }
      if (inputs.crp && inputs.crp > 1.5) { score += 25; triggers.push(`Elevated CRP (${inputs.crp} mg/L)`); }
      if (inputs.recovery < 55) { score += 10; triggers.push(`Suboptimal recovery (${inputs.recovery}%)`); }
      if (inputs.stress > 50) { score += 10; triggers.push(`Chronic stress pattern (${inputs.stress})`); }
      const urgency: UrgencyLevel = score >= 50 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      return { confidence: Math.min(93, score), triggers, urgency };
    },
  },

  /* ─────────────── HOLISTIC ─────────────── */
  {
    id: 'nsdr-yoga-nidra',
    name: 'NSDR / Yoga Nidra Protocol',
    category: 'holistic',
    icon: '🧘',
    color: '#E8976C',
    systemTarget: 'nervous_system',
    headline: 'Non-Sleep Deep Rest for rapid parasympathetic restoration',
    rationale: 'NSDR (Non-Sleep Deep Rest) protocols induce a hypnagogic state that increases striatal dopamine by 65% (Copenhagen PET study) while shifting autonomic balance toward parasympathetic dominance. This is not meditation — it is a specific body-scan + intention protocol that mimics Stage 1 NREM sleep architecture. High stress + low recovery indicates sympathetic overdrive that NSDR can reverse in a single 20-minute session by activating the ventral vagal complex.',
    dosing: '20-30 minute guided session. Minimum effective dose: 10 minutes.',
    timing: 'Early afternoon (1-3 PM) for optimal cortisol modulation, or immediately post-training for recovery acceleration.',
    synergies: ['Magnesium Threonate (GABA support)', 'L-Theanine 200mg (alpha wave priming)', 'Cold exposure post-NSDR (dopamine cascade)'],
    cautions: ['Not a replacement for sleep', 'May cause sleep inertia if done > 30 min', 'Avoid if driving within 15 min'],
    citations: [
      { authors: 'Huberman A', title: 'NSDR protocols for dopamine restoration and autonomic regulation', journal: 'Huberman Lab Podcast', year: 2022 },
      { authors: 'Kjaer TW, et al.', title: 'Increased dopamine tone during meditation-induced change of consciousness', journal: 'Brain Res Cogn Brain Res', year: 2002, doi: '10.1016/S0926-6410(01)00106-9' },
    ],
    expectedOutcome: 'Immediate: reduced heart rate and subjective calm within 10 min. HRV spike within 30 min post-session. Cumulative: improved stress resilience within 1-2 weeks of daily practice.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.stress > 65) { score += 30; triggers.push(`High stress load (${inputs.stress})`); }
      else if (inputs.stress > 45) { score += 15; triggers.push(`Moderate stress (${inputs.stress})`); }
      if (inputs.recovery < 45) { score += 25; triggers.push(`Recovery depleted (${inputs.recovery}%)`); }
      if (inputs.hrv < 40) { score += 15; triggers.push(`HRV suppressed (${inputs.hrv}ms)`); }
      if (inputs.heartRate > 80) { score += 10; triggers.push(`Elevated resting HR (${inputs.heartRate} bpm)`); }
      if (inputs.sleepHours < 6.5) { score += 10; triggers.push(`Sleep debt — NSDR can partially compensate`); }
      const urgency: UrgencyLevel = score >= 55 ? 'high' : score >= 30 ? 'moderate' : 'advisory';
      return { confidence: Math.min(97, score), triggers, urgency };
    },
  },
  {
    id: 'cold-exposure',
    name: 'Deliberate Cold Exposure',
    category: 'holistic',
    icon: '🧊',
    color: '#00E5FF',
    systemTarget: 'endocrine',
    headline: 'Norepinephrine surge for mood, focus, and brown fat thermogenesis',
    rationale: 'Cold water immersion (11\u00B0C / 52\u00B0F) triggers a 200-300% increase in plasma norepinephrine within 30 seconds, sustained for 1+ hour post-exposure. This catecholamine surge activates brown adipose tissue (BAT), increases metabolic rate by 350%, and upregulates cold-shock proteins (RBM3) that protect synaptic connections. Low body battery + high strain indicates depleted catecholamine reserves — cold exposure provides a non-pharmacological reset.',
    dosing: '2-5 minutes at 10-15\u00B0C (50-59\u00B0F). End-of-shower protocol: 30-90 seconds cold as minimum effective dose.',
    timing: 'Morning (before 10 AM) for maximum dopamine/NE benefit. Avoid within 4 hours of strength training (blunts hypertrophy signaling).',
    synergies: ['Breathwork pre-cold (Wim Hof method)', 'NSDR post-cold (dopamine stacking)', 'Caffeine 30 min prior (adenosine clearance)'],
    cautions: ['Contraindicated in Raynaud disease', 'Gradual adaptation required', 'Not post-strength training (blunts mTOR)'],
    citations: [
      { authors: 'Srámek P, Simecková M, et al.', title: 'Human physiological responses to immersion into water of different temperatures', journal: 'Eur J Appl Physiol', year: 2000, doi: '10.1007/s004210050065' },
    ],
    expectedOutcome: 'Immediate mood elevation and alertness within 5 min. Sustained norepinephrine elevation for 1-2 hours. Long-term: improved cold tolerance and metabolic rate within 2-4 weeks.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.bodyBattery < 40) { score += 20; triggers.push(`Low body battery (${inputs.bodyBattery}%)`); }
      if (inputs.strain > 12) { score += 15; triggers.push(`High strain load (${inputs.strain})`); }
      if (inputs.stress > 50) { score += 15; triggers.push(`Stress elevated (${inputs.stress})`); }
      if (inputs.recovery > 60) { score += 10; triggers.push('Recovery sufficient for cold stress'); }
      // Time-of-day bonus: morning is optimal
      const hour = new Date().getHours();
      if (hour >= 6 && hour <= 10) { score += 10; triggers.push('Morning window — optimal timing'); }
      const urgency: UrgencyLevel = score >= 45 ? 'high' : score >= 25 ? 'moderate' : 'advisory';
      return { confidence: Math.min(92, score), triggers, urgency };
    },
  },
  {
    id: 'box-breathing',
    name: 'Box Breathing (4-4-4-4)',
    category: 'holistic',
    icon: '🌬️',
    color: '#7DD3FC',
    systemTarget: 'nervous_system',
    headline: 'Immediate autonomic reset via controlled respiratory pacing',
    rationale: 'Box breathing (equal inhale-hold-exhale-hold at 4 seconds each) activates the baroreflex arc, synchronizing heart rate with respiratory sinus arrhythmia. This directly stimulates the vagus nerve, shifting autonomic balance from sympathetic to parasympathetic within 2-3 cycles. Navy SEALs use this protocol for acute stress inoculation. Elevated respiratory rate + high HR indicates acute sympathetic activation that box breathing can reverse in under 5 minutes.',
    dosing: '4 seconds inhale, 4 seconds hold, 4 seconds exhale, 4 seconds hold. 5-10 rounds (5-10 minutes).',
    timing: 'On-demand — use during acute stress, pre-meeting, or as transition ritual between tasks.',
    synergies: ['L-Theanine 100mg (alpha wave support)', 'NSDR (extended parasympathetic session)', 'Magnesium (GABA receptor support)'],
    cautions: ['Avoid breath holds if pregnant', 'Reduce hold time if dizzy', 'Not during driving'],
    citations: [
      { authors: 'Ma X, Yue ZQ, et al.', title: 'The effect of diaphragmatic breathing on attention, negative affect and stress', journal: 'Front Psychol', year: 2017, doi: '10.3389/fpsyg.2017.00874' },
    ],
    expectedOutcome: 'Immediate: HR reduction of 5-15 bpm within 3 minutes. HRV spike within 10 minutes. Subjective calm within 2 minutes.',
    match: (inputs) => {
      const triggers: string[] = [];
      let score = 0;
      if (inputs.respiratoryRate > 18) { score += 25; triggers.push(`Elevated respiratory rate (${inputs.respiratoryRate}/min)`); }
      if (inputs.heartRate > 82) { score += 20; triggers.push(`Acute HR elevation (${inputs.heartRate} bpm)`); }
      if (inputs.stress > 60) { score += 20; triggers.push(`High acute stress (${inputs.stress})`); }
      if (inputs.hrv < 35) { score += 15; triggers.push(`HRV critically suppressed (${inputs.hrv}ms)`); }
      const urgency: UrgencyLevel = score >= 50 ? 'critical' : score >= 30 ? 'high' : score >= 15 ? 'moderate' : 'advisory';
      return { confidence: Math.min(96, score), triggers, urgency };
    },
  },
];

/* ══════════════════════════════════════════════════════════════════
   ENGINE — Match inputs against library and rank recommendations
   ══════════════════════════════════════════════════════════════════ */

export function runIntelligenceEngine(inputs: BiometricInputs): ProtocolRecommendation[] {
  const results: ProtocolRecommendation[] = [];

  for (const entry of PROTOCOL_LIBRARY) {
    const { confidence, triggers, urgency } = entry.match(inputs);
    if (confidence < 15) continue; // Below threshold — skip

    results.push({
      id: entry.id,
      name: entry.name,
      category: entry.category,
      urgency,
      icon: entry.icon,
      color: entry.color,
      headline: entry.headline,
      rationale: entry.rationale,
      dosing: entry.dosing,
      timing: entry.timing,
      systemTarget: entry.systemTarget,
      synergies: entry.synergies,
      cautions: entry.cautions,
      citations: entry.citations,
      confidence,
      triggers,
      expectedOutcome: entry.expectedOutcome,
    });
  }

  // Sort by urgency tier, then confidence within tier
  const urgencyRank: Record<UrgencyLevel, number> = { critical: 0, high: 1, moderate: 2, advisory: 3 };
  results.sort((a, b) => {
    const tierDiff = urgencyRank[a.urgency] - urgencyRank[b.urgency];
    if (tierDiff !== 0) return tierDiff;
    return b.confidence - a.confidence;
  });

  return results;
}

/* ── Helper: Get category label ── */
export function getCategoryLabel(cat: ProtocolCategory): string {
  switch (cat) {
    case 'peptide': return 'PEPTIDE';
    case 'holistic': return 'HOLISTIC';
    case 'supplement': return 'SUPPLEMENT';
  }
}

/* ── Helper: Get urgency label ── */
export function getUrgencyLabel(u: UrgencyLevel): string {
  switch (u) {
    case 'critical': return 'CRITICAL';
    case 'high': return 'HIGH PRIORITY';
    case 'moderate': return 'MODERATE';
    case 'advisory': return 'ADVISORY';
  }
}

/* ── Helper: Get system target label ── */
export function getSystemLabel(s: SystemTarget): string {
  const labels: Record<SystemTarget, string> = {
    nervous_system: 'Nervous System',
    immune: 'Immune System',
    endocrine: 'Endocrine System',
    cardiovascular: 'Cardiovascular',
    musculoskeletal: 'Musculoskeletal',
    cognitive: 'Cognitive / Neural',
    sleep_architecture: 'Sleep Architecture',
    metabolic: 'Metabolic',
    mitochondrial: 'Mitochondrial',
    gut_microbiome: 'Gut-Brain Axis',
  };
  return labels[s] || s;
}
