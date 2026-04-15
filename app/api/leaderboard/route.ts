import { NextRequest, NextResponse } from "next/server";
import { Redis } from "@upstash/redis";

// Uses KV_REST_API_URL / KV_REST_API_TOKEN if set (Vercel KV),
// falls back to UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN.
function getClient(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

const MAX_ENTRIES = 100;
const KEY = "leaderboard:v1";

type Entry = {
  id: string;
  handle: string;
  country: string;
  countryLabel: string;
  flag: string;
  difficulty: string;
  difficultyLabel: string;
  grade: string;
  avg: number;
  endless: boolean;
  endlessRounds: number;
  collapsed: boolean;
  weekly: boolean;
  synergies: number;
  tier2: number;
  quests: number;
  date: string;
};

export const runtime = "edge";

export async function GET() {
  const redis = getClient();
  if (!redis) return NextResponse.json({ enabled: false, entries: [] });
  try {
    const top = await redis.zrange<string[]>(KEY, 0, 49, { rev: true, withScores: false });
    const parsed = (top || [])
      .map((s) => { try { return JSON.parse(s) as Entry; } catch { return null; } })
      .filter((x): x is Entry => x !== null);
    return NextResponse.json({ enabled: true, entries: parsed });
  } catch {
    return NextResponse.json({ enabled: false, entries: [], error: "read_failed" });
  }
}

function s(v: unknown, max = 40): string {
  if (typeof v !== "string") return "";
  return v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max).trim();
}
function n(v: unknown, min = 0, max = 1000): number {
  const x = Math.round(Number(v) || 0);
  return Math.max(min, Math.min(max, x));
}

export async function POST(req: NextRequest) {
  const redis = getClient();
  if (!redis) return NextResponse.json({ ok: false, enabled: false });
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false, error: "bad_json" }, { status: 400 }); }

  const entry: Entry = {
    id: s(body.id, 32) || String(Date.now()),
    handle: s(body.handle, 20) || "Anonymous",
    country: s(body.country, 20),
    countryLabel: s(body.countryLabel, 30),
    flag: s(body.flag, 8),
    difficulty: s(body.difficulty, 20),
    difficultyLabel: s(body.difficultyLabel, 30),
    grade: s(body.grade, 4),
    avg: n(body.avg, 0, 100),
    endless: Boolean(body.endless),
    endlessRounds: n(body.endlessRounds, 0, 999),
    collapsed: Boolean(body.collapsed),
    weekly: Boolean(body.weekly),
    synergies: n(body.synergies, 0, 50),
    tier2: n(body.tier2, 0, 20),
    quests: n(body.quests, 0, 10),
    date: new Date().toISOString(),
  };

  // Score: avg primary, +5 per endless round survived, -25 if collapsed before endless
  const score = entry.avg + entry.endlessRounds * 5 - (entry.collapsed && !entry.endless ? 25 : 0);

  try {
    await redis.zadd(KEY, { score, member: JSON.stringify(entry) });
    const size = await redis.zcard(KEY);
    if (size > MAX_ENTRIES) {
      await redis.zremrangebyrank(KEY, 0, size - MAX_ENTRIES - 1);
    }
    return NextResponse.json({ ok: true, enabled: true, score });
  } catch {
    return NextResponse.json({ ok: false, error: "write_failed" }, { status: 500 });
  }
}
