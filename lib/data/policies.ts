/**
 * Policy nodes — the player's levers.
 *
 * Three properties do the strategic heavy lifting:
 *
 *  - `implementation` — turns to reach full effect. A turn-10 correction cannot
 *    undo a turn-3 mistake, which is where genuine planning pressure comes from.
 *  - `cancelCost` — repeal is far more expensive than enactment, so the map of
 *    policies you have built constrains the government you can be later.
 *  - `avoidance` — mobile tax bases push back, so "just tax it" has a ceiling.
 */

import type { PolicyDef } from "../sim/types.ts";

export const POLICIES: readonly PolicyDef[] = [
  // ── Revenue ────────────────────────────────────────────────────────────────
  {
    id: "income_tax", name: "Income Tax", category: "tax",
    description: "Broad-based personal taxation. Reliable, visible, and resented.",
    revenueOfGdp: 0.19, avoidance: 0.25,
    introCost: 0, adjustCost: 3, cancelCost: 30, implementation: 1,
  },
  {
    id: "corporate_tax", name: "Corporate Tax", category: "tax",
    description: "Tax on company profits. Erodes business confidence as it rises.",
    revenueOfGdp: 0.09, avoidance: 0.45,
    introCost: 0, adjustCost: 3, cancelCost: 20, implementation: 1,
  },
  {
    id: "capital_gains_tax", name: "Capital Gains Tax", category: "tax",
    description: "Tax on realised investment returns. The most mobile base you have.",
    revenueOfGdp: 0.05, avoidance: 0.6,
    introCost: 0, adjustCost: 4, cancelCost: 18, implementation: 1,
  },
  {
    id: "automation_levy", name: "Automation Levy", category: "tax",
    description: "Charge on AI systems displacing human labour. Slows adoption by design.",
    revenueOfGdp: 0.06, avoidance: 0.5,
    introCost: 22, adjustCost: 5, cancelCost: 16, implementation: 2,
  },
  {
    id: "compute_levy", name: "Compute Levy", category: "tax",
    description: "Per-FLOP charge on frontier training runs. Falls on a base that can relocate.",
    revenueOfGdp: 0.04, avoidance: 0.7,
    introCost: 18, adjustCost: 4, cancelCost: 12, implementation: 1,
  },

  // ── Compute & energy ───────────────────────────────────────────────────────
  {
    id: "datacentre_buildout", name: "Data Centre Buildout", category: "compute",
    description: "Public co-investment and fast-track siting for frontier compute.",
    costOfGdp: 0.035,
    introCost: 15, adjustCost: 4, cancelCost: 14, implementation: 3,
  },
  {
    id: "grid_investment", name: "Grid & Clean Power", category: "compute",
    description: "Transmission, generation, and storage. Slow, expensive, and load-bearing.",
    costOfGdp: 0.045,
    introCost: 18, adjustCost: 4, cancelCost: 20, implementation: 4,
  },
  {
    id: "chip_industrial_policy", name: "Semiconductor Strategy", category: "compute",
    description: "Onshore fabrication and packaging. Takes years; reduces foreign leverage.",
    costOfGdp: 0.04,
    introCost: 20, adjustCost: 5, cancelCost: 22, implementation: 4,
  },

  // ── Public & access ────────────────────────────────────────────────────────
  {
    id: "public_ai_access", name: "Right to AI", category: "public",
    description: "Universal free-tier access to capable models, on public infrastructure.",
    costOfGdp: 0.032,
    introCost: 16, adjustCost: 3, cancelCost: 24, implementation: 2,
  },
  {
    id: "ai_literacy", name: "AI Literacy Programme", category: "public",
    description: "Schools, libraries, and workplaces. Cheap, slow, compounds.",
    costOfGdp: 0.019,
    introCost: 8, adjustCost: 2, cancelCost: 10, implementation: 3,
  },

  // ── Labour & welfare ───────────────────────────────────────────────────────
  {
    id: "retraining", name: "Transition & Retraining", category: "welfare",
    description: "Funded pathways out of displaced occupations. Only works if it precedes the shock.",
    costOfGdp: 0.025,
    introCost: 12, adjustCost: 3, cancelCost: 18, implementation: 2,
  },
  {
    id: "portable_benefits", name: "Portable Benefits", category: "welfare",
    description: "Healthcare, pensions, and credits that follow the worker, not the job.",
    costOfGdp: 0.05,
    introCost: 24, adjustCost: 4, cancelCost: 34, implementation: 3,
  },
  {
    id: "sovereign_wealth_fund", name: "Public Wealth Fund", category: "economy",
    description: "A citizen stake in AI-driven growth, paid as a dividend. Compounds slowly.",
    costOfGdp: 0.03,
    introCost: 26, adjustCost: 4, cancelCost: 30, implementation: 4,
  },
  {
    id: "worker_codetermination", name: "Worker Voice", category: "law",
    description: "Councils with consultation rights over AI deployment. Costs little, angers capital.",
    costOfGdp: 0.004,
    introCost: 20, adjustCost: 3, cancelCost: 22, implementation: 2,
  },

  // ── Safety & governance ────────────────────────────────────────────────────
  {
    id: "frontier_safety_regime", name: "Frontier Safety Regime", category: "safety",
    description: "Mandatory pre-deployment evaluation and graduated safeguards for frontier systems.",
    costOfGdp: 0.012,
    introCost: 22, adjustCost: 4, cancelCost: 20, implementation: 2,
  },
  {
    id: "audit_bureau", name: "AI Audit Bureau", category: "safety",
    description: "Standing capacity to inspect, measure, and enforce. The institution everything else leans on.",
    costOfGdp: 0.01,
    introCost: 16, adjustCost: 3, cancelCost: 18, implementation: 3,
  },
  {
    id: "interpretability_research", name: "Interpretability Programme", category: "safety",
    description: "Public funding for understanding what models are actually doing. Very slow payoff.",
    costOfGdp: 0.008,
    introCost: 10, adjustCost: 2, cancelCost: 10, implementation: 4,
  },
  {
    id: "open_weight_restrictions", name: "Open-Weight Controls", category: "law",
    description: "Licensing above a capability threshold. Reduces proliferation and access alike.",
    costOfGdp: 0.005,
    introCost: 24, adjustCost: 4, cancelCost: 16, implementation: 1,
  },

  // ── Foreign ────────────────────────────────────────────────────────────────
  {
    id: "international_accord", name: "International AI Accord", category: "foreign",
    description: "Shared evaluation standards and incident channels with partners.",
    costOfGdp: 0.006,
    introCost: 18, adjustCost: 3, cancelCost: 14, implementation: 3,
  },
  {
    id: "export_controls", name: "Export Controls", category: "foreign",
    description: "Restricts advanced compute reaching rivals. Slows them; invites retaliation.",
    costOfGdp: 0.008,
    introCost: 14, adjustCost: 3, cancelCost: 12, implementation: 1,
  },
];

export const POLICY_MAP: ReadonlyMap<string, PolicyDef> = new Map(
  POLICIES.map((p) => [p.id, p]),
);
