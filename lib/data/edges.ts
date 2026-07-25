/**
 * The influence graph.
 *
 * This file is the game. Everything else is scaffolding around it.
 *
 * Reading a row: `{ from, to, fn, weight }` means "at full source value, this
 * edge moves the target by `weight` points relative to a neutral world".
 *
 * Two conventions matter:
 *
 *  1. Non-policy sources are **auto-centred** at their midpoint by
 *     `computeNeutralOffsets`. A weight of -40 from `cost_of_living` means the
 *     target loses 40 points when cost of living is maxed and gains 20 when it
 *     is zero. A node's declared `base` is therefore its value in a neutral
 *     world with no policies enacted, exactly as documented.
 *
 *     Consequence: `condition` and `delay` are only used on **policy** sources.
 *     A conditional non-policy edge would make the centring offset wobble as the
 *     condition flips. Delay on a policy edge is the implementation lag and is
 *     handled separately.
 *
 *  2. Policy sources contribute zero when the policy is off, so they are not
 *     centred. They use their *active ramp*, not the intensity the player set.
 */

import type { Edge } from "../sim/types.ts";

export const EDGES: readonly Edge[] = [
  // ═══ COMPUTE & ENERGY ══════════════════════════════════════════════════════
  // The physical spine of the game: compute is not a number you buy, it is a
  // chain of chips, electrons, land, and the households you outbid for them.

  { from: "policy.datacentre_buildout", to: "sim.compute_supply", fn: "linear", weight: 42, delay: 2,
    note: "Sited capacity comes online" },
  { from: "sim.chip_access", to: "sim.compute_supply", fn: "linear", weight: 30,
    note: "No chips, no clusters" },
  { from: "sim.grid_capacity", to: "sim.compute_supply", fn: "linear", weight: 24,
    note: "Power is the binding constraint" },
  { from: "policy.compute_levy", to: "sim.compute_supply", fn: "linear", weight: -20,
    note: "Training runs move offshore" },

  { from: "policy.grid_investment", to: "sim.grid_capacity", fn: "linear", weight: 46, delay: 3,
    note: "Transmission and generation, finally energised" },
  { from: "policy.datacentre_buildout", to: "sim.grid_capacity", fn: "linear", weight: -34, delay: 1,
    note: "Clusters consume the headroom" },

  { from: "sim.grid_capacity", to: "sim.energy_price", fn: "inverse", weight: 46,
    note: "Scarcity sets the price" },
  { from: "policy.datacentre_buildout", to: "sim.energy_price", fn: "linear", weight: 20, delay: 1,
    note: "Data centres bid against households" },
  { from: "policy.grid_investment", to: "sim.energy_price", fn: "linear", weight: -14, delay: 3,
    note: "Cheap clean generation, eventually" },

  { from: "policy.chip_industrial_policy", to: "sim.chip_access", fn: "linear", weight: 40, delay: 3,
    note: "Domestic fabrication" },
  { from: "sim.alliance_strength", to: "sim.chip_access", fn: "linear", weight: 28,
    note: "Allied supply chains" },
  { from: "policy.export_controls", to: "sim.chip_access", fn: "linear", weight: -16,
    note: "Retaliation and lost trade" },

  // ═══ ECONOMY ═══════════════════════════════════════════════════════════════

  { from: "sim.diffusion", to: "sim.productivity", fn: "linear", weight: 48,
    note: "Capability only counts once it is deployed" },
  { from: "sim.compute_supply", to: "sim.productivity", fn: "linear", weight: 16 },
  { from: "policy.ai_literacy", to: "sim.productivity", fn: "linear", weight: 14, delay: 2,
    note: "A workforce that can actually use the tools" },
  { from: "policy.public_ai_access", to: "sim.productivity", fn: "linear", weight: 12, delay: 1 },

  { from: "sim.productivity", to: "sim.gdp_growth", fn: "linear", weight: 50 },
  { from: "sim.business_confidence", to: "sim.gdp_growth", fn: "linear", weight: 26 },
  { from: "sim.cost_of_living", to: "sim.gdp_growth", fn: "exponential", weight: -18,
    note: "Households stop spending" },
  { from: "policy.automation_levy", to: "sim.gdp_growth", fn: "linear", weight: -10 },

  { from: "policy.corporate_tax", to: "sim.business_confidence", fn: "exponential", weight: -26 },
  { from: "policy.capital_gains_tax", to: "sim.business_confidence", fn: "exponential", weight: -20 },
  { from: "policy.automation_levy", to: "sim.business_confidence", fn: "linear", weight: -16 },
  { from: "policy.compute_levy", to: "sim.business_confidence", fn: "linear", weight: -10 },
  { from: "policy.worker_codetermination", to: "sim.business_confidence", fn: "linear", weight: -14 },
  { from: "policy.open_weight_restrictions", to: "sim.business_confidence", fn: "linear", weight: -8 },
  { from: "sim.gdp_growth", to: "sim.business_confidence", fn: "linear", weight: 22,
    note: "Confidence is partly self-fulfilling" },
  { from: "budget.debtRatio", to: "sim.business_confidence", fn: "exponential", weight: -22,
    note: "Fiscal credibility" },

  { from: "sim.energy_price", to: "sim.cost_of_living", fn: "linear", weight: 34,
    note: "The bill arrives at the kitchen table" },
  { from: "policy.portable_benefits", to: "sim.cost_of_living", fn: "linear", weight: -14, delay: 2 },
  { from: "policy.sovereign_wealth_fund", to: "sim.cost_of_living", fn: "linear", weight: -12, delay: 3,
    note: "The dividend offsets the squeeze" },
  { from: "sim.gdp_growth", to: "sim.cost_of_living", fn: "linear", weight: 12 },

  // ═══ LABOUR ════════════════════════════════════════════════════════════════

  { from: "sim.diffusion", to: "sim.automation_rate", fn: "sigmoid", weight: 40, at: 0.45,
    note: "Task displacement accelerates past a tipping point" },
  { from: "world.capability", to: "sim.automation_rate", fn: "sigmoid", weight: 32, at: 0.55 },
  { from: "policy.automation_levy", to: "sim.automation_rate", fn: "linear", weight: -22,
    note: "Price the substitution and it slows" },
  { from: "policy.worker_codetermination", to: "sim.automation_rate", fn: "linear", weight: -12 },

  { from: "sim.automation_rate", to: "sim.unemployment", fn: "linear", weight: 40 },
  { from: "sim.gdp_growth", to: "sim.unemployment", fn: "linear", weight: -30 },
  { from: "policy.retraining", to: "sim.unemployment", fn: "linear", weight: -22, delay: 2,
    note: "Only if the pathways exist before the shock" },
  { from: "policy.portable_benefits", to: "sim.unemployment", fn: "linear", weight: -8, delay: 2 },

  { from: "sim.automation_rate", to: "sim.wage_share", fn: "linear", weight: -36,
    note: "Capital captures the surplus by default" },
  { from: "policy.worker_codetermination", to: "sim.wage_share", fn: "linear", weight: 22, delay: 1 },
  { from: "group.union_members.membership", to: "sim.wage_share", fn: "linear", weight: 26,
    note: "Bargaining power is a function of density" },

  { from: "sim.wage_share", to: "sim.inequality", fn: "inverse", weight: 34 },
  { from: "sim.automation_rate", to: "sim.inequality", fn: "linear", weight: 18 },
  { from: "policy.sovereign_wealth_fund", to: "sim.inequality", fn: "linear", weight: -26, delay: 3 },
  { from: "policy.capital_gains_tax", to: "sim.inequality", fn: "linear", weight: -14 },
  { from: "policy.income_tax", to: "sim.inequality", fn: "linear", weight: -10 },
  { from: "policy.public_ai_access", to: "sim.inequality", fn: "linear", weight: -12, delay: 2 },

  // ═══ AI SYSTEM STATE ═══════════════════════════════════════════════════════

  { from: "world.capability", to: "sim.diffusion", fn: "linear", weight: 30 },
  { from: "sim.compute_supply", to: "sim.diffusion", fn: "linear", weight: 26 },
  { from: "policy.public_ai_access", to: "sim.diffusion", fn: "linear", weight: 20, delay: 1 },
  { from: "sim.open_weights", to: "sim.diffusion", fn: "linear", weight: 18 },
  { from: "policy.ai_literacy", to: "sim.diffusion", fn: "linear", weight: 12, delay: 2 },
  { from: "policy.open_weight_restrictions", to: "sim.diffusion", fn: "linear", weight: -16 },

  { from: "policy.open_weight_restrictions", to: "sim.open_weights", fn: "linear", weight: -44 },
  { from: "world.capability", to: "sim.open_weights", fn: "linear", weight: 16,
    note: "Yesterday's frontier is today's open release" },

  { from: "policy.interpretability_research", to: "sim.alignment_confidence", fn: "linear", weight: 34, delay: 3,
    note: "The slowest, highest-leverage investment in the game" },
  { from: "sim.eval_coverage", to: "sim.alignment_confidence", fn: "linear", weight: 26 },
  { from: "world.capability", to: "sim.alignment_confidence", fn: "exponential", weight: -30,
    note: "Understanding falls behind capability unless you fund it" },
  { from: "policy.international_accord", to: "sim.alignment_confidence", fn: "linear", weight: 12, delay: 2 },

  { from: "policy.frontier_safety_regime", to: "sim.eval_coverage", fn: "linear", weight: 38, delay: 1 },
  { from: "policy.audit_bureau", to: "sim.eval_coverage", fn: "linear", weight: 24, delay: 2 },
  { from: "sim.institutional_capacity", to: "sim.eval_coverage", fn: "linear", weight: 22,
    note: "A mandate without inspectors is paper" },
  { from: "sim.regulatory_capture", to: "sim.eval_coverage", fn: "linear", weight: -26,
    note: "Captured regulators sign off on anything" },

  { from: "world.capability", to: "sim.incident_rate", fn: "sigmoid", weight: 40, at: 0.5 },
  { from: "sim.open_weights", to: "sim.incident_rate", fn: "linear", weight: 20 },
  { from: "sim.diffusion", to: "sim.incident_rate", fn: "linear", weight: 14 },
  { from: "sim.eval_coverage", to: "sim.incident_rate", fn: "linear", weight: -30 },
  { from: "sim.alignment_confidence", to: "sim.incident_rate", fn: "linear", weight: -24 },

  // ═══ STATE CAPACITY ════════════════════════════════════════════════════════

  { from: "policy.audit_bureau", to: "sim.institutional_capacity", fn: "linear", weight: 36, delay: 2,
    note: "The institution everything else leans on" },
  { from: "policy.frontier_safety_regime", to: "sim.institutional_capacity", fn: "linear", weight: 12, delay: 2 },
  { from: "policy.international_accord", to: "sim.institutional_capacity", fn: "linear", weight: 10, delay: 2 },
  { from: "sim.regulatory_capture", to: "sim.institutional_capacity", fn: "linear", weight: -22 },
  { from: "budget.deficitOfGdp", to: "sim.institutional_capacity", fn: "exponential", weight: -14,
    note: "Austerity hollows out the inspectorate" },

  { from: "policy.audit_bureau", to: "sim.regulatory_capture", fn: "linear", weight: -26, delay: 2 },
  { from: "sim.institutional_capacity", to: "sim.regulatory_capture", fn: "inverse", weight: 20 },
  { from: "group.accelerationists.membership", to: "sim.regulatory_capture", fn: "linear", weight: 22,
    note: "A constituency for the industry's own rules" },

  // ═══ SOCIETY ═══════════════════════════════════════════════════════════════

  { from: "sim.incident_rate", to: "sim.public_trust", fn: "exponential", weight: -34 },
  { from: "sim.media_sentiment", to: "sim.public_trust", fn: "linear", weight: 22 },
  { from: "sim.institutional_capacity", to: "sim.public_trust", fn: "linear", weight: 20 },
  { from: "sim.public_understanding", to: "sim.public_trust", fn: "linear", weight: 16 },
  { from: "sim.inequality", to: "sim.public_trust", fn: "linear", weight: -22 },
  { from: "sim.cost_of_living", to: "sim.public_trust", fn: "exponential", weight: -20 },

  { from: "sim.incident_rate", to: "sim.media_sentiment", fn: "exponential", weight: -40,
    note: "The fastest-moving node amplifies the scariest one" },
  { from: "sim.gdp_growth", to: "sim.media_sentiment", fn: "linear", weight: 24 },
  { from: "sim.cost_of_living", to: "sim.media_sentiment", fn: "linear", weight: -24 },
  { from: "sim.unemployment", to: "sim.media_sentiment", fn: "linear", weight: -20 },

  { from: "sim.inequality", to: "sim.social_cohesion", fn: "linear", weight: -30 },
  { from: "sim.unemployment", to: "sim.social_cohesion", fn: "linear", weight: -24 },
  { from: "group.displaced_workers.membership", to: "sim.social_cohesion", fn: "linear", weight: -26,
    note: "A large displaced bloc is a standing shock to cohesion" },
  { from: "sim.public_trust", to: "sim.social_cohesion", fn: "linear", weight: 22 },
  { from: "policy.portable_benefits", to: "sim.social_cohesion", fn: "linear", weight: 16, delay: 3 },

  { from: "policy.ai_literacy", to: "sim.public_understanding", fn: "linear", weight: 42, delay: 2 },
  { from: "policy.public_ai_access", to: "sim.public_understanding", fn: "linear", weight: 20, delay: 2 },
  { from: "sim.diffusion", to: "sim.public_understanding", fn: "linear", weight: 14,
    note: "Using the thing teaches you about the thing" },

  // ═══ FOREIGN ═══════════════════════════════════════════════════════════════

  { from: "policy.international_accord", to: "sim.alliance_strength", fn: "linear", weight: 40, delay: 2 },
  { from: "policy.export_controls", to: "sim.alliance_strength", fn: "linear", weight: -14,
    note: "Allies dislike being caught in your controls" },
  { from: "policy.open_weight_restrictions", to: "sim.alliance_strength", fn: "linear", weight: -8 },
  { from: "sim.institutional_capacity", to: "sim.alliance_strength", fn: "linear", weight: 14,
    note: "Partners coordinate with states that can deliver" },

  // ═══ GROUP HAPPINESS ═══════════════════════════════════════════════════════

  // Displaced Workers — the bloc your own policies create.
  { from: "sim.unemployment", to: "group.displaced_workers.happiness", fn: "linear", weight: -40 },
  { from: "policy.retraining", to: "group.displaced_workers.happiness", fn: "linear", weight: 30, delay: 1 },
  { from: "policy.portable_benefits", to: "group.displaced_workers.happiness", fn: "linear", weight: 32, delay: 1 },
  { from: "policy.sovereign_wealth_fund", to: "group.displaced_workers.happiness", fn: "linear", weight: 22, delay: 2 },
  { from: "sim.cost_of_living", to: "group.displaced_workers.happiness", fn: "exponential", weight: -30 },
  { from: "policy.automation_levy", to: "group.displaced_workers.happiness", fn: "linear", weight: 14 },

  // AI Engineers — small, rich, and extremely mobile.
  { from: "sim.compute_supply", to: "group.ai_engineers.happiness", fn: "linear", weight: 32 },
  { from: "sim.open_weights", to: "group.ai_engineers.happiness", fn: "linear", weight: 22 },
  { from: "policy.compute_levy", to: "group.ai_engineers.happiness", fn: "linear", weight: -24 },
  { from: "policy.open_weight_restrictions", to: "group.ai_engineers.happiness", fn: "linear", weight: -28 },
  { from: "policy.frontier_safety_regime", to: "group.ai_engineers.happiness", fn: "linear", weight: -16 },
  { from: "policy.capital_gains_tax", to: "group.ai_engineers.happiness", fn: "linear", weight: -14 },
  { from: "policy.interpretability_research", to: "group.ai_engineers.happiness", fn: "linear", weight: 12 },

  // Capital Owners — high turnout gives them weight beyond their size.
  { from: "policy.corporate_tax", to: "group.capitalists.happiness", fn: "exponential", weight: -34 },
  { from: "policy.capital_gains_tax", to: "group.capitalists.happiness", fn: "exponential", weight: -32 },
  { from: "policy.automation_levy", to: "group.capitalists.happiness", fn: "linear", weight: -18 },
  { from: "policy.worker_codetermination", to: "group.capitalists.happiness", fn: "linear", weight: -22 },
  { from: "sim.business_confidence", to: "group.capitalists.happiness", fn: "linear", weight: 30 },
  { from: "sim.gdp_growth", to: "group.capitalists.happiness", fn: "linear", weight: 20 },

  // Small Business — squeezed by energy costs and platform concentration.
  { from: "sim.energy_price", to: "group.small_business.happiness", fn: "exponential", weight: -34 },
  { from: "policy.corporate_tax", to: "group.small_business.happiness", fn: "linear", weight: -20 },
  { from: "policy.public_ai_access", to: "group.small_business.happiness", fn: "linear", weight: 26, delay: 1,
    note: "Capability they could not otherwise buy" },
  { from: "sim.diffusion", to: "group.small_business.happiness", fn: "linear", weight: 18 },
  { from: "sim.gdp_growth", to: "group.small_business.happiness", fn: "linear", weight: 20 },

  // Union Members.
  { from: "policy.worker_codetermination", to: "group.union_members.happiness", fn: "linear", weight: 34, delay: 1 },
  { from: "sim.wage_share", to: "group.union_members.happiness", fn: "linear", weight: 30 },
  { from: "sim.automation_rate", to: "group.union_members.happiness", fn: "linear", weight: -28 },
  { from: "policy.retraining", to: "group.union_members.happiness", fn: "linear", weight: 18, delay: 1 },
  { from: "policy.portable_benefits", to: "group.union_members.happiness", fn: "linear", weight: 20, delay: 1 },

  // Retirees — the highest-turnout bloc, and it votes on the heating bill.
  { from: "sim.cost_of_living", to: "group.retirees.happiness", fn: "exponential", weight: -44,
    note: "The single most electorally dangerous edge in the graph" },
  { from: "sim.public_trust", to: "group.retirees.happiness", fn: "linear", weight: 24 },
  { from: "sim.incident_rate", to: "group.retirees.happiness", fn: "linear", weight: -20 },
  { from: "policy.income_tax", to: "group.retirees.happiness", fn: "linear", weight: -12 },
  { from: "sim.social_cohesion", to: "group.retirees.happiness", fn: "linear", weight: 18 },

  // Students & Young.
  { from: "policy.public_ai_access", to: "group.students.happiness", fn: "linear", weight: 32, delay: 1 },
  { from: "policy.ai_literacy", to: "group.students.happiness", fn: "linear", weight: 20, delay: 1 },
  { from: "sim.unemployment", to: "group.students.happiness", fn: "linear", weight: -30 },
  { from: "sim.inequality", to: "group.students.happiness", fn: "linear", weight: -24 },
  { from: "sim.open_weights", to: "group.students.happiness", fn: "linear", weight: 16 },
  { from: "sim.cost_of_living", to: "group.students.happiness", fn: "linear", weight: -22 },

  // Rural — where the data centres, the water, and the pylons actually go.
  { from: "sim.energy_price", to: "group.rural.happiness", fn: "exponential", weight: -36 },
  { from: "policy.datacentre_buildout", to: "group.rural.happiness", fn: "linear", weight: -26, delay: 1,
    note: "National benefit, local disruption" },
  { from: "policy.grid_investment", to: "group.rural.happiness", fn: "linear", weight: -12, delay: 1,
    note: "Transmission corridors cross somebody's land" },
  { from: "policy.public_ai_access", to: "group.rural.happiness", fn: "linear", weight: 22, delay: 2 },
  { from: "sim.unemployment", to: "group.rural.happiness", fn: "linear", weight: -22 },
  { from: "sim.social_cohesion", to: "group.rural.happiness", fn: "linear", weight: 16 },

  // Urban Professionals — benefit early, then discover they are not exempt.
  { from: "sim.gdp_growth", to: "group.urban_professionals.happiness", fn: "linear", weight: 26 },
  { from: "sim.diffusion", to: "group.urban_professionals.happiness", fn: "linear", weight: 18 },
  { from: "sim.automation_rate", to: "group.urban_professionals.happiness", fn: "exponential", weight: -32,
    note: "White-collar displacement arrives late and bites hard" },
  { from: "policy.income_tax", to: "group.urban_professionals.happiness", fn: "exponential", weight: -22 },
  { from: "sim.cost_of_living", to: "group.urban_professionals.happiness", fn: "linear", weight: -20 },

  // Parents — the bloc most moved by media sentiment.
  { from: "sim.incident_rate", to: "group.parents.happiness", fn: "exponential", weight: -38 },
  { from: "sim.media_sentiment", to: "group.parents.happiness", fn: "linear", weight: 24 },
  { from: "policy.ai_literacy", to: "group.parents.happiness", fn: "linear", weight: 20, delay: 1 },
  { from: "sim.cost_of_living", to: "group.parents.happiness", fn: "exponential", weight: -28 },
  { from: "sim.social_cohesion", to: "group.parents.happiness", fn: "linear", weight: 22 },

  // AI Safety Advocates.
  { from: "policy.frontier_safety_regime", to: "group.safety_advocates.happiness", fn: "linear", weight: 34 },
  { from: "policy.audit_bureau", to: "group.safety_advocates.happiness", fn: "linear", weight: 24 },
  { from: "policy.interpretability_research", to: "group.safety_advocates.happiness", fn: "linear", weight: 22 },
  { from: "sim.alignment_confidence", to: "group.safety_advocates.happiness", fn: "linear", weight: 26 },
  { from: "sim.open_weights", to: "group.safety_advocates.happiness", fn: "linear", weight: -22 },
  { from: "world.capability", to: "group.safety_advocates.happiness", fn: "exponential", weight: -26 },

  // Accelerationists — treat restraint as betrayal.
  { from: "sim.compute_supply", to: "group.accelerationists.happiness", fn: "linear", weight: 30 },
  { from: "world.capability", to: "group.accelerationists.happiness", fn: "linear", weight: 28 },
  { from: "sim.open_weights", to: "group.accelerationists.happiness", fn: "linear", weight: 18 },
  { from: "policy.frontier_safety_regime", to: "group.accelerationists.happiness", fn: "exponential", weight: -30 },
  { from: "policy.open_weight_restrictions", to: "group.accelerationists.happiness", fn: "linear", weight: -26 },
  { from: "policy.compute_levy", to: "group.accelerationists.happiness", fn: "linear", weight: -18 },
  { from: "policy.datacentre_buildout", to: "group.accelerationists.happiness", fn: "linear", weight: 20 },

  // ═══ GROUP MEMBERSHIP ══════════════════════════════════════════════════════
  // Your policies do not just make blocs happy or angry — they change how many
  // people are in them. This is what makes two runs from the same start diverge
  // into genuinely different countries.

  { from: "sim.automation_rate", to: "group.displaced_workers.membership", fn: "linear", weight: 26,
    note: "The bloc is manufactured by the transition" },
  { from: "sim.unemployment", to: "group.displaced_workers.membership", fn: "linear", weight: 14 },
  { from: "policy.retraining", to: "group.displaced_workers.membership", fn: "linear", weight: -14, delay: 2,
    note: "People leave the category when there is somewhere to go" },

  { from: "sim.compute_supply", to: "group.ai_engineers.membership", fn: "linear", weight: 10 },
  { from: "sim.diffusion", to: "group.ai_engineers.membership", fn: "linear", weight: 6 },
  { from: "policy.compute_levy", to: "group.ai_engineers.membership", fn: "linear", weight: -8,
    note: "Brain drain follows the training runs" },

  { from: "sim.wage_share", to: "group.capitalists.membership", fn: "inverse", weight: 12 },
  { from: "sim.inequality", to: "group.capitalists.membership", fn: "linear", weight: 8 },
  { from: "policy.capital_gains_tax", to: "group.capitalists.membership", fn: "linear", weight: -6 },

  { from: "policy.public_ai_access", to: "group.small_business.membership", fn: "linear", weight: 10, delay: 2,
    note: "Capability floors let people start things" },
  { from: "sim.energy_price", to: "group.small_business.membership", fn: "linear", weight: -8 },

  { from: "policy.worker_codetermination", to: "group.union_members.membership", fn: "linear", weight: 16, delay: 1 },
  { from: "sim.automation_rate", to: "group.union_members.membership", fn: "linear", weight: -14,
    note: "Automation hollows out the organised sectors" },
  { from: "sim.wage_share", to: "group.union_members.membership", fn: "linear", weight: 8 },

  { from: "sim.automation_rate", to: "group.urban_professionals.membership", fn: "linear", weight: -10 },
  { from: "sim.gdp_growth", to: "group.urban_professionals.membership", fn: "linear", weight: 8 },

  { from: "sim.incident_rate", to: "group.safety_advocates.membership", fn: "linear", weight: 22,
    note: "Every incident recruits" },
  { from: "sim.public_understanding", to: "group.safety_advocates.membership", fn: "linear", weight: 12 },
  { from: "world.capability", to: "group.safety_advocates.membership", fn: "linear", weight: 10 },

  { from: "world.capability", to: "group.accelerationists.membership", fn: "linear", weight: 18 },
  { from: "sim.business_confidence", to: "group.accelerationists.membership", fn: "linear", weight: 12 },
  { from: "sim.gdp_growth", to: "group.accelerationists.membership", fn: "linear", weight: 8 },
];
