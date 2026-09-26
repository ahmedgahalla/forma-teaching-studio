// One-command environment setup: npm run setup
// Checks tool versions, installs frontend and backend dependencies, and
// configures git. Safe to rerun any time; the git hooks in .githooks/ keep
// dependencies in sync after pulls.
import { execSync, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
let failed = false;
const fail = message => {
  console.error('✗ ' + message);
  failed = true;
};
const ok = message => console.log('✓ ' + message);
const run = (command, options = {}) => {
  const result = spawnSync(command, { shell: true, stdio: 'inherit', cwd: root, ...options });
  if (result.status !== 0) throw new Error(`"${command}" exited with ${result.status}`);
};

// 1. Node version. Policy (AGENTS.md § verification gate): Node 22 or newer is
// supported — 22.6 is the exact floor because the strip-types scripts need it —
// and CI tests Node 22 and 24. .nvmrc stays at 22 as the nvm baseline.
const nodeVersion = process.versions.node;
const [major, minor] = nodeVersion.split('.').map(Number);
if (major < 22 || (major === 22 && minor < 6)) {
  fail(
    `Node 22.6 or newer required (found ${nodeVersion}). Install it from https://nodejs.org and rerun.`,
  );
} else {
  ok(`Node ${nodeVersion} (supported range: >=22.6; CI tests 22 and 24)`);
}

// 2. Python version (backend needs 3.13)
function findPython() {
  for (const candidate of ['python', 'python3.13', 'python3', 'py -3.13']) {
    try {
      const out = execSync(`${candidate} --version`, { encoding: 'utf8', stdio: 'pipe' }).trim();
      const match = out.match(/Python (\d+)\.(\d+)/);
      if (match && match[1] === '3' && Number(match[2]) >= 13) return { candidate, version: out };
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}
const python = findPython();
if (!python) {
  fail(
    'Python 3.13 not found on PATH. Install it from https://www.python.org (the backend and its tests need it); frontend-only work can continue without it.',
  );
} else {
  ok(python.version);
}

if (failed) {
  console.error('\nFix the version problems above, then rerun: npm run setup');
  process.exit(1);
}

// 3. Frontend dependencies (also enables the git hooks via the prepare script)
run('npm ci');
ok('npm dependencies installed');

// 4. Backend virtualenv + requirements
const backend = path.join(root, 'backend');
const venvPython = existsSync(path.join(backend, '.venv', 'Scripts'))
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python');
if (!existsSync(venvPython)) {
  run(`${python.candidate} -m venv .venv`, { cwd: backend });
  ok('backend/.venv created');
}
const finalVenvPython = existsSync(path.join(backend, '.venv', 'Scripts'))
  ? path.join(backend, '.venv', 'Scripts', 'python.exe')
  : path.join(backend, '.venv', 'bin', 'python');
run(`"${finalVenvPython}" -m pip install -q -r requirements.txt`, { cwd: backend });
ok('backend requirements installed');

// 5. Git configuration
run('git config blame.ignoreRevsFile .git-blame-ignore-revs');
run('git config core.hooksPath .githooks');
ok('git configured (blame.ignoreRevsFile, core.hooksPath)');

console.log('\nSetup complete. Dependency syncing after pulls is automatic via .githooks/.');
