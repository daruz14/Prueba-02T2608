export type Amounts = {
  readonly uf: ReadonlySet<number>;
  readonly pesos: ReadonlySet<number>;
};

const UF_PATTERN = /(\d{1,3}(?:\.\d{3})+|\d{2,4})\s*UF\b/gi;
const PESOS_PATTERN = /\$\s*(\d{1,3}(?:\.\d{3})+)(?:,\d{1,2})?/g;
const MILLIONS_PATTERN = /(\d+(?:[.,]\d{1,2})?)\s*millones\b/gi;

function stripThousandsSeparator(value: string): number {
  return Number(value.replace(/\./g, ""));
}

export function extractAmounts(text: string): Amounts {
  const uf = new Set<number>();
  const pesos = new Set<number>();

  for (const [, captured] of text.matchAll(UF_PATTERN)) {
    if (!captured) continue;
    const value = stripThousandsSeparator(captured);
    if (value > 0) uf.add(value);
  }

  for (const [, captured] of text.matchAll(PESOS_PATTERN)) {
    if (!captured) continue;
    const value = stripThousandsSeparator(captured);
    if (value > 0) pesos.add(value);
  }

  for (const [, captured] of text.matchAll(MILLIONS_PATTERN)) {
    if (!captured) continue;
    const value = Number(captured.replace(",", "."));
    if (value > 0) pesos.add(Math.round(value * 1_000_000));
  }

  return { uf, pesos };
}

export function mergeAmounts(...groups: readonly Amounts[]): Amounts {
  const uf = new Set<number>();
  const pesos = new Set<number>();
  for (const group of groups) {
    for (const value of group.uf) uf.add(value);
    for (const value of group.pesos) pesos.add(value);
  }
  return { uf, pesos };
}
