import { describe, expect, it } from "vitest";
import { loadConfig } from "../src/config.js";
import { UpstreamError } from "../src/errors.js";
import { createResponder } from "../src/ia/createResponder.js";
import { createAssistant } from "../src/orchestrator/assistant.js";
import { createServer } from "../src/server.js";

const config = loadConfig({ NODE_ENV: "test", MODEL_BACKEND: "fake" });

function createTestAssistant() {
  return createAssistant({ responder: createResponder(config) });
}

describe("GET /healthz", () => {
  it("reports ok with the configured backend", async () => {
    const app = await createServer(config, createTestAssistant());
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ ok: true, backend: "fake", model: null });
    await app.close();
  });
});

describe("POST /messages", () => {
  it("accepts a well-formed message", async () => {
    const app = await createServer(config, createTestAssistant());
    const response = await app.inject({
      method: "POST",
      url: "/messages",
      payload: { threadId: "+56912345678", messageId: "m1", text: "Do you have 2 bedrooms?" },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.threadId).toBe("+56912345678");
    expect(body.messageId).toBe("m1");
    expect(body.reply).toContain("2 bedrooms");
    await app.close();
  });

  it("rejects a payload without text", async () => {
    const app = await createServer(config, createTestAssistant());
    const response = await app.inject({
      method: "POST",
      url: "/messages",
      payload: { threadId: "+56912345678" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().error).toBe("invalid_payload");
    await app.close();
  });
});

describe("loadConfig", () => {
  it("fails when the gemini backend has no API key", () => {
    expect(() => loadConfig({ MODEL_BACKEND: "gemini" })).toThrow(/GEMINI_API_KEY/);
  });

  it("accepts the gemini backend when an API key is provided", () => {
    const geminiConfig = loadConfig({ MODEL_BACKEND: "gemini", GEMINI_API_KEY: "key" });
    expect(geminiConfig.MODEL_BACKEND).toBe("gemini");
    expect(geminiConfig.GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
  });

  it("ignores empty environment values and falls back to defaults", () => {
    const withEmptyValues = loadConfig({ MODEL_BACKEND: "fake", GEMINI_MODEL: "" });
    expect(withEmptyValues.GEMINI_MODEL).toBe("gemini-3.5-flash-lite");
  });

  it("rejects an ingress key shorter than 8 characters", () => {
    expect(() => loadConfig({ NODE_ENV: "test", INGRESS_API_KEY: "short" })).toThrow(/INGRESS_API_KEY/);
  });

  it("accepts an ingress key", () => {
    const secured = loadConfig({ NODE_ENV: "test", INGRESS_API_KEY: "long-enough-key" });
    expect(secured.INGRESS_API_KEY).toBe("long-enough-key");
  });
});

describe("createResponder", () => {
  it("returns the fake responder for the fake backend", () => {
    expect(createResponder(config)).toBeTypeOf("function");
  });

  it("throws when the gemini backend has no API key", () => {
    const brokenConfig = { ...config, MODEL_BACKEND: "gemini" as const, GEMINI_API_KEY: null };
    expect(() => createResponder(brokenConfig)).toThrow(/GEMINI_API_KEY/);
  });
});

describe("INGRESS_API_KEY", () => {
  const securedConfig = loadConfig({
    NODE_ENV: "test",
    MODEL_BACKEND: "fake",
    INGRESS_API_KEY: "test-ingress-key",
  });

  function createSecuredApp() {
    return createServer(securedConfig, createAssistant({ responder: createResponder(securedConfig) }));
  }

  it("rejects requests without a key", async () => {
    const app = await createSecuredApp();
    const response = await app.inject({
      method: "POST",
      url: "/messages",
      payload: { threadId: "+56912345678", text: "hello" },
    });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: "unauthorized" });
    await app.close();
  });

  it("rejects a wrong key", async () => {
    const app = await createSecuredApp();
    const response = await app.inject({
      method: "POST",
      url: "/messages",
      headers: { "x-api-key": "wrong-key" },
      payload: { threadId: "+56912345678", text: "hello" },
    });

    expect(response.statusCode).toBe(401);
    await app.close();
  });

  it("accepts the x-api-key header", async () => {
    const app = await createSecuredApp();
    const response = await app.inject({
      method: "POST",
      url: "/messages",
      headers: { "x-api-key": "test-ingress-key" },
      payload: { threadId: "+56912345678", text: "hello" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toHaveProperty("reply");
    await app.close();
  });

  it("accepts a bearer token", async () => {
    const app = await createSecuredApp();
    const response = await app.inject({
      method: "GET",
      url: "/lead/desconocido",
      headers: { authorization: "Bearer test-ingress-key" },
    });

    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("keeps /healthz open for readiness checks", async () => {
    const app = await createSecuredApp();
    const response = await app.inject({ method: "GET", url: "/healthz" });

    expect(response.statusCode).toBe(200);
    await app.close();
  });

  it("does not require a key when it is not configured", async () => {
    const app = await createServer(config, createTestAssistant());
    const response = await app.inject({
      method: "POST",
      url: "/messages",
      payload: { threadId: "+56912345678", text: "hello" },
    });

    expect(response.statusCode).toBe(200);
    await app.close();
  });
});

describe("upstream failures", () => {
  it("answers 502 when the model provider fails", async () => {
    const failingResponder = async () => {
      throw new UpstreamError('Gemini request failed for model "gemini-3.5-flash-lite": high demand', {
        statusCode: 503,
      });
    };
    const app = await createServer(config, createAssistant({ responder: failingResponder }));
    const response = await app.inject({
      method: "POST",
      url: "/messages",
      payload: { threadId: "+56912345678", text: "hello" },
    });

    expect(response.statusCode).toBe(502);
    expect(response.json()).toMatchObject({ error: "upstream_unavailable" });
    await app.close();
  });
});
