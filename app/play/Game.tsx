"use client";

/**
 * The governing screen.
 *
 * Design intent: everything the player needs to make one decision is on one
 * screen, and every number is interrogable. Policies on the left with their
 * political-capital and fiscal price, the country in the middle, the blocs on
 * the right, dilemmas below. Clicking any node answers "why did that move"
 * from the engine's own causal trace.
 *
 * All simulation state lives in `GameState` and moves only through `tick`, so
 * this component is a renderer plus an action buffer — no game logic here.
 */

import { useMemo, useRef, useState } from "react";
import { DILEMMA_MAP } from "@/lib/data/dilemmas.ts";
import { GROUPS } from "@/lib/data/groups.ts";
import { POLICIES } from "@/lib/data/policies.ts";
import { SCENARIOS } from "@/lib/data/scenarios.ts";
import { SIM_NODES } from "@/lib/data/simulation.ts";
import { optionAvailability } from "@/lib/sim/dilemmas.ts";
import { approvalRating } from "@/lib/sim/election.ts";
import { makeRng, type Rng } from "@/lib/sim/rng.ts";
import { BRIEFING, CAMPAIGN, actionCost, createGame, tick } from "@/lib/sim/tick.ts";
import type { Action, GameState, LogEntry, SimCategory } from "@/lib/sim/types.ts";
import { S, T } from "./theme.ts";
import { BlocRow, Btn, CausePanel, DilemmaCard, NodeRow, PolicyRow, Section, Stat, prettyRef } from "./panels.tsx";

const CATEGORY_TITLES: Record<SimCategory, string> = {
  economy: "Economy",
  compute: "Compute & Energy",
  ai: "AI Systems",
  society: "Society",
  state: "State Capacity",
  foreign: "Foreign",
};

const POLICY_GROUPS: { title: string; ids: string[] }[] = [
  { title: "Revenue", ids: ["income_tax", "corporate_tax", "capital_gains_tax", "automation_levy", "compute_levy"] },
  { title: "Compute & Energy", ids: ["datacentre_buildout", "grid_investment", "chip_industrial_policy"] },
  { title: "Public", ids: ["public_ai_access", "ai_literacy"] },
  { title: "Labour & Welfare", ids: ["retraining", "portable_benefits", "sovereign_wealth_fund", "worker_codetermination"] },
  { title: "Safety & Governance", ids: ["frontier_safety_regime", "audit_bureau", "interpretability_research", "open_weight_restrictions"] },
  { title: "Foreign", ids: ["international_accord", "export_controls"] },
];

export default function Game() {
  const [state, setState] = useState<GameState | null>(null);
  const [draft, setDraft] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [selected, setSelected] = useState<string>("sim.gdp_growth");
  const [resolution, setResolution] = useState<{ logs: LogEntry[]; turn: number } | null>(null);
  const rng = useRef<Rng | null>(null);
  const previous = useRef<Record<string, number>>({});

  // ── Setup ──
  const start = (scenarioId: string, mode: "campaign" | "briefing") => {
    const seed = Math.floor(Math.random() * 1e9);
    const s = createGame(scenarioId, seed, mode === "campaign" ? CAMPAIGN : BRIEFING);
    rng.current = makeRng(seed);
    previous.current = { ...s.sim };
    setState(s);
    setDraft(Object.fromEntries(POLICIES.map((p) => [p.id, s.policies[p.id].intensity])));
    setAnswers({});
    setResolution(null);
  };

  // ── Pending actions and their price ──
  const { actions, capitalSpent } = useMemo(() => {
    if (!state) return { actions: [] as Action[], capitalSpent: 0 };
    const out: Action[] = [];
    let spent = 0;
    for (const p of POLICIES) {
      const target = draft[p.id] ?? state.policies[p.id].intensity;
      if (target === state.policies[p.id].intensity) continue;
      const action: Action = { kind: "setPolicy", id: p.id, intensity: target };
      spent += actionCost(state, action);
      out.push(action);
    }
    for (const [dilemmaId, optionIndex] of Object.entries(answers)) {
      const def = DILEMMA_MAP.get(dilemmaId);
      spent += def?.options[optionIndex]?.cost ?? 0;
      out.push({ kind: "resolveDilemma", dilemmaId, optionIndex });
    }
    return { actions: out, capitalSpent: spent };
  }, [state, draft, answers]);

  const advance = () => {
    if (!state || !rng.current) return;
    previous.current = { ...state.sim };
    const next = tick(state, actions, rng.current);
    const logs = next.log.slice(state.log.length);
    setState(next);
    setDraft(Object.fromEntries(POLICIES.map((p) => [p.id, next.policies[p.id].intensity])));
    setAnswers({});
    setResolution({ logs, turn: next.turn });
  };

  // ── Screens ──
  if (!state) return <Setup onStart={start} />;
  if (state.politics.outcome && !resolution) return <Ending state={state} onRestart={() => setState(null)} />;

  const scenario = SCENARIOS.find((s) => s.id === state.scenarioId)!;
  const approval = approvalRating(state);
  const capitalLeft = state.politics.politicalCapital - capitalSpent;
  const overdrawn = capitalLeft < 0;
  const traceFor = (target: string) => state.trace.find((t) => t.target === target);
  // Briefing parks the Threshold at a 999 sentinel to switch that ending off.
  const thresholdInPlay = state.config.thresholdCapability <= 100;
  const clockMax = thresholdInPlay ? state.config.thresholdCapability : 100;

  return (
    <div style={S.page}>

      {resolution && (
        <Resolution
          logs={resolution.logs}
          year={state.year}
          finished={!!state.politics.outcome}
          onClose={() => setResolution(null)}
        />
      )}

      <div style={{ width: "94%", maxWidth: 1500, margin: "0 auto", padding: "18px 0 60px" }}>
        {/* ── Status bar ── */}
        <div style={{ ...S.card, padding: "12px 18px", marginBottom: 14, display: "flex",
                      justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
          <div>
            <div style={{ ...S.label, color: T.ac }}>
              {scenario.flag} {scenario.name} · Term {state.politics.term}
            </div>
            <div style={{ ...S.serif, fontSize: 27 }}>{state.year}</div>
          </div>
          <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
            <Stat label="Approval" value={approval.toFixed(0)} tone={approval >= 50 ? T.gd : T.bad} />
            <Stat label="Capital" value={`${capitalLeft.toFixed(0)}`} tone={overdrawn ? T.bad : T.ac} />
            <Stat label="Debt/GDP" value={`${(state.budget.debtRatio * 100).toFixed(0)}%`}
                  tone={state.budget.debtRatio > 1.5 ? T.bad : T.tx} />
            <Stat label="Balance" value={`${state.budget.balance >= 0 ? "+" : ""}${state.budget.balance.toFixed(0)}`}
                  tone={state.budget.balance >= 0 ? T.gd : T.wn} />
            <Stat label="Capability" value={state.world.capability.toFixed(0)} tone={T.bad} />
            <Stat label="Election in" value={`${state.politics.turnsToElection}y`} />
          </div>
        </div>

        {/* ── Capability clock ──
            Briefing disables the Threshold ending by setting its capability to a
            999 sentinel. That is an engine detail: rendered literally it told the
            player the Threshold sat at 999 and pinned the bar near zero all run.
            When it is out of play, the clock is unlabelled and scaled to 100. */}
        <div style={{ ...S.card, padding: "9px 18px", marginBottom: 14 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
            <span style={S.label}>
              {thresholdInPlay
                ? `Frontier capability — the Threshold at ${state.config.thresholdCapability}`
                : "Frontier capability"}
            </span>
            <span style={{ ...S.mono, fontSize: 11, color: T.tm }}>
              rival {state.world.rivalCapability.toFixed(0)}
            </span>
          </div>
          <div style={{ height: 7, background: T.sa, borderRadius: 4, overflow: "hidden", position: "relative" }}>
            <div style={{
              height: "100%", width: `${Math.min(100, (state.world.capability / clockMax) * 100)}%`,
              background: "linear-gradient(90deg,#2563EB,#7C3AED,#DC2626)", transition: "width .8s ease",
            }} />
          </div>
        </div>

        {/* ── Three columns ── */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(260px,1fr) minmax(300px,1.15fr) minmax(240px,0.85fr)", gap: 14, alignItems: "start" }}>
          {/* Policies */}
          <Section title="Policy" right={
            <span style={{ ...S.mono, fontSize: 10, color: overdrawn ? T.bad : T.tm }}>
              {capitalSpent > 0 ? `${capitalSpent}pc queued` : "no changes"}
            </span>
          }>
            <div style={{ maxHeight: "58vh", overflowY: "auto", paddingRight: 4 }}>
              {POLICY_GROUPS.map((g) => (
                <div key={g.title} style={{ marginBottom: 12 }}>
                  <div style={{ ...S.label, fontSize: 9.5, color: T.tf, marginBottom: 5 }}>{g.title}</div>
                  {g.ids.map((id) => {
                    const def = POLICIES.find((p) => p.id === id)!;
                    const target = draft[id] ?? state.policies[id].intensity;
                    const cost = target === state.policies[id].intensity
                      ? 0
                      : actionCost(state, { kind: "setPolicy", id, intensity: target });
                    return (
                      <PolicyRow
                        key={id}
                        def={def}
                        active={state.policies[id].active}
                        draft={target}
                        capitalCost={cost}
                        affordable={!overdrawn}
                        gdp={state.budget.gdp}
                        onChange={(v) => setDraft((d) => ({ ...d, [id]: v }))}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </Section>

          {/* The country */}
          <Section title="The country" right={
            <span style={{ ...S.mono, fontSize: 10, color: T.tf }}>click any line for why</span>
          }>
            <div style={{ maxHeight: "58vh", overflowY: "auto", paddingRight: 4 }}>
              {(Object.keys(CATEGORY_TITLES) as SimCategory[]).map((cat) => (
                <div key={cat} style={{ marginBottom: 10 }}>
                  <div style={{ ...S.label, fontSize: 9.5, color: T.tf, marginBottom: 3 }}>
                    {CATEGORY_TITLES[cat]}
                  </div>
                  {SIM_NODES.filter((n) => n.category === cat).map((n) => (
                    <NodeRow
                      key={n.id}
                      def={n}
                      value={state.sim[n.id]}
                      previous={previous.current[n.id]}
                      selected={selected === `sim.${n.id}`}
                      onSelect={() => setSelected(`sim.${n.id}`)}
                    />
                  ))}
                </div>
              ))}
            </div>
          </Section>

          {/* Blocs + causal panel */}
          <div style={{ display: "grid", gap: 14 }}>
            <Section title="Blocs" right={
              <span style={{ ...S.mono, fontSize: 10, color: T.tf }}>share · mood</span>
            }>
              <div style={{ maxHeight: "44vh", overflowY: "auto", paddingRight: 4 }}>
                {GROUPS.map((g) => (
                  <BlocRow
                    key={g.id}
                    def={g}
                    membership={state.groups[g.id].membership}
                    happiness={state.groups[g.id].happiness}
                    extremism={state.groups[g.id].extremism}
                    championed={state.politics.opposition.championing.includes(g.id)}
                  />
                ))}
              </div>
              <div style={{ ...S.mono, fontSize: 10, color: T.tm, borderTop: `1px solid ${T.bd}`, paddingTop: 7, marginTop: 4 }}>
                Opposition: {state.politics.opposition.name} — {state.politics.opposition.leader}
              </div>
            </Section>

            <Section title="Why">
              <CausePanel target={selected} label={prettyRef(selected)} entry={traceFor(selected)} />
            </Section>
          </div>
        </div>

        {/* ── Dilemmas ── */}
        {state.pendingDilemmas.length > 0 && (
          <div style={{ marginTop: 18 }}>
            <div style={{ ...S.label, marginBottom: 8, color: T.ac }}>On your desk</div>
            {state.pendingDilemmas.map((p) => {
              const def = DILEMMA_MAP.get(p.id);
              if (!def) return null;
              return (
                <DilemmaCard
                  key={p.id}
                  def={def}
                  state={state}
                  chosen={answers[p.id]}
                  availability={def.options.map((o) => optionAvailability(state, o))}
                  onChoose={(i) => setAnswers((a) => ({ ...a, [p.id]: a[p.id] === i ? -1 : i }))}
                />
              );
            })}
          </div>
        )}

        {/* ── Advance ── */}
        <div style={{ textAlign: "center", marginTop: 22 }}>
          {overdrawn && (
            <div style={{ ...S.mono, fontSize: 12, color: T.bad, marginBottom: 8 }}>
              Over budget by {Math.abs(capitalLeft).toFixed(0)} political capital — the excess will simply not pass.
            </div>
          )}
          {state.pendingDilemmas.some((p) => answers[p.id] === undefined || answers[p.id] < 0) && (
            <div style={{ fontSize: 12.5, color: T.wn, marginBottom: 8 }}>
              An unanswered dilemma will lapse. Drifting is a choice, and it costs trust.
            </div>
          )}
          <Btn wide onClick={advance}>Advance to {state.year + 1} →</Btn>
        </div>
      </div>
    </div>
  );
}

// ── Setup ────────────────────────────────────────────────────────────────────

function Setup({ onStart }: { onStart: (id: string, mode: "campaign" | "briefing") => void }) {
  const [scenario, setScenario] = useState(SCENARIOS[0].id);
  const [mode, setMode] = useState<"campaign" | "briefing">("campaign");

  return (
    <div style={S.page}>
      <div style={{ width: "90%", maxWidth: 940, margin: "0 auto", padding: "60px 0", textAlign: "center" }}>
        <div className="fu" style={{ ...S.label, color: T.ac, letterSpacing: "0.3em" }}>Policy Simulation</div>
        <h1 className="fu" style={{ ...S.serif, fontSize: 50, margin: "10px 0 12px" }}>The Intelligence Age</h1>
        <p className="fu" style={{ fontSize: 16, color: T.t2, maxWidth: 640, margin: "0 auto 34px", lineHeight: 1.7 }}>
          Govern a country through the AI transition. Policies take years to bite, blocs
          change size as your decisions reshape the economy, and you have to keep winning
          elections while doing the parts nobody thanks you for.
        </p>

        <div className="fu" style={{ ...S.label, marginBottom: 10 }}>Choose a country</div>
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: 10, marginBottom: 28 }}>
          {SCENARIOS.map((s) => (
            <button
              key={s.id}
              onClick={() => setScenario(s.id)}
              style={{
                ...S.card, padding: 14, width: 210, cursor: "pointer", textAlign: "left",
                borderColor: scenario === s.id ? T.ac : T.bd,
                background: scenario === s.id ? `${T.ac}08` : T.sf,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              <span style={{ display: "block", fontSize: 26 }}>{s.flag}</span>
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700, marginTop: 2 }}>{s.name}</span>
              <span style={{ display: "block", fontSize: 12, color: T.t2, lineHeight: 1.45, marginTop: 4 }}>{s.description}</span>
            </button>
          ))}
        </div>

        <div className="fu" style={{ ...S.label, marginBottom: 10 }}>Length</div>
        <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 32 }}>
          {([
            ["campaign", "Full campaign", "12 years · up to three terms · the Threshold is in play"],
            ["briefing", "Briefing", "4 years · one term · a short read on your instincts"],
          ] as const).map(([id, title, blurb]) => (
            <button
              key={id}
              onClick={() => setMode(id)}
              style={{
                ...S.card, padding: 13, width: 260, cursor: "pointer", textAlign: "left",
                borderColor: mode === id ? T.ac : T.bd,
                background: mode === id ? `${T.ac}08` : T.sf,
                fontFamily: "'Outfit',sans-serif",
              }}
            >
              <span style={{ display: "block", fontSize: 14.5, fontWeight: 700 }}>{title}</span>
              <span style={{ display: "block", fontSize: 12, color: T.t2, marginTop: 3, lineHeight: 1.45 }}>{blurb}</span>
            </button>
          ))}
        </div>

        <Btn wide onClick={() => onStart(scenario, mode)}>Take office →</Btn>
      </div>
    </div>
  );
}

// ── Turn resolution overlay ──────────────────────────────────────────────────

const LOG_TONE: Record<string, string> = {
  incident: T.bad, unrest: T.bad, outcome: T.bad, consequence: T.ac,
  election: T.ac, dilemma: T.t2, policy: T.tm, world: T.wn, budget: T.wn,
};

function Resolution({ logs, year, finished, onClose }: {
  logs: LogEntry[]; year: number; finished: boolean; onClose: () => void;
}) {
  const ordered = [...logs].sort((a, b) => rank(a.kind) - rank(b.kind));
  return (
    <div className="fi" style={{
      position: "fixed", inset: 0, background: "rgba(26,26,26,0.45)", zIndex: 90,
      display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
    }}>
      <div className="fu" style={{ ...S.card, padding: 26, maxWidth: 660, width: "100%", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ ...S.label, color: T.ac }}>The year in review</div>
        <div style={{ ...S.serif, fontSize: 32, marginBottom: 16 }}>{year - 1}</div>

        {ordered.length === 0 && (
          <div style={{ fontSize: 14, color: T.tm }}>A quiet year. Nothing you will be remembered for.</div>
        )}
        {ordered.map((l, i) => (
          <div key={i} style={{
            borderLeft: `2px solid ${LOG_TONE[l.kind] ?? T.bd}`,
            paddingLeft: 11, marginBottom: 11,
          }}>
            <div style={{ ...S.label, fontSize: 9, color: LOG_TONE[l.kind] ?? T.tm }}>{l.kind}</div>
            <div style={{ fontSize: 14, color: T.tx, lineHeight: 1.55 }}>{l.text}</div>
          </div>
        ))}

        <div style={{ textAlign: "right", marginTop: 18 }}>
          <Btn onClick={onClose}>{finished ? "See how it ended" : "Continue"}</Btn>
        </div>
      </div>
    </div>
  );
}

const RANK: Record<string, number> = {
  outcome: 0, election: 1, incident: 2, consequence: 3, unrest: 4, world: 5, budget: 6, dilemma: 7, policy: 8,
};
const rank = (k: string): number => RANK[k] ?? 9;

/**
 * "One term" / "Two terms" — the ending copy used to hardcode "Three terms",
 * which a four-year briefing also displayed. Counts terms *served* from the
 * turn the run ended on: `politics.term` is incremented by the final election
 * win that immediately precedes `termLimit`, so it reads one term too many.
 */
function termWord(term: number): string {
  const names = ["No term", "One term", "Two terms", "Three terms", "Four terms"];
  return names[term] ?? `${term} terms`;
}

// ── Ending ───────────────────────────────────────────────────────────────────

function Ending({ state, onRestart }: { state: GameState; onRestart: () => void }) {
  const o = state.politics.outcome!;
  const headline: Record<string, string> = {
    defeated: "Voted out",
    deposed: "The country stopped accepting you",
    threshold: "The Threshold",
    termLimit: "Time served",
  };
  const detail: Record<string, string> = {
    defeated: `You lost the election with ${"voteShare" in o ? o.voteShare.toFixed(1) : "?"}% of the vote. Whatever you were building, someone else finishes it.`,
    deposed: "cause" in o ? o.cause : "",
    threshold: "A system surpassed expert human performance across every domain. What you had built by then is what humanity had to work with.",
    termLimit:
      `${termWord(Math.ceil(o.turn / state.config.turnsPerTerm))}, and the Threshold never came on your watch. ` +
      "The institutions you leave behind are the whole of your answer.",
  };

  const good = SIM_NODES.filter((n) => n.goodHigh).map((n) => state.sim[n.id]);
  const avg = good.reduce((a, b) => a + b, 0) / good.length;

  return (
    <div style={S.page}>
      <div style={{ width: "90%", maxWidth: 800, margin: "0 auto", padding: "60px 0" }}>
        <div className="fu" style={{ textAlign: "center", marginBottom: 32 }}>
          <div style={{ ...S.label, color: T.ac }}>{state.year} · after {state.turn} years</div>
          <h1 style={{ ...S.serif, fontSize: 44, margin: "8px 0 12px" }}>{headline[o.kind]}</h1>
          <p style={{ fontSize: 15.5, color: T.t2, lineHeight: 1.7, maxWidth: 600, margin: "0 auto" }}>
            {detail[o.kind]}
          </p>
        </div>

        <div style={{ ...S.card, padding: 20, marginBottom: 16 }}>
          <div style={{ ...S.label, marginBottom: 12 }}>What you leave behind</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 12 }}>
            {[
              ["Alignment confidence", state.sim.alignment_confidence],
              ["Eval coverage", state.sim.eval_coverage],
              ["Institutional capacity", state.sim.institutional_capacity],
              ["Social cohesion", state.sim.social_cohesion],
              ["Public trust", state.sim.public_trust],
              ["Inequality", state.sim.inequality],
            ].map(([label, v]) => (
              <div key={label as string}>
                <div style={{ ...S.mono, fontSize: 20, fontWeight: 600 }}>{(v as number).toFixed(0)}</div>
                <div style={{ ...S.label, fontSize: 9 }}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{ fontSize: 13, color: T.tm, marginTop: 14, lineHeight: 1.6 }}>
            Capability reached {state.world.capability.toFixed(0)}. {state.world.incidents.length} incident
            {state.world.incidents.length === 1 ? "" : "s"} on your watch. Average standing {avg.toFixed(0)}.
          </div>
        </div>

        <div style={{ ...S.card, padding: 20, marginBottom: 20 }}>
          <div style={{ ...S.label, marginBottom: 10 }}>The record</div>
          {state.log.filter((l) => ["incident", "election", "consequence", "outcome", "unrest"].includes(l.kind)).map((l, i) => (
            <div key={i} style={{ display: "flex", gap: 10, marginBottom: 7 }}>
              <span style={{ ...S.mono, fontSize: 11, color: T.tf, minWidth: 34 }}>{2026 + l.turn}</span>
              <span style={{ fontSize: 13, color: T.t2, lineHeight: 1.5 }}>{l.text}</span>
            </div>
          ))}
        </div>

        <div style={{ textAlign: "center" }}>
          <Btn wide onClick={onRestart}>Take office again →</Btn>
        </div>
      </div>
    </div>
  );
}
