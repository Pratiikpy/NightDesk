// `npm run flags` — per-token tracking-error-to-underlier + honest rights/risk flags for the whole
// basis universe. Fetches each rToken's daily candles (Bitget) + the real stock's daily history
// (Yahoo) and reports how tightly the token tracks the stock. Legal rights are NOT asserted.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import pLimit from "p-limit";
import { basisPairs } from "../universe";
import { spotCandles } from "../bitget/client";
import { collect } from "../pegwatch/collect";
import { equityCandles } from "./equity";
import { trackingError, buildRightsFlags, tokenQuality, type RightsFlags, type TokenQuality } from "../history/tracking";

const lim = pLimit(5);

const cellL = (s: unknown, w: number) => String(s).padEnd(w);
const cellR = (s: unknown, w: number) => String(s).padStart(w);

export async function runTokenFlags(): Promise<RightsFlags[]> {
  // One live snapshot gives the current liquidity signal (L2 book present vs quote-only) per token.
  const snap = await collect().catch(() => null);
  const liqByTicker = new Map<string, RightsFlags["liquidity"]>();
  if (snap) {
    for (const row of snap.rows) {
      liqByTicker.set(row.ticker, (row.rToken?.bookLevels ?? 0) > 0 ? "L2-book" : row.rToken?.mid != null ? "quote-only" : "unknown");
    }
  }
  return Promise.all(
    basisPairs.map((p) =>
      lim(async () => {
        const [r, eq] = await Promise.all([
          spotCandles(p.rtoken_spot, "1day", 200).catch(() => []),
          equityCandles(p.ticker, "3mo").catch(() => []),
        ]);
        return buildRightsFlags(p.ticker, trackingError(r, eq), liqByTicker.get(p.ticker) ?? "unknown");
      })
    )
  );
}

export async function printTokenFlags(): Promise<void> {
  console.log("Fetching rToken daily candles + real equity history for tracking-error…");
  const flags = await runTokenFlags();

  // ── Tokenized Stock Quality Board (transparent reliability grade) ──
  const quality: TokenQuality[] = flags.map(tokenQuality).sort((a, b) => {
    if (a.grade === "n/a" && b.grade !== "n/a") return 1;
    if (b.grade === "n/a" && a.grade !== "n/a") return -1;
    return b.qualityScore - a.qualityScore;
  });
  console.log(`\n══════════ NightDesk — Tokenized Stock Quality Board ══════════`);
  console.log("(TRANSPARENT reliability grade: tracking 50% · stability 30% · liquidity 20%. NOT alpha. Legal rights excluded — never fabricated.)\n");
  console.log([cellR("RANK", 4), cellL("TICKER", 6), cellL("GRADE", 5), cellR("SCORE", 6), cellR("TRACK", 5), cellR("STABLE", 6), cellL("LIQUIDITY", 11)].join("  ") + "  legal rights");
  console.log(["-".repeat(4), "-".repeat(6), "-".repeat(5), "-".repeat(6), "-".repeat(5), "-".repeat(6), "-".repeat(11)].join("  ") + "  ------------");
  quality.forEach((q, i) => {
    console.log(
      [
        cellR(i + 1, 4),
        cellL(q.ticker, 6),
        cellL(q.grade, 5),
        cellR(q.grade === "n/a" ? "-" : q.qualityScore.toFixed(1), 6),
        cellR(q.components.tracking, 5),
        cellR(q.components.stability, 6),
        cellL(q.liquidity, 11),
      ].join("  ") + "  not verified"
    );
  });
  const gradeOf = (g: string) => quality.filter((q) => q.grade === g).length;
  console.log(`\nA:${gradeOf("A")}  B:${gradeOf("B")}  C:${gradeOf("C")}  D:${gradeOf("D")}  n/a:${gradeOf("n/a")} — grades data quality (tracking/stability/liquidity), NOT profitability or legal safety.`);
  {
    const qdir = join(process.cwd(), "data", "research");
    mkdirSync(qdir, { recursive: true });
    writeFileSync(join(qdir, "token-quality.json"), JSON.stringify(quality, null, 2));
  }

  console.log(`\n══════════ NightDesk — per-token tracking & rights/risk flags ══════════`);
  console.log("(tracking measured vs the REAL stock daily close; legal rights are NOT asserted — see issuer)\n");
  console.log([cellL("TICKER", 6), cellR("days", 4), cellR("meanAbsErr", 10), cellR("stdev", 8), cellR("maxErr", 8), cellR("corr", 5), cellL("grade", 6)].join("  ") + "  legal rights");
  console.log(["-".repeat(6), "-".repeat(4), "-".repeat(10), "-".repeat(8), "-".repeat(8), "-".repeat(5), "-".repeat(6)].join("  ") + "  ------------");
  for (const f of [...flags].sort((a, b) => b.tracking.meanAbsPremiumPct - a.tracking.meanAbsPremiumPct)) {
    const t = f.tracking;
    console.log(
      [
        cellL(f.ticker, 6),
        cellR(t.nDays, 4),
        cellR(t.meanAbsPremiumPct + "%", 10),
        cellR(t.stdevPremiumPct + "%", 8),
        cellR(t.maxAbsPremiumPct + "%", 8),
        cellR(t.returnCorrelation == null ? "-" : t.returnCorrelation.toFixed(2), 5),
        cellL(f.trackingGrade, 6),
      ].join("  ") + "  not verified — see issuer"
    );
  }
  const graded = flags.filter((f) => f.trackingGrade !== "n/a");
  const tight = graded.filter((f) => f.trackingGrade === "tight").length;
  console.log(`\n${flags.length} tokens | ${graded.length} graded | ${tight} tracking TIGHT (level gap <1.5%) | dividends/voting/corp-actions: all "not verified — see issuer" (we never fabricate legal facts)`);
  console.log(`CAVEAT: 'corr' (daily-return correlation) is confounded — rToken bar closes 00:00 UTC vs the stock's ~21:00 UTC NYSE close, so it understates true tracking. Grade uses the robust level gap, not corr. Matched-timestamp tracking comes from the live equity-aware recorder.`);
  const dir = join(process.cwd(), "data", "research");
  mkdirSync(dir, { recursive: true });
  const file = join(dir, "token-flags.json");
  writeFileSync(file, JSON.stringify(flags, null, 2));
  console.log(`full flags → ${file}`);
}
