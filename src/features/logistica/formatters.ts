import type { LogisticsPreset, TripFields } from "./types";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES")
    .trim();
}

function slug(value: string) {
  return normalize(value).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "manual";
}

export function firstLine(value: string) {
  return value.split(/\r?\n/).map((line) => line.trim()).find(Boolean) ?? "";
}

export function safeFilename(value: string) {
  return slug(value).replace(/-/g, "_");
}

export function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export function splitLines(value: string, max = 4) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

export function buildGoodsLine(trip: TripFields) {
  return trip.goodsLine || [trip.documento1, trip.bultos, trip.mercancia].filter(Boolean).join("   ");
}

export function routeDestination(preset: LogisticsPreset) {
  return [preset.delivery_place, preset.delivery_country].filter(Boolean).join(" - ");
}

export function routeMerchandiseDescription(trip: TripFields) {
  return trip.routeDescription || [trip.bultos, trip.mercancia].filter(Boolean).join(" ");
}
