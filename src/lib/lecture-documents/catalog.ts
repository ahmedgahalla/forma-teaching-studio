import { BIOLOGY_SOURCES } from '../teaching-biology';
import { createLectureSample, SAMPLE_LECTURE_ID } from './sample';
import { ANCHORAGE_LECTURE_ID, createAnchorageLecture } from './sample-anchorage';
import { BIOLOGY_LECTURE_ID, createBiologyLecture } from './sample-biology';
import type { LectureDocument } from './types';
import { FEATURED_LECTURE_ID } from './constants';
import { createCaseJourneyLecture } from './sample-case-journey';
import { CASE_JOURNEY_SOURCES } from './sample-case-journey-sources';

export type DemoLecture = {
  id: string;
  title: string;
  summary: string;
  duration: string;
  objectives: readonly string[];
  sources: readonly { title: string; url: string }[];
};

export const DEMO_LECTURES: readonly DemoLecture[] = [
  {
    id: FEATURED_LECTURE_ID,
    title: 'A case from assessment to retention',
    summary:
      'Follow one narrow upper arch through appliances, a wire experiment and authored finishing stages.',
    duration: '7-9 min',
    objectives: [
      'Explain the sequence: assess, expand, reassess, align, finish and retain.',
      'Distinguish appliance placement, initial elastic response and authored progress.',
      'Compare the same starting and finished arrangement; faculty review pending.',
    ],
    sources: CASE_JOURNEY_SOURCES,
  },
  {
    id: SAMPLE_LECTURE_ID,
    title: 'Translation and tipping',
    summary: 'Follow the crown and root through two contrasting movement paths.',
    duration: '3–4 min',
    objectives: [
      'Distinguish a change in position from a change in orientation.',
      'Compare crown and root paths from the same prepared start.',
    ],
    sources: [
      {
        title: 'AAO: orthodontic terminology',
        url: 'https://aaoinfo.org/resources/glossary-of-orthodontic-terms/',
      },
    ],
  },
  {
    id: ANCHORAGE_LECTURE_ID,
    title: 'Space closure and anchorage',
    summary: 'Compare anterior movement with movement shared by both segments.',
    duration: '4–5 min',
    objectives: [
      'Track anterior and posterior contributions to space use.',
      'Distinguish an authored fixed reference from clinically achieved anchorage.',
    ],
    sources: [
      {
        title: 'Sardana et al. (2023): clinical retraction and anchorage trial',
        url: 'https://pubmed.ncbi.nlm.nih.gov/36919990/',
      },
    ],
  },
  {
    id: BIOLOGY_LECTURE_ID,
    title: 'Why teeth move',
    summary: 'Connect periodontal signaling, bone resorption and bone formation.',
    duration: '4–5 min',
    objectives: [
      'Identify the roles of the periodontal ligament and supporting bone.',
      'Explain the compression–tension concept and its limits.',
    ],
    sources: BIOLOGY_SOURCES.map(({ title, url }) => ({ title, url })),
  },
];

/** Fresh documents; presentation never reads or edits a saved lecture library. */
export function createDemoLectures(): LectureDocument[] {
  return [
    createCaseJourneyLecture(),
    createLectureSample(),
    createAnchorageLecture(),
    createBiologyLecture(),
  ];
}
