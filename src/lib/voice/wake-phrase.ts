export const WAKE_ALIASES = ['forma', 'former', 'for ma', "forma's", 'fauna'] as const;
export const WAKE_PREFIXES = ['hey', 'okay', 'ok'] as const;
export const FOLLOW_UP_MS = 6000;

const aliases = [...WAKE_ALIASES]
  .sort((a, b) => b.length - a.length)
  .map(alias => alias.replace(/ /g, '\\s+'))
  .join('|');
const wakePhrase = new RegExp(
  `^(?:(?:${WAKE_PREFIXES.join('|')})[\\s,]+)?(?:${aliases})(?=$|[\\s,.:;!?—-])[\\s,.:;!?—-]*`,
  'i',
);

/** null means no wake phrase; an empty string means a bare wake phrase. */
export function stripWakePhrase(text: string): string | null {
  const normalized = text.trim().replace(/’/g, "'");
  const match = wakePhrase.exec(normalized);
  return match ? normalized.slice(match[0].length).trim() : null;
}

/** Retains only a deadline, never discarded classroom speech. */
export function createWakePhraseGate(now: () => number = Date.now) {
  let armedUntil = 0;
  return {
    accept(text: string, canStop = false): string | null {
      const command = stripWakePhrase(text);
      if (command !== null) {
        armedUntil = command ? 0 : now() + FOLLOW_UP_MS;
        return command || null;
      }
      const stop = /^\s*(stop|cancel)[.!?]*\s*$/i.exec(text);
      if (stop && canStop) {
        armedUntil = 0;
        return stop[1].toLowerCase();
      }
      if (armedUntil > now() && text.trim()) {
        armedUntil = 0;
        return text.trim();
      }
      return null;
    },
    armed: () => armedUntil > now(),
    reset() {
      armedUntil = 0;
    },
  };
}
