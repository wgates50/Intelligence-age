/**
 * The dilemma engine.
 *
 * The old build shuffled a deck: ~50 events, era-weighted, drawn at random. You
 * saw roughly a sixth of them per run and the correct answer to each was fixed,
 * so the deck was memorised long before it was exhausted.
 *
 * Here dilemmas declare the *conditions under which they are relevant* and the
 * engine draws from whatever the world currently makes eligible. The same
 * content library produces a different run because what fires is a function of
 * the country you built — an energy revolt only happens if you actually made
 * energy expensive and rural voters angry. Events feel earned rather than dealt.
 *
 * Three further departures from the old design:
 *
 *  - **Options are gated, and locked ones are shown with their reason.** You
 *    cannot activate containment protocols you never built. Seeing the locked
 *    option is how the player learns what to build next run.
 *  - **Consequences are deferred.** Most options resolve 2–6 turns later,
 *    through the graph, often conditionally on the state of the world at that
 *    point. The bill for a decision arrives after the decision that caused it
 *    has stopped feeling recent.
 *  - **The player never sees the numbers.** Each option carries an advisor's
 *    forecast in words. Choices are judgement, not arithmetic.
 */

import { DILEMMAS, DILEMMA_MAP } from "../data/dilemmas.ts";
import { clamp, resolveRef, testCondition } from "./graph.ts";
import type { Rng } from "./rng.ts";
import type {
  Condition, DilemmaDef, DilemmaOption, Effect, GameState,
  LogEntry, PendingDilemma, Requirement, ResolvedConsequence, Trigger,
} from "./types.ts";

// ── Eligibility ──────────────────────────────────────────────────────────────

function triggerHolds(state: GameState, t: Trigger): boolean {
  if (t.minTurn !== undefined && state.turn < t.minTurn) return false;
  if (t.flags && !t.flags.every((f) => f in state.flags)) return false;
  if (t.notFlags && t.notFlags.some((f) => f in state.flags)) return false;
  if (t.all && !t.all.every((c) => testCondition(state, c))) return false;
  if (t.any && t.any.length > 0 && !t.any.some((c) => testCondition(state, c))) return false;
  return true;
}

function isEligible(state: GameState, d: DilemmaDef): boolean {
  const lastSeen = state.dilemmaHistory[d.id];
  if (lastSeen !== undefined) {
    if (d.once || d.cooldown === undefined) return false;
    if (state.turn - lastSeen < d.cooldown) return false;
  }
  return triggerHolds(state, d.trigger);
}

/**
 * Picks the dilemmas for this turn.
 *
 * Weighted rather than uniform, so a world can have a dominant theme without
 * every turn being about the same thing. Capped at two per turn: the point is a
 * decision the player thinks about, not an inbox.
 */
export function selectDilemmas(state: GameState, rng: Rng, max = 2): PendingDilemma[] {
  const eligible = DILEMMAS.filter((d) => isEligible(state, d));
  if (eligible.length === 0) return [];

  const picked: PendingDilemma[] = [];
  const pool = [...eligible];
  const count = Math.min(max, pool.length, rng.next() < 0.45 ? 1 : 2);

  for (let i = 0; i < count; i++) {
    const choice = rng.weighted(pool, (d) => d.weight ?? 1);
    picked.push({ id: choice.id, raisedTurn: state.turn });
    pool.splice(pool.indexOf(choice), 1);
    if (pool.length === 0) break;
  }
  return picked;
}

// ── Option availability ──────────────────────────────────────────────────────

export interface OptionAvailability {
  available: boolean;
  /** Why it is locked — surfaced to the player verbatim. */
  lockedReason?: string;
}

/**
 * Whether an option can be taken, and if not, why.
 *
 * The reason matters as much as the verdict: "requires an AI Audit Bureau with
 * three years of operation" tells the player what to build, and turns a locked
 * option into next run's plan rather than this run's frustration.
 */
export function optionAvailability(state: GameState, option: DilemmaOption): OptionAvailability {
  if (option.cost !== undefined && state.politics.politicalCapital < option.cost) {
    return { available: false, lockedReason: `Needs ${option.cost} political capital` };
  }
  for (const r of option.requires ?? []) {
    if (r.politicalCapital !== undefined && state.politics.politicalCapital < r.politicalCapital) {
      return { available: false, lockedReason: r.reason };
    }
    if (r.flags && !r.flags.every((f) => f in state.flags)) {
      return { available: false, lockedReason: r.reason };
    }
    if (r.condition && !testCondition(state, r.condition)) {
      return { available: false, lockedReason: r.reason };
    }
  }
  return { available: true };
}

// ── Resolution ───────────────────────────────────────────────────────────────

/** Applies a list of effects to sim nodes and bloc happiness. */
export function applyEffects(state: GameState, effects: readonly Effect[]): GameState {
  const sim = { ...state.sim };
  const groups = { ...state.groups };

  for (const e of effects) {
    if (e.target.startsWith("sim.")) {
      const id = e.target.slice(4);
      if (sim[id] !== undefined) sim[id] = clamp(sim[id] + e.amount);
    } else if (e.target.startsWith("group.")) {
      const rest = e.target.slice(6);
      const split = rest.lastIndexOf(".");
      const gid = rest.slice(0, split);
      const field = rest.slice(split + 1);
      const g = groups[gid];
      if (!g) continue;
      if (field === "happiness") groups[gid] = { ...g, happiness: clamp(g.happiness + e.amount) };
      else if (field === "extremism") groups[gid] = { ...g, extremism: clamp(g.extremism + e.amount) };
    }
  }
  return { ...state, sim, groups };
}

export interface DilemmaResolution {
  state: GameState;
  log: LogEntry[];
}

/**
 * Applies the player's answer to one dilemma.
 *
 * Unavailable options are refused rather than silently downgraded — a locked
 * choice the engine quietly substituted would make the gating meaningless.
 */
export function resolveDilemma(
  state: GameState,
  dilemmaId: string,
  optionIndex: number,
): DilemmaResolution {
  const def = DILEMMA_MAP.get(dilemmaId);
  const log: LogEntry[] = [];
  if (!def) return { state, log };

  const option = def.options[optionIndex];
  if (!option) return { state, log };

  const availability = optionAvailability(state, option);
  if (!availability.available) {
    log.push({
      turn: state.turn, kind: "dilemma",
      text: `${def.title}: "${option.label}" unavailable — ${availability.lockedReason}.`,
    });
    return { state, log };
  }

  let next = { ...state };

  if (option.cost) {
    next = {
      ...next,
      politics: {
        ...next.politics,
        politicalCapital: Math.max(0, next.politics.politicalCapital - option.cost),
      },
    };
  }

  if (option.effects) next = applyEffects(next, option.effects);

  if (option.sets) {
    const flags = { ...next.flags };
    for (const f of option.sets) flags[f] = next.turn;
    next = { ...next, flags };
  }

  if (option.deferred && option.deferred.length > 0) {
    next = {
      ...next,
      pendingConsequences: [
        ...next.pendingConsequences,
        ...option.deferred.map((d): ResolvedConsequence => ({
          dueTurn: next.turn + d.turns,
          dilemmaId,
          effects: d.effects,
          text: d.text,
          condition: d.condition,
          elseEffects: d.elseEffects,
          elseText: d.elseText,
        })),
      ],
    };
  }

  next = {
    ...next,
    dilemmaHistory: { ...next.dilemmaHistory, [dilemmaId]: next.turn },
    pendingDilemmas: next.pendingDilemmas.filter((p) => p.id !== dilemmaId),
  };

  log.push({ turn: next.turn, kind: "dilemma", text: `${def.title} — ${option.label}.` });
  return { state: next, log };
}

/**
 * Resolves consequences that have come due.
 *
 * A deferred outcome may branch on the world *at resolution time*, not at the
 * time of the choice. That is the mechanic that rewards preparation you made for
 * reasons you have since forgotten: the retraining programme you funded three
 * years ago decides how the layoff wave you are living through now lands.
 */
export function resolvePendingConsequences(state: GameState): DilemmaResolution {
  const due = state.pendingConsequences.filter((c) => c.dueTurn <= state.turn);
  if (due.length === 0) return { state, log: [] };

  const log: LogEntry[] = [];
  let next = { ...state, pendingConsequences: state.pendingConsequences.filter((c) => c.dueTurn > state.turn) };

  for (const c of due) {
    const holds = c.condition === undefined || testCondition(next, c.condition);
    const effects = holds ? c.effects : (c.elseEffects ?? []);
    const text = holds ? c.text : (c.elseText ?? c.text);
    next = applyEffects(next, effects);
    log.push({ turn: next.turn, kind: "consequence", text });
  }
  return { state: next, log };
}

/**
 * Unanswered dilemmas lapse, and inaction is itself a choice with a price.
 *
 * Called *after* the player's actions have been applied, so anything still
 * sitting in `pendingDilemmas` is by definition unanswered — no turn arithmetic
 * needed. An earlier version compared `raisedTurn` and required a full turn to
 * elapse, which meant nothing ever lapsed: the next turn's selection overwrote
 * the list first, so ignoring a dilemma was completely free and completely
 * silent. Drifting is now cheap but never free.
 */
export function lapseDilemmas(state: GameState): DilemmaResolution {
  const stale = state.pendingDilemmas;
  if (stale.length === 0) return { state, log: [] };

  const log: LogEntry[] = [];
  let next = state;
  for (const p of stale) {
    const def = DILEMMA_MAP.get(p.id);
    if (!def) continue;
    // Drifting costs trust and a little media goodwill — not catastrophic, but
    // never free. A government that answers nothing should not out-perform one
    // that makes unpopular calls.
    next = applyEffects(next, [
      { target: "sim.public_trust", amount: -2.5 },
      { target: "sim.media_sentiment", amount: -3 },
    ]);
    log.push({ turn: next.turn, kind: "dilemma", text: `${def.title}: no decision taken. The story moves on without you.` });
  }
  next = {
    ...next,
    dilemmaHistory: Object.fromEntries([
      ...Object.entries(next.dilemmaHistory),
      ...stale.map((p) => [p.id, next.turn] as const),
    ]),
    pendingDilemmas: next.pendingDilemmas.filter((p) => !stale.includes(p)),
  };
  return { state: next, log };
}

/** Reads a ref for display, e.g. in a dilemma's briefing text. */
export const readRef = (state: GameState, ref: string): number => resolveRef(state, ref) * 100;

export type { Condition, Requirement };
