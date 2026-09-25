import { describe, expect, it } from 'vitest';
import { hostedCommandService, savedCommandService } from './command-service';

describe('command service configuration', () => {
  it('retains saved local service settings and explicit opt-outs', () => {
    expect(
      savedCommandService({ enabled: true, url: 'http://127.0.0.1:8000', provider: 'OpenRouter' }),
    ).toEqual({ enabled: true, url: 'http://127.0.0.1:8000', provider: 'OpenRouter' });
    expect(savedCommandService({ enabled: false, url: '' })).toEqual({ enabled: false, url: '' });
    expect(
      savedCommandService({ enabled: false, url: 'https://example.com', provider: 'OpenAI' })
        ?.enabled,
    ).toBe(false);
  });
  it.each([
    null,
    { enabled: true, url: '' },
    { enabled: true, url: 'javascript:alert(1)' },
    { enabled: true, url: 'https://key:secret@example.com' },
  ])('rejects invalid saved settings %j', value => {
    expect(savedCommandService(value)).toBeNull();
  });
  it('resolves the hosted gateway exclusively to this page origin', () => {
    expect(
      hostedCommandService(
        { commandService: { enabled: true, url: 'same-origin', provider: 'OpenRouter' } },
        'https://forma.example.com',
      ),
    ).toEqual({ enabled: true, url: 'https://forma.example.com', provider: 'OpenRouter' });
  });
  it.each([
    {
      commandService: {
        enabled: true,
        url: 'https://elsewhere.example.com',
        provider: 'OpenRouter',
      },
    },
    { commandService: { enabled: false, url: 'same-origin', provider: 'OpenRouter' } },
    { commandService: { enabled: true, url: 'same-origin', provider: 'Unknown' } },
    {
      commandService: {
        enabled: true,
        url: 'same-origin',
        provider: 'OpenRouter',
        apiKey: 'not-allowed',
      },
    },
    { commandService: { enabled: true, url: 'same-origin', provider: 'OpenRouter' }, extra: true },
  ])('rejects unsupported hosted configuration %j', value => {
    expect(hostedCommandService(value, 'https://forma.example.com')).toBeNull();
  });
});
