export type CommandServiceConfig = { enabled: boolean; url: string; provider?: string };
const providers = ['OpenAI', 'OpenRouter', 'Configured AI provider'];

export function savedCommandService(value: unknown): CommandServiceConfig | null {
  if (!value || typeof value !== 'object') return null;
  const saved = value as Record<string, unknown>;
  if (typeof saved.enabled !== 'boolean' || typeof saved.url !== 'string') return null;
  if (!saved.enabled && saved.url === '') return { enabled: false, url: '' };
  try {
    const url = new URL(saved.url);
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
    return {
      enabled: saved.enabled,
      url: saved.url,
      provider:
        typeof saved.provider === 'string' && providers.includes(saved.provider)
          ? saved.provider
          : undefined,
    };
  } catch {
    return null;
  }
}

// Hosting may enable its own authenticated gateway, never nominate another server.
export function hostedCommandService(value: unknown, origin: string): CommandServiceConfig | null {
  if (!value || typeof value !== 'object' || Object.keys(value).join() !== 'commandService')
    return null;
  const service = (value as Record<string, unknown>).commandService;
  if (
    !service ||
    typeof service !== 'object' ||
    Object.keys(service).sort().join() !== 'enabled,provider,url'
  )
    return null;
  const config = service as Record<string, unknown>;
  if (
    config.enabled !== true ||
    config.url !== 'same-origin' ||
    typeof config.provider !== 'string' ||
    !providers.includes(config.provider)
  )
    return null;
  return { enabled: true, url: origin, provider: config.provider };
}
