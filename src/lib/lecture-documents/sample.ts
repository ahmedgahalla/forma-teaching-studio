import { getTeachingCase, sampleCaseDemonstration } from '../teaching-cases';
import { createLectureDocument, createLectureStep, validateLectureDocument } from './documents';
import type { LectureDocument, LectureScene } from './types';

/** Sample content reuses the existing authored geometry and questions, without new clinical claims. */
export function createLectureSample(scene: LectureScene): LectureDocument {
  const document = createLectureDocument(scene, 'Compare translation and tipping');
  document.steps[0].title = 'Observe the starting view';
  const definition = getTeachingCase('movement-types');
  for (const id of ['translation', 'tip']) {
    const variant = definition.variants.find(item => item.id === id)!;
    const demonstration: LectureScene = {
      source: { kind: 'case', id: definition.id },
      transforms: sampleCaseDemonstration(definition.id, variant.id, 0),
      setup: {
        ...structuredClone(scene.setup),
        camera: null,
        selectedIds: [...definition.selectedIds],
        arch: definition.arch,
        view: definition.view,
        gums: false,
        grid: false,
        stage: 0,
        opening: 0,
        anatomy: { bone: false, ligament: false, cutaway: false, opacity: 0.35 },
        mechanicsResponse: false,
        responseRevealed: false,
        predictResponse: false,
        playbackSpeed: 1,
        reverse: false,
      },
      roots: true,
      braces: false,
      attachments: false,
      bracketStyle: 'metal',
      ligatureColor: '#3298bb',
      applianceDisplay: structuredClone(variant.appliance),
      isolated: false,
    };
    document.steps.push({
      ...createLectureStep(demonstration, variant.title),
      notes: variant.description,
      question: variant.question,
      answer: variant.answer,
      demo: { caseId: definition.id, variantId: variant.id },
    });
  }
  return validateLectureDocument(document);
}
