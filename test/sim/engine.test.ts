/**
 * Engine invariants.
 *
 * Run with:  node --test test/sim/
 *
 * The data-integrity block is the most valuable part: in a system where content
 * is 300 rows of string-referenced edges, a typo in a node name silently becomes
 * an edge that contributes nothing forever, and no amount of playtesting finds
 * it. These tests fail loudly instead.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { EDGES } from "../../lib/data/edges.ts";
import { GROUPS, GROUP_MAP } from "../../lib/data/groups.ts";
import { POLICIES, POLICY_MAP } from "../../lib/data/policies.ts";
import { SCENARIOS } from "../../lib/data/scenarios.ts";
import { SIM_NODES, SIM_NODE_MAP } from "../../lib/data/simulation.ts";
import { interestRate, taxYield } from "../../lib/sim/budget.ts";
import { clamp, transfer } from "../../lib/sim/graph.ts";
import { makeRng } from "../../lib/sim/rng.ts";
import { CAMPAIGN, createGame, actionCost, tick } from "../../lib/sim/tick.ts";
import type { Action, GameState } from "../../lib/sim/types.ts";

// ── Helpers ──────────────────────────────────────────────────────────────────

function playOut(seed: number, actions: (s: GameState) => Action[] = () => []): GameState {
  const rng = makeRng(seed);
  let state = createGame("us", seed, CAMPAIGN);
  let guard = 0;
  while (!state.politics.outcome && guard++ < 50) state = tick(state, actions(state), rng);
  return state;
}

// ── Data integrity ───────────────────────────────────────────────────────────

describe("data integrity", () => {
  it("every edge source resolves to a real node", () => {
    for (const e of EDGES) {
      const [kind, ...rest] = e.from.split(".");
      const id = rest.join(".");
      if (kind === "policy") assert.ok(POLICY_MAP.has(id), `unknown policy source: ${e.from}`);
      else if (kind === "sim") assert.ok(SIM_NODE_MAP.has(id), `unknown sim source: ${e.from}`);
      else if (kind === "group") {
        const groupId = id.slice(0, id.lastIndexOf("."));
        const field = id.slice(id.lastIndexOf(".") + 1);
        assert.ok(GROUP_MAP.has(groupId), `unknown group source: ${e.from}`);
        assert.ok(["happiness", "membership", "extremism"].includes(field), `bad group field: ${e.from}`);
      } else assert.ok(["world", "budget"].includes(kind), `unknown source kind: ${e.from}`);
    }
  });

  it("every edge target resolves to a real node", () => {
    for (const e of EDGES) {
      const [kind, ...rest] = e.to.split(".");
      const id = rest.join(".");
      if (kind === "sim") assert.ok(SIM_NODE_MAP.has(id), `unknown sim target: ${e.to}`);
      else if (kind === "group") {
        const groupId = id.slice(0, id.lastIndexOf("."));
        const field = id.slice(id.lastIndexOf(".") + 1);
        assert.ok(GROUP_MAP.has(groupId), `unknown group target: ${e.to}`);
        assert.ok(["happiness", "membership"].includes(field), `bad group target field: ${e.to}`);
      } else assert.fail(`edges may only target sim or group nodes, got: ${e.to}`);
    }
  });

  it("only policy sources use delay or condition", () => {
    // Non-policy edges are auto-centred against their source's neutral value.
    // A delayed or conditional non-policy edge would make that offset wobble as
    // the gate flips, silently shifting the target's base. See computeNeutralOffsets.
    for (const e of EDGES) {
      if (e.from.startsWith("policy.")) continue;
      assert.equal(e.delay, undefined, `non-policy edge with delay: ${e.from} → ${e.to}`);
      assert.equal(e.condition, undefined, `non-policy edge with condition: ${e.from} → ${e.to}`);
    }
  });

  it("every policy and every bloc is reachable from the graph", () => {
    const sources = new Set(EDGES.map((e) => e.from));
    const targets = new Set(EDGES.map((e) => e.to));

    for (const p of POLICIES) {
      assert.ok(sources.has(`policy.${p.id}`), `policy "${p.id}" influences nothing`);
    }
    for (const g of GROUPS) {
      assert.ok(targets.has(`group.${g.id}.happiness`), `bloc "${g.id}" is never made happy or angry`);
    }
    for (const n of SIM_NODES) {
      assert.ok(
        sources.has(`sim.${n.id}`) || targets.has(`sim.${n.id}`),
        `sim node "${n.id}" is disconnected`,
      );
    }
  });

  it("scenario overrides reference real ids", () => {
    for (const s of SCENARIOS) {
      for (const id of Object.keys(s.sim ?? {})) assert.ok(SIM_NODE_MAP.has(id), `${s.id}: bad sim ${id}`);
      for (const id of Object.keys(s.policies ?? {})) assert.ok(POLICY_MAP.has(id), `${s.id}: bad policy ${id}`);
      for (const id of Object.keys(s.membership ?? {})) assert.ok(GROUP_MAP.has(id), `${s.id}: bad group ${id}`);
    }
  });

  it("bloc membership starts inside its declared range", () => {
    for (const g of GROUPS) {
      const [lo, hi] = g.membershipRange;
      assert.ok(lo <= g.membership && g.membership <= hi, `${g.id} starts outside its range`);
    }
  });
});

// ── Pure functions ───────────────────────────────────────────────────────────

describe("transfer functions", () => {
  it("all return values inside 0–1", () => {
    for (const fn of ["linear", "inverse", "exponential", "sigmoid", "threshold"] as const) {
      for (let x = -0.5; x <= 1.5; x += 0.1) {
        const v = transfer(fn, x);
        assert.ok(v >= 0 && v <= 1, `${fn}(${x.toFixed(1)}) = ${v}`);
      }
    }
  });

  it("inverse is the mirror of linear", () => {
    assert.equal(transfer("inverse", 0.3) + transfer("linear", 0.3), 1);
  });

  it("threshold is a hard step at `at`", () => {
    assert.equal(transfer("threshold", 0.59, 0.6), 0);
    assert.equal(transfer("threshold", 0.61, 0.6), 1);
  });

  it("clamp bounds both ends", () => {
    assert.equal(clamp(-10), 0);
    assert.equal(clamp(110), 100);
    assert.equal(clamp(42), 42);
  });
});

describe("budget", () => {
  it("tax yield peaks then falls for a mobile base", () => {
    // avoidance 0.6 → theoretical peak at r = √(1/1.8) ≈ 0.745
    const at = (r: number): number => taxYield(100, r, 0.6, 50);
    assert.ok(at(0.75) > at(0.5), "yield should still be rising at 50%");
    assert.ok(at(0.75) > at(1.0), "yield should fall past the peak");
  });

  it("an immobile base is near-monotonic over the playable range", () => {
    const at = (r: number): number => taxYield(100, r, 0.25, 50);
    assert.ok(at(1.0) > at(0.75) && at(0.75) > at(0.5));
  });

  it("weak institutions leak revenue", () => {
    assert.ok(
      taxYield(100, 0.6, 0.5, 80) > taxYield(100, 0.6, 0.5, 20),
      "a state that cannot audit cannot collect",
    );
  });

  it("interest rate rises as the rating falls", () => {
    assert.ok(interestRate(100) < interestRate(50));
    assert.ok(interestRate(50) < interestRate(0));
  });
});

// ── Engine invariants ────────────────────────────────────────────────────────

describe("determinism", () => {
  it("the same seed produces an identical run", () => {
    const a = playOut(4242);
    const b = playOut(4242);
    assert.equal(a.turn, b.turn);
    assert.deepEqual(a.sim, b.sim);
    assert.deepEqual(a.groups, b.groups);
    assert.deepEqual(a.politics.outcome, b.politics.outcome);
  });

  it("different seeds diverge", () => {
    const runs = [1, 2, 3, 4, 5, 6].map((s) => playOut(s));
    const shapes = new Set(runs.map((r) => `${r.turn}:${r.politics.outcome?.kind}:${r.world.capability.toFixed(1)}`));
    assert.ok(shapes.size > 1, "every seed produced the same run — the RNG is not reaching the sim");
  });
});

describe("game state invariants", () => {
  it("every run terminates with an outcome", () => {
    for (const seed of [1, 17, 99, 512, 7777]) {
      const s = playOut(seed);
      assert.ok(s.politics.outcome, `seed ${seed} never terminated`);
      assert.ok(s.turn <= CAMPAIGN.maxTurns, `seed ${seed} ran past maxTurns`);
    }
  });

  it("sim values and happiness stay inside 0–100", () => {
    for (const seed of [3, 33, 333]) {
      const s = playOut(seed);
      for (const [id, v] of Object.entries(s.sim)) {
        assert.ok(v >= 0 && v <= 100 && Number.isFinite(v), `sim.${id} = ${v}`);
      }
      for (const g of Object.values(s.groups)) {
        assert.ok(g.happiness >= 0 && g.happiness <= 100, `${g.id} happiness ${g.happiness}`);
        const [lo, hi] = GROUP_MAP.get(g.id)!.membershipRange;
        assert.ok(g.membership >= lo - 1e-9 && g.membership <= hi + 1e-9, `${g.id} membership ${g.membership}`);
      }
    }
  });

  it("political capital is never negative", () => {
    const greedy = (s: GameState): Action[] =>
      POLICIES.map((p) => ({ kind: "setPolicy", id: p.id, intensity: 100 }) as Action);
    for (const seed of [8, 88]) {
      const s = playOut(seed, greedy);
      assert.ok(s.politics.politicalCapital >= 0);
    }
  });

  it("actions costing more than available capital are refused", () => {
    const state = createGame("us", 1, CAMPAIGN);
    const poor = { ...state, politics: { ...state.politics, politicalCapital: 1 } };
    const after = tick(poor, [{ kind: "setPolicy", id: "portable_benefits", intensity: 80 }], makeRng(1));
    assert.equal(after.policies.portable_benefits.intensity, 0, "unaffordable policy was enacted anyway");
  });
});

describe("policy mechanics", () => {
  it("repeal costs more political capital than enactment", () => {
    const state = createGame("us", 1, CAMPAIGN);
    const enact = actionCost(state, { kind: "setPolicy", id: "portable_benefits", intensity: 60 });
    const enacted = { ...state, policies: { ...state.policies, portable_benefits: { id: "portable_benefits", intensity: 60, active: 60, enactedTurn: 0 } } };
    const repeal = actionCost(enacted, { kind: "setPolicy", id: "portable_benefits", intensity: 0 });
    assert.ok(repeal > enact, "policies must be sticky — repeal should hurt");
  });

  it("effects follow the implementation ramp, not the intensity slider", () => {
    // Grid investment has a 4-turn ramp; one turn in it should be nowhere near full.
    let state = createGame("us", 1, CAMPAIGN);
    state = { ...state, politics: { ...state.politics, politicalCapital: 100 } };
    state = tick(state, [{ kind: "setPolicy", id: "grid_investment", intensity: 100 }], makeRng(1));
    assert.equal(state.policies.grid_investment.intensity, 100);
    assert.ok(state.policies.grid_investment.active <= 25 + 1e-9, "ramp jumped ahead of its implementation time");
  });

  it("a bloc's inherited settlement reads as neutral at turn zero", () => {
    // Scenarios start with taxes already in force. Those must not score as though
    // the electorate had just been handed a tax rise. See calibrateGroupBaselines.
    for (const scenario of SCENARIOS) {
      const s = createGame(scenario.id, 1, CAMPAIGN);
      for (const g of Object.values(s.groups)) {
        assert.equal(g.happiness, 50, `${scenario.id}/${g.id} did not start neutral`);
      }
    }
  });
});
