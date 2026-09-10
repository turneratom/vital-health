export type Chapter = 'dietary' | 'physical' | 'risks';

export interface ChapterDef {
  id: Chapter;
  number: number;
  title: string;
  subtitle: string;
  icon: string;
  accentColor: string;
}

export interface Insight {
  chapter: Chapter;
  humanTitle: string;
  tagline: string;
  icon: string;
  accentColor: string;
  whatItMeans: string;
  yourResult: string;
  resultBadge: string;
  actionItems: string[];
  confidence: number;
}
