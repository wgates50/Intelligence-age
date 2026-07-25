/**
 * Headless balance harness.
 *
 * A graph this size cannot be balanced by hand — an edge-weight change three
 * hops away from a bloc can flip an election, and no amount of playtesting will
 * find that reliably. So every tuning change gets run through a few thousand
 * automated games first.
 *
 * What it is looking for:
 *   - a dominant strategy (one archetype winning far too often)
 *   - a dead strategy (one that cannot win at all)
 *   - degenerate nodes (pinned at 0 or 100 across every run)
 *   - runs that never terminate for an interesting reason
 *
 * Usage:
 *   node test/balance/harness.ts
 *   node test/balance/harness.ts --runs 400 --scenario eu
 *   node test/balance/harness.ts --trace us --seed 7   # single annotated run
 */

import { SCENARIOS } from "../../lib/data/scenarios.ts";
import { SIM_NODES } from "../../lib/data/simulation.ts";
import { GROUP_MAP } from "../../lib/data/groups.ts";
import { POLICY_MAP } from "../../lib/data/policies.ts";
import { approvalRating } from "../../lib/sim/election.ts";
import { makeRng } from "../../lib/sim/rng.ts";
import type { Rng } from "../../lib/sim/rng.ts";
import { CAMPAIGN, actionCost, createGame, tick } from "../../lib/sim/tick.ts";
import type { Action, GameState } from "../../lib/sim/types.ts";

// ── Strategy archetypes ──────────────────────────────────────────────────────

interface Strategy {
  name: string;
  blurb: string;
  plan: Record<string, number>;
}

/**
 * Each archetype is a target policy mix. The driver walks toward it as political
 * capital allows, which is itself a test: a plan that is unaffordable in
 * practice should show up as a losing strategy.
 */
const STRATEGIES: readonly Strategy[] = [
  {
    name: "laissez-faire", blurb: "Inherit the tax base, change nothing",
    plan: {},
  },
  {
    name: "accelerate", blurb: "Max compute, cut capital taxes, no safety regime",
    plan: {
      datacentre_buildout: 90, grid_investment: 55, chip_industrial_policy: 60,
      corporate_tax: 20, capital_gains_tax: 15, income_tax: 45,
    },
  },
  {
    name: "safety-first", blurb: "Full frontier regime, controls, interpretability",
    plan: {
      frontier_safety_regime: 90, audit_bureau: 80, interpretability_research: 70,
      open_weight_restrictions: 70, compute_levy: 45, international_accord: 60,
      income_tax: 55, corporate_tax: 40,
    },
  },
  {
    name: "social-democrat", blurb: "Redistribute hard, protect labour",
    plan: {
      portable_benefits: 80, retraining: 75, sovereign_wealth_fund: 70,
      worker_codetermination: 65, automation_levy: 55,
      income_tax: 60, corporate_tax: 45, capital_gains_tax: 50,
    },
  },
  {
    name: "technocrat", blurb: "Institutions and literacy first, then compute",
    plan: {
      audit_bureau: 75, ai_literacy: 70, grid_investment: 65, public_ai_access: 60,
      frontier_safety_regime: 50, retraining: 50, datacentre_buildout: 45,
      international_accord: 55, income_tax: 52, corporate_tax: 36,
    },
  },
  {
    name: "populist", blurb: "Cheap energy and cash, no long-horizon investment",
    plan: {
      sovereign_wealth_fund: 70, portable_benefits: 60, grid_investment: 45,
      income_tax: 35, corporate_tax: 30, automation_levy: 40,
    },
  },
  {
    name: "spread-thin", blurb: "A little of everything — the old game's dominant play",
    plan: Object.fromEntries([...POLICY_MAP.keys()].map((id) => [id, 35])),
  },
];

/** Walks toward the plan, cheapest affordable moves first. */
function planActions(state: GameState, plan: Record<string, number>): Action[] {
  const candidates: { action: Action; cost: number; gap: number }[] = [];

  for (const [id, target] of Object.entries(plan)) {
    const cur = state.policies[id];
    if (!cur || cur.intensity === target) continue;
    // Move in steps so political capital is spread across turns rather than
    // blown on a single enactment.
    const step = cur.intensity < target ? Math.min(target, cur.intensity + 30) : Math.max(target, cur.intensity - 30);
    const action: Action = { kind: "setPolicy", id, intensity: step };
    candidates.push({ action, cost: actionCost(state, action), gap: Math.abs(target - cur.intensity) });
  }

  // Prioritise the biggest gap per unit of political capital.
  candidates.sort((a, b) => b.gap / Math.max(1, b.cost) - a.gap / Math.max(1, a.cost));

  const out: Action[] = [];
  let pc = state.politics.politicalCapital;
  for (const c of candidates) {
    if (c.cost > pc) continue;
    pc -= c.cost;
    out.push(c.action);
  }
  return out;
}

function randomPlan(rng: Rng): Record<string, number> {
  const plan: Record<string, number> = {};
  for (const id of POLICY_MAP.keys()) {
    if (rng.chance(0.45)) plan[id] = Math.round(rng.range(10, 90));
  }
  return plan;
}

// ── Run a game ───────────────────────────────────────────────────────────────

interface RunResult {
  strategy: string;
  scenario: string;
  seed: number;
  outcome: string;
  turns: number;
  approval: number;
  capability: number;
  alignment: number;
  debtRatio: number;
  incidents: number;
  severeIncidents: number;
  finalSim: Record<string, number>;
  /** Composite "did the transition go well" score, 0–100. */
  stewardship: number;
}

function stewardshipScore(s: GameState): number {
  const good =
    s.sim.alignment_confidence * 0.2 +
    s.sim.eval_coverage * 0.12 +
    s.sim.social_cohesion * 0.15 +
    s.sim.public_trust * 0.13 +
    s.sim.gdp_growth * 0.12 +
    (100 - s.sim.inequality) * 0.13 +
    s.sim.institutional_capacity * 0.15;
  const severePenalty = s.world.incidents.filter((i) => i.severity > 65).length * 3;
  return Math.max(0, Math.min(100, good - severePenalty));
}

function playOne(scenarioId: string, seed: number, strategy: Strategy, useRandom: boolean): RunResult {
  const rng = makeRng(seed);
  let state = createGame(scenarioId, seed, CAMPAIGN);
  const plan = useRandom ? randomPlan(rng.fork(1)) : strategy.plan;

  while (!state.politics.outcome) {
    state = tick(state, planActions(state, plan), rng);
  }

  const finalSim: Record<string, number> = {};
  for (const n of SIM_NODES) finalSim[n.id] = state.sim[n.id];

  return {
    strategy: strategy.name,
    scenario: scenarioId,
    seed,
    outcome: state.politics.outcome.kind,
    turns: state.turn,
    approval: approvalRating(state),
    capability: state.world.capability,
    alignment: state.sim.alignment_confidence,
    debtRatio: state.budget.debtRatio,
    incidents: state.world.incidents.length,
    severeIncidents: state.world.incidents.filter((i) => i.severity > 65).length,
    finalSim,
    stewardship: stewardshipScore(state),
  };
}

// ── Reporting ────────────────────────────────────────────────────────────────

const mean = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
const pct = (n: number, d: number): string => `${((n / Math.max(1, d)) * 100).toFixed(0)}%`;
const pad = (s: string, n: number): string => s.padEnd(n);
const num = (v: number, n = 5, d = 1): string => v.toFixed(d).padStart(n);

function report(results: RunResult[]): void {
  const strategies = [...new Set(results.map((r) => r.strategy))];

  console.log("\n═══ SURVIVAL & STEWARDSHIP BY STRATEGY ═══\n");
  console.log(
    pad("strategy", 17), pad("n", 5), pad("survive", 8), pad("defeat", 7), pad("deposed", 8),
    pad("stwrd", 7), pad("apprv", 7), pad("cap", 7), pad("align", 7), pad("debt", 6), "incid",
  );
  console.log("─".repeat(104));

  const summary: { name: string; survival: number; stewardship: number }[] = [];

  for (const name of strategies) {
    const rs = results.filter((r) => r.strategy === name);
    const survived = rs.filter((r) => r.outcome === "threshold" || r.outcome === "termLimit").length;
    const defeated = rs.filter((r) => r.outcome === "defeated").length;
    const deposed = rs.filter((r) => r.outcome === "deposed").length;

    summary.push({ name, survival: survived / rs.length, stewardship: mean(rs.map((r) => r.stewardship)) });

    console.log(
      pad(name, 17), pad(String(rs.length), 5), pad(pct(survived, rs.length), 8),
      pad(pct(defeated, rs.length), 7), pad(pct(deposed, rs.length), 8),
      pad(num(mean(rs.map((r) => r.stewardship))), 7),
      pad(num(mean(rs.map((r) => r.approval))), 7),
      pad(num(mean(rs.map((r) => r.capability))), 7),
      pad(num(mean(rs.map((r) => r.alignment))), 7),
      pad(num(mean(rs.map((r) => r.debtRatio)), 4, 2), 6),
      num(mean(rs.map((r) => r.incidents)), 4),
    );
  }

  // ── Dominant / dead strategy detection ──
  console.log("\n═══ DIAGNOSTICS ═══\n");
  const survivalSpread = summary.map((s) => s.survival);
  const best = summary.reduce((a, b) => (b.survival > a.survival ? b : a));
  const worst = summary.reduce((a, b) => (b.survival < a.survival ? b : a));

  const issues: string[] = [];
  if (best.survival > 0.9 && best.survival - worst.survival > 0.5) {
    issues.push(`DOMINANT: "${best.name}" survives ${pct(best.survival, 1)} vs "${worst.name}" at ${pct(worst.survival, 1)}.`);
  }
  for (const s of summary) {
    if (s.survival === 0) issues.push(`DEAD: "${s.name}" never survives a full campaign.`);
  }
  if (Math.max(...survivalSpread) - Math.min(...survivalSpread) < 0.12) {
    issues.push("FLAT: strategies are near-indistinguishable on survival — choices may not matter enough.");
  }

  // ── Degenerate nodes ──
  for (const n of SIM_NODES) {
    const vals = results.map((r) => r.finalSim[n.id]);
    const m = mean(vals);
    const spread = Math.max(...vals) - Math.min(...vals);
    if (m > 96) issues.push(`PINNED HIGH: sim.${n.id} averages ${m.toFixed(1)}.`);
    if (m < 4) issues.push(`PINNED LOW: sim.${n.id} averages ${m.toFixed(1)}.`);
    if (spread < 6) issues.push(`INERT: sim.${n.id} varies by only ${spread.toFixed(1)} across all runs.`);
  }

  // ── Outcome mix ──
  const outcomes = ["threshold", "termLimit", "defeated", "deposed"];
  console.log("outcome mix:");
  for (const o of outcomes) {
    const n = results.filter((r) => r.outcome === o).length;
    console.log(`  ${pad(o, 12)} ${pad(pct(n, results.length), 6)} (${n})`);
  }
  console.log(`  ${pad("mean turns", 12)} ${mean(results.map((r) => r.turns)).toFixed(1)}`);
  console.log();

  // ── Where every node actually settles ──
  // The single most useful table for tuning: a node that never leaves its base,
  // or that saturates in every run, is a design that is not doing anything.
  console.log("final sim node distribution (mean · min · max across all runs):");
  for (const n of SIM_NODES) {
    const vals = results.map((r) => r.finalSim[n.id]);
    const lo = Math.min(...vals);
    const hi = Math.max(...vals);
    const m = mean(vals);
    const bar = "·".repeat(Math.round(lo / 5)) + "█".repeat(Math.max(1, Math.round((hi - lo) / 5)));
    console.log(
      `  ${pad(n.id, 24)} ${num(m)} ${num(lo)} ${num(hi)}  base ${String(n.base).padStart(3)}  ${bar}`,
    );
  }
  console.log();

  if (issues.length === 0) console.log("No balance red flags.\n");
  else for (const i of issues) console.log(`  ⚠ ${i}`);
  console.log();
}

// ── Single annotated run, for reading the causal chains ──────────────────────

function traceRun(scenarioId: string, seed: number, strategyName: string): void {
  const strategy = STRATEGIES.find((s) => s.name === strategyName) ?? STRATEGIES[4];
  const rng = makeRng(seed);
  let state = createGame(scenarioId, seed, CAMPAIGN);

  console.log(`\n═══ ${scenarioId.toUpperCase()} · seed ${seed} · "${strategy.name}" ═══`);
  console.log(`${strategy.blurb}\n`);

  while (!state.politics.outcome) {
    const before = state.turn;
    state = tick(state, planActions(state, strategy.plan), rng);

    console.log(`── ${state.year} (turn ${state.turn}) ${"─".repeat(46)}`);
    console.log(
      `   approval ${approvalRating(state).toFixed(0)}  ·  PC ${state.politics.politicalCapital.toFixed(0)}` +
      `  ·  capability ${state.world.capability.toFixed(0)}  ·  debt ${(state.budget.debtRatio * 100).toFixed(0)}% GDP`,
    );

    for (const l of state.log.filter((e) => e.turn >= before)) {
      console.log(`   [${l.kind}] ${l.text}`);
    }

    // The three largest movements this turn, with their causes — this is the
    // output the node-web UI will render.
    const moves = state.trace
      .filter((t) => t.turn >= before)
      .sort((a, b) => Math.abs(b.to - b.from) - Math.abs(a.to - a.from))
      .slice(0, 3);
    for (const m of moves) {
      const delta = m.to - m.from;
      console.log(`   ${m.target}  ${m.from.toFixed(0)} → ${m.to.toFixed(0)} (${delta > 0 ? "+" : ""}${delta.toFixed(1)})`);
      for (const c of m.contributions.slice(0, 3)) {
        console.log(`       ${c.amount > 0 ? "+" : ""}${c.amount.toFixed(1)}  ${c.source}${c.note ? ` — ${c.note}` : ""}`);
      }
    }
    console.log();
  }

  const o = state.politics.outcome;
  console.log(`RESULT: ${o.kind}${"voteShare" in o ? ` at ${o.voteShare.toFixed(1)}%` : ""}${"cause" in o ? ` — ${o.cause}` : ""}`);
  console.log(`stewardship ${stewardshipScore(state).toFixed(1)}  ·  incidents ${state.world.incidents.length}\n`);

  console.log("Final blocs (membership% · happiness):");
  for (const g of Object.values(state.groups).sort((a, b) => b.membership - a.membership)) {
    const def = GROUP_MAP.get(g.id);
    const bar = "█".repeat(Math.round(g.happiness / 5)).padEnd(20, "·");
    console.log(`  ${pad(def?.name ?? g.id, 22)} ${num(g.membership, 5)}%  ${bar} ${g.happiness.toFixed(0)}`);
  }
  console.log();
}

// ── CLI ──────────────────────────────────────────────────────────────────────

function main(): void {
  const argv = process.argv.slice(2);
  const arg = (flag: string): string | undefined => {
    const i = argv.indexOf(flag);
    return i >= 0 ? argv[i + 1] : undefined;
  };

  const traceScenario = arg("--trace");
  if (traceScenario) {
    traceRun(traceScenario, Number(arg("--seed") ?? 1), arg("--strategy") ?? "technocrat");
    return;
  }

  const runs = Number(arg("--runs") ?? 200);
  const only = arg("--scenario");
  const scenarios = only ? SCENARIOS.filter((s) => s.id === only) : SCENARIOS;
  const results: RunResult[] = [];

  const t0 = Date.now();
  for (const scenario of scenarios) {
    for (const strategy of STRATEGIES) {
      for (let i = 0; i < runs; i++) {
        results.push(playOne(scenario.id, i * 7919 + 13, strategy, false));
      }
    }
    // A random-policy control group: if random play does as well as designed
    // strategies, the systems are not discriminating.
    for (let i = 0; i < runs; i++) {
      results.push(playOne(scenario.id, i * 104729 + 5, { name: "random", blurb: "", plan: {} }, true));
    }
  }

  console.log(
    `\n${results.length} runs across ${scenarios.length} scenario(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`,
  );
  report(results);
}

main();
