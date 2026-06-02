import { useEffect, useMemo, useState } from "react";
import {
  Boxes,
  CalendarDays,
  Clipboard,
  Copy,
  Download,
  FileText,
  Loader2,
  RefreshCw,
  Route,
  Search,
  Truck,
} from "lucide-react";
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

type TemplateKind = "route" | "cmr";
type GenerateAction = "route-pdf" | "route-xlsx" | "cmr";
type RouteOutputFormat = "pdf" | "xlsx";

interface LogisticsTemplate {
  id: string;
  kind: TemplateKind;
  name: string;
  storage_path: string;
  original_path: string | null;
  extension: string;
  source_updated_at: string | null;
  updated_at: string;
}

type LogisticsFields = Record<string, string>;

const logisticsTemplatesQueryKey = ["logistics-templates"] as const;

interface FieldConfig {
  key: string;
  label: string;
  type?: string;
  area?: boolean;
  placeholder?: string;
}

const today = new Date().toISOString().slice(0, 10);

const baseFields: LogisticsFields = {
  fechaCarga: today,
  fechaDescarga: today,
  origen: "ECIJA",
  paisOrigen: "ESPAÑA",
  destino: "",
  paisDestino: "",
  mercancia: "PALETS DE NARANJAS",
  peso: "",
  tractora: "",
  remolque: "",
  conductor: "",
  transportista: "",
  observaciones: "MERCANCÍA PREENFRIADA\nTEMPERATURA 5 º C",
  numeroCarta: "",
  lugarFirma: "ECIJA",
  documento1: "",
  documento2: "",
};

const routeFieldConfig: FieldConfig[] = [
  { key: "fechaCarga", label: "Fecha carga", type: "date" },
  { key: "fechaDescarga", label: "Fecha descarga", type: "date" },
  { key: "origen", label: "Origen" },
  { key: "destino", label: "Destino" },
  { key: "mercancia", label: "Mercancía" },
  { key: "peso", label: "Peso kg", type: "number" },
  { key: "tractora", label: "Tractora" },
  { key: "remolque", label: "Remolque" },
  { key: "conductor", label: "Conductor / transportista" },
  { key: "observaciones", label: "Observaciones", area: true },
];

const cmrFieldConfig: FieldConfig[] = [
  { key: "numeroCarta", label: "Nº CMR" },
  { key: "fechaCarga", label: "Fecha", type: "date" },
  { key: "origen", label: "Lugar carga" },
  { key: "paisOrigen", label: "País carga" },
  { key: "destino", label: "Lugar entrega" },
  { key: "paisDestino", label: "País entrega" },
  { key: "mercancia", label: "Mercancía" },
  { key: "peso", label: "Peso kg", type: "number" },
  { key: "tractora", label: "Tractora" },
  { key: "remolque", label: "Remolque" },
  { key: "documento1", label: "Documento 1" },
  { key: "documento2", label: "Documento 2" },
  { key: "observaciones", label: "Instrucciones / temperatura", area: true },
];

const formatDate = (value: string) =>
  new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("es-ES");
}

function getFilename(response: Response, fallback: string) {
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const match = disposition.match(/filename="([^"]+)"/);
  return match?.[1] ? decodeURIComponent(match[1]) : fallback;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function safeFilename(value: string) {
  return value.replace(/[<>:"/\\|?*]/g, "-").replace(/\s+/g, " ").trim();
}


function TemplatePicker({
  kind,
  templates,
  selected,
  onSelect,
}: {
  kind: TemplateKind;
  templates: LogisticsTemplate[];
  selected?: LogisticsTemplate;
  onSelect: (template: LogisticsTemplate) => void;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const needle = normalize(query);
    return templates
      .filter((template) => !needle || normalize(`${template.name} ${template.original_path ?? template.storage_path}`).includes(needle))
      .slice(0, 80);
  }, [query, templates]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="glass-field pl-9"
          placeholder={kind === "route" ? "Buscar hoja de ruta..." : "Buscar CMR por cliente, destino o transportista..."}
        />
      </div>
      <div className="max-h-[29rem] space-y-2 overflow-y-auto pr-1">
        {filtered.map((template) => {
          const isSelected = selected?.id === template.id;
          return (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={`w-full rounded-lg border p-3 text-left transition ${
                isSelected
                  ? "border-primary/50 bg-primary/10 shadow-[var(--glass-shadow)]"
                  : "border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] hover:border-[hsl(var(--glass-border-accent))] hover:bg-[hsl(var(--glass-bg-strong))]"
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{template.name}</p>
                  <p className="mt-1 truncate text-xs text-muted-foreground">{template.original_path ?? template.storage_path}</p>
                </div>
                <Badge variant="outline">{template.extension}</Badge>
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Actualizada {formatDate((template.source_updated_at ?? template.updated_at).slice(0, 10))}
              </p>
            </button>
          );
        })}
        {!filtered.length && (
          <div className="empty-state py-8">
            No hay plantillas con ese filtro.
          </div>
        )}
      </div>
    </div>
  );
}

function DynamicForm({
  fields,
  config,
  onChange,
}: {
  fields: LogisticsFields;
  config: FieldConfig[];
  onChange: (key: string, value: string) => void;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {config.map((field) => (
        <div key={field.key} className={field.area ? "md:col-span-2" : ""}>
          <Label htmlFor={field.key} className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {field.label}
          </Label>
          {field.area ? (
            <textarea
              id={field.key}
              value={fields[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
              rows={4}
              className="glass-field flex w-full rounded-md border border-[hsl(var(--glass-border))] px-3 py-2 text-sm outline-none focus:border-[hsl(var(--glass-border-accent))] focus:ring-2 focus:ring-primary/20"
              placeholder={field.placeholder}
            />
          ) : (
            <Input
              id={field.key}
              type={field.type ?? "text"}
              value={fields[field.key] ?? ""}
              onChange={(event) => onChange(field.key, event.target.value)}
              className="glass-field"
              placeholder={field.placeholder}
            />
          )}
        </div>
      ))}
    </div>
  );
}

function SummaryPanel({ selected, fields, kind }: { selected?: LogisticsTemplate; fields: LogisticsFields; kind: TemplateKind }) {
  const summary = [
    ["Plantilla", selected?.name ?? "Sin seleccionar"],
    ["Fecha", fields.fechaCarga],
    ["Ruta", `${fields.origen || "-"} -> ${fields.destino || "-"}`],
    ["Mercancía", fields.mercancia || "-"],
    ["Peso", fields.peso ? `${fields.peso} kg` : "-"],
    ["Vehículo", [fields.tractora, fields.remolque].filter(Boolean).join(" / ") || "-"],
  ];

  return (
    <div className="rounded-lg border border-[hsl(var(--glass-border-accent))] bg-[hsl(var(--glass-bg))] p-4">
      <div className="mb-3 flex items-center gap-2">
        {kind === "route" ? <Route className="h-4 w-4 text-primary" /> : <FileText className="h-4 w-4 text-primary" />}
        <h3 className="text-sm font-semibold">Resumen rápido</h3>
      </div>
      <dl className="space-y-2 text-sm">
        {summary.map(([label, value]) => (
          <div key={label} className="flex gap-3">
            <dt className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</dt>
            <dd className="min-w-0 break-words text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

export default function Logistica() {
  const [templates, setTemplates] = useState<LogisticsTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [error, setError] = useState("");
  const [routeFields, setRouteFields] = useState<LogisticsFields>(baseFields);
  const [cmrFields, setCmrFields] = useState<LogisticsFields>(baseFields);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [selectedCmrId, setSelectedCmrId] = useState("");
  const [generating, setGenerating] = useState<GenerateAction | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);

  const routeTemplates = useMemo(() => templates.filter((template) => template.kind === "route"), [templates]);
  const cmrTemplates = useMemo(() => templates.filter((template) => template.kind === "cmr"), [templates]);
  const selectedRoute = routeTemplates.find((template) => template.id === selectedRouteId);
  const selectedCmr = cmrTemplates.find((template) => template.id === selectedCmrId);

  const applyLoadedTemplates = (loadedTemplates: LogisticsTemplate[]) => {
    setTemplates(loadedTemplates);
    setSelectedRouteId((current) => current || loadedTemplates.find((template) => template.kind === "route")?.id || "");
    setSelectedCmrId((current) => current || loadedTemplates.find((template) => template.kind === "cmr")?.id || "");
  };

  const loadTemplates = async ({ force = false } = {}) => {
    setLoadingTemplates(true);
    setError("");
    setNeedsSetup(false);
    try {
      if (!force) {
        const cached = await readPersistentQuery<LogisticsTemplate[]>(logisticsTemplatesQueryKey);
        if (cached) {
          applyLoadedTemplates(cached.data);
          return;
        }
      } else {
        await removePersistentQuery(logisticsTemplatesQueryKey);
      }

      const { data, error: templateError } = await supabase
        .from("logistics_templates")
        .select("id,kind,name,storage_path,original_path,extension,source_updated_at,updated_at")
        .order("source_updated_at", { ascending: false, nullsFirst: false });

      if (templateError) throw templateError;
      const loadedTemplates = (data ?? []) as LogisticsTemplate[];
      applyLoadedTemplates(loadedTemplates);
      void writePersistentQuery(logisticsTemplatesQueryKey, loadedTemplates);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Error cargando plantillas.";
      const missingSupabaseSetup =
        message.includes("logistics_templates") ||
        message.toLocaleLowerCase("es-ES").includes("schema cache") ||
        message.toLocaleLowerCase("es-ES").includes("relation");
      setNeedsSetup(missingSupabaseSetup);
      setError(
        missingSupabaseSetup
          ? "Las plantillas todavia no estan sincronizadas en Supabase."
          : message,
      );
    } finally {
      setLoadingTemplates(false);
    }
  };

  useEffect(() => {
    void loadTemplates();
  }, []);

  const updateRouteField = (key: string, value: string) => setRouteFields((current) => ({ ...current, [key]: value }));
  const updateCmrField = (key: string, value: string) => setCmrFields((current) => ({ ...current, [key]: value }));

  const generateRoute = async (template: LogisticsTemplate, output: RouteOutputFormat) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/logistics-generate-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ templateId: template.id, fields: routeFields, output }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "No se ha podido generar la hoja de ruta.");
    }

    downloadBlob(await response.blob(), getFilename(response, `${safeFilename(template.name)}.${output}`));
  };

  const generateCmr = async (template: LogisticsTemplate) => {
    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/logistics-generate-cmr`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({ templateId: template.id, fields: cmrFields }),
    });

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      throw new Error(body?.error ?? "No se ha podido generar el CMR.");
    }

    downloadBlob(await response.blob(), getFilename(response, `${safeFilename(template.name)}.pdf`));
  };

  const downloadGenerated = async (action: GenerateAction) => {
    const isRoute = action.startsWith("route");
    const selected = isRoute ? selectedRoute : selectedCmr;
    if (!selected) {
      setError("Selecciona una plantilla antes de generar el documento.");
      return;
    }

    setGenerating(action);
    setError("");
    try {
      if (action === "route-pdf") await generateRoute(selected, "pdf");
      else if (action === "route-xlsx") await generateRoute(selected, "xlsx");
      else await generateCmr(selected);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Error generando documento.");
    } finally {
      setGenerating(null);
    }
  };

  const copySummary = async (kind: TemplateKind) => {
    const selected = kind === "route" ? selectedRoute : selectedCmr;
    const fields = kind === "route" ? routeFields : cmrFields;
    await navigator.clipboard.writeText(
      [
        `${kind === "route" ? "Hoja de ruta" : "CMR"}: ${selected?.name ?? ""}`,
        `Fecha: ${fields.fechaCarga}`,
        `Origen: ${fields.origen}`,
        `Destino: ${fields.destino}`,
        `Mercancía: ${fields.mercancia}`,
        `Peso: ${fields.peso}`,
        `Tractora: ${fields.tractora}`,
        `Remolque: ${fields.remolque}`,
      ].join("\n"),
    );
  };

  return (
    <div className="page-shell">
      <PageHeader
        title="Logística"
        subtitle="Creación rápida de CMR y hojas de ruta desde las plantillas reales de D:\\transporte"
      >
        <Button variant="outline" onClick={() => loadTemplates({ force: true })} disabled={loadingTemplates}>
          {loadingTemplates ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Recargar
        </Button>
      </PageHeader>

      <section className="metric-strip">
        <KPICard label="Hojas de ruta" value={String(routeTemplates.length)} hint="Plantillas Excel detectadas" icon={Route} />
        <KPICard label="CMR" value={String(cmrTemplates.length)} hint="Plantillas PDF detectadas" icon={FileText} />
        <KPICard label="Origen" value="D:\\transporte" hint="Sin tocar originales" icon={Truck} />
        <KPICard label="Campos" value="Solo variables" hint="Fecha, ruta, mercancía y vehículo" icon={Clipboard} />
      </section>

      {error && (
        <div
          className={`rounded-lg border px-4 py-3 text-sm ${
            needsSetup
              ? "border-primary/30 bg-primary/10 text-foreground"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          }`}
        >
          {error}
        </div>
      )}

      {(needsSetup || (!loadingTemplates && templates.length === 0)) && (
        <Card className="glass-accented">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Truck className="h-4 w-4 text-primary" />
              Sincronizar plantillas
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm text-muted-foreground lg:grid-cols-[1.2fr,0.8fr]">
            <div className="space-y-3">
              <p>
                Para que funcione en cualquier dispositivo, las plantillas deben estar en Supabase Storage y sus datos en
                la tabla <span className="font-mono text-foreground">logistics_templates</span>.
              </p>
              <div className="rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg-strong))] p-3 font-mono text-xs text-foreground">
                <p>1. Aplicar migracion: supabase/migrations/20260601_create_logistics_templates.sql</p>
                <p>2. Desplegar funciones: logistics-generate-cmr y logistics-generate-route</p>
                <p>3. Configurar conversor: docs/logistics-renderer.md</p>
                <p>4. Importar archivos: npm run import:logistics</p>
              </div>
            </div>
            <div className="rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] p-3">
              <p className="font-semibold text-foreground">Origen local preparado</p>
              <p className="mt-1">El importador lee las hojas y CMR desde D:\transporte y las sube al bucket privado.</p>
              <p className="mt-2">Necesita la variable SUPABASE_SERVICE_ROLE_KEY solo durante la importacion.</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="route" className="space-y-4">
        <TabsList className="glass-strong">
          <TabsTrigger value="route" className="gap-2">
            <Route className="h-4 w-4" />
            Hojas de ruta
          </TabsTrigger>
          <TabsTrigger value="cmr" className="gap-2">
            <FileText className="h-4 w-4" />
            CMR
          </TabsTrigger>
        </TabsList>

        <TabsContent value="route">
          <div className="grid gap-4 xl:grid-cols-[minmax(20rem,25rem),1fr]">
            <Card className="glass-accented">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Boxes className="h-4 w-4 text-primary" />
                  Plantilla de empresa
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TemplatePicker
                  kind="route"
                  templates={routeTemplates}
                  selected={selectedRoute}
                  onSelect={(template) => setSelectedRouteId(template.id)}
                />
              </CardContent>
            </Card>

            <Card className="glass-accented">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="h-4 w-4 text-primary" />
                  Información que cambia
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DynamicForm fields={routeFields} config={routeFieldConfig} onChange={updateRouteField} />
                <SummaryPanel selected={selectedRoute} fields={routeFields} kind="route" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => downloadGenerated("route-pdf")} disabled={generating === "route-pdf" || !selectedRoute}>
                    {generating === "route-pdf" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Generar PDF
                  </Button>
                  <Button variant="outline" onClick={() => downloadGenerated("route-xlsx")} disabled={generating === "route-xlsx" || !selectedRoute}>
                    {generating === "route-xlsx" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Exportar Excel
                  </Button>
                  <Button variant="outline" onClick={() => copySummary("route")}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar resumen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="cmr">
          <div className="grid gap-4 xl:grid-cols-[minmax(20rem,25rem),1fr]">
            <Card className="glass-accented">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <FileText className="h-4 w-4 text-primary" />
                  Plantilla CMR
                </CardTitle>
              </CardHeader>
              <CardContent>
                <TemplatePicker
                  kind="cmr"
                  templates={cmrTemplates}
                  selected={selectedCmr}
                  onSelect={(template) => setSelectedCmrId(template.id)}
                />
              </CardContent>
            </Card>

            <Card className="glass-accented">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clipboard className="h-4 w-4 text-primary" />
                  Datos variables del CMR
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <DynamicForm fields={cmrFields} config={cmrFieldConfig} onChange={updateCmrField} />
                <SummaryPanel selected={selectedCmr} fields={cmrFields} kind="cmr" />
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => downloadGenerated("cmr")} disabled={generating === "cmr" || !selectedCmr}>
                    {generating === "cmr" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                    Generar CMR
                  </Button>
                  <Button variant="outline" onClick={() => copySummary("cmr")}>
                    <Copy className="mr-2 h-4 w-4" />
                    Copiar resumen
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
