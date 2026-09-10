/* ══════════════════════════════════════════════════════════════════════
   RECOMMENDATION ENGINE — Headless Logic Utility for Vive 4.0
   
   Maps biometric data points (low HRV, poor Deep Sleep, high RHR)
   to specific "Optimization Categories". Exposes useProductRecommendations()
   hook that the UI calls to see which store items help the user's
   current physiological state.
   
   v2 — Now includes:
   • useHrvAlertMonitor() — listens to live Oura/Whoop HRV streams
   • Triggers "High Priority Recommendation" when HRV drops >15% below
     the user's 7-day rolling average
   • Deep-links directly to a specific recovery supplement in the
     Optimization Store
   
   Architecture:
   ┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
   │ useBiometricSync │ ──▶ │ RecommendationEngine │ ──▶ │ UI (Store, Feed)│
   │   (live vitals)  │     │  (category mapping)  │     │  (product cards)│
   └─────────────────┘     └──────────────────────┘     └─────────────────┘
          ▲                         │
          │                         ▼
   ┌──────────────┐        ┌──────────────────┐
   │ BioIntelligence│◀──────│ Optimization     │
   │ (interventions)│       │ Categories       │
   └──────────────┘        └──────────────────┘
          │
          ▼
   ┌──────────────────────────────────────────┐
   │ useHrvAlertMonitor (live Oura/Whoop)     │
   │  → 7-day rolling avg comparison          │
   │  → >15% drop = High Priority Alert       │
   │  → Deep-link to recovery supplement      │
   └──────────────────────────────────────────┘
   ══════════════════════════════════════════════════════════════════════ */

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useBiometricSync, type SyncedVitals } from '@/hooks/useBiometricSync';
import { useQuery } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { getSessionId } from '@/components/Presence/usePresenceState';
import {
  runBioIntelligence,
  type Intervention,
  type BioIntelligenceReport,
  type BiometricHistory,
  type TimestampedReading,
} from './BioIntelligence';
import type { BiometricInputs } from './IntelligenceEngine';
import {
  generatePrecisionStack,
  type PrecisionItem,
  type BioVaultData,
} from './supplementLogic';

/* ══════════════════════════════════════════════════════════════════
   OPTIMIZATION CATEGORIES
   Each category represents a physiological domain that can be
   improved. Biometric signals map to one or more categories.
   ══════════════════════════════════════════════════════════════════ */

export type OptimizationCategory =
  | 'autonomic_recovery'
  | 'sleep_architecture'
  | 'metabolic_efficiency'
  | 'inflammatory_control'
  | 'hormonal_balance'
  | 'cognitive_performance'
  | 'cardiovascular_resilience'
  | 'mitochondrial_energy'
  | 'immune_defense'
  | 'gut_integrity';

export interface CategoryDefinition {
  id: OptimizationCategory;
  label: string;
  icon: string;
  color: string;
  description: string;
  /** Biometric thresholds that activate this category */
  activationRules: ActivationRule[];
  /** Intervention IDs from BioIntelligence that map here */
  interventionIds: string[];
  /** Product tags that match this category */
  productTags: string[];
}

export interface ActivationRule {
  metric: keyof SyncedVitals;
  condition: 'below' | 'above';
  threshold: number;
  weight: number;
  label: string;
}

/** Severity of the optimization need */
export type OptimizationSeverity = 'critical' | 'elevated' | 'moderate' | 'low';

/** A scored category with activation details */
export interface ScoredCategory {
  category: CategoryDefinition;
  score: number; // 0-100
  severity: OptimizationSeverity;
  activeRules: Array<ActivationRule & { currentValue: number; delta: number }>;
  matchedInterventions: Intervention[];
}

/* ── Category Definitions ── */

const OPTIMIZATION_CATEGORIES: CategoryDefinition[] = [
  {
    id: 'autonomic_recovery',
    label: 'Autonomic Recovery',
    icon: '🧠',
    color: '#AF82FF',
    description: 'Parasympathetic restoration and vagal tone optimization',
    activationRules: [
      { metric: 'hrv', condition: 'below', threshold: 50, weight: 0.35, label: 'HRV below optimal' },
      { metric: 'recovery', condition: 'below', threshold: 60, weight: 0.25, label: 'Recovery depleted' },
      { metric: 'stress', condition: 'above', threshold: 50, weight: 0.2, label: 'Elevated stress load' },
      { metric: 'heartRate', condition: 'above', threshold: 75, weight: 0.2, label: 'Elevated resting HR' },
    ],
    interventionIds: ['thymosin-beta-4', 'bpc-157', 'ashwagandha-ksm66', 'magnesium-threonate'],
    productTags: ['recovery', 'stress', 'neural', 'cortisol'],
  },
  {
    id: 'sleep_architecture',
    label: 'Sleep Architecture',
    icon: '🌙',
    color: '#6B8AFF',
    description: 'Deep sleep and REM cycle optimization for neural repair',
    activationRules: [
      { metric: 'sleepScore', condition: 'below', threshold: 70, weight: 0.3, label: 'Sleep score suboptimal' },
      { metric: 'sleepDeepPct', condition: 'below', threshold: 18, weight: 0.3, label: 'Deep sleep deficit' },
      { metric: 'sleepRemPct', condition: 'below', threshold: 20, weight: 0.2, label: 'REM sleep deficit' },
      { metric: 'sleepHours', condition: 'below', threshold: 7, weight: 0.2, label: 'Insufficient sleep duration' },
    ],
    interventionIds: ['magnesium-threonate', 'apigenin', 'glycine-sleep'],
    productTags: ['sleep', 'gaba', 'neural', 'cognitive'],
  },
  {
    id: 'metabolic_efficiency',
    label: 'Metabolic Efficiency',
    icon: '⚡',
    color: '#FFD700',
    description: 'Glucose regulation, AMPK activation, and metabolic flexibility',
    activationRules: [
      { metric: 'bodyBattery', condition: 'below', threshold: 40, weight: 0.3, label: 'Energy reserves depleted' },
      { metric: 'strain', condition: 'above', threshold: 14, weight: 0.25, label: 'Excessive metabolic strain' },
      { metric: 'steps', condition: 'below', threshold: 4000, weight: 0.2, label: 'Low movement baseline' },
      { metric: 'recovery', condition: 'below', threshold: 50, weight: 0.25, label: 'Metabolic recovery impaired' },
    ],
    interventionIds: ['berberine', 'nad-nmn', 'creatine', 'zone-2-cardio'],
    productTags: ['metabolic', 'glucose', 'energy', 'ampk', 'mitochondrial'],
  },
  {
    id: 'inflammatory_control',
    label: 'Inflammatory Control',
    icon: '🔥',
    color: '#FF6B6B',
    description: 'Systemic inflammation reduction and SPM resolution pathways',
    activationRules: [
      { metric: 'hrv', condition: 'below', threshold: 40, weight: 0.3, label: 'HRV critically suppressed (inflammatory marker)' },
      { metric: 'heartRate', condition: 'above', threshold: 78, weight: 0.25, label: 'Elevated RHR (inflammation proxy)' },
      { metric: 'skinTemp', condition: 'above', threshold: 37.0, weight: 0.25, label: 'Elevated skin temperature' },
      { metric: 'recovery', condition: 'below', threshold: 45, weight: 0.2, label: 'Chronic recovery deficit' },
    ],
    interventionIds: ['omega-3-spm', 'bpc-157', 'curcumin-longvida'],
    productTags: ['inflammation', 'immune', 'cardiovascular'],
  },
  {
    id: 'hormonal_balance',
    label: 'Hormonal Balance',
    icon: '⚖️',
    color: '#E8976C',
    description: 'HPA axis regulation, testosterone optimization, and cortisol modulation',
    activationRules: [
      { metric: 'stress', condition: 'above', threshold: 55, weight: 0.3, label: 'Chronic stress (HPA dysregulation)' },
      { metric: 'sleepDeepPct', condition: 'below', threshold: 15, weight: 0.25, label: 'Deep sleep deficit (GH suppression)' },
      { metric: 'recovery', condition: 'below', threshold: 55, weight: 0.25, label: 'Recovery impaired (cortisol elevation)' },
      { metric: 'strain', condition: 'above', threshold: 16, weight: 0.2, label: 'Overtraining signal' },
    ],
    interventionIds: ['ashwagandha-ksm66', 'tongkat-ali', 'cjc-1295-ipamorelin'],
    productTags: ['hormonal', 'testosterone', 'endocrine', 'cortisol', 'stress'],
  },
  {
    id: 'cognitive_performance',
    label: 'Cognitive Performance',
    icon: '🎯',
    color: '#00FFCC',
    description: 'Neuroplasticity, focus, and brain-derived neurotrophic factor support',
    activationRules: [
      { metric: 'sleepRemPct', condition: 'below', threshold: 18, weight: 0.3, label: 'REM deficit (memory consolidation impaired)' },
      { metric: 'hrv', condition: 'below', threshold: 45, weight: 0.25, label: 'Low HRV (prefrontal cortex underperformance)' },
      { metric: 'stress', condition: 'above', threshold: 60, weight: 0.25, label: 'High stress (cognitive load)' },
      { metric: 'bodyBattery', condition: 'below', threshold: 35, weight: 0.2, label: 'Energy depleted (brain fog risk)' },
    ],
    interventionIds: ['magnesium-threonate', 'creatine', 'nad-nmn', 'lions-mane'],
    productTags: ['cognitive', 'brain', 'neural', 'performance'],
  },
  {
    id: 'cardiovascular_resilience',
    label: 'Cardiovascular Resilience',
    icon: '❤️',
    color: '#FF375F',
    description: 'Heart rate optimization, vascular health, and aerobic capacity',
    activationRules: [
      { metric: 'heartRate', condition: 'above', threshold: 76, weight: 0.35, label: 'Elevated resting heart rate' },
      { metric: 'spo2', condition: 'below', threshold: 96, weight: 0.25, label: 'Suboptimal oxygen saturation' },
      { metric: 'respiratoryRate', condition: 'above', threshold: 17, weight: 0.2, label: 'Elevated respiratory rate' },
      { metric: 'hrv', condition: 'below', threshold: 45, weight: 0.2, label: 'Reduced cardiac autonomic modulation' },
    ],
    interventionIds: ['omega-3-spm', 'zone-2-cardio', 'coq10'],
    productTags: ['cardiovascular', 'heart', 'endurance'],
  },
  {
    id: 'mitochondrial_energy',
    label: 'Mitochondrial Energy',
    icon: '🔋',
    color: '#00DC82',
    description: 'Cellular energy production, NAD+ restoration, and electron transport chain support',
    activationRules: [
      { metric: 'bodyBattery', condition: 'below', threshold: 45, weight: 0.3, label: 'Cellular energy depleted' },
      { metric: 'recovery', condition: 'below', threshold: 50, weight: 0.25, label: 'Mitochondrial recovery impaired' },
      { metric: 'strain', condition: 'above', threshold: 15, weight: 0.25, label: 'High oxidative demand' },
      { metric: 'sleepHours', condition: 'below', threshold: 6.5, weight: 0.2, label: 'Sleep-deprived mitophagy disruption' },
    ],
    interventionIds: ['nad-nmn', 'creatine', 'coq10'],
    productTags: ['mitochondrial', 'energy', 'nad+', 'longevity'],
  },
  {
    id: 'immune_defense',
    label: 'Immune Defense',
    icon: '🛡️',
    color: '#7DD3FC',
    description: 'Innate and adaptive immune system fortification',
    activationRules: [
      { metric: 'skinTemp', condition: 'above', threshold: 37.1, weight: 0.3, label: 'Elevated temperature (immune activation)' },
      { metric: 'spo2', condition: 'below', threshold: 95, weight: 0.25, label: 'Low SpO2 (respiratory stress)' },
      { metric: 'sleepHours', condition: 'below', threshold: 6, weight: 0.25, label: 'Sleep deprivation (NK cell suppression)' },
      { metric: 'recovery', condition: 'below', threshold: 40, weight: 0.2, label: 'Immune recovery compromised' },
    ],
    interventionIds: ['thymosin-alpha-1', 'vitamin-d3'],
    productTags: ['immune', 'inflammation'],
  },
  {
    id: 'gut_integrity',
    label: 'Gut Integrity',
    icon: '🦠',
    color: '#A3E635',
    description: 'Gut-brain axis repair, microbiome diversity, and mucosal barrier support',
    activationRules: [
      { metric: 'hrv', condition: 'below', threshold: 42, weight: 0.3, label: 'Low vagal tone (gut-brain axis disruption)' },
      { metric: 'stress', condition: 'above', threshold: 60, weight: 0.25, label: 'Chronic stress (gut permeability risk)' },
      { metric: 'sleepScore', condition: 'below', threshold: 60, weight: 0.25, label: 'Poor sleep (microbiome disruption)' },
      { metric: 'recovery', condition: 'below', threshold: 45, weight: 0.2, label: 'Systemic recovery deficit' },
    ],
    interventionIds: ['bpc-157', 'l-glutamine'],
    productTags: ['gut', 'microbiome', 'inflammation'],
  },
];

/* ══════════════════════════════════════════════════════════════════
   PRODUCT CATALOG REFERENCE
   Mirrors the OptimizationStore catalog for headless matching.
   Each entry maps to intervention IDs and optimization categories.
   ══════════════════════════════════════════════════════════════════ */

export interface ProductReference {
  id: string;
  name: string;
  brand: string;
  brandTier: 'clinical' | 'premium' | 'research';
  category: 'peptide' | 'supplement' | 'holistic' | 'device';
  icon: string;
  price: number;
  currency: string;
  unit: string;
  keyIngredient: string;
  matchesInterventions: string[];
  matchesStackItems: string[];
  tags: string[];
  affiliateUrl: string;
  /** Mechanism of action for synergy computation */
  mechanism: string;
  /** Which biological systems this product targets */
  systemTargets: OptimizationCategory[];
}

const PRODUCT_REFERENCE: ProductReference[] = [
  {
    id: 'prod-nmn-prohealth',
    name: 'NMN Pro 1000',
    brand: 'ProHealth Longevity',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🔋',
    price: 67.95,
    currency: 'USD',
    unit: '30 capsules (1000mg)',
    keyIngredient: 'NMN (Nicotinamide Mononucleotide)',
    matchesInterventions: ['nad-nmn'],
    matchesStackItems: ['ps-nmn'],
    tags: ['longevity', 'energy', 'mitochondrial', 'nad+'],
    affiliateUrl: '#affiliate-prohealth-nmn',
    mechanism: 'NAD+ precursor → SIRT1/PARP1 activation → mitochondrial biogenesis',
    systemTargets: ['mitochondrial_energy', 'metabolic_efficiency', 'cognitive_performance'],
  },
  {
    id: 'prod-magtein',
    name: 'Magtein\u00AE Magnesium L-Threonate',
    brand: 'Life Extension',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🧲',
    price: 29.25,
    currency: 'USD',
    unit: '90 capsules (2000mg)',
    keyIngredient: 'Magnesium L-Threonate',
    matchesInterventions: ['magnesium-threonate'],
    matchesStackItems: ['ps-mag-threonate'],
    tags: ['sleep', 'cognitive', 'neural', 'recovery'],
    affiliateUrl: '#affiliate-lifeext-magtein',
    mechanism: 'BBB-crossing Mg\u00B2\u207A → NMDA receptor modulation → synaptic density + GABA enhancement',
    systemTargets: ['sleep_architecture', 'cognitive_performance', 'autonomic_recovery'],
  },
  {
    id: 'prod-ksm66',
    name: 'KSM-66\u00AE Ashwagandha',
    brand: 'Nootropics Depot',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🌱',
    price: 19.99,
    currency: 'USD',
    unit: '90 capsules (600mg)',
    keyIngredient: 'Ashwagandha (KSM-66\u00AE)',
    matchesInterventions: ['ashwagandha-ksm66'],
    matchesStackItems: ['ps-ashwagandha'],
    tags: ['stress', 'cortisol', 'endocrine', 'recovery'],
    affiliateUrl: '#affiliate-nd-ksm66',
    mechanism: 'Withanolides → GABAergic modulation + cortisol suppression via HPA axis',
    systemTargets: ['hormonal_balance', 'autonomic_recovery', 'sleep_architecture'],
  },
  {
    id: 'prod-omega3-nordic',
    name: 'ProOmega 2000',
    brand: 'Nordic Naturals',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🐟',
    price: 55.96,
    currency: 'USD',
    unit: '60 softgels (2150mg EPA+DHA)',
    keyIngredient: 'Omega-3 (High EPA + DHA)',
    matchesInterventions: ['omega-3-spm'],
    matchesStackItems: ['ps-epa', 'ps-dha'],
    tags: ['inflammation', 'cardiovascular', 'brain', 'immune'],
    affiliateUrl: '#affiliate-nordic-proomega',
    mechanism: 'EPA/DHA → SPM resolution pathway → NF-\u03BAB suppression + membrane fluidity',
    systemTargets: ['inflammatory_control', 'cardiovascular_resilience', 'cognitive_performance'],
  },
  {
    id: 'prod-creatine-thorne',
    name: 'Creatine Monohydrate',
    brand: 'Thorne',
    brandTier: 'clinical',
    category: 'supplement',
    icon: '💪',
    price: 32.00,
    currency: 'USD',
    unit: '90 capsules (5g serving)',
    keyIngredient: 'Creatine Monohydrate',
    matchesInterventions: ['creatine'],
    matchesStackItems: ['ps-creatine'],
    tags: ['performance', 'cognitive', 'energy', 'muscle'],
    affiliateUrl: '#affiliate-thorne-creatine',
    mechanism: 'Phosphocreatine shuttle → rapid ATP regeneration in muscle + brain tissue',
    systemTargets: ['metabolic_efficiency', 'cognitive_performance', 'mitochondrial_energy'],
  },
  {
    id: 'prod-berberine-thorne',
    name: 'Berberine-500',
    brand: 'Thorne',
    brandTier: 'clinical',
    category: 'supplement',
    icon: '🌿',
    price: 36.00,
    currency: 'USD',
    unit: '60 capsules (500mg)',
    keyIngredient: 'Berberine HCl',
    matchesInterventions: ['berberine'],
    matchesStackItems: ['ps-berberine'],
    tags: ['metabolic', 'glucose', 'ampk', 'longevity'],
    affiliateUrl: '#affiliate-thorne-berberine',
    mechanism: 'AMPK activation → GLUT4 translocation + mitochondrial complex I modulation',
    systemTargets: ['metabolic_efficiency', 'mitochondrial_energy'],
  },
  {
    id: 'prod-apigenin-nd',
    name: 'Apigenin 50mg',
    brand: 'Nootropics Depot',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🌼',
    price: 14.99,
    currency: 'USD',
    unit: '120 capsules (50mg)',
    keyIngredient: 'Apigenin',
    matchesInterventions: ['apigenin'],
    matchesStackItems: [],
    tags: ['sleep', 'gaba', 'nad+', 'longevity'],
    affiliateUrl: '#affiliate-nd-apigenin',
    mechanism: 'GABA-A PAM → anxiolytic sleep onset + CD38 inhibition → NAD+ preservation',
    systemTargets: ['sleep_architecture', 'mitochondrial_energy'],
  },
  {
    id: 'prod-tongkat-nd',
    name: 'Tongkat Ali 10% Eurycomanone',
    brand: 'Nootropics Depot',
    brandTier: 'research',
    category: 'supplement',
    icon: '🌿',
    price: 29.99,
    currency: 'USD',
    unit: '60 capsules (400mg)',
    keyIngredient: 'Eurycoma longifolia (Tongkat Ali)',
    matchesInterventions: ['tongkat-ali'],
    matchesStackItems: ['ps-tongkat'],
    tags: ['hormonal', 'testosterone', 'endocrine', 'performance'],
    affiliateUrl: '#affiliate-nd-tongkat',
    mechanism: 'SHBG reduction → free testosterone \u2191 + CYP17 modulation → cortisol \u2193',
    systemTargets: ['hormonal_balance', 'metabolic_efficiency'],
  },
  {
    id: 'prod-vitd3k2-thorne',
    name: 'D3 + K2 Liquid',
    brand: 'Thorne',
    brandTier: 'clinical',
    category: 'supplement',
    icon: '\u2600\uFE0F',
    price: 25.00,
    currency: 'USD',
    unit: '1 fl oz (1000 IU/drop)',
    keyIngredient: 'Vitamin D3 + K2 MK-7',
    matchesInterventions: ['vitamin-d3'],
    matchesStackItems: ['ps-vitd3', 'ps-vitd3-base'],
    tags: ['immune', 'bone', 'hormonal'],
    affiliateUrl: '#affiliate-thorne-d3k2',
    mechanism: 'VDR activation → antimicrobial peptide expression + calcium homeostasis via K2 carboxylation',
    systemTargets: ['immune_defense', 'hormonal_balance'],
  },
  {
    id: 'prod-coq10-jarrow',
    name: 'QH-absorb\u00AE Ubiquinol',
    brand: 'Jarrow Formulas',
    brandTier: 'premium',
    category: 'supplement',
    icon: '\u26A1',
    price: 42.95,
    currency: 'USD',
    unit: '60 softgels (200mg)',
    keyIngredient: 'Ubiquinol (CoQ10)',
    matchesInterventions: ['coq10'],
    matchesStackItems: [],
    tags: ['mitochondrial', 'cardiovascular', 'energy', 'heart'],
    affiliateUrl: '#affiliate-jarrow-coq10',
    mechanism: 'Electron carrier in Complex III → ATP synthesis + lipid peroxidation defense',
    systemTargets: ['mitochondrial_energy', 'cardiovascular_resilience'],
  },
  {
    id: 'prod-lionsmane-nd',
    name: "Lion's Mane 8:1 Extract",
    brand: 'Nootropics Depot',
    brandTier: 'research',
    category: 'supplement',
    icon: '🍄',
    price: 24.99,
    currency: 'USD',
    unit: '60 capsules (500mg)',
    keyIngredient: 'Hericium erinaceus (Lion\'s Mane)',
    matchesInterventions: ['lions-mane'],
    matchesStackItems: [],
    tags: ['cognitive', 'brain', 'neural', 'neuroprotective'],
    affiliateUrl: '#affiliate-nd-lionsmane',
    mechanism: 'Hericenones/erinacines → NGF synthesis → hippocampal neurogenesis + myelination',
    systemTargets: ['cognitive_performance', 'autonomic_recovery'],
  },
  {
    id: 'prod-glutamine-thorne',
    name: 'L-Glutamine Powder',
    brand: 'Thorne',
    brandTier: 'clinical',
    category: 'supplement',
    icon: '🧪',
    price: 38.00,
    currency: 'USD',
    unit: '513g (5g/serving)',
    keyIngredient: 'L-Glutamine',
    matchesInterventions: ['l-glutamine'],
    matchesStackItems: [],
    tags: ['gut', 'immune', 'recovery', 'microbiome'],
    affiliateUrl: '#affiliate-thorne-glutamine',
    mechanism: 'Enterocyte fuel → tight junction protein expression → mucosal barrier integrity',
    systemTargets: ['gut_integrity', 'immune_defense'],
  },
];

/* ══════════════════════════════════════════════════════════════════
   RECOVERY PRODUCT MAP — Deep-link targets for HRV alerts
   Maps specific biometric alert conditions to the best recovery
   supplement in the catalog. Used by useHrvAlertMonitor().
   ══════════════════════════════════════════════════════════════════ */

interface RecoveryDeepLink {
  productId: string;
  productName: string;
  reason: string;
  mechanism: string;
  affiliateUrl: string;
  icon: string;
}

/** 
 * Ordered priority list of recovery supplements for HRV drops.
 * The engine picks the best match based on co-occurring signals.
 */
const HRV_RECOVERY_DEEP_LINKS: Array<RecoveryDeepLink & { coSignals: Array<{ metric: keyof SyncedVitals; condition: 'below' | 'above'; threshold: number }> }> = [
  {
    productId: 'prod-magtein',
    productName: 'Magtein\u00AE Magnesium L-Threonate',
    reason: 'Magnesium L-Threonate crosses the blood-brain barrier to restore parasympathetic tone and GABA signaling — the fastest path to HRV recovery',
    mechanism: 'BBB-crossing Mg\u00B2\u207A → NMDA modulation → vagal tone restoration',
    affiliateUrl: '#affiliate-lifeext-magtein',
    icon: '🧲',
    coSignals: [
      { metric: 'sleepScore', condition: 'below', threshold: 70 },
      { metric: 'stress', condition: 'above', threshold: 45 },
    ],
  },
  {
    productId: 'prod-ksm66',
    productName: 'KSM-66\u00AE Ashwagandha',
    reason: 'KSM-66 directly suppresses cortisol via HPA axis modulation — critical when HRV drops coincide with elevated stress markers',
    mechanism: 'Withanolides → cortisol suppression → parasympathetic rebound',
    affiliateUrl: '#affiliate-nd-ksm66',
    icon: '🌱',
    coSignals: [
      { metric: 'stress', condition: 'above', threshold: 50 },
      { metric: 'recovery', condition: 'below', threshold: 60 },
    ],
  },
  {
    productId: 'prod-omega3-nordic',
    productName: 'ProOmega 2000',
    reason: 'High-dose EPA/DHA activates SPM resolution pathways — HRV suppression with elevated RHR suggests systemic inflammation',
    mechanism: 'EPA/DHA → SPM pathway → NF-\u03BAB suppression → vagal anti-inflammatory reflex',
    affiliateUrl: '#affiliate-nordic-proomega',
    icon: '🐟',
    coSignals: [
      { metric: 'heartRate', condition: 'above', threshold: 75 },
      { metric: 'skinTemp', condition: 'above', threshold: 36.9 },
    ],
  },
  {
    productId: 'prod-coq10-jarrow',
    productName: 'QH-absorb\u00AE Ubiquinol',
    reason: 'Ubiquinol restores mitochondrial electron transport — HRV drops with low energy reserves indicate cellular energy crisis',
    mechanism: 'CoQ10 → Complex III electron carrier → ATP synthesis → cardiac autonomic support',
    affiliateUrl: '#affiliate-jarrow-coq10',
    icon: '\u26A1',
    coSignals: [
      { metric: 'bodyBattery', condition: 'below', threshold: 40 },
      { metric: 'strain', condition: 'above', threshold: 14 },
    ],
  },
  {
    productId: 'prod-apigenin-nd',
    productName: 'Apigenin 50mg',
    reason: 'Apigenin enhances GABA-A signaling for parasympathetic restoration — ideal when HRV drops coincide with poor sleep architecture',
    mechanism: 'GABA-A PAM → anxiolytic → deep sleep onset → overnight HRV recovery',
    affiliateUrl: '#affiliate-nd-apigenin',
    icon: '🌼',
    coSignals: [
      { metric: 'sleepDeepPct', condition: 'below', threshold: 18 },
      { metric: 'sleepHours', condition: 'below', threshold: 7 },
    ],
  },
];

/* ══════════════════════════════════════════════════════════════════
   CORE ENGINE — Score categories and match products
   ══════════════════════════════════════════════════════════════════ */

/**
 * Score a single activation rule against current vitals.
 * Returns 0-100 based on how far the metric deviates from threshold.
 */
function scoreRule(rule: ActivationRule, vitals: SyncedVitals): number {
  const value = vitals[rule.metric] as number;
  if (value === undefined || value === null) return 0;

  if (rule.condition === 'below') {
    if (value >= rule.threshold) return 0;
    const delta = rule.threshold - value;
    const maxDelta = rule.threshold * 0.5;
    return Math.min(100, (delta / Math.max(1, maxDelta)) * 100);
  } else {
    if (value <= rule.threshold) return 0;
    const delta = value - rule.threshold;
    const maxDelta = rule.threshold * 0.4;
    return Math.min(100, (delta / Math.max(1, maxDelta)) * 100);
  }
}

/**
 * Score all optimization categories against current vitals.
 * Returns sorted array with highest-priority categories first.
 */
export function scoreCategories(vitals: SyncedVitals): ScoredCategory[] {
  const scored: ScoredCategory[] = [];

  for (const cat of OPTIMIZATION_CATEGORIES) {
    let weightedSum = 0;
    let totalWeight = 0;
    const activeRules: ScoredCategory['activeRules'] = [];

    for (const rule of cat.activationRules) {
      const ruleScore = scoreRule(rule, vitals);
      weightedSum += ruleScore * rule.weight;
      totalWeight += rule.weight;

      if (ruleScore > 0) {
        const value = vitals[rule.metric] as number;
        activeRules.push({
          ...rule,
          currentValue: value,
          delta: rule.condition === 'below'
            ? rule.threshold - value
            : value - rule.threshold,
        });
      }
    }

    const score = totalWeight > 0 ? Math.round(weightedSum / totalWeight) : 0;

    if (score > 0) {
      const severity: OptimizationSeverity =
        score >= 70 ? 'critical' :
        score >= 45 ? 'elevated' :
        score >= 20 ? 'moderate' : 'low';

      scored.push({
        category: cat,
        score,
        severity,
        activeRules,
        matchedInterventions: [],
      });
    }
  }

  return scored.sort((a, b) => b.score - a.score);
}

/**
 * Match products to active optimization categories.
 * Returns products sorted by relevance with synergy scores.
 */
export interface RecommendedProduct {
  product: ProductReference;
  /** Overall relevance score 0-100 */
  relevanceScore: number;
  /** Synergy rating 0-100 — how well this pairs with user's current stack */
  synergyRating: number;
  /** Which optimization categories triggered this recommendation */
  matchedCategories: ScoredCategory[];
  /** Human-readable reason for recommendation */
  reason: string;
  /** Priority rank (1 = most important) */
  rank: number;
}

/**
 * Compute synergy rating between a product and the user's active interventions.
 */
function computeSynergyRating(
  product: ProductReference,
  activeCategories: ScoredCategory[],
  interventions: Intervention[],
): number {
  let synergy = 0;

  const matchedCatCount = product.systemTargets.filter(
    st => activeCategories.some(ac => ac.category.id === st)
  ).length;
  synergy += (matchedCatCount / Math.max(1, product.systemTargets.length)) * 35;

  const matchedInterventionCount = product.matchesInterventions.filter(
    intId => interventions.some(i => i.id === intId)
  ).length;
  if (matchedInterventionCount > 0) {
    synergy += Math.min(30, matchedInterventionCount * 15);
  }

  const allActiveTags = new Set(
    activeCategories.flatMap(ac => ac.category.productTags)
  );
  const tagOverlap = product.tags.filter(t => allActiveTags.has(t)).length;
  synergy += (tagOverlap / Math.max(1, product.tags.length)) * 20;

  const tierBonus = product.brandTier === 'clinical' ? 15 : product.brandTier === 'premium' ? 10 : 5;
  synergy += tierBonus;

  return Math.min(99, Math.round(synergy));
}

/**
 * Generate a human-readable recommendation reason.
 */
function generateReason(
  product: ProductReference,
  matchedCategories: ScoredCategory[],
): string {
  if (matchedCategories.length === 0) return 'General optimization support';

  const topCategory = matchedCategories[0];
  const topRule = topCategory.activeRules[0];

  if (!topRule) {
    return `Supports ${topCategory.category.label.toLowerCase()} based on your current biometric profile`;
  }

  const metricLabels: Record<string, string> = {
    hrv: 'HRV',
    heartRate: 'resting heart rate',
    sleepScore: 'sleep score',
    sleepDeepPct: 'deep sleep',
    sleepRemPct: 'REM sleep',
    sleepHours: 'sleep duration',
    recovery: 'recovery',
    stress: 'stress level',
    spo2: 'SpO2',
    bodyBattery: 'body battery',
    strain: 'strain',
    skinTemp: 'skin temperature',
    respiratoryRate: 'respiratory rate',
    steps: 'daily movement',
    readiness: 'readiness',
  };

  const metricName = metricLabels[topRule.metric] || topRule.metric;
  const direction = topRule.condition === 'below' ? 'low' : 'elevated';

  return `Your ${metricName} is ${direction} (${topRule.currentValue}${topRule.metric === 'spo2' || topRule.metric === 'sleepDeepPct' || topRule.metric === 'sleepRemPct' ? '%' : topRule.metric === 'hrv' ? 'ms' : topRule.metric === 'heartRate' ? 'bpm' : ''}) \u2014 ${product.keyIngredient} targets ${topCategory.category.label.toLowerCase()} via ${product.mechanism.split('\u2192')[0].trim()}`;
}

/**
 * Core recommendation function — matches products to current vitals.
 */
export function getProductRecommendations(
  vitals: SyncedVitals,
  interventions: Intervention[] = [],
  maxResults: number = 8,
): RecommendedProduct[] {
  const activeCategories = scoreCategories(vitals);

  if (activeCategories.length === 0) {
    return PRODUCT_REFERENCE.slice(0, 3).map((product, i) => ({
      product,
      relevanceScore: 30 - i * 5,
      synergyRating: 40,
      matchedCategories: [],
      reason: 'Maintenance protocol \u2014 your vitals are in optimal range',
      rank: i + 1,
    }));
  }

  const recommendations: RecommendedProduct[] = [];

  for (const product of PRODUCT_REFERENCE) {
    const matchedCats = activeCategories.filter(ac =>
      product.systemTargets.includes(ac.category.id) ||
      product.matchesInterventions.some(intId =>
        ac.category.interventionIds.includes(intId)
      ) ||
      product.tags.some(tag =>
        ac.category.productTags.includes(tag)
      )
    );

    if (matchedCats.length === 0) continue;

    const relevanceScore = Math.min(99, Math.round(
      matchedCats.reduce((sum, mc) => sum + mc.score, 0) / matchedCats.length
      * (1 + matchedCats.length * 0.15)
    ));

    const synergyRating = computeSynergyRating(product, activeCategories, interventions);
    const reason = generateReason(product, matchedCats);

    recommendations.push({
      product,
      relevanceScore,
      synergyRating,
      matchedCategories: matchedCats,
      reason,
      rank: 0,
    });
  }

  recommendations.sort((a, b) => {
    const scoreA = a.relevanceScore * 0.6 + a.synergyRating * 0.4;
    const scoreB = b.relevanceScore * 0.6 + b.synergyRating * 0.4;
    return scoreB - scoreA;
  });

  return recommendations.slice(0, maxResults).map((rec, i) => ({
    ...rec,
    rank: i + 1,
  }));
}

/* ══════════════════════════════════════════════════════════════════
   BIOLOGICAL OPTIMIZATION % — Composite readiness metric
   ══════════════════════════════════════════════════════════════════ */

export interface OptimizationScore {
  overall: number;
  systems: Array<{
    category: OptimizationCategory;
    label: string;
    icon: string;
    color: string;
    score: number;
    status: 'optimal' | 'good' | 'suboptimal' | 'critical';
  }>;
  trend: 'improving' | 'stable' | 'declining';
  summary: string;
}

export function computeOptimizationScore(vitals: SyncedVitals): OptimizationScore {
  const categories = scoreCategories(vitals);
  const allCats = OPTIMIZATION_CATEGORIES;

  const systems = allCats.map(cat => {
    const scored = categories.find(sc => sc.category.id === cat.id);
    const deficiency = scored ? scored.score : 0;
    const optimizationPct = Math.max(0, 100 - deficiency);

    const status: 'optimal' | 'good' | 'suboptimal' | 'critical' =
      optimizationPct >= 85 ? 'optimal' :
      optimizationPct >= 65 ? 'good' :
      optimizationPct >= 40 ? 'suboptimal' : 'critical';

    return {
      category: cat.id,
      label: cat.label,
      icon: cat.icon,
      color: cat.color,
      score: optimizationPct,
      status,
    };
  });

  const weights: Record<OptimizationCategory, number> = {
    autonomic_recovery: 0.15,
    sleep_architecture: 0.15,
    metabolic_efficiency: 0.12,
    inflammatory_control: 0.12,
    hormonal_balance: 0.1,
    cognitive_performance: 0.1,
    cardiovascular_resilience: 0.1,
    mitochondrial_energy: 0.08,
    immune_defense: 0.04,
    gut_integrity: 0.04,
  };

  let weightedSum = 0;
  let totalWeight = 0;
  for (const sys of systems) {
    const w = weights[sys.category] || 0.05;
    weightedSum += sys.score * w;
    totalWeight += w;
  }

  const overall = Math.round(totalWeight > 0 ? weightedSum / totalWeight : 50);

  const hrvOk = vitals.hrv >= 50;
  const sleepOk = vitals.sleepScore >= 70;
  const recoveryOk = vitals.recovery >= 60;
  const positiveSignals = [hrvOk, sleepOk, recoveryOk].filter(Boolean).length;
  const trend: 'improving' | 'stable' | 'declining' =
    positiveSignals >= 3 ? 'improving' :
    positiveSignals >= 1 ? 'stable' : 'declining';

  const criticalSystems = systems.filter(s => s.status === 'critical');
  const optimalSystems = systems.filter(s => s.status === 'optimal');

  let summary: string;
  if (overall >= 85) {
    summary = `Biological systems operating at ${overall}% optimization. ${optimalSystems.length} systems in optimal range. Maintain current protocols.`;
  } else if (overall >= 65) {
    summary = `${overall}% optimized. ${criticalSystems.length > 0 ? `Priority: ${criticalSystems.map(s => s.label).join(', ')} need attention.` : 'Minor adjustments recommended for peak performance.'}`;
  } else if (overall >= 40) {
    summary = `${overall}% optimization detected. ${criticalSystems.length} system${criticalSystems.length !== 1 ? 's' : ''} compromised: ${criticalSystems.map(s => s.label).join(', ')}. Intervention protocols recommended.`;
  } else {
    summary = `Critical: ${overall}% optimization. Multiple systems compromised. Immediate protocol intervention required for ${criticalSystems.map(s => s.label).join(', ')}.`;
  }

  return { overall, systems, trend, summary };
}

/* ══════════════════════════════════════════════════════════════════
   HRV ALERT MONITOR — Live Oura/Whoop Listener
   
   Listens to the live biometric stream from useBiometricSync.
   Computes a 7-day rolling HRV average from:
     1. DB-stored hrvReadings (via vitalsData.getVitalsTimeSeries)
     2. In-session HRV buffer (live readings accumulated this session)
   
   Triggers a "High Priority Recommendation" notification when:
     • Current HRV drops >15% below the 7-day rolling average
     • Cooldown: max 1 alert per 5 minutes to avoid spam
   
   The notification includes a deep-link to the best-matching
   recovery supplement in the Optimization Store.
   ══════════════════════════════════════════════════════════════════ */

/** Threshold: HRV must drop more than this % below 7-day avg to trigger */
const HRV_DROP_THRESHOLD_PCT = 0.15;

/** Minimum ms between alerts (5 minutes) */
const ALERT_COOLDOWN_MS = 5 * 60 * 1000;

/** Max in-session HRV buffer size (keep last 200 readings) */
const HRV_BUFFER_MAX = 200;

/** A high-priority recommendation notification */
export interface HrvAlertNotification {
  id: string;
  timestamp: number;
  type: 'hrv_critical_drop';
  severity: 'high' | 'critical';
  /** Current HRV reading that triggered the alert */
  currentHrv: number;
  /** 7-day rolling average at time of alert */
  rollingAvg7d: number;
  /** Percentage drop (e.g., 0.18 = 18% drop) */
  dropPct: number;
  /** Source provider that reported the reading */
  source: 'oura' | 'whoop' | 'combined';
  /** Deep-link to the recommended recovery product */
  deepLink: RecoveryDeepLink;
  /** Additional context about co-occurring signals */
  coSignals: string[];
  /** Human-readable alert message */
  message: string;
  /** Whether the user has dismissed this alert */
  dismissed: boolean;
}

export interface HrvAlertMonitorState {
  /** Active (undismissed) alerts, newest first */
  activeAlerts: HrvAlertNotification[];
  /** All alerts including dismissed, newest first */
  allAlerts: HrvAlertNotification[];
  /** Current 7-day rolling HRV average */
  rollingAvg7d: number | null;
  /** Current live HRV value */
  currentHrv: number;
  /** Whether the monitor is actively listening */
  isListening: boolean;
  /** Number of HRV readings in the session buffer */
  sessionReadingCount: number;
  /** Data source status */
  dataSource: {
    dbReadings: number;
    sessionReadings: number;
    lastDbSync: number | null;
  };
  /** Dismiss a specific alert */
  dismissAlert: (alertId: string) => void;
  /** Dismiss all alerts */
  dismissAll: () => void;
  /** Get the most urgent active alert (if any) */
  urgentAlert: HrvAlertNotification | null;
}

/**
 * Select the best recovery deep-link based on co-occurring biometric signals.
 * Scores each candidate by how many of its co-signals are currently active.
 */
function selectRecoveryDeepLink(vitals: SyncedVitals): RecoveryDeepLink {
  let bestMatch = HRV_RECOVERY_DEEP_LINKS[0];
  let bestScore = -1;

  for (const candidate of HRV_RECOVERY_DEEP_LINKS) {
    let score = 0;
    for (const sig of candidate.coSignals) {
      const value = vitals[sig.metric] as number;
      if (sig.condition === 'below' && value < sig.threshold) score++;
      if (sig.condition === 'above' && value > sig.threshold) score++;
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = candidate;
    }
  }

  return {
    productId: bestMatch.productId,
    productName: bestMatch.productName,
    reason: bestMatch.reason,
    mechanism: bestMatch.mechanism,
    affiliateUrl: bestMatch.affiliateUrl,
    icon: bestMatch.icon,
  };
}

/**
 * Identify co-occurring biometric signals for alert context.
 */
function identifyCoSignals(vitals: SyncedVitals): string[] {
  const signals: string[] = [];

  if (vitals.stress > 50) signals.push(`Stress elevated at ${Math.round(vitals.stress)}%`);
  if (vitals.recovery < 55) signals.push(`Recovery suppressed at ${Math.round(vitals.recovery)}%`);
  if (vitals.heartRate > 76) signals.push(`RHR elevated at ${Math.round(vitals.heartRate)} bpm`);
  if (vitals.sleepScore < 65) signals.push(`Sleep score low at ${Math.round(vitals.sleepScore)}`);
  if (vitals.sleepDeepPct < 18) signals.push(`Deep sleep deficit at ${Math.round(vitals.sleepDeepPct)}%`);
  if (vitals.bodyBattery < 40) signals.push(`Body battery depleted at ${Math.round(vitals.bodyBattery)}%`);
  if (vitals.skinTemp > 37.0) signals.push(`Skin temp elevated at ${vitals.skinTemp.toFixed(1)}\u00B0C`);
  if (vitals.strain > 14) signals.push(`Strain high at ${vitals.strain.toFixed(1)}`);

  return signals.slice(0, 4); // Max 4 co-signals
}

/**
 * useHrvAlertMonitor — Live HRV Drop Detection Hook
 * 
 * Actively listens to Oura and Whoop HRV streams via useBiometricSync.
 * Computes a 7-day rolling average from DB-stored readings + in-session
 * buffer. Fires a "High Priority Recommendation" when HRV drops >15%
 * below the rolling average, with a deep-link to the best recovery
 * supplement.
 * 
 * @returns HrvAlertMonitorState
 */
export function useHrvAlertMonitor(): HrvAlertMonitorState {
  const { vitals, providers } = useBiometricSync();
  const sessionId = getSessionId();

  // Query 7-day vitals time series from DB for HRV baseline
  const vitalsTimeSeries = useQuery(
    api.vitalsData.getVitalsTimeSeries,
    sessionId ? { sessionId } : 'skip'
  );

  // In-session HRV reading buffer (accumulates live readings)
  const hrvBufferRef = useRef<Array<{ timestamp: number; value: number }>>([]);
  const lastAlertTimeRef = useRef<number>(0);
  const prevHrvRef = useRef<number>(vitals.hrv);

  // Alert state
  const [alerts, setAlerts] = useState<HrvAlertNotification[]>([]);

  // Compute 7-day rolling average from DB + session buffer
  const rollingAvg7d = useMemo(() => {
    const dbReadings: number[] = [];

    // Extract HRV values from DB time series
    if (vitalsTimeSeries?.hrvSeries) {
      for (const reading of vitalsTimeSeries.hrvSeries) {
        if (reading.value > 0 && reading.value < 200) {
          dbReadings.push(reading.value);
        }
      }
    }

    // Also pull daily HRV averages from dailyData
    if (vitalsTimeSeries?.dailyData) {
      for (const day of vitalsTimeSeries.dailyData) {
        if (day.hrvAvg !== null && day.hrvAvg > 0) {
          dbReadings.push(day.hrvAvg);
        }
      }
    }

    // Add in-session readings
    const sessionValues = hrvBufferRef.current.map(r => r.value);
    const allValues = [...dbReadings, ...sessionValues];

    if (allValues.length === 0) return null;

    // Weighted average: recent readings count more
    let weightedSum = 0;
    let totalWeight = 0;
    for (let i = 0; i < allValues.length; i++) {
      const recency = (i + 1) / allValues.length; // 0→1, newer = higher
      const weight = 0.5 + recency * 0.5; // range 0.5–1.0
      weightedSum += allValues[i] * weight;
      totalWeight += weight;
    }

    return totalWeight > 0 ? Math.round(weightedSum / totalWeight) : null;
  }, [vitalsTimeSeries]);

  // Listen to live HRV changes from Oura and Whoop
  useEffect(() => {
    const currentHrv = vitals.hrv;
    const now = Date.now();

    // Only process if HRV actually changed (avoid duplicate processing)
    if (currentHrv === prevHrvRef.current) return;
    prevHrvRef.current = currentHrv;

    // Determine which provider reported this reading
    const ouraConnected = providers.oura?.connected;
    const whoopConnected = providers.whoop?.connected;
    const source: 'oura' | 'whoop' | 'combined' =
      ouraConnected && whoopConnected ? 'combined' :
      ouraConnected ? 'oura' :
      whoopConnected ? 'whoop' : 'combined';

    // Buffer the reading for rolling average computation
    hrvBufferRef.current.push({ timestamp: now, value: currentHrv });
    if (hrvBufferRef.current.length > HRV_BUFFER_MAX) {
      hrvBufferRef.current = hrvBufferRef.current.slice(-HRV_BUFFER_MAX);
    }

    // Check against 7-day rolling average
    if (rollingAvg7d === null || rollingAvg7d <= 0) return;

    const dropPct = (rollingAvg7d - currentHrv) / rollingAvg7d;

    // Only alert if drop exceeds threshold
    if (dropPct <= HRV_DROP_THRESHOLD_PCT) return;

    // Cooldown check — don't spam alerts
    if (now - lastAlertTimeRef.current < ALERT_COOLDOWN_MS) return;

    // === TRIGGER HIGH PRIORITY RECOMMENDATION ===
    lastAlertTimeRef.current = now;

    const deepLink = selectRecoveryDeepLink(vitals);
    const coSignals = identifyCoSignals(vitals);
    const severity: 'high' | 'critical' = dropPct > 0.25 ? 'critical' : 'high';

    const dropPctDisplay = Math.round(dropPct * 100);
    const message = severity === 'critical'
      ? `\u26A0\uFE0F Critical HRV Drop: ${currentHrv}ms is ${dropPctDisplay}% below your 7-day average of ${rollingAvg7d}ms. Immediate autonomic recovery protocol recommended.`
      : `\u26A0\uFE0F HRV Alert: ${currentHrv}ms detected \u2014 ${dropPctDisplay}% below your 7-day baseline of ${rollingAvg7d}ms. Recovery intervention suggested.`;

    const newAlert: HrvAlertNotification = {
      id: `hrv-alert-${now}`,
      timestamp: now,
      type: 'hrv_critical_drop',
      severity,
      currentHrv,
      rollingAvg7d,
      dropPct,
      source,
      deepLink,
      coSignals,
      message,
      dismissed: false,
    };

    setAlerts(prev => [newAlert, ...prev].slice(0, 20)); // Keep last 20 alerts

    // Dispatch global event for DataIngestionHeader and other listeners
    window.dispatchEvent(
      new CustomEvent('vive-hrv-alert', {
        detail: newAlert,
      })
    );
  }, [vitals.hrv, vitals.stress, vitals.recovery, vitals.heartRate, rollingAvg7d, providers]);

  // Dismiss handlers
  const dismissAlert = useCallback((alertId: string) => {
    setAlerts(prev => prev.map(a =>
      a.id === alertId ? { ...a, dismissed: true } : a
    ));
  }, []);

  const dismissAll = useCallback(() => {
    setAlerts(prev => prev.map(a => ({ ...a, dismissed: true })));
  }, []);

  const activeAlerts = useMemo(
    () => alerts.filter(a => !a.dismissed),
    [alerts]
  );

  const urgentAlert = activeAlerts.length > 0 ? activeAlerts[0] : null;

  return {
    activeAlerts,
    allAlerts: alerts,
    rollingAvg7d,
    currentHrv: vitals.hrv,
    isListening: providers.oura?.connected || providers.whoop?.connected || false,
    sessionReadingCount: hrvBufferRef.current.length,
    dataSource: {
      dbReadings: vitalsTimeSeries?.hrvSeries?.length ?? 0,
      sessionReadings: hrvBufferRef.current.length,
      lastDbSync: vitalsTimeSeries?.hrvSeries?.[vitalsTimeSeries.hrvSeries.length - 1]?.timestamp ?? null,
    },
    dismissAlert,
    dismissAll,
    urgentAlert,
  };
}

/* ══════════════════════════════════════════════════════════════════
   REACT HOOK — useProductRecommendations()
   
   The primary interface for UI components. Combines live biometric
   data from useBiometricSync with BioIntelligence interventions
   to produce ranked product recommendations.
   ══════════════════════════════════════════════════════════════════ */

export interface ProductRecommendationsState {
  /** Ranked product recommendations */
  recommendations: RecommendedProduct[];
  /** Active optimization categories with scores */
  activeCategories: ScoredCategory[];
  /** Overall biological optimization score */
  optimizationScore: OptimizationScore;
  /** Whether the engine is computing */
  isComputing: boolean;
  /** BioIntelligence report (if available) */
  bioReport: BioIntelligenceReport | null;
  /** All available products in the catalog */
  catalog: ProductReference[];
  /** Get recommendations for a specific category */
  getByCategory: (categoryId: OptimizationCategory) => RecommendedProduct[];
  /** Get the top N recommendations */
  getTopN: (n: number) => RecommendedProduct[];
  /** Get products matching a specific intervention */
  getByIntervention: (interventionId: string) => RecommendedProduct[];
}

/**
 * useProductRecommendations — Primary hook for UI consumption.
 */
export function useProductRecommendations(
  maxResults: number = 8,
): ProductRecommendationsState {
  const { vitals } = useBiometricSync();

  const state = useMemo(() => {
    const biometricInputs: BiometricInputs = {
      hrv: vitals.hrv,
      heartRate: vitals.heartRate,
      sleepHours: vitals.sleepHours,
      sleepScore: vitals.sleepScore,
      sleepDeepPct: vitals.sleepDeepPct,
      sleepRemPct: vitals.sleepRemPct,
      recovery: vitals.recovery,
      stress: vitals.stress,
      spo2: vitals.spo2,
      bodyBattery: vitals.bodyBattery,
      strain: vitals.strain,
      skinTemp: vitals.skinTemp,
      respiratoryRate: vitals.respiratoryRate,
      steps: vitals.steps,
      readiness: vitals.readiness,
    };

    const now = Date.now();
    const msPerDay = 86400000;
    const makeHistory = (current: number, volatility: number): TimestampedReading[] => {
      const readings: TimestampedReading[] = [];
      for (let i = 6; i >= 0; i--) {
        const noise = (Math.random() - 0.5) * volatility * 2;
        readings.push({
          timestamp: now - i * msPerDay,
          value: Math.max(0, current + noise * (i / 6)),
        });
      }
      return readings;
    };

    const history: BiometricHistory = {
      hrv: makeHistory(vitals.hrv, 8),
      heartRate: makeHistory(vitals.heartRate, 4),
      sleepHours: makeHistory(vitals.sleepHours, 0.8),
      sleepScore: makeHistory(vitals.sleepScore, 6),
      recovery: makeHistory(vitals.recovery, 8),
      stress: makeHistory(vitals.stress, 10),
      strain: makeHistory(vitals.strain, 2),
      bodyBattery: makeHistory(vitals.bodyBattery, 8),
      spo2: makeHistory(vitals.spo2, 0.5),
    };

    let bioReport: BioIntelligenceReport | null = null;
    let interventions: Intervention[] = [];
    try {
      bioReport = runBioIntelligence(biometricInputs, history);
      interventions = bioReport.interventions;
    } catch {
      // Fallback
    }

    const activeCategories = scoreCategories(vitals);

    for (const ac of activeCategories) {
      ac.matchedInterventions = interventions.filter(i =>
        ac.category.interventionIds.includes(i.id)
      );
    }

    const recommendations = getProductRecommendations(vitals, interventions, maxResults);
    const optimizationScore = computeOptimizationScore(vitals);

    return {
      recommendations,
      activeCategories,
      optimizationScore,
      bioReport,
      interventions,
    };
  }, [
    vitals.hrv, vitals.heartRate, vitals.sleepHours, vitals.sleepScore,
    vitals.sleepDeepPct, vitals.sleepRemPct, vitals.recovery, vitals.stress,
    vitals.spo2, vitals.bodyBattery, vitals.strain, vitals.skinTemp,
    vitals.respiratoryRate, vitals.steps, vitals.readiness, maxResults,
  ]);

  const getByCategory = useMemo(() => {
    return (categoryId: OptimizationCategory): RecommendedProduct[] => {
      return state.recommendations.filter(rec =>
        rec.matchedCategories.some(mc => mc.category.id === categoryId)
      );
    };
  }, [state.recommendations]);

  const getTopN = useMemo(() => {
    return (n: number): RecommendedProduct[] => {
      return state.recommendations.slice(0, n);
    };
  }, [state.recommendations]);

  const getByIntervention = useMemo(() => {
    return (interventionId: string): RecommendedProduct[] => {
      return state.recommendations.filter(rec =>
        rec.product.matchesInterventions.includes(interventionId)
      );
    };
  }, [state.recommendations]);

  return {
    recommendations: state.recommendations,
    activeCategories: state.activeCategories,
    optimizationScore: state.optimizationScore,
    isComputing: false,
    bioReport: state.bioReport,
    catalog: PRODUCT_REFERENCE,
    getByCategory,
    getTopN,
    getByIntervention,
  };
}

/* ══════════════════════════════════════════════════════════════════
   EXPORTS — Public API
   ══════════════════════════════════════════════════════════════════ */

export {
  OPTIMIZATION_CATEGORIES,
  PRODUCT_REFERENCE,
  HRV_DROP_THRESHOLD_PCT,
  ALERT_COOLDOWN_MS,
};

export type {
  CategoryDefinition as OptimizationCategoryDefinition,
  ProductReference as ProductRef,
  RecoveryDeepLink,
};
