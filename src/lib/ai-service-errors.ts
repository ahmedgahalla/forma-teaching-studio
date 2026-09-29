// Only fixed backend messages may be shown. Never display arbitrary provider bodies.
const providers = ['OpenAI', 'OpenRouter', 'Configured AI provider'];
const providerMessages = [
  'timed out. Try again or use a local command.',
  "could not be reached. Check the backend computer's internet connection and provider availability, then retry. Local commands still work.",
  'rejected the configured model or request settings. Check that the backend model supports Responses and structured outputs, then restart the backend after any configuration change. Local commands still work.',
  "denied access to the configured model. Check the backend API key's project permissions, model access and provider availability in your region. Local commands still work.",
  'could not find the configured model or API endpoint. Check OPENAI_MODEL and OPENAI_BASE_URL on the backend, then restart it. Local commands still work.',
  'rejected the backend API key. Replace OPENAI_API_KEY on the computer running Nael Teaching Studio and restart its backend. Local commands still work.',
  'has no available quota. Check its API billing and usage limits; ChatGPT subscription usage is separate. Local commands still work.',
  'is temporarily rate limiting requests. Wait briefly and try again, or use a local command.',
  "needs available API credits. Check the provider's billing settings. Local commands still work.",
];
const fixedMessages = new Set([
  ...providers.flatMap(provider => providerMessages.map(message => `${provider} ${message}`)),
  'AI interpretation failed. Try again or use a local command.',
  'AI interpretation is not configured. Use local commands or set OPENAI_API_KEY on the backend.',
  'AI teaching interpretation failed. Try again or use a local command.',
  'AI teaching interpretation timed out. Try again or use a local command.',
  'AI explanation is not configured. Set OPENAI_API_KEY on the backend; scene controls remain available.',
  'The AI could not explain this scene. Ask a specific question about the displayed setup.',
  'AI explanation returned an invalid response. Try again; the model has not changed.',
  'AI explanation timed out. Try again; the model has not changed.',
  'The teaching request was cancelled.',
]);
export function publicAiError(value: unknown): string | undefined {
  if (!value || typeof value !== 'object') return;
  const detail = (value as { detail?: unknown }).detail;
  return typeof detail === 'string' && fixedMessages.has(detail) ? detail : undefined;
}
