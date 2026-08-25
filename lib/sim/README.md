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
| `dilemmas.ts` | State-triggered dilemma selection, gated options, deferred consequences |
| `rng.ts` | Seeded mulberry32 |
| `types.ts` | All shared types |

World content lives in `lib/data` (`policies`, `simulation`, `groups`, `edges`,
`scenarios`, `dilemmas`). **The engine never names a specific policy, bloc, or node** — new
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

## Dilemmas

The old build shuffled a deck of ~50 events. You saw about a sixth per run, and
the correct answer to each was fixed, so the deck was memorised long before it
was exhausted.

Here a dilemma declares the conditions under which it is **relevant**, and the
engine draws from whatever the world currently makes eligible. An energy revolt
fires because you made energy expensive and rural voters angry; a biosecurity
crisis fires because capability outran your evaluation coverage. Same library,
different run — and events feel earned rather than dealt.

Three further departures:

- **Options are gated, and locked ones are shown with their reason.** You cannot
  activate containment protocols you never built. The locked option, and the
  sentence explaining it, is how the player learns what to build next run.
- **Consequences are deferred**, resolving 2–6 turns later and often branching on
  the state of the world *at that point* rather than at the time of the choice.
  The retraining programme you funded three years ago decides how the layoff
  wave you are living through now lands.
- **The player never sees the numbers.** Each option carries an advisor's
  forecast in words — "Treasury: this works if, and only if, diffusion actually
  lands." Choices are judgement, not arithmetic.

Ignoring a dilemma is itself a choice: it lapses, and costs trust.

## The balance harness

A graph this size cannot be tuned by hand — an edge three hops from a bloc can
flip an election, and playtesting will not find that reliably. `test/balance/`
plays thousands of games under seven strategy archetypes plus a random control,
then reports survival, stewardship, node distributions, and automatic warnings
for dominant strategies, dead strategies, and inert or pinned nodes.

It also reports **dilemma fire rates**, because a state-triggered library fails
silently: content whose trigger never matches is indistinguishable from content
that was cut, and nobody notices. On its first run against the new library it
found four dilemmas that never fired in 3,600 runs and one that fired in every
single one — every trigger had been authored against a guessed threshold rather
than the range its node actually occupies.

It earned its place immediately. Defects it caught that reading the code did not:

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

Current state — 3,600 runs, four scenarios:

```
strategy          survive  stewardship
technocrat            76%         48.1
spread-thin           60%         41.9
populist              40%         41.2
random control        40%         42.9
safety-first          31%         49.6
social-democrat       30%         41.6
laissez-faire         21%         41.5
scapegoat             15%         40.6
accelerate             8%         40.6

outcomes: defeated 64% · termLimit 25% · threshold 11% · deposed <1%
mean run: 8.0 turns · all 14 dilemmas fire · no red flags
```

Note that `safety-first` has the best stewardship score and only the fifth-best
survival, while `populist` is the reverse. That gap *is* the game: the divergence
between doing the transition well and staying in office to keep doing it.

## Known balance gaps

Honest list, for the next tuning pass:

- **`accelerate` is close to dead at 4%.** The chain killing it is correct
  (buildout → grid headroom → energy price → rural and pensioner fury, plus an
  incident drumbeat from having no safety regime), but a legitimate archetype
  should be viable if played with grid investment first. Worth confirming
  whether it is unwinnable or merely demanding.
- **`deposed` fires in well under 1% of runs.** It was completely unreachable
  before this pass — peak extremism across 300 deliberately hostile runs was 22
  against a threshold of 45 — and now fires roughly twice per 300 runs of the
  `scapegoat` archetype on the US scenario. Reachable is better than dead, but
  at this rate most players will never see it. The remaining blocker is that
  social cohesion is the slowest node in the game by design, so a 12-turn
  campaign struggles to drag it into the danger zone.
- **`technocrat` still leads at 78%** (down from 91% after trimming the
  happiness returns on AI literacy and public access, and raising their costs).
  Probably acceptable now — it *should* be a strong strategy — but worth
  watching that it does not simply dominate.
- **Threshold fires in 13% of runs.** Reasonable as the exceptional ending, but
  confirm that is a decision rather than an accident of tuning.
- `wage_share` and `media_sentiment` have narrow ranges and may be under-powered.

## Playing it

The engine is headless, but there is a playable front end at `/play`. The
original game is untouched and still lives at `/`.

```bash
npm run dev            # then open http://localhost:3000/play
npm run test:ui        # browser smoke test (needs a server already running)
```

The governing screen puts everything needed for one decision on one page:
policies with their political-capital and fiscal price, the country in the
middle, blocs on the right, dilemmas below. **Every simulation node is
clickable**, and clicking one shows its ranked inbound contributions read
straight from the engine's causal trace — so the explanation can never drift
out of sync with the model. If a number moved, the reason shown is the reason
it moved.
