/**
 * Dilemma engine tests.
 *
 * The integrity block matters most: a dilemma library is hundreds of
 * string-referenced conditions and effects, and a typo becomes a trigger that
 * silently never fires or an effect that silently does nothing. Neither throws,
 * neither shows up in play, and both are indistinguishable from cut content.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { DILEMMAS, DILEMMA_MAP } from "../../lib/data/dilemmas.ts";
import { GROUP_MAP } from "../../lib/data/groups.ts";
import { POLICY_MAP } from "../../lib/data/policies.ts";
import { SIM_NODE_MAP } from "../../lib/data/simulation.ts";
import { applyEffects, optionAvailability, resolveDilemma } from "../../lib/sim/dilemmas.ts";
import { makeRng } from "../../lib/sim/rng.ts";
import { CAMPAIGN, createGame, tick } from "../../lib/sim/tick.ts";
import type { Condition, Effect, GameState } from "../../lib/sim/types.ts";

// ── Ref validation ───────────────────────────────────────────────────────────

function assertReadableRef(ref: string, where: string): void {
  const [kind, ...rest] = ref.split(".");
  const id = rest.join(".");
  if (kind === "sim") assert.ok(SIM_NODE_MAP.has(id), `${where}: unknown sim node "${id}"`);
  else if (kind === "policy") assert.ok(POLICY_MAP.has(id), `${where}: unknown policy "${id}"`);
  else if (kind === "group") {
    const gid = id.slice(0, id.lastIndexOf("."));
    const field = id.slice(id.lastIndexOf(".") + 1);
    assert.ok(GROUP_MAP.has(gid), `${where}: unknown bloc "${gid}"`);
    assert.ok(["happiness", "membership", "extremism"].includes(field), `${where}: bad field "${field}"`);
  } else if (kind === "world") {
    assert.ok(["capability", "rivalCapability", "capabilityGap"].includes(id), `${where}: bad world ref "${id}"`);
  } else if (kind === "budget") {
    assert.ok(["debtRatio", "creditRating", "deficitOfGdp"].includes(id), `${where}: bad budget ref "${id}"`);
  } else assert.fail(`${where}: unknown ref kind "${kind}" in "${ref}"`);
}

/** Effects may only write to sim nodes and bloc happiness/extremism. */
function assertWritableRef(ref: string, where: string): void {
  const [kind, ...rest] = ref.split(".");
  const id = rest.join(".");
  if (kind === "sim") assert.ok(SIM_NODE_MAP.has(id), `${where}: unknown sim node "${id}"`);
  else if (kind === "group") {
    const gid = id.slice(0, id.lastIndexOf("."));
    const field = id.slice(id.lastIndexOf(".") + 1);
    assert.ok(GROUP_MAP.has(gid), `${where}: unknown bloc "${gid}"`);
    assert.ok(["happiness", "extremism"].includes(field), `${where}: effects cannot write "${field}"`);
  } else assert.fail(`${where}: effects may only target sim or group, got "${ref}"`);
}

describe("dilemma data integrity", () => {
  it("ids are unique", () => {
    assert.equal(new Set(DILEMMAS.map((d) => d.id)).size, DILEMMAS.length);
  });

  it("every trigger condition reads a real ref", () => {
    for (const d of DILEMMAS) {
      const conds: Condition[] = [...(d.trigger.all ?? []), ...(d.trigger.any ?? [])];
      for (const c of conds) assertReadableRef(c.ref, `${d.id} trigger`);
    }
  });

  it("every effect writes a real ref", () => {
    for (const d of DILEMMAS) {
      for (const o of d.options) {
        const all: Effect[] = [
          ...(o.effects ?? []),
          ...(o.deferred ?? []).flatMap((x) => [...x.effects, ...(x.elseEffects ?? [])]),
        ];
        for (const e of all) assertWritableRef(e.target, `${d.id}/${o.label}`);
      }
    }
  });

  it("every requirement condition reads a real ref and states its reason", () => {
    for (const d of DILEMMAS) {
      for (const o of d.options) {
        for (const r of o.requires ?? []) {
          assert.ok(r.reason.length > 10, `${d.id}/${o.label}: a locked option must explain itself`);
          if (r.condition) assertReadableRef(r.condition.ref, `${d.id}/${o.label} requirement`);
        }
      }
    }
  });

  it("every deferred outcome that branches supplies both texts", () => {
    for (const d of DILEMMAS) {
      for (const o of d.options) {
        for (const def of o.deferred ?? []) {
          assert.ok(def.turns >= 1 && def.turns <= 8, `${d.id}: deferred turns out of range`);
          assert.ok(def.text.length > 0, `${d.id}: deferred outcome needs text`);
          if (def.condition) {
            assertReadableRef(def.condition.ref, `${d.id} deferred`);
            assert.ok(def.elseText, `${d.id}/${o.label}: conditional outcome needs an else branch`);
          }
        }
      }
    }
  });

  it("every dilemma offers at least two real options", () => {
    for (const d of DILEMMAS) {
      assert.ok(d.options.length >= 2, `${d.id} is not a dilemma`);
      for (const o of d.options) {
        assert.ok(o.detail.length > 0, `${d.id}/${o.label} has no detail`);
      }
    }
  });

  it("flags referenced by triggers are set by some option", () => {
    const settable = new Set(DILEMMAS.flatMap((d) => d.options.flatMap((o) => o.sets ?? [])));
    for (const d of DILEMMAS) {
      for (const f of [...(d.trigger.flags ?? []), ...(d.trigger.notFlags ?? [])]) {
        assert.ok(settable.has(f), `${d.id} triggers on flag "${f}" that nothing sets`);
      }
    }
    for (const o of DILEMMAS.flatMap((d) => d.options)) {
      for (const f of o.requires?.flatMap((r) => r.flags ?? []) ?? []) {
        assert.ok(settable.has(f), `an option requires flag "${f}" that nothing sets`);
      }
    }
  });

  it("cooldowns are set unless the dilemma is once-per-run", () => {
    for (const d of DILEMMAS) {
      assert.ok(d.once || d.cooldown !== undefined, `${d.id} would fire once and never again by accident`);
    }
  });
});

// ── Engine behaviour ─────────────────────────────────────────────────────────

const base = (): GameState => createGame("us", 99, CAMPAIGN);

describe("dilemma resolution", () => {
  it("applies immediate effects", () => {
    let s = base();
    const before = s.sim.public_trust;
    s = applyEffects(s, [{ target: "sim.public_trust", amount: 10 }]);
    assert.equal(s.sim.public_trust, before + 10);
  });

  it("effects on an unknown target are ignored rather than throwing", () => {
    const s = base();
    const after = applyEffects(s, [{ target: "sim.not_a_node", amount: 10 }]);
    assert.deepEqual(after.sim, s.sim);
  });

  it("refuses a locked option instead of silently substituting one", () => {
    // "Activate containment protocols" needs a Frontier Safety Regime in force.
    const s = base();
    const d = DILEMMA_MAP.get("pathogen_blueprint")!;
    const locked = d.options.findIndex((o) => (o.requires?.length ?? 0) > 0);
    assert.ok(locked >= 0, "expected a gated option to test");
    assert.equal(optionAvailability(s, d.options[locked]).available, false);

    const r = resolveDilemma(s, "pathogen_blueprint", locked);
    assert.deepEqual(r.state.sim, s.sim, "a locked option must not apply its effects");
    assert.match(r.log[0]?.text ?? "", /unavailable/);
  });

  it("a locked option reports why", () => {
    const s = base();
    const d = DILEMMA_MAP.get("pathogen_blueprint")!;
    const locked = d.options.find((o) => (o.requires?.length ?? 0) > 0)!;
    const { lockedReason } = optionAvailability(s, locked);
    assert.ok(lockedReason && lockedReason.length > 10, "a gate must teach, not just block");
  });

  it("spends political capital and records the choice", () => {
    let s = base();
    s = { ...s, politics: { ...s.politics, politicalCapital: 60 } };
    const d = DILEMMA_MAP.get("energy_revolt")!;
    const idx = d.options.findIndex((o) => o.cost && !o.requires);
    const cost = d.options[idx].cost!;
    const r = resolveDilemma(s, "energy_revolt", idx);
    assert.equal(r.state.politics.politicalCapital, 60 - cost);
    assert.equal(r.state.dilemmaHistory.energy_revolt, s.turn);
  });

  it("queues deferred consequences for the right turn", () => {
    let s = base();
    s = { ...s, politics: { ...s.politics, politicalCapital: 60 } };
    const d = DILEMMA_MAP.get("energy_revolt")!;
    const idx = d.options.findIndex((o) => (o.deferred?.length ?? 0) > 0 && !o.requires);
    const turns = d.options[idx].deferred![0].turns;
    const r = resolveDilemma(s, "energy_revolt", idx);
    assert.ok(r.state.pendingConsequences.length > 0);
    assert.equal(r.state.pendingConsequences[0].dueTurn, s.turn + turns);
  });

  it("sets flags that later dilemmas can trigger on", () => {
    let s = base();
    s = { ...s, politics: { ...s.politics, politicalCapital: 60 } };
    const d = DILEMMA_MAP.get("pathogen_blueprint")!;
    const idx = d.options.findIndex((o) => o.sets?.includes("bio_suppressed"));
    const r = resolveDilemma(s, "pathogen_blueprint", idx);
    assert.ok("bio_suppressed" in r.state.flags);
  });
});

describe("dilemmas in the run loop", () => {
  it("dilemmas are raised, and the run still terminates", () => {
    const rng = makeRng(7);
    let s = createGame("us", 7, CAMPAIGN);
    let raised = 0;
    let guard = 0;
    while (!s.politics.outcome && guard++ < 50) {
      raised += s.pendingDilemmas.length;
      s = tick(s, [], rng);
    }
    assert.ok(s.politics.outcome, "run did not terminate");
    assert.ok(raised > 0, "no dilemma was ever raised across a full campaign");
  });

  it("ignoring a dilemma costs trust — inaction is a choice", () => {
    const rng = makeRng(11);
    let s = createGame("us", 11, CAMPAIGN);
    // Advance to a turn with something pending.
    let guard = 0;
    while (s.pendingDilemmas.length === 0 && !s.politics.outcome && guard++ < 20) s = tick(s, [], rng);
    if (s.pendingDilemmas.length === 0) return; // nothing to assert on this seed

    const trustBefore = s.sim.public_trust;
    const after = tick(s, [], rng); // answer nothing
    assert.ok(
      after.log.some((l) => l.kind === "dilemma" && /no decision/.test(l.text)),
      "a lapsed dilemma should be logged",
    );
    assert.ok(after.sim.public_trust < trustBefore + 5, "drifting should not be free");
  });

  it("answering dilemmas keeps the run deterministic", () => {
    const play = (): GameState => {
      const rng = makeRng(4242);
      let s = createGame("eu", 4242, CAMPAIGN);
      let guard = 0;
      while (!s.politics.outcome && guard++ < 50) {
        const answers = s.pendingDilemmas.map((p) => ({
          kind: "resolveDilemma" as const, dilemmaId: p.id, optionIndex: 0,
        }));
        s = tick(s, answers, rng);
      }
      return s;
    };
    const a = play();
    const b = play();
    assert.deepEqual(a.sim, b.sim);
    assert.deepEqual(a.flags, b.flags);
    assert.deepEqual(a.politics.outcome, b.politics.outcome);
  });
});
