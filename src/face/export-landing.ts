// Export the landing page to a standalone static file (web/index.html) for a static host (Vercel).
// A static deploy has no backend, so the "Open the live desk" CTAs are repointed at the public repo,
// and the discovery numbers fall back to their static values (the live fetch simply no-ops off-host).
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { LANDING_PAGE } from "./landing";

export function exportLanding(): void {
  const OUT = join(process.cwd(), "web");
  mkdirSync(OUT, { recursive: true });
  // Static deploy: the live-desk CTAs point at the captured desk snapshot (web/desk.html). Relative
  // links so they resolve both on the host root and when opened locally.
  const html = LANDING_PAGE.split('href="/desk#gateway"').join('href="desk.html#gateway"').split('href="/desk"').join('href="desk.html"');
  writeFileSync(join(OUT, "index.html"), html);
  console.log(`NIGHTDESK LANDING EXPORTED: ${join(OUT, "index.html")} (${html.length} bytes)`);
}

if (process.argv[1]?.endsWith("export-landing.ts")) exportLanding();
