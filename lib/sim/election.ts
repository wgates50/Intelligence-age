/**
 * Elections, turnout, and the opposition.
 *
 * This is the system that makes the game losable, and therefore the system that
 * makes every other decision cost something. Correct AI policy and survivable AI
 * policy diverge — compute buildout raises bills, safety regulation slows
 * growth, automation levies spook capital — and the question the game actually
 * asks is how much of the right thing you can do and still be in the room when
 * the Threshold arrives.
 */

import { GROUP_MAP } from "../data/groups.ts";
import { clamp } from "./graph.ts";
import type { Rng } from "./rng.ts";
import type { GameState, GroupState, OppositionState } from "./types.ts";

const LEADER_FIRST = ["Adaeze", "Ivan", "Marta", "Rune", "Priya", "Tomas", "Noor", "Estelle", "Kwame", "Lena"];
const LEADER_LAST = ["Vance", "Okonjo", "Halvorsen", "Reyes", "Castellan", "Duarte", "Brennan", "Sorokin"];
const PARTY_NAMES = [
  "National Renewal", "The Common Future", "Progress Union", "Civic Alliance",
  "The People's Mandate", "Forward Bloc", "Sovereign Path",
];

export function makeOpposition(rng: Rng): OppositionState {
  return {
    name: rng.pick(PARTY_NAMES),
    leader: `${rng.pick(LEADER_FIRST)} ${rng.pick(LEADER_LAST)}`,
    economicAxis: Math.round(rng.range(-70, 70)),
    aiAxis: Math.round(rng.range(-70, 70)),
    championing: [],
  };
}

/**
 * The opposition is reactive, not static: each turn it adopts the cause of the
 * angriest blocs weighted by their electoral heft. Neglect a large bloc and you
 * do not merely lose its votes — you hand its grievance to someone with a
 * megaphone, and the loss compounds.
 */
export function updateOpposition(state: GameState): OppositionState {
  const scored = Object.values(state.groups)
    .map((g) => ({ id: g.id, score: (50 - g.happiness) * electoralWeight(g) }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.id);

  return { ...state.politics.opposition, championing: scored };
}

/**
 * Turnout rises with the *intensity* of feeling, not its direction. A furious
 * bloc turns out — against you. That is why quietly ignoring a small, angry,
 * high-turnout group is more dangerous than mildly annoying a large placid one.
 */
export function computeTurnout(group: GroupState): number {
  const def = GROUP_MAP.get(group.id);
  const base = def?.baseTurnout ?? 60;
  const intensity = Math.abs(group.happiness - 50) * 0.32;
  const extremismPush = group.extremism * 0.12;
  return clamp(base + intensity + extremismPush, 10, 98);
}

const electoralWeight = (g: GroupState): number => g.membership * (g.turnout / 100);

/**
 * Probability a bloc backs the incumbent, given how it feels.
 *
 * Centred at 49, not 50, which is a deliberate incumbency advantage. Without it
 * a government that held every bloc at exactly neutral — the definition of "no
 * worse than the settlement they elected you under" — still polled 46% and lost
 * a coin flip twice, so *every* archetype including do-nothing was dead by turn
 * seven and the campaign had no late game to speak of. Real incumbents enjoy
 * name recognition, machinery, and a divided opposition.
 *
 * The effect is that keeping the country roughly where you found it survives,
 * and losing office means you actually made blocs worse off. That is the failure
 * condition the game should be testing for.
 */
function support(happiness: number): number {
  return 1 / (1 + Math.exp(-(happiness - 49) / 12));
}

export interface ElectionResult {
  voteShare: number;
  won: boolean;
  byGroup: { id: string; support: number; weight: number; championed: boolean }[];
  swing: number;
}

export function runElection(state: GameState, rng: Rng): ElectionResult {
  const opp = state.politics.opposition;
  const byGroup: ElectionResult["byGroup"] = [];
  let weighted = 0;
  let total = 0;

  for (const g of Object.values(state.groups)) {
    const def = GROUP_MAP.get(g.id);
    const championed = opp.championing.includes(g.id);

    let s = support(g.happiness);
    if (championed) {
      // Loyalty is the brake on defection: a loyal bloc grumbles, a disloyal one leaves.
      const defection = 0.15 * (1 - (def?.loyalty ?? 40) / 100);
      s = clamp(s - defection, 0, 1);
    }

    const w = electoralWeight(g);
    byGroup.push({ id: g.id, support: s, weight: w, championed });
    weighted += s * w;
    total += w;
  }

  const raw = total > 0 ? (weighted / total) * 100 : 50;

  // Polling error and late swing. The player never gets a clean number, which is
  // the point: you must build a margin, not shave one.
  const swing = rng.normal(0, 3.4);
  // Second and third terms carry an anti-incumbency drag.
  const fatigue = Math.max(0, state.politics.term - 1) * 1.3;

  const voteShare = clamp(raw + swing - fatigue, 0, 100);
  return { voteShare, won: voteShare >= WIN_THRESHOLD, byGroup, swing };
}

/**
 * Vote share needed to stay in office.
 *
 * Below 50 because this is a plurality against a fragmented opposition, not a
 * two-horse race — minor parties and abstention split the anti-incumbent vote.
 * The number matters more than it looks: at a straight 50 the game demanded that
 * the *average* bloc actively like you, so every archetype lost its first
 * election and the campaign never got past turn six. At 47.5 a competent
 * government survives on a merely tolerable record, and losing means you
 * genuinely alienated people rather than just failing to delight them.
 */
export const WIN_THRESHOLD = 47.5;

/**
 * Political capital income.
 *
 * Unlike the old build's flat allowance, PC is *earned by governing well*: a
 * popular, cohesive government can act, an unpopular one seizes up. That
 * produces the virtuous and vicious cycles that make a political game feel like
 * one, and it means a bad early term is survivable but constraining rather than
 * instantly fatal.
 */
export function politicalCapitalIncome(state: GameState): number {
  const groups = Object.values(state.groups);
  const totalWeight = groups.reduce((s, g) => s + electoralWeight(g), 0) || 1;
  const approval =
    groups.reduce((s, g) => s + g.happiness * electoralWeight(g), 0) / totalWeight;

  const income =
    7 +
    (state.politics.mandate - 50) * 0.14 +
    (approval - 50) * 0.16 +
    (state.politics.partyLoyalty - 50) * 0.06 -
    (state.sim.incident_rate - 30) * 0.05;

  return clamp(income, 2, 24);
}

/** Population-weighted approval, 0–100. Used for PC, unrest, and the UI. */
export function approvalRating(state: GameState): number {
  const groups = Object.values(state.groups);
  const total = groups.reduce((s, g) => s + electoralWeight(g), 0) || 1;
  return groups.reduce((s, g) => s + g.happiness * electoralWeight(g), 0) / total;
}
