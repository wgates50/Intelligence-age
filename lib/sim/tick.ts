/**
 * The turn function.
 *
 * `tick(state, actions, rng) -> state` is pure and deterministic. Given the same
 * seed, scenario, and action sequence it always produces the same run. That is
 * what buys replays, shareable seeds, regression tests over balance changes,
 * and — later — server-side verification of leaderboard submissions.
 *
 * Nothing in this file knows the name of a specific policy, bloc, or node.
 */

import { EDGES } from "../data/edges.ts";
import { GROUPS, GROUP_MAP } from "../data/groups.ts";
import { POLICIES, POLICY_MAP } from "../data/policies.ts";
import { SCENARIO_MAP } from "../data/scenarios.ts";
import { SIM_NODES, SIM_NODE_MAP } from "../data/simulation.ts";
import { initBudget, runBudget } from "./budget.ts";
import { approvalRating, makeOpposition, politicalCapitalIncome, runElection, updateOpposition } from "./election.ts";
import {
  applyInertia, clamp, compileGraph, evaluateTarget, recordTrace,
} from "./graph.ts";
import type { CompiledGraph, Contribution } from "./graph.ts";
import {
  lapseDilemmas, resolveDilemma, resolvePendingConsequences, selectDilemmas,
} from "./dilemmas.ts";
import { checkUnrest, initGroups, stepGroups } from "./groups.ts";
import type { Rng } from "./rng.ts";
import { makeRng } from "./rng.ts";
import { advanceCapability, initWorld, rollRisks, stepLabs } from "./world.ts";
import type { Action, GameState, LogEntry, RunConfig, TraceEntry } from "./types.ts";
export type { Action };

/** Capability at the start of a run, used to centre the world-clock edges. */
export const NEUTRAL_CAPABILITY = 30;

/**
 * The neutral reading of every source ref — what the graph should treat as
 * "nothing has happened yet". See `computeNeutralOffsets` for why this must be
 * each source's own base rather than a blanket midpoint.
 */
function neutralOf(ref: string): number {
  const dot = ref.indexOf(".");
  const kind = ref.slice(0, dot);
  const rest = ref.slice(dot + 1);

  switch (kind) {
    case "sim":
      return (SIM_NODE_MAP.get(rest)?.base ?? 50) / 100;
    case "group": {
      const split = rest.lastIndexOf(".");
      const id = rest.slice(0, split);
      const field = rest.slice(split + 1);
      if (field === "membership") return (GROUP_MAP.get(id)?.membership ?? 10) / 100;
      if (field === "extremism") return 0;
      return 0.5; // happiness
    }
    case "world":
      return rest === "capabilityGap" ? 0.5 : NEUTRAL_CAPABILITY / 100;
    case "budget":
      // debtRatio 1.0 maps to 0.5 under resolveRef's scaling; the others sit mid.
      return rest === "creditRating" ? 0.55 : 0.5;
    default:
      return 0;
  }
}

export const GRAPH: CompiledGraph = compileGraph(EDGES, neutralOf);

export const CAMPAIGN: RunConfig = {
  mode: "campaign", turnsPerTerm: 4, maxTurns: 12, thresholdCapability: 78, difficulty: 1,
};
export const BRIEFING: RunConfig = {
  mode: "briefing", turnsPerTerm: 4, maxTurns: 4, thresholdCapability: 999, difficulty: 1,
};

// ── Initialisation ───────────────────────────────────────────────────────────

export function createGame(
  scenarioId: string,
  seed: number,
  config: RunConfig = CAMPAIGN,
): GameState {
  const scenario = SCENARIO_MAP.get(scenarioId);
  if (!scenario) throw new Error(`unknown scenario: ${scenarioId}`);
  const rng = makeRng(seed);

  const sim: Record<string, number> = {};
  for (const n of SIM_NODES) sim[n.id] = scenario.sim?.[n.id] ?? n.base;

  const policies: GameState["policies"] = {};
  for (const p of POLICIES) {
    const start = scenario.policies?.[p.id] ?? 0;
    policies[p.id] = {
      id: p.id,
      intensity: start,
      active: start, // inherited policy is already bedded in
      enactedTurn: start > 0 ? -p.implementation : null,
    };
  }

  const state: GameState = {
    seed,
    scenarioId,
    turn: 0,
    year: 2026,
    config,
    policies,
    sim,
    groups: initGroups(scenario.membership),
    groupBaselines: {},
    pendingDilemmas: [],
    pendingConsequences: [],
    dilemmaHistory: {},
    flags: {},
    budget: initBudget(scenario),
    world: initWorld(rng),
    politics: {
      turnsToElection: config.turnsPerTerm,
      term: 1,
      politicalCapital: 30,
      mandate: 52,
      partyLoyalty: 65,
      opposition: makeOpposition(rng),
      outcome: null,
    },
    trace: [],
    log: [],
  };

  state.groupBaselines = calibrateGroupBaselines(state);
  return state;
}

/**
 * Makes the inherited settlement read as neutral.
 *
 * Every scenario starts with policy already in force — the US with a 42% income
 * tax, the EU with that plus portable benefits. Those policies have real
 * happiness edges, and taxes only have *negative* ones (their benefits arrive
 * indirectly, through the sim nodes the spending improves). So a scenario's
 * starting position scored as though the electorate had just been handed a tax
 * rise it never voted for, and every bloc opened the game below 50. Every
 * strategy then lost its first election, which the harness caught immediately.
 *
 * The fix is also the more truthful model of politics: voters react to changes
 * from the settlement they already live under, not to its absolute level. Nobody
 * marches against a tax rate that has existed their whole life. So we measure
 * each bloc's target under the inherited policy set and treat *that* as its
 * zero. An EU electorate is not permanently furious about being the EU.
 *
 * The consequence for play is the right one: what moves people is what *you*
 * change, and inheriting a high-tax state means the political cost of those
 * taxes is already paid — but so is the political capital you might have earned
 * by cutting them.
 */
function calibrateGroupBaselines(state: GameState): Record<string, number> {
  const baselines: Record<string, number> = {};
  for (const g of GROUPS) {
    const r = evaluateTarget(state, GRAPH, `group.${g.id}.happiness`, 50);
    baselines[g.id] = 50 - r.target;
  }
  return baselines;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** Political capital cost of a proposed change, before it is applied. */
export function actionCost(state: GameState, action: Action): number {
  if (action.kind !== "setPolicy") return 0;
  const def = POLICY_MAP.get(action.id);
  const cur = state.policies[action.id];
  if (!def || !cur) return 0;

  const target = clamp(action.intensity);
  if (target === cur.intensity) return 0;
  if (cur.intensity === 0 && target > 0) return def.introCost;
  if (target === 0 && cur.intensity > 0) return def.cancelCost;
  return Math.ceil((Math.abs(target - cur.intensity) / 10) * def.adjustCost);
}

/** Applies affordable actions in order, spending political capital. Invalid ones are skipped. */
export function applyActions(input: GameState, actions: readonly Action[]): GameState {
  let state = input;
  let pc = state.politics.politicalCapital;
  const policies = { ...state.policies };
  const log: LogEntry[] = [];

  for (const a of actions) {
    if (a.kind === "resolveDilemma") {
      const r = resolveDilemma({ ...state, policies, politics: { ...state.politics, politicalCapital: pc } },
        a.dilemmaId, a.optionIndex);
      state = r.state;
      pc = state.politics.politicalCapital;
      log.push(...r.log);
      continue;
    }
    if (a.kind !== "setPolicy") continue;
    const def = POLICY_MAP.get(a.id);
    const cur = policies[a.id];
    if (!def || !cur) continue;

    const cost = actionCost({ ...state, policies }, a);
    if (cost > pc) continue;

    const target = clamp(a.intensity);
    if (target === cur.intensity) continue;
    pc -= cost;

    policies[a.id] = {
      ...cur,
      intensity: target,
      enactedTurn: cur.intensity === 0 && target > 0 ? state.turn : target === 0 ? null : cur.enactedTurn,
      active: target === 0 ? cur.active : cur.active,
    };

    log.push({
      turn: state.turn,
      kind: "policy",
      text:
        cur.intensity === 0
          ? `Enacted ${def.name} at ${target}%.`
          : target === 0
            ? `Repealed ${def.name}.`
            : `${def.name} adjusted ${cur.intensity}% → ${target}%.`,
    });
  }

  return {
    ...state,
    policies,
    politics: { ...state.politics, politicalCapital: pc },
    log: [...state.log, ...log],
  };
}

// ── The turn ─────────────────────────────────────────────────────────────────

export function tick(prev: GameState, actions: readonly Action[], rng: Rng): GameState {
  if (prev.politics.outcome) return prev;

  let state = applyActions(prev, actions);
  const trace: TraceEntry[] = [];
  const log: LogEntry[] = [];
  const difficulty = state.config.difficulty;

  // 0 ── Dilemmas left unanswered lapse, and drifting is never free. Then any
  // consequences that have come due land *before* the graph runs, so a decision
  // made three years ago moves this year's world rather than next year's.
  const lapsed = lapseDilemmas(state);
  state = lapsed.state;
  log.push(...lapsed.log);

  const consequences = resolvePendingConsequences(state);
  state = consequences.state;
  log.push(...consequences.log);

  // 1 ── Policy implementation ramps.
  // Effects follow the *active* value, so enacting a four-year programme in your
  // final year buys you the cost and none of the benefit.
  const policies = { ...state.policies };
  for (const p of Object.values(policies)) {
    const def = POLICY_MAP.get(p.id);
    if (!def) continue;
    const step = 100 / Math.max(1, def.implementation);
    const active =
      p.active < p.intensity
        ? Math.min(p.intensity, p.active + step)
        : Math.max(p.intensity, p.active - step * 1.5); // unwinding is faster than building
    policies[p.id] = { ...p, active };
  }
  state = { ...state, policies };

  // 2 ── The world moves whether or not you did.
  const cap = advanceCapability(state, rng);
  const labs = stepLabs(state, rng);
  state = {
    ...state,
    world: { ...state.world, capability: cap.capability, rivalCapability: cap.rival, labs: labs.labs },
  };
  for (const e of labs.events) log.push({ turn: state.turn, kind: "world", text: e });

  // 3 ── Risk register.
  const risks = rollRisks(state, rng, difficulty);
  state = {
    ...state,
    world: {
      ...state.world,
      hazards: risks.hazards,
      incidents: [...state.world.incidents, ...risks.incidents],
    },
  };
  for (const i of risks.incidents) {
    log.push({ turn: state.turn, kind: "incident", text: `${i.headline} (severity ${i.severity})` });
  }

  // 4 ── Unrest, from last turn's anger.
  const unrest = checkUnrest(state, difficulty);
  for (const e of unrest.events) log.push({ turn: state.turn, kind: "unrest", text: e });

  // 5 ── Simulation graph.
  // Every node is evaluated against last turn's values and stepped
  // simultaneously, so feedback loops resolve over turns rather than within one.
  const extras: Record<string, Contribution[]> = {};
  const addExtra = (target: string, c: Contribution): void => {
    (extras[target] ??= []).push(c);
  };
  addExtra("sim.incident_rate", { source: "world.incidents", amount: risks.incidentPush, note: "Live incidents" });
  addExtra("sim.regulatory_capture", { source: "world.labs", amount: labs.capturePush, note: "Industry lobbying" });
  for (const p of unrest.push) {
    addExtra(`sim.${p.target}`, { source: "groups.unrest", amount: p.amount, note: p.note });
  }

  const nextSim: Record<string, number> = {};
  for (const node of SIM_NODES) {
    const ref = `sim.${node.id}`;
    const r = evaluateTarget(state, GRAPH, ref, node.base, extras[ref]);
    nextSim[node.id] = applyInertia(state.sim[node.id], r.target, node.inertia);
    recordTrace(trace, state.turn, ref, state.sim[node.id], nextSim[node.id], r.contributions);
  }

  // 6 ── Blocs react to the world as it was, then the world becomes the new one.
  const nextGroups = stepGroups(state, GRAPH, trace);
  state = { ...state, sim: nextSim, groups: nextGroups };

  // 7 ── Budget.
  const scenario = SCENARIO_MAP.get(state.scenarioId);
  const budget = runBudget(state, scenario?.costMultiplier ?? 1);
  state = { ...state, budget: budget.budget };
  if (budget.budget.debtRatio > 2.2) {
    log.push({
      turn: state.turn, kind: "budget",
      text: `Debt reaches ${(budget.budget.debtRatio * 100).toFixed(0)}% of GDP. Borrowing costs are compounding.`,
    });
  }

  // 8 ── Politics.
  const opposition = updateOpposition(state);
  let politics = {
    ...state.politics,
    opposition,
    politicalCapital: clamp(state.politics.politicalCapital + politicalCapitalIncome(state), 0, 120),
    partyLoyalty: clamp(
      applyInertia(state.politics.partyLoyalty, 30 + approvalRating(state) * 0.7, 0.25),
    ),
    turnsToElection: state.politics.turnsToElection - 1,
  };
  state = { ...state, politics };

  const turn = state.turn + 1;

  // 9 ── Termination, in priority order: deposed, defeated, Threshold, term limit.
  if (unrest.deposedBy) {
    politics = { ...politics, outcome: { kind: "deposed", turn, cause: unrest.deposedBy } };
    log.push({ turn, kind: "outcome", text: unrest.deposedBy });
  } else if (politics.turnsToElection <= 0 && turn < state.config.maxTurns) {
    const result = runElection(state, rng);
    log.push({
      turn, kind: "election",
      text: `Election: ${result.voteShare.toFixed(1)}% — ${result.won ? "returned to office" : `defeated by ${opposition.name} (${opposition.leader})`}.`,
    });
    politics = result.won
      ? {
          ...politics,
          outcome: null,
          term: politics.term + 1,
          mandate: result.voteShare,
          turnsToElection: state.config.turnsPerTerm,
          politicalCapital: clamp(politics.politicalCapital + (result.voteShare - 50) * 0.8, 0, 120),
        }
      : { ...politics, outcome: { kind: "defeated", turn, voteShare: result.voteShare } };
  }

  if (!politics.outcome && state.world.capability >= state.config.thresholdCapability) {
    politics = { ...politics, outcome: { kind: "threshold", turn } };
    log.push({ turn, kind: "outcome", text: "A system surpasses expert human performance across all domains." });
  } else if (!politics.outcome && turn >= state.config.maxTurns) {
    politics = { ...politics, outcome: { kind: "termLimit", turn } };
  }

  // 10 ── Raise the dilemmas the new world makes relevant. Selected against the
  // state as it now stands, so what lands on the desk is a consequence of the
  // turn that just happened rather than a card off the top of a deck.
  const advanced: GameState = { ...state, turn, year: 2026 + turn, politics };
  const pendingDilemmas = politics.outcome ? [] : selectDilemmas(advanced, rng);

  return {
    ...advanced,
    pendingDilemmas,
    trace: trace.slice(0, 400),
    // Every entry produced by this tick is stamped with the turn the tick ended
    // on. Entries were previously stamped inconsistently — policy changes with
    // the pre-increment turn, elections with the post-increment one — so a
    // single tick emitted entries under two different turn numbers and any
    // consumer filtering by turn showed them twice.
    log: [...state.log, ...log.map((e) => ({ ...e, turn }))],
  };
}

/** Convenience: the number of blocs currently in open revolt. */
export function radicalisedCount(state: GameState): number {
  return Object.values(state.groups).filter((g) => g.extremism > 55 && g.happiness < 30).length;
}

export const ALL_POLICY_IDS: readonly string[] = POLICIES.map((p) => p.id);
export const ALL_GROUP_IDS: readonly string[] = GROUPS.map((g) => g.id);
