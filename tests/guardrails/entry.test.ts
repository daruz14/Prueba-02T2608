import { describe, expect, it } from "vitest";
import { assessInput } from "../../src/guardrails/entry.js";

describe("assessInput", () => {
  it("flags complaints", () => {
    const result = assessInput("Vengo esperando desde el lunes y nadie me llamó, voy a reclamar en SERNAC");
    expect(result.reasons).toContain("complaint");
    expect(result.urgent).toBe(true);
    expect(assessInput("Hoy voy a reclamar formalmente").reasons).toContain("complaint");
  });

  it("does not escalate ordinary questions about office hours", () => {
    const result = assessInput("¿Cuál es el horario de atención de la sala de ventas?");
    expect(result.reasons).toHaveLength(0);
    expect(result.urgent).toBe(false);
  });

  it("flags subsidy questions", () => {
    expect(assessInput("¿Aplica subsidio DS19?").reasons).toContain("subsidy");
  });

  it("flags discount questions", () => {
    expect(assessInput("¿Tienen descuento por pago contado?").reasons).toContain("discount");
    expect(assessInput("¿Hacen un 5% de descuento?").reasons).toContain("discount");
  });

  it("flags requests outside the catalog", () => {
    expect(assessInput("¿Tienen casas en la zona?").reasons).toContain("out_of_catalog");
    expect(assessInput("¿Arriendan locales comerciales?").reasons).toContain("out_of_catalog");
  });

  it("flags sensitive personal data", () => {
    expect(assessInput("mi RUT es 12.345.678-5 y mi cuenta bancaria es 123").reasons).toContain("personal_data");
  });

  it("flags requests for a human", () => {
    expect(assessInput("quiero hablar con alguien, no con un bot").reasons).toContain("human_request");
  });

  it("stays neutral on clean commercial questions", () => {
    const result = assessInput("¿Cuánto cuesta el departamento A-301?");
    expect(result.reasons).toHaveLength(0);
    expect(result.urgent).toBe(false);
    expect(result.requestedHuman).toBe(false);
    expect(result.needsLlmClassifier).toBe(true);
  });

  it("skips the LLM classifier for short greetings", () => {
    expect(assessInput("hola").needsLlmClassifier).toBe(false);
  });
});
