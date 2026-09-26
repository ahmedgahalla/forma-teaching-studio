'use client';
import type { CaseStudioApi } from './api';
import { ArrowUpRight } from 'lucide-react';
import { Dialog } from './ui';
import { EXAMPLES } from './constants';
import { createDemo } from '@/lib/geometry';

export function DialogsInfo({ api }: { api: CaseStudioApi }) {
  const { modal, setModal } = api;
  return (
    <>
      {modal === 'arrangement' && api.dentalArrangement && (
        <Dialog title={api.dentalArrangement.title} onClose={() => setModal(null)}>
          <p>{api.dentalArrangement.description}</p>
          <ul className="arrangement-assumptions">
            {api.dentalArrangement.assumptions.map(item => (
              <li key={item}>{item}</li>
            ))}
          </ul>
          <p className="form-note">Source-linked draft · educator review pending.</p>
          <ul className="source-links">
            {api.dentalArrangement.sources.map(item => (
              <li key={item.url}>
                <a href={item.url} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              </li>
            ))}
          </ul>
        </Dialog>
      )}
      {modal === 'demo' && (
        <Dialog title="Reload the synthetic study?" onClose={() => setModal(null)}>
          <p>
            This replaces the current case, movements, and checkpoints. Save your current case first
            to keep it.
          </p>
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button className="button primary" onClick={() => api.load(createDemo())}>
              Reload study
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'guide' && (
        <Dialog title="Orthodontic movement guide" onClose={() => setModal(null)}>
          <p>
            Try Mode is a free teaching workspace. Clear validated spoken or typed instructions
            execute immediately; manual controls offer a preview with Apply or Discard. Per-tooth
            anatomical movements and rigid segment movements are different controls.
          </p>
          <div className="movement-guide-table">
            <div>
              <strong>Translation</strong>
              <span>
                Buccal/lingual, mesial/distal, and intrusion/extrusion. Intrusion follows the
                rootward direction; upper and lower signs differ.
              </span>
            </div>
            <div>
              <strong>Tip</strong>
              <span>Rotation about the buccolingual axis.</span>
            </div>
            <div>
              <strong>Torque</strong>
              <span>
                Rotation about the mesiodistal axis. This geometric preview does not predict
                isolated root movement.
              </span>
            </div>
            <div>
              <strong>Axial rotation</strong>
              <span>Rotation about the root-to-occlusal axis.</span>
            </div>
          </div>
          <p className="form-note">
            Positive angles use the right-hand rule about the stored positive axis. Rotations use
            fixed original reference axes and the crown’s bounding-box centre, not a physiological
            centre of resistance. “Expand” means buccal displacement per tooth, not a requested
            total arch-width increase. “Retract” means lingual displacement in this editor.
          </p>
          <h3>Voice in a lecture</h3>
          <p className="form-note">
            Hold Space outside an input, or hold the microphone button, and release to run your
            instruction. Try Mode commands run locally in English. The optional AI service
            translates flexible wording into the same bounded classroom, geometry and appliance
            actions. The application validates the complete request and calculates supported
            mechanics independently. Stop or Escape cancels pending work. “Undo that” restores the
            whole request. Explanations are spoken only when you ask.
          </p>
          <h3>Build an appliance experiment</h3>
          <p className="form-note">
            Point to a crown, root or gingiva while speaking. “Install brackets here” targets the
            associated tooth; a TAD uses the indicated point. A passive bracket and wire setup does
            not move teeth. Specify activation, tension or spring parameters, then say “show what
            happens”. Parameter replacements recalculate from the unchanged unloaded reference. Save
            named experiment stages to compare configurations.
          </p>
          <h3>Geometric objectives</h3>
          <p className="form-note">
            Gap closure requires two teeth and an explicit equal/first/second rule. Pair span
            changes the 3D distance between crown centres. The editable arch ellipse changes
            positions while preserving each tooth’s height and orientation. All calculate targets
            from the committed arrangement. Manual objectives show a preview; clear command requests
            apply only after validation.
          </p>
          <p className="form-note">
            Crown crossings are checked at bounded samples along the displayed path. Starting
            intersections are reported separately. Roots, bone, enclosed volumes, and crossings
            between samples are not assessed. Unrestricted illustration can bypass collision
            constraints, but never tooth locks.
          </p>
          <h3>Try a command</h3>
          <div className="example-commands">
            {EXAMPLES.map(s => (
              <button
                key={s}
                onClick={() => {
                  api.setCommand(s);
                  setModal(null);
                  setTimeout(() => api.commandInput.current?.focus(), 0);
                }}
              >
                <code>{s}</code>
                <ArrowUpRight size={15} />
              </button>
            ))}
          </div>
          <p className="form-note">
            Combine up to eight supported actions with “and” or “then”; an explicit list is written
            “teeth 11,12,21,22”. For a single “rotate it”, the legacy default is world Y. For a
            group “rotate teeth …”, the default is each tooth’s long axis. Use “around x/y/z” for
            world rotations.
          </p>
          <h3>What the display means</h3>
          <p className="form-note">
            Crowns and roots in the demo are synthetic Blender teaching meshes, with a built-in
            basic model as a loading fallback. Brackets and wires are schematic. The optional
            mechanics experiment calculates a reduced initial elastic response with declared virtual
            support, wire, elastic and expander assumptions. Hardware curves and force-arrow sizes
            remain schematic. No biological progression, patient-specific bone limits, clinical
            treatment feasibility or aligner production is computed. Numeric input limits are
            software limits, not safe clinical movement ranges.
          </p>
          <h3>Evidence and reading</h3>
          <ul className="source-links">
            <li>
              <a
                href="https://link.springer.com/article/10.1186/s40510-022-00402-x"
                target="_blank"
                rel="noreferrer"
              >
                Tip, torque and rotation: digital measurement study
              </a>
            </li>
            <li>
              <a
                href="https://aaoinfo.org/resources/glossary-of-orthodontic-terms/"
                target="_blank"
                rel="noreferrer"
              >
                American Association of Orthodontists glossary
              </a>
            </li>
            <li>
              <a
                href="https://pmc.ncbi.nlm.nih.gov/articles/PMC9995625/"
                target="_blank"
                rel="noreferrer"
              >
                Centre of resistance: evidence and limitations
              </a>
            </li>
          </ul>
          <div className="shortcut-list">
            <span>
              Focus command bar<kbd>/</kbd>
            </span>
            <span>
              Undo<kbd>Ctrl / ⌘ + Z</kbd>
            </span>
            <span>
              Redo<kbd>Ctrl / ⌘ + Shift + Z</kbd>
            </span>
          </div>
        </Dialog>
      )}
    </>
  );
}
