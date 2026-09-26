import type { CaseRefs, CaseStudioApi } from './api';
import type { AttachmentSpec } from '@/lib/attachments';
import type { Pose } from '@/lib/model';
import { createAttachmentGeometry, validateAttachment } from '@/lib/attachments';
import { errorText } from './constants';
import { emptyPose, isPose } from '@/lib/model';

export function createEditActions(api: CaseStudioApi, _refs: CaseRefs) {
  const editAttachments = (spec: AttachmentSpec | null, targets = api.selectedIds): boolean => {
    try {
      const value = spec ? validateAttachment(spec) : undefined;
      if (value)
        for (const id of targets) {
          const target = api.model.teeth.find(t => t.id === id);
          if (!target) throw new Error(`Tooth ${id} is not available.`);
          createAttachmentGeometry(target, value).dispose();
        }
      api.setModel({
        ...api.model,
        teeth: api.model.teeth.map(t => (targets.includes(t.id) ? { ...t, attachment: value } : t)),
      });
      if (value) {
        api.setAttachments(true);
        api.setBraces(false);
      }
      api.note(
        value
          ? `Attachment applied to ${targets.join(', ')}. Use Remove to reverse this appliance edit.`
          : `Attachments removed from ${targets.join(', ')}.`,
      );
      return true;
    } catch (e) {
      api.note(errorText(e), true);
      return false;
    }
  };
  const poseCommit = (id: string, next: Pose) => {
    if (api.prepared) {
      api.note('Choose Explore this arrangement before using tooth handles.', true);
      return;
    }
    api.setDragPreview(null);
    const original = api.plan.current[id] || emptyPose();
    if (
      !isPose(next) ||
      next.translation.some((v, i) => Math.abs(v - original.translation[i]) > 10)
    ) {
      api.note('Keep each handle move within 10 mm per axis. Use another move to continue.', true);
      return;
    }
    if (
      [...next.translation, ...next.rotation].every(
        (v, i) => Math.abs(v - [...original.translation, ...original.rotation][i]) < 1e-7,
      )
    )
      return;
    if (api.sandbox.lockedIds.includes(id)) {
      api.note(`Tooth ${id} is locked. Unlock it before editing.`, true);
      return;
    }
    if (api.tryActive) {
      api.sendTry(
        {
          type: 'preview',
          edit: { type: 'poses', poses: { [id]: next }, label: `Tooth ${id} · handle edit` },
        },
        'Preview handle edit',
      );
      return;
    }
    api.setSandbox({ ...api.sandbox, pending: null, lastEdit: null });
    api.dispatch({
      type: 'commit',
      value: { ...api.plan.current, [id]: next },
      label: `${id} · ${api.tool === 'rotate' ? 'Rotate' : 'Translate'} with handles`,
    });
    api.setStage(api.stages);
    api.setPlaying(false);
    api.note(`Tooth ${id} moved with world-axis handles. Undo restores this whole drag.`);
  };

  return { editAttachments, poseCommit };
}
