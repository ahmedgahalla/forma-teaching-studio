'use client';
import type { CaseStudioApi } from './api';
import { Vector3 } from 'three';
import type { Vec3 } from '@/lib/model';
import { Focus, MousePointer2, Move3D, Rotate3D } from 'lucide-react';
import Viewer from '../Viewer';
import { LecturePointer } from '../LectureViewTools';
import { toothMatrix } from '@/lib/analysis';
import { applianceView } from '@/lib/appliance-display';
import { mechanicsResponseCaption } from '@/lib/mechanics-presentation';

export function CaseViewport({ api }: { api: CaseStudioApi }) {
  const { viewer, sceneInteraction } = api;
  return (
    <>
      <section
        className="viewport"
        onPointerDownCapture={sceneInteraction}
        aria-label="3D workspace"
      >
        <Viewer
          onReferenceInteraction={api.teaching.referenceInteraction}
          mechanics={
            api.sandbox.pending && api.mechanics
              ? { ...api.mechanics, result: null }
              : api.mechanics
          }
          mechanicsForces={api.forceVectors}
          mechanicsRevealed={api.responseRevealed}
          pointed={api.pointed}
          pointing={api.teaching.capture.phase !== 'idle'}
          onPoint={point => {
            api.teaching.referenceInteraction();
            if (point) {
              const tooth = api.model.teeth.find(item => item.id === point.tooth)!;
              api.setPointed(
                point.surface === 'gingiva'
                  ? point
                  : {
                      ...point,
                      worldPoint: new Vector3(...point.localPoint)
                        .applyMatrix4(toothMatrix(tooth, api.actualShown))
                        .toArray() as Vec3,
                    },
              );
            } else api.setPointed(null);
          }}
          paused={!api.active}
          isolateSelection={api.isolated}
          anatomy={api.anatomy}
          removableRetainer={
            !!api.caseVariant?.removableRetainer &&
            api.braces &&
            api.applianceDisplay.preset === 'none'
          }
          workflow={api.braces ? applianceView(api.applianceDisplay) : undefined}
          ref={viewer}
          model={api.model}
          transforms={api.dragPreview || api.shown}
          selected={api.selected}
          selectedIds={api.selectedIds}
          onSelect={api.selectTooth}
          ghost={
            api.ghost ||
            !!api.sandbox.pending ||
            api.comparisonName !== null ||
            !!api.mechanicsGhost
          }
          ghostTransforms={
            api.mechanicsGhost ||
            api.sandbox.pending?.to ||
            (api.mechanics?.result && api.ghost && !api.comparisonName
              ? api.mechanics.reference.transforms
              : undefined) ||
            (api.comparisonName === 'original' || (api.scenario && api.ghost)
              ? api.caseStart || api.sandbox.original || {}
              : api.sandbox.snapshots.find(item => item.name === api.comparisonName)?.transforms)
          }
          lockedIds={api.sandbox.lockedIds}
          traceFrom={
            api.traces
              ? api.mechanics?.reference.transforms ||
                api.demonstration?.from ||
                api.caseStart ||
                api.sandbox.original ||
                {}
              : undefined
          }
          archCurve={api.curve}
          gums={api.gums}
          labels={api.labels}
          grid={api.grid}
          arch={api.arch}
          braces={api.braces && (!!api.mechanics || api.applianceDisplay.preset !== 'none')}
          roots={api.roots}
          bracketStyle={api.bracketStyle}
          ligatureColor={api.ligatureColor}
          opening={api.opening}
          measureMode={api.measureMode}
          landmarks={api.landmarks}
          onLandmark={point => {
            api.setLandmarks(previous => (previous.length >= 2 ? [point] : [...previous, point]));
            api.note('Surface landmark captured.');
          }}
          intersections={api.highlightedContacts}
          attachments={api.attachments}
          tool={api.tool}
          onPosePreview={(id, next) => {
            api.teaching.interact();
            if (!api.sandbox.lockedIds.includes(id))
              api.setDragPreview({ ...api.plan.current, [id]: next });
          }}
          onPoseCommit={api.poseCommit}
        />
        {api.pointed && (
          <div className="pointed-target-caption" role="status">
            {api.pointed.surface === 'gingiva'
              ? 'Gingiva near'
              : api.pointed.surface === 'root'
                ? 'Root'
                : 'Target'}{' '}
            · {api.pointed.tooth}
            <span>
              {api.teaching.capture.phase !== 'idle'
                ? 'Keep speaking — this point is captured'
                : 'Say “install brackets here”'}
            </span>
            <button
              aria-label="Clear pointed target"
              onClick={() => {
                api.teaching.referenceInteraction();
                api.setPointed(null);
              }}
            >
              ×
            </button>
          </div>
        )}
        <div className="viewport-top">
          <span className="view-badge">
            <span />
            {api.sandbox.pending
              ? 'UNAPPLIED PREVIEW'
              : api.sandbox.unrestricted
                ? 'UNRESTRICTED ILLUSTRATION'
                : api.prepared
                  ? 'AUTHORED TEACHING EXAMPLE'
                  : api.model.demo
                    ? 'SYNTHETIC SANDBOX'
                    : 'IMPORTED CASE'}
          </span>
          <span className="unit-badge">mm · FDI numbering</span>
        </div>
        <div className="model-tools" aria-label="3D tools">
          <button
            aria-label="Orbit tool"
            title="Orbit"
            className={api.tool === 'orbit' ? 'active' : ''}
            onClick={() => api.chooseTool('orbit')}
          >
            <MousePointer2 size={19} />
          </button>
          <button
            aria-label="Move with handles"
            title="Move with world-axis handles"
            className={api.tool === 'translate' ? 'active' : ''}
            onClick={() => api.chooseTool('translate')}
          >
            <Move3D size={19} />
          </button>
          <button
            aria-label="Rotate with handles"
            title="Rotate with world-axis handles"
            className={api.tool === 'rotate' ? 'active' : ''}
            onClick={() => api.chooseTool('rotate')}
          >
            <Rotate3D size={19} />
          </button>
          <span />
          <button
            aria-label="Focus selected teeth"
            title="Focus selected teeth"
            onClick={() => {
              api.teaching.referenceInteraction();
              viewer.current?.focus();
            }}
          >
            <Focus size={19} />
          </button>
          <button
            aria-label="Toggle tooth numbers"
            title="Tooth numbers"
            className={api.labels ? 'active' : ''}
            onClick={() => api.setLabels(!api.labels)}
          >
            11
          </button>
        </div>
        <div className="viewport-selection">
          <MousePointer2 size={14} />
          <span>
            {api.selectedIds.length === 1 ? (
              <>
                Tooth <strong>{api.selected}</strong>
              </>
            ) : (
              <strong>{api.selectedIds.length} teeth selected</strong>
            )}
          </span>
          <span className="selection-line" />
          <span>{api.selectedIds.length === 1 ? api.tooth.name : api.selectedIds.join(' · ')}</span>
        </div>
        <div className="orientation">
          <span className="axis-y">Y</span>
          <span className="axis-x">X</span>
          <span className="axis-z">Z</span>
          <i />
        </div>
        <div className="viewport-hint">
          {api.measureMode
            ? 'Pick two crown-surface points'
            : 'Drag to orbit · Scroll to zoom · Shift-click to select'}
        </div>
        <LecturePointer enabled={api.pointer && api.active} onExit={() => api.setPointer(false)} />
        {api.pointer && (
          <span className="lecture-pointer-notice">
            Lecture pointer · Escape or Exit pointer to orbit
          </span>
        )}
        {api.mechanics?.result && !api.sandbox.pending && (
          <div className="mechanics-scale-badge">
            {api.responseRevealed
              ? mechanicsResponseCaption(api.mechanics.result.diagnostics, api.magnification)
              : 'Predict first · calculated response hidden'}
          </div>
        )}
        {api.mechanics?.result &&
          !api.sandbox.pending &&
          api.forceVectors &&
          api.responseRevealed && (
            <div className="mechanics-vector-legend">
              <span>↗ Force direction</span>
              <span>↻ Moment</span>
              <small>Arrow size is schematic</small>
            </div>
          )}
        {api.stage < api.stages && (
          <div className="stage-preview-badge">
            Stage {api.stage.toFixed(1)} / {api.stages}
          </div>
        )}
        {api.opening > 0 && (
          <div className="opening-badge">Display separation {api.opening} mm</div>
        )}
        {api.roots && <div className="roots-badge">Schematic roots · not reconstructed</div>}
      </section>
    </>
  );
}
