// Generate the published OpenAPI 3 contract for the NightDesk Agent Gateway directly from the canonical
// method/capability tables — so external developers integrate from a generated spec, never source. The
// spec stays in lockstep with the contract by construction (no hand-maintained second source of truth).
import { GATEWAY_METHODS, METHOD_CAPABILITY, SIDE_EFFECTING_METHODS, NIGHTDESK_PROTOCOL_VERSION } from "./contracts";

export function generateGatewayOpenApi(): Record<string, unknown> {
  const paths: Record<string, unknown> = {};
  for (const method of GATEWAY_METHODS) {
    paths[`/v1/${method}`] = {
      post: {
        operationId: method,
        summary: `${method} — capability ${METHOD_CAPABILITY[method]}`,
        "x-capability": METHOD_CAPABILITY[method],
        "x-side-effecting": SIDE_EFFECTING_METHODS.has(method),
        security: [{ agentToken: [] }],
        requestBody: { required: true, content: { "application/json": { schema: { $ref: "#/components/schemas/GatewayRequest" } } } },
        responses: {
          "200": { description: "verdict / accepted / final result", content: { "application/json": { schema: { $ref: "#/components/schemas/GatewayResponse" } } } },
          "401": { description: "authentication failed" },
          "403": { description: "missing capability" },
          "409": { description: "idempotency conflict" },
          "429": { description: "rate limit exceeded" },
        },
      },
    };
  }
  return {
    openapi: "3.0.3",
    info: {
      title: "NightDesk Agent Gateway",
      version: NIGHTDESK_PROTOCOL_VERSION,
      description: "Capability-scoped, rate-limited, idempotent gateway for tokenized-stock trading agents. Every side-effecting method is keyed and idempotent; every verdict is certificate-backed.",
    },
    security: [{ agentToken: [] }],
    components: {
      securitySchemes: { agentToken: { type: "http", scheme: "bearer", description: "Per-agent capability-scoped bearer token paired with an X-Agent-Id header." } },
      schemas: {
        GatewayRequest: {
          type: "object",
          required: ["protocolVersion", "method", "agentId"],
          properties: {
            protocolVersion: { const: NIGHTDESK_PROTOCOL_VERSION },
            method: { enum: [...GATEWAY_METHODS] },
            agentId: { type: "string" },
            idempotencyKey: { type: "string", description: "required for side-effecting methods" },
            params: { type: "object" },
          },
        },
        GatewayResponse: {
          type: "object",
          required: ["status"],
          properties: { status: { enum: ["final", "accepted", "error"] }, runId: { type: "string" }, result: { type: "object" }, error: { type: "object" } },
        },
      },
    },
    paths,
  };
}
