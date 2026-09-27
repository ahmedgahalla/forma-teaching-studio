export function object(value: unknown): Record<string, unknown> {
  if (
    !value ||
    typeof value !== 'object' ||
    Array.isArray(value) ||
    ![Object.prototype, null].includes(Object.getPrototypeOf(value))
  )
    throw new Error('Invalid lecture object.');
  return value as Record<string, unknown>;
}

export function fields(
  value: Record<string, unknown>,
  required: readonly string[],
  optional: readonly string[] = [],
) {
  if (
    required.some(key => !Object.hasOwn(value, key)) ||
    Object.keys(value).some(key => !required.includes(key) && !optional.includes(key))
  )
    throw new Error('Missing or unexpected lecture fields.');
}

export function text(value: unknown, max: number, empty = false): string {
  if (typeof value !== 'string' || value.length > max || (!empty && !value.trim()))
    throw new Error(
      `Lecture text must be ${empty ? 'at most' : 'between 1 and'} ${max} characters.`,
    );
  return value;
}

export function identifier(value: unknown): string {
  if (typeof value !== 'string' || !/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(value))
    throw new Error('Invalid lecture identifier.');
  return value;
}

export function choice<T extends string>(value: unknown, choices: readonly T[]): T {
  if (!choices.includes(value as T)) throw new Error('Unsupported lecture option.');
  return value as T;
}

export function boolean(value: unknown): boolean {
  if (typeof value !== 'boolean') throw new Error('Lecture switches must be true or false.');
  return value;
}
