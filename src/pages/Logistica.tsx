import { useEffect, useMemo, useState } from "react";
import {
  Clipboard,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  Printer,
  RefreshCw,
  Route,
  Save,
  Search,
  Truck,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { FALLBACK_CARRIER_SEEDS, FALLBACK_CLIENT_SEEDS } from "@/lib/logisticsFallback";
import { readPersistentQuery, removePersistentQuery, writePersistentQuery } from "@/lib/persistentQueryCache";
import type { CmrCarrier, CmrClient, DocumentKind, LogisticsPreset, LogisticsTemplateRow, TripFields } from "@/features/logistica/types";
import { firstLine, formatDate, safeFilename } from "@/features/logistica/formatters";
import { generateExactCmrPdf, generateExactRoutePdf } from "@/features/logistica/pdfExporters";
import { worksheetXml } from "@/features/logistica/excelExporters";

const today = new Date().toISOString().slice(0, 10);
const logisticsDirectoryCacheVersion = "split-directories-v2";
const presetsQueryKey = ["logistics-presets", logisticsDirectoryCacheVersion] as const;
const templatesQueryKey = ["logistics-templates-for-presets", logisticsDirectoryCacheVersion] as const;
const cmrClientsQueryKey = ["cmr-clients", logisticsDirectoryCacheVersion] as const;
const cmrCarriersQueryKey = ["cmr-carriers", logisticsDirectoryCacheVersion] as const;
const routeClientsQueryKey = ["route-clients", logisticsDirectoryCacheVersion] as const;
const routeCarriersQueryKey = ["route-carriers", logisticsDirectoryCacheVersion] as const;

const CMR_COMPANY = "Lasarte Cítricos S.L.\nCIF: B14800304\nCtra. Madrid-Cádiz, km 461\n41400";

const emptyPreset: LogisticsPreset = {
  preset_key: "manual",
  name: "Cliente manual",
  sender: CMR_COMPANY,
  consignee: "",
  carrier: "",
  load_place: "ECIJA",
  load_country: "ESPAÑA",
  delivery_place: "",
  delivery_country: "",
  default_goods: "PALETS DE NARANJAS",
  default_instructions: "MERCANCIA PREENFRIADA\nTEMPERATURA 5 C",
  source_files: [],
};

const manualClientFallback: CmrClient = {
  client_key: "manual",
  name: "Cliente manual",
  consignee: "",
  transitario: "",
  country: "",
  default_goods: emptyPreset.default_goods,
  is_edeka: false,
  occurrences: 1,
};

const manualCarrierFallback: CmrCarrier = {
  carrier_key: "manual",
  name: "Transportista manual",
  details: "",
  country: "",
  occurrences: 1,
};

const emptyTrip: TripFields = {
  numeroCarta: "",
  fechaCarga: today,
  fechaDescarga: today,
  horaCarga: "",
  horaDescarga: "",
  routeOperator: "",
  routeCarrierName: "",
  vehiclePlate: "",
  routeDescription: "",
  instructions: "",
  successiveCarriersEnabled: false,
  successiveCarriers: "",
  carrierReservations: "",
  documents: "",
  goodsLine: "",
  bultos: "",
  mercancia: emptyPreset.default_goods,
  peso: "",
  volume: "",
  specialAgreements: "",
  usefulParticulars17: "",
  nonContractual18: "",
  cashOnDelivery19: "",
  consigneeReceipt24: "",
  tractora: "",
  remolque: "",
  conductor: "",
  documento1: "",
  documento2: "",
  observaciones: emptyPreset.default_instructions,
};

const fixedFields = [
  ["name", "Cliente"],
  ["sender", "Expedidor"],
  ["consignee", "Destinatario"],
  ["carrier", "Transportista habitual"],
  ["load_place", "Lugar carga"],
  ["load_country", "Pais carga"],
  ["delivery_place", "Lugar entrega"],
  ["delivery_country", "Pais entrega"],
  ["default_goods", "Mercancia habitual"],
  ["default_instructions", "Instrucciones habituales"],
] as const;

const tripFields = [
  ["numeroCarta", "N. CMR", "text"],
  ["fechaCarga", "Fecha carga", "date"],
  ["fechaDescarga", "Fecha descarga", "date"],
  ["horaCarga", "Hora carga", "time"],
  ["horaDescarga", "Hora descarga", "time"],
  ["instructions", "Cuadro 5. Instrucciones", "text"],
  ["documents", "Cuadro 9. Documentos entregados", "text"],
  ["goodsLine", "Cuadros 10-13. Linea mercancia", "text"],
  ["bultos", "Bultos / palets", "text"],
  ["mercancia", "Mercancia", "text"],
  ["peso", "Peso kg", "text"],
  ["volume", "Volumen m3", "text"],
  ["tractora", "Tractora", "text"],
  ["remolque", "Remolque", "text"],
  ["conductor", "Conductor", "text"],
  ["documento1", "Documento 1", "text"],
  ["documento2", "Documento 2", "text"],
] as const;

const routeTripFields = [
  ["fechaCarga", "Fecha carga", "date"],
  ["horaCarga", "Hora carga", "time"],
  ["fechaDescarga", "Fecha descarga", "date"],
  ["horaDescarga", "Hora descarga", "time"],
  ["bultos", "Bultos / palets", "text"],
  ["mercancia", "Mercancia", "text"],
  ["peso", "Peso kg", "text"],
  ["tractora", "Tractora", "text"],
  ["remolque", "Remolque", "text"],
  ["conductor", "Conductor", "text"],
  ["documento1", "Documento 1", "text"],
  ["documento2", "Documento 2", "text"],
] as const;

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

function cleanName(value: string) {
  return value
    .replace(/^CMR[-_\s]*/i, "")
    .replace(/\.(pdf|xls|xlsx)$/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTemplateName(value: string) {
  const clean = cleanName(value);
  const parts = clean.split(/\s+-\s+|-|_/).map((part) => part.trim()).filter(Boolean);
  return {
    client: parts[0] || clean,
    carrier: parts.slice(1).join(" - "),
  };
}

function presetFromTemplate(template: LogisticsTemplateRow): LogisticsPreset {
  const parsed = splitTemplateName(template.name);
  const key = `${template.kind}-${slug(parsed.client)}-${slug(parsed.carrier || "sin-transportista")}`;
  return {
    ...emptyPreset,
    preset_key: key,
    name: parsed.client,
    carrier: parsed.carrier,
    source_files: [template.original_path ?? template.storage_path],
  };
}

function preferFilled(current: string, next: string) {
  const cleanNext = next.trim();
  if (!cleanNext) return current;
  return cleanNext.length > current.length ? cleanNext : current;
}

function buildCmrClientsFromPresets(presets: LogisticsPreset[]): CmrClient[] {
  const clients = new Map<string, CmrClient>();
  for (const preset of presets) {
    const name = cleanName(preset.name || firstLine(preset.consignee));
    const consignee = preset.consignee.trim();
    if (!name && !consignee) continue;

    const clientKey = slug(name || firstLine(consignee));
    const current = clients.get(clientKey);
    if (!current) {
      clients.set(clientKey, {
        client_key: clientKey,
        name: name || firstLine(consignee) || "Cliente sin nombre",
        consignee,
        transitario: preset.delivery_place.trim(),
        country: preset.delivery_country.trim(),
        default_goods: preset.default_goods.trim(),
        is_edeka: normalize(`${name} ${consignee}`).includes("edeka"),
        occurrences: 1,
      });
      continue;
    }

    current.occurrences += 1;
    current.consignee = preferFilled(current.consignee, consignee);
    current.transitario = preferFilled(current.transitario, preset.delivery_place);
    current.country = preferFilled(current.country, preset.delivery_country);
    current.default_goods = preferFilled(current.default_goods, preset.default_goods);
    current.is_edeka = current.is_edeka || normalize(`${name} ${consignee}`).includes("edeka");
  }

  return Array.from(clients.values()).sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name, "es"));
}

function buildCmrCarriersFromPresets(presets: LogisticsPreset[]): CmrCarrier[] {
  const carriers = new Map<string, CmrCarrier>();
  for (const preset of presets) {
    const details = preset.carrier.trim();
    if (!details) continue;

    const name = cleanName(firstLine(details));
    const carrierKey = slug(name || details);
    const current = carriers.get(carrierKey);
    if (!current) {
      carriers.set(carrierKey, {
        carrier_key: carrierKey,
        name: name || "Transportista sin nombre",
        details,
        country: "",
        occurrences: 1,
      });
      continue;
    }

    current.occurrences += 1;
    current.details = preferFilled(current.details, details);
  }

  return Array.from(carriers.values()).sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name, "es"));
}

function buildCmrClientsFromTemplates(templates: LogisticsTemplateRow[]): CmrClient[] {
  const clients = new Map<string, CmrClient>();
  for (const template of templates) {
    const parsed = splitTemplateName(template.name);
    const name = cleanName(parsed.client);
    if (!name) continue;

    const clientKey = slug(name);
    const current = clients.get(clientKey);
    if (!current) {
      clients.set(clientKey, {
        client_key: clientKey,
        name,
        consignee: "",
        transitario: "",
        country: "",
        default_goods: emptyPreset.default_goods,
        is_edeka: normalize(name).includes("edeka"),
        occurrences: 1,
      });
      continue;
    }

    current.occurrences += 1;
    current.is_edeka = current.is_edeka || normalize(name).includes("edeka");
  }

  return Array.from(clients.values()).sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name, "es"));
}

function buildCmrCarriersFromTemplates(templates: LogisticsTemplateRow[]): CmrCarrier[] {
  const carriers = new Map<string, CmrCarrier>();
  for (const template of templates) {
    const parsed = splitTemplateName(template.name);
    const name = cleanName(parsed.carrier);
    if (!name) continue;

    const carrierKey = slug(name);
    const current = carriers.get(carrierKey);
    if (!current) {
      carriers.set(carrierKey, {
        carrier_key: carrierKey,
        name,
        details: name,
        country: "",
        occurrences: 1,
      });
      continue;
    }

    current.occurrences += 1;
  }

  return Array.from(carriers.values()).sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name, "es"));
}

function buildFallbackClients(): CmrClient[] {
  return FALLBACK_CLIENT_SEEDS.map((seed) => ({
    client_key: `seed-${slug(seed.name)}`,
    name: seed.name,
    consignee: "",
    transitario: "",
    country: "",
    default_goods: emptyPreset.default_goods,
    is_edeka: normalize(seed.name).includes("edeka"),
    occurrences: seed.occurrences,
  }));
}

function buildFallbackCarriers(): CmrCarrier[] {
  return FALLBACK_CARRIER_SEEDS.map((seed) => ({
    carrier_key: `seed-${slug(seed.name)}`,
    name: seed.name,
    details: seed.name,
    country: "",
    occurrences: seed.occurrences,
  }));
}

function escapeHtml(value?: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "<br />");
}

function describeLoadError(label: string, error: unknown) {
  if (!error) return "";
  if (typeof error === "object" && "message" in error) {
    return `${label}: ${String((error as { message?: unknown }).message)}`;
  }
  return `${label}: ${String(error)}`;
}

function isMissingLogisticsTable(error: unknown) {
  if (!error || typeof error !== "object") return false;
  const candidate = error as { code?: string; message?: string };
  return (
    candidate.code === "42P01" ||
    candidate.code === "PGRST205" ||
    /schema cache|could not find the table|does not exist/i.test(candidate.message ?? "")
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function printHtml(title: string, body: string) {
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    toast.error("El navegador ha bloqueado la ventana de impresion.");
    return;
  }

  printWindow.document.write(`<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    @page { size: A4; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Arial, Helvetica, sans-serif; color: #111827; background: #fff; }
    .page { width: 190mm; min-height: 277mm; margin: 0 auto; padding: 0; }
    .doc-title { display: flex; justify-content: space-between; align-items: start; gap: 12px; border-bottom: 2px solid #111827; padding-bottom: 8px; margin-bottom: 10px; }
    h1 { margin: 0; font-size: 24px; letter-spacing: 0; }
    h2 { margin: 0 0 6px; font-size: 12px; text-transform: uppercase; }
    .muted { color: #4b5563; font-size: 10px; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px; }
    .box { border: 1px solid #111827; min-height: 28mm; padding: 6px; font-size: 12px; white-space: normal; }
    .box.small { min-height: 14mm; }
    .box.tall { min-height: 40mm; }
    .value { white-space: pre-wrap; line-height: 1.25; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    th, td { border: 1px solid #111827; padding: 5px; vertical-align: top; }
    th { background: #f3f4f6; text-align: left; font-size: 10px; text-transform: uppercase; }
    .signatures { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-top: 12px; }
    .signature { border: 1px solid #111827; min-height: 34mm; padding: 6px; font-size: 11px; }
    .route-header { display: grid; grid-template-columns: 1.2fr .8fr; gap: 10px; }
    .route-summary { margin: 10px 0; }
    .route-summary td:first-child { width: 34%; font-weight: 700; background: #f9fafb; }
    @media print { .page { margin: 0; } }
  </style>
</head>
<body>${body}<script>window.onload = () => { window.focus(); window.print(); };</script></body>
</html>`);
  printWindow.document.close();
}

function renderRouteHtml(preset: LogisticsPreset, trip: TripFields) {
  return `<main class="page">
    <section class="doc-title">
      <div>
        <h1>HOJA DE RUTA</h1>
        <div class="muted">Documento interno de transporte</div>
      </div>
      <div class="muted">Fecha carga: ${escapeHtml(formatDate(trip.fechaCarga))}</div>
    </section>

    <section class="route-header">
      <div class="box">
        <h2>Cliente / destino</h2>
        <div class="value">${escapeHtml(preset.name)}</div>
        <div class="value">${escapeHtml(preset.consignee)}</div>
      </div>
      <div class="box">
        <h2>Transportista</h2>
        <div class="value">${escapeHtml(preset.carrier)}</div>
        <div class="value">${escapeHtml(trip.conductor)}</div>
      </div>
    </section>

    <table class="route-summary">
      <tr><td>Origen</td><td>${escapeHtml(preset.load_place)} - ${escapeHtml(preset.load_country)}</td></tr>
      <tr><td>Destino</td><td>${escapeHtml(preset.delivery_place)} - ${escapeHtml(preset.delivery_country)}</td></tr>
      <tr><td>Fecha / hora carga</td><td>${escapeHtml(formatDate(trip.fechaCarga))} ${escapeHtml(trip.horaCarga)}</td></tr>
      <tr><td>Fecha / hora descarga</td><td>${escapeHtml(formatDate(trip.fechaDescarga))} ${escapeHtml(trip.horaDescarga)}</td></tr>
      <tr><td>Tractora / remolque</td><td>${escapeHtml(trip.tractora)} / ${escapeHtml(trip.remolque)}</td></tr>
      <tr><td>Mercancia</td><td>${escapeHtml([trip.bultos, trip.mercancia].filter(Boolean).join(" "))}</td></tr>
      <tr><td>Peso</td><td>${escapeHtml(trip.peso)}</td></tr>
      <tr><td>Documentos</td><td>${escapeHtml([trip.documento1, trip.documento2].filter(Boolean).join(" / "))}</td></tr>
    </table>

    <div class="box tall">
      <h2>Observaciones</h2>
      <div class="value">${escapeHtml(trip.observaciones)}</div>
    </div>

    <section class="signatures">
      <div class="signature">Firma expedidor</div>
      <div class="signature">Firma transportista</div>
      <div class="signature">Firma receptor</div>
    </section>
  </main>`;
}

function renderCmrHtml(preset: LogisticsPreset, trip: TripFields) {
  return `<main class="page">
    <section class="doc-title">
      <div>
        <h1>CARTA DE PORTE CMR</h1>
        <div class="muted">Convention relative au contrat de transport international de marchandises par route</div>
      </div>
      <div>
        <div class="muted">N. CMR</div>
        <strong>${escapeHtml(trip.numeroCarta)}</strong>
      </div>
    </section>

    <section class="grid">
      <div class="box">
        <h2>1. Expedidor / Sender</h2>
        <div class="value">${escapeHtml(preset.sender)}</div>
      </div>
      <div class="box">
        <h2>2. Destinatario / Consignee</h2>
        <div class="value">${escapeHtml(preset.consignee)}</div>
      </div>
    </section>

    <section class="grid-3" style="margin-top: 8px;">
      <div class="box small"><h2>3. Lugar carga</h2>${escapeHtml(preset.load_place)}</div>
      <div class="box small"><h2>Pais</h2>${escapeHtml(preset.load_country)}</div>
      <div class="box small"><h2>Fecha</h2>${escapeHtml(formatDate(trip.fechaCarga))}</div>
    </section>

    <section class="grid" style="margin-top: 8px;">
      <div class="box small"><h2>4. Lugar entrega</h2>${escapeHtml(preset.delivery_place)}</div>
      <div class="box small"><h2>Pais entrega</h2>${escapeHtml(preset.delivery_country)}</div>
    </section>

    <section class="grid" style="margin-top: 8px;">
      <div class="box">
        <h2>16. Transportista / Carrier</h2>
        <div class="value">${escapeHtml(preset.carrier)}</div>
        <div class="value">${escapeHtml(trip.conductor)}</div>
      </div>
      <div class="box">
        <h2>Matriculas</h2>
        <div>Tractora: ${escapeHtml(trip.tractora)}</div>
        <div>Remolque: ${escapeHtml(trip.remolque)}</div>
      </div>
    </section>

    <table style="margin-top: 8px;">
      <thead>
        <tr>
          <th>Marcas y numeros</th>
          <th>Numero de bultos</th>
          <th>Naturaleza de la mercancia</th>
          <th>Peso bruto kg</th>
        </tr>
      </thead>
      <tbody>
        <tr style="height: 32mm;">
          <td>${escapeHtml([trip.documento1, trip.documento2].filter(Boolean).join(" / "))}</td>
          <td>${escapeHtml(trip.bultos)}</td>
          <td>${escapeHtml(trip.mercancia)}</td>
          <td>${escapeHtml(trip.peso)}</td>
        </tr>
      </tbody>
    </table>

    <div class="box tall" style="margin-top: 8px;">
      <h2>Instrucciones del expedidor</h2>
      <div class="value">${escapeHtml(trip.observaciones)}</div>
    </div>

    <section class="signatures">
      <div class="signature">21. Establecido en ${escapeHtml(preset.load_place)}<br />Fecha ${escapeHtml(formatDate(trip.fechaCarga))}</div>
      <div class="signature">22. Firma y sello del expedidor</div>
      <div class="signature">23. Firma y sello del transportista</div>
    </section>
  </main>`;
}

function PresetPicker({
  presets,
  selectedKey,
  onSelect,
}: {
  presets: LogisticsPreset[];
  selectedKey: string;
  onSelect: (preset: LogisticsPreset) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = normalize(query);
    return presets
      .filter((preset) => !needle || normalize(`${preset.name} ${preset.consignee} ${preset.carrier} ${preset.delivery_place}`).includes(needle))
      .slice(0, 120);
  }, [presets, query]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="glass-field pl-9"
          placeholder="Buscar cliente, destino o transportista..."
        />
      </div>
      <div className="max-h-[31rem] space-y-2 overflow-y-auto pr-1">
        {filtered.map((preset) => {
          const selected = preset.preset_key === selectedKey;
          return (
            <button
              key={preset.preset_key}
              type="button"
              onClick={() => onSelect(preset)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                selected
                  ? "border-primary/50 bg-primary/10 shadow-[var(--glass-shadow)]"
                  : "border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] hover:border-[hsl(var(--glass-border-accent))] hover:bg-[hsl(var(--glass-bg-strong))]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{preset.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{preset.delivery_place || preset.consignee || "Sin destino fijo"}</p>
                </div>
                <Badge variant="outline">{preset.carrier ? "ficha" : "cliente"}</Badge>
              </div>
              {preset.carrier && <p className="mt-2 truncate text-xs text-muted-foreground">{preset.carrier}</p>}
            </button>
          );
        })}
        {!filtered.length && <div className="empty-state py-8">No hay fichas con ese filtro.</div>}
      </div>
    </div>
  );
}

function TextAreaField({
  id,
  label,
  value,
  onChange,
  rows = 4,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  rows?: number;
}) {
  return (
    <div>
      <Label htmlFor={id} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </Label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={(event) => onChange(event.target.value)}
        className="glass-field flex w-full rounded-md border border-[hsl(var(--glass-border))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--glass-border-accent))] focus:ring-2 focus:ring-primary/20"
      />
    </div>
  );
}

function InlineCellInput({
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  return (
    <Input
      type={type}
      value={value}
      readOnly={readOnly}
      onChange={(event) => onChange?.(event.target.value)}
      className={`glass-field h-9 ${readOnly ? "opacity-80" : ""}`}
    />
  );
}

function InlineCellTextArea({
  value,
  onChange,
  readOnly = false,
  rows = 3,
}: {
  value: string;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      readOnly={readOnly}
      rows={rows}
      onChange={(event) => onChange?.(event.target.value)}
      className={`glass-field flex min-h-20 w-full rounded-md border border-[hsl(var(--glass-border))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--glass-border-accent))] focus:ring-2 focus:ring-primary/20 ${readOnly ? "opacity-80" : ""}`}
    />
  );
}

function CmrEntryTable({
  fixed,
  trip,
  updateFixed,
  updateTrip,
  setSuccessiveCarriersEnabled,
}: {
  fixed: LogisticsPreset;
  trip: TripFields;
  updateFixed: (key: keyof LogisticsPreset, value: string) => void;
  updateTrip: (key: keyof TripFields, value: string) => void;
  setSuccessiveCarriersEnabled: (enabled: boolean) => void;
}) {
  return (
    <Card className="glass-accented">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="h-4 w-4 text-primary" />
          Tabla de CMR
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="data-table-shell overflow-hidden rounded-[8px]">
          <div className="table-scroll overflow-x-auto">
            <table className="data-table w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left text-sm">
              <thead className="table-head text-[10px] uppercase tracking-normal text-muted-foreground">
                <tr>
                  <th className="w-24 px-4 py-3">Cuadro</th>
                  <th className="w-56 px-4 py-3">Dato</th>
                  <th className="w-32 px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">1 / 22</td>
                  <td className="px-4 py-3">Expedidor Lasarte</td>
                  <td className="px-4 py-3"><Badge variant="outline">Fijo</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={CMR_COMPANY} readOnly rows={4} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">2</td>
                  <td className="px-4 py-3">Destinatario</td>
                  <td className="px-4 py-3"><Badge>Cliente</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={fixed.consignee} onChange={(value) => updateFixed("consignee", value)} rows={4} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">3 / 21</td>
                  <td className="px-4 py-3">Carga en Ecija</td>
                  <td className="px-4 py-3"><Badge variant="outline">Fecha manual</Badge></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-[1fr_1fr_10rem]">
                      <InlineCellInput value="ECIJA" readOnly />
                      <InlineCellInput value="ESPAÑA" readOnly />
                      <InlineCellInput type="date" value={trip.fechaCarga} onChange={(value) => updateTrip("fechaCarga", value)} />
                    </div>
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">4</td>
                  <td className="px-4 py-3">Entrega / transitario</td>
                  <td className="px-4 py-3"><Badge>Cliente</Badge></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-[1fr_12rem]">
                      <InlineCellInput value={fixed.delivery_place} onChange={(value) => updateFixed("delivery_place", value)} />
                      <InlineCellInput value={fixed.delivery_country} onChange={(value) => updateFixed("delivery_country", value)} />
                    </div>
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">5</td>
                  <td className="px-4 py-3">Instrucciones</td>
                  <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                  <td className="px-4 py-3"><InlineCellInput value={trip.instructions} onChange={(value) => updateTrip("instructions", value)} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">6 / 23</td>
                  <td className="px-4 py-3">Carrier</td>
                  <td className="px-4 py-3"><Badge>Transportista</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={fixed.carrier} onChange={(value) => updateFixed("carrier", value)} rows={4} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">7</td>
                  <td className="px-4 py-3">Successive carriers</td>
                  <td className="px-4 py-3">
                    <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <input
                        type="checkbox"
                        checked={trip.successiveCarriersEnabled}
                        onChange={(event) => setSuccessiveCarriersEnabled(event.target.checked)}
                        className="h-4 w-4 accent-[hsl(var(--primary))]"
                      />
                      Hay
                    </label>
                  </td>
                  <td className="px-4 py-3">
                    {trip.successiveCarriersEnabled ? (
                      <InlineCellTextArea value={trip.successiveCarriers} onChange={(value) => updateTrip("successiveCarriers", value)} rows={3} />
                    ) : (
                      <span className="text-sm text-muted-foreground">No aplica</span>
                    )}
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">8</td>
                  <td className="px-4 py-3">Reservas del carrier</td>
                  <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={trip.carrierReservations} onChange={(value) => updateTrip("carrierReservations", value)} rows={3} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">9</td>
                  <td className="px-4 py-3">Documentos entregados</td>
                  <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                  <td className="px-4 py-3"><InlineCellInput value={trip.documents} onChange={(value) => updateTrip("documents", value)} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">10-13</td>
                  <td className="px-4 py-3">Linea de mercancia</td>
                  <td className="px-4 py-3"><Badge>Manual</Badge></td>
                  <td className="px-4 py-3"><InlineCellInput value={trip.goodsLine} onChange={(value) => updateTrip("goodsLine", value)} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">14 / 15</td>
                  <td className="px-4 py-3">Peso y volumen</td>
                  <td className="px-4 py-3"><Badge>Manual</Badge></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-2">
                      <InlineCellInput value={trip.peso} onChange={(value) => updateTrip("peso", value)} />
                      <InlineCellInput value={trip.volume} onChange={(value) => updateTrip("volume", value)} />
                    </div>
                  </td>
                </tr>
                {[
                  ["16", "Acuerdos especiales", "specialAgreements"],
                  ["17", "Otras indicaciones utiles", "usefulParticulars17"],
                  ["18", "Parte no contractual", "nonContractual18"],
                  ["19", "Reembolso", "cashOnDelivery19"],
                  ["24", "Recepcion destinatario", "consigneeReceipt24"],
                ].map(([box, label, key]) => (
                  <tr key={box} className="table-row">
                    <td className="px-4 py-3 font-semibold">{box}</td>
                    <td className="px-4 py-3">{label}</td>
                    <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                    <td className="px-4 py-3"><InlineCellInput value={String(trip[key as keyof TripFields] ?? "")} onChange={(value) => updateTrip(key as keyof TripFields, value)} /></td>
                  </tr>
                ))}
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">20</td>
                  <td className="px-4 py-3">Convenio CMR</td>
                  <td className="px-4 py-3"><Badge variant="outline">Fijo</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Texto fijo impreso en la plantilla.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function RouteEntryTable({
  fixed,
  trip,
  updateFixed,
  updateTrip,
}: {
  fixed: LogisticsPreset;
  trip: TripFields;
  updateFixed: (key: keyof LogisticsPreset, value: string) => void;
  updateTrip: (key: keyof TripFields, value: string) => void;
}) {
  return (
    <Card className="glass-accented">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Route className="h-4 w-4 text-primary" />
          Tabla de hoja de ruta
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="data-table-shell overflow-hidden rounded-[8px]">
          <div className="table-scroll overflow-x-auto">
            <table className="data-table w-full min-w-[900px] table-fixed border-separate border-spacing-0 text-left text-sm">
              <thead className="table-head text-[10px] uppercase tracking-normal text-muted-foreground">
                <tr>
                  <th className="w-52 px-4 py-3">Bloque</th>
                  <th className="w-56 px-4 py-3">Dato</th>
                  <th className="w-32 px-4 py-3">Tipo</th>
                  <th className="px-4 py-3">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Empresa cargadora</td>
                  <td className="px-4 py-3">Lasarte</td>
                  <td className="px-4 py-3"><Badge variant="outline">Fijo</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={CMR_COMPANY} readOnly rows={4} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Operador de transporte</td>
                  <td className="px-4 py-3">Operador</td>
                  <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                  <td className="px-4 py-3"><InlineCellInput value={trip.routeOperator} onChange={(value) => updateTrip("routeOperator", value)} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Nombre transportista</td>
                  <td className="px-4 py-3">Transportista seleccionado</td>
                  <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={trip.routeCarrierName} onChange={(value) => updateTrip("routeCarrierName", value)} rows={3} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Destinatario</td>
                  <td className="px-4 py-3">Cliente y datos</td>
                  <td className="px-4 py-3"><Badge>Cliente</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={fixed.consignee} onChange={(value) => updateFixed("consignee", value)} rows={4} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Matricula del vehiculo</td>
                  <td className="px-4 py-3">Matricula / tractora / remolque</td>
                  <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-3">
                      <InlineCellInput value={trip.vehiclePlate} onChange={(value) => updateTrip("vehiclePlate", value)} />
                      <InlineCellInput value={trip.tractora} onChange={(value) => updateTrip("tractora", value)} />
                      <InlineCellInput value={trip.remolque} onChange={(value) => updateTrip("remolque", value)} />
                    </div>
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Datos expedicion</td>
                  <td className="px-4 py-3">Origen y destino</td>
                  <td className="px-4 py-3"><Badge>Cliente</Badge></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-[9rem_1fr_12rem]">
                      <InlineCellInput value="ECIJA" readOnly />
                      <InlineCellInput value={fixed.delivery_place} onChange={(value) => updateFixed("delivery_place", value)} />
                      <InlineCellInput value={fixed.delivery_country} onChange={(value) => updateFixed("delivery_country", value)} />
                    </div>
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Mercancia</td>
                  <td className="px-4 py-3">Fechas</td>
                  <td className="px-4 py-3"><Badge>Selector</Badge></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-4">
                      <InlineCellInput type="date" value={trip.fechaCarga} onChange={(value) => updateTrip("fechaCarga", value)} />
                      <InlineCellInput type="time" value={trip.horaCarga} onChange={(value) => updateTrip("horaCarga", value)} />
                      <InlineCellInput type="date" value={trip.fechaDescarga} onChange={(value) => updateTrip("fechaDescarga", value)} />
                      <InlineCellInput type="time" value={trip.horaDescarga} onChange={(value) => updateTrip("horaDescarga", value)} />
                    </div>
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Descripcion</td>
                  <td className="px-4 py-3">Mercancia y kg</td>
                  <td className="px-4 py-3"><Badge>Manual</Badge></td>
                  <td className="px-4 py-3">
                    <div className="grid gap-2 md:grid-cols-[1fr_10rem]">
                      <InlineCellTextArea value={trip.routeDescription} onChange={(value) => updateTrip("routeDescription", value)} rows={3} />
                      <InlineCellInput value={trip.peso} onChange={(value) => updateTrip("peso", value)} />
                    </div>
                  </td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Observaciones</td>
                  <td className="px-4 py-3">Texto libre</td>
                  <td className="px-4 py-3"><Badge variant="outline">Opcional</Badge></td>
                  <td className="px-4 py-3"><InlineCellTextArea value={trip.observaciones} onChange={(value) => updateTrip("observaciones", value)} rows={3} /></td>
                </tr>
                <tr className="table-row">
                  <td className="px-4 py-3 font-semibold">Firmas</td>
                  <td className="px-4 py-3">Cargador / transportista / destinatario</td>
                  <td className="px-4 py-3"><Badge variant="outline">Fijo</Badge></td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">Se imprimen como huecos de firma en la plantilla.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Logistica() {
  const [presets, setPresets] = useState<LogisticsPreset[]>([]);
  const [templates, setTemplates] = useState<LogisticsTemplateRow[]>([]);
  const [cmrClients, setCmrClients] = useState<CmrClient[]>([]);
  const [cmrCarriers, setCmrCarriers] = useState<CmrCarrier[]>([]);
  const [routeClients, setRouteClients] = useState<CmrClient[]>([]);
  const [routeCarriers, setRouteCarriers] = useState<CmrCarrier[]>([]);
  const [documentMode, setDocumentMode] = useState<DocumentKind>("cmr");
  const [clientQueries, setClientQueries] = useState<Record<DocumentKind, string>>({ cmr: "", route: "" });
  const [carrierQueries, setCarrierQueries] = useState<Record<DocumentKind, string>>({ cmr: "", route: "" });
  const [selectedClientKeys, setSelectedClientKeys] = useState<Record<DocumentKind, string>>({ cmr: "", route: "" });
  const [selectedCarrierKeys, setSelectedCarrierKeys] = useState<Record<DocumentKind, string>>({ cmr: "", route: "" });
  const [selectedPresetKey, setSelectedPresetKey] = useState(emptyPreset.preset_key);
  const [fixed, setFixed] = useState<LogisticsPreset>(emptyPreset);
  const [trip, setTrip] = useState<TripFields>(emptyTrip);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const clients = documentMode === "cmr" ? cmrClients : routeClients;
  const carriers = documentMode === "cmr" ? cmrCarriers : routeCarriers;
  const clientQuery = clientQueries[documentMode];
  const carrierQuery = carrierQueries[documentMode];
  const selectedClientKey = selectedClientKeys[documentMode];
  const selectedCarrierKey = selectedCarrierKeys[documentMode];
  const setCurrentClientQuery = (value: string) =>
    setClientQueries((current) => ({ ...current, [documentMode]: value }));
  const setCurrentCarrierQuery = (value: string) =>
    setCarrierQueries((current) => ({ ...current, [documentMode]: value }));
  const setCurrentSelectedClientKey = (value: string) =>
    setSelectedClientKeys((current) => ({ ...current, [documentMode]: value }));
  const setCurrentSelectedCarrierKey = (value: string) =>
    setSelectedCarrierKeys((current) => ({ ...current, [documentMode]: value }));

  const derivedPresets = useMemo(() => {
    const map = new Map<string, LogisticsPreset>();
    for (const preset of presets) map.set(preset.preset_key, preset);
    for (const template of templates) {
      const fallback = presetFromTemplate(template);
      if (!map.has(fallback.preset_key)) map.set(fallback.preset_key, fallback);
    }
    return [emptyPreset, ...Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "es", { numeric: true }))];
  }, [presets, templates]);

  const selectedPreset = useMemo(
    () => derivedPresets.find((preset) => preset.preset_key === selectedPresetKey) ?? emptyPreset,
    [derivedPresets, selectedPresetKey],
  );

  const filteredClients = useMemo(() => {
    const needle = normalize(clientQuery);
    return clients
      .filter((client) => !needle || normalize(`${client.name} ${client.consignee} ${client.transitario} ${client.country}`).includes(needle))
      .slice(0, 80);
  }, [clientQuery, clients]);

  const filteredCarriers = useMemo(() => {
    const needle = normalize(carrierQuery);
    return carriers
      .filter((carrier) => !needle || normalize(`${carrier.name} ${carrier.details} ${carrier.country}`).includes(needle))
      .slice(0, 80);
  }, [carrierQuery, carriers]);

  const selectedClient = useMemo(
    () => clients.find((client) => client.client_key === selectedClientKey),
    [clients, selectedClientKey],
  );

  const selectedCarrier = useMemo(
    () => carriers.find((carrier) => carrier.carrier_key === selectedCarrierKey),
    [carriers, selectedCarrierKey],
  );

  const loadData = async ({ force = false } = {}) => {
    setLoading(true);
    setError("");
    try {
      if (!force) {
        const cachedPresets = await readPersistentQuery<LogisticsPreset[]>(presetsQueryKey);
        const cachedTemplates = await readPersistentQuery<LogisticsTemplateRow[]>(templatesQueryKey);
        const cachedCmrClients = await readPersistentQuery<CmrClient[]>(cmrClientsQueryKey);
        const cachedCmrCarriers = await readPersistentQuery<CmrCarrier[]>(cmrCarriersQueryKey);
        const cachedRouteClients = await readPersistentQuery<CmrClient[]>(routeClientsQueryKey);
        const cachedRouteCarriers = await readPersistentQuery<CmrCarrier[]>(routeCarriersQueryKey);
        if (cachedPresets) setPresets(cachedPresets.data);
        if (cachedTemplates) setTemplates(cachedTemplates.data);
        if (
          cachedCmrClients?.data?.length &&
          cachedCmrCarriers?.data?.length &&
          cachedRouteClients?.data?.length &&
          cachedRouteCarriers?.data?.length
        ) {
          setCmrClients(cachedCmrClients.data);
          setCmrCarriers(cachedCmrCarriers.data);
          setRouteClients(cachedRouteClients.data);
          setRouteCarriers(cachedRouteCarriers.data);
          return;
        }
      } else {
        await removePersistentQuery(presetsQueryKey);
        await removePersistentQuery(templatesQueryKey);
        await removePersistentQuery(cmrClientsQueryKey);
        await removePersistentQuery(cmrCarriersQueryKey);
        await removePersistentQuery(routeClientsQueryKey);
        await removePersistentQuery(routeCarriersQueryKey);
      }

      const [clientResult, carrierResult, routeClientResult, routeCarrierResult, templateResult] = await Promise.all([
        supabase
          .from("cmr_clients")
          .select("client_key,name,consignee,transitario,country,default_goods,is_edeka,occurrences")
          .order("occurrences", { ascending: false }),
        supabase
          .from("cmr_carriers")
          .select("carrier_key,name,details,country,occurrences")
          .order("occurrences", { ascending: false }),
        supabase
          .from("route_clients")
          .select("client_key,name,consignee,transitario,country,default_goods,is_edeka,occurrences")
          .order("occurrences", { ascending: false }),
        supabase
          .from("route_carriers")
          .select("carrier_key,name,details,country,occurrences")
          .order("occurrences", { ascending: false }),
        supabase
          .from("logistics_templates")
          .select("kind,name,original_path,storage_path")
          .order("name", { ascending: true })
          .range(0, 4999),
      ]);

      const blockingErrors = [
        describeLoadError("Clientes CMR", clientResult.error),
        describeLoadError("Transportistas CMR", carrierResult.error),
      ].filter(Boolean);

      if (blockingErrors.length > 0) {
        throw new Error(blockingErrors.join(" | "));
      }

      const fallbackErrors: string[] = [];
      let loadedCmrClients = (clientResult.data ?? []) as CmrClient[];
      let loadedCmrCarriers = (carrierResult.data ?? []) as CmrCarrier[];
      let loadedRouteClients = routeClientResult.error ? [] : ((routeClientResult.data ?? []) as CmrClient[]);
      let loadedRouteCarriers = routeCarrierResult.error ? [] : ((routeCarrierResult.data ?? []) as CmrCarrier[]);

      if (routeClientResult.error && !isMissingLogisticsTable(routeClientResult.error)) {
        fallbackErrors.push(`Clientes hoja de ruta: ${routeClientResult.error.message}`);
      }
      if (routeCarrierResult.error && !isMissingLogisticsTable(routeCarrierResult.error)) {
        fallbackErrors.push(`Transportistas hoja de ruta: ${routeCarrierResult.error.message}`);
      }

      if (templateResult.error) {
        fallbackErrors.push(`Plantillas: ${templateResult.error.message}`);
      } else {
        const loadedTemplates = (templateResult.data ?? []) as LogisticsTemplateRow[];
        const cmrTemplates = loadedTemplates.filter((template) => template.kind === "cmr");
        const routeTemplates = loadedTemplates.filter((template) => template.kind === "route");

        if (loadedTemplates.length > 0) {
          setTemplates(loadedTemplates);
          void writePersistentQuery(templatesQueryKey, loadedTemplates);
        }

        if (loadedCmrClients.length === 0 && cmrTemplates.length > 0) {
          loadedCmrClients = buildCmrClientsFromTemplates(cmrTemplates);
        }
        if (loadedCmrCarriers.length === 0 && cmrTemplates.length > 0) {
          loadedCmrCarriers = buildCmrCarriersFromTemplates(cmrTemplates);
        }
        if (loadedRouteClients.length === 0 && routeTemplates.length > 0) {
          loadedRouteClients = buildCmrClientsFromTemplates(routeTemplates);
        }
        if (loadedRouteCarriers.length === 0 && routeTemplates.length > 0) {
          loadedRouteCarriers = buildCmrCarriersFromTemplates(routeTemplates);
        }
      }

      if (loadedCmrClients.length === 0 || loadedCmrCarriers.length === 0) {
        const presetResult = await supabase
          .from("logistics_presets")
          .select("preset_key,name,sender,consignee,carrier,load_place,load_country,delivery_place,delivery_country,default_goods,default_instructions,source_files")
          .order("name", { ascending: true })
          .range(0, 4999);

        if (presetResult.error) {
          fallbackErrors.push(`Fichas antiguas: ${presetResult.error.message}`);
        } else {
          const fallbackPresets = (presetResult.data ?? []) as LogisticsPreset[];
          if (fallbackPresets.length > 0) {
            setPresets(fallbackPresets);
            void writePersistentQuery(presetsQueryKey, fallbackPresets);
            if (loadedCmrClients.length === 0) loadedCmrClients = buildCmrClientsFromPresets(fallbackPresets);
            if (loadedCmrCarriers.length === 0) loadedCmrCarriers = buildCmrCarriersFromPresets(fallbackPresets);
          }
        }
      }

      if (loadedCmrClients.length === 0) loadedCmrClients = buildFallbackClients();
      if (loadedCmrCarriers.length === 0) loadedCmrCarriers = buildFallbackCarriers();
      if (loadedCmrClients.length === 0) loadedCmrClients = [manualClientFallback];
      if (loadedCmrCarriers.length === 0) loadedCmrCarriers = [manualCarrierFallback];
      if (loadedRouteClients.length === 0) loadedRouteClients = [{ ...manualClientFallback, client_key: "route-manual" }];
      if (loadedRouteCarriers.length === 0) loadedRouteCarriers = [{ ...manualCarrierFallback, carrier_key: "route-manual" }];

      if (fallbackErrors.length > 0) {
        toast.warning(`Logistica cargada con datos de respaldo. ${fallbackErrors.join(" | ")}`);
      }

      setCmrClients(loadedCmrClients);
      setCmrCarriers(loadedCmrCarriers);
      setRouteClients(loadedRouteClients);
      setRouteCarriers(loadedRouteCarriers);
      void writePersistentQuery(cmrClientsQueryKey, loadedCmrClients);
      void writePersistentQuery(cmrCarriersQueryKey, loadedCmrCarriers);
      void writePersistentQuery(routeClientsQueryKey, loadedRouteClients);
      void writePersistentQuery(routeCarriersQueryKey, loadedRouteCarriers);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "No se pudieron cargar las fichas de logistica.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  useEffect(() => {
    setFixed(selectedPreset);
    setTrip((current) => ({
      ...current,
      mercancia: selectedPreset.default_goods || current.mercancia,
      observaciones: selectedPreset.default_instructions || current.observaciones,
    }));
  }, [selectedPreset]);

  useEffect(() => {
    if (!selectedClient) return;
    setFixed((current) => ({
      ...current,
      name: selectedClient.name,
      consignee: selectedClient.consignee,
      delivery_place: selectedClient.transitario,
      delivery_country: selectedClient.country,
      default_goods: selectedClient.default_goods || current.default_goods,
    }));
    setTrip((current) => ({
      ...current,
      goodsLine: current.goodsLine || selectedClient.default_goods,
      mercancia: selectedClient.default_goods || current.mercancia,
      routeDescription: current.routeDescription || selectedClient.default_goods,
    }));
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedCarrier) return;
    setFixed((current) => ({
      ...current,
      carrier: selectedCarrier.details,
    }));
    setTrip((current) => ({
      ...current,
      routeCarrierName: current.routeCarrierName || selectedCarrier.details,
    }));
  }, [selectedCarrier]);

  useEffect(() => {
    if (!selectedClientKey) {
      setFixed((current) => ({
        ...current,
        name: "",
        consignee: "",
        delivery_place: "",
        delivery_country: "",
      }));
      setTrip((current) => ({ ...current, routeDescription: "" }));
    }
    if (!selectedCarrierKey) {
      setFixed((current) => ({ ...current, carrier: "" }));
      setTrip((current) => ({ ...current, routeCarrierName: "" }));
    }
  }, [documentMode, selectedClientKey, selectedCarrierKey]);

  const updateFixed = (key: keyof LogisticsPreset, value: string) => {
    setFixed((current) => ({ ...current, [key]: value }));
  };

  const updateTrip = (key: keyof TripFields, value: string) => {
    setTrip((current) => ({ ...current, [key]: value }));
  };

  const clearSelectedClient = () => {
    setCurrentSelectedClientKey("");
    setCurrentClientQuery("");
    setFixed((current) => ({
      ...current,
      name: "",
      consignee: "",
      delivery_place: "",
      delivery_country: "",
      default_goods: "",
    }));
    setTrip((current) => ({
      ...current,
      routeDescription: "",
    }));
  };

  const clearSelectedCarrier = () => {
    setCurrentSelectedCarrierKey("");
    setCurrentCarrierQuery("");
    setFixed((current) => ({
      ...current,
      carrier: "",
    }));
    setTrip((current) => ({
      ...current,
      routeCarrierName: "",
    }));
  };

  const printDocument = (kind: DocumentKind) => {
    const title = kind === "route" ? `Hoja de ruta - ${fixed.name}` : `CMR - ${fixed.name}`;
    printHtml(title, kind === "route" ? renderRouteHtml(fixed, trip) : renderCmrHtml(fixed, trip));
  };

  const exportExactCmrPdf = async () => {
    try {
      const pdfBytes = await generateExactCmrPdf(fixed, trip, CMR_COMPANY);
      downloadBlob(
        new Blob([pdfBytes], { type: "application/pdf" }),
        `cmr_${safeFilename(fixed.name)}_${Date.now()}.pdf`,
      );
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "No se pudo generar el CMR.");
    }
  };

  const exportExactRoutePdf = async () => {
    try {
      const pdfBytes = await generateExactRoutePdf(fixed, trip);
      downloadBlob(
        new Blob([pdfBytes], { type: "application/pdf" }),
        `hoja_ruta_${safeFilename(fixed.name)}_${Date.now()}.pdf`,
      );
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "No se pudo generar la hoja de ruta.");
    }
  };

  const exportExcel = (kind: DocumentKind) => {
    const xml = worksheetXml(kind, fixed, trip);
    const filename = `${kind === "route" ? "hoja_ruta" : "cmr"}_${safeFilename(fixed.name)}_${Date.now()}.xls`;
    downloadBlob(new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" }), filename);
  };

  const copySummary = async () => {
    await navigator.clipboard.writeText(
      [
        `Cliente: ${fixed.name}`,
        `Destino: ${fixed.delivery_place} ${fixed.delivery_country}`,
        `Fecha carga: ${trip.fechaCarga}`,
        `Mercancia: ${trip.bultos} ${trip.mercancia}`,
        `Peso: ${trip.peso}`,
        `Tractora/remolque: ${trip.tractora} / ${trip.remolque}`,
      ].join("\n"),
    );
    toast.success("Resumen copiado");
  };

  const saveLocalPreset = () => {
    const key = `manual-${slug(fixed.name)}-${slug(fixed.carrier || fixed.delivery_place || "general")}`;
    const next = { ...fixed, preset_key: key };
    const updated = [next, ...presets.filter((preset) => preset.preset_key !== key)];
    setPresets(updated);
    setSelectedPresetKey(key);
    void writePersistentQuery(presetsQueryKey, updated);
    toast.success("Ficha guardada en este dispositivo");
  };

  const documentTitle = documentMode === "cmr" ? "CMR" : "Hoja de Ruta";

  return (
    <div className="page-shell">
      <PageHeader
        title="Logistica"
        subtitle="Crea CMR y hojas de ruta desde datos reutilizables"
      >
        <Button variant="outline" onClick={() => loadData({ force: true })} disabled={loading}>
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Recargar
        </Button>
      </PageHeader>

      <section className="metric-strip">
        <KPICard label="Clientes" value={String(clients.length)} hint="Destinatarios extraidos de CMR" icon={Clipboard} />
        <KPICard label="Transportistas" value={String(carriers.length)} hint="Carriers reutilizables" icon={Truck} />
        <KPICard label="CMR" value="PDF" hint="Plantilla oficial rellenable" icon={FileText} />
        <KPICard label="Hojas de Ruta" value="PDF / Excel" hint="Documento interno" icon={FileSpreadsheet} />
      </section>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs value={documentMode} onValueChange={(value) => setDocumentMode(value as DocumentKind)} className="space-y-4">
        <TabsList className="glass-strong">
          <TabsTrigger value="cmr">CMR</TabsTrigger>
          <TabsTrigger value="route">Hojas de Ruta</TabsTrigger>
        </TabsList>

      <div className="grid gap-4 xl:grid-cols-[minmax(20rem,25rem),1fr]">
        <Card className="glass-accented">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              {documentMode === "cmr" ? <FileText className="h-4 w-4 text-primary" /> : <Route className="h-4 w-4 text-primary" />}
              {documentTitle}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-3">
              <div className="flex min-h-9 items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {documentMode === "cmr" ? "Destinatario" : "Cliente / destino"}
                </Label>
                {(selectedClientKey || clientQuery) && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelectedClient} className="h-8 px-2 text-xs">
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Quitar cliente
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={clientQuery}
                  onChange={(event) => setCurrentClientQuery(event.target.value)}
                  className="glass-field pl-9"
                  placeholder="Buscar cliente..."
                />
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredClients.map((client) => (
                  <button
                    key={client.client_key}
                    type="button"
                    onClick={() => {
                      setCurrentSelectedClientKey(client.client_key);
                      setCurrentClientQuery(client.name);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedClientKey === client.client_key
                        ? "border-primary/50 bg-primary/10 shadow-[var(--glass-shadow)]"
                        : "border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] hover:border-[hsl(var(--glass-border-accent))]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold">{client.name}</p>
                      <Badge variant={client.is_edeka ? "destructive" : "outline"}>{client.is_edeka ? "EDEKA" : client.occurrences}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{client.transitario || client.country || "Sin transitario"}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex min-h-9 items-center justify-between gap-2">
                <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {documentMode === "cmr" ? "Carrier" : "Transportista"}
                </Label>
                {(selectedCarrierKey || carrierQuery) && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearSelectedCarrier} className="h-8 px-2 text-xs">
                    <X className="mr-1.5 h-3.5 w-3.5" />
                    Quitar
                  </Button>
                )}
              </div>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={carrierQuery}
                  onChange={(event) => setCurrentCarrierQuery(event.target.value)}
                  className="glass-field pl-9"
                  placeholder="Buscar transportista..."
                />
              </div>
              <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredCarriers.map((carrier) => (
                  <button
                    key={carrier.carrier_key}
                    type="button"
                    onClick={() => {
                      setCurrentSelectedCarrierKey(carrier.carrier_key);
                      setCurrentCarrierQuery(carrier.name);
                    }}
                    className={`w-full rounded-lg border p-3 text-left transition ${
                      selectedCarrierKey === carrier.carrier_key
                        ? "border-primary/50 bg-primary/10 shadow-[var(--glass-shadow)]"
                        : "border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] hover:border-[hsl(var(--glass-border-accent))]"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="min-w-0 truncate text-sm font-semibold">{carrier.name}</p>
                      <Badge variant="outline">{carrier.occurrences}</Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-muted-foreground">{carrier.country || "Sin pais detectado"}</p>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Tabs defaultValue="fixed" className="space-y-4">
            <TabsList className="glass-strong">
              <TabsTrigger value="fixed">Ficha</TabsTrigger>
              <TabsTrigger value="trip">{documentMode === "cmr" ? "Datos CMR" : "Datos ruta"}</TabsTrigger>
              <TabsTrigger value="export">Exportar</TabsTrigger>
            </TabsList>

            <TabsContent value="fixed">
              <Card className="glass-accented">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clipboard className="h-4 w-4 text-primary" />
                    Ficha del cliente
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {fixedFields.map(([key, label]) =>
                      key === "sender" || key === "consignee" || key === "default_instructions" ? (
                        <div key={key} className="md:col-span-2">
                          <TextAreaField
                            id={key}
                            label={label}
                            value={String(fixed[key] ?? "")}
                            onChange={(value) => updateFixed(key, value)}
                            rows={key === "default_instructions" ? 3 : 4}
                          />
                        </div>
                      ) : (
                        <div key={key}>
                          <Label htmlFor={key} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {label}
                          </Label>
                          <Input id={key} value={String(fixed[key] ?? "")} onChange={(event) => updateFixed(key, event.target.value)} className="glass-field" />
                        </div>
                      ),
                    )}
                  </div>
                  <Button variant="outline" onClick={saveLocalPreset}>
                    <Save className="mr-2 h-4 w-4" />
                    Guardar ficha local
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="trip">
              {documentMode === "cmr" ? (
                <CmrEntryTable
                  fixed={fixed}
                  trip={trip}
                  updateFixed={updateFixed}
                  updateTrip={updateTrip}
                  setSuccessiveCarriersEnabled={(enabled) =>
                    setTrip((current) => ({
                      ...current,
                      successiveCarriersEnabled: enabled,
                      successiveCarriers: enabled ? current.successiveCarriers : "",
                    }))
                  }
                />
              ) : (
                <RouteEntryTable fixed={fixed} trip={trip} updateFixed={updateFixed} updateTrip={updateTrip} />
              )}
            </TabsContent>

            <TabsContent value="export">
              <Card className="glass-accented">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Printer className="h-4 w-4 text-primary" />
                    Documentos
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-4">
                    <h3 className="text-sm font-semibold">Resumen</h3>
                    <dl className="mt-3 grid gap-2 text-sm md:grid-cols-2">
                      <div><dt className="text-xs uppercase text-muted-foreground">Cliente</dt><dd>{fixed.name || "-"}</dd></div>
                      <div><dt className="text-xs uppercase text-muted-foreground">Destino</dt><dd>{fixed.delivery_place || "-"}</dd></div>
                      <div><dt className="text-xs uppercase text-muted-foreground">Fecha</dt><dd>{formatDate(trip.fechaCarga) || "-"}</dd></div>
                      <div><dt className="text-xs uppercase text-muted-foreground">Mercancia</dt><dd>{[trip.bultos, trip.mercancia].filter(Boolean).join(" ") || "-"}</dd></div>
                      <div><dt className="text-xs uppercase text-muted-foreground">Peso</dt><dd>{trip.peso || "-"}</dd></div>
                      <div><dt className="text-xs uppercase text-muted-foreground">Vehiculo</dt><dd>{[trip.tractora, trip.remolque].filter(Boolean).join(" / ") || "-"}</dd></div>
                    </dl>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {documentMode === "route" ? (
                      <>
                        <Button onClick={exportExactRoutePdf}>
                          <Printer className="mr-2 h-4 w-4" />
                          Hoja de ruta PDF
                        </Button>
                        <Button variant="outline" onClick={() => exportExcel("route")}>
                          <Download className="mr-2 h-4 w-4" />
                          Hoja de ruta Excel
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button onClick={exportExactCmrPdf}>
                          <Printer className="mr-2 h-4 w-4" />
                          CMR PDF
                        </Button>
                        <Button variant="outline" onClick={() => exportExcel("cmr")}>
                          <Download className="mr-2 h-4 w-4" />
                          CMR Excel
                        </Button>
                      </>
                    )}
                  </div>

                  <Button variant="outline" onClick={copySummary}>
                    <Clipboard className="mr-2 h-4 w-4" />
                    Copiar resumen
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
      </Tabs>
    </div>
  );
}
