/**
 * Elite Tier Hero Background Assets
 * High-fidelity 3D medical-tech renders for the Elite dashboard experience
 */

/* ── V1 Backgrounds (original set) ── */
export const ELITE_HERO_BACKGROUNDS_V1 = {
  dnaHelix: "https://cdn.shipper.now/image/users/cmmf95q8r0018jx047rpoe2qv/1775319394627-olwwo8vnsb-elite-hero-dna-helix.webp",
  cellStructure: "https://cdn.shipper.now/image/users/cmmf95q8r0018jx047rpoe2qv/1775319394416-e630vwwge69-elite-hero-cell-structure.webp",
  neuralMolecular: "https://cdn.shipper.now/image/users/cmmf95q8r0018jx047rpoe2qv/1775319395396-16ebbq2n2ay-elite-hero-neural-molecular.webp",
} as const;

/* ── V2 Backgrounds (minimalist obsidian + neon teal) ── */
export const ELITE_HERO_BACKGROUNDS = {
  dnaHelix: "https://cdn.shipper.now/image/users/cmmf95q8r0018jx047rpoe2qv/1775322745913-vhbrq6tbq7r-elite-dna-helix-v2.webp",
  mitochondria: "https://cdn.shipper.now/image/users/cmmf95q8r0018jx047rpoe2qv/1775322745257-z7qukyf8el-elite-mitochondria-v2.webp",
  dnaBasePairs: "https://cdn.shipper.now/image/users/cmmf95q8r0018jx047rpoe2qv/1775322747681-s68xxwapv3-elite-dna-basepairs-v2.webp",
} as const;

export const ELITE_BACKGROUNDS_LIST = [
  {
    id: "dna-helix" as const,
    url: ELITE_HERO_BACKGROUNDS.dnaHelix,
    label: "DNA Helix",
    description: "Bioluminescent double helix with neon teal glow on obsidian",
  },
  {
    id: "mitochondria" as const,
    url: ELITE_HERO_BACKGROUNDS.mitochondria,
    label: "Mitochondria",
    description: "Cellular mitochondria cross-section with cyan cristae lighting",
  },
  {
    id: "dna-base-pairs" as const,
    url: ELITE_HERO_BACKGROUNDS.dnaBasePairs,
    label: "DNA Base Pairs",
    description: "Nucleotide base pairs spiral with teal phosphorescent bonds",
  },
] as const;

export type EliteBackgroundId = "dna-helix" | "mitochondria" | "dna-base-pairs";
