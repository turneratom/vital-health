import { useState, useEffect } from 'react';

export type UserStyle = 'core' | 'elite';
export type MissionProfile = 'core' | 'elite' | 'hard-truth';

/* ── Macro Profile — derived from mission profile selection ── */
export interface MacroProfile {
  label: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  strategy: string;
  mealStyle: string;
  missionGreeting: string;
  fuelLabel: string;
  workoutLabel: string;
  supplementLabel: string;
  fuelDetail: string;
  workoutDetail: string;
  supplementDetail: string;
}

/* ── Macro profiles per mission ── */
const MACRO_PROFILES: Record<MissionProfile, MacroProfile> = {
  core: {
    label: 'Anti-Inflammatory / Maintenance',
    calories: 2000,
    protein: 120,
    carbs: 220,
    fat: 70,
    strategy: 'maintenance',
    mealStyle: 'Anti-inflammatory whole foods with balanced macros',
    missionGreeting: 'Steady state. Your protocols are calibrated for sustainable energy and joint health.',
    fuelLabel: 'Nourish Protocol',
    workoutLabel: 'Mobility Flow',
    supplementLabel: 'Recovery Stack',
    fuelDetail: 'Anti-inflammatory meal \u00b7 omega-3 + turmeric focus',
    workoutDetail: 'Functional movement \u00b7 joint mobility + Zone 2',
    supplementDetail: 'Vitamin D3 + K2 \u00b7 Fish Oil \u00b7 Magnesium Glycinate',
  },
  elite: {
    label: 'High Protein / Hypertrophy Surplus',
    calories: 2800,
    protein: 200,
    carbs: 300,
    fat: 85,
    strategy: 'surplus',
    mealStyle: 'High-protein surplus with strategic carb timing',
    missionGreeting: 'Growth phase active. Surplus fueling and progressive overload are locked in.',
    fuelLabel: 'Surplus Protocol',
    workoutLabel: 'Hypertrophy Block',
    supplementLabel: 'Anabolic Stack',
    fuelDetail: 'High-protein surplus \u00b7 200g+ target \u00b7 peri-workout carbs',
    workoutDetail: 'Progressive overload \u00b7 compound lifts + VO2 Max intervals',
    supplementDetail: 'Creatine Mono \u00b7 EAAs \u00b7 Ashwagandha \u00b7 Zinc',
  },
  'hard-truth': {
    label: 'Rapid Recomposition / Aggressive Cut',
    calories: 1800,
    protein: 220,
    carbs: 130,
    fat: 55,
    strategy: 'recomp',
    mealStyle: 'Aggressive protein-sparing with carb cycling',
    missionGreeting: 'Hard Truth protocol engaged. No margin for error. Every gram counts.',
    fuelLabel: 'Recomp Protocol',
    workoutLabel: 'Output Maximizer',
    supplementLabel: 'Thermogenic Stack',
    fuelDetail: 'Protein-sparing modified fast \u00b7 220g protein \u00b7 carb cycling',
    workoutDetail: 'High-intensity circuits \u00b7 compound supersets + HIIT finishers',
    supplementDetail: 'Caffeine \u00b7 L-Carnitine \u00b7 Green Tea Extract \u00b7 Electrolytes',
  },
};

export function getMacroProfile(profile: MissionProfile): MacroProfile {
  return MACRO_PROFILES[profile];
}

export function getAllMacroProfiles(): Record<MissionProfile, MacroProfile> {
  return MACRO_PROFILES;
}

// ── Global state for userStyle ──
let globalUserStyle: UserStyle = (() => {
  if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem('vive-user-style');
    if (stored === 'core' || stored === 'elite') return stored;
  }
  return 'elite';
})();

// ── Global state for mission profile ──
let globalMissionProfile: MissionProfile = (() => {
  if (typeof window !== 'undefined') {
    const stored = window.sessionStorage.getItem('vive-mission-profile');
    if (stored === 'core' || stored === 'elite' || stored === 'hard-truth') return stored;
  }
  return 'core';
})();

const styleListeners = new Set<(style: UserStyle) => void>();
const profileListeners = new Set<(profile: MissionProfile) => void>();

export function setGlobalUserStyle(style: UserStyle) {
  globalUserStyle = style;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('vive-user-style', style);
  }
  styleListeners.forEach((fn) => fn(style));
}

export function getGlobalUserStyle(): UserStyle {
  return globalUserStyle;
}

export function setGlobalMissionProfile(profile: MissionProfile) {
  globalMissionProfile = profile;
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('vive-mission-profile', profile);
  }
  profileListeners.forEach((fn) => fn(profile));
}

export function getGlobalMissionProfile(): MissionProfile {
  return globalMissionProfile;
}

export function useUserStyle(): UserStyle {
  const [style, setStyle] = useState<UserStyle>(globalUserStyle);

  useEffect(() => {
    const handler = (s: UserStyle) => setStyle(s);
    styleListeners.add(handler);
    setStyle(globalUserStyle);
    return () => { styleListeners.delete(handler); };
  }, []);

  return style;
}

export function useMissionProfile(): MissionProfile {
  const [profile, setProfile] = useState<MissionProfile>(globalMissionProfile);

  useEffect(() => {
    const handler = (p: MissionProfile) => setProfile(p);
    profileListeners.add(handler);
    setProfile(globalMissionProfile);
    return () => { profileListeners.delete(handler); };
  }, []);

  return profile;
}

export function useMacroProfile(): MacroProfile {
  const profile = useMissionProfile();
  return getMacroProfile(profile);
}

export function hasCompletedOnboarding(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem('vive-onboarding-complete') === 'true';
}

export function setOnboardingComplete() {
  if (typeof window !== 'undefined') {
    window.sessionStorage.setItem('vive-onboarding-complete', 'true');
  }
}
