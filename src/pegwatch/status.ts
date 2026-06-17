// One-shot live status table. `npm run status`.
import { collect } from "./collect";

const cellL = (s: unknown, w: number) => String(s).padEnd(w);
const cellR = (s: unknown, w: number) => String(s).padStart(w);
const money = (n: number | null) => (n == null ? "-" : n.toFixed(2));
const pct = (n: number | null) => (n == null ? "-" : (n >= 0 ? "+" : "") + n.toFixed(2) + "%");
const W = { tkr: 7, px: 8, pct: 8, state: 11 };

export async function printStatus(): Promise<void> {
  const snap = await collect();
  console.log(`\nPegWatch — live status @ ${snap.isoTime}`);
  console.log("(vsPerp = rToken↔Bitget perp basis; vsEQUITY = rToken↔REAL stock price = the true depeg; off-hours equity = last NYSE close)\n");
  console.log(
    [cellL("TICKER", W.tkr), cellR("rToken", W.px), cellR("perp", W.px), cellR("equity", W.px), cellR("vsPerp", W.pct), cellR("vsEQUITY", W.pct), cellL("state(eq)", W.state)].join("  ") + "  liquidity"
  );
  console.log(["-".repeat(W.tkr), "-".repeat(W.px), "-".repeat(W.px), "-".repeat(W.px), "-".repeat(W.pct), "-".repeat(W.pct), "-".repeat(W.state)].join("  ") + "  ---------");
  for (const r of snap.rows) {
    const liq = r.rToken ? (r.rToken.bookLevels > 0 ? `L2x${r.rToken.bookLevels}` : "quote") : "-";
    console.log(
      [
        cellL(r.ticker, W.tkr),
        cellR(money(r.rToken?.mid ?? null), W.px),
        cellR(money(r.perp?.mid ?? null), W.px),
        cellR(money(r.equity?.price ?? null), W.px),
        cellR(pct(r.premiumPct), W.pct),
        cellR(pct(r.premiumVsEquityPct ?? null), W.pct),
        cellL(r.stateVsEquity ?? r.state ?? "-", W.state),
      ].join("  ") +
        "  " +
        liq +
        (r.tradeable ? "  *tradeable" : "")
    );
  }
  const flagged = snap.rows.filter((r) => r.triangulation?.flagged);
  if (flagged.length) {
    console.log("\nTriangulation flags (rToken / Ondo / perp disagree > 1%):");
    for (const r of flagged) {
      const t = r.triangulation!;
      console.log(
        `  ${r.ticker}: r↔perp=${t.rPerpPct?.toFixed(2)}%  ondo↔perp=${t.ondoPerpPct?.toFixed(2)}%  r↔ondo=${t.rOndoPct?.toFixed(2)}%`
      );
    }
  }
  const nonNormal = snap.rows.filter((r) => r.state && r.state !== "NORMAL").length;
  const depegEq = snap.rows.filter((r) => r.stateVsEquity && r.stateVsEquity !== "NORMAL").length;
  const withEq = snap.rows.filter((r) => r.equity).length;
  console.log(
    `\n${snap.rows.length} pairs | vs-perp non-normal ${nonNormal} | vs-EQUITY dislocated ${depegEq} (true depeg, ${withEq} priced) | ${flagged.length} triangulation-flagged`
  );
}
