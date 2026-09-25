// CI guard for AGENTS.md file-size and line-length limits (npm run check:limits).
// Scope: code files. Tests and data fixtures are exempt from the line-count rule
// (they follow the code they test), but nothing is exempt from the length rule.
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const MAX_LINES = 300;
const MAX_LINE_LENGTH = 500;

// Files over MAX_LINES before Phase 2 (the refactor phase) splits them.
// Do NOT add entries: new files must respect the limit. Remove entries as
// Phase 2 lands. Counts recorded 2026-09-25 for reference.
const OVERSIZE_ALLOWLIST = new Set([
  // Feature UIs kept whole after the Phase 2 split (each is one panel's
  // self-contained view; further cuts would scatter one feature's markup).
  // Counts as of 2026-09-25; do not add entries, and shrink on any rework.
  'src/components/Studio.tsx', // 1011 - CaseStudio orchestrator: hooks, derived state, api assembly, root layout
  'src/components/viewer/Viewer.tsx', // 1332 - one WebGL scene lifecycle; splitting the renderer effect risks disposal bugs
  'src/components/try/TryPanel.tsx', // 928 - Try Mode's single control surface
  'src/components/mechanics/MechanicsPanel.tsx', // 904 - the experiment builder panel
  'src/components/workflow/WorkflowStudio.tsx', // 772 - the guided-classroom scene
  'src/components/case/StudioExperience.tsx', // 618 - case library + scenario presentation set
  'src/components/teaching/TeachingController.tsx', // 570 - runtime host + provider wiring
  // Parsers/engines whose function boundaries are the natural unit.
  'src/lib/try-mode.ts', // 974 - Try state machine + geometry objectives (follow-up candidate)
  'src/lib/mechanics-commands.ts', // 761 - bounded mechanics grammar
  'src/lib/mechanics/solver.ts', // 477 - the elastic solver
  'src/lib/mechanics/state.ts', // 436 - experiment reducer + validation
  'src/lib/classroom/advance.ts', // 354 - one context-simulation switch
  'src/lib/commands.ts', // 380 - the dental command grammar
  'src/lib/lecture.ts', // 413 - TeachingAction union + single-action parser
  'src/lib/teaching-runtime.ts', // 392 - request lifecycle in one place
  'src/lib/geometry.ts', // 320 - case (de)serialization contract
  'src/lib/demo.ts', // 348 - procedural fallback model builder
  'src/lib/workflow-scene.ts', // 365 - workflow scene reducer + lesson content
  'src/lib/workflow-appliances.ts', // 455 - workflow appliance mesh builders
  'src/lib/teaching-anatomy.ts', // 547 - anatomy mesh builders
  // Content as data (AGENTS.md): prose-heavy authored material.
  'src/lib/teaching-cases.ts', // 787
  'src/lib/workflows.ts', // 552
  // Backend model+grammar pair mirrored by the frontend contract.
  'backend/mechanics.py', // 577
]);

// Single lines over MAX_LINE_LENGTH (long regex/string literals) pending Phase 2.
const LENGTH_ALLOWLIST = new Set([
  'backend/mechanics.py', // 601-char rule line
  'src/lib/classroom/parse-clauses.ts', // 641-char verb-alternation pattern line
  'src/lib/mechanics-commands.ts', // 579-char pattern line
]);

const files = execSync(
  'git ls-files --cached --others --exclude-standard "src/**/*.ts" "src/**/*.tsx" "src/**/*.css" "backend/*.py" "scripts/**/*.mjs" "scripts/*.mjs" "scripts/**/*.py"',
  { encoding: 'utf8' },
)
  .split('\n')
  .filter(Boolean);

const failures = [];
for (const file of files) {
  const isTest = /(\.test\.|\.fixtures\.)/.test(file) || /(^|\/)test_/.test(file);
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  if (!isTest && lines.length > MAX_LINES && !OVERSIZE_ALLOWLIST.has(file)) {
    failures.push(`${file}: ${lines.length} lines (limit ${MAX_LINES})`);
  }
  if (!LENGTH_ALLOWLIST.has(file)) {
    const longest = lines.reduce((max, line) => Math.max(max, line.length), 0);
    if (longest > MAX_LINE_LENGTH) {
      failures.push(`${file}: a ${longest}-char line (limit ${MAX_LINE_LENGTH})`);
    }
  }
}

if (failures.length) {
  console.error('File limit violations (AGENTS.md code standards):');
  for (const failure of failures) console.error('  ' + failure);
  console.error(
    'Split the file (or, for a pre-Phase-2 legacy file only, discuss allowlisting in scripts/check-file-limits.mjs).',
  );
  process.exit(1);
}
console.log(`check-file-limits: ${files.length} files OK`);
