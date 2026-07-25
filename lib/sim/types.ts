/**
 * Core simulation types.
 *
 * The design rule: *world content is data, engine behaviour is code*. Nothing in
 * `lib/data` should need a code change in `lib/sim`, and nothing in `lib/sim`
 * should know the name of a specific policy, group, or node.
 */

// ── Graph ────────────────────────────────────────────────────────────────────

/**
 * Transfer function applied to a normalised (0–1) source value before it is
 * scaled by the edge weight. This is what makes influence non-linear.
 *
 *  linear       proportional
 *  inverse      1 - x        (scarcity: low grid capacity → high energy price)
 *  exponential  x²           (only bites at high values: cost-of-living pain)
 *  sigmoid      soft step    (regime change around the midpoint: takeoff)
 *  threshold    hard step    (a capability or institution exists, or doesn't)
 */
export type EdgeFn = "linear" | "inverse" | "exponential" | "sigmoid" | "threshold";

export interface Edge {
  /** Source ref: `policy.<id>` | `sim.<id>` | `group.<id>.<field>` | `world.<field>` */
  from: string;
  /** Target ref: `sim.<id>` | `group.<id>.happiness` | `group.<id>.membership` */
  to: string;
  fn: EdgeFn;
  /** Signed magnitude, in points of the 0–100 target scale at full source. */
  weight: number;
  /** Turns before this edge starts contributing at all. */
  delay?: number;
  /** Cut-point for `threshold`, steepness centre for `sigmoid`. Default 0.5. */
  at?: number;
  /** Only contributes while this predicate holds. */
  condition?: Condition;
  /** Free-text rationale — surfaced in the causal trace and dev tooling. */
  note?: string;
}

/** A predicate over world state, used by edges and dilemma triggers. */
export interface Condition {
  ref: string;
  op: ">" | ">=" | "<" | "<=";
  value: number;
}

// ── Nodes ────────────────────────────────────────────────────────────────────

export type SimCategory =
  | "economy"
  | "compute"
  | "ai"
  | "society"
  | "state"
  | "foreign";

export interface SimNodeDef {
  id: string;
  name: string;
  category: SimCategory;
  /** Value with zero inbound influence. Every node reverts toward this. */
  base: number;
  /**
   * Fraction of the gap to target closed each turn (0–1). Low inertia = sluggish.
   * This is the single most important tuning knob: it decides how many turns pass
   * between a decision and the moment the player feels it.
   */
  inertia: number;
  /** Higher is better for the country? Used only for presentation. */
  goodHigh: boolean;
  description: string;
}

export type PolicyCategory =
  | "tax"
  | "economy"
  | "welfare"
  | "compute"
  | "safety"
  | "law"
  | "foreign"
  | "public";

export interface PolicyDef {
  id: string;
  name: string;
  category: PolicyCategory;
  description: string;

  /** Annual cost at full intensity, as a fraction of GDP. */
  costOfGdp?: number;
  /**
   * Annual revenue at full intensity, as a fraction of GDP, before behavioural
   * response. Laffer-style avoidance is applied by the budget model.
   */
  revenueOfGdp?: number;
  /**
   * How sharply revenue decays as the rate rises (0 = no avoidance, 1 = severe).
   * Capital is more mobile than payroll, so capital taxes get a higher value.
   */
  avoidance?: number;

  /** Political capital to enact from zero. */
  introCost: number;
  /** Political capital per 10 points of intensity change. */
  adjustCost: number;
  /** Political capital to repeal. Deliberately high — policies are sticky. */
  cancelCost: number;
  /** Turns to ramp from enactment to full effect. */
  implementation: number;

  /** Cannot be enacted unless these hold. */
  requires?: Condition[];
}

export type GroupIncome = "low" | "mid" | "high";

export interface GroupDef {
  id: string;
  name: string;
  /** Starting share of the electorate, in percent. Groups overlap, so these sum past 100. */
  membership: number;
  /** Membership floor and ceiling — no bloc vanishes or eats the whole country. */
  membershipRange: [number, number];
  income: GroupIncome;
  /** How fast happiness moves. High-volatility groups swing hard on news. */
  volatility: number;
  /** Resistance to defecting to the opposition, 0–100. */
  loyalty: number;
  /** Baseline share who vote, 0–100. */
  baseTurnout: number;
  description: string;
}

// ── Runtime state ────────────────────────────────────────────────────────────

export interface PolicyState {
  id: string;
  /** Player's chosen intensity, 0–100. Zero means not enacted. */
  intensity: number;
  /** Ramp progress toward `intensity`, 0–100. Effects use this, not intensity. */
  active: number;
  /** Turn the policy was first enacted, for UI and history. */
  enactedTurn: number | null;
}

export interface GroupState {
  id: string;
  membership: number;
  happiness: number;
  /** Rises under sustained anger; drives unrest, sabotage, and violence risk. */
  extremism: number;
  turnout: number;
}

export interface BudgetState {
  /** Abstract currency units; scenario-scaled so 1000 ≈ a mid-size economy. */
  gdp: number;
  revenue: number;
  spending: number;
  interest: number;
  /** revenue - spending - interest */
  balance: number;
  debt: number;
  /** debt / gdp */
  debtRatio: number;
  /** 0–100; drives the interest rate and business confidence. */
  creditRating: number;
}

export interface WorldState {
  /** The capability clock. Endgame fires when this crosses the threshold. */
  capability: number;
  /** Rival bloc capability, for the race/coordination dynamic. */
  rivalCapability: number;
  labs: LabState[];
  /** Accumulated hazard pressure per risk id, 0–100. */
  hazards: Record<string, number>;
  /** Incidents that have already fired, for narrative and scoring. */
  incidents: Incident[];
}

export interface LabState {
  id: string;
  name: string;
  /** Where it is headquartered — `domestic` means you can regulate it. */
  domestic: boolean;
  capability: number;
  /** 0–100. Low safety culture raises hazard accumulation. */
  safetyCulture: number;
  marketShare: number;
  /** 0–100. Drives regulatory capture. */
  lobbyingPower: number;
  /** 0–100. How willing it is to ship into an uncertain regime. */
  riskAppetite: number;
  relationship: number;
}

export interface Incident {
  turn: number;
  hazard: string;
  /** 0–100. Preparedness shifts this distribution down, it does not prevent the roll. */
  severity: number;
  headline: string;
}

export interface PoliticsState {
  /** Turns remaining in the current term. */
  turnsToElection: number;
  term: number;
  politicalCapital: number;
  /** Share of the vote won at the last election, 0–100. */
  mandate: number;
  /** Own-party cohesion, 0–100. Low loyalty throttles political capital. */
  partyLoyalty: number;
  opposition: OppositionState;
  /** Set when the run has ended, with the reason. */
  outcome: RunOutcome | null;
}

export interface OppositionState {
  name: string;
  leader: string;
  /** -100 (interventionist / pro-labour) … +100 (market / accelerationist). */
  economicAxis: number;
  /** -100 (accelerate) … +100 (restrict / safety-first). */
  aiAxis: number;
  /** Group ids whose cause the opposition has adopted. */
  championing: string[];
}

export type RunOutcome =
  | { kind: "defeated"; turn: number; voteShare: number }
  | { kind: "deposed"; turn: number; cause: string }
  | { kind: "threshold"; turn: number }
  | { kind: "termLimit"; turn: number };

export interface GameState {
  seed: number;
  scenarioId: string;
  turn: number;
  /** In-fiction year, for presentation. */
  year: number;
  config: RunConfig;

  policies: Record<string, PolicyState>;
  sim: Record<string, number>;
  groups: Record<string, GroupState>;
  /**
   * Per-bloc happiness offset that makes the scenario's *inherited* settlement
   * read as neutral. Voters react to changes from the status quo they already
   * live under, not to its absolute level. See `calibrateGroupBaselines`.
   */
  groupBaselines: Record<string, number>;
  budget: BudgetState;
  world: WorldState;
  politics: PoliticsState;

  /** Per-turn causal attribution, keyed by target ref. */
  trace: TraceEntry[];
  log: LogEntry[];
}

export interface RunConfig {
  /** "campaign" = 12 turns / 3 terms. "briefing" = 4 turns, one election. */
  mode: "campaign" | "briefing";
  turnsPerTerm: number;
  maxTurns: number;
  /** Capability level at which the endgame fires. */
  thresholdCapability: number;
  /** Scales hazard rates and opposition strength. */
  difficulty: number;
}

export interface TraceEntry {
  turn: number;
  /** Target ref, e.g. `sim.energy_price`. */
  target: string;
  from: number;
  to: number;
  /** Ranked inbound contributions, largest absolute first. */
  contributions: { source: string; amount: number; note?: string }[];
}

export interface LogEntry {
  turn: number;
  kind: "policy" | "incident" | "election" | "world" | "budget" | "unrest" | "outcome";
  text: string;
}

// ── Actions ──────────────────────────────────────────────────────────────────

/** A player instruction for the coming turn. */
export type Action =
  | { kind: "setPolicy"; id: string; intensity: number }
  | { kind: "pass" };

// ── Scenario ─────────────────────────────────────────────────────────────────

export interface ScenarioDef {
  id: string;
  name: string;
  flag: string;
  description: string;
  /** Starting GDP in abstract units. */
  gdp: number;
  startingDebtRatio: number;
  /** Overrides to sim node starting values. */
  sim?: Record<string, number>;
  /** Overrides to group starting membership. */
  membership?: Record<string, number>;
  /** Policies already in force at turn zero, id → intensity. */
  policies?: Record<string, number>;
  /** Multiplies every policy's cost — a proxy for state capacity and scale. */
  costMultiplier?: number;
  politicalSystem: "presidential" | "parliamentary" | "federal" | "one_party";
}
