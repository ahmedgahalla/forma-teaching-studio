import { hostedCommandService, type CommandServiceConfig } from './command-service';
import { publicAiError } from './ai-service-errors';

const local = 'Local commands still work.';
const wrongService = `This address is not the Nael AI service. Open Settings and reconnect this app, or check the advanced backend URL. ${local}`;
const noGateway = `This app has no AI gateway configured. Start it with npm run start:ai, then open the address it prints and reconnect. ${local}`;
class AiServiceError extends Error {}

export function aiServiceUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.username ||
      url.password ||
      url.search ||
      url.hash
    )
      throw new Error();
    return url.href.replace(/\/$/, '');
  } catch {
    throw new AiServiceError(
      'Enter an http or https backend URL without a password, query or fragment.',
    );
  }
}

async function requestJson(
  url: string,
  init: RequestInit,
  signal: AbortSignal,
  timeout: number,
): Promise<unknown> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let cancel = () => {};
  const interrupted = new Promise<never>((_, reject) => {
    cancel = () => {
      controller.abort();
      reject(new DOMException('AI request cancelled.', 'AbortError'));
    };
    signal.addEventListener('abort', cancel, { once: true });
    timer = setTimeout(() => {
      controller.abort();
      reject(
        new AiServiceError(
          `The AI service took too long. Try again or reconnect in Settings. ${local}`,
        ),
      );
    }, timeout);
  });
  const request = async () => {
    if (signal.aborted) {
      cancel();
      return await interrupted;
    }
    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: controller.signal,
        redirect: 'error',
        cache: 'no-store',
      });
    } catch {
      throw new AiServiceError(
        `Cannot reach the AI service. Start it with npm run start:ai on the backend computer, then reconnect in Settings. ${local}`,
      );
    }
    if (response.status === 404 || response.status === 405) throw new AiServiceError(wrongService);
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new AiServiceError(wrongService);
    }
    if (!response.ok)
      throw new AiServiceError(
        publicAiError(value) ??
          (response.status === 422
            ? `The AI could not use that request with the current scene. Try a specific instruction or reconnect after updating the backend. ${local}`
            : `The AI service could not complete the request. Try again or check the backend configuration. ${local}`),
      );
    return value;
  };
  try {
    return await Promise.race([interrupted, request()]);
  } finally {
    clearTimeout(timer);
    signal.removeEventListener('abort', cancel);
  }
}

export function requestTeachingAi(
  url: string,
  route: 'interpret' | 'analyze',
  body: unknown,
  signal: AbortSignal,
) {
  return requestJson(
    `${aiServiceUrl(url)}/api/${route}-teaching`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
    signal,
    25000,
  );
}

export async function connectAiService(
  url: string,
  signal: AbortSignal,
): Promise<CommandServiceConfig> {
  const base = aiServiceUrl(url);
  const value = await requestJson(`${base}/health`, {}, signal, 5000);
  if (!value || typeof value !== 'object') throw new AiServiceError(wrongService);
  const health = value as Record<string, unknown>;
  if (
    health.status !== 'ok' ||
    typeof health.ai_enabled !== 'boolean' ||
    !['OpenAI', 'OpenRouter', 'Configured AI provider'].includes(String(health.provider))
  )
    throw new AiServiceError(wrongService);
  if (!health.ai_enabled)
    throw new AiServiceError(
      `The backend is running but its API key is missing. Set OPENAI_API_KEY in backend/.env and restart npm run start:ai. ${local}`,
    );
  return { enabled: true, url: base, provider: health.provider as string };
}

export async function connectThisApp(origin: string, signal: AbortSignal) {
  let value: unknown;
  try {
    value = await requestJson('/forma-runtime-config.json', {}, signal, 5000);
  } catch (error) {
    if (error instanceof AiServiceError && error.message === wrongService)
      throw new AiServiceError(noGateway);
    throw error;
  }
  const config = hostedCommandService(value, origin);
  if (!config) throw new AiServiceError(noGateway);
  return connectAiService(config.url, signal);
}
