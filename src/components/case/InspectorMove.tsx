'use client';
import type { CaseStudioApi } from './api';
import {
  ArrowRight,
  ArrowUpRight,
  ChevronRight,
  Focus,
  Move3D,
  Rotate3D,
  RotateCcw,
} from 'lucide-react';
import { directions, pretty } from './constants';

export function InspectorMove({ api }: { api: CaseStudioApi }) {
  return (
    <>
      {api.panel === 'move' && !api.tryActive && !api.prepared && (
        <div className="inspector-content">
          <div className="control-heading">
            <Move3D size={16} />
            <h3>Translate {api.selectedIds.length > 1 ? 'selection' : 'tooth'}</h3>
            <span>mm / tooth</span>
          </div>
          {!api.calibrated && (
            <div className="calibration-notice">
              Use world axes until reference directions are set.
              <button onClick={api.openCalibration}>
                Calibrate tooth {api.selected}
                <ArrowUpRight size={12} />
              </button>
            </div>
          )}
          <div className="direction-grid">
            {directions.map(d => (
              <button
                key={d.id}
                className={api.direction === d.id ? 'active' : ''}
                onClick={() => api.setDirection(d.id)}
                disabled={!api.calibrated}
              >
                <strong>{d.label}</strong>
                <span>{d.detail}</span>
              </button>
            ))}
          </div>
          <div className="world-axes">
            <span>World axis</span>
            {(['x', 'y', 'z'] as const).map(a => (
              <button
                className={api.direction === a ? 'active' : ''}
                onClick={() => api.setDirection(a)}
                key={a}
              >
                {a.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="amount-row">
            <label className="number-field">
              <input
                aria-label="Movement distance"
                type="number"
                value={api.distance}
                step="0.05"
                min="-10"
                max="10"
                onChange={e => api.setDistance(e.target.value)}
              />
              <span>mm</span>
            </label>
            <button
              className="button primary"
              onClick={() =>
                api.apply({
                  type: 'move_group',
                  teeth: api.selectedIds,
                  direction: api.direction,
                  amount: Number(api.distance),
                })
              }
            >
              Move <ArrowRight size={15} />
            </button>
          </div>
          <div className="presets">
            {['0.1', '0.25', '0.5', '1'].map(n => (
              <button
                key={n}
                className={api.distance === n ? 'active' : ''}
                onClick={() => api.setDistance(n)}
              >
                {n} mm
              </button>
            ))}
          </div>
          <div className="divider" />
          <div className="control-heading">
            <Rotate3D size={16} />
            <h3>Angular movement</h3>
            <span>degrees</span>
          </div>
          <div className="rotation-modes">
            {(
              [
                { id: 'tip', label: 'Tip' },
                { id: 'torque', label: 'Torque' },
                { id: 'rotate', label: 'Axial' },
                { id: 'world', label: 'World' },
              ] as const
            ).map(m => (
              <button
                key={m.id}
                onClick={() => api.setRotationMode(m.id)}
                disabled={m.id !== 'world' && !api.calibrated}
                className={api.rotationMode === m.id ? 'active' : ''}
              >
                {m.label}
              </button>
            ))}
          </div>
          <p className="rotation-explanation">
            {api.rotationMode === 'tip'
              ? 'About each tooth’s buccolingual axis.'
              : api.rotationMode === 'torque'
                ? 'About each tooth’s mesiodistal axis.'
                : api.rotationMode === 'rotate'
                  ? 'About each tooth’s occlusal / long axis.'
                  : 'About a fixed axis of the case.'}
          </p>
          {api.rotationMode === 'world' && (
            <div className="rotation-axis">
              <span>World axis</span>
              <div>
                {(['x', 'y', 'z'] as const).map(a => (
                  <button
                    key={a}
                    onClick={() => api.setAxis(a)}
                    className={api.axis === a ? 'active' : ''}
                  >
                    {a.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className="amount-row">
            <label className="number-field">
              <input
                aria-label="Rotation angle"
                type="number"
                value={api.degrees}
                min="-180"
                max="180"
                step="1"
                onChange={e => api.setDegrees(e.target.value)}
              />
              <span>°</span>
            </label>
            <button
              className="button light"
              onClick={() =>
                api.apply(
                  api.rotationMode === 'world'
                    ? {
                        type: 'rotate_group',
                        teeth: api.selectedIds,
                        axis: api.axis,
                        amount: Number(api.degrees),
                      }
                    : {
                        type: 'orthodontic',
                        teeth: api.selectedIds,
                        movement: api.rotationMode,
                        amount: Number(api.degrees),
                      },
                )
              }
            >
              Apply <RotateCcw size={15} />
            </button>
          </div>
          <p className="field-hint">
            Right-hand sign · fixed reference axes · crown-centre pivot. No force or root-control
            prediction.
          </p>
          <div className="divider" />
          <div className="control-heading">
            <Focus size={16} />
            <h3>Tooth {api.selected} · final change</h3>
            <button
              className="reset-link"
              onClick={() => api.apply({ type: 'reset', teeth: api.selectedIds })}
            >
              Reset {api.selectedIds.length > 1 ? 'group' : ''}
            </button>
          </div>
          <div className="position-values">
            {['X', 'Y', 'Z'].map((a, i) => (
              <div key={a}>
                <span>{a}</span>
                <strong>{pretty(api.pose.translation[i])}</strong>
                <small>mm</small>
              </div>
            ))}
          </div>
          <div className="rotation-values">
            Euler XYZ<span>{api.pose.rotation.map(n => `${n.toFixed(1)}°`).join(' / ')}</span>
          </div>
          <button className="axis-details" onClick={api.openCalibration}>
            {api.actualCalibration
              ? 'Inspect / adjust reference directions'
              : 'Set anatomical reference directions'}
            <ChevronRight size={13} />
          </button>
        </div>
      )}
    </>
  );
}
