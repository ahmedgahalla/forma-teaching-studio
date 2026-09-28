'use client';
import type { ComponentProps } from 'react';
import type { CaseStudioApi } from './api';
import { ChevronRight, CircleHelp, Maximize } from 'lucide-react';
import { CaseViewControls } from './CaseViewControls';
import { AtlasCameraRail } from './AtlasCameraRail';
import { AtlasDisplayPanel } from './AtlasDisplayPanel';

type HeadingApi = Pick<
  CaseStudioApi,
  | 'viewer'
  | 'prepared'
  | 'tryActive'
  | 'currentLesson'
  | 'caseDefinition'
  | 'scenario'
  | 'sendTry'
  | 'dentalArrangement'
  | 'setModal'
> &
  ComponentProps<typeof CaseViewControls>['api'] &
  ComponentProps<typeof AtlasDisplayPanel>['api'];

export function CaseWorkspaceHeading({ api }: { api: HeadingApi }) {
  const { viewer } = api;
  return (
    <>
      <div className="workspace-heading">
        <div>
          <div className="breadcrumbs">
            {api.prepared
              ? 'Case library'
              : api.tryActive
                ? 'Try Mode'
                : api.currentLesson
                  ? 'Prepared lesson'
                  : 'Case editor'}{' '}
            <ChevronRight size={12} />
            <span>
              {api.prepared ? (
                api.caseDefinition?.category
              ) : api.tryActive ? (
                api.scenario ? (
                  'Case variation'
                ) : (
                  'No lesson required'
                )
              ) : (
                <button onClick={() => api.sendTry({ type: 'enter' }, 'Return to Try Mode')}>
                  Return to Try Mode
                </button>
              )}
            </span>
          </div>
          <h2>
            {api.prepared
              ? api.caseDefinition?.title
              : api.tryActive
                ? api.dentalArrangement?.title || 'Explore the teaching model'
                : api.currentLesson
                  ? 'Explain one step at a time.'
                  : 'Explore the case geometry.'}
          </h2>
        </div>
        <div className="view-actions">
          <AtlasCameraRail api={api} />
          <AtlasDisplayPanel api={api} />
          {api.dentalArrangement && (
            <button
              className="icon-button"
              aria-label="About this dental arrangement"
              onClick={() => api.setModal('arrangement')}
            >
              <CircleHelp size={17} />
            </button>
          )}
          <CaseViewControls api={api} />
          <button
            className="icon-button"
            title="Fit model"
            aria-label="Fit model"
            onClick={() => viewer.current?.fit()}
          >
            <Maximize size={18} />
          </button>
        </div>
      </div>
    </>
  );
}
