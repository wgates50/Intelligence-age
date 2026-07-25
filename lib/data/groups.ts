/**
 * Voter blocs.
 *
 * Membership is *dynamic* — driven by simulation state via the edge set. This is
 * the mechanic the old build most conspicuously lacked: your policies change who
 * your society is made of, and then you have to govern the country you made.
 *
 * Blocs overlap (a person can be a Rural Parent and a Union Member), so
 * membership deliberately sums well past 100. Cross-pressured voters produce
 * lower turnout and weaker loyalty, which is the intended texture.
 */

import type { GroupDef } from "../sim/types.ts";

export const GROUPS: readonly GroupDef[] = [
  {
    id: "displaced_workers", name: "Displaced Workers",
    membership: 8, membershipRange: [2, 40], income: "low",
    volatility: 0.55, loyalty: 25, baseTurnout: 45,
    description: "Grows directly with the automation rate. Shrinks when retraining and care pathways land.",
  },
  {
    id: "ai_engineers", name: "AI Engineers",
    membership: 4, membershipRange: [1, 18], income: "high",
    volatility: 0.45, loyalty: 30, baseTurnout: 70,
    description: "Small, rich, mobile, and loud. Leaves the country if the regime turns hostile.",
  },
  {
    id: "capitalists", name: "Capital Owners",
    membership: 9, membershipRange: [4, 26], income: "high",
    volatility: 0.4, loyalty: 40, baseTurnout: 85,
    description: "Grows as the wage share falls. High turnout gives it weight beyond its size.",
  },
  {
    id: "small_business", name: "Small Business",
    membership: 15, membershipRange: [7, 26], income: "mid",
    volatility: 0.5, loyalty: 35, baseTurnout: 72,
    description: "Squeezed from both sides: energy costs and platform concentration.",
  },
  {
    id: "union_members", name: "Union Members",
    membership: 13, membershipRange: [4, 32], income: "mid",
    volatility: 0.45, loyalty: 55, baseTurnout: 76,
    description: "Grows with worker voice, shrinks as automation hollows out organised sectors.",
  },
  {
    id: "retirees", name: "Retirees",
    membership: 21, membershipRange: [16, 30], income: "low",
    volatility: 0.3, loyalty: 60, baseTurnout: 88,
    description: "The highest-turnout bloc. Cares about cost of living above everything.",
  },
  {
    id: "students", name: "Students & Young",
    membership: 14, membershipRange: [9, 22], income: "low",
    volatility: 0.7, loyalty: 20, baseTurnout: 44,
    description: "Most volatile, least reliable at the ballot box. Cares about access and the future.",
  },
  {
    id: "rural", name: "Rural Communities",
    membership: 18, membershipRange: [12, 26], income: "mid",
    volatility: 0.42, loyalty: 55, baseTurnout: 74,
    description: "Where the data centres, the water, and the transmission lines actually go.",
  },
  {
    id: "urban_professionals", name: "Urban Professionals",
    membership: 20, membershipRange: [12, 30], income: "high",
    volatility: 0.4, loyalty: 35, baseTurnout: 80,
    description: "Benefits early from diffusion, then discovers white-collar work is not exempt.",
  },
  {
    id: "parents", name: "Parents",
    membership: 24, membershipRange: [18, 30], income: "mid",
    volatility: 0.45, loyalty: 40, baseTurnout: 72,
    description: "Reacts to incidents and to schooling. The bloc most moved by media sentiment.",
  },
  {
    id: "safety_advocates", name: "AI Safety Advocates",
    membership: 5, membershipRange: [1, 24], income: "mid",
    volatility: 0.6, loyalty: 30, baseTurnout: 78,
    description: "Grows with every incident and with public understanding. Small until it isn't.",
  },
  {
    id: "accelerationists", name: "Accelerationists",
    membership: 5, membershipRange: [1, 24], income: "high",
    volatility: 0.6, loyalty: 28, baseTurnout: 66,
    description: "Grows with capability and business confidence. Treats restraint as betrayal.",
  },
];

export const GROUP_MAP: ReadonlyMap<string, GroupDef> = new Map(
  GROUPS.map((g) => [g.id, g]),
);
