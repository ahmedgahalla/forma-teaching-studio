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
  'backend/main.py', // 1178 — Phase 2.5 splits into routers
  'backend/mechanics.py', // 576
  'src/app/globals.css', // 4987 — Phase 2.3 splits per component
  'src/components/MechanicsPanel.tsx', // 903
  'src/components/Studio.tsx', // 5123 — Phase 2.2
  'src/components/StudioExperience.tsx', // 617
  'src/components/TeachingController.tsx', // 856
  'src/components/TryPanel.tsx', // 927
  'src/components/Viewer.tsx', // 1331
  'src/components/WorkflowStudio.tsx', // 767
  'src/components/classroom-workspace.css', // 544
  'src/components/lecture-console.css', // 316
  'src/components/mechanics.css', // 1239
  'src/components/studio-experience.css', // 2175
  'src/components/try-mode.css', // 699
  'src/lib/classroom.ts', // 1701
  'src/lib/commands.ts', // 379
  'src/lib/demo.ts', // 347
  'src/lib/geometry.ts', // 341
  'src/lib/lecture.ts', // 522
  'src/lib/mechanics-commands.ts', // 760
  'src/lib/mechanics/solver.ts', // 476
  'src/lib/mechanics/state.ts', // 435
  'src/lib/teaching-anatomy.ts', // 546 — content-heavy; may stay data in Phase 2
  'src/lib/teaching-cases.ts', // 786 — content as data
  'src/lib/teaching-runtime.ts', // 391
  'src/lib/try-mode.ts', // 973
  'src/lib/workflow-appliances.ts', // 454
  'src/lib/workflow-scene.ts', // 364
  'src/lib/workflows.ts', // 551 — content as data
]);

// Single lines over MAX_LINE_LENGTH (long regex/string literals) pending Phase 2.
const LENGTH_ALLOWLIST = new Set([
  'backend/mechanics.py', // 601-char rule line
  'src/lib/classroom.ts', // 641-char pattern line
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
