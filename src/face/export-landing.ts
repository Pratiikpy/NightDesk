// Export the landing page to a standalone static file (web/index.html) for a static host (Vercel).
// A static deploy has no backend, so the "Open the live desk" CTAs are repointed at the public repo,
// and the discovery numbers fall back to their static values (the live fetch simply no-ops off-host).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LANDING_PAGE } from "./landing";

const REPO = "https://github.com/Pratiikpy/NightDesk";

export function exportLanding(): void {
  const OUT = join(process.cwd(), "web");
  mkdirSync(OUT, { recursive: true });
  const html = LANDING_PAGE.split('href="/desk#gateway"').join(`href="${REPO}#readme" target="_blank" rel="noopener"`).split('href="/desk"').join(`href="${REPO}" target="_blank" rel="noopener"`);
  writeFileSync(join(OUT, "index.html"), html);
  console.log(`NIGHTDESK LANDING EXPORTED: ${join(OUT, "index.html")} (${html.length} bytes)`);
}

if (process.argv[1]?.endsWith("export-landing.ts")) exportLanding();
