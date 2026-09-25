'use client';
import type { CaseStudioApi } from './api';
import { Camera, ChevronRight, CircleHelp, Focus, Maximize } from 'lucide-react';
import { LectureViewTools } from '../LectureViewTools';

export function CaseWorkspaceHeading({ api }: { api: CaseStudioApi }) {
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
                ? api.dentalArrangement?.title || 'Your orthodontic sandbox'
                : api.currentLesson
                  ? 'Explain one step at a time.'
                  : 'Explore the case geometry.'}
          </h2>
        </div>
        <div className="view-actions">
          {api.dentalArrangement && (
            <button
              className="icon-button"
              aria-label="About this dental arrangement"
              onClick={() => api.setModal('arrangement')}
            >
              <CircleHelp size={17} />
            </button>
          )}
          <details className="presentation-view-menu">
            <summary title="Model presentation tools">
              <Focus size={16} />
              View tools
            </summary>
            <LectureViewTools
              isolated={api.isolated}
              pointer={api.pointer}
              onIsolate={() => api.setIsolated(!api.isolated)}
              onPointer={() => api.setPointer(!api.pointer)}
              onFocus={() => {
                api.teaching.referenceInteraction();
                viewer.current?.focus();
              }}
              onFit={() => {
                api.teaching.referenceInteraction();
                viewer.current?.fit();
              }}
            />
          </details>
          <button
            className="icon-button"
            title="Export 3D image"
            aria-label="Export 3D image"
            onClick={() => viewer.current?.snapshot()}
          >
            <Camera size={18} />
          </button>
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
