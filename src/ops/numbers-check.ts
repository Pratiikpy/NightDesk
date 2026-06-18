// Numbers consistency guard: every headline number quoted in the judge-facing docs must track the
// evidence files a judge would actually open. This exists because docs were once hand-typed against
// an older 3-recording run while the evidence had been regenerated against 4 recordings — the kind
// of drift that destroys a "every number is reproducible" claim on contact.
//
// Two tiers, because not every number is equally stable:
//   HARD (fails the check): structural counts read straight from the manifest — candidate count and
//     total trials. These only change when the recording set changes, so docs MUST track them, and a
//     mismatch is a real staleness bug. Plus a forbid-list of superseded values that must never
//     reappear.
//   SOFT (reported, never fails): PnL/drawdown/rejected counts depend on the recorded data, which the
//     OOS daemon appends to live, so they legitimately vary run to run. We surface the current
//     evidence value and whether the docs still contain it, so a pre-submission sync is one glance —
//     but we do not false-fail on every honest re-run.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");
const readJson = (rel: string) => JSON.parse(read(rel));
const JUDGE_DOCS = ["README.md", "SUBMISSION.md"];

/** Accept an integer with or without thousands separators: 38880 or 38,880. */
function intForms(n: number): string[] {
  return Array.from(new Set([String(n), n.toLocaleString("en-US")]));
}
/** Accept a 2-dp decimal with or without a leading +: 43.89 or +43.89. */
function decForms(n: number): string[] {
  const two = n.toFixed(2);
  return Array.from(new Set([two, `+${two}`]));
}
function docsContaining(forms: string[]): { file: string; matched: string | null }[] {
  return JUDGE_DOCS.map((file) => {
    const text = existsSync(join(ROOT, file)) ? read(file) : "";
    return { file, matched: forms.find((f) => text.includes(f)) ?? null };
  });
}

export function runNumbersCheck(): boolean {
  const factory = readJson("evidence/alpha-factory/manifest.json");
  const sel = factory.championSelection ?? {};

  // --- HARD: structural counts must appear in every judge-facing doc ---
  const hard = [
    { label: "factory candidates", forms: intForms(factory.candidates) },
    { label: "factory trials", forms: intForms(factory.trials) },
  ].map((c) => {
    const docs = docsContaining(c.forms);
    return { ...c, docs, ok: docs.every((d) => d.matched != null) };
  });

  // --- HARD: superseded values must never reappear in judge-facing docs ---
  const forbidden = ["29,160", "29160", "8,294", "28.39", "4.95"];
  const forbiddenHits: { file: string; value: string }[] = [];
  for (const file of JUDGE_DOCS) {
    const text = existsSync(join(ROOT, file)) ? read(file) : "";
    for (const v of forbidden) if (text.includes(v)) forbiddenHits.push({ file, value: v });
  }

  // --- SOFT: data-dependent values — report current evidence value + whether docs still match ---
  const champReport = existsSync(join(ROOT, "evidence/alpha-championship/alpha-championship-report.md"))
    ? read("evidence/alpha-championship/alpha-championship-report.md")
    : "";
  const globalPnl = champReport.match(/Total PnL across recordings:\s*([\d.\-]+)\s*USDT/i)?.[1];
  const soft = [
    { label: "factory champion total_pnl", forms: decForms(sel.total_pnl ?? 0) },
    { label: "factory champion max_drawdown", forms: decForms(sel.max_drawdown ?? 0) },
    { label: "factory rejected", forms: intForms(factory.rejected) },
    ...(globalPnl ? [{ label: "championship global PnL", forms: [globalPnl, `+${globalPnl}`] }] : []),
  ].map((c) => {
    const docs = docsContaining(c.forms);
    return { ...c, docs, inSync: docs.every((d) => d.matched != null) };
  });

  const ok = hard.every((c) => c.ok) && forbiddenHits.length === 0;
  const drift = soft.filter((s) => !s.inSync);
  writeFileSync(
    join(ROOT, "evidence", "numbers-check.json"),
    JSON.stringify({ generatedAt: new Date().toISOString(), ok, hard, forbiddenHits, soft }, null, 2) + "\n",
  );

  console.log(`NIGHTDESK NUMBERS CHECK ${ok ? "PASS" : "FAIL"}`);
  for (const c of hard) if (!c.ok) console.log(`✗ ${c.label}: missing from ${c.docs.filter((d) => !d.matched).map((d) => d.file).join(", ")} (expected one of: ${c.forms.join(" | ")})`);
  for (const h of forbiddenHits) console.log(`✗ ${h.file}: superseded value present (${h.value})`);
  if (drift.length) {
    console.log(`note: ${drift.length} data-dependent value(s) drifted from docs — sync before submission:`);
    for (const s of drift) console.log(`  ~ ${s.label}: evidence says ${s.forms.join(" | ")} (not found in docs)`);
  }
  // SOFT: surface the Alpha Factory selection-bias controls (Deflated Sharpe / PBO / MinTRL) so any doc
  // quoting them can be synced. Never fails — these are honesty metrics, reported for visibility.
  if (existsSync(join(ROOT, "evidence/alpha-factory/overfit-stats.json"))) {
    const o = readJson("evidence/alpha-factory/overfit-stats.json");
    const pbo = o.pbo?.status === "computed" && o.pbo?.value != null ? `${(o.pbo.value * 100).toFixed(1)}%` : (o.pbo?.status ?? "n/a");
    console.log(`overfit controls: raw Sharpe ${o.rawSharpe}, deflated ${(o.deflatedSharpe * 100).toFixed(1)}% (significant=${o.deflatedSharpeSignificant}), MinTRL ${o.minTrackRecordLength ?? "n/a"}, PBO ${pbo}`);
  }
  if (!ok) process.exitCode = 1;
  return ok;
}

if (process.argv[1]?.endsWith("numbers-check.ts")) runNumbersCheck();
