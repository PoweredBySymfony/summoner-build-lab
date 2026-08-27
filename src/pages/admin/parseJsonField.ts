export function parseJsonField<T>(value: string, fallback: T) {
  const trimmed = value.trim();
  if (!trimmed) {
    return fallback;
  }

  return JSON.parse(trimmed) as T;
}
