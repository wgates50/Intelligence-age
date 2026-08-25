/**
 * Fiscal model.
 *
 * The point of having a real budget is that it makes every ambition compete with
 * every other ambition on a shared, hard constraint — and that the constraint
 * itself moves as the economy moves. Retraining gets *more* expensive exactly
 * when displacement makes it necessary, because it scales with GDP and the
 * recession has already widened the deficit.
 */

import { POLICY_MAP } from "../data/policies.ts";
import { clamp } from "./graph.ts";
import type { BudgetState, GameState, ScenarioDef } from "./types.ts";

export function initBudget(scenario: ScenarioDef): BudgetState {
  const debt = scenario.gdp * scenario.startingDebtRatio;
  return {
    gdp: scenario.gdp,
    revenue: 0,
    spending: 0,
    interest: 0,
    balance: 0,
    debt,
    debtRatio: scenario.startingDebtRatio,
    creditRating: clamp(100 - scenario.startingDebtRatio * 45),
  };
}

/**
 * Revenue for one tax at rate r (0–1).
 *
 *   revenue = maxYield · r · (1 - avoidance · r²)
 *
 * The cubic term is a deliberate Laffer curve. Peak yield sits at
 * r = √(1 / 3·avoidance), so a mobile base like capital gains (avoidance 0.6)
 * peaks around 75% of maximum rate and *falls* beyond it, while payroll
 * (avoidance 0.25) is effectively monotonic over the playable range.
 *
 * Avoidance is not a constant: a state that cannot audit cannot collect, so weak
 * institutional capacity widens the leakage. That gives the audit bureau a
 * fiscal payoff on top of its safety payoff, which is the correct real-world
 * incentive and a non-obvious one for the player to discover.
 */
export function taxYield(
  maxYield: number,
  rate: number,
  avoidance: number,
  institutionalCapacity: number,
): number {
  const r = clamp(rate, 0, 1);
  const leakage = avoidance * (1 + (50 - institutionalCapacity) / 120);
  return maxYield * r * Math.max(0.15, 1 - leakage * r * r);
}

/** Interest rate on public debt, 2% at a pristine rating rising to 8% at junk. */
export function interestRate(creditRating: number): number {
  return 0.02 + (1 - clamp(creditRating) / 100) * 0.06;
}

export interface BudgetResult {
  budget: BudgetState;
  revenueByPolicy: Record<string, number>;
  spendingByPolicy: Record<string, number>;
}

export function runBudget(state: GameState, costMultiplier: number): BudgetResult {
  const prev = state.budget;
  const capacity = state.sim.institutional_capacity ?? 50;

  // Real growth: the sim node is an index, not a percentage. 40 is stagnation.
  const realGrowth = (state.sim.gdp_growth - 40) / 800;
  const gdp = Math.max(50, prev.gdp * (1 + realGrowth));

  const revenueByPolicy: Record<string, number> = {};
  const spendingByPolicy: Record<string, number> = {};
  let revenue = 0;
  let spending = 0;

  for (const p of Object.values(state.policies)) {
    const def = POLICY_MAP.get(p.id);
    if (!def) continue;
    const rate = p.active / 100;
    if (rate <= 0) continue;

    if (def.revenueOfGdp) {
      const yielded = taxYield(def.revenueOfGdp * gdp, rate, def.avoidance ?? 0.3, capacity);
      revenueByPolicy[p.id] = yielded;
      revenue += yielded;
    }
    if (def.costOfGdp) {
      const cost = def.costOfGdp * gdp * rate * costMultiplier;
      spendingByPolicy[p.id] = cost;
      spending += cost;
    }
  }

  const interest = Math.max(0, prev.debt) * interestRate(prev.creditRating);
  const balance = revenue - spending - interest;
  const debt = Math.max(0, prev.debt - balance);
  const debtRatio = debt / gdp;

  // Rating responds to the stock of debt and the flow of deficit, with inertia —
  // markets are slow to downgrade and slower to forgive.
  const ratingTarget = clamp(100 - debtRatio * 45 - Math.max(0, -balance / gdp) * 260);
  const creditRating = prev.creditRating + (ratingTarget - prev.creditRating) * 0.3;

  return {
    budget: { gdp, revenue, spending, interest, balance, debt, debtRatio, creditRating },
    revenueByPolicy,
    spendingByPolicy,
  };
}
