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
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { KPICard } from "@/components/KPICard";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { readPersistentQuery, removePersistentQuery, writePersistentQuery } from "@/lib/persistentQueryCache";

interface LogisticsPreset {
  id?: string;
  preset_key: string;
  name: string;
  sender: string;
  consignee: string;
  carrier: string;
  load_place: string;
  load_country: string;
  delivery_place: string;
  delivery_country: string;
  default_goods: string;
  default_instructions: string;
  source_files?: string[];
}

interface LogisticsTemplateRow {
  kind: "route" | "cmr";
  name: string;
  original_path: string | null;
  storage_path: string;
}

interface CmrClient {
  client_key: string;
  name: string;
  consignee: string;
  transitario: string;
  country: string;
  default_goods: string;
  is_edeka: boolean;
  occurrences: number;
}

interface CmrCarrier {
  carrier_key: string;
  name: string;
  details: string;
  country: string;
  occurrences: number;
}

interface TripFields {
  numeroCarta: string;
  fechaCarga: string;
  fechaDescarga: string;
  horaCarga: string;
  horaDescarga: string;
  instructions: string;
  successiveCarriers: string;
  carrierReservations: string;
  documents: string;
  goodsLine: string;
  bultos: string;
  mercancia: string;
  peso: string;
  volume: string;
  specialAgreements: string;
  tractora: string;
  remolque: string;
  conductor: string;
  documento1: string;
  documento2: string;
  observaciones: string;
}

type DocumentKind = "route" | "cmr";

const today = new Date().toISOString().slice(0, 10);
const presetsQueryKey = ["logistics-presets"] as const;
const templatesQueryKey = ["logistics-templates-for-presets"] as const;
const cmrClientsQueryKey = ["cmr-clients"] as const;
const cmrCarriersQueryKey = ["cmr-carriers"] as const;

const CMR_TEMPLATE_PATH = "/templates/plantilla-cmr.pdf";
const CMR_COMPANY = "Lasarte Cítricos S.L.\nCIF: B14800304\nCtra. Madrid-Cádiz, km 461\n41400";

const emptyPreset: LogisticsPreset = {
  preset_key: "manual",
  name: "Cliente manual",
  sender: CMR_COMPANY,
  consignee: "",
  carrier: "",
  load_place: "ECIJA",
  load_country: "ESPANA",
  delivery_place: "",
  delivery_country: "",
  default_goods: "PALETS DE NARANJAS",
  default_instructions: "MERCANCIA PREENFRIADA\nTEMPERATURA 5 C",
  source_files: [],
};

const emptyTrip: TripFields = {
  numeroCarta: "",
  fechaCarga: today,
  fechaDescarga: today,
  horaCarga: "",
  horaDescarga: "",
  instructions: "",
  successiveCarriers: "",
  carrierReservations: "",
  documents: "",
  goodsLine: "",
  bultos: "",
  mercancia: emptyPreset.default_goods,
  peso: "",
  volume: "",
  specialAgreements: "",
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

function escapeXml(value?: string) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeHtml(value?: string) {
  return escapeXml(value).replace(/\n/g, "<br />");
}

function safeFilename(value: string) {
  return slug(value).replace(/-/g, "_");
}

function formatDate(value: string) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.valueOf())) return value;
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

function describeLoadError(label: string, error: unknown) {
  if (!error) return "";
  if (typeof error === "object" && "message" in error) {
    return `${label}: ${String((error as { message?: unknown }).message)}`;
  }
  return `${label}: ${String(error)}`;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function splitLines(value: string, max = 4) {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, max);
}

function buildGoodsLine(trip: TripFields) {
  return trip.goodsLine || [trip.documento1, trip.bultos, trip.mercancia].filter(Boolean).join("   ");
}

async function generateExactCmrPdf(preset: LogisticsPreset, trip: TripFields) {
  const templateBytes = await fetch(CMR_TEMPLATE_PATH).then((response) => {
    if (!response.ok) throw new Error("No se pudo cargar la plantilla CMR vacia.");
    return response.arrayBuffer();
  });

  const pdfDoc = await PDFDocument.load(templateBytes);
  const form = pdfDoc.getForm();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const date = formatDate(trip.fechaCarga);
  const successive = splitLines(trip.successiveCarriers, 4);

  const values: Record<string, string> = {
    "001": CMR_COMPANY,
    NumCarta: trip.numeroCarta,
    "002": preset.consignee,
    "003_1": "ECIJA",
    "003_2": "ESPAÑA",
    "003_3": date,
    "004_1": preset.delivery_place ? `TRANSITARIO: ${preset.delivery_place}` : "",
    "004_2": preset.delivery_country,
    "005": trip.instructions,
    "006": preset.carrier,
    "007_1": successive[0] ?? "",
    "007_2": successive[1] ?? "",
    "007_3": successive[2] ?? "",
    "007_4": successive[3] ?? "",
    "008_01": trip.carrierReservations,
    "008_02": "",
    "009": trip.documents || [trip.documento1, trip.documento2].filter(Boolean).join("\n"),
    "010_01": buildGoodsLine(trip),
    "014_01": trip.peso,
    "015_01": trip.volume,
    "016": trip.specialAgreements,
    "021_01": "ECIJA",
    "021_02": date,
    "021_03": "",
    "022": CMR_COMPANY,
    "023": preset.carrier,
    TRACTORA: trip.tractora,
    REMOLQUE: trip.remolque,
  };

  for (const [name, value] of Object.entries(values)) {
    try {
      form.getTextField(name).setText(value ?? "");
    } catch {
      // Historic and blank templates do not always expose every optional field.
    }
  }

  form.updateFieldAppearances(font);
  form.flatten();
  return pdfDoc.save();
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

function worksheetXml(kind: DocumentKind, preset: LogisticsPreset, trip: TripFields) {
  const rows =
    kind === "route"
      ? [
          ["HOJA DE RUTA", ""],
          ["Cliente", preset.name],
          ["Destinatario", preset.consignee],
          ["Transportista", preset.carrier],
          ["Conductor", trip.conductor],
          ["Origen", `${preset.load_place} - ${preset.load_country}`],
          ["Destino", `${preset.delivery_place} - ${preset.delivery_country}`],
          ["Fecha carga", `${formatDate(trip.fechaCarga)} ${trip.horaCarga}`],
          ["Fecha descarga", `${formatDate(trip.fechaDescarga)} ${trip.horaDescarga}`],
          ["Tractora", trip.tractora],
          ["Remolque", trip.remolque],
          ["Bultos", trip.bultos],
          ["Mercancia", trip.mercancia],
          ["Peso kg", trip.peso],
          ["Documentos", [trip.documento1, trip.documento2].filter(Boolean).join(" / ")],
          ["Observaciones", trip.observaciones],
        ]
      : [
          ["CARTA DE PORTE CMR", ""],
          ["N. CMR", trip.numeroCarta],
          ["Expedidor", preset.sender],
          ["Destinatario", preset.consignee],
          ["Lugar carga", preset.load_place],
          ["Pais carga", preset.load_country],
          ["Fecha carga", formatDate(trip.fechaCarga)],
          ["Lugar entrega", preset.delivery_place],
          ["Pais entrega", preset.delivery_country],
          ["Transportista", preset.carrier],
          ["Conductor", trip.conductor],
          ["Tractora", trip.tractora],
          ["Remolque", trip.remolque],
          ["Bultos", trip.bultos],
          ["Mercancia", trip.mercancia],
          ["Peso kg", trip.peso],
          ["Documentos", [trip.documento1, trip.documento2].filter(Boolean).join(" / ")],
          ["Instrucciones", trip.observaciones],
        ];

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet">
  <Styles>
    <Style ss:ID="Title"><Font ss:Bold="1" ss:Size="16"/><Interior ss:Color="#E5E7EB" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Label"><Font ss:Bold="1"/><Interior ss:Color="#F9FAFB" ss:Pattern="Solid"/></Style>
    <Style ss:ID="Text"><Alignment ss:WrapText="1" ss:Vertical="Top"/></Style>
  </Styles>
  <Worksheet ss:Name="${kind === "route" ? "Hoja de ruta" : "CMR"}">
    <Table>
      <Column ss:Width="150"/>
      <Column ss:Width="430"/>
      ${rows
        .map((row, index) => `<Row ss:Height="${index === 0 ? 28 : 42}">
        <Cell ss:StyleID="${index === 0 ? "Title" : "Label"}"><Data ss:Type="String">${escapeXml(row[0])}</Data></Cell>
        <Cell ss:StyleID="Text"><Data ss:Type="String">${escapeXml(row[1])}</Data></Cell>
      </Row>`)
        .join("")}
    </Table>
  </Worksheet>
</Workbook>`;
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

export default function Logistica() {
  const [presets, setPresets] = useState<LogisticsPreset[]>([]);
  const [templates, setTemplates] = useState<LogisticsTemplateRow[]>([]);
  const [clients, setClients] = useState<CmrClient[]>([]);
  const [carriers, setCarriers] = useState<CmrCarrier[]>([]);
  const [documentMode, setDocumentMode] = useState<DocumentKind>("cmr");
  const [clientQuery, setClientQuery] = useState("");
  const [carrierQuery, setCarrierQuery] = useState("");
  const [selectedClientKey, setSelectedClientKey] = useState("");
  const [selectedCarrierKey, setSelectedCarrierKey] = useState("");
  const [selectedPresetKey, setSelectedPresetKey] = useState(emptyPreset.preset_key);
  const [fixed, setFixed] = useState<LogisticsPreset>(emptyPreset);
  const [trip, setTrip] = useState<TripFields>(emptyTrip);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
        const cachedClients = await readPersistentQuery<CmrClient[]>(cmrClientsQueryKey);
        const cachedCarriers = await readPersistentQuery<CmrCarrier[]>(cmrCarriersQueryKey);
        if (cachedPresets) setPresets(cachedPresets.data);
        if (cachedTemplates) setTemplates(cachedTemplates.data);
        if (cachedClients?.data?.length && cachedCarriers?.data?.length) {
          setClients(cachedClients.data);
          setCarriers(cachedCarriers.data);
          return;
        }
      } else {
        await removePersistentQuery(presetsQueryKey);
        await removePersistentQuery(templatesQueryKey);
        await removePersistentQuery(cmrClientsQueryKey);
        await removePersistentQuery(cmrCarriersQueryKey);
      }

      const [clientResult, carrierResult] = await Promise.all([
        supabase
          .from("cmr_clients")
          .select("client_key,name,consignee,transitario,country,default_goods,is_edeka,occurrences")
          .order("occurrences", { ascending: false }),
        supabase
          .from("cmr_carriers")
          .select("carrier_key,name,details,country,occurrences")
          .order("occurrences", { ascending: false }),
      ]);

      const blockingErrors = [
        describeLoadError("Clientes CMR", clientResult.error),
        describeLoadError("Transportistas CMR", carrierResult.error),
      ].filter(Boolean);

      if (blockingErrors.length > 0) {
        throw new Error(blockingErrors.join(" | "));
      }

      const loadedClients = (clientResult.data ?? []) as CmrClient[];
      const loadedCarriers = (carrierResult.data ?? []) as CmrCarrier[];
      if (loadedClients.length === 0 || loadedCarriers.length === 0) {
        throw new Error(`Supabase no devolvio datos de logistica: ${loadedClients.length} clientes y ${loadedCarriers.length} transportistas.`);
      }
      setClients(loadedClients);
      setCarriers(loadedCarriers);
      void writePersistentQuery(cmrClientsQueryKey, loadedClients);
      void writePersistentQuery(cmrCarriersQueryKey, loadedCarriers);
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
    }));
  }, [selectedClient]);

  useEffect(() => {
    if (!selectedCarrier) return;
    setFixed((current) => ({
      ...current,
      carrier: selectedCarrier.details,
    }));
  }, [selectedCarrier]);

  const updateFixed = (key: keyof LogisticsPreset, value: string) => {
    setFixed((current) => ({ ...current, [key]: value }));
  };

  const updateTrip = (key: keyof TripFields, value: string) => {
    setTrip((current) => ({ ...current, [key]: value }));
  };

  const clearSelectedClient = () => {
    setSelectedClientKey("");
    setClientQuery("");
    setFixed((current) => ({
      ...current,
      name: "",
      consignee: "",
      delivery_place: "",
      delivery_country: "",
      default_goods: "",
    }));
  };

  const clearSelectedCarrier = () => {
    setSelectedCarrierKey("");
    setCarrierQuery("");
    setFixed((current) => ({
      ...current,
      carrier: "",
    }));
  };

  const printDocument = (kind: DocumentKind) => {
    const title = kind === "route" ? `Hoja de ruta - ${fixed.name}` : `CMR - ${fixed.name}`;
    printHtml(title, kind === "route" ? renderRouteHtml(fixed, trip) : renderCmrHtml(fixed, trip));
  };

  const exportExactCmrPdf = async () => {
    try {
      const pdfBytes = await generateExactCmrPdf(fixed, trip);
      downloadBlob(
        new Blob([pdfBytes], { type: "application/pdf" }),
        `cmr_${safeFilename(fixed.name)}_${Date.now()}.pdf`,
      );
    } catch (exportError) {
      toast.error(exportError instanceof Error ? exportError.message : "No se pudo generar el CMR.");
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
  const activeTripFields = documentMode === "cmr" ? tripFields : routeTripFields;

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
                  onChange={(event) => setClientQuery(event.target.value)}
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
                      setSelectedClientKey(client.client_key);
                      setClientQuery(client.name);
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
                  onChange={(event) => setCarrierQuery(event.target.value)}
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
                      setSelectedCarrierKey(carrier.carrier_key);
                      setCarrierQuery(carrier.name);
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
              <Card className="glass-accented">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Route className="h-4 w-4 text-primary" />
                    Informacion que cambia
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    {activeTripFields.map(([key, label, type]) => (
                      <div key={key}>
                        <Label htmlFor={key} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {label}
                        </Label>
                        <Input
                          id={key}
                          type={type}
                          value={trip[key]}
                          onChange={(event) => updateTrip(key, event.target.value)}
                          className="glass-field"
                        />
                      </div>
                    ))}
                    <div className="md:col-span-2">
                      <TextAreaField
                        id="observaciones"
                        label="Observaciones internas"
                        value={trip.observaciones}
                        onChange={(value) => updateTrip("observaciones", value)}
                      />
                    </div>
                    {documentMode === "cmr" && (
                      <>
                        <div className="md:col-span-2">
                          <TextAreaField
                            id="successiveCarriers"
                            label="Cuadro 7. Successive carriers"
                            value={trip.successiveCarriers}
                            onChange={(value) => updateTrip("successiveCarriers", value)}
                            rows={3}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <TextAreaField
                            id="carrierReservations"
                            label="Cuadro 8. Carrier reservations"
                            value={trip.carrierReservations}
                            onChange={(value) => updateTrip("carrierReservations", value)}
                            rows={3}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <TextAreaField
                            id="specialAgreements"
                            label="Cuadro 16. Special agreements"
                            value={trip.specialAgreements}
                            onChange={(value) => updateTrip("specialAgreements", value)}
                            rows={4}
                          />
                        </div>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
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
                        <Button onClick={() => printDocument("route")}>
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
