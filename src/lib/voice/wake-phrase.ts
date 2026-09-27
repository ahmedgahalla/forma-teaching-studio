export const WAKE_ALIASES = ['forma', 'former', 'for ma', "forma's", 'fauna'] as const;
export const WAKE_PREFIXES = ['hey', 'okay', 'ok'] as const;
export const FOLLOW_UP_MS = 6000;
export type WakeCommand = { text: string; alias: boolean };

const aliases = [...WAKE_ALIASES]
  .sort((a, b) => b.length - a.length)
  .map(alias => alias.replace(/ /g, '\\s+'))
  .join('|');
const wakePhrase = new RegExp(
  `^(?:(?:${WAKE_PREFIXES.join('|')})[\\s,]+)?(${aliases})(?=$|[\\s,.:;!?—-])[\\s,.:;!?—-]*`,
  'i',
);

export function matchWakePhrase(text: string): WakeCommand | null {
  const normalized = text.trim().replace(/’/g, "'");
  const match = wakePhrase.exec(normalized);
  return match
    ? { text: normalized.slice(match[0].length).trim(), alias: !/^for\s*ma$/i.test(match[1]) }
    : null;
}

/** null means no wake phrase; an empty string means a bare wake phrase. */
export function stripWakePhrase(text: string): string | null {
  return matchWakePhrase(text)?.text ?? null;
}

/** Retains only a deadline, never discarded classroom speech. */
export function createWakePhraseGate(now: () => number = Date.now) {
  let armedUntil = 0;
  return {
    accept(text: string, canStop = false): WakeCommand | null {
      const command = matchWakePhrase(text);
      if (command) {
        armedUntil = command.text || command.alias ? 0 : now() + FOLLOW_UP_MS;
        return command.text ? command : null;
      }
      const stop = /^\s*(stop|cancel)[.!?]*\s*$/i.exec(text);
      if (stop && canStop) {
        armedUntil = 0;
        return { text: stop[1].toLowerCase(), alias: false };
      }
      if (armedUntil > now() && text.trim()) {
        armedUntil = 0;
        return { text: text.trim(), alias: false };
      }
      return null;
    },
    armed: () => armedUntil > now(),
    reset() {
      armedUntil = 0;
    },
  };
}
