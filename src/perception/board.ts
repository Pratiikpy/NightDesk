// `npm run events` — the gap-causality risk-desk screen. For every Bitget tokenized stock: the true
// gap vs the real-stock anchor (session-aware NYSE print), the perp gap (which hides it), the classified CAUSE, and the action.
// This is the "knows the true price, knows why, knows when not to trade" view.
import pLimit from "p-limit";
import { collect } from "../pegwatch/collect";
import { MarketEventProvider } from "./events";
import { classifyGap } from "./causality";
import { sosoApiKeyFromEnv } from "./macro";

const cellL = (s: unknown, w: number) => String(s).padEnd(w);
const cellR = (s: unknown, w: number) => String(s).padStart(w);
const pct = (n: number | null) => (n == null ? "-" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%");
const W = { tkr: 6, gap: 8, cause: 14, act: 7 };

export async function printEventBoard(): Promise<void> {
  const provider = new MarketEventProvider();
  const now = Date.now();
  console.log(`\nNightDesk — gap-causality risk desk @ ${new Date(now).toISOString()}`);
  console.log("(true gap = rToken vs the real-stock anchor — latest NYSE print, last official close off-hours; perp gap = vs the index that hides it; cause → action)");
  if (!sosoApiKeyFromEnv()) console.log("note: SOSOVALUE_API_KEY not set — macro layer inactive (news-only).");

  const snap = await collect();
  const lim = pLimit(5);
  const contexts = await Promise.all(snap.rows.map((r) => lim(() => provider.contextFor(r.ticker, now))));
  const classified = snap.rows.map((r, i) => classifyGap(r, contexts[i]!));

  const macro = contexts[0]?.macro;
  console.log(`\nMacro today: ${macro?.summary || "n/a"}${macro?.active ? "   ← HIGH macro window: desk stands down market-wide" : ""}\n`);
  console.log([cellL("TICKER", W.tkr), cellR("trueGap", W.gap), cellR("perpGap", W.gap), cellL("cause", W.cause), cellL("action", W.act)].join("  ") + "  why");
  console.log(["-".repeat(W.tkr), "-".repeat(W.gap), "-".repeat(W.gap), "-".repeat(W.cause), "-".repeat(W.act)].join("  ") + "  ---");
  const rank: Record<string, number> = { ABSTAIN: 0, AVOID: 1, FADE: 2, NONE: 3 };
  for (const c of classified.sort((a, b) => (rank[a.action]! - rank[b.action]!) || Math.abs(b.trueGapPct ?? 0) - Math.abs(a.trueGapPct ?? 0))) {
    console.log([cellL(c.ticker, W.tkr), cellR(pct(c.trueGapPct), W.gap), cellR(pct(c.perpGapPct), W.gap), cellL(c.type, W.cause), cellL(c.action, W.act)].join("  ") + "  " + c.note);
  }
  const fade = classified.filter((c) => c.action === "FADE").length;
  const abstain = classified.filter((c) => c.action === "ABSTAIN").length;
  const illusion = classified.filter((c) => c.type === "PERP_ILLUSION").length;
  console.log(`\n${classified.length} tokens | ${fade} fade-able | ${abstain} abstain (news/macro) | ${illusion} PERP-ILLUSION (perp hides a real gap — the core discovery)`);
}
