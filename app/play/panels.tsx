"use client";

/**
 * Presentational pieces for the governing screen.
 *
 * The design problem this screen has to solve: a 110-node simulation is only
 * playable if the player can ask *why* something moved and get a real answer.
 * So every node is clickable and every click produces its ranked inbound
 * contributions straight from the engine's causal trace — no separate
 * explanation layer that can drift out of sync with the model.
 */

import type { ReactNode } from "react";
import { S, T, valueColour } from "./theme.ts";
import type {
  DilemmaDef, GameState, GroupDef, PolicyDef, SimNodeDef, TraceEntry,
} from "@/lib/sim/types.ts";

// ── Small shared bits ────────────────────────────────────────────────────────

export function Section({ title, right, children }: {
  title: string; right?: ReactNode; children: ReactNode;
}) {
  return (
    <div style={{ ...S.card, padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline",
                    borderBottom: `1px solid ${T.bd}`, paddingBottom: 7, marginBottom: 10 }}>
        <span style={S.label}>{title}</span>
        {right}
      </div>
      {children}
    </div>
  );
}

export function Stat({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div style={{ textAlign: "center", minWidth: 74 }}>
      <div style={{ ...S.mono, fontSize: 19, fontWeight: 600, color: tone ?? T.tx }}>{value}</div>
      <div style={{ ...S.label, fontSize: 9.5 }}>{label}</div>
    </div>
  );
}

export function Btn({ children, onClick, disabled, tone, wide }: {
  children: ReactNode; onClick?: () => void; disabled?: boolean; tone?: string; wide?: boolean;
}) {
  return (
    <button
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        border: "none", borderRadius: 9, padding: wide ? "13px 30px" : "8px 16px",
        fontSize: wide ? 15 : 13, fontWeight: 600, fontFamily: "'Outfit',sans-serif",
        background: disabled ? T.sa : (tone ?? T.ac), color: disabled ? T.tf : "#fff",
        cursor: disabled ? "not-allowed" : "pointer", transition: "filter .15s",
      }}
    >
      {children}
    </button>
  );
}

// ── Simulation nodes ─────────────────────────────────────────────────────────

export function NodeRow({ def, value, previous, selected, onSelect }: {
  def: SimNodeDef; value: number; previous?: number; selected: boolean; onSelect: () => void;
}) {
  const delta = previous === undefined ? 0 : value - previous;
  const col = valueColour(value, def.goodHigh);
  return (
    <button
      className="rowhover"
      onClick={onSelect}
      title={def.description}
      style={{
        display: "block", width: "100%", textAlign: "left", border: "none",
        background: selected ? T.sa : "transparent", padding: "4px 6px",
        borderRadius: 6, cursor: "pointer", fontFamily: "'Outfit',sans-serif",
      }}
    >
      <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 12.5, color: T.t2 }}>{def.name}</span>
        <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
          {Math.abs(delta) >= 0.5 && (
            <span style={{ ...S.mono, fontSize: 10, color: delta > 0 ? T.gd : T.bad }}>
              {delta > 0 ? "▲" : "▼"}{Math.abs(delta).toFixed(0)}
            </span>
          )}
          <span style={{ ...S.mono, fontSize: 12.5, fontWeight: 600, color: col, minWidth: 22, textAlign: "right" }}>
            {value.toFixed(0)}
          </span>
        </span>
      </span>
      <span style={{ display: "block", height: 3, background: T.sa, borderRadius: 2, marginTop: 3, overflow: "hidden" }}>
        <span style={{ display: "block", height: "100%", width: `${value}%`, background: col, transition: "width .5s ease" }} />
      </span>
    </button>
  );
}

/**
 * The "why did that move" panel. Reads the engine's own trace, so it can never
 * disagree with the simulation — if the number moved, the reason shown is the
 * reason it moved.
 */
export function CausePanel({ target, label, entry }: {
  target: string; label: string; entry?: TraceEntry;
}) {
  if (!entry) {
    return (
      <div style={{ fontSize: 12.5, color: T.tm, lineHeight: 1.6 }}>
        <b style={{ color: T.tx }}>{label}</b> held steady last year — nothing moved it enough to report.
      </div>
    );
  }
  const delta = entry.to - entry.from;
  const max = Math.max(...entry.contributions.map((c) => Math.abs(c.amount)), 1);
  return (
    <div>
      <div style={{ marginBottom: 8 }}>
        <b style={{ fontSize: 13 }}>{label}</b>{" "}
        <span style={{ ...S.mono, fontSize: 12, color: T.tm }}>
          {entry.from.toFixed(0)} → {entry.to.toFixed(0)}
        </span>{" "}
        <span style={{ ...S.mono, fontSize: 12, color: delta > 0 ? T.gd : T.bad }}>
          ({delta > 0 ? "+" : ""}{delta.toFixed(1)})
        </span>
      </div>
      {entry.contributions.length === 0 && (
        <div style={{ fontSize: 12, color: T.tm }}>Drifting back toward its baseline.</div>
      )}
      {entry.contributions.map((c, i) => (
        <div key={i} style={{ marginBottom: 6 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
            <span style={{ ...S.mono, fontSize: 11, color: T.t2 }}>{prettyRef(c.source)}</span>
            <span style={{ ...S.mono, fontSize: 11, fontWeight: 600, color: c.amount > 0 ? T.gd : T.bad }}>
              {c.amount > 0 ? "+" : ""}{c.amount.toFixed(1)}
            </span>
          </div>
          <div style={{ height: 3, background: T.sa, borderRadius: 2, marginTop: 2 }}>
            <div style={{
              height: "100%", width: `${(Math.abs(c.amount) / max) * 100}%`,
              background: c.amount > 0 ? T.gd : T.bad, borderRadius: 2,
            }} />
          </div>
          {c.note && <div style={{ fontSize: 11, color: T.tm, marginTop: 2, fontStyle: "italic" }}>{c.note}</div>}
        </div>
      ))}
      <div style={{ ...S.mono, fontSize: 9.5, color: T.tf, marginTop: 8 }}>{target}</div>
    </div>
  );
}

/** `policy.grid_investment` → `Grid Investment`. */
export function prettyRef(ref: string): string {
  const body = ref.includes(".") ? ref.slice(ref.indexOf(".") + 1) : ref;
  return body
    .split(".")
    .map((part) => part.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase()))
    .join(" · ");
}

// ── Blocs ────────────────────────────────────────────────────────────────────

export function BlocRow({ def, membership, happiness, extremism, championed }: {
  def: GroupDef; membership: number; happiness: number; extremism: number; championed: boolean;
}) {
  const col = valueColour(happiness);
  return (
    <div style={{ marginBottom: 8 }} title={def.description}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 12.5, color: T.t2 }}>
          {def.name}
          {championed && (
            <span style={{ ...S.mono, fontSize: 9, color: T.bad, marginLeft: 5 }} title="The opposition has adopted their cause">
              ◆ OPP
            </span>
          )}
          {extremism > 45 && (
            <span style={{ ...S.mono, fontSize: 9, color: T.bad, marginLeft: 5 }} title="Radicalising">
              ⚑
            </span>
          )}
        </span>
        <span style={{ ...S.mono, fontSize: 11, color: T.tm }}>{membership.toFixed(0)}%</span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2, flexWrap: "nowrap" }}>
        <div style={{ flex: "1 1 0", minWidth: 0, height: 6, background: T.sa, borderRadius: 3, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${happiness}%`, background: col, transition: "width .5s ease" }} />
        </div>
        <span style={{ ...S.mono, fontSize: 11, fontWeight: 600, color: col, flex: "0 0 auto", minWidth: 18, textAlign: "right" }}>
          {happiness.toFixed(0)}
        </span>
      </div>
    </div>
  );
}

// ── Policies ─────────────────────────────────────────────────────────────────

export function PolicyRow({ def, active, draft, capitalCost, affordable, gdp, onChange }: {
  def: PolicyDef; active: number; draft: number; capitalCost: number;
  affordable: boolean; gdp: number; onChange: (v: number) => void;
}) {
  const changed = capitalCost > 0;
  // An inactive policy costs and raises nothing, so it should say nothing —
  // a column of "−0" reads as noise and buries the figures that do matter.
  const money = draft === 0
    ? ""
    : def.revenueOfGdp
      ? `+${((def.revenueOfGdp * draft) / 100 * gdp).toFixed(0)}`
      : def.costOfGdp
        ? `−${((def.costOfGdp * draft) / 100 * gdp).toFixed(0)}`
        : "";
  const ramping = Math.abs(active - draft) > 0.5;

  return (
    <div style={{ marginBottom: 9 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 12.5, color: T.t2 }} title={def.description}>{def.name}</span>
        <span style={{ display: "flex", gap: 6, alignItems: "baseline" }}>
          {changed && (
            <span style={{
              ...S.mono, fontSize: 10, fontWeight: 600,
              color: affordable ? T.ac : T.bad,
            }} title="Political capital this change costs">
              {affordable ? "" : "✕"}{capitalCost}pc
            </span>
          )}
          {money && (
            <span style={{ ...S.mono, fontSize: 10, color: def.revenueOfGdp ? T.gd : T.tm }}
                  title={def.revenueOfGdp ? "Annual revenue" : "Annual cost"}>
              {money}
            </span>
          )}
          <span style={{ ...S.mono, fontSize: 12, fontWeight: 600, minWidth: 26, textAlign: "right" }}>
            {draft}%
          </span>
        </span>
      </div>
      <input
        type="range" min={0} max={100} step={5} value={draft}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: "100%", height: 16, cursor: "pointer" }}
      />
      {ramping && (
        <div style={{ ...S.mono, fontSize: 9.5, color: T.tf, marginTop: -3 }}>
          in force: {active.toFixed(0)}% · {def.implementation}yr to take full effect
        </div>
      )}
    </div>
  );
}

// ── Dilemmas ─────────────────────────────────────────────────────────────────

export function DilemmaCard({ def, state, chosen, onChoose, availability }: {
  def: DilemmaDef;
  state: GameState;
  chosen?: number;
  onChoose: (i: number) => void;
  availability: { available: boolean; lockedReason?: string }[];
}) {
  return (
    <div style={{ ...S.card, padding: 16, marginBottom: 12, borderLeft: `3px solid ${T.ac}` }} className="fu">
      <div style={{ ...S.label, color: T.ac, marginBottom: 4 }}>{def.category}</div>
      <div style={{ ...S.serif, fontSize: 21, marginBottom: 5 }}>{def.title}</div>
      <div style={{ fontSize: 14, color: T.t2, lineHeight: 1.55, marginBottom: 13 }}>{def.subtitle}</div>

      <div style={{ display: "grid", gap: 8 }}>
        {def.options.map((o, i) => {
          const av = availability[i];
          const isChosen = chosen === i;
          return (
            <button
              key={i}
              onClick={av.available ? () => onChoose(i) : undefined}
              disabled={!av.available}
              style={{
                textAlign: "left", padding: "10px 13px", borderRadius: 9,
                border: `1px solid ${isChosen ? T.ac : T.bd}`,
                background: isChosen ? `${T.ac}0D` : av.available ? T.sf : T.sa,
                cursor: av.available ? "pointer" : "not-allowed",
                opacity: av.available ? 1 : 0.65,
                fontFamily: "'Outfit',sans-serif", width: "100%",
              }}
            >
              <span style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "baseline" }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: av.available ? T.tx : T.tm }}>
                  {isChosen ? "✓ " : ""}{o.label}
                </span>
                {o.cost !== undefined && (
                  <span style={{ ...S.mono, fontSize: 11, color: av.available ? T.ac : T.bad }}>{o.cost}pc</span>
                )}
              </span>
              <span style={{ display: "block", fontSize: 12.5, color: T.t2, lineHeight: 1.5, marginTop: 3 }}>{o.detail}</span>
              {o.forecast && av.available && (
                <span style={{ display: "block", fontSize: 12, color: T.tm, fontStyle: "italic", marginTop: 5 }}>{o.forecast}</span>
              )}
              {!av.available && (
                <span style={{ ...S.mono, display: "block", fontSize: 11, color: T.bad, marginTop: 5 }}>
                  ✕ {av.lockedReason}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
