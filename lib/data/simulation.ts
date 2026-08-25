/**
 * Simulation nodes — the state of the world.
 *
 * `base` is the value a node settles at with no inbound influence; `inertia` is
 * how fast it chases its target. Slow nodes (institutional capacity, social
 * cohesion) are the ones the player must invest in early, because they cannot be
 * fixed in the turn you need them.
 */

import type { SimNodeDef } from "../sim/types.ts";

export const SIM_NODES: readonly SimNodeDef[] = [
  // ── Economy ────────────────────────────────────────────────────────────────
  { id: "gdp_growth", name: "GDP Growth", category: "economy", base: 45, inertia: 0.35, goodHigh: true,
    description: "Headline output growth. Responds to productivity, confidence, and compute." },
  { id: "productivity", name: "Productivity", category: "economy", base: 45, inertia: 0.25, goodHigh: true,
    description: "Output per worker. The main channel by which AI capability reaches the economy." },
  { id: "unemployment", name: "Unemployment", category: "economy", base: 35, inertia: 0.3, goodHigh: false,
    description: "Rises with automation, falls with growth and care-sector expansion." },
  { id: "wage_share", name: "Wage Share", category: "economy", base: 50, inertia: 0.2, goodHigh: true,
    description: "Labour's cut of national income. Falls automatically as automation rises." },
  { id: "inequality", name: "Inequality", category: "economy", base: 50, inertia: 0.2, goodHigh: false,
    description: "Concentration of gains. Sticky in both directions." },
  { id: "cost_of_living", name: "Cost of Living", category: "economy", base: 45, inertia: 0.4, goodHigh: false,
    description: "What households actually feel. Energy prices pass through here." },
  { id: "business_confidence", name: "Business Confidence", category: "economy", base: 50, inertia: 0.5, goodHigh: true,
    description: "Fast-moving. Reacts to tax, regulation, and fiscal credibility." },

  // ── Compute & energy ───────────────────────────────────────────────────────
  { id: "compute_supply", name: "Compute Supply", category: "compute", base: 35, inertia: 0.25, goodHigh: true,
    description: "Domestic frontier compute. Gated by chips, grid, and siting." },
  { id: "grid_capacity", name: "Grid Capacity", category: "compute", base: 50, inertia: 0.15, goodHigh: true,
    description: "Headroom above demand. Very slow — transmission takes years." },
  { id: "energy_price", name: "Energy Price", category: "compute", base: 45, inertia: 0.45, goodHigh: false,
    description: "Set by the gap between grid capacity and total demand, households included." },
  { id: "chip_access", name: "Chip Access", category: "compute", base: 50, inertia: 0.3, goodHigh: true,
    description: "Advanced semiconductor supply. Exposed to allies and export controls." },

  // ── AI system state ────────────────────────────────────────────────────────
  { id: "diffusion", name: "Diffusion", category: "ai", base: 30, inertia: 0.3, goodHigh: true,
    description: "How widely frontier capability is actually deployed in the economy." },
  { id: "open_weights", name: "Open-Weight Availability", category: "ai", base: 45, inertia: 0.25, goodHigh: true,
    description: "Cuts both ways: broad access and innovation, but irreversible proliferation." },
  { id: "alignment_confidence", name: "Alignment Confidence", category: "ai", base: 35, inertia: 0.15, goodHigh: true,
    description: "Justified confidence that frontier systems do what we intend. Very slow to build." },
  { id: "eval_coverage", name: "Eval Coverage", category: "ai", base: 30, inertia: 0.25, goodHigh: true,
    description: "Share of frontier deployments under credible pre-release evaluation." },
  { id: "incident_rate", name: "Incident Rate", category: "ai", base: 25, inertia: 0.4, goodHigh: false,
    description: "Observed AI harms. Distinct from latent hazard — this is what the public sees." },

  // ── Society ────────────────────────────────────────────────────────────────
  { id: "public_trust", name: "Public Trust", category: "society", base: 45, inertia: 0.3, goodHigh: true,
    description: "Confidence in institutions to handle the transition. Easy to lose, slow to rebuild." },
  { id: "media_sentiment", name: "Media Sentiment", category: "society", base: 45, inertia: 0.6, goodHigh: true,
    description: "The fastest-moving node in the game. Amplifies incidents and scandals." },
  { id: "social_cohesion", name: "Social Cohesion", category: "society", base: 50, inertia: 0.12, goodHigh: true,
    description: "The slowest node in the game. Erodes under inequality and displacement." },
  { id: "public_understanding", name: "Public Understanding", category: "society", base: 30, inertia: 0.2, goodHigh: true,
    description: "AI literacy. Damps panic, improves the quality of democratic pressure." },
  { id: "automation_rate", name: "Automation Rate", category: "society", base: 30, inertia: 0.3, goodHigh: false,
    description: "Pace of task displacement. The engine behind Displaced Workers." },

  // ── State capacity ─────────────────────────────────────────────────────────
  { id: "institutional_capacity", name: "Institutional Capacity", category: "state", base: 40, inertia: 0.15, goodHigh: true,
    description: "Ability to measure, audit, and enforce. Also buys better forecasts." },
  { id: "regulatory_capture", name: "Regulatory Capture", category: "state", base: 35, inertia: 0.2, goodHigh: false,
    description: "Industry influence over its own rules. Quietly blunts every safety policy." },

  // ── Foreign ────────────────────────────────────────────────────────────────
  { id: "alliance_strength", name: "Alliance Strength", category: "foreign", base: 50, inertia: 0.25, goodHigh: true,
    description: "Depth of coordination with partners. Gates treaties and chip access." },
];

export const SIM_NODE_MAP: ReadonlyMap<string, SimNodeDef> = new Map(
  SIM_NODES.map((n) => [n.id, n]),
);
