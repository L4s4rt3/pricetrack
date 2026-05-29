export function fmt(n: number): string {
  return n.toFixed(2);
}

export function fmtPct(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatKg(n: number): string {
  return (
    new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n) + " kg"
  );
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}

export function campaignLabel(c: number): string {
  return `${c}/${String((c + 1) % 100).padStart(2, "0")}`;
}

export const MONTHS = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic"
];

export const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

export const CAMPAIGN_MONTHS = [
  "Oct","Nov","Dic","Ene","Feb","Mar",
  "Abr","May","Jun","Jul","Ago","Sep"
];
