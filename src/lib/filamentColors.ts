// Shared filament colour matching/dedupe logic - used anywhere a user picks
// a filament colour across printers (queuing, resolving a filament shortage).

export function filamentTypeMatches(
  trayType: string | null,
  reqType: string,
): boolean {
  if (!trayType) return false;
  const a = trayType.toUpperCase();
  const b = reqType.toUpperCase();
  return a === b || a.startsWith(b + " ") || b.startsWith(a + " ");
}

// Named colours are deduplicated by hex, keeping the fullest spool.
// Unrecognised (unnamed) trays are never deduplicated - every one is a
// distinct physical tray and hex alone isn't a trustworthy colour signal.
export function dedupeFilamentColors<T>(
  items: T[],
  getColorHex: (item: T) => string | null,
  getColorName: (item: T) => string | null,
  getRemaining: (item: T) => number,
): { known: T[]; unknown: T[] } {
  const seen = new Map<string, T>();
  const unknown: T[] = [];
  for (const item of items) {
    const colorName = getColorName(item);
    if (colorName) {
      const key = (getColorHex(item) ?? "NOCOLOR").slice(0, 6).toUpperCase();
      const existing = seen.get(key);
      if (!existing || getRemaining(item) > getRemaining(existing)) {
        seen.set(key, item);
      }
    } else {
      unknown.push(item);
    }
  }
  return { known: [...seen.values()], unknown };
}
