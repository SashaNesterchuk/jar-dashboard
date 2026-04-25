/**
 * Minimal platform-agnostic ID generator.
 *
 * Uses `crypto.randomUUID()` where available (Node 18+, modern browsers,
 * React Native with `react-native-get-random-values`) and falls back to
 * a v4-shaped pseudo-random string otherwise. The fallback is only used
 * when no `crypto` implementation is present — in practice never in
 * portal or RN runtimes, but kept for SSR corner-cases and tests.
 */

type CryptoLike = {
  randomUUID?: () => string;
};

function getCrypto(): CryptoLike | null {
  const g = globalThis as { crypto?: CryptoLike };
  return g.crypto ?? null;
}

export function newUuid(): string {
  const c = getCrypto();
  if (c?.randomUUID) return c.randomUUID();

  // Pseudo-random fallback — NOT cryptographically strong, but shape-
  // compatible with UUID v4. This branch is unreachable in all
  // supported runtimes; left as a safe net for odd environments.
  const rnd = (bytes: number): string => {
    let s = "";
    for (let i = 0; i < bytes; i += 1) {
      s += Math.floor(Math.random() * 256)
        .toString(16)
        .padStart(2, "0");
    }
    return s;
  };
  return `${rnd(4)}-${rnd(2)}-4${rnd(2).slice(1)}-${rnd(2)}-${rnd(6)}`;
}
