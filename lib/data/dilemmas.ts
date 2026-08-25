/**
 * Dilemmas.
 *
 * Each one declares when it is *relevant* rather than sitting in a shuffled
 * deck. An energy revolt fires because you made energy expensive and rural
 * voters angry; a biosecurity crisis fires because capability outran your
 * evaluation coverage. Same library, different run.
 *
 * Authoring rules:
 *  - Triggers reference real sim nodes, blocs, or world state.
 *  - Gated options are *shown* with their reason. Locked is a lesson, not a wall.
 *  - Most consequences are deferred and may branch on the world at resolution
 *    time, so preparation made for forgotten reasons decides how a crisis lands.
 *  - `forecast` is what the player actually reads. Never the real numbers.
 */

import type { DilemmaDef } from "../sim/types.ts";

export const DILEMMAS: readonly DilemmaDef[] = [
  // ═══ ENERGY & INFRASTRUCTURE ═══════════════════════════════════════════════
  {
    id: "energy_revolt",
    title: "The Bill Arrives",
    subtitle: "Household energy costs are up sharply. Three counties are blocking new data centre construction.",
    category: "INFRASTRUCTURE",
    weight: 3,
    cooldown: 5,
    trigger: {
      all: [
        { ref: "sim.energy_price", op: ">", value: 53 },
        { ref: "group.rural.happiness", op: "<", value: 47 },
      ],
    },
    options: [
      {
        label: "Community benefit agreements",
        detail: "Local ownership stakes, capped household tariffs, and hiring guarantees where clusters are sited.",
        cost: 12,
        forecast: "Treasury: costly, and slows the buildout. Rural affairs: this is the only offer they will accept.",
        effects: [
          { target: "group.rural.happiness", amount: 8 },
          { target: "sim.public_trust", amount: 3 },
        ],
        deferred: [{
          turns: 3,
          condition: { ref: "sim.grid_capacity", op: ">", value: 50 },
          effects: [{ target: "group.rural.happiness", amount: 7 }, { target: "sim.social_cohesion", amount: 5 }],
          text: "The community agreements held. Siting disputes are now routine rather than existential.",
          elseEffects: [{ target: "group.rural.happiness", amount: -4 }, { target: "sim.public_trust", amount: -5 }],
          elseText: "The agreements were signed but the grid never arrived. Communities call it a bribe that bought nothing.",
        }],
        sets: ["community_agreements"],
      },
      {
        label: "Emergency price cap",
        detail: "Freeze household tariffs and absorb the difference from the public purse.",
        cost: 8,
        forecast: "Treasury: expensive and hard to unwind. Popular immediately, and for about two years.",
        effects: [
          { target: "sim.cost_of_living", amount: -9 },
          { target: "group.retirees.happiness", amount: 7 },
          { target: "sim.business_confidence", amount: -5 },
        ],
        deferred: [{
          turns: 4,
          effects: [{ target: "sim.grid_capacity", amount: -7 }, { target: "sim.business_confidence", amount: -5 }],
          text: "The price cap has suppressed generation investment for four years. The shortfall is now structural.",
        }],
      },
      {
        label: "Federal siting override",
        detail: "Declare national interest and strip local authorities of the power to block construction.",
        cost: 20,
        forecast: "Compute strategy: fastest route to capacity by a wide margin. Everyone else: don't.",
        effects: [
          { target: "sim.compute_supply", amount: 7 },
          { target: "group.rural.happiness", amount: -16 },
          { target: "group.rural.extremism", amount: 14 },
          { target: "sim.public_trust", amount: -7 },
        ],
        sets: ["siting_override"],
      },
    ],
  },

  // ═══ LABOUR ════════════════════════════════════════════════════════════════
  {
    id: "displacement_wave",
    title: "The Overnight Layoff",
    subtitle: "AI agents replaced 200,000 service roles in a single quarter. The pace is accelerating.",
    category: "LABOUR",
    weight: 3,
    cooldown: 4,
    trigger: {
      all: [
        { ref: "sim.automation_rate", op: ">", value: 52 },
        { ref: "sim.unemployment", op: ">", value: 36 },
      ],
    },
    options: [
      {
        label: "Activate transition pathways",
        detail: "Route the displaced into funded retraining and the care economy immediately.",
        // The gate is the whole point: the programme has to already exist. You
        // cannot build a retraining system during the wave it was meant to catch.
        requires: [{
          reason: "Requires a Transition & Retraining programme already running at 30%+",
          condition: { ref: "policy.retraining", op: ">=", value: 30 },
        }],
        cost: 6,
        forecast: "Labour: the pathways exist, they will hold. Treasury: cheaper than the alternative.",
        effects: [
          { target: "group.displaced_workers.happiness", amount: 14 },
          { target: "group.union_members.happiness", amount: 8 },
        ],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.unemployment", amount: -8 }, { target: "sim.social_cohesion", amount: 6 }],
          text: "The transition pathways worked. Most of the displaced cohort found comparable work inside two years.",
        }],
        sets: ["transition_worked"],
      },
      {
        label: "Emergency cash support",
        detail: "Direct payments to displaced households while a longer answer is found.",
        cost: 10,
        forecast: "Stops the bleeding. Does not close the wound, and the wound is still opening.",
        effects: [
          { target: "group.displaced_workers.happiness", amount: 9 },
          { target: "sim.cost_of_living", amount: -4 },
        ],
        deferred: [{
          turns: 4,
          effects: [{ target: "sim.inequality", amount: 5 }, { target: "group.displaced_workers.happiness", amount: -6 }],
          text: "The payments continue, and so does the displacement. Nobody has been retrained; the bill compounds.",
        }],
      },
      {
        label: "Let the market clear",
        detail: "Resist intervention. New sectors will absorb the workers eventually.",
        forecast: "Business: correct in the long run. Labour: we live in the short run.",
        effects: [
          { target: "sim.business_confidence", amount: 5 },
          { target: "group.displaced_workers.happiness", amount: -15 },
          { target: "group.displaced_workers.extremism", amount: 18 },
          { target: "group.union_members.happiness", amount: -9 },
        ],
        deferred: [{
          turns: 3,
          condition: { ref: "sim.gdp_growth", op: ">", value: 58 },
          effects: [{ target: "sim.unemployment", amount: -5 }, { target: "sim.business_confidence", amount: 4 }],
          text: "Growth was strong enough to absorb them. The gamble paid — this time, and visibly at someone's expense.",
          elseEffects: [
            { target: "sim.social_cohesion", amount: -10 },
            { target: "group.displaced_workers.extremism", amount: 15 },
          ],
          elseText: "Growth never came. A displaced generation has concluded the system is not for them.",
        }],
        sets: ["market_cleared"],
      },
    ],
  },

  {
    id: "protest_wave",
    title: "The Protest Wave",
    subtitle: "Displacement survivors have organised. The demonstrations are large, disciplined, and growing.",
    category: "LABOUR",
    weight: 4,
    cooldown: 6,
    trigger: {
      any: [
        { ref: "group.displaced_workers.extremism", op: ">", value: 30 },
        { ref: "group.union_members.extremism", op: ">", value: 30 },
        { ref: "group.rural.extremism", op: ">", value: 30 },
        { ref: "group.students.extremism", op: ">", value: 35 },
      ],
    },
    options: [
      {
        label: "Negotiate with movement leaders",
        detail: "Bring organisers to the table and concede formal consultation rights over deployment.",
        cost: 14,
        forecast: "Business will hate it. It is also the only thing that has ever de-escalated this.",
        effects: [
          { target: "group.displaced_workers.extremism", amount: -25 },
          { target: "group.union_members.happiness", amount: 10 },
          { target: "sim.business_confidence", amount: -6 },
          { target: "sim.social_cohesion", amount: 6 },
        ],
      },
      {
        label: "Hold the line",
        detail: "Refuse to negotiate under pressure. Wait for the movement to lose momentum.",
        forecast: "Sometimes they disperse. Sometimes they find a leader.",
        deferred: [{
          turns: 2,
          condition: { ref: "sim.unemployment", op: "<", value: 40 },
          effects: [{ target: "group.displaced_workers.extremism", amount: -12 }],
          text: "The labour market improved and the movement thinned out. Holding firm looks like judgement in hindsight.",
          elseEffects: [
            { target: "group.displaced_workers.extremism", amount: 20 },
            { target: "sim.social_cohesion", amount: -9 },
            { target: "sim.media_sentiment", amount: -10 },
          ],
          elseText: "The movement did not disperse. It organised, and a general strike has closed three cities.",
        }],
      },
    ],
  },

  // ═══ SAFETY ════════════════════════════════════════════════════════════════
  {
    id: "pathogen_blueprint",
    title: "Pathogen Blueprint",
    subtitle: "A frontier model has produced a viable synthesis route for a restricted biological agent.",
    category: "SAFETY",
    weight: 5,
    once: true,
    trigger: {
      all: [
        { ref: "world.capability", op: ">", value: 52 },
        { ref: "sim.eval_coverage", op: "<", value: 62 },
      ],
    },
    options: [
      {
        label: "Activate containment protocols",
        detail: "Trigger the pre-built response: screening mandates, model recall, allied notification within hours.",
        requires: [{
          reason: "Requires an established Frontier Safety Regime (60%+) — the protocols must exist before the incident",
          condition: { ref: "policy.frontier_safety_regime", op: ">=", value: 60 },
        }],
        cost: 8,
        forecast: "Chief Scientist: this is what we built it for. Expect disruption, not catastrophe.",
        effects: [
          { target: "sim.incident_rate", amount: -10 },
          { target: "sim.public_trust", amount: 9 },
          { target: "group.safety_advocates.happiness", amount: 15 },
          { target: "sim.gdp_growth", amount: -4 },
        ],
        deferred: [{
          turns: 2,
          effects: [{ target: "sim.alignment_confidence", amount: 6 }, { target: "sim.eval_coverage", amount: 5 }],
          text: "The containment playbook held under real conditions. It is now the international reference implementation.",
        }],
        sets: ["bio_contained"],
      },
      {
        label: "Improvised response",
        detail: "Assemble a task force, contact the labs directly, and hope the screening bureaus can keep up.",
        cost: 4,
        forecast: "Chief Scientist: we are making this up as we go. I cannot give you a confidence interval.",
        effects: [
          { target: "sim.incident_rate", amount: 8 },
          { target: "sim.public_trust", amount: -9 },
          { target: "sim.media_sentiment", amount: -14 },
          { target: "group.parents.happiness", amount: -10 },
        ],
        deferred: [{
          turns: 3,
          condition: { ref: "sim.institutional_capacity", op: ">", value: 55 },
          effects: [{ target: "sim.eval_coverage", amount: 8 }, { target: "sim.public_trust", amount: 4 }],
          text: "The near-miss forced the evaluation regime you had been deferring. Expensive way to learn it.",
          elseEffects: [{ target: "sim.incident_rate", amount: 10 }, { target: "sim.public_trust", amount: -8 }],
          elseText: "Nothing was learned institutionally. The next incident will find the same gaps.",
        }],
        sets: ["bio_improvised"],
      },
      {
        label: "Suppress and classify",
        detail: "Contain the information rather than the capability. Deny it happened.",
        cost: 6,
        forecast: "Security: buys time. Communications: leaks are a matter of when.",
        effects: [
          { target: "sim.media_sentiment", amount: 5 },
          { target: "sim.eval_coverage", amount: -5 },
        ],
        deferred: [{
          turns: 4,
          effects: [
            { target: "sim.public_trust", amount: -18 },
            { target: "sim.media_sentiment", amount: -16 },
            { target: "sim.alliance_strength", amount: -10 },
          ],
          text: "The suppressed incident surfaced. The cover-up is now a larger story than the pathogen ever was.",
        }],
        sets: ["bio_suppressed"],
      },
    ],
  },

  {
    id: "leak_aftermath",
    title: "The Leak",
    subtitle: "Suppressed incident data has surfaced. Allies learned of it from the press.",
    category: "SAFETY",
    weight: 6,
    once: true,
    trigger: { flags: ["bio_suppressed"], minTurn: 2 },
    options: [
      {
        label: "Full disclosure and reform",
        detail: "Release everything, accept the hearings, and legislate mandatory incident reporting.",
        cost: 16,
        forecast: "Brutal for two years. The only version of this that ends.",
        effects: [
          { target: "sim.public_trust", amount: -4 },
          { target: "sim.media_sentiment", amount: -8 },
          { target: "sim.institutional_capacity", amount: 7 },
        ],
        deferred: [{
          turns: 3,
          effects: [
            { target: "sim.public_trust", amount: 14 },
            { target: "sim.alliance_strength", amount: 8 },
            { target: "sim.eval_coverage", amount: 6 },
          ],
          text: "The disclosure regime rebuilt what the cover-up cost. Painful, credible, and it holds.",
        }],
      },
      {
        label: "Deny and contain",
        detail: "Dispute the documents, discipline the leaker, refuse the inquiry.",
        forecast: "Communications: I would not advise this in writing.",
        effects: [
          { target: "sim.public_trust", amount: -14 },
          { target: "sim.alliance_strength", amount: -12 },
          { target: "sim.regulatory_capture", amount: 8 },
        ],
      },
    ],
  },

  {
    id: "lab_relocation_threat",
    title: "The Ultimatum",
    subtitle: "The largest domestic lab has told you privately it will move its frontier programme offshore.",
    category: "GOVERNANCE",
    weight: 3,
    cooldown: 6,
    trigger: {
      all: [
        { ref: "policy.frontier_safety_regime", op: ">", value: 45 },
        { ref: "sim.business_confidence", op: "<", value: 50 },
      ],
    },
    options: [
      {
        label: "Hold the regime",
        detail: "The standards are the standards. If they leave, they leave.",
        forecast: "Safety: correct. Treasury: they take the tax base and you keep the risk.",
        effects: [
          { target: "group.safety_advocates.happiness", amount: 12 },
          { target: "group.accelerationists.happiness", amount: -10 },
        ],
        deferred: [{
          turns: 3,
          condition: { ref: "sim.alliance_strength", op: ">", value: 58 },
          effects: [{ target: "sim.eval_coverage", amount: 7 }, { target: "sim.alliance_strength", amount: 5 }],
          text: "Allies matched your standards rather than undercut them. There was nowhere cheap left to go.",
          elseEffects: [
            { target: "sim.compute_supply", amount: -10 },
            { target: "sim.gdp_growth", amount: -6 },
            { target: "sim.eval_coverage", amount: -8 },
          ],
          elseText: "They left. You now regulate an industry that does its frontier work somewhere you cannot see.",
        }],
      },
      {
        label: "Negotiate a carve-out",
        detail: "Exempt existing model families in exchange for a binding domestic compute commitment.",
        cost: 10,
        forecast: "Keeps them, and keeps oversight. Sets a precedent about who writes the rules.",
        effects: [
          { target: "sim.business_confidence", amount: 7 },
          { target: "sim.regulatory_capture", amount: 9 },
          { target: "group.safety_advocates.happiness", amount: -11 },
        ],
      },
      {
        label: "Match them with an international floor",
        detail: "Convert the standard into a treaty obligation so there is no jurisdiction to flee to.",
        requires: [{
          reason: "Requires an International AI Accord in force (35%+)",
          condition: { ref: "policy.international_accord", op: ">=", value: 35 },
        }],
        cost: 18,
        forecast: "Foreign Office: slow, and it removes the threat permanently.",
        effects: [
          { target: "sim.alliance_strength", amount: 8 },
          { target: "sim.eval_coverage", amount: 6 },
          { target: "group.safety_advocates.happiness", amount: 10 },
        ],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.eval_coverage", amount: 8 }, { target: "sim.alignment_confidence", amount: 5 }],
          text: "The floor held across the bloc. Regulatory arbitrage on frontier safety is no longer available to anyone.",
        }],
      },
    ],
  },

  // ═══ ECONOMY ═══════════════════════════════════════════════════════════════
  {
    id: "wealth_divide",
    title: "The Wealth Divide",
    subtitle: "AI added four trillion to output. Eighty-two percent of it was captured by fifty firms.",
    category: "ECONOMY",
    weight: 3,
    cooldown: 5,
    trigger: {
      all: [
        { ref: "sim.inequality", op: ">", value: 51 },
        { ref: "sim.gdp_growth", op: ">", value: 46 },
      ],
    },
    options: [
      {
        label: "Pay the dividend",
        detail: "Distribute the sovereign fund's returns directly to every citizen this year.",
        requires: [{
          reason: "Requires a Public Wealth Fund with capital to distribute (50%+)",
          condition: { ref: "policy.sovereign_wealth_fund", op: ">=", value: 50 },
        }],
        cost: 6,
        forecast: "Modest per household. Enormous symbolically — people become shareholders in the transition.",
        effects: [
          { target: "sim.inequality", amount: -7 },
          { target: "sim.public_trust", amount: 10 },
          { target: "group.retirees.happiness", amount: 8 },
          { target: "group.displaced_workers.happiness", amount: 9 },
        ],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.social_cohesion", amount: 8 }, { target: "sim.public_trust", amount: 5 }],
          text: "The dividend has become an institution nobody will now dismantle. Consent for the transition is bought and paid for.",
        }],
      },
      {
        label: "Emergency windfall levy",
        detail: "A one-off charge on excess AI-derived profits, hypothecated to transition spending.",
        cost: 12,
        forecast: "Treasury: raises real money. Business: capital has a long memory.",
        effects: [
          { target: "sim.inequality", amount: -5 },
          { target: "sim.business_confidence", amount: -11 },
          { target: "group.capitalists.happiness", amount: -14 },
          { target: "group.union_members.happiness", amount: 7 },
        ],
      },
      {
        label: "Accept the distribution",
        detail: "Concentration is the price of frontier investment. Do not tamper with the engine.",
        forecast: "Business: the right call. Everyone under median income: noted.",
        effects: [
          { target: "sim.business_confidence", amount: 6 },
          { target: "sim.inequality", amount: 4 },
          { target: "group.capitalists.happiness", amount: 9 },
          { target: "group.students.happiness", amount: -8 },
        ],
        deferred: [{
          turns: 4,
          effects: [{ target: "sim.social_cohesion", amount: -8 }, { target: "sim.public_trust", amount: -6 }],
          text: "Four years of compounding concentration. The politics of this are no longer about economics.",
        }],
      },
    ],
  },

  {
    id: "fiscal_reckoning",
    title: "The Bond Market Calls",
    subtitle: "Your debt is being repriced. The finance ministry wants a credible consolidation plan by Friday.",
    category: "ECONOMY",
    weight: 4,
    cooldown: 4,
    trigger: { all: [{ ref: "budget.debtRatio", op: ">", value: 52 }] },
    options: [
      {
        label: "Consolidate now",
        detail: "Announce spending restraint and a path back to primary balance.",
        cost: 10,
        forecast: "Markets settle. The programmes you cut will be the ones you need in three years.",
        effects: [
          { target: "sim.business_confidence", amount: 9 },
          { target: "group.displaced_workers.happiness", amount: -8 },
          { target: "group.retirees.happiness", amount: -6 },
        ],
      },
      {
        label: "Grow through it",
        detail: "Hold the line on spending and argue the AI productivity dividend will close the gap.",
        forecast: "Treasury: this works if — and only if — diffusion actually lands.",
        deferred: [{
          turns: 3,
          condition: { ref: "sim.productivity", op: ">", value: 60 },
          effects: [{ target: "sim.gdp_growth", amount: 8 }, { target: "sim.business_confidence", amount: 7 }],
          text: "The productivity dividend arrived and the ratio fell without a single cut. The bet was correct.",
          elseEffects: [
            { target: "sim.business_confidence", amount: -13 },
            { target: "sim.cost_of_living", amount: 7 },
          ],
          elseText: "The dividend never materialised. Borrowing costs are now the largest line item you do not control.",
        }],
      },
    ],
  },

  // ═══ SOCIETY & GOVERNANCE ══════════════════════════════════════════════════
  {
    id: "deepfake_election",
    title: "Synthetic Campaign",
    subtitle: "Fabricated footage of three candidates is circulating faster than any verification system can flag it.",
    category: "GOVERNANCE",
    weight: 4,
    cooldown: 5,
    trigger: {
      all: [
        { ref: "sim.diffusion", op: ">", value: 42 },
        { ref: "sim.public_understanding", op: "<", value: 48 },
      ],
    },
    options: [
      {
        label: "Deploy provenance infrastructure",
        detail: "Mandatory content authentication across major platforms, with an audit trail.",
        requires: [{
          reason: "Requires institutional capacity above 55 to enforce a standard this technical",
          condition: { ref: "sim.institutional_capacity", op: ">", value: 55 },
        }],
        cost: 10,
        forecast: "Catches most of it. Does not catch all of it. Nothing will.",
        effects: [
          { target: "sim.public_trust", amount: 8 },
          { target: "sim.media_sentiment", amount: 6 },
          { target: "sim.institutional_capacity", amount: 4 },
        ],
      },
      {
        label: "Emergency takedown powers",
        detail: "Compel platforms to remove unverified political content for the duration of the campaign.",
        cost: 12,
        forecast: "Fast. Blunt. Legitimate speech will be caught, and the cases will be famous.",
        effects: [
          { target: "sim.incident_rate", amount: -5 },
          { target: "sim.public_trust", amount: -7 },
          { target: "group.students.happiness", amount: -9 },
        ],
      },
      {
        label: "Public literacy campaign",
        detail: "No new powers. Fund verification tools and teach people to use them.",
        cost: 4,
        forecast: "Too slow for this election. Possibly correct for the next one.",
        effects: [{ target: "sim.public_understanding", amount: 6 }],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.public_understanding", amount: 8 }, { target: "sim.public_trust", amount: 5 }],
          text: "The literacy programme compounded. Synthetic media is now something the public routinely detects itself.",
        }],
      },
    ],
  },

  {
    id: "capture_scandal",
    title: "Who Wrote This",
    subtitle: "Leaked drafts show your AI regulations were substantially authored by the firms they govern.",
    category: "GOVERNANCE",
    weight: 4,
    cooldown: 6,
    trigger: { all: [{ ref: "sim.regulatory_capture", op: ">", value: 46 }] },
    options: [
      {
        label: "Independent regulator",
        detail: "Fire the officials involved and rebuild oversight at arm's length from government.",
        cost: 16,
        forecast: "Costly in capital and personnel. It is also the only answer that survives contact with a hearing.",
        effects: [
          { target: "sim.regulatory_capture", amount: -18 },
          { target: "sim.public_trust", amount: 7 },
          { target: "sim.institutional_capacity", amount: 6 },
          { target: "sim.business_confidence", amount: -6 },
        ],
      },
      {
        label: "Disclosure requirements only",
        detail: "Publish lobbying contacts. Keep the personnel and the framework.",
        cost: 4,
        forecast: "Communications: this will be described as the minimum. Accurately.",
        effects: [
          { target: "sim.public_trust", amount: -6 },
          { target: "sim.regulatory_capture", amount: -4 },
        ],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.regulatory_capture", amount: 10 }, { target: "sim.public_trust", amount: -5 }],
          text: "The disclosure regime was gamed within a year. The same firms, the same drafts, now filed in triplicate.",
        }],
      },
    ],
  },

  {
    id: "brain_drain",
    title: "The Departures",
    subtitle: "Senior AI researchers are leaving for jurisdictions with cheaper compute and lighter rules.",
    category: "ECONOMY",
    weight: 3,
    cooldown: 5,
    trigger: {
      all: [
        { ref: "group.ai_engineers.happiness", op: "<", value: 46 },
        { ref: "sim.compute_supply", op: "<", value: 52 },
      ],
    },
    options: [
      {
        label: "Public compute for researchers",
        detail: "Guarantee academic and public-interest access to frontier-scale compute.",
        cost: 10,
        forecast: "Retains the people who do the work you cannot buy. Expensive per head.",
        effects: [
          { target: "group.ai_engineers.happiness", amount: 13 },
          { target: "sim.compute_supply", amount: 4 },
        ],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.alignment_confidence", amount: 6 }, { target: "sim.productivity", amount: 5 }],
          text: "The public compute allocation became the backbone of domestic safety research. The departures stopped.",
        }],
      },
      {
        label: "Let them go",
        detail: "Talent is mobile and the work is global. Focus on deployment rather than frontier research.",
        forecast: "Defensible. It also means the frontier happens somewhere you have no visibility into.",
        effects: [
          { target: "group.ai_engineers.happiness", amount: -8 },
          { target: "sim.alignment_confidence", amount: -6 },
        ],
      },
    ],
  },

  {
    id: "alignment_gap",
    title: "The Gap",
    subtitle: "Capability has outrun interpretability by the widest margin your advisors have measured.",
    category: "SAFETY",
    weight: 5,
    cooldown: 4,
    trigger: {
      all: [
        { ref: "world.capability", op: ">", value: 55 },
        { ref: "sim.alignment_confidence", op: "<", value: 44 },
      ],
    },
    options: [
      {
        label: "Emergency interpretability programme",
        detail: "Crash funding, national lab access, and mandatory lab participation.",
        cost: 14,
        forecast: "Chief Scientist: this takes years we may not have. Start anyway.",
        effects: [
          { target: "sim.alignment_confidence", amount: 6 },
          { target: "group.safety_advocates.happiness", amount: 13 },
          { target: "sim.gdp_growth", amount: -3 },
        ],
        deferred: [{
          turns: 4,
          effects: [{ target: "sim.alignment_confidence", amount: 14 }, { target: "sim.eval_coverage", amount: 6 }],
          text: "The crash programme delivered. Understanding is no longer the binding constraint on deployment.",
        }],
      },
      {
        label: "Slow deployment instead",
        detail: "Cap the capability level permitted in public deployment until understanding catches up.",
        cost: 18,
        forecast: "Buys real time. Costs real growth, and rivals will not reciprocate.",
        effects: [
          { target: "sim.diffusion", amount: -10 },
          { target: "sim.incident_rate", amount: -8 },
          { target: "sim.gdp_growth", amount: -7 },
          { target: "group.accelerationists.happiness", amount: -16 },
        ],
      },
      {
        label: "Accept the gap",
        detail: "The race is the reality. Falling behind is its own catastrophic risk.",
        forecast: "Defensible strategically. The Chief Scientist has asked that her objection be minuted.",
        effects: [
          { target: "sim.compute_supply", amount: 5 },
          { target: "group.accelerationists.happiness", amount: 12 },
          { target: "group.safety_advocates.happiness", amount: -16 },
        ],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.incident_rate", amount: 12 }, { target: "sim.public_trust", amount: -8 }],
          text: "The gap did what gaps do. The incident review will note that it was foreseen and minuted.",
        }],
      },
    ],
  },

  {
    id: "allied_accord",
    title: "The Invitation",
    subtitle: "Allied governments are convening on shared evaluation standards. They have asked you to co-chair.",
    category: "GEOPOLITICS",
    weight: 2,
    cooldown: 6,
    trigger: { all: [{ ref: "sim.alliance_strength", op: ">", value: 62 }], minTurn: 3 },
    options: [
      {
        label: "Co-chair and shape it",
        detail: "Commit institutional resource and write the standard rather than adopt it.",
        requires: [{
          reason: "Requires institutional capacity above 50 — you cannot co-chair what you cannot staff",
          condition: { ref: "sim.institutional_capacity", op: ">", value: 50 },
        }],
        cost: 12,
        forecast: "Foreign Office: the rules get written either way. Better with your name on them.",
        effects: [
          { target: "sim.alliance_strength", amount: 11 },
          { target: "sim.eval_coverage", amount: 5 },
        ],
        deferred: [{
          turns: 3,
          effects: [
            { target: "sim.chip_access", amount: 7 },
            { target: "sim.alignment_confidence", amount: 5 },
            { target: "sim.eval_coverage", amount: 6 },
          ],
          text: "Your standard became the bloc's standard. Compliance is now an export advantage rather than a cost.",
        }],
        sets: ["accord_chair"],
      },
      {
        label: "Join without leading",
        detail: "Sign up, contribute modestly, avoid the obligations of the chair.",
        cost: 4,
        forecast: "Cheap. You will be implementing someone else's framework for a decade.",
        effects: [{ target: "sim.alliance_strength", amount: 4 }],
      },
      {
        label: "Decline",
        detail: "Preserve sovereign flexibility. Coordinate bilaterally where it suits you.",
        forecast: "Maximum freedom of action, minimum leverage over anyone else's.",
        effects: [
          { target: "sim.alliance_strength", amount: -9 },
          { target: "sim.chip_access", amount: -5 },
        ],
      },
    ],
  },

  {
    id: "incident_aftermath",
    title: "The Hearings",
    subtitle: "A serious AI incident has triggered a public inquiry. You are testifying next week.",
    category: "SAFETY",
    weight: 4,
    cooldown: 4,
    trigger: { all: [{ ref: "sim.incident_rate", op: ">", value: 46 }] },
    options: [
      {
        label: "Own it and legislate",
        detail: "Accept responsibility publicly and bring forward the statutory regime you had been deferring.",
        cost: 12,
        forecast: "Short-term damage, long-term credibility. The window closes fast.",
        effects: [
          { target: "sim.public_trust", amount: 6 },
          { target: "sim.eval_coverage", amount: 8 },
          { target: "sim.business_confidence", amount: -7 },
        ],
        deferred: [{
          turns: 3,
          effects: [{ target: "sim.incident_rate", amount: -12 }, { target: "sim.institutional_capacity", amount: 6 }],
          text: "The post-incident regime materially reduced the incident rate. It would not have passed in calmer weather.",
        }],
      },
      {
        label: "Defend the record",
        detail: "Argue the framework worked and the incident was an outlier.",
        forecast: "Survivable if the incident rate falls. Fatal if it does not.",
        deferred: [{
          turns: 2,
          condition: { ref: "sim.incident_rate", op: "<", value: 40 },
          effects: [{ target: "sim.public_trust", amount: 6 }, { target: "sim.media_sentiment", amount: 7 }],
          text: "The incident rate fell and the defence aged well. You were right, and lucky.",
          elseEffects: [
            { target: "sim.public_trust", amount: -14 },
            { target: "sim.media_sentiment", amount: -13 },
          ],
          elseText: "Two more incidents followed. The testimony is now the clip that runs before every story about you.",
        }],
      },
    ],
  },
];

export const DILEMMA_MAP: ReadonlyMap<string, DilemmaDef> = new Map(
  DILEMMAS.map((d) => [d.id, d]),
);
