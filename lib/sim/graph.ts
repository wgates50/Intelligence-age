/**
 * Graph evaluation.
 *
 * Every simulation and group value is recomputed each turn as:
 *
 *     target = clamp(base + Σ weight_e · f_e(normalised source_e))
 *     value += (target - value) · inertia
 *
 * Contributions are read from *last turn's* values and applied simultaneously
 * (Jacobi iteration). That is deliberate: the influence graph is full of genuine
 * feedback loops — GDP → business confidence → GDP, automation → displaced
 * workers → retraining pressure → automation — and a topological sort would
 * either reject them or impose an arbitrary evaluation order. Simultaneous
 * update plus per-node inertia handles cycles naturally and keeps them stable,
 * while making the lag structure explicit rather than accidental.
 */

import type { Condition, Edge, EdgeFn, GameState, TraceEntry } from "./types.ts";

export const clamp = (v: number, lo = 0, hi = 100): number =>
  v < lo ? lo : v > hi ? hi : v;

/** Applies a transfer function to a normalised 0–1 input, returning 0–1. */
export function transfer(fn: EdgeFn, x: number, at = 0.5): number {
  const t = clamp(x, 0, 1);
  switch (fn) {
    case "linear":
      return t;
    case "inverse":
      return 1 - t;
    case "exponential":
      return t * t;
    case "sigmoid":
      return 1 / (1 + Math.exp(-10 * (t - at)));
    case "threshold":
      return t >= at ? 1 : 0;
  }
}

/**
 * Resolves a source ref to a normalised 0–1 value.
 *
 * Policies contribute their *active* ramp, not the intensity the player selected
 * — a policy enacted this turn contributes nothing yet. This is where
 * implementation lag enters the system.
 */
export function resolveRef(state: GameState, ref: string): number {
  const dot = ref.indexOf(".");
  if (dot < 0) return 0;
  const kind = ref.slice(0, dot);
  const rest = ref.slice(dot + 1);

  switch (kind) {
    case "policy": {
      const p = state.policies[rest];
      return p ? p.active / 100 : 0;
    }
    case "sim": {
      const v = state.sim[rest];
      return v === undefined ? 0 : v / 100;
    }
    case "group": {
      const split = rest.lastIndexOf(".");
      if (split < 0) return 0;
      const g = state.groups[rest.slice(0, split)];
      if (!g) return 0;
      const field = rest.slice(split + 1);
      if (field === "happiness") return g.happiness / 100;
      if (field === "membership") return clamp(g.membership, 0, 100) / 100;
      if (field === "extremism") return g.extremism / 100;
      return 0;
    }
    case "world": {
      if (rest === "capability") return state.world.capability / 100;
      if (rest === "rivalCapability") return state.world.rivalCapability / 100;
      if (rest === "capabilityGap") {
        return clamp(
          50 + (state.world.capability - state.world.rivalCapability) / 2,
          0,
          100,
        ) / 100;
      }
      return 0;
    }
    case "budget": {
      if (rest === "debtRatio") return clamp(state.budget.debtRatio * 50, 0, 100) / 100;
      if (rest === "creditRating") return state.budget.creditRating / 100;
      if (rest === "deficitOfGdp") {
        return clamp(50 - (state.budget.balance / Math.max(1, state.budget.gdp)) * 500, 0, 100) / 100;
      }
      return 0;
    }
    default:
      return 0;
  }
}

export function testCondition(state: GameState, c: Condition): boolean {
  const v = resolveRef(state, c.ref) * 100;
  switch (c.op) {
    case ">":
      return v > c.value;
    case ">=":
      return v >= c.value;
    case "<":
      return v < c.value;
    case "<=":
      return v <= c.value;
  }
}

/** An edge set indexed by target ref, so evaluation is O(edges) not O(nodes·edges). */
export interface CompiledGraph {
  byTarget: Map<string, Edge[]>;
  edges: Edge[];
  /** Per-target midpoint contribution of non-policy edges. See `computeNeutralOffsets`. */
  neutralOffsets: Map<string, number>;
}

/**
 * Resolves a source ref to its *neutral* normalised value — what it reads at the
 * start of a run before anything has happened. Supplied by the data layer so the
 * engine stays ignorant of specific node names.
 */
export type NeutralLookup = (ref: string) => number;

export function compileGraph(edges: readonly Edge[], neutralOf: NeutralLookup): CompiledGraph {
  const byTarget = new Map<string, Edge[]>();
  for (const e of edges) {
    const list = byTarget.get(e.to);
    if (list) list.push(e);
    else byTarget.set(e.to, [e]);
  }
  return { byTarget, edges: [...edges], neutralOffsets: computeNeutralOffsets(byTarget, neutralOf) };
}

/**
 * Auto-centring for non-policy sources.
 *
 * Without this, a node's declared `base` would not mean what the data claims it
 * means: an edge `grid_capacity → energy_price, inverse, +46` contributes a
 * large constant even in a perfectly neutral world, silently shifting the target
 * off its base. Authors would have to hand-compensate every base for the sum of
 * its inbound edges, and rebalance them all whenever any edge changed.
 *
 * So we precompute, per target, what its inbound non-policy edges contribute
 * when every source sits at *its own* neutral, and subtract it.
 *
 * Centring on each source's real base — rather than a blanket 0.5 — matters more
 * than it looks. Several nodes deliberately sit far from the midpoint at the
 * start (diffusion 30, eval coverage 30, capability ~30, because this is a world
 * that has not yet had its transition). Centring those at 0.5 told every
 * downstream node "your inputs are unusually low" on turn one, which drove
 * automation and growth *down* from the first turn and inverted the premise of
 * the game. Centring on the base means a world at rest stays at rest, and every
 * movement the player sees is caused by something they or the world clock did.
 *
 * Policy sources are excluded: an un-enacted policy already contributes zero, so
 * centring them would push every target off-base at the start of the game.
 */
function computeNeutralOffsets(
  byTarget: Map<string, Edge[]>,
  neutralOf: NeutralLookup,
): Map<string, number> {
  const offsets = new Map<string, number>();
  for (const [target, edges] of byTarget) {
    let offset = 0;
    for (const e of edges) {
      if (e.from.startsWith("policy.")) continue;
      offset += e.weight * transfer(e.fn, neutralOf(e.from), e.at);
    }
    offsets.set(target, offset);
  }
  return offsets;
}

export interface Contribution {
  source: string;
  amount: number;
  note?: string;
}

export interface TargetResult {
  target: number;
  contributions: Contribution[];
}

/**
 * Sums the inbound influence on one target.
 *
 * `enactedTurn` gating means an edge with `delay: 2` contributes nothing until
 * the source policy has been active for two turns — the difference between
 * "I funded the grid" and "the grid exists".
 */
export function evaluateTarget(
  state: GameState,
  graph: CompiledGraph,
  target: string,
  base: number,
  extra?: readonly Contribution[],
): TargetResult {
  const edges = graph.byTarget.get(target);
  const contributions: Contribution[] = [];
  let sum = base - (graph.neutralOffsets.get(target) ?? 0);

  if (extra) {
    for (const c of extra) {
      if (c.amount === 0) continue;
      sum += c.amount;
      contributions.push(c);
    }
  }

  if (edges) {
    for (const e of edges) {
      if (e.delay && !sourceMatured(state, e)) continue;
      if (e.condition && !testCondition(state, e.condition)) continue;

      const x = resolveRef(state, e.from);
      const amount = e.weight * transfer(e.fn, x, e.at);
      if (amount === 0) continue;

      sum += amount;
      contributions.push({ source: e.from, amount, note: e.note });
    }
  }

  contributions.sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));
  return { target: clamp(sum), contributions };
}

/** True once a delayed edge's source has been in force long enough. */
function sourceMatured(state: GameState, e: Edge): boolean {
  if (!e.from.startsWith("policy.")) return state.turn >= (e.delay ?? 0);
  const p = state.policies[e.from.slice("policy.".length)];
  if (!p || p.enactedTurn === null) return false;
  return state.turn - p.enactedTurn >= (e.delay ?? 0);
}

/** Moves a value a fraction of the way toward its target. */
export function applyInertia(current: number, target: number, inertia: number): number {
  return current + (target - current) * clamp(inertia, 0, 1);
}

/** Records a movement in the causal trace, if it is large enough to be worth showing. */
export function recordTrace(
  trace: TraceEntry[],
  turn: number,
  target: string,
  from: number,
  to: number,
  contributions: Contribution[],
  minDelta = 0.05,
): void {
  if (Math.abs(to - from) < minDelta) return;
  trace.push({
    turn,
    target,
    from: round2(from),
    to: round2(to),
    contributions: contributions.slice(0, 6).map((c) => ({
      source: c.source,
      amount: round2(c.amount),
      note: c.note,
    })),
  });
}

export const round2 = (v: number): number => Math.round(v * 100) / 100;
