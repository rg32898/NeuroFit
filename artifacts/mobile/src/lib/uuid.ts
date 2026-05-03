/**
 * Tiny UUID v4-ish helper. Prefers `crypto.randomUUID()` (RN Hermes ≥0.74,
 * web, Node ≥19) and falls back to a time+random concat that's globally
 * unique enough for client-side idempotency keys.
 *
 * We avoid pulling in the `uuid` npm package on purpose — it brings polyfills
 * for Node `crypto` that bloat the RN bundle, and we only need a string
 * that's unlikely to collide across devices.
 */
export function uuidv4(): string {
  const g = globalThis as unknown as { crypto?: { randomUUID?: () => string } };
  if (g.crypto?.randomUUID) return g.crypto.randomUUID();
  // RFC4122-ish fallback: time + 64 bits of randomness, hex-formatted with
  // dashes so it visually matches a real UUID in logs.
  const r = () => Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, "0");
  return `${r()}-${r().slice(0, 4)}-4${r().slice(0, 3)}-${r().slice(0, 4)}-${r()}${r().slice(0, 4)}`;
}
