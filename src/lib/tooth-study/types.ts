export const TOOTH_STUDY_VIEWS = [
  'buccal',
  'mesial',
  'lingual',
  'distal',
  'occlusal',
  'apical',
] as const;

export type ToothStudyView = (typeof TOOTH_STUDY_VIEWS)[number];

export type ToothStudyAction =
  | { kind: 'tooth-study'; action: 'open'; tooth: string; view?: ToothStudyView }
  | { kind: 'tooth-study'; action: 'view'; view: ToothStudyView }
  | { kind: 'tooth-study'; action: 'explain' }
  | { kind: 'tooth-study'; action: 'close' };

export type ToothStudyContext = {
  tooth: string;
  view: ToothStudyView;
  explanationVisible: boolean;
};
