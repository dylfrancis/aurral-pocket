/**
 * What one play loads under Settings' queue length: the tapped track and the
 * ones after it, up to the limit. Under shuffle the tapped track comes first
 * and the rest are drawn at random from the whole source, so a shuffled play
 * of a long playlist doesn't keep hearing the same stretch.
 *
 * `queue` is the play order. `original` is the same tracks in the source's
 * order, which turning shuffle off restores.
 */
export function limitQueue<T extends { id: string }>(
  items: T[],
  startId: string,
  limit: number,
  shuffle: boolean,
): { queue: T[]; original: T[] } {
  const start = items.findIndex((item) => item.id === startId);
  if (limit <= 0 || items.length <= limit || start < 0) {
    return { queue: items, original: items };
  }
  if (!shuffle) {
    const kept = items.slice(start, start + limit);
    return { queue: kept, original: kept };
  }

  const others = items.filter((_, index) => index !== start);
  const drawn = new Set(sample(others, limit - 1));
  const original = items.filter(
    (item, index) => index === start || drawn.has(item),
  );
  return { queue: [items[start], ...drawn], original };
}

/** `count` items drawn without replacement: a partial Fisher–Yates. */
function sample<T>(items: T[], count: number): T[] {
  const pool = [...items];
  const take = Math.min(count, pool.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, take);
}
