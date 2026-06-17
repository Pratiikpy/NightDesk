import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const OUT = join(process.cwd(), "evidence");

interface DoctorRow {
  check: string;
  status: "pass" | "warn" | "fail";
  detail: string;
}

function envPresent(name: string): boolean {
  return Boolean(process.env[name]);
}

export function runDoctor(): void {
  mkdirSync(OUT, { recursive: true });
  const pkg = JSON.parse(readFileSync(join(process.cwd(), "package.json"), "utf8")) as { scripts?: Record<string, string> };
  const rows: DoctorRow[] = [
    { check: "node_version", status: Number(process.versions.node.split(".")[0]) >= 18 ? "pass" : "fail", detail: process.versions.node },
    { check: "package_scripts", status: pkg.scripts?.["judge:max"] && pkg.scripts?.["judge:max:full"] ? "pass" : "fail", detail: "judge:max and judge:max:full expected" },
    { check: "snapshots", status: existsSync(join(process.cwd(), "data", "snapshots")) ? "pass" : "warn", detail: "data/snapshots directory" },
    { check: "bitget_readonly_evidence", status: existsSync(join(process.cwd(), "evidence", "bitget-live", "live-market-snapshot.json")) ? "pass" : "warn", detail: "live-market-snapshot.json" },
    { check: "qwen_key", status: envPresent("BITGET_QWEN_API_KEY") || envPresent("QWEN_API_KEY") ? "pass" : "warn", detail: "Qwen key optional for deterministic/offline judge path" },
    { check: "live_trade_default", status: process.env.NIGHTDESK_ENABLE_LIVE_TRADE === "1" ? "warn" : "pass", detail: "live trading should be disabled unless explicitly enabled" },
    { check: "shell_tools_default", status: process.env.NIGHTDESK_ENABLE_SHELL_TOOLS === "1" ? "warn" : "pass", detail: "shell-capable tools should be opt-in" },
    { check: "evidence_manifest", status: existsSync(join(process.cwd(), "evidence", "max-judge-manifest.json")) ? "pass" : "fail", detail: "max judge manifest" },
    { check: "ledger_verification", status: existsSync(join(process.cwd(), "evidence", "trading-log", "ledger-verification.txt")) ? "pass" : "fail", detail: "ledger verification evidence" },
  ];
  const md = [
    "# NightDesk Doctor Report",
    "",
    "| Check | Status | Detail |",
    "|---|---|---|",
    ...rows.map((r) => `| ${r.check} | ${r.status} | ${r.detail} |`),
    "",
    "Secrets are never printed. Environment checks only report presence/absence.",
    "",
  ].join("\n");
  writeFileSync(join(OUT, "doctor-report.md"), md);
  writeFileSync(join(OUT, "doctor-report.json"), JSON.stringify({ generatedAt: new Date().toISOString(), rows }, null, 2) + "\n");
  console.log(`NIGHTDESK DOCTOR COMPLETE: ${join(OUT, "doctor-report.md")}`);
}

if (process.argv[1]?.endsWith("doctor.ts")) runDoctor();
