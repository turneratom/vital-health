import { query } from "./_generated/server";
import { v } from "convex/values";

/* ═══════════════════════════════════════════════════════════════
   COMPOUND INTELLIGENCE ENGINE
   
   A pharmacological knowledge base that maps every supplement,
   peptide, and nutrient to its:
   • Mechanism of Action (MoA) — molecular pathway description
   • Linked Biomarkers — which lab values it affects
   • Optimal Dose Windows — time-of-day + goal-based dosing
   • Synergies & Contraindications
   
   When a user adds a compound to their protocol, the HUD
   displays rich MoA tooltips and auto-links to relevant
   biomarker tiles in the Bio-Vault.
   ═══════════════════════════════════════════════════════════════ */

export interface CompoundEntry {
  id: string;
  name: string;
  aliases: string[];
  category: "peptide" | "supplement" | "nutrient" | "pharmaceutical" | "adaptogen" | "amino_acid";
  icon: string;
  mechanismOfAction: string;
  molecularTarget: string;
  linkedBiomarkers: Array<{
    key: string;
    label: string;
    effect: "increase" | "decrease" | "modulate" | "protect";
    description: string;
  }>;
  doseWindows: Array<{
    goal: string;
    timing: string;
    dose: string;
    notes: string;
    withFood: boolean;
  }>;
  synergies: Array<{ compound: string; reason: string }>;
  contraindications: string[];
  halfLifeHours: number | null;
  onsetMinutes: number | null;
  evidenceGrade: "A" | "B" | "C" | "D";
}

const COMPOUND_DB: CompoundEntry[] = [
  {
    id: "bpc-157",
    name: "BPC-157",
    aliases: ["bpc157", "body protection compound", "bpc 157"],
    category: "peptide",
    icon: "🧬",
    mechanismOfAction: "Upregulates VEGF and GH receptor expression, promoting angiogenesis and accelerating tendon-to-bone healing. Modulates nitric oxide system and protects endothelial function. Counteracts NSAID-induced gut damage via cytoprotective pathways.",
    molecularTarget: "VEGF / NO system / GH receptors",
    linkedBiomarkers: [
      { key: "crp", label: "C-Reactive Protein", effect: "decrease", description: "Reduces systemic inflammation markers within 7-14 days of administration" },
      { key: "ferritin", label: "Ferritin", effect: "modulate", description: "Supports iron metabolism through improved gut lining integrity" },
    ],
    doseWindows: [
      { goal: "Tissue Repair", timing: "Morning (fasted) + Evening", dose: "250-500mcg subQ 2x/day", notes: "Inject near injury site for localized effect", withFood: false },
      { goal: "Gut Healing", timing: "Morning (fasted)", dose: "500mcg oral (sublingual)", notes: "Hold under tongue 60s before swallowing", withFood: false },
      { goal: "General Recovery", timing: "Pre-sleep", dose: "250mcg subQ", notes: "Synergizes with GH pulse during deep sleep", withFood: false },
    ],
    synergies: [
      { compound: "TB-500", reason: "Complementary repair pathways — BPC-157 (local) + TB-500 (systemic)" },
      { compound: "GHK-Cu", reason: "Enhanced collagen remodeling when combined" },
    ],
    contraindications: ["Active cancer (angiogenesis concern)", "Pregnancy"],
    halfLifeHours: 4,
    onsetMinutes: 30,
    evidenceGrade: "B",
  },
  {
    id: "magnesium-threonate",
    name: "Magnesium Threonate",
    aliases: ["magtein", "magnesium l-threonate", "mg threonate", "magnesium threonate"],
    category: "supplement",
    icon: "🌙",
    mechanismOfAction: "Only magnesium form proven to cross the blood-brain barrier. Increases brain Mg2+ concentration, enhancing synaptic density and NMDA receptor function. Upregulates BDNF expression and promotes neuroplasticity. Activates GABA-A receptors for anxiolytic and sleep-promoting effects.",
    molecularTarget: "NMDA receptors / GABA-A / BDNF pathway",
    linkedBiomarkers: [
      { key: "sleepScore", label: "Sleep Quality", effect: "increase", description: "Improves sleep onset latency and deep sleep percentage via GABA modulation" },
      { key: "hrvCurrent", label: "HRV", effect: "increase", description: "Enhances parasympathetic tone through magnesium-dependent vagal nerve function" },
    ],
    doseWindows: [
      { goal: "Sleep Optimization", timing: "60-90 min before bed", dose: "144mg elemental Mg (2 caps)", notes: "Pair with dim lighting for synergistic melatonin onset", withFood: false },
      { goal: "Cognitive Enhancement", timing: "Morning + Evening split", dose: "72mg AM + 72mg PM", notes: "Steady-state brain Mg levels for sustained neuroplasticity", withFood: true },
      { goal: "Anxiety Reduction", timing: "As needed, up to 3x/day", dose: "72mg per dose", notes: "GABA receptor activation within 30-45 minutes", withFood: false },
    ],
    synergies: [
      { compound: "L-Theanine", reason: "Dual GABA pathway activation for deeper relaxation" },
      { compound: "Apigenin", reason: "Combined anxiolytic effect without sedation hangover" },
    ],
    contraindications: ["Severe renal impairment", "Concurrent use of muscle relaxants"],
    halfLifeHours: 6,
    onsetMinutes: 45,
    evidenceGrade: "A",
  },
  {
    id: "creatine-monohydrate",
    name: "Creatine Monohydrate",
    aliases: ["creatine", "creatine mono"],
    category: "amino_acid",
    icon: "⚡",
    mechanismOfAction: "Replenishes phosphocreatine stores for rapid ATP regeneration during high-intensity efforts. Crosses BBB to serve as cognitive energy buffer. Increases cellular hydration via osmotic water retention. Upregulates IGF-1 locally in muscle tissue and enhances satellite cell proliferation.",
    molecularTarget: "Creatine kinase / ATP-PCr system / IGF-1",
    linkedBiomarkers: [
      { key: "igf1", label: "IGF-1", effect: "increase", description: "Local IGF-1 upregulation in muscle tissue supports hypertrophy signaling" },
      { key: "testosteroneTotal", label: "Testosterone", effect: "modulate", description: "May support DHT conversion; no direct T increase but enhances androgen receptor density" },
    ],
    doseWindows: [
      { goal: "Performance", timing: "Post-workout (within 30 min)", dose: "5g", notes: "Co-ingest with carbs + protein for enhanced uptake via insulin", withFood: true },
      { goal: "Cognitive Reserve", timing: "Morning with breakfast", dose: "3-5g", notes: "Consistent daily dosing saturates brain PCr stores over 4 weeks", withFood: true },
      { goal: "Neuroprotection", timing: "Any time, consistent daily", dose: "5g", notes: "Loading phase optional: 20g/day x 5 days then 5g maintenance", withFood: true },
    ],
    synergies: [
      { compound: "Beta-Alanine", reason: "Complementary energy systems — PCr (immediate) + carnosine (buffering)" },
      { compound: "HMB", reason: "Anti-catabolic + anabolic synergy for lean mass" },
    ],
    contraindications: ["Pre-existing kidney disease (consult nephrologist)"],
    halfLifeHours: null,
    onsetMinutes: null,
    evidenceGrade: "A",
  },
  {
    id: "nmn",
    name: "NMN (Nicotinamide Mononucleotide)",
    aliases: ["nmn", "nicotinamide mononucleotide", "β-nmn"],
    category: "supplement",
    icon: "🧬",
    mechanismOfAction: "Direct NAD+ precursor that bypasses the rate-limiting NAMPT enzyme. Restores cellular NAD+ levels which decline ~50% between ages 40-60. Activates SIRT1-SIRT7 sirtuins for DNA repair, mitochondrial biogenesis, and epigenetic maintenance. Enhances PARP-mediated DNA damage response.",
    molecularTarget: "NAD+ / Sirtuin pathway / PARP enzymes",
    linkedBiomarkers: [
      { key: "hba1c", label: "HbA1c", effect: "decrease", description: "Improved insulin sensitivity via SIRT1-mediated glucose metabolism" },
      { key: "fastingGlucose", label: "Fasting Glucose", effect: "decrease", description: "Enhanced mitochondrial function improves glucose disposal" },
      { key: "crp", label: "C-Reactive Protein", effect: "decrease", description: "NAD+ restoration reduces NF-κB inflammatory signaling" },
    ],
    doseWindows: [
      { goal: "Longevity", timing: "Morning (fasted)", dose: "500-1000mg sublingual", notes: "Sublingual bypasses first-pass metabolism for 3-4x bioavailability", withFood: false },
      { goal: "Athletic Recovery", timing: "Post-workout", dose: "500mg", notes: "Supports NAD+ depletion from intense exercise", withFood: false },
      { goal: "Metabolic Health", timing: "Morning with breakfast", dose: "250-500mg", notes: "Start low, titrate up over 2 weeks", withFood: true },
    ],
    synergies: [
      { compound: "Resveratrol", reason: "SIRT1 activator + NAD+ substrate = amplified sirtuin cascade" },
      { compound: "TMG (Betaine)", reason: "Methyl donor to offset NMN methylation demand" },
    ],
    contraindications: ["Active cancer (NAD+ may fuel tumor metabolism)", "Concurrent chemotherapy"],
    halfLifeHours: 0.5,
    onsetMinutes: 15,
    evidenceGrade: "B",
  },
  {
    id: "omega-3",
    name: "Omega-3 (EPA/DHA)",
    aliases: ["omega3", "fish oil", "epa", "dha", "omega-3", "epa/dha"],
    category: "nutrient",
    icon: "🐟",
    mechanismOfAction: "EPA competitively inhibits arachidonic acid in COX/LOX pathways, producing anti-inflammatory resolvins and protectins. DHA integrates into neuronal membranes, increasing fluidity and receptor sensitivity. Both activate PPARγ for metabolic gene expression and reduce triglyceride synthesis in hepatocytes.",
    molecularTarget: "COX-2 / LOX / PPARγ / Cell membrane phospholipids",
    linkedBiomarkers: [
      { key: "crp", label: "C-Reactive Protein", effect: "decrease", description: "EPA-derived resolvins actively resolve inflammation, lowering CRP 20-35%" },
      { key: "hrvCurrent", label: "HRV", effect: "increase", description: "DHA membrane integration improves cardiac autonomic function" },
    ],
    doseWindows: [
      { goal: "Anti-Inflammation", timing: "With largest meal", dose: "2-4g EPA-dominant", notes: "EPA:DHA ratio of 2:1 or higher for inflammation focus", withFood: true },
      { goal: "Brain Health", timing: "Morning with fat-containing meal", dose: "2g DHA-dominant", notes: "DHA:EPA ratio of 2:1 for cognitive focus", withFood: true },
      { goal: "Cardiovascular", timing: "Split AM/PM with meals", dose: "1g EPA + 1g DHA", notes: "Triglyceride reduction requires 2g+ combined EPA/DHA", withFood: true },
    ],
    synergies: [
      { compound: "Vitamin D3", reason: "Fat-soluble vitamin absorption enhanced; both reduce inflammation" },
      { compound: "Astaxanthin", reason: "Prevents omega-3 oxidation + additive anti-inflammatory effect" },
    ],
    contraindications: ["Blood thinners (warfarin) — monitor INR", "Pre-surgery (stop 7 days before)"],
    halfLifeHours: 48,
    onsetMinutes: null,
    evidenceGrade: "A",
  },
  {
    id: "vitamin-d3",
    name: "Vitamin D3",
    aliases: ["vitamin d", "cholecalciferol", "d3", "vitamin d3"],
    category: "supplement",
    icon: "☀️",
    mechanismOfAction: "Secosteroid hormone that binds VDR (Vitamin D Receptor) in virtually every cell. Modulates 200+ genes involved in immune function, calcium homeostasis, and cell differentiation. Upregulates cathelicidin antimicrobial peptide. Suppresses Th17 inflammatory response while promoting Treg tolerance.",
    molecularTarget: "VDR nuclear receptor / Calcium channels / Immune T-cells",
    linkedBiomarkers: [
      { key: "vitaminD", label: "Vitamin D", effect: "increase", description: "Direct supplementation — target 50-80 ng/mL for optimal immune and bone function" },
      { key: "crp", label: "C-Reactive Protein", effect: "decrease", description: "Immune modulation reduces chronic low-grade inflammation" },
      { key: "testosteroneTotal", label: "Testosterone", effect: "increase", description: "VDR expression in Leydig cells; correcting deficiency restores T production" },
    ],
    doseWindows: [
      { goal: "Immune Optimization", timing: "Morning with fat-containing meal", dose: "5000 IU + K2 MK-7 200mcg", notes: "K2 directs calcium to bones, away from arteries", withFood: true },
      { goal: "Testosterone Support", timing: "Morning", dose: "5000-10000 IU", notes: "Only effective if currently deficient (<40 ng/mL)", withFood: true },
      { goal: "Maintenance", timing: "Any time with fat", dose: "2000-4000 IU", notes: "Test 25(OH)D levels every 3 months to titrate", withFood: true },
    ],
    synergies: [
      { compound: "Vitamin K2", reason: "Essential co-factor — prevents hypercalcemia and arterial calcification" },
      { compound: "Magnesium", reason: "Required for D3 → active calcitriol conversion" },
    ],
    contraindications: ["Hypercalcemia", "Granulomatous diseases (sarcoidosis)"],
    halfLifeHours: 360,
    onsetMinutes: null,
    evidenceGrade: "A",
  },
  {
    id: "ashwagandha",
    name: "Ashwagandha (KSM-66)",
    aliases: ["ashwagandha", "ksm-66", "withania somnifera", "ksm66"],
    category: "adaptogen",
    icon: "🌿",
    mechanismOfAction: "Withanolides modulate HPA axis by reducing cortisol output 25-30%. Enhances GABAergic signaling for anxiolytic effects. Inhibits acetylcholinesterase, increasing acetylcholine for cognitive function. Supports thyroid hormone (T3/T4) production and reduces oxidative stress via SOD upregulation.",
    molecularTarget: "HPA axis / GABA receptors / AChE / Thyroid",
    linkedBiomarkers: [
      { key: "testosteroneTotal", label: "Testosterone", effect: "increase", description: "Cortisol reduction frees DHEA for testosterone synthesis; 15-17% increase in studies" },
      { key: "hrvCurrent", label: "HRV", effect: "increase", description: "HPA axis normalization improves autonomic balance and vagal tone" },
      { key: "sleepScore", label: "Sleep Quality", effect: "increase", description: "GABAergic activity promotes sleep onset and deep sleep architecture" },
    ],
    doseWindows: [
      { goal: "Cortisol Reduction", timing: "Morning + Evening", dose: "300mg KSM-66 2x/day", notes: "Full-spectrum root extract standardized to 5% withanolides", withFood: true },
      { goal: "Sleep Support", timing: "60 min before bed", dose: "600mg KSM-66", notes: "Single evening dose for sleep-focused protocol", withFood: true },
      { goal: "Testosterone Optimization", timing: "Morning with breakfast", dose: "600mg KSM-66", notes: "Cycle 8 weeks on, 2 weeks off to prevent receptor downregulation", withFood: true },
    ],
    synergies: [
      { compound: "Tongkat Ali", reason: "Complementary T-support: cortisol reduction (ashwagandha) + SHBG reduction (tongkat)" },
      { compound: "Magnesium Threonate", reason: "Dual anxiolytic pathways for comprehensive stress management" },
    ],
    contraindications: ["Hashimoto's thyroiditis (may overstimulate thyroid)", "Autoimmune conditions", "Pregnancy"],
    halfLifeHours: 6,
    onsetMinutes: 60,
    evidenceGrade: "A",
  },
  {
    id: "tongkat-ali",
    name: "Tongkat Ali",
    aliases: ["tongkat ali", "eurycoma longifolia", "longjack"],
    category: "adaptogen",
    icon: "🌿",
    mechanismOfAction: "Eurypeptides reduce SHBG binding, increasing free testosterone bioavailability. Quassinoids inhibit aromatase (CYP19), reducing estrogen conversion. Activates hypothalamic GnRH pulse for LH/FSH stimulation. Reduces cortisol via HPA axis modulation.",
    molecularTarget: "SHBG / Aromatase (CYP19) / GnRH-LH axis",
    linkedBiomarkers: [
      { key: "testosteroneTotal", label: "Testosterone", effect: "increase", description: "Reduces SHBG binding, increasing free T by 20-30% in deficient males" },
      { key: "testosteroneFree", label: "Free Testosterone", effect: "increase", description: "Direct SHBG reduction liberates bound testosterone" },
    ],
    doseWindows: [
      { goal: "Testosterone Support", timing: "Morning (fasted or with light meal)", dose: "400mg standardized extract", notes: "200:1 extract ratio; cycle 5 days on, 2 days off", withFood: false },
      { goal: "Athletic Performance", timing: "60 min pre-workout", dose: "200-400mg", notes: "Acute cortisol blunting during training stress", withFood: false },
    ],
    synergies: [
      { compound: "Ashwagandha", reason: "Complementary T-support pathways — SHBG + cortisol reduction" },
      { compound: "Fadogia Agrestis", reason: "LH stimulation (fadogia) + SHBG reduction (tongkat) for comprehensive T optimization" },
    ],
    contraindications: ["Hormone-sensitive cancers", "Concurrent TRT (redundant mechanism)"],
    halfLifeHours: 8,
    onsetMinutes: 45,
    evidenceGrade: "B",
  },
  {
    id: "berberine",
    name: "Berberine",
    aliases: ["berberine", "berberine hcl"],
    category: "supplement",
    icon: "📊",
    mechanismOfAction: "Activates AMPK (AMP-activated protein kinase), the master metabolic switch. Mimics metformin's mechanism for glucose disposal and insulin sensitization. Inhibits PCSK9 for LDL cholesterol reduction. Modulates gut microbiome composition, increasing Akkermansia muciniphila.",
    molecularTarget: "AMPK / PCSK9 / Gut microbiome",
    linkedBiomarkers: [
      { key: "hba1c", label: "HbA1c", effect: "decrease", description: "AMPK activation improves glucose disposal comparable to metformin (-0.5% HbA1c)" },
      { key: "fastingGlucose", label: "Fasting Glucose", effect: "decrease", description: "Enhanced GLUT4 translocation for improved glucose uptake" },
      { key: "crp", label: "C-Reactive Protein", effect: "decrease", description: "AMPK activation suppresses NF-κB inflammatory cascade" },
    ],
    doseWindows: [
      { goal: "Glucose Management", timing: "With meals (2-3x/day)", dose: "500mg per meal", notes: "Take immediately before or with carb-containing meals", withFood: true },
      { goal: "Metabolic Health", timing: "Morning + Evening with meals", dose: "500mg 2x/day", notes: "Start with 500mg/day, titrate up over 2 weeks", withFood: true },
    ],
    synergies: [
      { compound: "Alpha-Lipoic Acid", reason: "Dual AMPK activation for enhanced insulin sensitivity" },
      { compound: "Chromium", reason: "Complementary glucose disposal mechanisms" },
    ],
    contraindications: ["Concurrent metformin (additive hypoglycemia risk)", "Pregnancy", "CYP3A4 drug interactions"],
    halfLifeHours: 5,
    onsetMinutes: 60,
    evidenceGrade: "A",
  },
  {
    id: "tb-500",
    name: "TB-500 (Thymosin Beta-4)",
    aliases: ["tb500", "tb-500", "thymosin beta 4"],
    category: "peptide",
    icon: "🔬",
    mechanismOfAction: "Sequesters G-actin monomers to promote cell migration and tissue repair at injury sites. Upregulates Tβ4 for systemic anti-inflammatory and anti-fibrotic effects. Promotes hair follicle stem cell migration and cardiac tissue regeneration. Enhances angiogenesis through VEGF-independent pathways.",
    molecularTarget: "G-actin / Tβ4 / Cell migration pathways",
    linkedBiomarkers: [
      { key: "crp", label: "C-Reactive Protein", effect: "decrease", description: "Systemic anti-inflammatory effect reduces CRP over 4-6 week cycle" },
    ],
    doseWindows: [
      { goal: "Systemic Repair", timing: "2x/week", dose: "2-2.5mg subQ", notes: "Loading: 2.5mg 2x/week for 4 weeks, then 2.5mg 1x/week maintenance", withFood: false },
      { goal: "Acute Injury", timing: "Daily for 2 weeks", dose: "2mg subQ near injury", notes: "Combine with BPC-157 for local + systemic repair synergy", withFood: false },
    ],
    synergies: [
      { compound: "BPC-157", reason: "Gold standard repair stack — local (BPC) + systemic (TB-500) healing" },
    ],
    contraindications: ["Active cancer", "Pregnancy"],
    halfLifeHours: 12,
    onsetMinutes: null,
    evidenceGrade: "C",
  },
];

/* ── Fuzzy name matching ── */
function matchCompound(name: string): CompoundEntry | null {
  const lower = name.toLowerCase().trim();
  // Direct ID match
  const byId = COMPOUND_DB.find(c => c.id === lower);
  if (byId) return byId;
  // Exact name match
  const byName = COMPOUND_DB.find(c => c.name.toLowerCase() === lower);
  if (byName) return byName;
  // Alias match
  const byAlias = COMPOUND_DB.find(c => c.aliases.some(a => lower.includes(a) || a.includes(lower)));
  if (byAlias) return byAlias;
  // Partial name match
  const byPartial = COMPOUND_DB.find(c =>
    lower.includes(c.name.toLowerCase().split(' ')[0]) ||
    c.name.toLowerCase().split(' ')[0].length > 3 && lower.includes(c.name.toLowerCase().split(' ')[0])
  );
  return byPartial || null;
}

/* ═══════════════════════════════════════════════════════════════
   getCompoundIntelligence — Returns MoA, biomarker links,
   and dose windows for a specific compound name.
   ═══════════════════════════════════════════════════════════════ */
export const getCompoundIntelligence = query({
  args: { compoundName: v.string() },
  handler: async (_ctx, args) => {
    const compound = matchCompound(args.compoundName);
    if (!compound) return null;
    return compound;
  },
});

/* ═══════════════════════════════════════════════════════════════
   getActiveCompoundIntelligence — Returns intelligence for ALL
   compounds in the user's active protocol list.
   ═══════════════════════════════════════════════════════════════ */
export const getActiveCompoundIntelligence = query({
  args: { sessionId: v.string() },
  handler: async (ctx, args) => {
    const protocols = await ctx.db
      .query("protocols")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .collect();

    const activeProtocols = protocols.filter(p => p.isActive);
    const results: Array<{
      protocolId: string;
      protocolName: string;
      protocolIcon: string;
      compound: CompoundEntry;
    }> = [];

    for (const protocol of activeProtocols) {
      const compound = matchCompound(protocol.name);
      if (compound) {
        results.push({
          protocolId: protocol._id,
          protocolName: protocol.name,
          protocolIcon: protocol.icon,
          compound,
        });
      }
    }

    return results;
  },
});

/* ═══════════════════════════════════════════════════════════════
   getDoseWindowSuggestion — AI-powered dose window based on
   user's goals and current biomarker state.
   ═══════════════════════════════════════════════════════════════ */
export const getDoseWindowSuggestion = query({
  args: {
    sessionId: v.string(),
    compoundName: v.string(),
  },
  handler: async (ctx, args) => {
    const compound = matchCompound(args.compoundName);
    if (!compound) return null;

    // Get user's biomarker data to personalize suggestion
    const bioVault = await ctx.db
      .query("bioVault")
      .withIndex("by_sessionId", (q) => q.eq("sessionId", args.sessionId))
      .first();

    // Determine which goal is most relevant based on biomarkers
    let suggestedGoal = compound.doseWindows[0]?.goal || "General";
    let reason = "Default recommendation based on most common use case.";

    if (bioVault && compound.linkedBiomarkers.length > 0) {
      for (const link of compound.linkedBiomarkers) {
        const val = bioVault[link.key as keyof typeof bioVault];
        if (val == null || typeof val !== "number") continue;

        const ranges: Record<string, { min: number; max: number }> = {
          crp: { min: 0, max: 1.0 },
          hba1c: { min: 4.0, max: 5.4 },
          vitaminD: { min: 40, max: 80 },
          testosteroneTotal: { min: 400, max: 900 },
          ferritin: { min: 40, max: 200 },
          fastingGlucose: { min: 70, max: 95 },
          sleepScore: { min: 70, max: 100 },
          hrvCurrent: { min: 40, max: 120 },
          igf1: { min: 100, max: 300 },
        };

        const range = ranges[link.key];
        if (!range) continue;

        const isLow = val < range.min;
        const isHigh = val > range.max;

        if (isLow || isHigh) {
          // Find the dose window that best addresses this biomarker
          const relevantWindow = compound.doseWindows.find(dw => {
            const goalLower = dw.goal.toLowerCase();
            if (link.key === "sleepScore" && goalLower.includes("sleep")) return true;
            if (link.key === "hrvCurrent" && (goalLower.includes("recovery") || goalLower.includes("stress"))) return true;
            if (link.key === "testosteroneTotal" && goalLower.includes("testosterone")) return true;
            if (link.key === "crp" && goalLower.includes("inflam")) return true;
            if (link.key === "hba1c" && goalLower.includes("glucose")) return true;
            if (link.key === "fastingGlucose" && goalLower.includes("metabolic")) return true;
            return false;
          });

          if (relevantWindow) {
            suggestedGoal = relevantWindow.goal;
            reason = `Your ${link.label} is ${isLow ? "below" : "above"} optimal at ${val}${link.key === "hba1c" ? "%" : ""}. This dose window targets ${link.effect === "increase" ? "elevation" : link.effect === "decrease" ? "reduction" : "modulation"} of ${link.label}.`;
            break;
          }
        }
      }
    }

    const suggestedWindow = compound.doseWindows.find(dw => dw.goal === suggestedGoal) || compound.doseWindows[0];

    return {
      compound: compound.name,
      suggestedGoal,
      reason,
      window: suggestedWindow,
      allWindows: compound.doseWindows,
      linkedBiomarkers: compound.linkedBiomarkers,
      evidenceGrade: compound.evidenceGrade,
    };
  },
});
