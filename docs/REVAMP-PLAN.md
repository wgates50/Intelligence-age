# The Intelligence Age — Revamp Plan

**Status:** Proposal / RFC
**Goal:** Turn a one-play, deterministic policy quiz into a replayable systems simulation, using *Democracy 4/5* as the architectural reference point.

---

## 1. Diagnosis

The current build (`app/game.jsx`, 2,313 lines) is a well-written **branching narrative with a scoreboard**. It is not a simulation. Six structural facts explain why it is predictable and why nobody replays it:

### 1.1 There is no simulation between turns

Metrics only change because an event's `fx` function says so:

```js
fx:(a)=>({growth:8,equality:-8,trust:-6,innovation:6,wellbeing:-10,geopolitics:2, ...})
```

`applyFeedback()` is the only systemic layer, and it's nine hardcoded `if` statements. Nothing propagates. Nothing lags. Nothing compounds in a way the designer didn't type out by hand. **Every number the player sees was authored by a human, so the player can memorise it.**

### 1.2 Every dilemma has a knowable right answer

Outcomes are gated on cumulative investment thresholds:

```js
equality: a.nets>=2 ? 6 : 2
good: a.safety>=1
requires:{policy:"safety",cumMin:8}
```

After one playthrough the player knows the rule: *put ≥2 into everything, ≥8 lifetime into safety and governance.* Because diminishing returns kick in above 2 (`diminish()`), spreading thin is also mathematically optimal. There is exactly one dominant strategy, and the game teaches it in run one.

### 1.3 Factions are a readout, not actors

```js
calc: a => ((a.grid||0)+(a.science||0)+(a.access||0))*4 - ((a.tax||0)+(a.safety||0))*6
```

Satisfaction is a linear function of *this round's* allocation, mean-reverting to 50. Factions have no membership size, no memory, no internal disagreement, no ability to act on their own initiative, and no relationship with each other. They cannot grow or shrink. Nothing you do changes *who exists* in your society.

### 1.4 No fail state, therefore no tension

You cannot be removed from office. You cannot go bankrupt. The only loss condition is the endless-mode collapse check, which happens after the story is over. Every decision is consequence-free in the only way that matters: you always get to keep playing.

### 1.5 The economy is abstract

"Points" have no source and no cost. There is no GDP, no revenue, no debt, no interest, no bond market, no physical constraint on compute or electricity. The central real-world tension of AI industrial policy — *data centres and households competing for the same electrons and the same dollars* — is a flavour string, not a mechanic.

### 1.6 The arc is fixed

8 rounds. Era-weighted deck. `FINAL_EVENT` is always "The Threshold" at round 7. The endgame is `getGrade()` — a lookup on mean and min — plus canned paragraphs from `endNarrative()`.

**What is genuinely good and should survive:** the writing, the subject-matter grounding, the visual/editorial identity, the glossary and source citations, the one-pager export, the seeded-weekly idea, and the fundamental premise. This plan keeps all of it.

---

## 2. Design thesis

> Stop authoring outcomes. Author a **world**, and let outcomes fall out of it.

Six systems replace the current core loop. Each one independently attacks predictability:

| System | Kills predictability by… |
|---|---|
| **A. Simulation graph** | Making 3rd-order effects nobody hand-wrote |
| **B. Voter blocs with dynamic membership** | Changing *who your society is* based on your policies |
| **C. Elections + political capital** | Adding a fail state and a "right vs. survivable" dilemma |
| **D. Budget & physical economy** | Making scarcity real, shaped, and different each run |
| **E. The AI world-sim** | Adding autonomous actors and a stochastic capability clock |
| **F. Uncertainty layer** | Removing exact numbers, replacing them with forecasts |

---

## 3. System A — The Simulation Graph

The heart of the rebuild. Replace 7 metrics + hardcoded `fx` with a **directed weighted graph of ~110 nodes** evaluated to a fixed point each turn.

### 3.1 Node types

**Policy nodes (~45, up from 10).** Each has an *intensity slider* (0–100%), not a point count.

```ts
interface Policy {
  id: "automation_levy";
  name: "Automation Levy";
  category: "tax" | "economy" | "welfare" | "compute" | "safety" | "law" | "foreign" | "public";
  cost: (intensity: number, sim: SimState) => number;   // often non-linear; scales with GDP/population
  revenue?: (intensity: number, sim: SimState) => number;
  introCost: number;      // political capital to enact
  adjustCost: number;     // PC to change intensity
  cancelCost: number;     // PC to repeal — deliberately high (policies are sticky)
  implementation: number; // turns to reach full effect (0.0–1.0 ramp)
  prerequisites?: NodeCondition[];
}
```

The **implementation lag** and **repeal stickiness** are load-bearing. They mean a turn-8 correction cannot fix a turn-3 mistake, which is the single biggest source of genuine strategic depth in Democracy.

**Simulation nodes (~35).** The state of the world. Each is 0–100 with inertia.

> *Economy:* GDP · Productivity · Unemployment · Inflation · Wage Share · Automation Rate · Business Confidence · Small Business Health · Housing Cost · Cost of Living · Debt/GDP · Credit Rating
> *Compute & energy:* Compute Supply · Chip Access · Grid Capacity · Energy Price · Water Stress · Data Centre Siting Pressure · Emissions
> *AI system state:* Frontier Capability · Diffusion Rate · Model Proliferation · Open-Weight Availability · Alignment Confidence · Eval Coverage · Incident Rate
> *Society:* Public Understanding of AI · Media Sentiment · Civic Trust · Social Cohesion · Crime · Health · Education Quality
> *State capacity:* Institutional Capacity · Corruption · Regulatory Capture · Intelligence Quality
> *Foreign:* Alliance Strength · Rival Capability Gap · Trade Openness · Treaty Compliance

**Group nodes (~20).** See System B.

### 3.2 Edges

Every edge is **data**, not code:

```ts
interface Edge {
  from: NodeId;
  to: NodeId;
  fn: "linear" | "inverse" | "threshold" | "exponential" | "sigmoid";
  weight: number;        // magnitude, signed
  inertia: number;       // 0–1: fraction of the delta applied per turn (lag)
  delay?: number;        // turns before the edge activates at all
  condition?: NodeCondition;  // edge only fires in certain world states
}
```

Example authored fragment:

```ts
{ from:"policy.datacentre_buildout", to:"sim.compute_supply", fn:"linear",     weight:+38, inertia:0.25, delay:2 },
{ from:"policy.datacentre_buildout", to:"sim.grid_capacity",  fn:"linear",     weight:-30, inertia:0.35 },
{ from:"sim.grid_capacity",          to:"sim.energy_price",   fn:"inverse",    weight:+45, inertia:0.4  },
{ from:"sim.energy_price",           to:"sim.cost_of_living", fn:"linear",     weight:+30, inertia:0.5  },
{ from:"sim.cost_of_living",         to:"group.retirees.happiness",  fn:"exponential", weight:-55, inertia:0.6 },
{ from:"sim.cost_of_living",         to:"group.rural.happiness",     fn:"exponential", weight:-40, inertia:0.6 },
{ from:"sim.compute_supply",         to:"sim.frontier_capability",   fn:"linear",  weight:+25, inertia:0.3 },
{ from:"sim.frontier_capability",    to:"sim.automation_rate",       fn:"sigmoid", weight:+50, inertia:0.45, delay:1 },
{ from:"sim.automation_rate",        to:"group.displaced.membership",fn:"linear",  weight:+35, inertia:0.5 },
```

That fragment — nine data rows — produces the chain *"you built data centres, three years later a rural pensioner voted against you because of their heating bill, and there are now 8% more displaced workers than when you took office."* Nobody wrote that sentence. It fell out.

### 3.3 Evaluation

```ts
function tick(state: GameState, rng: RNG): GameState
```

Pure and deterministic given a seed. Per turn:

1. Advance policy implementation ramps
2. Evaluate the graph in topological order (with damped iteration for cycles — 4 passes)
3. Apply inertia: `next = current + (target - current) * inertia`
4. Recompute group membership → happiness → turnout
5. Run budget: revenue, spend, deficit, interest, credit rating
6. Advance the AI world-sim (System E)
7. Roll the risk register
8. Select dilemmas whose trigger conditions are met
9. Emit a **causal trace** — the top contributing edges for every node that moved

Step 9 is not optional. It powers the UI, the debugging, and the end-of-run history book.

### 3.4 Why this is the highest-leverage change

Everything else in this plan is a feature. This is an *engine*. Once it exists, adding a policy is 1 data row + 5 edge rows and the whole system reacts. Right now, adding a policy means editing 50 event `fx` functions.

---

## 4. System B — Voter blocs with dynamic membership

Replace the 4 static factions with ~20 overlapping blocs.

```ts
interface Group {
  id: "displaced_workers";
  name: "Displaced Workers";
  membership: number;      // % of population — DYNAMIC
  happiness: number;       // 0–100
  loyalty: number;         // 0–100, resistance to swing
  turnout: number;         // 0–100
  income: "low" | "mid" | "high";
  volatility: number;      // how fast happiness moves
  extremism: number;       // 0–100, rises with sustained anger → unrest/violence risk
}
```

**Roster:** Displaced Workers · AI Engineers · Capitalists · Small Business · Union Members · Retirees · Students · Parents · Farmers · Creatives · Healthcare Workers · Teachers · Civil Servants · Environmentalists · Security Hawks · Libertarians · Religious Conservatives · Rural · Urban Professionals · AI Safety Advocates · Accelerationists · Ethnic Minorities

**Membership is driven by sim nodes.** This is the mechanic the current game most conspicuously lacks:

- `Accelerationists` grows with Frontier Capability and Business Confidence
- `AI Safety Advocates` grows with Incident Rate and Public Understanding
- `Displaced Workers` grows with Automation Rate, shrinks with Retraining and Care-Sector Expansion
- `Capitalists` grows when capital gains tax is low and Wage Share falls
- `Union Members` grows with Worker Voice policy, shrinks with Automation Rate

**Consequence:** your policies reshape the electorate. Deregulate hard and you *manufacture* a large, angry Displaced Workers bloc and a small, rich Capitalist bloc — then you must govern the country you made. Two runs with identical starting conditions diverge into different societies. This alone produces more replay value than doubling the event deck.

**Groups overlap.** A person can be a Rural Parent who is also a Union Member. Membership sums well past 100%, and a policy that pleases one identity while angering another produces cross-pressured, low-turnout voters — a genuine political texture.

**Extremism.** Sustained anger above a threshold raises a group's `extremism`. High extremism unlocks unrest events, sabotage, strikes, capital flight, brain drain, and (at the extreme) assassination or coup attempts — real, run-ending consequences for ignoring a bloc.

---

## 5. System C — Elections, political capital, and losing

### 5.1 The term structure

- 1 round = 1 year. 1 term = 4 years. Game = up to 3 terms (12 years), or until the capability clock triggers the endgame (System E), or until you lose office.
- Every 4th round is an **election**.

### 5.2 The election model

```
groupVote(g)   = f(g.happiness, opposition.platformFit(g), g.loyalty)
effectiveVote  = Σ g.membership × g.turnout × groupVote(g)
result         = effectiveVote + swing(rng, σ) + incumbencyEffect + campaignEffects
```

- **Opposition parties are procedurally generated** each run: an ideology vector, a platform of 4–6 policy pledges, a leader with traits (charismatic / technocratic / populist / hawkish). They *react* — if you leave a bloc angry, the opposition adopts its cause.
- **Polling has margin of error.** You never know the real number. Fund the statistical service and σ narrows.
- **You can lose.** Losing shows an epilogue: what the opposition did with your country, scored against your prep. This is the tension the game currently has none of.

### 5.3 Political capital

Per-turn PC income = f(mandate size, party loyalty, cabinet competence, recent scandals, honeymoon period).

Spend PC on: enacting policies (expensive), adjusting them (cheap), repealing them (very expensive), overriding your own party, forcing a dilemma option your cabinet opposes, calling a snap election, campaigning.

**This is the real resource.** It replaces the abstract 4–9 points, and unlike points it is *earned by governing well*, creating a virtuous/vicious cycle instead of a flat allowance.

### 5.4 The core dilemma this creates

Correct AI policy and popular AI policy diverge. Compute buildout is necessary and raises energy bills. Safety regulation is necessary and slows growth. Automation levies are necessary and spook capital. **The game becomes: how much of the right thing can you do and still be in the room when it matters?** That is the question the subject matter actually poses, and the current build cannot express it.

---

## 6. System D — Budget and the physical economy

### 6.1 Money

- **Revenue bases:** income tax, corporate tax, capital gains, VAT/sales, payroll, automation levy, compute levy, data levy, energy levy, tariffs, state AI dividend
- **Spend:** every policy has a cost curve; many scale with population or GDP so they get *more expensive as the crisis deepens*
- **Debt:** deficit accumulates; interest is charged; credit rating responds; a downgrade raises interest and hits Business Confidence
- **Bond market events** fire when Debt/GDP crosses thresholds

Tax nodes need proper **Laffer behaviour** (revenue peaks then falls as avoidance and capital flight rise) so "just tax more" isn't a free lunch.

### 6.2 Physical constraints — the thematic centrepiece

Compute is not a number you buy. It is a chain:

```
Chip Access ─┐
Grid Capacity├─→ Compute Supply ─→ Frontier Capability ─→ Automation Rate
Water/Land  ─┘         │
                       └─→ competes with → Household Energy → Cost of Living → Anger
```

Every unit of compute you enable has a *sited, physical, local* cost that shows up as a furious constituency three turns later. This is the single most distinctive mechanic available to this game and it currently exists only as flavour text in "Grid Revolt" and "Water Crisis".

---

## 7. System E — The AI world-sim

Democracy has no equivalent to this. It is what makes the game *this* game rather than a reskin.

### 7.1 The capability clock

Frontier Capability advances every turn on a stochastic curve driven by global compute, your talent pool, rival investment, and algorithmic-progress rolls. **Runs diverge on the clock alone** — takeoff might be year 6 or year 14.

### 7.2 Frontier labs as autonomous actors

3–5 labs, **procedurally seeded each run**: name, jurisdiction, capability, safety culture, market share, lobbying budget, risk appetite, CEO temperament.

Each turn they act on their own logic:
- release a model (raises Diffusion, may raise Incident Rate)
- relocate to a lighter-touch jurisdiction (you lose oversight *and* tax base)
- lobby (raises Regulatory Capture, generates dilemmas)
- suffer a leak/whistleblower/safety incident
- merge, defect from a voluntary agreement, or go open-weights

**Over-regulate → they leave and you govern nothing. Under-regulate → incidents.** A real, dynamic optimum that moves with the world state and cannot be memorised.

### 7.3 Rival nations

3–4 blocs with their own capability, safety, and cooperation postures, running a **prisoner's-dilemma**: export controls, treaties, joint eval regimes, espionage. Their behaviour responds to yours over a multi-turn horizon, so racing and coordinating are both viable and both risky.

### 7.4 The risk register

Latent hazards, each with an accumulating hazard rate driven by sim state:

| Hazard | Driven up by | Driven down by |
|---|---|---|
| Bio misuse | Frontier Capability, Open-Weight Availability | Eval Coverage, Biosecurity, Screening |
| Cyber / critical infra | Diffusion, Model Proliferation | Cyber Defence, Incident Reporting |
| Autonomy / self-replication | Capability, low Alignment Confidence | Containment, Compute Governance |
| Disinformation collapse | Diffusion, low Media Trust | Provenance/Trust Stack, Literacy |
| Market instability | Automation Rate, Concentration | Circuit Breakers, Antitrust |
| Alignment failure | Capability ≫ Alignment Confidence | Interpretability, Eval Coverage |

Each turn: roll. **Preparation does not prevent the roll — it changes the severity distribution and unlocks better response options.** This produces the two feelings a replayable game needs: *"I got unlucky"* and *"my prep paid off."* Neither exists today.

### 7.5 A variable endgame

The Threshold fires when the capability clock crosses a line — not at round 7. Resolution is scored against your actual preparedness state (containment, alignment confidence, distribution, alliances, institutional capacity, public trust), producing a **generated** epilogue rather than one of five canned grades.

---

## 8. System F — Dilemmas, uncertainty, and information

### 8.1 State-triggered dilemmas

Retire the shuffled deck. Dilemmas declare **trigger conditions** and are drawn from whatever is eligible:

```ts
{
  id: "energy_revolt",
  trigger: { all: [
    { node:"sim.energy_price", op:">", value:65 },
    { node:"group.rural.happiness", op:"<", value:35 },
  ]},
  weight: 3,
  cooldown: 6,
  options: [ /* 3–5 */ ],
}
```

Same content library, radically different experience per run — because *what fires* is a function of the world you made. It also makes events feel earned rather than random.

### 8.2 Options: 3–5, gated, with real costs

Each option may require political capital, a prerequisite institution, a relationship level with a lab or ally, or a minimum Institutional Capacity. Gated options are **shown but locked, with the reason** — teaching the systems and creating "next time I'll build the audit bureau early."

### 8.3 Deferred, hidden consequences

Options set flags that resolve 2–6 turns later via the graph. **You do not see the numbers.** You see an advisor's forecast:

> *Treasury estimates: growth −2 to +1 over three years (low confidence). Chief Scientist: incident risk down "substantially" (medium confidence).*

Forecast accuracy is itself a simulated quantity, driven by Institutional Capacity, Intelligence Quality, and Eval Coverage. **Investing in state capacity buys you better information** — a mechanic that is thematically perfect for this subject and, as far as I know, novel.

### 8.4 Negotiation dilemmas

A lab CEO, union leader, or foreign minister makes an ask and an offer. You can accept, refuse, or **counter-offer** by spending relationship capital. Relationships persist across the run and gate future options.

---

## 9. Presentation

### 9.1 The node web

Democracy's signature screen, and here it is also the game's thematic art — a neural graph:

- **Left:** policy nodes, coloured by category, sized by spend
- **Centre:** simulation nodes, sized by magnitude, animated influence arrows
- **Right:** voter blocs, sized by membership, coloured by happiness
- **Hover any node:** its inbound edges ranked by contribution — *"Unemployment ← Automation Rate +34 · Retraining −12 · GDP −9"*
- **Click any node:** history sparkline + full causal breakdown

This is what makes a 110-node sim legible instead of opaque. Keep the existing editorial/newsprint palette and typography — Newsreader + JetBrains Mono is a genuinely good identity and suits a "briefing document" framing.

### 9.2 Turn structure

1. **Briefing** — newspaper front page: what moved, why, who's angry
2. **Governing** — node web + policy adjustment + budget, spending PC
3. **Dilemmas** — 1–3, state-triggered
4. **Resolution** — causal trace of what your turn did
5. **Every 4th turn: Election**

### 9.3 End of run

A generated **history book** built from the causal trace: the actual chain of decisions and consequences, with the counterfactual moments highlighted ("your term turned on the year you cancelled the retraining programme"). Keep the one-pager PDF export — it's a genuinely nice artefact — and regenerate it from the trace.

---

## 10. Replayability, explicitly

| Lever | Mechanism |
|---|---|
| Different world each run | Procedural labs, opposition parties, capability clock, risk rolls |
| Different society each run | Dynamic group membership reshapes the electorate |
| Different pacing each run | Variable endgame timing, state-triggered dilemmas |
| Different constraints each run | Scenario generator (below) |
| Different *rules* each run | Political system variants |
| Reason to come back | Unlocks, scenarios, mutators, seeded weeklies, ladder |

### 10.1 Scenario generator

A country becomes a parameter set: starting sim values, group memberships, institutional strengths, resource endowments, geography, and **political system**. Ship ~8 handcrafted (keeping US/EU/CN/IN/Global South) + a randomiser + shareable seeds.

### 10.2 Political system variants — change the *rules*, not the numbers

- **Presidential:** fixed terms, veto, hostile legislature
- **Parliamentary coalition:** you need a partner party happy or you fall mid-term
- **Federal:** states can defect from your policies (the existing "State Regulatory Patchwork" event becomes a system)
- **One-party state:** no elections, but legitimacy and coup risk; total policy control
- **Supranational bloc:** every major policy needs member-state ratification

### 10.3 Cabinet

Hire ministers with traits (loyalty, competence, ideology, ambition). They generate PC, cut policy costs in their brief, improve forecast accuracy — and can resign, leak, or challenge you.

### 10.4 Mutators and unlocks

Extend the existing weekly-seed system into full mutators (Hard Takeoff · Fiscal Crisis · Hostile Press · Multipolar Race · Open Weights Everywhere). Unlock policies, scenarios, and mutators through achievements to give a progression spine.

---

## 11. Technical plan

### 11.1 The current file cannot carry this

`app/game.jsx` holds data, logic, and UI in one 2,313-line client component with ~45 `useState` hooks. Adding a simulation graph to it is not viable.

### 11.2 Target structure

```
lib/
  sim/
    graph.ts          # node/edge types, topological eval, damped cycles
    tick.ts           # pure (state, rng) => state
    budget.ts         # revenue, spend, debt, credit
    groups.ts         # membership, happiness, turnout, extremism
    election.ts       # vote model, swing, opposition AI
    world.ts          # capability clock, labs, rivals
    risk.ts           # hazard rates and rolls
    trace.ts          # causal attribution
    rng.ts            # seeded (mulberry32, already present)
  data/
    policies.ts  simulation.ts  groups.ts  edges.ts
    dilemmas/*.ts  labs.ts  scenarios.ts  mutators.ts
  state/
    reducer.ts  save.ts  migrate.ts
app/
  (game)/  components/  api/
test/
  sim/*.test.ts
  balance/harness.ts   # headless N-run simulator
```

**`tick()` must be pure and deterministic.** That buys testability, replays, shareable seeds, and eventually server-verified leaderboard runs. Full TypeScript — the repo is already TS, the game is the only JSX file.

### 11.3 The balance harness is not optional

A 110-node graph cannot be balanced by hand. Build a headless runner that plays N thousand games under scripted and random strategies and reports:

- win/loss and re-election rates by scenario and difficulty
- distribution of every sim node over time
- **dominant-strategy detection** — does one policy set win too often?
- degenerate states (runaway values, dead ends, unreachable dilemmas)
- dilemma fire rates (which content never appears?)

Wire it into CI. Every edge-weight change gets a before/after report. **This is the difference between a sim that feels alive and one that feels broken.**

### 11.4 Note on Next.js

Per `AGENTS.md`, this repo's Next.js (16.2.3) has breaking changes vs. training data. Any implementation work reads `node_modules/next/dist/docs/` first. The sim engine is framework-agnostic, so most of the work is unaffected.

---

## 12. Phasing

Each phase ships a playable game. No big-bang rewrite.

| Phase | Scope | Outcome |
|---|---|---|
| **0. Foundation** | Extract data/logic/UI from `game.jsx`; TypeScript; seeded RNG everywhere; headless harness + tests. **No behaviour change.** | Existing game, now maintainable and testable |
| **1. Simulation graph** | Engine + budget. 10 policies → ~45; 7 metrics → ~35 sim nodes; author the edge set. Node-web UI. | Effects emerge instead of being authored |
| **2. Politics** | Voter blocs with dynamic membership; elections; political capital; opposition AI. | **The game becomes losable** — the biggest single change |
| **3. AI world-sim** | Capability clock, procedural labs, rival nations, risk register, variable endgame. | Every run's world is different |
| **4. Dilemma engine** | State-triggered dilemmas, 3–5 gated options, deferred consequences, negotiation. Port and expand existing writing. | Content adapts to the world |
| **5. Uncertainty & variety** | Forecast/confidence layer, cabinet, scenario generator, political systems, mutators, unlocks. | Judgment replaces arithmetic |
| **6. Balance & polish** | Harness-driven tuning, history book, export, tutorial, accessibility, mobile. | Ship |

Phases 0–2 alone fix the "played it once" problem. Phases 3–5 are what make it a game people return to weekly.

---

## 13. Open decisions

These materially change the design and are flagged for the owner:

1. **Session length.** Currently ~10 min. Democracy runs 45–90 min. A 110-node sim with elections lands naturally at 30–45 min. Do we target the longer session, or engineer a tight 15-minute "briefing" mode on top of the same engine?
2. **Can the player lose office?** This is the largest tonal fork. It transforms an educational artefact into a strategy game. Recommended, but it changes what the thing *is*.
3. **Audience.** Is this primarily a shareable, credible policy explainer (the glossary, citations, and one-pager suggest yes) or a game-first product? It can be both, but they pull on difficulty, length, and framing in opposite directions.
4. **Visual direction.** Keep the editorial/newsprint identity and add the node web inside it, or rebuild toward a denser dashboard?
5. **Content volume.** This wants ~45 policies, ~20 blocs, and 100+ dilemmas. Ship a smaller vertical slice first, or author the full library up front?
6. **Timeline and process.** Six phases is substantial. One long-running branch, or phase-by-phase PRs against `main`?
