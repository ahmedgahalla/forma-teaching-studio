/** Scripted case-workspace demonstrations. Content as data (AGENTS.md). */
import type { TeachingLesson } from './lecture';

export const LESSONS: TeachingLesson[] = [
  {
    id: 'translation-tip-torque',
    title: 'Translation, tip and torque',
    description: 'Compare displacement with rotations about two different reference axes.',
    steps: [
      {
        command: 'reset all teeth',
        caption: 'Reset the demonstration to its original geometric positions.',
      },
      {
        command: 'focus tooth 11',
        caption: 'Use one upper central incisor to inspect three movement types.',
      },
      {
        command: 'move tooth 11 buccally 1 mm',
        caption: 'Translation shifts every point equally while preserving orientation.',
      },
      {
        command: 'reset tooth 11',
        caption: 'Return to the starting position before examining angular changes.',
      },
      {
        command: 'tip tooth 11 8 degrees',
        caption: 'Tip rotates about the buccolingual reference axis.',
      },
      {
        command: 'torque tooth 11 -6 degrees',
        caption:
          'Torque adds rotation about the mesiodistal reference axis. The crown-centre pivot illustrates geometry, not root control.',
      },
    ],
  },
  {
    id: 'upper-lower-intrusion',
    title: 'Intrusion across both arches',
    description:
      'Observe how rootward movement has opposite vertical directions in the two arches.',
    steps: [
      { command: 'reset all teeth', caption: 'Reset the demonstration to its original positions.' },
      { command: 'show both arches', caption: 'Compare the upper and lower incisors together.' },
      {
        command: 'select upper incisors',
        caption: 'The group contains all upper incisors present in the case.',
      },
      {
        command: 'intrude upper incisors 1 mm',
        caption: 'Upper intrusion follows the rootward direction defined by each reference frame.',
      },
      {
        command: 'intrude lower incisors 1 mm',
        caption:
          'Lower intrusion follows its own rootward direction; it does not share the upper arch’s world-Y sign.',
      },
      {
        command: 'show original overlay',
        caption: 'The original positions make the two opposing geometric displacements visible.',
      },
    ],
  },
  {
    id: 'groups-and-expansion',
    title: 'Groups and buccal expansion',
    description: 'Use group selection to compare individual tooth directions within one arch.',
    steps: [
      { command: 'reset all teeth', caption: 'Start from the original setup.' },
      { command: 'show upper arch', caption: 'Isolate the upper arch for the demonstration.' },
      {
        command: 'select upper premolars',
        caption: 'Select the present first and second upper premolars on both sides.',
      },
      {
        command: 'move selected teeth buccally 0.5 mm',
        caption: 'Each selected tooth moves 0.5 mm along its own buccal reference direction.',
      },
      { command: 'select upper teeth', caption: 'Extend the selection to the whole upper arch.' },
      {
        command: 'expand upper teeth 0.5 mm',
        caption:
          'Expansion here adds 0.5 mm buccally per tooth. It is not a requested total arch-width change or a skeletal expansion simulation.',
      },
    ],
  },
  {
    id: 'appliances-and-comparison',
    title: 'Appliances and before / after',
    description:
      'Show how the schematic fixed appliance follows crowns during a geometric demonstration.',
    steps: [
      { command: 'reset all teeth', caption: 'Restore the original tooth positions.' },
      {
        command: 'show brackets',
        caption:
          'Brackets follow the tooth crowns; the wire is a display connection rather than a force model.',
      },
      { command: 'select teeth 11,21', caption: 'Select the two upper central incisors.' },
      {
        command: 'move selected teeth buccally 1 mm',
        caption: 'Move the pair to create an easily visible classroom example.',
      },
      {
        command: 'show before',
        caption: 'Return the display to the original position without deleting the demonstration.',
      },
      {
        command: 'show after',
        caption:
          'Show the final position again. This comparison describes geometry, not treatment feasibility.',
      },
    ],
  },
];
