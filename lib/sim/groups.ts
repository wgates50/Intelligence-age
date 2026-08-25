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
    // Accumulation is *superlinear* in anger, and that is the whole point.
    //
    // A linear rate could not reach the mobilisation threshold before a run
    // ended: even under deliberately hostile governing, peak extremism across
    // 300 runs was 22 against a bar of 45, so unrest and the deposed ending were
    // unreachable content. Radicalisation does not scale with grievance evenly —
    // mild dissatisfaction produces grumbling indefinitely, while a bloc pushed
    // to genuine desperation organises fast.
    //
    // Squaring the anger term means a bloc at 35 happiness stays merely sullen
    // for the length of a campaign, while one held at 15 radicalises inside two
    // terms. Losing the country to the street is now reachable, but only by
    // abandoning a specific bloc completely rather than governing generally badly.
    const anger = Math.max(0, 40 - happiness);
    const extremism = clamp(
      prev.extremism + (anger * anger) / 26 - (happiness > 45 ? 5 : 1),
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

  // Share of the population sitting inside a *fully* radicalised bloc, rather
  // than an extremism-weighted average across everyone. Averaging let broad mild
  // discontent substitute for concentrated fury, which is backwards: revolutions
  // are made by the committed minority, not the mildly annoyed majority.
  let radicalisedShare = 0;

  for (const g of Object.values(state.groups)) {
    const def = GROUP_MAP.get(g.id);
    if (!def) continue;
    const weight = g.membership / 100;
    if (g.extremism > 60) radicalisedShare += weight;

    if (g.extremism > 45 && g.happiness < 35) {
      const scale = weight * (g.extremism / 100);
      events.push(`${def.name} mobilise: sustained protest and coordinated industrial action.`);
      // Scaled hard, because `scale` is a product of two fractions and stays
      // small even for a fully radicalised large bloc — at the original weights
      // a nationwide revolt moved social cohesion by well under a point a turn,
      // and the node it was supposed to break never fell far enough to break.
      push.push({ target: "social_cohesion", amount: -55 * scale, note: `${def.name} unrest` });
      push.push({ target: "media_sentiment", amount: -45 * scale, note: `${def.name} unrest` });
      push.push({ target: "gdp_growth", amount: -30 * scale, note: `${def.name} disruption` });
      push.push({ target: "public_trust", amount: -35 * scale, note: `${def.name} unrest` });
    }
  }

  // Radicalisation erodes cohesion *directly*, not only through the disruption
  // its protests cause. Without this the two deposed conditions could not
  // co-occur: the strategies that radicalise one bloc hardest (abandon rural,
  // buy off everyone else) were also funding the benefits that prop cohesion
  // up, so a country with 18% of its people in open revolt still scored as
  // socially healthy. A society containing an irreconcilable bloc that size is
  // not cohesive, whatever its welfare spending says.
  if (radicalisedShare > 0.02) {
    push.push({
      target: "social_cohesion",
      amount: -140 * radicalisedShare,
      note: `${(radicalisedShare * 100).toFixed(0)}% of the country has stopped accepting the settlement`,
    });
  }

  // A government can lose the country without losing an election.
  // Cohesion is deliberately the slowest node in the game (inertia 0.12), so a
  // twelve-turn campaign cannot drag it far below 40 however badly things go.
  // The bar is set to where the node actually reaches rather than to a round
  // number — the difference between a rare ending and a dead one.
  const cohesion = state.sim.social_cohesion ?? 50;
  if (radicalisedShare > 0.15 * (1 / difficulty) && cohesion < 45) {
    deposedBy = "Sustained mass unrest and the collapse of social cohesion force the government out.";
  }

  return { events, push, deposedBy };
}
