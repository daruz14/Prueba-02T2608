import { describe, expect, it } from "vitest";
import {
  knownPricesUf,
  loadCatalog,
  publicCatalog,
  reloadCatalog,
  unitById,
  availableUnits,
} from "../../src/domain/catalog.js";

describe("loadCatalog", () => {
  it("loads and validates the fixture", () => {
    reloadCatalog();
    const catalog = loadCatalog();
    expect(catalog.project.name).toBe("Mirador Ñuñoa");
    expect(catalog.units).toHaveLength(8);
  });

  it("fails fast when the fixture does not match the schema", () => {
    expect(() => loadCatalog("/tmp/does-not-exist.json")).toThrow();
  });
});

describe("publicCatalog", () => {
  it("exposes every unit but hides the confidential sales policy", () => {
    const catalog = publicCatalog();
    expect(catalog.units).toHaveLength(8);
    expect(catalog.project).not.toHaveProperty("salePolicy");
    expect(catalog.project.name).toBe("Mirador Ñuñoa");
  });

  it("never leaks the confidential policy through serialization", () => {
    const serialized = JSON.stringify(publicCatalog());
    expect(serialized).not.toContain("CONFIDENCIAL");
    expect(serialized).not.toContain("salePolicy");
  });
});

describe("availableUnits", () => {
  it("lists only units that are still for sale", () => {
    const ids = availableUnits().map((unit) => unit.id);
    expect(ids).not.toContain("B-704");
    expect(ids).not.toContain("D-801");
    expect(ids).toHaveLength(6);
  });
});

describe("unitById", () => {
  it("keeps sold units reachable so the assistant can deny them", () => {
    const sold = unitById("B-704");
    expect(sold?.available).toBe(false);
    expect(unitById("NO-EXISTE")).toBeUndefined();
  });
});

describe("knownPricesUf", () => {
  it("accepts prices from available units plus parking and storage", () => {
    const prices = knownPricesUf();
    expect(prices.has(2950)).toBe(true);
    expect(prices.has(4200)).toBe(true);
    expect(prices.has(450)).toBe(true);
    expect(prices.has(120)).toBe(true);
  });

  it("rejects prices of sold units", () => {
    const prices = knownPricesUf();
    expect(prices.has(3690)).toBe(false);
    expect(prices.has(6500)).toBe(false);
  });
});
