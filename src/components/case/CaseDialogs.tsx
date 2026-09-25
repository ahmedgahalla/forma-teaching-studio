'use client';
import type { CaseStudioApi } from './api';
import { ArrowRight, ArrowUpRight, Check, CircleHelp, RotateCcw, Upload } from 'lucide-react';
import { Dialog, Toggle } from './ui';
import { axisVectors, errorText, CASE_CARDS, EXAMPLES } from './constants';
import { DENTAL_ARRANGEMENTS } from '@/lib/dental-arrangements';
import { LESSONS } from '@/lib/lecture';
import { createDemo } from '@/lib/geometry';
import { TeachingCaseLibrary } from '../StudioExperience';
import { WorkflowLibrary } from '../WorkflowStudio';

export function CaseDialogs({ api }: { api: CaseStudioApi }) {
  const { modal, setModal } = api;
  return (
    <>
      {modal === 'workflows' && (
        <Dialog title="Teaching library" onClose={() => setModal(null)}>
          <section className="dental-arrangement-library">
            <span className="eyebrow">START A FREE EXPERIMENT</span>
            <h3>Dental relationships</h3>
            <p>
              Prepared starting arrangements for free exploration. Dental and skeletal
              classification remain separate.
            </p>
            <div>
              {DENTAL_ARRANGEMENTS.map(item => (
                <button
                  disabled={!!api.sandbox.pending || api.busy}
                  key={item.id}
                  title={item.description}
                  onClick={() =>
                    void api.teaching.execute(
                      [{ kind: 'dental-arrangement', id: item.id }],
                      `Load ${item.title}`,
                    )
                  }
                >
                  {item.title}
                  <ArrowUpRight size={14} />
                </button>
              ))}
            </div>
          </section>
          <TeachingCaseLibrary
            cases={CASE_CARDS}
            selectedId={api.scenario?.caseId}
            disabled={!!api.sandbox.pending || api.busy}
            onChoose={id => {
              setModal(null);
              void api.teaching.execute(
                [{ kind: 'case', action: 'load', id }],
                'Load prepared teaching case',
              );
            }}
          />
          <details className="appliance-workflow-library">
            <summary>Appliance workflows & anatomy classroom</summary>
            <WorkflowLibrary
              onChoose={id => {
                setModal(null);
                void api.teaching.runControl(
                  id === 'anatomy'
                    ? 'start anatomy lesson'
                    : `start ${id === 'fixed-braces' ? 'braces' : id.replace('-', ' ')} workflow`,
                );
              }}
            />
          </details>
          <div className="combined-library-link">
            <p>Prefer a short sequence of tooth edits on this case?</p>
            <button onClick={() => setModal('lessons')}>Short guided lessons</button>
          </div>
        </Dialog>
      )}
      {modal === 'lessons' && (
        <Dialog title="Ready for the next demonstration?" onClose={() => setModal(null)}>
          <p>
            Choose a short teaching sequence. Say “next step”, “previous step”, or “restart lesson”
            as you explain.
          </p>
          <div className="lesson-cards">
            {LESSONS.map((lesson, i) => (
              <button
                key={lesson.id}
                onClick={() => {
                  if (api.workflowOrigin || api.scenario) {
                    api.note('Restore your workspace before starting another short lesson.', true);
                    setModal(null);
                    return;
                  }
                  if (api.sandbox.pending) {
                    api.note('Apply or discard the preview before opening a lesson.', true);
                    setModal(null);
                    return;
                  }
                  api.setSandbox({ ...api.sandbox, pending: null, lastEdit: null });
                  api.setLessonId(lesson.id);
                  api.setLessonStep(-1);
                  api.lessonSnapshots.current = [];
                  api.setLecture(true);
                  setModal(null);
                  api.setPlaying(false);
                  api.note('Lesson ready. Say “next step” or press Next step to begin.');
                }}
              >
                <span className="lesson-number">0{i + 1}</span>
                <div>
                  <strong>{lesson.title}</strong>
                  <p>{lesson.description}</p>
                  <small>{lesson.steps.length} steps · voice controlled</small>
                </div>
                <ArrowUpRight size={19} />
              </button>
            ))}
          </div>
          <p className="form-note">
            The first step resets tooth movements. Save your case first if needed. Previous step
            restores the setup before that step. Demonstrations use illustrative geometry.
          </p>
        </Dialog>
      )}
      {modal === 'import' && (
        <Dialog title="Import segmented dental meshes" onClose={() => setModal(null)}>
          <p>
            Select already-segmented STL teeth using FDI names such as <code>11.stl</code>,{' '}
            <code>21.stl</code>, <code>31.stl</code>, and <code>41.stl</code>. Gums can be named{' '}
            <code>upper_gum.stl</code> and <code>lower_gum.stl</code>.
          </p>
          <label className="upload-zone">
            <Upload size={26} />
            <strong>
              {api.files.length ? `${api.files.length} files selected` : 'Choose STL files'}
            </strong>
            <span>Shared coordinates · 100 MB total</span>
            <input
              type="file"
              accept=".stl"
              multiple
              onChange={e => api.setFiles(Array.from(e.target.files || []))}
            />
          </label>
          {api.files.length > 0 && (
            <div className="file-chips">
              {api.files.map(f => (
                <span key={f.name}>{f.name}</span>
              ))}
            </div>
          )}
          <label className="form-label">
            Source units
            <select value={api.scale} onChange={e => api.setScale(e.target.value)}>
              <option value="1">Millimetres</option>
              <option value="10">Centimetres</option>
              <option value="1000">Metres</option>
              <option value="25.4">Inches</option>
            </select>
          </label>
          <p className="form-note">
            Replaces the current case. Save first if needed. All shared positions are preserved.
            Anatomical orientation, tooth segmentation, roots, and bite registration are not
            inferred.
          </p>
          {api.importError && (
            <p className="inline-error" role="alert">
              {api.importError}
            </p>
          )}
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={!api.files.length || api.busy}
              onClick={api.importFiles}
            >
              {api.busy ? 'Importing…' : 'Import models'}
              <ArrowRight size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'calibrate' && (
        <Dialog title={`Reference axes · tooth ${api.selected}`} onClose={() => setModal(null)}>
          <p>
            Named movements require the tooth’s original anatomical axes. The occlusal axis points
            from the root toward the biting surface; intrusion moves in the opposite direction.
          </p>
          {api.actualCalibration && (
            <div className="frame-readout">
              {Object.entries(api.actualCalibration).map(([key, vector]) => (
                <div key={key}>
                  <span>{key}</span>
                  <code>[{vector.map(n => n.toFixed(3)).join(', ')}]</code>
                </div>
              ))}
            </div>
          )}
          <p className="form-note">
            These selectors assign an axis-aligned frame for this tooth. They do not rotate the
            mesh. Use world movement for tilted imports until an appropriate frame is assigned.
            Existing transformations are kept.
          </p>
          <div className="calibration-fields">
            {[
              { label: 'Buccal', value: api.bAxis, set: api.setBAxis },
              { label: 'Mesial', value: api.mAxis, set: api.setMAxis },
              { label: 'Occlusal', value: api.oAxis, set: api.setOAxis },
            ].map(f => (
              <label className="form-label" key={f.label}>
                {f.label}
                <select value={f.value} onChange={e => f.set(e.target.value)}>
                  {Object.keys(axisVectors).map(a => (
                    <option key={a}>{a}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          <div className="dialog-actions">
            <button className="button light" onClick={() => setModal(null)}>
              Cancel
            </button>
            <button
              className="button primary"
              disabled={new Set([api.bAxis[1], api.mAxis[1], api.oAxis[1]]).size !== 3}
              onClick={() => {
                api.setModel({
                  ...api.model,
                  teeth: api.model.teeth.map(t =>
                    t.id === api.selected
                      ? {
                          ...t,
                          calibrated: true,
                          buccal: axisVectors[api.bAxis],
                          mesial: axisVectors[api.mAxis],
                          occlusal: axisVectors[api.oAxis],
                          bracketPosition: undefined,
                        }
                      : t,
                  ),
                });
                setModal(null);
                api.note(
                  `Tooth ${api.selected} reference axes assigned. Bracket placement is estimated from the buccal surface.`,
                );
              }}
            >
              Assign axes
              <Check size={16} />
            </button>
          </div>
        </Dialog>
      )}
      {modal === 'settings' && (
        <Dialog title="Workspace settings" onClose={() => setModal(null)}>
          <div className="settings-file-actions">
            <button
              className="button light"
              onClick={() => {
                setModal(null);
                api.caseInput.current?.click();
              }}
            >
              <Upload size={15} />
              Open saved case
            </button>
            <button
              className="button light"
              onClick={() => {
                api.setImportError('');
                setModal('import');
              }}
            >
              Import STL models
            </button>
          </div>
          <h3>Command interpretation</h3>
          <p>
            Try Mode commands work locally in English without a key. The optional AI service
            interprets flexible wording. Every action is independently validated before the geometry
            engine runs.
          </p>
          <Toggle
            label="Use AI command service"
            value={api.aiEnabled}
            onChange={() => {
              if (!api.aiEnabled && !api.apiUrl) {
                api.note('Connect the service below first.', true);
                return;
              }
              api.setAiEnabled(!api.aiEnabled);
            }}
          />
          <label className="form-label">
            Service URL
            <input value={api.apiDraft} onChange={e => api.setApiDraft(e.target.value)} />
          </label>
          <button
            className="button light"
            disabled={api.busy}
            onClick={async () => {
              api.setBusy(true);
              try {
                const url = new URL(api.apiDraft);
                if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
                  throw new Error('Use an http or https URL.');
                const base = url.href.replace(/\/$/, '');
                const response = await fetch(`${base}/health`, {
                  signal: AbortSignal.timeout(5000),
                });
                if (!response.ok) throw new Error('Service unavailable.');
                const result = await response.json();
                if (!result.ai_enabled)
                  throw new Error('Service is running but OPENAI_API_KEY is not configured.');
                api.teaching.setConfig({
                  url: base,
                  enabled: true,
                  provider: result.provider || 'Configured AI provider',
                });
                api.note(
                  'AI service connected. Clear validated classroom and geometric commands execute immediately; manual previews retain Apply and Cancel. Undo restores the whole request.',
                );
              } catch (e) {
                api.note(errorText(e), true);
              } finally {
                api.setBusy(false);
              }
            }}
          >
            Connect service
            <ArrowUpRight size={15} />
          </button>
          <p className="form-note">
            Command text and minimal scene references go to your configured AI provider. Meshes
            remain local. Voice uses the browser’s speech service. API keys belong only in the
            backend environment.
          </p>
          <p className={api.statusError ? 'inline-error' : 'form-note'}>{api.status}</p>
          <div className="divider" />
          <button className="text-button" onClick={() => setModal('demo')}>
            <RotateCcw size={16} />
            Reload synthetic study
          </button>
          <button className="text-button" onClick={() => setModal('guide')}>
            <CircleHelp size={16} />
            Movement guide and sources
          </button>
        </Dialog>
      )}
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
