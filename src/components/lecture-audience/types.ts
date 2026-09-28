import type { BiologyView } from '@/lib/teaching-biology';

/** Public projection data only. Never pass a lecture document or presenter notes. */
export type AudienceContent = {
  lectureTitle: string;
  stepTitle: string;
  question: string;
  answer: string | null;
  biology?: BiologyView;
  modelCaption?: string | null;
  vectorLegend?: boolean;
  separation?: number | null;
};

export type AudienceStatus = 'closed' | 'opening' | 'live' | 'error';
