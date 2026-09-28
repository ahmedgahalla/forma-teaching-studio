import { Buffer } from 'node:buffer';

const MAX_BYTES = 64 * 1024;
const providers = ['OpenAI', 'OpenRouter', 'Configured AI provider'];
const teachingPaths = new Set(['/api/interpret-teaching', '/api/analyze-teaching']);

export function localPort(value, label) {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1024 || port > 65535)
    throw new Error(`${label} must be an integer from 1024 to 65535.`);
  return port;
}

export function aiProvider(baseUrl) {
  if (!baseUrl) return 'OpenAI';
  const url = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password)
    throw new Error('Invalid private provider URL.');
  const host = url.hostname;
  return host === 'api.openai.com'
    ? 'OpenAI'
    : host === 'openrouter.ai'
      ? 'OpenRouter'
      : 'Configured AI provider';
}

class RequestError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function reply(res, status, value, head = false) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  res.end(head ? undefined : JSON.stringify(value));
}

function requestBody(req, signal) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let bytes = 0;
    const finish = (error, value) => {
      req.off('data', data);
      req.off('end', end);
      req.off('error', failed);
      signal.removeEventListener('abort', aborted);
      if (error) {
        req.resume();
        reject(error);
      } else resolve(value);
    };
    const data = chunk => {
      bytes += chunk.length;
      if (bytes > MAX_BYTES)
        finish(new RequestError(413, 'Teaching requests are limited to 64 KiB.'));
      else chunks.push(chunk);
    };
    const end = () => finish(null, Buffer.concat(chunks));
    const failed = () => finish(new Error('Request interrupted.'));
    const aborted = () => finish(new Error('Request cancelled.'));
    req.on('data', data);
    req.once('end', end);
    req.once('error', failed);
    signal.addEventListener('abort', aborted, { once: true });
    if (signal.aborted) aborted();
  });
}

async function responseBody(response, signal) {
  if (!response.body) throw new Error('Missing response.');
  const reader = response.body.getReader();
  const abort = () => void reader.cancel().catch(() => {});
  signal.addEventListener('abort', abort, { once: true });
  const chunks = [];
  let bytes = 0;
  try {
    while (!signal.aborted) {
      const { done, value } = await reader.read();
      if (done) return JSON.parse(Buffer.concat(chunks).toString('utf8'));
      bytes += value.length;
      if (bytes > MAX_BYTES) throw new Error('Response too large.');
      chunks.push(value);
    }
    throw new Error('Response cancelled.');
  } finally {
    signal.removeEventListener('abort', abort);
    await reader.cancel().catch(() => {});
  }
}

// Explicitly enabled only by the local AI launcher. Never an arbitrary URL proxy.
export function createLocalAiGateway({ host, port, backendPort, provider }, transport = fetch) {
  if (host !== '127.0.0.1') throw new Error('Local AI requires the 127.0.0.1 bind address.');
  port = localPort(port, 'PORT');
  backendPort = localPort(backendPort, 'FORMA_AI_PORT');
  if (port === backendPort) throw new Error('Frontend and AI backend ports must differ.');
  if (!providers.includes(provider)) throw new Error('Unsupported AI provider label.');
  const authority = `${host}:${port}`,
    origin = `http://${authority}`;
  let active = 0;
  return async (req, res) => {
    const fail = (status, detail) => reply(res, status, { detail });
    if (
      req.headers.host !== authority ||
      (req.headers.origin !== undefined && req.headers.origin !== origin) ||
      req.headers['sec-fetch-site'] === 'cross-site'
    ) {
      fail(403, 'Use the local app address shown in the terminal.');
      return true;
    }
    const route = req.url;
    const configRoute = route === '/forma-runtime-config.json';
    const health = route === '/health';
    if (!configRoute && !health && !teachingPaths.has(route)) return false;
    if (configRoute || health ? !['GET', 'HEAD'].includes(req.method) : req.method !== 'POST') {
      fail(405, 'This method is not supported.');
      return true;
    }
    if (configRoute) {
      reply(
        res,
        200,
        { commandService: { enabled: true, url: 'same-origin', provider } },
        req.method === 'HEAD',
      );
      return true;
    }
    if (!health) {
      if (req.headers.origin !== origin) {
        fail(403, 'Teaching commands must come from the local app.');
        return true;
      }
      if (
        req.headers['content-type']?.split(';')[0].trim().toLowerCase() !== 'application/json' ||
        (req.headers['content-encoding'] && req.headers['content-encoding'] !== 'identity')
      ) {
        fail(415, 'Send uncompressed JSON teaching requests.');
        return true;
      }
      if (Number(req.headers['content-length'] || 0) > MAX_BYTES) {
        fail(413, 'Teaching requests are limited to 64 KiB.');
        return true;
      }
    }
    if (active >= 2) {
      fail(429, 'Two AI requests are already running. Try again shortly.');
      return true;
    }
    active++;
    const controller = new AbortController();
    let disconnected = false,
      timedOut = false;
    const disconnect = () => {
      if (!res.writableEnded) {
        disconnected = true;
        controller.abort();
      }
    };
    req.once('aborted', disconnect);
    res.once('close', disconnect);
    const timer = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 23000);
    try {
      const body = health ? undefined : await requestBody(req, controller.signal);
      if (body) {
        let parsed;
        try {
          parsed = JSON.parse(body.toString('utf8'));
        } catch {
          throw new RequestError(400, 'Supply a valid JSON teaching request.');
        }
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed))
          throw new RequestError(400, 'Supply a JSON teaching request object.');
      }
      const response = await transport(`http://127.0.0.1:${backendPort}${route}`, {
        method: health ? 'GET' : 'POST',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body,
        signal: controller.signal,
        redirect: 'error',
      });
      const value = await responseBody(response, controller.signal);
      if (!value || typeof value !== 'object' || Array.isArray(value))
        throw new Error('Invalid response.');
      if (!disconnected && !controller.signal.aborted)
        reply(res, response.status, value, req.method === 'HEAD');
    } catch (error) {
      if (!disconnected)
        fail(
          error instanceof RequestError ? error.status : 503,
          error instanceof RequestError
            ? error.message
            : timedOut
              ? 'The local AI service timed out. Try again or use a local command.'
              : 'The local AI backend is unavailable. Check its terminal, then try again.',
        );
    } finally {
      clearTimeout(timer);
      req.off('aborted', disconnect);
      res.off('close', disconnect);
      active--;
    }
    return true;
  };
}
