'use client';
import type { CaseStudioApi } from './api';
import { DialogsLibrary } from './DialogsLibrary';
import { DialogsSetup } from './DialogsSetup';
import { DialogsInfo } from './DialogsInfo';

export function CaseDialogs({ api }: { api: CaseStudioApi }) {
  return (
    <>
      <DialogsLibrary api={api} />
      <DialogsSetup api={api} />
      <DialogsInfo api={api} />{' '}
    </>
  );
}
