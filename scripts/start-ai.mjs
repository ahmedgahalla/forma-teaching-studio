// Opt-in local startup. Credentials stay in the Python backend process.
import { existsSync, readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { parseEnv } from 'node:util';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { aiProvider, localPort } from './local-ai-gateway.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const backend = path.join(root, 'backend');
const python = path.join(
  backend,
  '.venv',
  process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python',
);
let backendEnv, port, backendPort, provider;
try {
  if (!existsSync(path.join(root, 'out/index.html')))
    throw new Error('Build the app first with npm run build.');
  if (!existsSync(python)) throw new Error('Run npm run setup to install the backend.');
  const envFile = path.join(backend, '.env');
  const privateSettings = existsSync(envFile) ? parseEnv(readFileSync(envFile, 'utf8')) : {};
  backendEnv = {};
  // Spreading process.env loses Windows' case-insensitive lookup. Canonicalize
  // provider names before merging so inherited settings still win over .env.
  for (const source of [privateSettings, process.env])
    for (const [name, value] of Object.entries(source))
      backendEnv[
        process.platform === 'win32' && /^OPENAI_/i.test(name) ? name.toUpperCase() : name
      ] = value;
  if (!backendEnv.OPENAI_API_KEY?.trim())
    throw new Error('Set OPENAI_API_KEY in private backend/.env, then run npm run start:ai again.');
  backendEnv.OPENAI_API_KEY = backendEnv.OPENAI_API_KEY.trim();
  if (!backendEnv.OPENAI_BASE_URL?.trim()) delete backendEnv.OPENAI_BASE_URL;
  else backendEnv.OPENAI_BASE_URL = backendEnv.OPENAI_BASE_URL.trim();
  port = localPort(process.env.PORT || 3000, 'PORT');
  backendPort = localPort(process.env.FORMA_AI_PORT || 8002, 'FORMA_AI_PORT');
  if (port === backendPort) throw new Error('Frontend and AI backend ports must differ.');
  if (process.env.FORMA_HOST && process.env.FORMA_HOST !== '127.0.0.1')
    throw new Error('Local AI requires the 127.0.0.1 bind address.');
  provider = aiProvider(backendEnv.OPENAI_BASE_URL);
  backendEnv.CORS_ORIGINS = `http://127.0.0.1:${port}`;
} catch (error) {
  // Environment parser/provider URL errors may contain private input; report only our fixed messages.
  const known =
    /^(Build the app|Run npm run setup|Set OPENAI_API_KEY|PORT must|FORMA_AI_PORT must|Frontend and AI|Local AI requires)/;
  console.error(
    error instanceof Error && known.test(error.message)
      ? error.message
      : 'Check the syntax and provider URL in private backend/.env.',
  );
  process.exit(1);
}

let frontend;
let stopping = false;
const service = spawn(
  python,
  [
    '-m',
    'uvicorn',
    'main:app',
    '--host',
    '127.0.0.1',
    '--port',
    String(backendPort),
    '--no-access-log',
  ],
  {
    cwd: backend,
    env: backendEnv,
    stdio: ['ignore', 'ignore', 'pipe'],
    windowsHide: true,
  },
);
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  clearTimeout(startupTimer);
  service.kill();
  frontend?.kill();
  process.exitCode = code;
}
const startupTimer = setTimeout(() => {
  console.error('The AI backend did not start in time. Check its configuration and port.');
  stop(1);
}, 20000);
let startupLog = '';
service.stderr.on('data', chunk => {
  if (stopping || frontend) return;
  startupLog = (startupLog + chunk.toString()).slice(-4000);
  // Wait for the bind-success log, not just application startup; no HTTP readiness probe.
  if (!startupLog.includes(`Uvicorn running on http://127.0.0.1:${backendPort}`)) return;
  clearTimeout(startupTimer);
  const env = {
    ...process.env,
    PORT: String(port),
    FORMA_HOST: '127.0.0.1',
    FORMA_LOCAL_AI_PORT: String(backendPort),
    FORMA_LOCAL_AI_PROVIDER: provider,
  };
  for (const key of Object.keys(env)) if (/^OPENAI_/i.test(key)) delete env[key];
  frontend = spawn(
    process.execPath,
    ['scripts/serve.mjs', ...(process.argv.includes('--open') ? ['--open'] : [])],
    {
      cwd: root,
      env,
      stdio: 'inherit',
      windowsHide: true,
    },
  );
  frontend.on('error', () => {
    console.error('The local app could not start.');
    stop(1);
  });
  frontend.on('exit', code => stop(code || 0));
  console.log(
    `${provider} backend started locally. Its credentials and API credit have not been verified.`,
  );
});
service.on('error', () => {
  console.error('The AI backend could not start. Run npm run setup and retry.');
  stop(1);
});
service.on('exit', () => {
  if (!stopping) {
    console.error(
      'The AI backend stopped. Check private backend/.env and choose an unused backend port.',
    );
    stop(1);
  }
});
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
