import { describe, expect, it } from "vitest";
import { buildLeadProfile } from "../../src/lead/profile.js";
import { createAssistant } from "../../src/orchestrator/assistant.js";
import { createThreadStore } from "../../src/orchestrator/state.js";
import { fakeResponder } from "../../src/ia/fake.js";

async function conversation(store: ReturnType<typeof createThreadStore>, texts: string[]) {
  const assistant = createAssistant({ responder: fakeResponder, store });
  for (const text of texts) {
    await assistant.handle({ threadId: "+56955555551", text });
  }
  return store.peek("+56955555551");
}

describe("buildLeadProfile", () => {
  it("extracts the declared search, budget and interests", async () => {
    const store = createThreadStore();
    const state = await conversation(store, [
      "Me llamo Juan, busco 2 dorm con presupuesto de 3.000 UF y me interesa el A-301",
    ]);

    expect(state).toBeDefined();
    const profile = buildLeadProfile(state!);

    expect(profile.name).toBe("Juan");
    expect(profile.search.bedrooms).toBe(2);
    expect(profile.budget).toEqual({ amountUf: 3000, kind: "total" });
    expect(profile.unitsOfInterest).toEqual(["A-301"]);
    expect(profile.summary).toContain("Juan");
  });

  it("records the scheduled visit and the escalation", async () => {
    const store = createThreadStore();
    await conversation(store, [
      "Agendar visita 2026-10-14 11:00 A-502",
      "Vengo esperando y nadie me llamó, voy a reclamar",
    ]);

    const profile = buildLeadProfile(store.peek("+56955555551")!);

    expect(profile.visitScheduled).toMatchObject({ date: "2026-10-14", time: "11:00", unitId: "A-502" });
    expect(profile.escalation?.reason).toBe("complaint");
    expect(profile.summary).toContain("Visita agendada 2026-10-14 11:00");
  });

  it("returns an empty but valid profile for a brand new thread", async () => {
    const store = createThreadStore();
    const profile = buildLeadProfile(store.get("new-thread"));

    expect(profile.name).toBeNull();
    expect(profile.budget).toBeNull();
    expect(profile.unitsOfInterest).toHaveLength(0);
    expect(profile.summary).toBe("Busco departamento.");
  });
});
