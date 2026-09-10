/* ══════════════════════════════════════════════════════════════════
   OPTIMIZATION STORE — High-End Health Concierge
   
   AI-driven product recommendations powered by RecommendationEngine.
   Each card shows a "Why this helps you" rationale, synergy rating,
   and a "Buy Now" affiliate button with external redirect. Designed
   as a premium concierge experience — not a generic e-commerce grid.
   
   Features:
   • "Sourced by Vive" trust badge on every product card
   • "Personalized for you" badge on high-priority AI-flagged products
   • Out of Stock visual state with "Alternative Recommendation" logic
   • External affiliate redirect via window.open (noopener, noreferrer)
   • Click-through event logging before affiliate redirect
   • Broken-link detection with automatic fallback product suggestion
   ══════════════════════════════════════════════════════════════════ */

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import { useBiometricSync } from '@/hooks/useBiometricSync';
import {
  useProductRecommendations,
  type OptimizationCategory,
  type ScoredCategory,
} from '@/lib/RecommendationEngine';
import {
  runBioIntelligence,
  type Intervention,
  type BioIntelligenceReport,
} from '@/lib/BioIntelligence';
import type { BiometricInputs } from '@/lib/IntelligenceEngine';
import {
  generatePrecisionStack,
  type PrecisionItem,
  type PrecisionFocus,
} from '@/lib/supplementLogic';

/* ── Design Tokens ── */
const T = {
  bg: '#050505',
  surface: 'rgba(12,12,16,0.80)',
  surfaceHover: 'rgba(18,18,24,0.90)',
  elevated: 'rgba(22,22,28,0.85)',
  text: '#F0F0F4',
  textSecondary: 'rgba(255,255,255,0.55)',
  textTertiary: 'rgba(255,255,255,0.28)',
  border: 'rgba(255,255,255,0.05)',
  borderActive: 'rgba(255,255,255,0.10)',
  accent: '#00FFCC',
  gold: '#FFD700',
  orange: '#E8976C',
  purple: '#AF82FF',
  blue: '#6B8AFF',
  green: '#00DC82',
  red: '#FF6B6B',
  cyan: '#00D4FF',
};

/* ══════════════════════════════════════════════════════════════════
   PRODUCT CATALOG — Curated clinical & premium brands
   ══════════════════════════════════════════════════════════════════ */

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface StoreProduct {
  id: string;
  name: string;
  brand: string;
  brandTier: 'clinical' | 'premium' | 'research';
  category: 'peptide' | 'supplement' | 'holistic' | 'device';
  icon: string;
  price: number;
  currency: string;
  unit: string;
  shortBenefit: string;
  description: string;
  keyIngredient: string;
  matchesInterventions: string[];
  matchesStackItems: string[];
  /** External affiliate URL — opens in new tab with noopener/noreferrer */
  affiliateUrl: string;
  /** Whether the affiliate link is currently valid/active */
  affiliateLinkActive: boolean;
  certifications: string[];
  bioavailability: string;
  tags: string[];
  /** Which optimization categories this product addresses */
  categories: OptimizationCategory[];
  /** Current stock status */
  stockStatus: StockStatus;
  /** Optional: IDs of alternative products if this one is out of stock or link broken */
  alternativeProductIds: string[];
}

const PRODUCT_CATALOG: StoreProduct[] = [
  {
    id: 'prod-nmn-prohealth',
    name: 'NMN Pro 1000',
    brand: 'ProHealth Longevity',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🔋',
    price: 67.95,
    currency: 'USD',
    unit: '30 capsules · 1000mg',
    shortBenefit: 'Boosts cellular NAD+ for mitochondrial energy',
    description: 'Pharmaceutical-grade NMN with >99% purity. Uthever-branded NMN verified by third-party HPLC testing. Direct NAD+ precursor for mitochondrial energy restoration.',
    keyIngredient: 'NMN (Nicotinamide Mononucleotide)',
    matchesInterventions: ['nad-nmn'],
    matchesStackItems: ['ps-nmn'],
    affiliateUrl: 'https://www.prohealthlongevity.com/collections/nmn?ref=vive',
    affiliateLinkActive: true,
    certifications: ['GMP Certified', 'Third-Party Tested', 'Uthever® NMN'],
    bioavailability: 'Sublingual delivery bypasses first-pass metabolism — 2-3x oral bioavailability',
    tags: ['longevity', 'energy', 'mitochondrial', 'nad+'],
    categories: ['mitochondrial_energy', 'metabolic_efficiency'],
    stockStatus: 'in_stock',
    alternativeProductIds: ['prod-creatine-thorne'],
  },
  {
    id: 'prod-magtein',
    name: 'Magtein® Magnesium L-Threonate',
    brand: 'Life Extension',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🧲',
    price: 29.25,
    currency: 'USD',
    unit: '90 capsules · 2000mg',
    shortBenefit: 'Crosses blood-brain barrier for deep sleep',
    description: 'Patented Magtein® form — the only magnesium shown to cross the blood-brain barrier. Supports synaptic density, deep sleep architecture, and GABA receptor modulation.',
    keyIngredient: 'Magnesium L-Threonate',
    matchesInterventions: ['magnesium-threonate'],
    matchesStackItems: ['ps-mag-threonate'],
    affiliateUrl: 'https://www.lifeextension.com/vitamins-supplements/item02032?ref=vive',
    affiliateLinkActive: true,
    certifications: ['Magtein® Patent', 'Non-GMO', 'GMP'],
    bioavailability: 'Crosses BBB via TRPM7 channels — 4x brain Mg²⁺ concentration vs. oxide/citrate',
    tags: ['sleep', 'cognitive', 'neural', 'recovery'],
    categories: ['sleep_architecture', 'cognitive_performance', 'autonomic_recovery'],
    stockStatus: 'in_stock',
    alternativeProductIds: ['prod-apigenin-nd'],
  },
  {
    id: 'prod-ksm66',
    name: 'KSM-66® Ashwagandha',
    brand: 'Nootropics Depot',
    brandTier: 'premium',
    category: 'supplement',
    icon: '🌱',
    price: 19.99,
    currency: 'USD',
    unit: '90 capsules · 600mg',
    shortBenefit: 'Reduces cortisol 25-30% for HPA axis balance',
    description: 'Gold-standard KSM-66® full-spectrum root extract. Clinically proven to reduce cortisol 25-30% and restore diurnal HPA axis rhythm. Standardized to ≥5% withanolides.',
    keyIngredient: 'Ashwagandha (KSM-66®)',
    matchesInterventions: ['ashwagandha-ksm66'],
    matchesStackItems: ['ps-ashwagandha'],
    affiliateUrl: 'https://nootropicsdepot.com/ksm-66-ashwagandha?ref=vive',
    affiliateLinkActive: true,
    certifications: ['KSM-66® Licensed', 'BSCG Certified', 'Organic Root'],
    bioavailability: 'Full-spectrum extraction preserves synergistic withanolide profile',
    tags: ['stress', 'cortisol', 'endocrine', 'recovery'],
    categories: ['hormonal_balance', 'autonomic_recovery'],
    stockStatus: 'in_stock',
    alternativeProductIds: ['prod-tongkat-nd'],
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
    unit: '60 softgels · 2150mg EPA+DHA',
    shortBenefit: 'Targets ALOX5 inflammatory cascade',
    description: 'Ultra-concentrated triglyceride-form fish oil. 1125mg EPA + 875mg DHA per serving. IFOS 5-star rated for purity. Targets ALOX5 inflammatory cascade and cardiovascular health.',
    keyIngredient: 'Omega-3 (High EPA + DHA)',
    matchesInterventions: ['omega-3-spm'],
    matchesStackItems: ['ps-epa', 'ps-dha'],
    affiliateUrl: 'https://www.nordicnaturals.com/consumers/proomega-2000?ref=vive',
    affiliateLinkActive: true,
    certifications: ['IFOS 5-Star', 'Friend of the Sea', 'Non-GMO'],
    bioavailability: 'Triglyceride form — 70% better absorption than ethyl ester',
    tags: ['inflammation', 'cardiovascular', 'brain', 'immune'],
    categories: ['inflammatory_control', 'cardiovascular_resilience', 'cognitive_performance'],
    stockStatus: 'in_stock',
    alternativeProductIds: [],
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
    unit: '90 capsules · 5g serving',
    shortBenefit: 'ATP regeneration for muscle + brain',
    description: 'NSF Certified for Sport® creatine monohydrate. Supports phosphocreatine ATP regeneration for both muscular and cognitive performance. The most studied supplement in sports science.',
    keyIngredient: 'Creatine Monohydrate',
    matchesInterventions: ['creatine'],
    matchesStackItems: ['ps-creatine'],
    affiliateUrl: 'https://www.thorne.com/products/dp/creatine?ref=vive',
    affiliateLinkActive: true,
    certifications: ['NSF Certified for Sport®', 'cGMP', 'Informed Sport'],
    bioavailability: 'Monohydrate form — gold standard with 99%+ absorption',
    tags: ['performance', 'cognitive', 'energy', 'muscle'],
    categories: ['mitochondrial_energy', 'cognitive_performance'],
    stockStatus: 'in_stock',
    alternativeProductIds: ['prod-nmn-prohealth'],
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
    unit: '60 capsules · 500mg',
    shortBenefit: 'AMPK activation for glucose metabolism',
    description: 'Pharmaceutical-grade berberine HCl for AMPK activation and glucose metabolism. Clinically shown to reduce HbA1c 0.5-0.9% — comparable to metformin in efficacy.',
    keyIngredient: 'Berberine HCl',
    matchesInterventions: ['berberine'],
    matchesStackItems: ['ps-berberine'],
    affiliateUrl: 'https://www.thorne.com/products/dp/berberine-500?ref=vive',
    affiliateLinkActive: true,
    certifications: ['NSF Certified', 'cGMP', 'Gluten-Free'],
    bioavailability: 'HCl salt form for optimal gastric absorption',
    tags: ['metabolic', 'glucose', 'ampk', 'longevity'],
    categories: ['metabolic_efficiency'],
    stockStatus: 'in_stock',
    alternativeProductIds: [],
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
    unit: '120 capsules · 50mg',
    shortBenefit: 'GABA modulation for natural sleep onset',
    description: 'Standardized chamomile-derived apigenin. GABA-A positive allosteric modulator for natural sleep onset. Also inhibits CD38 to preserve NAD+ levels — dual sleep + longevity action.',
    keyIngredient: 'Apigenin',
    matchesInterventions: ['apigenin'],
    matchesStackItems: [],
    affiliateUrl: 'https://nootropicsdepot.com/apigenin?ref=vive',
    affiliateLinkActive: true,
    certifications: ['Third-Party Tested', 'Standardized Extract'],
    bioavailability: 'Lipophilic — take with small fat source for enhanced absorption',
    tags: ['sleep', 'gaba', 'nad+', 'longevity'],
    categories: ['sleep_architecture'],
    stockStatus: 'in_stock',
    alternativeProductIds: ['prod-magtein'],
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
    unit: '60 capsules · 400mg',
    shortBenefit: 'Reduces SHBG for free testosterone',
    description: 'High-potency 10% eurycomanone extract. Reduces SHBG 30-40% to increase free testosterone bioavailability. Modulates cortisol via CYP17 for improved T:C ratio.',
    keyIngredient: 'Eurycoma longifolia (Tongkat Ali)',
    matchesInterventions: ['tongkat-ali'],
    matchesStackItems: ['ps-tongkat'],
    affiliateUrl: 'https://nootropicsdepot.com/tongkat-ali?ref=vive',
    affiliateLinkActive: true,
    certifications: ['10% Eurycomanone', 'Heavy Metal Tested', 'Standardized'],
    bioavailability: 'Standardized to active eurycomanone — not raw herb powder',
    tags: ['hormonal', 'testosterone', 'endocrine', 'performance'],
    categories: ['hormonal_balance'],
    stockStatus: 'low_stock',
    alternativeProductIds: ['prod-ksm66'],
  },
  {
    id: 'prod-vitd3k2-thorne',
    name: 'D3 + K2 Liquid',
    brand: 'Thorne',
    brandTier: 'clinical',
    category: 'supplement',
    icon: '☀️',
    price: 25.00,
    currency: 'USD',
    unit: '1 fl oz · 1000 IU per drop',
    shortBenefit: 'Immune + bone support with precision dosing',
    description: 'Liquid D3 + K2 MK-7 in MCT oil base for maximum absorption. Precise dropper dosing allows titration from 1,000-10,000 IU based on blood levels.',
    keyIngredient: 'Vitamin D3 + K2 MK-7',
    matchesInterventions: [],
    matchesStackItems: ['ps-vitd3', 'ps-vitd3-base'],
    affiliateUrl: 'https://www.thorne.com/products/dp/vitamin-d-k2-liquid?ref=vive',
    affiliateLinkActive: true,
    certifications: ['NSF Certified', 'MCT Oil Base', 'Precision Dropper'],
    bioavailability: 'Liquid in MCT oil — 3-4x absorption vs. dry tablet form',
    tags: ['immune', 'bone', 'hormonal', 'baseline'],
    categories: ['immune_defense'],
    stockStatus: 'in_stock',
    alternativeProductIds: [],
  },
  {
    id: 'prod-bpc157',
    name: 'BPC-157 (Research Grade)',
    brand: 'Peptide Sciences',
    brandTier: 'research',
    category: 'peptide',
    icon: '🧬',
    price: 54.99,
    currency: 'USD',
    unit: '5mg vial · lyophilized',
    shortBenefit: 'Tissue repair via VEGF upregulation',
    description: 'Research-grade BPC-157 pentadecapeptide. Promotes angiogenesis and tissue repair via VEGF upregulation. Modulates nitric oxide and dopamine systems.',
    keyIngredient: 'BPC-157 (Body Protection Compound)',
    matchesInterventions: ['bpc-157'],
    matchesStackItems: [],
    affiliateUrl: 'https://www.peptidesciences.com/bpc-157-5mg?ref=vive',
    affiliateLinkActive: true,
    certifications: ['HPLC Verified >98%', 'Mass Spec Confirmed', 'Research Use'],
    bioavailability: 'Subcutaneous injection — near 100% bioavailability',
    tags: ['peptide', 'repair', 'gut', 'inflammation'],
    categories: ['inflammatory_control', 'gut_integrity'],
    stockStatus: 'in_stock',
    alternativeProductIds: ['prod-omega3-nordic'],
  },
  {
    id: 'prod-cjc-ipa',
    name: 'CJC-1295 / Ipamorelin Blend',
    brand: 'Peptide Sciences',
    brandTier: 'research',
    category: 'peptide',
    icon: '💉',
    price: 79.99,
    currency: 'USD',
    unit: '5mg/5mg blend vial',
    shortBenefit: 'Amplifies nocturnal GH pulse 3-6x',
    description: 'Research-grade GHRH analog + selective GHS-R agonist blend. Amplifies nocturnal GH pulse 3-6x without cortisol or prolactin elevation.',
    keyIngredient: 'CJC-1295 (no DAC) + Ipamorelin',
    matchesInterventions: ['cjc-1295-ipamorelin'],
    matchesStackItems: [],
    affiliateUrl: 'https://www.peptidesciences.com/cjc-1295-ipamorelin?ref=vive',
    affiliateLinkActive: true,
    certifications: ['HPLC >98%', 'Endotoxin Tested', 'Research Use'],
    bioavailability: 'Subcutaneous — rapid absorption with 30-min onset',
    tags: ['peptide', 'growth-hormone', 'sleep', 'recovery'],
    categories: ['hormonal_balance', 'sleep_architecture'],
    stockStatus: 'in_stock',
    alternativeProductIds: ['prod-tongkat-nd'],
  },
  {
    id: 'prod-whoop-band',
    name: 'WHOOP 4.0 Band',
    brand: 'WHOOP',
    brandTier: 'premium',
    category: 'device',
    icon: '⌚',
    price: 30.00,
    currency: 'USD',
    unit: '/month membership',
    shortBenefit: 'Real-time HR zone alerts for Zone 2 training',
    description: 'Continuous HR, HRV, strain, and recovery monitoring. Essential for Zone 2 training compliance — real-time HR zone alerts ensure you stay in the optimal 60-70% max HR range.',
    keyIngredient: 'Biometric Monitoring',
    matchesInterventions: ['zone-2-cardio'],
    matchesStackItems: [],
    affiliateUrl: 'https://www.whoop.com/membership/strap/?ref=vive',
    affiliateLinkActive: true,
    certifications: ['Medical-Grade Sensor', 'FDA Registered'],
    bioavailability: 'N/A — wearable device',
    tags: ['device', 'tracking', 'zone2', 'cardiovascular'],
    categories: ['cardiovascular_resilience'],
    stockStatus: 'in_stock',
    alternativeProductIds: [],
  },
];

/* ══════════════════════════════════════════════════════════════════
   AFFILIATE CLICK-THROUGH TRACKING
   ══════════════════════════════════════════════════════════════════ */

/** Get session ID for analytics */
function getSessionId(): string {
  if (typeof window === 'undefined') return 'default';
  return sessionStorage.getItem('vive-session-id') || 'default';
}

/**
 * useAffiliateTracker — wraps affiliate link opens with click-through
 * event logging to the analyticsEvents table before redirecting.
 */
function useAffiliateTracker() {
  let trackEvent: ReturnType<typeof useMutation> | null = null;
  try {
    trackEvent = useMutation(api.mutations.trackAnalyticsEvent);
  } catch {
    // Convex not connected — tracking will be skipped silently
  }

  const lastClickRef = useRef<Record<string, number>>({});

  const trackAndOpen = useCallback(
    (product: StoreProduct, context: {
      synergyScore: number;
      synergyLabel: string;
      rank: number;
      isPersonalized: boolean;
      triggerSource: 'buy_button' | 'hero_buy' | 'alternative_view' | 'daily_protocol';
    }) => {
      const now = Date.now();
      const sessionId = getSessionId();

      // Debounce: prevent duplicate clicks within 2 seconds
      const dedupeKey = `${product.id}:${context.triggerSource}`;
      if (lastClickRef.current[dedupeKey] && now - lastClickRef.current[dedupeKey] < 2000) {
        // Still open the link even if we skip the duplicate log
        if (product.affiliateUrl && !product.affiliateUrl.startsWith('#')) {
          window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
        }
        return;
      }
      lastClickRef.current[dedupeKey] = now;

      // Log the click-through event
      if (trackEvent) {
        trackEvent({
          sessionId,
          eventType: 'affiliate_click',
          eventKey: product.id,
          metadata: JSON.stringify({
            productName: product.name,
            brand: product.brand,
            price: product.price,
            currency: product.currency,
            category: product.category,
            brandTier: product.brandTier,
            affiliateUrl: product.affiliateUrl,
            synergyScore: context.synergyScore,
            synergyLabel: context.synergyLabel,
            rank: context.rank,
            isPersonalized: context.isPersonalized,
            triggerSource: context.triggerSource,
            stockStatus: product.stockStatus,
            timestamp: now,
          }),
        }).catch(() => {
          // Silent fail — never block the redirect
        });
      }

      // Open the affiliate URL in a new tab
      if (product.affiliateUrl && !product.affiliateUrl.startsWith('#')) {
        window.open(product.affiliateUrl, '_blank', 'noopener,noreferrer');
      }
    },
    [trackEvent],
  );

  return { trackAndOpen };
}

/* ══════════════════════════════════════════════════════════════════
   AFFILIATE LINK UTILITIES
   ══════════════════════════════════════════════════════════════════ */

/** Check if an affiliate link appears valid (not a placeholder) */
function isAffiliateLinkValid(product: StoreProduct): boolean {
  return (
    product.affiliateLinkActive &&
    product.affiliateUrl.length > 0 &&
    !product.affiliateUrl.startsWith('#') &&
    product.stockStatus !== 'out_of_stock'
  );
}

/** Find the best alternative product for a given product */
function findAlternative(
  product: StoreProduct,
  allProducts: StoreProduct[],
): StoreProduct | null {
  for (const altId of product.alternativeProductIds) {
    const alt = allProducts.find(p => p.id === altId && isAffiliateLinkValid(p));
    if (alt) return alt;
  }
  const sameCat = allProducts.find(
    p =>
      p.id !== product.id &&
      isAffiliateLinkValid(p) &&
      p.categories.some(c => product.categories.includes(c)),
  );
  return sameCat ?? null;
}

/* ══════════════════════════════════════════════════════════════════
   PERSONALIZATION ENGINE — Determines "Personalized for you" badge
   ══════════════════════════════════════════════════════════════════ */

/**
 * Determines which products should show the "Personalized for you" badge.
 * A product is personalized if:
 * 1. It matches a critical/elevated scored category from today's biometrics
 * 2. OR it matches a direct BioIntelligence intervention
 * 3. OR it's in the user's precision stack with critical/recommended priority
 * 4. AND its synergy score is >= 45 (meaningful match, not noise)
 */
function computePersonalizedSet(
  products: StoreProduct[],
  scoredCategories: ScoredCategory[],
  interventions: Intervention[],
  stackItems: PrecisionItem[],
  synergyScores: Map<string, number>,
): Set<string> {
  const personalizedIds = new Set<string>();

  // Get critical/elevated categories from today's biometrics
  const urgentCategoryIds = new Set(
    scoredCategories
      .filter(c => c.severity === 'critical' || c.severity === 'elevated')
      .map(c => c.category.id),
  );

  // Get active intervention IDs
  const activeInterventionIds = new Set(
    interventions.filter(i => i.confidence >= 60).map(i => i.id),
  );

  // Get critical/recommended stack item IDs
  const priorityStackIds = new Set(
    stackItems
      .filter(si => si.priority === 'critical' || si.priority === 'recommended')
      .map(si => si.id),
  );

  for (const product of products) {
    const score = synergyScores.get(product.id) ?? 0;
    if (score < 45) continue; // Must have meaningful synergy

    // Check category match
    const matchesUrgentCategory = product.categories.some(c => urgentCategoryIds.has(c));

    // Check intervention match
    const matchesIntervention = product.matchesInterventions.some(id => activeInterventionIds.has(id));

    // Check stack match
    const matchesStack = product.matchesStackItems.some(id => priorityStackIds.has(id));

    if (matchesUrgentCategory || matchesIntervention || matchesStack) {
      personalizedIds.add(product.id);
    }
  }

  return personalizedIds;
}

/* ══════════════════════════════════════════════════════════════════
   SYNERGY COMPUTATION
   ══════════════════════════════════════════════════════════════════ */

interface SynergyResult {
  score: number;
  label: string;
  whyHelps: string;
  reasons: string[];
  color: string;
}

function computeSynergy(
  product: StoreProduct,
  interventions: Intervention[],
  stackItems: PrecisionItem[],
  scoredCategories: ScoredCategory[],
  vitals: { hrv: number; sleepScore: number; recovery: number; stress: number; bodyBattery: number },
): SynergyResult {
  // Guard clause — prevent crash if product is undefined
  if (!product) {
    return { score: 0, label: 'BASELINE', whyHelps: '', reasons: [], color: T.textTertiary };
  }

  const reasons: string[] = [];
  let score = 0;
  let whyHelps = product.shortBenefit;

  // 1. Category match from RecommendationEngine
  for (const cat of scoredCategories) {
    if (product.categories.includes(cat.category.id)) {
      const catBoost = Math.min(20, cat.score * 0.25);
      score += catBoost;
      if (cat.severity === 'critical' || cat.severity === 'elevated') {
        const activeRule = cat.activeRules[0];
        if (activeRule) {
          whyHelps = `${activeRule.label} — ${product.shortBenefit.toLowerCase()}`;
        }
        reasons.push(`${cat.category.label}: ${cat.severity} (score ${cat.score})`);
      }
    }
  }

  // 2. Direct intervention match
  const matchedIntervention = interventions.find(i =>
    product.matchesInterventions.includes(i.id),
  );
  if (matchedIntervention) {
    score += Math.min(35, matchedIntervention.confidence * 0.4);
    reasons.push(`AI recommends ${matchedIntervention.name} (${matchedIntervention.confidence}%)`);
  }

  // 3. Precision stack match
  const matchedStack = stackItems.find(si =>
    product.matchesStackItems.includes(si.id),
  );
  if (matchedStack) {
    const bonus = matchedStack.priority === 'critical' ? 20 : matchedStack.priority === 'recommended' ? 12 : 6;
    score += bonus;
    reasons.push(`In your stack: ${matchedStack.name} (${matchedStack.priority})`);
  }

  // 4. Biometric urgency
  if (product.tags.includes('sleep') && vitals.sleepScore < 65) {
    score += 8;
    reasons.push(`Sleep score ${vitals.sleepScore} — support needed`);
  }
  if (product.tags.includes('stress') && vitals.stress > 55) {
    score += 8;
    reasons.push(`Stress ${vitals.stress} — cortisol modulation needed`);
  }
  if (product.tags.includes('energy') && vitals.bodyBattery < 40) {
    score += 8;
    reasons.push(`Energy ${vitals.bodyBattery}% — mitochondrial support urgent`);
  }
  if (product.tags.includes('recovery') && vitals.recovery < 50) {
    score += 8;
    reasons.push(`Recovery ${vitals.recovery}% — repair pathways depleted`);
  }
  if ((product.tags.includes('cardiovascular') || product.tags.includes('neural')) && vitals.hrv < 45) {
    score += 6;
    reasons.push(`HRV ${vitals.hrv}ms — autonomic support needed`);
  }

  // 5. Brand tier
  if (product.brandTier === 'clinical') score += 4;
  else if (product.brandTier === 'research') score += 2;

  // 6. Penalize out-of-stock
  if (product.stockStatus === 'out_of_stock') {
    score = Math.max(0, score - 15);
  }

  score = Math.min(99, Math.max(0, Math.round(score)));

  let label: string;
  let color: string;
  if (score >= 80) { label = 'PERFECT MATCH'; color = T.accent; }
  else if (score >= 65) { label = 'HIGH SYNERGY'; color = T.green; }
  else if (score >= 45) { label = 'GOOD FIT'; color = T.blue; }
  else if (score >= 25) { label = 'MODERATE'; color = T.orange; }
  else { label = 'BASELINE'; color = T.textTertiary; }

  return { score, label, whyHelps, reasons, color };
}

/* ══════════════════════════════════════════════════════════════════
   SYNERGY RING — Circular progress indicator
   ══════════════════════════════════════════════════════════════════ */

function SynergyRing({ score, color, size = 44 }: { score: number; color: string; size?: number }) {
  const r = (size - 6) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.04)" strokeWidth={3} />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={3} strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <span className="absolute font-mono text-[10px] font-bold tabular-nums" style={{ color }}>
        {score}
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   SOURCED BY VIVE BADGE — Trust indicator
   ══════════════════════════════════════════════════════════════════ */

function SourcedByViveBadge() {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md"
      style={{
        background: 'linear-gradient(135deg, rgba(0,255,204,0.06), rgba(0,212,255,0.04))',
        border: '1px solid rgba(0,255,204,0.10)',
      }}
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
        <path
          d="M8 1L10.2 5.5L15 6.2L11.5 9.6L12.4 14.4L8 12.1L3.6 14.4L4.5 9.6L1 6.2L5.8 5.5L8 1Z"
          fill={T.accent}
          fillOpacity={0.8}
        />
      </svg>
      <span
        className="font-mono text-[7px] tracking-[0.14em] uppercase font-bold"
        style={{ color: T.accent }}
      >
        Sourced by Vive
      </span>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PERSONALIZED FOR YOU BADGE — AI-flagged high-priority indicator
   ══════════════════════════════════════════════════════════════════ */

function PersonalizedBadge() {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 px-2 py-[3px] rounded-md"
      style={{
        background: 'linear-gradient(135deg, rgba(175,130,255,0.10), rgba(107,138,255,0.06))',
        border: '1px solid rgba(175,130,255,0.18)',
      }}
    >
      <motion.div
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
          <path
            d="M8 2L9.5 6H13.5L10.2 8.5L11.5 12.5L8 10L4.5 12.5L5.8 8.5L2.5 6H6.5L8 2Z"
            fill={T.purple}
            fillOpacity={0.9}
          />
          <circle cx="8" cy="8" r="7" stroke={T.purple} strokeOpacity={0.3} strokeWidth={0.5} fill="none" />
        </svg>
      </motion.div>
      <span
        className="font-mono text-[7px] tracking-[0.12em] uppercase font-bold"
        style={{ color: T.purple }}
      >
        Personalized for you
      </span>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   STOCK STATUS BADGE
   ══════════════════════════════════════════════════════════════════ */

function StockBadge({ status }: { status: StockStatus }) {
  if (status === 'in_stock') return null;

  const config = {
    low_stock: { label: 'LOW STOCK', color: T.orange, bg: 'rgba(232,151,108,0.08)', border: 'rgba(232,151,108,0.15)' },
    out_of_stock: { label: 'OUT OF STOCK', color: T.red, bg: 'rgba(255,107,107,0.08)', border: 'rgba(255,107,107,0.15)' },
  };
  const c = config[status];

  return (
    <span
      className="font-mono text-[7px] tracking-[0.12em] uppercase font-bold px-1.5 py-[2px] rounded-md"
      style={{ color: c.color, background: c.bg, border: `1px solid ${c.border}` }}
    >
      {c.label}
    </span>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ALTERNATIVE RECOMMENDATION BANNER
   ══════════════════════════════════════════════════════════════════ */

function AlternativeBanner({
  alternative,
  reason,
  onViewAlternative,
}: {
  alternative: StoreProduct;
  reason: 'out_of_stock' | 'link_broken';
  onViewAlternative: () => void;
}) {
  const reasonText = reason === 'out_of_stock'
    ? 'Currently unavailable'
    : 'Link temporarily down';

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      className="mx-4 mb-3 rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, rgba(107,138,255,0.06), rgba(175,130,255,0.04))',
        border: '1px solid rgba(107,138,255,0.12)',
      }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-1.5 mb-1">
          <span className="text-[9px]">🔄</span>
          <span className="font-mono text-[8px] tracking-[0.12em] uppercase font-semibold" style={{ color: T.blue }}>
            {reasonText} · Alternative Recommendation
          </span>
        </div>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm">{alternative.icon}</span>
            <div>
              <p className="font-mono text-[11px] font-semibold" style={{ color: T.text }}>
                {alternative.name}
              </p>
              <p className="font-mono text-[8px]" style={{ color: T.textTertiary }}>
                {alternative.brand} · ${alternative.price.toFixed(2)}
              </p>
            </div>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onViewAlternative(); }}
            className="font-mono text-[9px] tracking-[0.06em] uppercase font-semibold px-3 py-1.5 rounded-lg"
            style={{
              color: T.blue,
              background: 'rgba(107,138,255,0.10)',
              border: '1px solid rgba(107,138,255,0.20)',
              transition: 'all 0.2s',
            }}
          >
            View →
          </button>
        </div>
      </div>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   PRODUCT CARD — High-end concierge aesthetic
   ══════════════════════════════════════════════════════════════════ */

function ConciergeCard({
  product,
  synergy,
  rank,
  isExpanded,
  isPersonalized,
  onToggle,
  alternative,
  onScrollToProduct,
  onBuyClick,
}: {
  product: StoreProduct;
  synergy: SynergyResult;
  rank: number;
  isExpanded: boolean;
  isPersonalized: boolean;
  onToggle: () => void;
  alternative: StoreProduct | null;
  onScrollToProduct: (id: string) => void;
  onBuyClick: (product: StoreProduct, triggerSource: 'buy_button' | 'hero_buy' | 'alternative_view' | 'daily_protocol') => void;
}) {
  const isUnavailable = product.stockStatus === 'out_of_stock';
  const isLinkBroken = !product.affiliateLinkActive;
  const needsAlternative = isUnavailable || isLinkBroken;
  const canBuy = isAffiliateLinkValid(product);

  const tierBadge: Record<string, { label: string; color: string }> = {
    clinical: { label: 'CLINICAL GRADE', color: T.accent },
    premium: { label: 'PREMIUM', color: T.gold },
    research: { label: 'RESEARCH', color: T.purple },
  };
  const badge = tierBadge[product.brandTier];

  const handleBuyClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (canBuy) {
      onBuyClick(product, 'buy_button');
    } else if (alternative) {
      onScrollToProduct(alternative.id);
    }
  };

  return (
    <motion.div
      id={`store-product-${product.id}`}
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.35, delay: rank * 0.04 }}
      onClick={onToggle}
      style={{
        background: T.surface,
        border: `1px solid ${isPersonalized ? T.purple + '30' : isExpanded ? synergy.color + '25' : T.border}`,
        borderRadius: 20,
        cursor: 'pointer',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        overflow: 'hidden',
        transition: 'border-color 0.3s',
        opacity: isUnavailable ? 0.65 : 1,
        position: 'relative',
      }}
    >
      {/* ── Personalized glow effect ── */}
      {isPersonalized && (
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at top left, ${T.purple}06, transparent 60%)`,
            borderRadius: 20,
          }}
        />
      )}

      {/* ── "Why this helps you" Banner ── */}
      <div className="px-4 pt-3 pb-2 relative">
        <div className="flex items-center justify-between mb-0.5">
          <div className="flex items-center gap-1.5">
            <div className="w-1 h-1 rounded-full" style={{ background: synergy.color, boxShadow: `0 0 6px ${synergy.color}60` }} />
            <span className="font-mono text-[8px] tracking-[0.14em] uppercase font-semibold" style={{ color: synergy.color }}>
              Why this helps you
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {isPersonalized && <PersonalizedBadge />}
            <SourcedByViveBadge />
          </div>
        </div>
        <p className="font-mono text-[11px] leading-snug" style={{ color: T.textSecondary }}>
          {synergy.whyHelps}
        </p>
      </div>

      {/* ── Main Card Body ── */}
      <div className="px-4 pb-3">
        <div className="flex items-center gap-3">
          {/* Icon */}
          <div
            className="flex-shrink-0 w-12 h-12 rounded-2xl flex items-center justify-center text-xl relative"
            style={{
              background: `linear-gradient(135deg, ${synergy.color}08, ${synergy.color}03)`,
              border: `1px solid ${synergy.color}12`,
            }}
          >
            {product.icon}
            {isUnavailable && (
              <div className="absolute inset-0 rounded-2xl flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.5)' }}>
                <span className="text-[10px]">⛔</span>
              </div>
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
              <span
                className="font-mono text-[7px] tracking-[0.14em] uppercase px-1.5 py-[2px] rounded-md font-semibold"
                style={{ color: badge.color, background: `${badge.color}0A`, border: `1px solid ${badge.color}15` }}
              >
                {badge.label}
              </span>
              <StockBadge status={product.stockStatus} />
            </div>
            <h3
              className="font-mono text-[13px] font-semibold tracking-[-0.01em] truncate"
              style={{ color: isUnavailable ? T.textSecondary : T.text }}
            >
              {product.name}
            </h3>
            <p className="font-mono text-[9px] mt-0.5" style={{ color: T.textTertiary }}>
              {product.brand} · {product.unit}
            </p>
          </div>

          {/* Synergy Ring + Price */}
          <div className="flex-shrink-0 flex flex-col items-center gap-1">
            <SynergyRing score={synergy.score} color={synergy.color} />
            <span className="font-mono text-[7px] tracking-[0.1em] uppercase font-semibold" style={{ color: synergy.color }}>
              {synergy.label}
            </span>
          </div>
        </div>

        {/* ── Synergy Bar ── */}
        <div className="mt-3">
          <div className="h-[3px] rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)' }}>
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${synergy.score}%` }}
              transition={{ duration: 1, delay: rank * 0.04 + 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{
                background: `linear-gradient(90deg, ${synergy.color}60, ${synergy.color})`,
                boxShadow: `0 0 12px ${synergy.color}30`,
              }}
            />
          </div>
        </div>

        {/* ── Price + Buy Now ── */}
        <div className="flex items-center justify-between mt-3">
          <div className="font-mono text-[16px] font-bold tabular-nums" style={{ color: isUnavailable ? T.textTertiary : T.text }}>
            {isUnavailable ? (
              <span style={{ textDecoration: 'line-through', opacity: 0.5 }}>${product.price.toFixed(2)}</span>
            ) : (
              <>
                ${product.price.toFixed(2)}
                <span className="text-[9px] font-normal ml-1" style={{ color: T.textTertiary }}>
                  {product.currency}
                </span>
              </>
            )}
          </div>

          {canBuy ? (
            <button
              onClick={handleBuyClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-[10px] font-semibold tracking-[0.06em] uppercase"
              style={{
                background: `linear-gradient(135deg, ${synergy.color}18, ${synergy.color}08)`,
                border: `1px solid ${synergy.color}25`,
                color: synergy.color,
                transition: 'all 0.25s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${synergy.color}28, ${synergy.color}15)`;
                e.currentTarget.style.borderColor = `${synergy.color}40`;
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = `linear-gradient(135deg, ${synergy.color}18, ${synergy.color}08)`;
                e.currentTarget.style.borderColor = `${synergy.color}25`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>Buy Now</span>
              <svg width="10" height="10" viewBox="0 0 16 16" fill="none" style={{ opacity: 0.7 }}>
                <path d="M6 3L11 8L6 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <svg width="8" height="8" viewBox="0 0 12 12" fill="none" style={{ opacity: 0.4, marginLeft: -2 }}>
                <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          ) : (
            <button
              onClick={handleBuyClick}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono text-[10px] font-semibold tracking-[0.06em] uppercase"
              style={{
                background: isUnavailable ? 'rgba(255,107,107,0.08)' : 'rgba(107,138,255,0.08)',
                border: `1px solid ${isUnavailable ? 'rgba(255,107,107,0.15)' : 'rgba(107,138,255,0.15)'}`,
                color: isUnavailable ? T.red : T.blue,
                transition: 'all 0.25s',
                cursor: alternative ? 'pointer' : 'not-allowed',
                opacity: alternative ? 1 : 0.5,
              }}
            >
              {alternative ? 'See Alternative →' : 'Unavailable'}
            </button>
          )}
        </div>
      </div>

      {/* ── Alternative Recommendation Banner ── */}
      {needsAlternative && alternative && (
        <AlternativeBanner
          alternative={alternative}
          reason={isUnavailable ? 'out_of_stock' : 'link_broken'}
          onViewAlternative={() => onScrollToProduct(alternative.id)}
        />
      )}

      {/* ── Expanded Details ── */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ overflow: 'hidden' }}
          >
            <div className="px-4 pb-4" style={{ borderTop: `1px solid ${T.border}` }}>
              <div className="pt-3">
                {/* Description */}
                <p className="font-mono text-[10px] leading-relaxed mb-3" style={{ color: T.textSecondary }}>
                  {product.description}
                </p>

                {/* Personalized insight card */}
                {isPersonalized && (
                  <div
                    className="rounded-xl p-3 mb-3"
                    style={{
                      background: 'linear-gradient(135deg, rgba(175,130,255,0.06), rgba(107,138,255,0.03))',
                      border: '1px solid rgba(175,130,255,0.12)',
                    }}
                  >
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <span className="text-[9px]">🎯</span>
                      <span className="font-mono text-[8px] tracking-[0.12em] uppercase font-semibold" style={{ color: T.purple }}>
                        Why this is personalized for you
                      </span>
                    </div>
                    <p className="font-mono text-[10px] leading-relaxed" style={{ color: 'rgba(175,130,255,0.7)' }}>
                      Based on today&apos;s biometric readings, your {synergy.reasons[0]?.split(':')[0]?.toLowerCase() || 'recovery profile'} indicates
                      this product addresses your most urgent optimization need. The AI engine flagged this as a high-priority match.
                    </p>
                  </div>
                )}

                {/* Bioavailability Card */}
                <div
                  className="rounded-xl p-3 mb-3"
                  style={{
                    background: 'rgba(0,255,204,0.03)',
                    border: '1px solid rgba(0,255,204,0.06)',
                  }}
                >
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[9px]">⚡</span>
                    <span className="font-mono text-[8px] tracking-[0.12em] uppercase font-semibold" style={{ color: T.accent }}>
                      Bioavailability
                    </span>
                  </div>
                  <p className="font-mono text-[10px] leading-relaxed" style={{ color: 'rgba(0,255,204,0.6)' }}>
                    {product.bioavailability}
                  </p>
                </div>

                {/* Match Reasons */}
                {synergy.reasons.length > 0 && (
                  <div className="mb-3">
                    <span className="font-mono text-[8px] tracking-[0.12em] uppercase block mb-2 font-semibold" style={{ color: T.textTertiary }}>
                      Match Analysis
                    </span>
                    <div className="flex flex-col gap-1.5">
                      {synergy.reasons.map((reason, i) => (
                        <div key={i} className="flex items-start gap-2">
                          <span className="text-[6px] mt-1 flex-shrink-0" style={{ color: synergy.color }}>●</span>
                          <span className="font-mono text-[9px] leading-relaxed" style={{ color: T.textSecondary }}>
                            {reason}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Affiliate Info */}
                <div
                  className="rounded-xl p-2.5 mb-3 flex items-center justify-between"
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: `1px solid ${T.border}`,
                  }}
                >
                  <div className="flex items-center gap-2">
                    <SourcedByViveBadge />
                    <span className="font-mono text-[8px]" style={{ color: T.textTertiary }}>
                      Verified affiliate partner
                    </span>
                  </div>
                  {canBuy && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: T.green }} />
                      <span className="font-mono text-[7px] tracking-[0.1em] uppercase" style={{ color: T.green }}>
                        LINK ACTIVE
                      </span>
                    </div>
                  )}
                  {!canBuy && (
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: T.red }} />
                      <span className="font-mono text-[7px] tracking-[0.1em] uppercase" style={{ color: T.red }}>
                        {isUnavailable ? 'OUT OF STOCK' : 'LINK DOWN'}
                      </span>
                    </div>
                  )}
                </div>

                {/* Certifications */}
                <div className="flex flex-wrap gap-1.5">
                  {product.certifications.map((cert, i) => (
                    <span
                      key={i}
                      className="font-mono text-[7px] tracking-[0.08em] uppercase px-2 py-1 rounded-lg"
                      style={{
                        color: T.gold,
                        background: 'rgba(255,215,0,0.04)',
                        border: '1px solid rgba(255,215,0,0.08)',
                      }}
                    >
                      ✓ {cert}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   CATEGORY PILLS — Filter by optimization domain
   ══════════════════════════════════════════════════════════════════ */

type FilterMode = 'for-you' | 'all' | 'supplements' | 'peptides' | 'devices';

const FILTERS: { id: FilterMode; label: string; icon: string }[] = [
  { id: 'for-you', label: 'For You', icon: '🧠' },
  { id: 'all', label: 'All', icon: '🔬' },
  { id: 'supplements', label: 'Supplements', icon: '💊' },
  { id: 'peptides', label: 'Peptides', icon: '🧬' },
  { id: 'devices', label: 'Devices', icon: '⌚' },
];

/* ══════════════════════════════════════════════════════════════════
   MAIN COMPONENT — OptimizationStore
   ══════════════════════════════════════════════════════════════════ */

export function OptimizationStore() {
  const { vitals } = useBiometricSync();
  const [filter, setFilter] = useState<FilterMode>('for-you');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [focus] = useState<PrecisionFocus>('recovery');

  // Affiliate click-through tracker
  const { trackAndOpen } = useAffiliateTracker();

  // Get scored categories from RecommendationEngine
  const { activeCategories: scoredCategories, optimizationScore } = useProductRecommendations();

  // Build BioIntelligence report for intervention matching
  const bioInputs: BiometricInputs = useMemo(() => ({
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
  }), [vitals]);

  const report: BioIntelligenceReport = useMemo(() => runBioIntelligence(bioInputs), [bioInputs]);
  const precisionStack = useMemo(() => generatePrecisionStack(null, focus), [focus]);

  // Rank all products
  const rankedProducts = useMemo(() => {
    const v = {
      hrv: vitals.hrv,
      sleepScore: vitals.sleepScore,
      recovery: vitals.recovery,
      stress: vitals.stress,
      bodyBattery: vitals.bodyBattery,
    };
    const scored = PRODUCT_CATALOG
      .filter((p): p is StoreProduct => !!p)
      .map(product => ({
        product,
        synergy: computeSynergy(product, report.interventions, precisionStack.items, scoredCategories, v),
        alternative: (!isAffiliateLinkValid(product))
          ? findAlternative(product, PRODUCT_CATALOG)
          : null,
      }));
    scored.sort((a, b) => b.synergy.score - a.synergy.score);
    return scored;
  }, [report.interventions, precisionStack.items, scoredCategories, vitals]);

  // Compute personalized product set
  const personalizedSet = useMemo(() => {
    const synergyMap = new Map<string, number>();
    for (const { product, synergy } of rankedProducts) {
      synergyMap.set(product.id, synergy.score);
    }
    return computePersonalizedSet(
      PRODUCT_CATALOG,
      scoredCategories,
      report.interventions,
      precisionStack.items,
      synergyMap,
    );
  }, [rankedProducts, scoredCategories, report.interventions, precisionStack.items]);

  // Apply filter
  const filtered = useMemo(() => {
    switch (filter) {
      case 'for-you': return rankedProducts.filter(p => p.synergy.score >= 25);
      case 'supplements': return rankedProducts.filter(p => p.product.category === 'supplement');
      case 'peptides': return rankedProducts.filter(p => p.product.category === 'peptide');
      case 'devices': return rankedProducts.filter(p => p.product.category === 'device');
      default: return rankedProducts;
    }
  }, [rankedProducts, filter]);

  const forYouCount = rankedProducts.filter(p => p.synergy.score >= 25).length;
  const personalizedCount = personalizedSet.size;
  const topMatch = rankedProducts.find(p => isAffiliateLinkValid(p.product));

  const handleToggle = useCallback((id: string) => {
    setExpandedId(prev => prev === id ? null : id);
  }, []);

  const handleScrollToProduct = useCallback((productId: string) => {
    const el = document.getElementById(`store-product-${productId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setExpandedId(productId);
      el.style.boxShadow = `0 0 0 2px ${T.accent}40, 0 0 20px ${T.accent}15`;
      setTimeout(() => { el.style.boxShadow = ''; }, 2000);
    }
  }, []);

  // Tracked buy click handler — logs event then opens affiliate URL
  const handleTrackedBuy = useCallback(
    (product: StoreProduct, triggerSource: 'buy_button' | 'hero_buy' | 'alternative_view' | 'daily_protocol') => {
      const ranked = rankedProducts.find(r => r.product.id === product.id);
      const rank = ranked ? rankedProducts.indexOf(ranked) : -1;
      trackAndOpen(product, {
        synergyScore: ranked?.synergy.score ?? 0,
        synergyLabel: ranked?.synergy.label ?? 'UNKNOWN',
        rank,
        isPersonalized: personalizedSet.has(product.id),
        triggerSource,
      });
    },
    [rankedProducts, personalizedSet, trackAndOpen],
  );

  // Top active categories for the header
  const topCategories = scoredCategories
    .filter(c => c.severity === 'critical' || c.severity === 'elevated')
    .slice(0, 3);

  // Count unavailable
  const unavailableCount = PRODUCT_CATALOG.filter(p => p.stockStatus === 'out_of_stock').length;

  // Empty state — no products to compute synergies for
  if (rankedProducts.length === 0) {
    return (
      <div style={{ fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace" }}>
        <div className="flex flex-col items-center justify-center py-16 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
          <span className="text-3xl mb-3">🔬</span>
          <h3 className="font-mono text-[14px] font-bold mb-1" style={{ color: T.text }}>No optimizations found</h3>
          <p className="font-mono text-[11px] text-center max-w-[280px]" style={{ color: T.textSecondary }}>
            We couldn&apos;t compute synergies for your current biometric profile. Connect a wearable or check back later.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "'SF Mono', 'Fira Code', 'JetBrains Mono', monospace" }}>
      {/* ── Concierge Header ── */}
      <div className="mb-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,255,204,0.08), rgba(0,255,204,0.02))',
                border: '1px solid rgba(0,255,204,0.12)',
              }}
            >
              <span className="text-sm">🛒</span>
            </div>
            <div>
              <h2 className="font-mono text-[14px] font-bold tracking-[-0.02em]" style={{ color: T.text }}>
                Optimization Store
              </h2>
              <p className="font-mono text-[9px] tracking-[0.08em] uppercase" style={{ color: T.textTertiary }}>
                Curated for your biology · {forYouCount} matched
                {personalizedCount > 0 && (
                  <span style={{ color: T.purple }}> · {personalizedCount} personalized</span>
                )}
                {unavailableCount > 0 && (
                  <span style={{ color: T.orange }}> · {unavailableCount} unavailable</span>
                )}
              </p>
            </div>
          </div>

          {/* Optimization Score */}
          <div className="flex flex-col items-center">
            <SynergyRing score={optimizationScore.overall} color={T.accent} size={38} />
            <span className="font-mono text-[7px] tracking-[0.1em] uppercase mt-0.5" style={{ color: T.textTertiary }}>
              BIO OPT
            </span>
          </div>
        </div>

        {/* Active Optimization Domains */}
        {topCategories.length > 0 && (
          <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
            {topCategories.map(cat => (
              <div
                key={cat.category.id}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg flex-shrink-0"
                style={{
                  background: `${cat.category.color}06`,
                  border: `1px solid ${cat.category.color}12`,
                }}
              >
                <span className="text-[10px]">{cat.category.icon}</span>
                <span className="font-mono text-[8px] font-semibold" style={{ color: cat.category.color }}>
                  {cat.category.label}
                </span>
                <span
                  className="font-mono text-[7px] px-1 py-[1px] rounded"
                  style={{
                    color: cat.severity === 'critical' ? T.red : T.orange,
                    background: cat.severity === 'critical' ? 'rgba(255,107,107,0.08)' : 'rgba(232,151,108,0.08)',
                  }}
                >
                  {cat.severity.toUpperCase()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Top Recommendation Hero ── */}
      {topMatch && topMatch.synergy.score >= 45 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="rounded-2xl p-4 mb-4 relative overflow-hidden"
          style={{
            background: `linear-gradient(135deg, ${topMatch.synergy.color}06, transparent 70%)`,
            border: `1px solid ${topMatch.synergy.color}10`,
          }}
        >
          {/* Personalized glow on hero */}
          {personalizedSet.has(topMatch.product.id) && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at top right, ${T.purple}08, transparent 50%)`,
              }}
            />
          )}

          <div className="flex items-center justify-between mb-2 relative">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: topMatch.synergy.color }} />
              <span className="font-mono text-[8px] tracking-[0.14em] uppercase font-bold" style={{ color: topMatch.synergy.color }}>
                #1 AI Recommendation
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {personalizedSet.has(topMatch.product.id) && <PersonalizedBadge />}
              <SourcedByViveBadge />
            </div>
          </div>
          <div className="flex items-center gap-3 relative">
            <span className="text-2xl">{topMatch.product.icon}</span>
            <div className="flex-1">
              <h3 className="font-mono text-[13px] font-bold" style={{ color: T.text }}>
                {topMatch.product.name}
              </h3>
              <p className="font-mono text-[10px] mt-0.5" style={{ color: T.textSecondary }}>
                {topMatch.synergy.whyHelps}
              </p>
            </div>
            <div className="text-right flex flex-col items-end gap-1.5">
              <div>
                <div className="font-mono text-[15px] font-bold" style={{ color: T.text }}>
                  ${topMatch.product.price.toFixed(2)}
                </div>
                <div className="font-mono text-[9px] font-semibold" style={{ color: topMatch.synergy.color }}>
                  {topMatch.synergy.score}% match
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleTrackedBuy(topMatch.product, 'hero_buy');
                }}
                className="font-mono text-[8px] tracking-[0.08em] uppercase font-bold px-3 py-1.5 rounded-lg flex items-center gap-1"
                style={{
                  background: `linear-gradient(135deg, ${topMatch.synergy.color}20, ${topMatch.synergy.color}10)`,
                  border: `1px solid ${topMatch.synergy.color}30`,
                  color: topMatch.synergy.color,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${topMatch.synergy.color}30, ${topMatch.synergy.color}18)`;
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = `linear-gradient(135deg, ${topMatch.synergy.color}20, ${topMatch.synergy.color}10)`;
                  e.currentTarget.style.transform = 'translateY(0)';
                }}
              >
                Buy Now
                <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                  <path d="M3 9L9 3M9 3H4M9 3V8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* ── Filter Pills ── */}
      <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1" style={{ scrollbarWidth: 'none' }}>
        {FILTERS.map(f => {
          const active = filter === f.id;
          const count = f.id === 'for-you' ? forYouCount
            : f.id === 'supplements' ? rankedProducts.filter(p => p.product.category === 'supplement').length
            : f.id === 'peptides' ? rankedProducts.filter(p => p.product.category === 'peptide').length
            : f.id === 'devices' ? rankedProducts.filter(p => p.product.category === 'device').length
            : rankedProducts.length;

          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-mono text-[9px] tracking-[0.06em] uppercase whitespace-nowrap"
              style={{
                background: active ? 'rgba(255,255,255,0.07)' : 'transparent',
                border: `1px solid ${active ? 'rgba(255,255,255,0.12)' : T.border}`,
                color: active ? T.text : T.textTertiary,
                transition: 'all 0.2s',
              }}
            >
              <span className="text-[10px]">{f.icon}</span>
              {f.label}
              <span className="font-mono text-[8px] tabular-nums ml-0.5" style={{ color: active ? T.accent : T.textTertiary }}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Product Cards ── */}
      <div className="flex flex-col gap-3">
        <AnimatePresence mode="popLayout">
          {filtered.map(({ product, synergy, alternative }, i) => (
            <ConciergeCard
              key={product.id}
              product={product}
              synergy={synergy}
              rank={i}
              isExpanded={expandedId === product.id}
              isPersonalized={personalizedSet.has(product.id)}
              onToggle={() => handleToggle(product.id)}
              alternative={alternative}
              onScrollToProduct={handleScrollToProduct}
              onBuyClick={handleTrackedBuy}
            />
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div className="text-center py-10 rounded-2xl" style={{ background: T.surface, border: `1px solid ${T.border}` }}>
            <span className="text-2xl block mb-2">🔍</span>
            <p className="font-mono text-[11px]" style={{ color: T.textSecondary }}>No products match this filter</p>
            <p className="font-mono text-[9px] mt-1" style={{ color: T.textTertiary }}>
              Try &quot;All&quot; to browse the full catalog
            </p>
          </div>
        )}
      </div>

      {/* ── Disclaimer ── */}
      <div className="mt-5 px-3">
        <p className="font-mono text-[7px] leading-relaxed text-center" style={{ color: 'rgba(255,255,255,0.12)' }}>
          Synergy ratings are computed from your real-time biometric data and AI recommendations.
          Products shown are curated for quality. &quot;Sourced by Vive&quot; indicates verified affiliate partnerships.
          &quot;Personalized for you&quot; badges indicate products flagged as high-priority by the AI engine based on today&apos;s biometrics.
          Clicking &quot;Buy Now&quot; opens the vendor site in a new tab. Affiliate links may generate revenue.
          Always consult a healthcare provider before starting new supplements or peptides.
        </p>
      </div>
    </div>
  );
}

export default OptimizationStore;
export { PRODUCT_CATALOG, isAffiliateLinkValid, findAlternative, computePersonalizedSet };
