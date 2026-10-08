import Fastify, { type FastifyInstance } from "fastify";
import { z } from "zod";
import type { Config } from "./config.js";
import { UpstreamError } from "./errors.js";
import { isAuthorized } from "./http/apiKey.js";
import { buildLeadProfile } from "./lead/profile.js";
import type { Assistant } from "./orchestrator/assistant.js";

const messageSchema = z.object({
  threadId: z.string().min(1, "threadId must not be empty"),
  messageId: z.string().min(1, "messageId must not be empty").optional(),
  text: z.string().min(1, "text must not be empty"),
});

type Message = z.infer<typeof messageSchema>;

export async function createServer(
  config: Config,
  assistant: Assistant,
): Promise<FastifyInstance> {
  const app = Fastify({ logger: config.NODE_ENV !== "test" });

  app.setErrorHandler((error: unknown, _request, reply) => {
    if (error instanceof z.ZodError) {
      return reply.status(400).send({ error: "invalid_payload", details: error.issues });
    }
    if (error instanceof Error && "validation" in error) {
      return reply.status(400).send({ error: "invalid_payload", details: error.message });
    }
    if (error instanceof UpstreamError) {
      app.log.error({ err: error, upstreamStatus: error.statusCode }, "upstream request failed");
      return reply.status(502).send({ error: "upstream_unavailable", details: error.message });
    }
    app.log.error(error);
    return reply.status(500).send({ error: "internal_error" });
  });

  app.addHook("onRequest", async (request, reply) => {
    if (request.url === "/health") return;
    if (isAuthorized(request.headers, config.INGRESS_API_KEY ?? undefined)) return;
    return reply.status(401).send({ error: "unauthorized" });
  });

  app.get("/health", async () => ({
    ok: true,
    backend: config.MODEL_BACKEND,
    model: config.MODEL_BACKEND === "gemini" ? config.GEMINI_MODEL : null,
    timezone: config.TZ,
    uptimeSeconds: Math.round(process.uptime()),
  }));

  app.post("/messages", async (request) => {
    const message: Message = messageSchema.parse(request.body);
    const result = await assistant.handle({
      threadId: message.threadId,
      ...(message.messageId ? { messageId: message.messageId } : {}),
      text: message.text,
    });
    return {
      threadId: message.threadId,
      messageId: message.messageId ?? null,
      backend: config.MODEL_BACKEND,
      reply: result.reply,
      escalated: result.escalated,
    };
  });

  app.get<{ Params: { threadId: string } }>("/lead/:threadId", async (request, reply) => {
    const state = assistant.store.peek(request.params.threadId);
    if (!state) {
      return reply.status(404).send({ error: "unknown_thread", threadId: request.params.threadId });
    }
    return buildLeadProfile(state);
  });

  app.post<{ Params: { threadId: string } }>("/lead/:threadId/refresh", async (request, reply) => {
    const state = assistant.store.peek(request.params.threadId);
    if (!state) {
      return reply.status(404).send({ error: "unknown_thread", threadId: request.params.threadId });
    }
    return buildLeadProfile(state);
  });

  return app;
}
