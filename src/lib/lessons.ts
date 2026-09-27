/** Scripted case-workspace demonstrations. Content as data (AGENTS.md). */
import type { TeachingLesson } from './lecture';

export const LESSONS: TeachingLesson[] = [
  {
    id: 'tooth-anatomy-tour',
    title: 'Tooth anatomy tour',
    description:
      'Inspect incisors, a canine, a premolar and molars. Teaching draft — pending educator review · synthetic model.',
    steps: [
      {
        command: 'show tooth 11 from the labial',
        caption:
          'Tooth 11 is the upper right central incisor, the widest anterior crown. Its incisal edge cuts food.',
      },
      {
        command: 'show tooth 11 from the palatal',
        caption:
          'The palatal surface has a cervical cingulum and two marginal ridges. These border the lingual fossa.',
      },
      {
        command: 'show tooth 13 from the labial',
        caption:
          'The upper right canine has one pointed cusp and a long single root. The canine marks the corner of the dental arch.',
      },
      {
        command: 'show tooth 14 from the mesial',
        caption:
          'This upper first premolar has two roots, buccal and palatal, in the synthetic model. Human root forms vary.',
      },
      {
        command: 'show tooth 16 from the occlusal',
        caption:
          'The upper first molar has four main cusps. An oblique ridge connects the mesiopalatal and distobuccal cusps.',
      },
      {
        command: 'show tooth 16 from the palatal',
        caption:
          'The cusp of Carabelli is an accessory feature on the palatal surface of the mesiopalatal cusp. Its size and presence vary in natural teeth.',
      },
      {
        command: 'show tooth 16 from the buccal',
        caption:
          'This upper first molar has three roots: mesiobuccal, distobuccal and palatal. The furcation is where the root trunk divides.',
      },
      {
        command: 'show tooth 46 from the occlusal',
        caption:
          'The lower right first molar has five cusps in this model. Three are on the buccal side and two on the lingual side.',
      },
      {
        command: 'show tooth 46 from the buccal',
        caption:
          'This lower first molar has a mesial root and a distal root. Compare its two roots with the three roots of the upper first molar.',
      },
      {
        command: 'back to the full mouth',
        caption:
          'Return to the full mouth and compare the tooth groups. Teaching draft — pending educator review; this synthetic model illustrates selected features.',
      },
    ],
  },
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
