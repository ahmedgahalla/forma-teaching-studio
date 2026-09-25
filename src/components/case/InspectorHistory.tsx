'use client';
import type { CaseStudioApi } from './api';
import { ArrowDownToLine, ArrowUpRight, Download, History, Layers3, Plus, X } from 'lucide-react';

export function InspectorHistory({ api }: { api: CaseStudioApi }) {
  return (
    <>
      {api.panel === 'history' && (
        <div className="history-panel">
          <div className="stage-export-card">
            <span className="eyebrow">TEACHING MODEL EXPORTS</span>
            <h3>Take the sequence with you.</h3>
            <p>Export the nearest whole stage, or every stage with a movement manifest.</p>
            <button className="button light full-button" onClick={api.exportShown}>
              <Download size={15} />
              Export stage {Math.round(api.stage)} · STL
            </button>
            <button
              className="button primary full-button"
              disabled={api.busy}
              onClick={api.exportSequence}
            >
              <Layers3 size={15} />
              {api.busy ? 'Preparing…' : `Export ${api.stages + 1} stages · ZIP`}
            </button>
            <p className="field-hint">
              Crowns + gingiva{api.attachments ? ' + placed attachments' : ''}. Teaching geometry;
              no aligner shells or manufacturing preparation.
            </p>
          </div>
          <div className="divider" />
          {!api.tryActive && !api.prepared && (
            <>
              <div className="control-heading">
                <Layers3 size={16} />
                <h3>Planning checkpoints</h3>
                <span>{api.checkpoints.length}/20</span>
              </div>
              <p>
                Capture an intermediate setup. Playback follows the saved order, then reaches your
                current final target.
              </p>
              <div className="checkpoint-input">
                <input
                  aria-label="Checkpoint name"
                  placeholder="e.g. Alignment study"
                  maxLength={60}
                  value={api.checkpointName}
                  onChange={e => api.setCheckpointName(e.target.value)}
                />
                <button
                  className="icon-button"
                  onClick={api.addCheckpoint}
                  disabled={api.checkpoints.length >= 20}
                  aria-label="Capture checkpoint"
                >
                  <Plus size={18} />
                </button>
              </div>
              <div className="checkpoint-list">
                {api.checkpoints.map((c, i) => (
                  <div key={c.id}>
                    <span>{i + 1}</span>
                    <button
                      onClick={() => {
                        api.setPlaying(false);
                        api.setStage(((i + 1) / (api.checkpoints.length + 1)) * api.stages);
                      }}
                    >
                      {c.name}
                    </button>
                    <button
                      className="icon-button"
                      aria-label={`Remove checkpoint ${c.name}`}
                      onClick={() => {
                        api.setCheckpoints(api.checkpoints.filter(p => p.id !== c.id));
                        api.setStage(api.stages);
                      }}
                    >
                      <X size={13} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="divider" />
            </>
          )}
          <div className="control-heading">
            <History size={16} />
            <h3>Movement history</h3>
            <span>{api.plan.past.length}</span>
          </div>
          {!api.plan.past.length ? (
            <div className="empty-history">
              <History size={24} />
              <span>Your first movement will appear here.</span>
            </div>
          ) : (
            [...api.plan.past].reverse().map((entry, i) => (
              <div className="history-entry" key={i}>
                <span>{api.plan.past.length - i}</span>
                <div>{entry.label}</div>
              </div>
            ))
          )}
        </div>
      )}
      <div className="inspector-bottom">
        <div>
          <span>Teeth adjusted</span>
          <strong>
            {api.moved}
            <small> / {api.model.teeth.length}</small>
          </strong>
        </div>
        <button className="button export-button" onClick={api.exportShown}>
          <ArrowDownToLine size={16} />
          Export stage {Math.round(api.stage)} STL
          <ArrowUpRight size={14} />
        </button>
      </div>
    </>
  );
}
