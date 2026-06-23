export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function isLikelyEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
