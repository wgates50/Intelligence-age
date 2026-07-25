/**
 * Bloc dynamics: happiness, membership, extremism, turnout.
 *
 * The membership half is the mechanic the old build most conspicuously lacked.
 * Policies do not just make blocs happy or angry — they change how many people
 * are in them. Deregulate hard and you manufacture a large, furious Displaced
 * Workers bloc and a small, rich Capital Owners bloc, and then you have to
 * govern the country you made. Two runs from an identical start diverge into
 * different societies, which is worth more replay value than doubling the
 * event deck.
 */

import { GROUPS, GROUP_MAP } from "../data/groups.ts";
import { applyInertia, clamp, evaluateTarget, recordTrace } from "./graph.ts";
import type { CompiledGraph } from "./graph.ts";
import { computeTurnout } from "./election.ts";
import type { GameState, GroupState, TraceEntry } from "./types.ts";

export function initGroups(membershipOverrides?: Record<string, number>): Record<string, GroupState> {
  const out: Record<string, GroupState> = {};
  for (const def of GROUPS) {
    out[def.id] = {
      id: def.id,
      membership: membershipOverrides?.[def.id] ?? def.membership,
      happiness: 50,
      extremism: 0,
      turnout: def.baseTurnout,
    };
  }
  return out;
}

export function stepGroups(
  state: GameState,
  graph: CompiledGraph,
  trace: TraceEntry[],
): Record<string, GroupState> {
  const next: Record<string, GroupState> = {};

  for (const def of GROUPS) {
    const prev = state.groups[def.id];

    // ── Happiness ──
    // The baseline offset makes the scenario's inherited policy settlement read
    // as neutral, so what moves a bloc is what the player changed.
    const hRef = `group.${def.id}.happiness`;
    const h = evaluateTarget(state, graph, hRef, 50 + (state.groupBaselines[def.id] ?? 0));
    const happiness = applyInertia(prev.happiness, h.target, def.volatility);
    recordTrace(trace, state.turn, hRef, prev.happiness, happiness, h.contributions);

    // ── Membership ──
    // Bounded per bloc so no group vanishes or swallows the electorate, and
    // slower than happiness: opinion moves in months, composition in years.
    const mRef = `group.${def.id}.membership`;
    const m = evaluateTarget(state, graph, mRef, def.membership);
    const [lo, hi] = def.membershipRange;
    const membership = clamp(applyInertia(prev.membership, m.target, 0.18), lo, hi);
    recordTrace(trace, state.turn, mRef, prev.membership, membership, m.contributions);

    // ── Extremism ──
    // Ratchets under sustained anger and decays slowly when conditions improve —
    // radicalisation is not symmetric with the grievance that caused it.
    const anger = Math.max(0, 32 - happiness);
    const extremism = clamp(
      prev.extremism + anger * 0.22 - (happiness > 45 ? 4 : 1),
      0,
      100,
    );

    const g: GroupState = { id: def.id, membership, happiness, extremism, turnout: prev.turnout };
    g.turnout = computeTurnout(g);
    next[def.id] = g;
  }

  return next;
}

export interface UnrestOutcome {
  events: string[];
  /** Direct penalties applied to sim nodes this turn. */
  push: { target: string; amount: number; note: string }[];
  /** Non-zero when the government falls to the street rather than the ballot box. */
  deposedBy: string | null;
}

/**
 * Sustained, concentrated anger has consequences before polling day.
 *
 * Without this, ignoring a bloc for three years costs nothing until the
 * election, and the optimal play is to run the country into the ground and
 * sprint for the finish. Unrest makes neglect expensive continuously.
 */
export function checkUnrest(state: GameState, difficulty: number): UnrestOutcome {
  const events: string[] = [];
  const push: UnrestOutcome["push"] = [];
  let deposedBy: string | null = null;

  let radicalWeight = 0;

  for (const g of Object.values(state.groups)) {
    const def = GROUP_MAP.get(g.id);
    if (!def) continue;
    const weight = g.membership / 100;
    radicalWeight += (g.extremism / 100) * weight;

    if (g.extremism > 55 && g.happiness < 30) {
      const scale = weight * (g.extremism / 100);
      events.push(`${def.name} mobilise: sustained protest and coordinated industrial action.`);
      push.push({ target: "social_cohesion", amount: -12 * scale, note: `${def.name} unrest` });
      push.push({ target: "media_sentiment", amount: -14 * scale, note: `${def.name} unrest` });
      push.push({ target: "gdp_growth", amount: -8 * scale, note: `${def.name} disruption` });
    }
  }

  // A government can lose the country without losing an election.
  const cohesion = state.sim.social_cohesion ?? 50;
  if (radicalWeight > 0.34 * (1 / difficulty) && cohesion < 24) {
    deposedBy = "Sustained mass unrest and the collapse of social cohesion force the government out.";
  }

  return { events, push, deposedBy };
}
