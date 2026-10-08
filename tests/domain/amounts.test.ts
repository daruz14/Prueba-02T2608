import { describe, expect, it } from "vitest";
import { extractAmounts, mergeAmounts } from "../../src/domain/amounts.js";

describe("extractAmounts", () => {
  it("reads Chilean formatted UF amounts", () => {
    expect(extractAmounts("El A-301 cuesta 2.950 UF").uf).toContain(2950);
    expect(extractAmounts("son 4200 uf en total").uf).toContain(4200);
    expect(extractAmounts("450 UF de estacionamiento").uf).toContain(450);
  });

  it("reads peso amounts with a currency symbol", () => {
    expect(extractAmounts("son $3.500.000").pesos).toContain(3_500_000);
    expect(extractAmounts("presupuesto de $800.000").pesos).toContain(800_000);
  });

  it("converts millions of pesos", () => {
    expect(extractAmounts("tengo 35 millones").pesos).toContain(35_000_000);
    expect(extractAmounts("3,5 millones").pesos).toContain(3_500_000);
  });

  it("returns empty sets when there are no amounts", () => {
    const amounts = extractAmounts("Hola, ¿tienen departamentos?");
    expect(amounts.uf.size).toBe(0);
    expect(amounts.pesos.size).toBe(0);
  });
});

describe("mergeAmounts", () => {
  it("unions every group", () => {
    const merged = mergeAmounts(extractAmounts("2.950 UF"), extractAmounts("tengo 10 millones"));
    expect(merged.uf).toContain(2950);
    expect(merged.pesos).toContain(10_000_000);
  });
});
