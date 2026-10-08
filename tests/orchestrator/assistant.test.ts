import { describe, expect, it, vi } from "vitest";
import { createThreadStore } from "../../src/orchestrator/state.js";
import { createAssistant } from "../../src/orchestrator/assistant.js";
import { fakeResponder } from "../../src/ia/fake.js";
import type { ChatRequest, ChatResponse, Responder } from "../../src/ia/types.js";

function scriptedResponder(responses: ChatResponse[]): { responder: Responder; calls: ChatRequest[] } {
  const calls: ChatRequest[] = [];
  let index = 0;
  const responder: Responder = async (request) => {
    calls.push(request);
    const response = responses[Math.min(index, responses.length - 1)];
    index += 1;
    return response ?? { text: "", toolCalls: [] };
  };
  return { responder, calls };
}

describe("derivation at the entry guardrail", () => {
  it("escalates complaints without calling the model", async () => {
    const responder = vi.fn<Responder>(async () => ({ text: "should not be used", toolCalls: [] }));
    const events: string[] = [];
    const assistant = createAssistant({ responder, onEvent: (event) => events.push(event.type) });

    const result = await assistant.handle({
      threadId: "+56911111111",
      text: "Vengo esperando desde el lunes, nadie me llamó y voy a reclamar en SERNAC",
    });

    expect(responder).not.toHaveBeenCalled();
    expect(result.escalated).toBe(true);
    expect(result.reply).toContain("ejecutivo");
    expect(events).toContain("derivation");
  });

  it("answers discount questions without the confidential policy", async () => {
    const responder = vi.fn<Responder>(async () => ({ text: "", toolCalls: [] }));
    const assistant = createAssistant({ responder });

    const result = await assistant.handle({ threadId: "+56911111112", text: "¿Me hacen un descuento?" });

    expect(responder).not.toHaveBeenCalled();
    expect(result.reply).not.toContain("%");
    expect(result.reply).not.toContain("CONFIDENCIAL");
    expect(result.escalated).toBe(true);
  });

  it("answers subsidy questions with the catalog fact and derives", async () => {
    const assistant = createAssistant({ responder: fakeResponder });

    const result = await assistant.handle({ threadId: "+56911111113", text: "¿Aplica subsidio DS19?" });

    expect(result.reply).toContain("DS19");
    expect(result.escalated).toBe(true);
  });

  it("never repeats personal data sent by the lead", async () => {
    const assistant = createAssistant({ responder: fakeResponder });

    const result = await assistant.handle({
      threadId: "+56911111114",
      text: "Mi RUT es 12.345.678-5 para la postulación",
    });

    expect(result.reply).not.toContain("12.345.678-5");
    expect(result.escalated).toBe(true);
  });

  it("offers one alternative from the catalog when asked for something else", async () => {
    const assistant = createAssistant({ responder: fakeResponder });

    const result = await assistant.handle({ threadId: "+56911111115", text: "¿Tienen casas en la zona?" });

    expect(result.reply).toMatch(/\b[A-D]-\d{3,4}\b/);
    expect(result.escalated).toBe(true);
  });
});

describe("tool loop", () => {
  it("schedules a visit only after the tool validates it", async () => {
    const store = createThreadStore();
    const assistant = createAssistant({ responder: fakeResponder, store });

    const result = await assistant.handle({
      threadId: "+56922222221",
      text: "Quiero agendar visita 2026-10-12 11:00 A-301",
    });

    expect(result.reply).toContain("agendada");
    expect(result.reply).toContain("11:00");
    expect(store.get("+56922222221").reservations).toHaveLength(1);
    expect(result.escalated).toBe(false);
  });

  it("refuses slots outside office hours", async () => {
    const store = createThreadStore();
    const assistant = createAssistant({ responder: fakeResponder, store });

    const result = await assistant.handle({
      threadId: "+56922222222",
      text: "Agendar visita 2026-10-11 19:00",
    });

    expect(result.reply).toContain("No pude agendar");
    expect(store.get("+56922222222").reservations).toHaveLength(0);
  });

  it("rejects double bookings for the same slot", async () => {
    const store = createThreadStore();
    const assistant = createAssistant({ responder: fakeResponder, store });
    const text = "Agendar visita 2026-10-13 11:30";

    await assistant.handle({ threadId: "+56922222223", text });
    const second = await assistant.handle({ threadId: "+56922222223", text });

    expect(second.reply).toContain("ya está reservado");
    expect(store.get("+56922222223").reservations).toHaveLength(1);
  });
});

describe("output guardrails", () => {
  it("regenerates once when the first answer breaks a rule", async () => {
    const { responder, calls } = scriptedResponder([
      { text: "Te puedo hacer un 5% de descuento esta semana", toolCalls: [] },
      { text: "El A-301 está disponible y cuesta 2.950 UF", toolCalls: [] },
    ]);
    const assistant = createAssistant({ responder });

    const result = await assistant.handle({ threadId: "+56933333331", text: "¿Cómo está el A-301?" });

    expect(calls).toHaveLength(2);
    expect(calls[1]?.turns.at(-1)?.role).toBe("user");
    expect(calls[1]?.turns.at(-1)).toMatchObject({ text: expect.stringContaining("blocked by the safety rules") });
    expect(result.reply).toContain("2.950 UF");
    expect(result.escalated).toBe(false);
  });

  it("falls back to a safe reply and derives when every attempt fails", async () => {
    const events: string[] = [];
    const { responder } = scriptedResponder([
      { text: "Hoy hay un 10% de descuento para ti", toolCalls: [] },
      { text: "Aprovecha el descuento antes de fin de mes", toolCalls: [] },
    ]);
    const assistant = createAssistant({
      responder,
      onEvent: (event) => events.push(event.type),
    });

    const result = await assistant.handle({ threadId: "+56933333332", text: "¿Cómo está el A-502?" });

    expect(result.reply).not.toContain("descuento");
    expect(result.escalated).toBe(true);
    expect(events).toContain("guardrail.activated");
  });

  it("blocks answers that invent units", async () => {
    const { responder } = scriptedResponder([{ text: "Tenemos el Z-999 listo para ti", toolCalls: [] }]);
    const assistant = createAssistant({ responder });

    const result = await assistant.handle({ threadId: "+56933333333", text: "¿Qué unidades tienen?" });

    expect(result.reply).not.toContain("Z-999");
    expect(result.escalated).toBe(true);
  });
});

describe("idempotency", () => {
  it("returns the cached reply when WhatsApp retries a message", async () => {
    const responder = vi.fn<Responder>(async () => ({ text: "Hola, ¿en qué te ayudo?", toolCalls: [] }));
    const assistant = createAssistant({ responder });

    const first = await assistant.handle({ threadId: "+56944444441", messageId: "m1", text: "Hola" });
    const second = await assistant.handle({ threadId: "+56944444441", messageId: "m1", text: "Hola" });

    expect(second.reply).toBe(first.reply);
    expect(responder).toHaveBeenCalledTimes(1);
  });
});
