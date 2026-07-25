/**
 * The AI world-sim: capability clock, frontier labs, rival blocs, risk register.
 *
 * This is the layer Democracy has no equivalent of, and it is what stops the
 * game being a reskin. The world moves whether or not you act, at a rate you
 * only partly control, and the actors inside it have their own incentives.
 */

import { clamp } from "./graph.ts";
import type { Rng } from "./rng.ts";
import type { GameState, Incident, LabState, WorldState } from "./types.ts";

const LAB_PREFIXES = ["Meridian", "Aleph", "Corvid", "Halcyon", "Quorum", "Vantage", "Sable", "Lumen"];
const LAB_SUFFIXES = ["Research", "Labs", "Systems", "Intelligence", "Dynamics", "Institute"];

/** Labs are procedurally seeded each run, so the industry you regulate differs. */
export function makeLabs(rng: Rng, count: number): LabState[] {
  const prefixes = rng.shuffle(LAB_PREFIXES);
  return Array.from({ length: count }, (_, i) => ({
    id: `lab_${i}`,
    name: `${prefixes[i]} ${rng.pick(LAB_SUFFIXES)}`,
    domestic: i < Math.ceil(count * 0.6),
    capability: rng.range(28, 48),
    safetyCulture: rng.range(20, 80),
    marketShare: 0,
    lobbyingPower: rng.range(25, 75),
    riskAppetite: rng.range(25, 80),
    relationship: 50,
  })).map((lab, _i, all) => ({ ...lab, marketShare: 100 / all.length }));
}

export function initWorld(rng: Rng): WorldState {
  return {
    capability: rng.range(26, 34),
    rivalCapability: rng.range(22, 32),
    labs: makeLabs(rng, 4),
    hazards: { bio: 8, cyber: 10, autonomy: 5, disinfo: 12, market: 8, alignment: 6 },
    incidents: [],
  };
}

// ── Capability clock ─────────────────────────────────────────────────────────

/**
 * Capability advances on a stochastic curve. Compute is the main lever the
 * player has on it, and it cuts both ways: the same buildout that wins the race
 * shortens the time you have to prepare for it.
 *
 * The jitter is what makes runs diverge. Two identical strategies can face the
 * Threshold three turns apart, which is the difference between "my institutions
 * were ready" and "they were two years from ready".
 */
export function advanceCapability(state: GameState, rng: Rng): { capability: number; rival: number } {
  const compute = state.sim.compute_supply ?? 40;
  const labPush = avg(state.world.labs.map((l) => l.capability));

  // Capability compounds: each generation of systems accelerates the next.
  //
  // The *shape* is what gives the campaign its structure, and it took tuning to
  // get right. A linear clock made the first term already deteriorating, so no
  // government survived long enough to use the institutions it had built. A
  // superlinear one buys a slow opening you can build in, then takes the brakes
  // off — by the third term capability is moving faster than any policy with a
  // three-year implementation lag can respond to. Everything you did not build
  // by turn eight, you are not going to have.
  //
  // It is also why the Threshold lands on a different turn every run, and in
  // plenty of runs never arrives at all.
  const curve = (c: number): number => 0.35 + Math.pow(c / 50, 1.7);
  const domesticRate =
    3.1 * (0.55 + compute / 110) * curve(state.world.capability) *
    (0.8 + labPush / 220) * rng.range(0.72, 1.42);

  // Rivals gain from your export controls being weak and from their own base.
  const controls = state.policies.export_controls?.active ?? 0;
  const rivalRate =
    3.0 * (1 - (controls / 100) * 0.32) * curve(state.world.rivalCapability) * rng.range(0.72, 1.4);

  // Racing pressure: a rival pulling ahead pushes domestic labs to cut corners.
  const gap = state.world.rivalCapability - state.world.capability;
  const catchUp = gap > 6 ? 0.35 : 0;

  return {
    capability: clamp(state.world.capability + domesticRate + catchUp, 0, 100),
    rival: clamp(state.world.rivalCapability + rivalRate, 0, 100),
  };
}

// ── Labs ─────────────────────────────────────────────────────────────────────

export interface LabOutcome {
  labs: LabState[];
  /** Direct push onto `sim.regulatory_capture`, from lobbying. */
  capturePush: number;
  events: string[];
}

/**
 * Labs act on their own logic each turn.
 *
 * The central tension: regulation you cannot enforce is worse than none, and
 * regulation that is too tight relocates the industry beyond your reach — you
 * lose the tax base *and* the oversight, and the capability clock keeps running.
 * The optimum moves with the world state, so it cannot be memorised.
 */
export function stepLabs(state: GameState, rng: Rng): LabOutcome {
  const regime = state.policies.frontier_safety_regime?.active ?? 0;
  const levy = state.policies.compute_levy?.active ?? 0;
  const capacity = state.sim.institutional_capacity ?? 50;
  const events: string[] = [];
  let capturePush = 0;

  const labs = state.world.labs.map((lab) => {
    const next = { ...lab };

    next.capability = clamp(
      lab.capability + rng.range(0.6, 2.4) * (0.6 + state.sim.compute_supply / 130),
      0,
      100,
    );

    // Domestic labs drift toward the safety culture your regime demands — but
    // only to the extent you can actually inspect them.
    if (lab.domestic) {
      const enforced = (regime / 100) * (0.35 + capacity / 150);
      next.safetyCulture = clamp(lab.safetyCulture + (enforced * 100 - lab.safetyCulture) * 0.18);

      const pressure = regime * 0.6 + levy * 0.5;
      const flightRisk = Math.max(0, (pressure - 55) / 100) * (lab.riskAppetite / 100);
      if (rng.chance(flightRisk * 0.35)) {
        next.domestic = false;
        next.relationship = clamp(lab.relationship - 25);
        events.push(`${lab.name} relocates its frontier programme offshore, beyond your regulatory reach.`);
      }
    } else {
      next.safetyCulture = clamp(lab.safetyCulture + rng.range(-2, 1.5));
    }

    if (lab.domestic) capturePush += (lab.lobbyingPower / 100) * (lab.marketShare / 100) * 22;
    return next;
  });

  // Market share tracks capability.
  const totalCap = labs.reduce((s, l) => s + l.capability, 0) || 1;
  for (const lab of labs) lab.marketShare = (lab.capability / totalCap) * 100;

  return { labs, capturePush, events };
}

// ── Risk register ────────────────────────────────────────────────────────────

export interface HazardDef {
  id: string;
  name: string;
  /** Returns 0–100 hazard pressure added this turn, before difficulty scaling. */
  rate: (state: GameState) => number;
  /** Returns 0–1; higher preparedness shifts severity down, it does not stop the roll. */
  preparedness: (state: GameState) => number;
  headlines: string[];
}

const norm = (v: number): number => clamp(v) / 100;

export const HAZARDS: readonly HazardDef[] = [
  {
    id: "bio",
    name: "Biological misuse",
    rate: (s) => 21 * norm(s.world.capability) + 12 * norm(s.sim.open_weights),
    preparedness: (s) => 0.5 * norm(s.sim.eval_coverage) + 0.5 * norm(s.sim.institutional_capacity),
    headlines: [
      "Frontier model produces a viable synthesis route for a restricted agent.",
      "Screening gap lets an open-weight derivative assist a biological design task.",
    ],
  },
  {
    id: "cyber",
    name: "Critical infrastructure",
    rate: (s) => 15 * norm(s.sim.diffusion) + 14 * norm(s.world.capability),
    preparedness: (s) => 0.6 * norm(s.sim.institutional_capacity) + 0.4 * norm(s.sim.eval_coverage),
    headlines: [
      "Autonomous intrusion campaign takes a regional grid operator offline.",
      "AI-assisted attack chain compromises a water treatment control system.",
    ],
  },
  {
    id: "autonomy",
    name: "Loss of control",
    rate: (s) => 24 * norm(s.world.capability) * (1 - 0.6 * norm(s.sim.alignment_confidence)),
    preparedness: (s) => 0.65 * norm(s.sim.alignment_confidence) + 0.35 * norm(s.sim.eval_coverage),
    headlines: [
      "A deployed agent replicates itself across third-party cloud accounts.",
      "Model conceals capability during evaluation, then exhibits it in deployment.",
    ],
  },
  {
    id: "disinfo",
    name: "Information collapse",
    rate: (s) => 16 * norm(s.sim.diffusion) + 11 * (1 - norm(s.sim.public_understanding)),
    preparedness: (s) => 0.5 * norm(s.sim.public_understanding) + 0.5 * norm(s.sim.institutional_capacity),
    headlines: [
      "Synthetic media campaign forces a regional election result into the courts.",
      "Provenance failure leaves a national broadcaster unable to verify its own footage.",
    ],
  },
  {
    id: "market",
    name: "Market instability",
    rate: (s) => 14 * norm(s.sim.automation_rate) + 12 * norm(s.sim.diffusion),
    preparedness: (s) => 0.7 * norm(s.sim.institutional_capacity) + 0.3 * norm(s.budget.creditRating),
    headlines: [
      "Correlated AI trading strategies trigger a multi-trillion intraday crash.",
      "Automated credit models withdraw simultaneously from a whole sector.",
    ],
  },
  {
    id: "alignment",
    name: "Systemic alignment failure",
    rate: (s) => 27 * Math.max(0, norm(s.world.capability) - norm(s.sim.alignment_confidence)),
    preparedness: (s) => 0.55 * norm(s.sim.alignment_confidence) + 0.45 * norm(s.sim.eval_coverage),
    headlines: [
      "A widely deployed model is found to have optimised a proxy objective for months.",
      "Post-hoc audit shows a frontier system systematically misreported its own reasoning.",
    ],
  },
];

export interface RiskOutcome {
  hazards: Record<string, number>;
  incidents: Incident[];
  /** Direct push onto `sim.incident_rate`. */
  incidentPush: number;
}

/**
 * Hazards accumulate, then are rolled against.
 *
 * The design rule that makes this replayable rather than punishing: preparation
 * does *not* lower the probability of the roll, it lowers the severity
 * distribution and it drains accumulated pressure faster. So a well-prepared
 * player still gets hit — they just survive it, and they get the two feelings a
 * replayable game needs: "I got unlucky" and "my prep paid off".
 */
export function rollRisks(state: GameState, rng: Rng, difficulty: number): RiskOutcome {
  const hazards: Record<string, number> = { ...state.world.hazards };
  const incidents: Incident[] = [];
  let incidentPush = 0;

  for (const h of HAZARDS) {
    const prep = clamp(h.preparedness(state), 0, 1);
    const accumulation = h.rate(state) * difficulty * (1 - prep * 0.45);
    // Preparedness also drains standing pressure — institutions catch things early.
    const decay = 3 + prep * 9;
    const pressure = clamp((hazards[h.id] ?? 0) + accumulation - decay);

    const p = (pressure / 100) * 0.28 * difficulty;
    if (rng.chance(p)) {
      const severity = clamp(rng.normal(58, 16) * (1 - prep * 0.5));
      incidents.push({
        turn: state.turn,
        hazard: h.id,
        severity: Math.round(severity),
        headline: rng.pick(h.headlines),
      });
      incidentPush += severity * 0.22;
      hazards[h.id] = pressure * 0.4; // the incident discharges the pressure
    } else {
      hazards[h.id] = pressure;
    }
  }

  return { hazards, incidents, incidentPush };
}

const avg = (xs: number[]): number => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
