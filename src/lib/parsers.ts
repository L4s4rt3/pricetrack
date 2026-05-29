import type { PrecioRow, LineClassification } from "./types";
import { MIN_CAMPAIGN_START } from "./campaigns";

const CLIENT_GROUP_RULES = [
  { label: "COFRULY S.A.", match: /\bCOFRULY\b/ },
];

function normalizeText(value: string): string {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getRawClientName(d: PrecioRow): string {
  const code = String(d.cliente || "").trim();
  const name = String(d.denominacion_social || "").trim();
  return name && name !== code ? name : "";
}

function normalizeClientText(value: string): string {
  return normalizeText(value)
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SOCIEDAD|ANONIMA|LIMITADA|SL|S L|SA|S A|SAS|SARL|BV|NV|LTD|GMBH|INC|CO|COMPANY|THE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getClientName(d: PrecioRow): string {
  const rawName = getRawClientName(d);
  if (!rawName) return "";
  const searchable = normalizeClientText(`${rawName} ${d.cliente || ""}`);
  const group = CLIENT_GROUP_RULES.find((rule) => rule.match.test(searchable));
  return group ? group.label : rawName;
}

export function getClientLabel(d: PrecioRow): string {
  return getClientName(d) || d.cliente || "—";
}

export function getClientSearchText(d: PrecioRow): string {
  return [getClientName(d), getRawClientName(d), d.denominacion_social, d.cliente]
    .filter(Boolean).join(" ");
}

export function isReadableProductName(value: string): boolean {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/PK\x03\x04|Content_Types|docProps|workbook|sharedStrings/i.test(text)) return false;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(text)) return false;
  const visible = [...text].filter((ch) => !/\s/.test(ch));
  if (visible.length < 8) return true;
  const bad = visible.filter(
    (ch) => !/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÇçÀÈÌÒÙàèìòù.,;:()\/+\-'ºª&%€#]/.test(ch)
  ).length;
  return bad / visible.length <= 0.18;
}

export function hasNamedClient(d: PrecioRow): boolean {
  return !!getRawClientName(d);
}

export function hasEconomicValue(d: PrecioRow): boolean {
  return [d.price, d.base_iva, d.kilos, d.unidades, d.litros].some(
    (v) => Math.abs(Number(v || 0)) > 0
  );
}

export function isMainOrangePriceRow(d: PrecioRow): boolean {
  if (!isReadableProductName(d.product) || !hasNamedClient(d) || !hasEconomicValue(d)) return false;
  const cls = getLineClassification(d);
  return cls.type === "Producto" && cls.product === "Naranja" && d.price > 0 && d.kilos > 0;
}

export function getCampaignStart(d: { year: number; month: number | null }): number {
  return d.month && d.month >= 10 ? d.year : d.year - 1;
}

export function sameCampaign(d: { year: number; month: number | null }, c: number): boolean {
  return getCampaignStart(d) === Number(c);
}

export function campaignMonthIndex(d: { month: number | null }): number {
  return d.month ? (d.month + 2) % 12 : 0;
}

export function isVisibleRow(d: PrecioRow): boolean {
  return getCampaignStart(d) >= MIN_CAMPAIGN_START && hasNamedClient(d) && isReadableProductName(d.product);
}

function firstMatch(text: string, rules: { re: RegExp; label: string }[], fallback = ""): string {
  const hit = rules.find((rule) => rule.re.test(text));
  return hit ? hit.label : fallback;
}

function extractCaliber(text: string): string {
  const match = text.match(/\bCAL\.?\s*([0-9]+(?:\s*[\/\-]\s*[0-9]+)?)/);
  if (!match) return "Sin calibre";
  return "Cal " + match[1].replace(/\s+/g, "");
}

function extractWeight(text: string): string {
  const pack = text.match(/\b([0-9]+)\s*X\s*([0-9]+(?:[,.][0-9]+)?)\s*KG\b/);
  if (pack) return pack[1] + " x " + pack[2].replace(",", ".") + " kg";
  const weight = text.match(/\b([0-9]+(?:[,.][0-9]+)?)\s*KG\b/);
  return weight ? weight[1].replace(",", ".") + " kg" : "";
}

function extractFormat(text: string): string {
  const presentation = firstMatch(text, [
    { re: /D\s*-?\s*PACK/, label: "D-Pack" },
    { re: /GIRSAC/, label: "Girsac" },
    { re: /GRAN(?:E|D)EL/, label: "Granel" },
    { re: /EMPAQUET|\bEMP\b/, label: "Empaquetado" },
    { re: /MALLA/, label: "Malla" },
    { re: /CLIP\s*TO\s*CLIP|\bC2C\b/, label: "Clip to clip" },
    { re: /BOX/, label: "Box" },
  ]);
  return presentation || "Sin formato";
}

function extractFormatDetail(text: string): string {
  const weight = extractWeight(text);
  const container = extractContainer(text);
  return [weight, container !== "Sin envase" ? container : ""].filter(Boolean).join(" · ");
}

function extractContainer(text: string): string {
  return firstMatch(text, [
    { re: /CARTON|CART\.?/, label: "Carton" },
    { re: /PLASTICO|PLAST\.?|PLAS\.?/, label: "Plastico" },
    { re: /MADERA|MAD\.?/, label: "Madera" },
    { re: /EUROPOOL/, label: "EuroPool" },
    { re: /IFCO/, label: "IFCO" },
    { re: /PALET|PALLET/, label: "Palet" },
  ], "Sin envase");
}

function extractQuality(text: string): string {
  return firstMatch(text, [
    { re: /CAT\s*\.?\s*II|CATII|CATEGORIA\s*II/, label: "Categoria II" },
    { re: /EXTRA/, label: "Extra" },
    { re: /PREMIUM/, label: "Premium" },
    { re: /BUENO/, label: "Bueno" },
    { re: /SEGUNDA|2A|2ª/, label: "Segunda" },
  ], "Categoria I / sin indicar");
}

function extractBrand(text: string): string {
  return firstMatch(text, [
    { re: /LASARTE/, label: "Lasarte" },
    { re: /BELLE\s+ANDALOUSE/, label: "Belle Andalouse" },
    { re: /PITUFO/, label: "Pitufo" },
    { re: /GENERIC[OA]/, label: "Generico" },
  ]);
}

export function getLineClassification(row: PrecioRow): LineClassification {
  const raw = row?.product || "";
  const text = normalizeText(raw);
  let type = "Producto";
  let product = "Otros productos";
  let variety = "Sin variedad";
  let citrusType = "Otros productos";

  if (/FIANZA|EUROPOOL MOD|PLASTICO IFCO/.test(text)) {
    type = "Fianza";
    product = "Envases";
    citrusType = "Envases";
    variety = text.includes("IFCO") ? "IFCO" : "EuroPool";
  } else if (/TRANSP|PORTE|PORTES/.test(text)) {
    type = "Transporte";
    product = "Logistica";
    citrusType = "Logistica";
    variety = text.includes("ENVASE") ? "Transporte envases" : "Transporte mercancia";
  } else if (/COMISI/.test(text)) {
    type = "Comision";
    product = "Servicios";
    citrusType = "Servicios";
    variety = "Comisiones";
  } else if (/SERVICIO|MANIPUL|TRIAGE|CONFECCION|CONFECC/.test(text)) {
    type = "Servicio";
    product = "Servicios";
    citrusType = "Servicios";
    variety = text.includes("MANIP") ? "Manipulacion" : "Confeccion";
  } else if (/CAJA CARTON|EUROPALET|PALET FRUTERO|CAJON CAMPO|PALLET|PALET/.test(text)) {
    type = "Envase";
    product = "Envases";
    citrusType = "Envases";
    variety = text.includes("PALET") || text.includes("PALLET") ? "Palet" : "Caja";
  } else if (/ABONO|DTO|DESCUENTO|DIFERENCIA|DIFERFENCIA|DEVOLUCION|\bDEV\b/.test(text)) {
    type = "Abono / ajuste";
  } else if (/VENTAS NARANJAS|VENTA NARANJA/.test(text)) {
    type = "Venta resumen";
    product = "Naranja";
    citrusType = "Naranja";
    variety = "Resumen";
  }

  if (type === "Producto" || type === "Abono / ajuste" || type === "Venta resumen") {
    if (/MAND|CLEMENTINA|ORRI|TANGO|NADORCOTT|NOVA|SATSUMA/.test(text)) product = "Mandarina";
    else if (/LIMON|\bLIM\b|VERNA|FINO/.test(text)) product = "Limon";
    else if (/POMELO|GRAPEFRUIT/.test(text)) product = "Pomelo";
    else if (/NAR|NAVEL|SALUSTIANA|VALENCIA|LANE|BARBERINA|CARACARA|BARNFIELD|NARANJA/.test(text)) product = "Naranja";
    citrusType = product;
    variety = firstMatch(text, [
      { re: /VALENCIA\s+MIDKNIGHT|MIDKNIGHT/, label: "Valencia Midknight" },
      { re: /VALENCIA\s+DELTA|\bDELTA\b/, label: "Valencia Delta" },
      { re: /VALENCIA\s+LATE/, label: "Valencia Late" },
      { re: /LANE\s+LATE|\bLANE\b/, label: "Lane Late" },
      { re: /NAVEL\s+POWELL|NAVEL\s+POWEL|\bPOWELL\b|\bPOWEL\b/, label: "Navel Powell" },
      { re: /NAVEL\s+CARACARA|CARA\s*CARA|CARACARA/, label: "Navel Caracara" },
      { re: /NAVELINA/, label: "Navelina" },
      { re: /SALUSTIANA/, label: "Salustiana" },
      { re: /BARBERINA/, label: "Barberina" },
      { re: /BARNFIELD/, label: "Barnfield" },
      { re: /\bNAVEL\b/, label: "Navel" },
      { re: /ORRI/, label: "Orri" },
      { re: /CLEMENTINA/, label: "Clementina" },
      { re: /TANGO/, label: "Tango" },
      { re: /NADORCOTT/, label: "Nadorcott" },
      { re: /NOVA/, label: "Nova" },
      { re: /SATSUMA/, label: "Satsuma" },
      { re: /VERNA/, label: "Verna" },
      { re: /FINO/, label: "Fino" },
    ], product === "Naranja" ? "Naranja generica" : product);
  }

  const caliber = extractCaliber(text);
  const quality = extractQuality(text);
  const format = extractFormat(text);
  const formatDetail = extractFormatDetail(text);
  const container = extractContainer(text);
  const brand = extractBrand(text);
  const subParts = [variety];
  if (caliber !== "Sin calibre") subParts.push(caliber);
  if (format !== "Sin formato") subParts.push(format);
  if (formatDetail) subParts.push(formatDetail);
  if (quality !== "Categoria I / sin indicar") subParts.push(quality);
  if (brand) subParts.push(brand);
  const subproduct = subParts.filter(Boolean).join(" · ");

  return { type, product, citrusType, variety, caliber, quality, format, formatDetail, packaging: format === "Sin formato" ? "" : format, container, brand, subproduct };
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export function avg(arr: number[]): number {
  const v = arr.filter((x) => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export function weightedPrice(rows: PrecioRow[]): number {
  let kg = 0;
  let value = 0;
  let priceSum = 0;
  let priceCount = 0;

  rows.forEach((row) => {
    if (row.price > 0) {
      priceSum += row.price;
      priceCount += 1;
    }
    if (row.kilos > 0 && (row.base_iva > 0 || row.price > 0)) {
      kg += row.kilos;
      value += row.base_iva > 0 ? row.base_iva : row.price * row.kilos;
    }
  });

  if (!kg) return priceCount ? priceSum / priceCount : 0;
  return value / kg;
}
