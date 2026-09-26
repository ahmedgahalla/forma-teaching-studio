'use client';
import type { CaseStudioApi } from './api';
import { MobilePanelHeading } from './StudioExperience';
import { ArrowUpRight, BookOpen, Box, ChevronRight, CircleHelp, Plus, Upload } from 'lucide-react';
import { Toggle } from './ui';
import AnatomyPanel from '../viewer/AnatomyPanel';
import { orderedArchIds } from '@/lib/appliances';

export function CaseSidebar({ api }: { api: CaseStudioApi }) {
  return (
    <>
      <aside className="sidebar">
        <MobilePanelHeading
          title={api.mobilePanel === 'layers' ? 'Layers' : 'Selection'}
          onClose={() => api.setMobilePanel('model')}
        />
        <div className="case-heading">
          <div className="eyebrow">
            {api.prepared
              ? 'PREPARED TEACHING CASE'
              : api.tryActive
                ? 'TRY MODE · FREE EXPLORATION'
                : api.currentLesson
                  ? 'GUIDED TEACHING'
                  : 'CASE EDITOR'}
          </div>
          <h1>
            {api.caseDefinition?.title ||
              (api.model.name.includes('Dental Class')
                ? api.model.name.split(' · synthetic')[0]
                : api.model.demo
                  ? 'Complete dentition'
                  : api.model.name)}
          </h1>
          <div className="case-meta">
            {api.model.demo ? 'Illustrative anatomy' : 'Imported meshes'}
            <span>·</span>
            {api.model.teeth.length} teeth
          </div>
        </div>
        <button
          className="import-button"
          onClick={() => {
            api.setImportError('');
            api.setModal('import');
          }}
        >
          <Upload size={17} />
          Import STL models
          <Plus size={15} />
        </button>
        <div className="section-heading">
          TOOTH SELECTION<span className="count">{api.selectedIds.length}</span>
        </div>
        <div className="tooth-chart">
          {(['upper', 'lower'] as const).map(a => (
            <div className="chart-arch" key={a}>
              <div className="chart-title">
                <span>{a === 'upper' ? 'Upper · maxillary' : 'Lower · mandibular'}</span>
                <button onClick={() => api.selectGroup(`${a} teeth`)}>Select arch</button>
              </div>
              <div className="chart-teeth">
                {orderedArchIds(api.ids, a).map(id => (
                  <button
                    key={id}
                    className={`${api.selectedIds.includes(id) ? 'selected' : ''} ${api.sandbox.lockedIds.includes(id) ? 'tooth-locked' : ''} ${api.toothMoved(id) ? 'moved' : ''}`}
                    title={
                      api.sandbox.lockedIds.includes(id) ? `Tooth ${id} · locked` : `Tooth ${id}`
                    }
                    aria-label={`Select tooth ${id}`}
                    aria-pressed={api.selectedIds.includes(id)}
                    onClick={e => api.selectTooth(id, e.shiftKey || e.ctrlKey || e.metaKey)}
                  >
                    {id}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
        <Toggle
          label="Multi-select teeth"
          value={api.multi}
          onChange={() => api.setMulti(!api.multi)}
        />
        <div className="group-shortcuts">
          {[
            'all teeth',
            'upper anterior',
            'lower anterior',
            'upper posterior',
            'lower posterior',
            'molars',
          ].map(scope => (
            <button key={scope} onClick={() => api.selectGroup(scope)}>
              {scope}
            </button>
          ))}
        </div>
        <p className="selection-hint">
          Shift-click adds or removes a tooth. Every group edit is one undo step.
        </p>
        <div className="display-controls">
          <div className="section-heading">MODEL DISPLAY</div>
          <Toggle
            label="Appliance display"
            value={
              api.braces &&
              (!!api.mechanics ||
                api.applianceDisplay.preset !== 'none' ||
                !!api.caseVariant?.removableRetainer)
            }
            onChange={api.toggleApplianceVisibility}
          />
          <Toggle
            label="Aligner attachments"
            value={api.attachments}
            onChange={() => api.setAttachments(!api.attachments)}
          />
          <Toggle label="Gingiva" value={api.gums} onChange={() => api.setGums(!api.gums)} />
          <AnatomyPanel
            value={api.anatomy}
            available={api.model.demo}
            selected={api.selected}
            onChange={value => {
              api.teaching.interact();
              if (value.cutaway && !api.anatomy.cutaway) {
                api.setRoots(true);
                api.setGums(true);
              }
              api.setAnatomy(value);
            }}
          />
          <Toggle
            label="Schematic roots"
            value={api.roots}
            onChange={() => {
              if (!api.model.teeth.some(t => t.rootGeometry)) {
                api.note(
                  'This case has no root geometry. Roots are not reconstructed from crowns.',
                  true,
                );
                return;
              }
              api.setRoots(!api.roots);
            }}
          />
          <Toggle
            label="Tooth numbers"
            value={api.labels}
            onChange={() => api.setLabels(!api.labels)}
          />
          <Toggle label="Reference grid" value={api.grid} onChange={() => api.setGrid(!api.grid)} />
          <Toggle
            label="Displacement traces"
            value={api.traces}
            onChange={() => api.setTraces(!api.traces)}
          />
          <Toggle
            label="Arch reference curve"
            value={api.curveVisible}
            onChange={() => api.setCurveVisible(!api.curveVisible)}
          />
        </div>
        <button className="lesson-launch" onClick={() => api.setModal('lessons')}>
          <BookOpen size={21} />
          <span>
            <strong>Teach it step by step</strong>
            <small>Guided movement demonstrations</small>
          </span>
          <ChevronRight size={16} />
        </button>
        <div className="sidebar-bottom">
          <span className="local-badge">
            <Box size={14} />
            Local study · mm · FDI
          </span>
          <button className="text-button" onClick={() => api.setModal('guide')}>
            <CircleHelp size={16} />
            Movement & voice guide
            <ArrowUpRight size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}
