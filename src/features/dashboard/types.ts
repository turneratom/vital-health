/* ── Dashboard Feature Types ── */

export interface DashboardViewProps {
  onOpenBriefing?: (context?: 'chat' | 'camera' | 'voice') => void;
}

export interface VitalSigns {
  hr: number;
  spo2: number;
  stress: number;
  recovery: number;
}

/** Alias used by useSimulatedVitals hook */
export type VitalsState = VitalSigns;

export interface MetricCardData {
  id: string;
  label: string;
  value: string | number;
  unit: string;
  color: string;
  sparkData: number[];
  icon: string;
}

export interface GoalData {
  id: string;
  label: string;
  current: number;
  target: number;
  color: string;
  icon: string;
}
