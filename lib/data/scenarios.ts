/**
 * Scenarios.
 *
 * A country is a parameter set, not a special case: starting sim values, bloc
 * composition, inherited policy, fiscal position, and political system. That
 * means new scenarios are data, and a randomiser can generate valid ones.
 */

import type { ScenarioDef } from "../sim/types.ts";

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: "us",
    name: "United States",
    flag: "🇺🇸",
    description:
      "Tech superpower. Deep compute and capital, thin safety nets, and a polarised electorate that punishes energy prices.",
    gdp: 1000,
    startingDebtRatio: 1.2,
    politicalSystem: "presidential",
    sim: {
      compute_supply: 58, chip_access: 55, grid_capacity: 42, business_confidence: 58,
      inequality: 64, social_cohesion: 40, institutional_capacity: 48, alliance_strength: 62,
      regulatory_capture: 52,
    },
    membership: { capitalists: 12, ai_engineers: 7, union_members: 7, rural: 16 },
    policies: { income_tax: 42, corporate_tax: 34, capital_gains_tax: 30 },
    costMultiplier: 1,
  },
  {
    id: "eu",
    name: "European Union",
    flag: "🇪🇺",
    description:
      "Regulatory leader with real state capacity and 27 governments to satisfy. Strong on institutions, slow on compute.",
    gdp: 900,
    startingDebtRatio: 0.95,
    politicalSystem: "parliamentary",
    sim: {
      compute_supply: 34, chip_access: 44, grid_capacity: 52, institutional_capacity: 64,
      inequality: 42, social_cohesion: 56, alliance_strength: 66, regulatory_capture: 28,
      business_confidence: 44,
    },
    membership: { union_members: 20, capitalists: 7, retirees: 24, ai_engineers: 3 },
    policies: { income_tax: 55, corporate_tax: 38, capital_gains_tax: 34, portable_benefits: 30 },
    costMultiplier: 1.1,
  },
  {
    id: "in",
    name: "India",
    flag: "🇮🇳",
    description:
      "Demographic dividend meets infrastructure gap. Enormous upside from diffusion, acute exposure to energy and inequality.",
    gdp: 620,
    startingDebtRatio: 0.82,
    politicalSystem: "federal",
    sim: {
      compute_supply: 28, chip_access: 32, grid_capacity: 34, institutional_capacity: 38,
      inequality: 68, public_understanding: 24, social_cohesion: 48, business_confidence: 56,
      alliance_strength: 44,
    },
    membership: { rural: 28, students: 20, retirees: 12, capitalists: 6, union_members: 8 },
    policies: { income_tax: 28, corporate_tax: 30 },
    costMultiplier: 0.75,
  },
  {
    id: "coalition",
    name: "Global South Coalition",
    flag: "🌍",
    description:
      "Forty states bargaining as one. Almost no domestic compute, but real collective leverage and everything to gain from diffusion.",
    gdp: 480,
    startingDebtRatio: 1.05,
    politicalSystem: "parliamentary",
    sim: {
      compute_supply: 18, chip_access: 22, grid_capacity: 30, institutional_capacity: 32,
      inequality: 70, public_understanding: 22, alliance_strength: 38, business_confidence: 46,
      social_cohesion: 52,
    },
    membership: { rural: 26, students: 19, displaced_workers: 11, capitalists: 5, ai_engineers: 1 },
    policies: { income_tax: 24, corporate_tax: 28 },
    costMultiplier: 0.6,
  },
];

export const SCENARIO_MAP: ReadonlyMap<string, ScenarioDef> = new Map(
  SCENARIOS.map((s) => [s.id, s]),
);
