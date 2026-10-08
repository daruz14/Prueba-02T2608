import { readFileSync } from "node:fs";
import { z } from "zod";

export type Unit = {
  readonly id: string;
  readonly typology: string;
  readonly bedrooms: number;
  readonly bathrooms: number;
  readonly squareMeters: number;
  readonly priceUf: number;
  readonly floor: number;
  readonly orientation: string;
  readonly available: boolean;
};

export type Project = {
  readonly name: string;
  readonly commune: string;
  readonly address: string;
  readonly delivery: string;
  readonly subsidizedDs19: boolean;
  readonly parkingPriceUf: number;
  readonly storagePriceUf: number;
  readonly visitHours: readonly string[];
  readonly salePolicy: string;
};

export type Catalog = {
  readonly project: Project;
  readonly units: readonly Unit[];
};

export type PublicCatalog = Omit<Catalog, "project"> & {
  readonly project: Omit<Project, "salePolicy">;
};

const rawUnitSchema = z.object({
  id: z.string().min(1),
  tipologia: z.string().min(1),
  dormitorios: z.number().int().min(0),
  banos: z.number().int().min(1),
  m2: z.number().positive(),
  precio_uf: z.number().positive(),
  piso: z.number().int().min(1),
  orientacion: z.string().min(1),
  disponible: z.boolean(),
});

const rawProjectSchema = z.object({
  nombre: z.string().min(1),
  comuna: z.string().min(1),
  direccion: z.string().min(1),
  entrega: z.string().min(1),
  subsidio_ds19: z.boolean(),
  estacionamiento_uf: z.number().positive(),
  bodega_uf: z.number().positive(),
  horarios_visita: z.array(z.string().min(1)).min(1),
  politica_descuentos: z.string().min(1),
});

const rawCatalogSchema = z.object({
  proyecto: rawProjectSchema,
  unidades: z.array(rawUnitSchema).min(1),
});

const unitSchema = rawUnitSchema.transform(
  (unit): Unit => ({
    id: unit.id,
    typology: unit.tipologia,
    bedrooms: unit.dormitorios,
    bathrooms: unit.banos,
    squareMeters: unit.m2,
    priceUf: unit.precio_uf,
    floor: unit.piso,
    orientation: unit.orientacion,
    available: unit.disponible,
  }),
);

const projectSchema = rawProjectSchema.transform(
  (project): Project => ({
    name: project.nombre,
    commune: project.comuna,
    address: project.direccion,
    delivery: project.entrega,
    subsidizedDs19: project.subsidio_ds19,
    parkingPriceUf: project.estacionamiento_uf,
    storagePriceUf: project.bodega_uf,
    visitHours: project.horarios_visita,
    salePolicy: project.politica_descuentos,
  }),
);

const catalogSchema = rawCatalogSchema.transform(
  (catalog): Catalog => ({
    project: projectSchema.parse(catalog.proyecto),
    units: catalog.unidades.map((unit) => unitSchema.parse(unit)),
  }),
);

export const CATALOG_PATH = new URL("../../fixtures/catalogo.json", import.meta.url).pathname;

const CACHE_TTL_MS = 5 * 60 * 1000;

let cachedCatalog: Catalog | undefined;
let cachedAt = 0;

function readAndValidate(path: string): Catalog {
  return catalogSchema.parse(JSON.parse(readFileSync(path, "utf8")));
}

export function loadCatalog(path: string = CATALOG_PATH, now: number = Date.now()): Catalog {
  const isDefaultPath = path === CATALOG_PATH;
  if (isDefaultPath && cachedCatalog && now - cachedAt <= CACHE_TTL_MS) {
    return cachedCatalog;
  }
  const loaded = readAndValidate(path);
  if (isDefaultPath) {
    cachedCatalog = loaded;
    cachedAt = now;
  }
  return loaded;
}

export function reloadCatalog(): void {
  cachedCatalog = undefined;
  cachedAt = 0;
}

export function publicCatalog(): PublicCatalog {
  const { project, units } = loadCatalog();
  const { salePolicy: _confidential, ...publicProject } = project;
  return { project: publicProject, units };
}

export function availableUnits(): Unit[] {
  return loadCatalog().units.filter((unit) => unit.available);
}

export function unitById(id: string): Unit | undefined {
  return loadCatalog().units.find((unit) => unit.id === id);
}

export function knownPricesUf(): Set<number> {
  const unitPrices = availableUnits().map((unit) => unit.priceUf);
  const { parkingPriceUf, storagePriceUf } = loadCatalog().project;
  return new Set([...unitPrices, parkingPriceUf, storagePriceUf]);
}
