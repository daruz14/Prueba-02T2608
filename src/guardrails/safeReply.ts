import { availableUnits, loadCatalog } from "../domain/catalog.js";
import type { DerivationReason } from "./entry.js";

function closestAvailableUnit(): { id: string; bedrooms: number; priceUf: number } | undefined {
  const units = availableUnits();
  if (units.length === 0) return undefined;
  const [biggest] = [...units].sort((a, b) => b.bedrooms - a.bedrooms || a.priceUf - b.priceUf);
  return biggest;
}

export function handoffReply(): string {
  return "Por supuesto. Dejo este hilo con un ejecutivo del equipo para que te atienda personalmente.";
}

export function complaintReply(): string {
  return "Entiendo tu molestia y la tomo en serio. Derivo tu caso de inmediato con un ejecutivo del equipo, quien te contactará a la brevedad.";
}

export function discountReply(): string {
  return "Los valores y condiciones se conversan directamente con un ejecutivo del equipo. Dejo tu consulta para que te contacten.";
}

export function subsidyReply(): string {
  const project = loadCatalog().project;
  const eligibility = project.subsidizedDs19
    ? "El proyecto sí está habilitado para postular a subsidio DS19"
    : "El proyecto no está habilitado para postular a subsidio DS19";
  return `${eligibility}. Los requisitos y montos los evalúa un ejecutivo del equipo, así que dejo tu consulta con ellos.`;
}

export function personalDataReply(): string {
  return "No repito ni guardo datos personales como RUT o datos bancarios. Te recomiendo no enviarlos por este canal; dejo tu mensaje con un ejecutivo del equipo.";
}

export function outOfCatalogReply(): string {
  const alternative = closestAvailableUnit();
  if (!alternative) {
    return "En este proyecto no tenemos eso disponible. Dejo tu consulta con un ejecutivo del equipo.";
  }
  return `En este proyecto no contamos con eso. Lo más cercano que tenemos disponible es el ${alternative.id} de ${alternative.bedrooms} dormitorios en ${alternative.priceUf} UF. ¿Te cuento más?`;
}

export function genericSafeReply(): string {
  return "Gracias por tu mensaje. Para darte información correcta dejo este hilo con un ejecutivo del equipo, que te contactará a la brevedad.";
}

export function derivationReply(reason: DerivationReason): string {
  switch (reason) {
    case "complaint":
      return complaintReply();
    case "discount":
      return discountReply();
    case "subsidy":
      return subsidyReply();
    case "out_of_catalog":
      return outOfCatalogReply();
    case "personal_data":
      return personalDataReply();
    case "human_request":
      return handoffReply();
    default:
      return genericSafeReply();
  }
}
