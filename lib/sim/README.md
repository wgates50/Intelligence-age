# Simulation engine

A headless, dependency-free, deterministic simulation of governing a country
through the AI transition. Runs on plain `node` — Node 22 strips the TypeScript
natively, so there is no build step and no test framework to install.

```bash
npm run test:sim          # 23 engine + data-integrity tests
npm run sim:trace         # one annotated run, with causal chains
npm run sim:balance       # 4,800-run balance sweep across all scenarios

npm run sim:balance -- --runs 400 --scenario eu
npm run sim:trace -- --trace in --seed 12 --strategy safety-first
```

## The idea

The previous build authored its outcomes: an event's `fx` function said
`{growth: 8, equality: -8, trust: -6}` and those numbers happened. Every value
the player saw had been typed by a human, so it could be memorised, and one
playthrough taught you the dominant strategy.

Here nothing is authored except **structure**. ~110 nodes and ~180 weighted
edges describe how the world is wired; the outcomes are whatever falls out when
you perturb it. A representative chain, none of which is written down anywhere
as a sentence:

```
policy.datacentre_buildout  →  sim.grid_capacity      (-34, 1-turn delay)
sim.grid_capacity           →  sim.energy_price       (inverse, +46)
sim.energy_price            →  sim.cost_of_living     (+34)
sim.cost_of_living          →  group.retirees         (exponential, -44)
group.retirees              →  turnout ↑, support ↓
                            →  the opposition adopts their cause
                            →  you lose the election in 2032
```

You built data centres in year two and a pensioner's heating bill removed you
from office in year six.

## Layout

| File | Responsibility |
|---|---|
| `graph.ts` | Edge evaluation, transfer functions, neutral centring, causal trace |
| `tick.ts` | `tick(state, actions, rng) → state`. Pure and deterministic |
| `groups.ts` | Bloc happiness, **dynamic membership**, extremism, unrest |
| `election.ts` | Turnout, vote model, reactive opposition, political capital |
| `budget.ts` | Revenue with Laffer behaviour, spending, debt, credit rating |
| `world.ts` | Capability clock, frontier labs, rival blocs, risk register |
| `rng.ts` | Seeded mulberry32 |
| `types.ts` | All shared types |

World content lives in `lib/data` (`policies`, `simulation`, `groups`, `edges`,
`scenarios`). **The engine never names a specific policy, bloc, or node** — new
content is data rows, not code changes.

## Design rules

**`tick` is pure.** Same seed + scenario + action sequence ⇒ byte-identical run.
That buys replays, shareable seeds, regression tests over balance changes, and
eventually server-verified leaderboard submissions.

**Simultaneous update, not topological sort.** The graph is full of real
feedback loops (GDP → confidence → GDP). Every node is evaluated against *last*
turn's values and stepped together, so cycles resolve over turns instead of
being rejected. Per-node `inertia` keeps them stable and makes the lag structure
explicit rather than accidental.

**Non-policy edges are centred on their source's own base.** A node's declared
`base` means "its value in a world where nothing has happened", and every weight
reads as swing relative to that. Policy edges are *not* centred, because an
un-enacted policy already contributes zero.

Consequence: `delay` and `condition` may only be used on **policy** sources —
gating a non-policy edge would make the centring offset wobble as the gate
flips. There is a test enforcing this.

**Effects follow the implementation ramp, not the slider.** Grid investment
takes four turns to bite. A programme enacted in your final year costs you the
money and buys you nothing, and no turn-10 correction fixes a turn-3 mistake.

**Repeal costs far more political capital than enactment.** Policies are sticky,
so the state you have built constrains the government you can later be.

**Preparation changes severity, not probability.** Hazards accumulate and are
rolled against every turn. Being ready doesn't stop the roll — it shifts the
severity distribution down and drains standing pressure faster. That preserves
both "I got unlucky" and "my prep paid off", which is what makes a run worth
repeating.

## The balance harness

A graph this size cannot be tuned by hand — an edge three hops from a bloc can
flip an election, and playtesting will not find that reliably. `test/balance/`
plays thousands of games under seven strategy archetypes plus a random control,
then reports survival, stewardship, node distributions, and automatic warnings
for dominant strategies, dead strategies, and inert or pinned nodes.

It earned its place immediately. Three defects it caught that reading the code
did not:

1. **Centring on a blanket midpoint inverted the premise of the game.** Nodes
   that deliberately start low (diffusion 30, capability 30 — this is a world
   *before* its transition) were being told their inputs were unusually weak, so
   `automation_rate` fell from 30 to 9 over a campaign. An AI-transition game in
   which automation *decreases* is not a balance problem, it is a broken model.

2. **Scenario-inherited taxes made every bloc start angry.** Taxes have only
   negative happiness edges — their benefits arrive indirectly through the sim
   nodes the spending improves. So a scenario starting with a 42% income tax
   scored as though the electorate had just been handed a tax rise it never
   voted for. Every archetype lost its first election. Fixed by calibrating each
   bloc's baseline against the inherited settlement, which is also the truer
   model: voters react to changes from the status quo, not its absolute level.

3. **A government holding every bloc at exactly neutral still polled 46%** and
   lost a coin flip twice, so no run reached a third term. Fixed with an
   explicit incumbency advantage in the support curve.

Current state — 4,800 runs, four scenarios:

```
strategy          survive  stewardship  outcome mix
technocrat            91%         49.7  threshold  14%
spread-thin           75%         43.2  termLimit  30%
random control        49%         43.4  defeated   55%
populist              48%         42.1  deposed     0%
safety-first          36%         50.1
social-democrat       33%         41.9  mean run: 8.5 turns
laissez-faire         22%         40.8
accelerate             5%         41.2
```

Note that `safety-first` has the best stewardship score and only the fifth-best
survival, while `populist` is the reverse. That gap *is* the game: the
divergence between doing the transition well and staying in office to keep
doing it.

## Known balance gaps

Honest list, for the next tuning pass:

- **`technocrat` is dominant at 91%.** Needs a real weakness — most likely it
  should be more exposed to the labour blocs it under-serves.
- **`accelerate` is close to dead at 5%.** The chain killing it is correct
  (buildout → grid headroom → energy price → rural and pensioner fury, plus an
  incident drumbeat from having no safety regime), but a legitimate archetype
  should be viable if played with grid investment first. Worth checking whether
  it is unwinnable or merely demanding.
- **`deposed` never fires.** Extremism only accumulates below 32 happiness, which
  the current numbers rarely reach, so the unrest and mass-mobilisation path is
  effectively dead content.
- **Threshold fires in only 14% of runs.** Reasonable as the exceptional ending,
  but worth confirming that is a decision rather than an accident of tuning.
- `wage_share` and `media_sentiment` have narrow ranges and may be under-powered.
