/**
 * Seeded, deterministic RNG.
 *
 * Every stochastic decision in the simulation draws from one of these so that a
 * (seed, scenario, action-sequence) triple always reproduces the same run. That
 * buys replays, shareable seeds, regression tests, and — eventually —
 * server-side verification of leaderboard submissions.
 */

export interface Rng {
  /** Uniform in [0, 1). */
  next(): number;
  /** Uniform integer in [0, n). */
  int(n: number): number;
  /** Uniform float in [lo, hi). */
  range(lo: number, hi: number): number;
  /** True with probability p. */
  chance(p: number): boolean;
  /** Uniformly picks one element. Throws on an empty array. */
  pick<T>(items: readonly T[]): T;
  /** Picks one element with the given non-negative weights. */
  weighted<T>(items: readonly T[], weight: (item: T) => number): T;
  /** Fisher-Yates copy. */
  shuffle<T>(items: readonly T[]): T[];
  /** Approximately normal, via the sum of three uniforms. */
  normal(mean: number, sd: number): number;
  /** A fresh generator derived from this one — for isolating subsystems. */
  fork(salt: number): Rng;
}

/** Mulberry32 — small, fast, and good enough for game simulation. */
export function makeRng(seed: number): Rng {
  let s = seed >>> 0;

  const next = (): number => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const rng: Rng = {
    next,
    int: (n) => Math.floor(next() * n),
    range: (lo, hi) => lo + next() * (hi - lo),
    chance: (p) => next() < p,

    pick(items) {
      if (items.length === 0) throw new Error("rng.pick: empty array");
      return items[Math.floor(next() * items.length)];
    },

    weighted(items, weight) {
      if (items.length === 0) throw new Error("rng.weighted: empty array");
      const weights = items.map((i) => Math.max(0, weight(i)));
      const total = weights.reduce((a, b) => a + b, 0);
      if (total <= 0) return items[Math.floor(next() * items.length)];
      let r = next() * total;
      for (let i = 0; i < items.length; i++) {
        r -= weights[i];
        if (r <= 0) return items[i];
      }
      return items[items.length - 1];
    },

    shuffle(items) {
      const out = [...items];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j], out[i]];
      }
      return out;
    },

    // Sum of three uniforms: mean 1.5, variance 0.25 → sd 0.5.
    normal(mean, sd) {
      const u = next() + next() + next();
      return mean + ((u - 1.5) / 0.5) * sd;
    },

    fork: (salt) => makeRng((s ^ Math.imul(salt, 0x9e3779b9)) >>> 0),
  };

  return rng;
}

/** Stable 32-bit hash, for turning a scenario name or share-code into a seed. */
export function hashSeed(text: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
