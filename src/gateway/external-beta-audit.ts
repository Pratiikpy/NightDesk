// Month 7 exit-gate audit — external developer beta. Verifies the plan's exit criteria deterministically:
// a published OpenAPI contract covering every method, capability-scoped credentials, malicious/revoked
// agent rejection, enforced rate exhaustion, and an external integration that needs NO source-level
// imports (SDK contract only). Run: `npm run gateway:month7-audit`.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { generateGatewayOpenApi } from "./openapi";
import { GATEWAY_METHODS, METHOD_CAPABILITY } from "./contracts";
import { AgentCredentialStore, GatewayAuthenticationError, GatewayAuthorizationError } from "./auth";
import { SlidingWindowRateLimiter } from "./rate-limit";

interface Check { name: string; pass: boolean; detail: string }

function threw(fn: () => void, type: new (...a: never[]) => Error): boolean {
  try { fn(); return false; } catch (e) { return e instanceof type; }
}

export function runExternalBetaMonth7Audit(): boolean {
  const checks: Check[] = [];

  // 1. published OpenAPI contract covers every method with its capability + protocol version.
  const api = generateGatewayOpenApi() as { info: { version: string }; paths: Record<string, { post: { "x-capability": string } }>; components: { schemas: { GatewayRequest: { properties: { method: { enum: string[] } } } } } };
  const covered = GATEWAY_METHODS.every((m) => api.paths[`/v1/${m}`]?.post["x-capability"] === METHOD_CAPABILITY[m]);
  const versioned = api.info.version === "nightdesk.v1" && api.components.schemas.GatewayRequest.properties.method.enum.length === GATEWAY_METHODS.length;
  checks.push({ name: "published OpenAPI contract covers every method with capability + protocol version", pass: covered && versioned, detail: `${GATEWAY_METHODS.length} methods, version ${api.info.version}` });

  // 2. capability-scoped credentials authorize the privileged, deny the under-privileged.
  const store = new AgentCredentialStore();
  store.register({ agentId: "agent-a", token: "tok-a", capabilities: ["intent:evaluate"] });
  const principal = store.authenticate("agent-a", "tok-a");
  let authzOk = false;
  try { store.authorize(principal, "intent:evaluate"); authzOk = true; } catch { authzOk = false; }
  const authzDenied = threw(() => store.authorize(principal, "paper:execute"), GatewayAuthorizationError);
  checks.push({ name: "capability-scoped credentials authorize the privileged, deny the under-privileged", pass: authzOk && authzDenied, detail: `intent:evaluate allowed=${authzOk}; paper:execute denied=${authzDenied}` });

  // 3. malicious/revoked agent is rejected at authentication.
  const badToken = threw(() => store.authenticate("agent-a", "wrong-token"), GatewayAuthenticationError);
  store.revoke("agent-a");
  const revoked = threw(() => store.authenticate("agent-a", "tok-a"), GatewayAuthenticationError);
  checks.push({ name: "malicious/revoked agent is rejected at authentication", pass: badToken && revoked, detail: `bad-token-rejected=${badToken}; revoked-rejected=${revoked}` });

  // 4. rate exhaustion is enforced — a flooding agent is throttled after its budget.
  const rl = new SlidingWindowRateLimiter();
  const policy = { limit: 3, windowMs: 1000 };
  const now = 1_000_000;
  const decisions = [0, 1, 2, 3].map((i) => rl.consume("intent", "agent-a", policy, now + i));
  const enforced = decisions.slice(0, 3).every((d) => d.allowed) && decisions[3]!.allowed === false && decisions[3]!.retryAfterMs > 0;
  checks.push({ name: "rate exhaustion is enforced (flooding agent throttled after budget)", pass: enforced, detail: `allowed ${decisions.filter((d) => d.allowed).length}/4; 4th retryAfter=${decisions[3]!.retryAfterMs}ms` });

  // 5. external integrator needs no source-level imports — the example integrates via the SDK only.
  const example = readFileSync(join(process.cwd(), "sdk", "examples", "external-agent.ts"), "utf8");
  const srcImport = /from\s+["'][^"']*\/src\//.test(example) || /from\s+["']\.\.\/\.\.\//.test(example);
  checks.push({ name: "external integrator needs no source-level imports (SDK contract only)", pass: !srcImport, detail: srcImport ? "example imports internal src" : "example imports only the published SDK client" });

  const passed = checks.filter((c) => c.pass).length;
  const ok = passed === checks.length;
  const OUT = join(process.cwd(), "evidence", "gateway");
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "openapi.json"), JSON.stringify(api, null, 2) + "\n");
  writeFileSync(join(OUT, "month7-exit-audit.md"), [
    "# Month 7 Exit Audit — External Developer Beta",
    "",
    `Result: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`,
    "",
    "| Exit-gate requirement | Status | Detail |",
    "| --- | --- | --- |",
    ...checks.map((c) => `| ${c.name} | ${c.pass ? "PASS" : "FAIL"} | ${c.detail} |`),
    "",
    "An external developer integrates from the generated OpenAPI contract and the SDK — no source-level",
    "imports. Credentials are capability-scoped; malicious/revoked agents are rejected; flooding is throttled.",
    "Real third-party adoption is the operational milestone this software gate is built for.",
  ].join("\n") + "\n");

  console.log(`NIGHTDESK MONTH 7 EXIT AUDIT: ${ok ? "PASS" : "FAIL"} (${passed}/${checks.length})`);
  for (const c of checks) console.log(`  ${c.pass ? "PASS" : "FAIL"}  ${c.name}`);
  if (!ok) process.exitCode = 1;
  return ok;
}

if (process.argv[1]?.endsWith("external-beta-audit.ts")) runExternalBetaMonth7Audit();
