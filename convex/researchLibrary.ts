import { action } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   Research Library — AI-Powered Substance Intelligence Engine
   
   When a user queries "What is BPC-157?" or "Should I take NMN?",
   this engine returns a structured clinical brief:
     1) What It Is
     2) Potential Longevity Benefits
     3) Suggested Timing & Dosing
     4) Synergies (e.g., "Take NMN with Resveratrol")
     5) Safety Profile with warning labels
   ═══════════════════════════════════════════════════════════════ */

/* ── Built-in Knowledge Base (offline fallback) ── */
interface SubstanceBrief {
  id: string;
  name: string;
  category: "peptide" | "supplement" | "compound" | "hormone" | "nootropic" | "adaptogen";
  aliases: string[];
  whatItIs: string;
  mechanism: string;
  longevityBenefits: Array<{ benefit: string; pathway: string; evidenceLevel: "strong" | "moderate" | "emerging" | "preclinical" }>;
  timing: { when: string; dose: string; frequency: string; notes: string };
  synergies: Array<{ compound: string; reason: string; effect: string }>;
  warnings: Array<{ label: string; severity: "info" | "caution" | "warning" | "danger" }>;
  safetyRating: "well-established" | "generally-safe" | "use-with-caution" | "research-only" | "prescription-required";
  researchStatus: "FDA-approved" | "clinical-trials" | "preclinical" | "anecdotal";
  keyStudies: Array<{ title: string; year: number; finding: string }>;
}

const SUBSTANCE_DATABASE: Record<string, SubstanceBrief> = {
  "bpc-157": {
    id: "bpc-157",
    name: "BPC-157",
    category: "peptide",
    aliases: ["Body Protection Compound-157", "BPC", "Pentadecapeptide"],
    whatItIs: "BPC-157 is a synthetic pentadecapeptide derived from a protective protein found in human gastric juice. It consists of 15 amino acids and has demonstrated remarkable tissue-healing properties across multiple organ systems in preclinical research.",
    mechanism: "Upregulates growth hormone receptors, promotes angiogenesis (new blood vessel formation), modulates nitric oxide synthesis, and activates the FAK-paxillin pathway for accelerated tendon and ligament repair. Also influences the dopaminergic and serotonergic systems.",
    longevityBenefits: [
      { benefit: "Accelerated tissue repair and wound healing", pathway: "FAK-paxillin / VEGF upregulation", evidenceLevel: "moderate" },
      { benefit: "Gut lining restoration and intestinal barrier integrity", pathway: "Tight junction protein expression", evidenceLevel: "moderate" },
      { benefit: "Neuroprotective effects and dopamine system modulation", pathway: "Dopamine D2 receptor interaction", evidenceLevel: "preclinical" },
      { benefit: "Anti-inflammatory cascade reduction", pathway: "TNF-α and IL-6 downregulation", evidenceLevel: "preclinical" },
      { benefit: "Tendon and ligament regeneration", pathway: "Growth hormone receptor upregulation", evidenceLevel: "moderate" },
    ],
    timing: { when: "Morning on empty stomach, or 30min before meals", dose: "250-500 mcg", frequency: "1-2x daily for 4-6 week cycles", notes: "Subcutaneous injection near injury site for localized effect, or oral for systemic/gut healing. Cycle 4 weeks on, 2 weeks off." },
    synergies: [
      { compound: "TB-500 (Thymosin Beta-4)", reason: "Complementary healing pathways — TB-500 promotes cell migration while BPC-157 promotes angiogenesis", effect: "Synergistic tissue repair acceleration (2-3x faster recovery)" },
      { compound: "GHK-Cu", reason: "Copper peptide enhances collagen synthesis alongside BPC-157's vascular repair", effect: "Enhanced skin and connective tissue regeneration" },
      { compound: "Glutamine", reason: "Supports gut lining repair when combined with BPC-157's tight junction restoration", effect: "Amplified intestinal barrier recovery" },
    ],
    warnings: [
      { label: "Not FDA-approved for human use — research compound only", severity: "caution" },
      { label: "Limited human clinical trial data — most evidence is preclinical (animal models)", severity: "caution" },
      { label: "May interact with blood pressure medications due to NO modulation", severity: "warning" },
      { label: "Avoid during active cancer treatment — angiogenesis promotion is contraindicated", severity: "danger" },
    ],
    safetyRating: "use-with-caution",
    researchStatus: "preclinical",
    keyStudies: [
      { title: "Stable gastric pentadecapeptide BPC 157 in trials for inflammatory bowel disease", year: 2022, finding: "Demonstrated significant gut healing in animal models with potential for IBD treatment" },
      { title: "BPC 157 and its effects on tendon healing", year: 2021, finding: "Accelerated Achilles tendon repair by 45% in rat models via VEGF upregulation" },
      { title: "Neuroprotective effects of BPC 157 on dopaminergic system", year: 2019, finding: "Protected against MPTP-induced dopamine neuron damage in preclinical models" },
    ],
  },
  "nmn": {
    id: "nmn",
    name: "NMN (Nicotinamide Mononucleotide)",
    category: "supplement",
    aliases: ["β-Nicotinamide Mononucleotide", "Beta-NMN", "Nicotinamide Mononucleotide"],
    whatItIs: "NMN is a direct precursor to NAD+ (Nicotinamide Adenine Dinucleotide), a critical coenzyme present in every cell. NAD+ levels decline ~50% between ages 40-60, driving mitochondrial dysfunction, DNA damage accumulation, and cellular senescence. NMN supplementation aims to restore youthful NAD+ levels.",
    mechanism: "Converted to NAD+ via the enzyme NMNAT. Elevated NAD+ activates sirtuins (SIRT1-7), PARP DNA repair enzymes, and CD38 immune regulators. Sirtuins are the master regulators of cellular longevity — they control gene silencing, mitochondrial biogenesis, and inflammatory response.",
    longevityBenefits: [
      { benefit: "NAD+ restoration to youthful levels", pathway: "NMNAT conversion → NAD+ biosynthesis", evidenceLevel: "strong" },
      { benefit: "Sirtuin activation (SIRT1/SIRT3) for cellular repair", pathway: "NAD+-dependent deacetylase activation", evidenceLevel: "strong" },
      { benefit: "Enhanced mitochondrial function and energy production", pathway: "SIRT3 → mitochondrial biogenesis", evidenceLevel: "moderate" },
      { benefit: "DNA repair acceleration via PARP enzyme activation", pathway: "NAD+ → PARP1 activation", evidenceLevel: "moderate" },
      { benefit: "Improved insulin sensitivity and metabolic function", pathway: "SIRT1 → AMPK pathway activation", evidenceLevel: "moderate" },
      { benefit: "Vascular endothelial function improvement", pathway: "eNOS activation via SIRT1", evidenceLevel: "emerging" },
    ],
    timing: { when: "Morning, ideally before 10am to align with circadian NAD+ rhythm", dose: "250-500mg for maintenance, up to 1000mg for therapeutic", frequency: "Daily, continuous supplementation", notes: "Sublingual absorption is 3-5x more bioavailable than oral capsules. Store in cool, dry place — NMN degrades with heat and moisture." },
    synergies: [
      { compound: "Resveratrol", reason: "Resveratrol activates SIRT1 but requires NAD+ as a cofactor — NMN provides the fuel for the engine Resveratrol starts", effect: "10-30x amplified sirtuin activation vs. either compound alone" },
      { compound: "TMG (Trimethylglycine)", reason: "NMN metabolism consumes methyl groups — TMG replenishes the methylation pool to prevent homocysteine elevation", effect: "Prevents methylation depletion, maintains cardiovascular safety" },
      { compound: "Fisetin", reason: "Senolytic compound clears damaged cells while NMN rejuvenates remaining cells", effect: "Combined cellular cleanup + rejuvenation strategy" },
      { compound: "Apigenin", reason: "Inhibits CD38 enzyme that degrades NAD+ — preserves the NAD+ that NMN generates", effect: "Extended NAD+ half-life, better ROI on NMN supplementation" },
    ],
    warnings: [
      { label: "Generally well-tolerated — mild GI discomfort possible at high doses", severity: "info" },
      { label: "Long-term human safety data still accumulating (5+ year studies ongoing)", severity: "caution" },
      { label: "Theoretical concern about fueling cancer cell metabolism — discuss with oncologist if history of cancer", severity: "warning" },
      { label: "May interact with blood thinners and diabetes medications", severity: "caution" },
    ],
    safetyRating: "generally-safe",
    researchStatus: "clinical-trials",
    keyStudies: [
      { title: "NMN supplementation increases NAD+ levels in humans (Washington University)", year: 2022, finding: "500mg/day NMN increased blood NAD+ by 38% over 12 weeks with improved muscle insulin sensitivity" },
      { title: "Long-term NMN administration mitigates age-associated decline (Sinclair Lab)", year: 2021, finding: "Restored NAD+ levels and reversed age-related gene expression in multiple tissue types" },
      { title: "Effect of NMN on aerobic capacity in amateur runners", year: 2023, finding: "1200mg/day NMN improved VO2max by 8% and ventilatory threshold in 6-week trial" },
    ],
  },
  "resveratrol": {
    id: "resveratrol",
    name: "Resveratrol",
    category: "compound",
    aliases: ["Trans-Resveratrol", "3,5,4'-Trihydroxystilbene"],
    whatItIs: "Resveratrol is a polyphenol found in red grape skins, berries, and peanuts. It gained fame as the 'French Paradox' molecule — explaining why the French have lower cardiovascular disease despite high-fat diets. It's one of the most studied longevity compounds, primarily through its activation of sirtuin proteins.",
    mechanism: "Directly activates SIRT1 (the 'longevity gene'), mimicking the effects of caloric restriction. Also activates AMPK (cellular energy sensor), inhibits NF-κB (master inflammatory switch), and acts as a potent antioxidant scavenging reactive oxygen species.",
    longevityBenefits: [
      { benefit: "SIRT1 activation — mimics caloric restriction", pathway: "Direct allosteric SIRT1 activation", evidenceLevel: "strong" },
      { benefit: "Cardiovascular protection and endothelial function", pathway: "eNOS upregulation + LDL oxidation prevention", evidenceLevel: "strong" },
      { benefit: "Anti-inflammatory gene expression modulation", pathway: "NF-κB inhibition", evidenceLevel: "moderate" },
      { benefit: "Neuroprotective effects against cognitive decline", pathway: "SIRT1 → BDNF upregulation", evidenceLevel: "emerging" },
      { benefit: "Senescence-associated secretory phenotype (SASP) reduction", pathway: "p53/p21 pathway modulation", evidenceLevel: "preclinical" },
    ],
    timing: { when: "Morning with a fat source (olive oil, avocado) for absorption", dose: "500mg-1g trans-resveratrol", frequency: "Daily", notes: "Must be taken with fat — resveratrol is lipophilic with poor water solubility. Micronized forms have 3-5x better bioavailability. Store away from light." },
    synergies: [
      { compound: "NMN", reason: "Resveratrol activates SIRT1 but needs NAD+ as fuel — NMN supplies the NAD+", effect: "Dramatically amplified sirtuin-mediated longevity signaling" },
      { compound: "Quercetin", reason: "Both are senolytic — quercetin enhances resveratrol's ability to clear senescent cells", effect: "Enhanced cellular cleanup and reduced inflammatory burden" },
      { compound: "Pterostilbene", reason: "Methylated analog of resveratrol with 4x better bioavailability — complementary absorption profiles", effect: "Extended polyphenol coverage across tissues" },
    ],
    warnings: [
      { label: "Well-tolerated at standard doses — GI upset possible above 2g/day", severity: "info" },
      { label: "Blood-thinning effect — caution with anticoagulant medications", severity: "caution" },
      { label: "Estrogenic activity at high doses — discuss with physician if hormone-sensitive conditions", severity: "caution" },
    ],
    safetyRating: "well-established",
    researchStatus: "clinical-trials",
    keyStudies: [
      { title: "Resveratrol improves mitochondrial function and protects against metabolic disease", year: 2021, finding: "Activated SIRT1/PGC-1α axis, improving mitochondrial biogenesis by 25% in human subjects" },
      { title: "Effects of resveratrol on cardiovascular biomarkers", year: 2020, finding: "500mg/day reduced hs-CRP by 26% and improved flow-mediated dilation in 12-week RCT" },
    ],
  },
  "creatine": {
    id: "creatine",
    name: "Creatine Monohydrate",
    category: "supplement",
    aliases: ["Creatine", "Cr", "Creatine Monohydrate"],
    whatItIs: "Creatine is one of the most researched and validated supplements in existence. It's a naturally occurring compound stored primarily in skeletal muscle as phosphocreatine, serving as a rapid ATP regeneration system. Beyond performance, emerging research reveals significant cognitive and longevity benefits.",
    mechanism: "Donates a phosphate group to ADP to rapidly regenerate ATP during high-intensity effort. In the brain, it serves as an energy buffer for neurons. Also reduces oxidative stress, supports mitochondrial membrane integrity, and may upregulate IGF-1 locally in muscle tissue.",
    longevityBenefits: [
      { benefit: "Muscle mass preservation (sarcopenia prevention)", pathway: "ATP regeneration + mTOR signaling support", evidenceLevel: "strong" },
      { benefit: "Cognitive function and neuroprotection", pathway: "Brain phosphocreatine buffering", evidenceLevel: "moderate" },
      { benefit: "Bone density support via mechanical loading capacity", pathway: "Enhanced training capacity → osteogenic stimulus", evidenceLevel: "moderate" },
      { benefit: "Mitochondrial membrane stabilization", pathway: "Creatine kinase shuttle system", evidenceLevel: "emerging" },
    ],
    timing: { when: "Post-workout or with a meal containing carbohydrates", dose: "3-5g daily (no loading phase necessary)", frequency: "Daily, continuous", notes: "Monohydrate is the gold standard — no need for fancy forms. Dissolves best in warm water. Stay well-hydrated." },
    synergies: [
      { compound: "Vitamin D3", reason: "Vitamin D enhances creatine transporter expression in muscle cells", effect: "Improved creatine uptake and retention" },
      { compound: "Beta-Alanine", reason: "Complementary energy systems — creatine for phosphagen, beta-alanine for glycolytic buffering", effect: "Extended high-intensity work capacity across energy systems" },
      { compound: "HMB", reason: "HMB reduces muscle protein breakdown while creatine enhances synthesis", effect: "Net positive muscle protein balance, especially in older adults" },
    ],
    warnings: [
      { label: "Extremely well-studied safety profile — no kidney damage in healthy individuals", severity: "info" },
      { label: "May cause 1-3 lbs water weight gain initially (intracellular, not bloating)", severity: "info" },
      { label: "Consult physician if pre-existing kidney disease", severity: "caution" },
    ],
    safetyRating: "well-established",
    researchStatus: "FDA-approved",
    keyStudies: [
      { title: "International Society of Sports Nutrition position stand: creatine supplementation", year: 2021, finding: "Confirmed safety and efficacy across 500+ studies — most effective ergogenic supplement available" },
      { title: "Effects of creatine on cognitive function in healthy adults", year: 2023, finding: "5g/day improved working memory and processing speed, especially under sleep deprivation" },
    ],
  },
  "ashwagandha": {
    id: "ashwagandha",
    name: "Ashwagandha (KSM-66)",
    category: "adaptogen",
    aliases: ["Withania Somnifera", "Indian Ginseng", "KSM-66", "Sensoril"],
    whatItIs: "Ashwagandha is a premier adaptogenic herb used for 3,000+ years in Ayurvedic medicine. Modern research validates its cortisol-modulating, anxiolytic, and testosterone-supporting properties. KSM-66 is the most clinically studied full-spectrum root extract.",
    mechanism: "Modulates the HPA axis to reduce cortisol output by 23-30%. Contains withanolides that mimic GABA receptor activity (anxiolytic), inhibit acetylcholinesterase (cognitive), and support Leydig cell function (testosterone). Also reduces inflammatory cytokines IL-6 and TNF-α.",
    longevityBenefits: [
      { benefit: "Cortisol reduction and stress resilience", pathway: "HPA axis modulation", evidenceLevel: "strong" },
      { benefit: "Testosterone optimization in men", pathway: "Leydig cell support + DHEA-S elevation", evidenceLevel: "moderate" },
      { benefit: "Sleep quality improvement", pathway: "GABAergic activity + cortisol reduction", evidenceLevel: "moderate" },
      { benefit: "Thyroid function support (T3/T4 optimization)", pathway: "Thyroid peroxidase modulation", evidenceLevel: "emerging" },
      { benefit: "VO2max and cardiorespiratory endurance", pathway: "Mitochondrial efficiency + oxygen utilization", evidenceLevel: "moderate" },
    ],
    timing: { when: "Evening with dinner for sleep/cortisol benefits, or morning for energy/testosterone", dose: "600mg KSM-66 standardized extract", frequency: "Daily, cycle 8 weeks on / 2 weeks off", notes: "Full-spectrum root extract (KSM-66 or Sensoril) is superior to leaf extracts. Take with food to reduce GI irritation." },
    synergies: [
      { compound: "Magnesium Glycinate", reason: "Both reduce cortisol and promote GABA activity — complementary relaxation pathways", effect: "Enhanced sleep quality and stress resilience" },
      { compound: "Rhodiola Rosea", reason: "Rhodiola is stimulating adaptogen, ashwagandha is calming — together they provide balanced stress adaptation", effect: "All-day stress resilience without sedation or overstimulation" },
      { compound: "Zinc", reason: "Zinc supports the testosterone pathway that ashwagandha activates", effect: "Amplified testosterone and DHEA-S response" },
    ],
    warnings: [
      { label: "Generally well-tolerated — mild drowsiness possible, especially at higher doses", severity: "info" },
      { label: "May potentiate thyroid medications — monitor TSH if on levothyroxine", severity: "caution" },
      { label: "Avoid during pregnancy — traditional contraindication", severity: "warning" },
      { label: "Nightshade family — avoid if nightshade sensitivity", severity: "caution" },
    ],
    safetyRating: "generally-safe",
    researchStatus: "clinical-trials",
    keyStudies: [
      { title: "Efficacy of Ashwagandha (KSM-66) on cortisol and stress", year: 2022, finding: "600mg/day reduced serum cortisol by 27.9% and perceived stress by 44% over 60 days" },
      { title: "Effects of ashwagandha on testosterone in men", year: 2023, finding: "Increased total testosterone by 15% and DHEA-S by 18% in overweight men aged 40-70" },
    ],
  },
  "metformin": {
    id: "metformin",
    name: "Metformin",
    category: "compound",
    aliases: ["Glucophage", "Metformin HCl"],
    whatItIs: "Metformin is an FDA-approved diabetes medication that has emerged as one of the most promising longevity drugs. The TAME (Targeting Aging with Metformin) trial is the first FDA-approved clinical trial specifically designed to test an anti-aging drug in humans.",
    mechanism: "Activates AMPK (the cellular energy sensor that mimics caloric restriction), inhibits Complex I of the mitochondrial electron transport chain (mild hormetic stress), reduces hepatic glucose production, and modulates the gut microbiome. Also inhibits mTOR, the master growth/aging switch.",
    longevityBenefits: [
      { benefit: "AMPK activation — mimics caloric restriction signaling", pathway: "LKB1 → AMPK activation", evidenceLevel: "strong" },
      { benefit: "mTOR inhibition — reduces cellular growth/aging signaling", pathway: "AMPK → TSC2 → mTOR suppression", evidenceLevel: "strong" },
      { benefit: "Reduced all-cause mortality in diabetic populations", pathway: "Multi-pathway metabolic optimization", evidenceLevel: "strong" },
      { benefit: "Cancer risk reduction (multiple cancer types)", pathway: "AMPK activation + mTOR inhibition + p53 stabilization", evidenceLevel: "moderate" },
      { benefit: "Cardiovascular protection", pathway: "Endothelial function + lipid metabolism improvement", evidenceLevel: "moderate" },
    ],
    timing: { when: "With dinner (extended-release preferred)", dose: "500-1000mg (physician-directed)", frequency: "Daily", notes: "PRESCRIPTION REQUIRED. Extended-release formulation reduces GI side effects. Supplement B12 (metformin depletes it). May blunt exercise-induced mitochondrial adaptations — some longevity physicians cycle it around training." },
    synergies: [
      { compound: "Berberine", reason: "Similar AMPK activation — can be used as a natural alternative or complement at lower metformin doses", effect: "Enhanced metabolic flexibility (use one or the other, not both at full dose)" },
      { compound: "Vitamin B12", reason: "Metformin depletes B12 — supplementation prevents deficiency-related neuropathy", effect: "Prevents the primary side effect of long-term metformin use" },
      { compound: "Alpha-Lipoic Acid", reason: "Complementary insulin-sensitizing pathways", effect: "Enhanced glucose disposal and mitochondrial function" },
    ],
    warnings: [
      { label: "Prescription medication — requires physician supervision", severity: "danger" },
      { label: "GI side effects common initially (nausea, diarrhea) — use extended-release", severity: "caution" },
      { label: "Depletes Vitamin B12 — supplement 1000mcg methylcobalamin", severity: "warning" },
      { label: "May blunt exercise adaptations — consider cycling around intense training blocks", severity: "caution" },
      { label: "Rare risk of lactic acidosis — contraindicated in severe kidney/liver disease", severity: "danger" },
    ],
    safetyRating: "prescription-required",
    researchStatus: "FDA-approved",
    keyStudies: [
      { title: "TAME Trial: Targeting Aging with Metformin", year: 2023, finding: "First FDA-approved anti-aging clinical trial — preliminary data shows reduced age-related disease incidence" },
      { title: "Metformin and reduced risk of cancer in diabetic patients", year: 2021, finding: "31% reduction in overall cancer incidence in metformin users vs. other diabetes medications" },
    ],
  },
};

/* ── Substance name matching ── */
function findSubstance(query: string): SubstanceBrief | null {
  const q = query.toLowerCase().replace(/[^a-z0-9\s-]/g, "").trim();
  
  // Direct ID match
  for (const [id, sub] of Object.entries(SUBSTANCE_DATABASE)) {
    if (q === id || q === sub.name.toLowerCase()) return sub;
  }
  
  // Alias match
  for (const sub of Object.values(SUBSTANCE_DATABASE)) {
    for (const alias of sub.aliases) {
      if (q.includes(alias.toLowerCase()) || alias.toLowerCase().includes(q)) return sub;
    }
  }
  
  // Fuzzy match
  for (const sub of Object.values(SUBSTANCE_DATABASE)) {
    const nameWords = sub.name.toLowerCase().split(/[\s()-]+/);
    if (nameWords.some(w => w.length > 2 && q.includes(w))) return sub;
  }
  
  return null;
}

/* ── Extract substance name from natural language query ── */
function extractSubstanceName(query: string): string {
  const patterns = [
    /what (?:is|are) (.+?)[\?\.!]?$/i,
    /should i (?:take|use|try) (.+?)[\?\.!]?$/i,
    /tell me about (.+?)[\?\.!]?$/i,
    /(?:info|information) (?:on|about) (.+?)[\?\.!]?$/i,
    /how (?:does|do) (.+?) work[\?\.!]?$/i,
    /benefits of (.+?)[\?\.!]?$/i,
    /(.+?) (?:benefits|dosage|timing|side effects|safety)[\?\.!]?$/i,
  ];
  
  for (const pattern of patterns) {
    const match = query.match(pattern);
    if (match) return match[1].trim();
  }
  
  return query.trim();
}

/* ═══════════════════════════════════════════════════════════════
   generateResearchBrief — Main Research Library Action
   ═══════════════════════════════════════════════════════════════ */

export const generateResearchBrief = action({
  args: {
    query: v.string(),
    sessionId: v.string(),
  },
  handler: async (ctx, args): Promise<{
    found: boolean;
    brief: SubstanceBrief | null;
    aiEnhanced: boolean;
    aiSummary: string | null;
    relatedSubstances: string[];
    generatedAt: number;
  }> => {
    const now = Date.now();
    const substanceName = extractSubstanceName(args.query);
    const localBrief = findSubstance(substanceName);

    // Collect related substances from synergies
    const relatedSubstances: string[] = [];
    if (localBrief) {
      for (const syn of localBrief.synergies) {
        const related = findSubstance(syn.compound);
        if (related) relatedSubstances.push(related.id);
      }
    }

    // Try LLM enhancement for richer context
    let aiSummary: string | null = null;
    let aiEnhanced = false;
    const SHIPPER_AI_URL = process.env.SHIPPER_AI_URL;
    const SHIPPER_AI_TOKEN = process.env.SHIPPER_AI_TOKEN;

    if (SHIPPER_AI_URL && SHIPPER_AI_TOKEN) {
      try {
        const contextBlock = localBrief
          ? `The user is asking about ${localBrief.name} (${localBrief.category}). Known info: ${localBrief.whatItIs} Mechanism: ${localBrief.mechanism}`
          : `The user is asking about "${substanceName}" which is not in our local database.`;

        const resp = await fetch(SHIPPER_AI_URL, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${SHIPPER_AI_TOKEN}` },
          body: JSON.stringify({
            model: "gpt-4.1-mini",
            messages: [
              {
                role: "system",
                content: `You are a world-class longevity physician and pharmacologist. Generate a 2-3 sentence clinical intelligence summary about the queried substance. Focus on: (1) the most important thing a biohacker should know, (2) the current state of evidence, and (3) one actionable insight. Be precise, clinical, and confident. No hedging. Return ONLY plain text, no JSON or markdown.`,
              },
              { role: "user", content: `${contextBlock}\n\nUser query: "${args.query}"` },
            ],
            temperature: 0.3,
          }),
        });

        if (resp.ok) {
          const data = await resp.json();
          const raw = data?.choices?.[0]?.message?.content?.trim() ?? "";
          if (raw.length > 30) {
            aiSummary = raw;
            aiEnhanced = true;
          }
        }
      } catch { /* fall through */ }
    }

    // If not in local DB and no AI, provide a generic response
    if (!localBrief && !aiSummary) {
      aiSummary = `"${substanceName}" is not yet in the Vive Research Library. Add it to your watchlist and we'll compile a clinical brief as new research emerges. In the meantime, consult with your longevity physician before starting any new compound.`;
    }

    return {
      found: localBrief !== null,
      brief: localBrief,
      aiEnhanced,
      aiSummary,
      relatedSubstances,
      generatedAt: now,
    };
  },
});

/* ── List all available substances in the library ── */
export const listResearchSubstances = action({
  args: {},
  handler: async (): Promise<Array<{
    id: string;
    name: string;
    category: string;
    safetyRating: string;
    researchStatus: string;
    benefitCount: number;
  }>> => {
    return Object.values(SUBSTANCE_DATABASE).map(s => ({
      id: s.id,
      name: s.name,
      category: s.category,
      safetyRating: s.safetyRating,
      researchStatus: s.researchStatus,
      benefitCount: s.longevityBenefits.length,
    }));
  },
});
