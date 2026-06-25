import { test } from "node:test";
import assert from "node:assert/strict";
import { generateGatewayOpenApi } from "../src/gateway/openapi";
import { GATEWAY_METHODS, METHOD_CAPABILITY, NIGHTDESK_PROTOCOL_VERSION } from "../src/gateway/contracts";

test("OpenAPI spec covers every gateway method with its capability + documented error responses", () => {
  const api = generateGatewayOpenApi() as {
    openapi: string;
    info: { version: string };
    paths: Record<string, { post: { "x-capability": string; responses: Record<string, unknown> } }>;
    components: { schemas: { GatewayRequest: { properties: { method: { enum: string[] } } } } };
  };
  assert.equal(api.openapi, "3.0.3");
  assert.equal(api.info.version, NIGHTDESK_PROTOCOL_VERSION);
  for (const m of GATEWAY_METHODS) {
    const op = api.paths[`/v1/${m}`]?.post;
    assert.ok(op, `path for ${m}`);
    assert.equal(op["x-capability"], METHOD_CAPABILITY[m]);
    assert.ok(op.responses["429"], "rate-limit response documented");
    assert.ok(op.responses["403"], "missing-capability response documented");
  }
  assert.deepEqual(api.components.schemas.GatewayRequest.properties.method.enum, [...GATEWAY_METHODS]);
});
