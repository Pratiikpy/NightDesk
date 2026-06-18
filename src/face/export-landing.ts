// Export the landing page to a standalone static file (web/index.html) for a static host (Vercel).
// A static deploy has no backend, so the "Open the live desk" CTAs are repointed at the public repo,
// and the discovery numbers fall back to their static values (the live fetch simply no-ops off-host).
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LANDING_PAGE } from "./landing";
import { runJudgeCockpit } from "./judge-cockpit";

export function exportLanding(): void {
  const OUT = join(process.cwd(), "web");
  mkdirSync(OUT, { recursive: true });
  // Static deploy: the live-desk and cockpit CTAs point at captured static files (web/desk.html,
  // web/cockpit.html). Relative links so they resolve both on the host root and when opened locally.
  const html = LANDING_PAGE
    .split('href="/desk#gateway"').join('href="desk.html#gateway"')
    .split('href="/desk"').join('href="desk.html"')
    .split('href="/cockpit"').join('href="cockpit.html"');
  writeFileSync(join(OUT, "index.html"), html);
  console.log(`NIGHTDESK LANDING EXPORTED: ${join(OUT, "index.html")} (${html.length} bytes)`);

  // Ship the Judge Cockpit as part of the static deploy so the live site serves it too, not just GitHub.
  runJudgeCockpit();
  const cockpitSrc = join(process.cwd(), "evidence", "judge-cockpit", "index.html");
  if (existsSync(cockpitSrc)) {
    copyFileSync(cockpitSrc, join(OUT, "cockpit.html"));
    console.log(`NIGHTDESK COCKPIT EXPORTED: ${join(OUT, "cockpit.html")}`);
  }
}

if (process.argv[1]?.endsWith("export-landing.ts")) exportLanding();
