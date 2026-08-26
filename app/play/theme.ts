/**
 * Design tokens, lifted from the original game so the simulation build reads as
 * the same product rather than a different one bolted on. Warm off-white paper,
 * a serif for headlines, a mono for anything numeric — the editorial identity is
 * doing real work here, because a screen this dense needs the typography to
 * carry the hierarchy.
 */

export const T = {
  bg: "#F8F6F1",
  sf: "#FFFFFF",
  sa: "#F2F0EB",
  bd: "#E2DFD8",
  tx: "#1A1A1A",
  t2: "#5C5852",
  tm: "#8A857C",
  tf: "#B5B0A7",
  ac: "#2563EB",
  gd: "#16A34A",
  gb: "#F0FDF4",
  wn: "#CA8A04",
  wb: "#FEFCE8",
  bad: "#DC2626",
  bb: "#FEF2F2",
} as const;

export const S = {
  page: { minHeight: "100vh", background: T.bg, color: T.tx, fontFamily: "'Outfit',sans-serif" },
  mono: { fontFamily: "'JetBrains Mono',monospace" },
  serif: { fontFamily: "'Newsreader',serif", fontWeight: 800, lineHeight: 1.15 },
  card: {
    background: T.sf,
    border: `1px solid ${T.bd}`,
    borderRadius: 12,
    boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
  },
  label: {
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase" as const,
    fontFamily: "'JetBrains Mono',monospace",
    color: T.tm,
  },
} as const;

/** Green when good, amber mid, red when bad — flipped for nodes where low is better. */
export function valueColour(value: number, goodHigh = true): string {
  const v = goodHigh ? value : 100 - value;
  return v >= 60 ? T.gd : v >= 40 ? T.wn : T.bad;
}
