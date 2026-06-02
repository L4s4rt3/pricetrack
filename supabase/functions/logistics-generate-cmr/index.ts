import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LogisticsFields = Record<string, string>;

interface GeneratePayload {
  templateId: string;
  fields: LogisticsFields;
}

const months = [
  "ENERO",
  "FEBRERO",
  "MARZO",
  "ABRIL",
  "MAYO",
  "JUNIO",
  "JULIO",
  "AGOSTO",
  "SEPTIEMBRE",
  "OCTUBRE",
  "NOVIEMBRE",
  "DICIEMBRE",
];

function parseDate(value?: string) {
  if (!value) return new Date();
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.valueOf()) ? new Date() : date;
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-ES").format(date);
}

function cmrDateParts(value?: string) {
  const date = parseDate(value);
  return {
    full: formatDate(date),
    dayMonth: `${String(date.getDate()).padStart(2, "0")} DE ${months[date.getMonth()]}`,
    year: String(date.getFullYear()),
  };
}

function buildCmrFields(fields: LogisticsFields) {
  const dateParts = cmrDateParts(fields.fechaCarga);
  return {
    NumCarta: fields.numeroCarta ?? "",
    "003_1": fields.origen ?? "",
    "003_2": fields.paisOrigen ?? "ESPAÑA",
    "003_3": dateParts.full,
    "004_1": fields.destino ?? "",
    "004_2": fields.paisDestino ?? "",
    "010_01": fields.mercancia ?? "",
    "014_01": fields.peso ?? "",
    "016": fields.observaciones ?? "",
    "021_01": fields.lugarFirma || fields.origen || "ECIJA",
    "021_02": dateParts.dayMonth,
    "021_03": dateParts.year,
    TRACTORA: fields.tractora ?? "",
    REMOLQUE: fields.remolque ?? "",
    "008_01": fields.documento1 ?? "",
    "008_02": fields.documento2 ?? "",
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Metodo no permitido" });
  }

  try {
    const { templateId, fields } = (await request.json()) as GeneratePayload;
    if (!templateId) return jsonResponse(400, { error: "Falta templateId" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: "Falta configuracion de Supabase" });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: template, error: templateError } = await supabase
      .from("logistics_templates")
      .select("name, storage_path")
      .eq("id", templateId)
      .eq("kind", "cmr")
      .single();

    if (templateError) throw templateError;

    const { data: file, error: fileError } = await supabase.storage
      .from("logistics-templates")
      .download(template.storage_path);

    if (fileError) throw fileError;

    const pdfDoc = await PDFDocument.load(await file.arrayBuffer());
    const form = pdfDoc.getForm();
    const values = buildCmrFields(fields ?? {});

    for (const [fieldName, value] of Object.entries(values)) {
      try {
        form.getTextField(fieldName).setText(String(value ?? ""));
      } catch {
        // Some historic templates do not expose every optional field.
      }
    }

    form.updateFieldAppearances();
    const pdfBytes = await pdfDoc.save();
    const safeName = `${template.name}-${Date.now()}.pdf`.replace(/[<>:"/\\|?*]/g, "-");

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeName)}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error generando CMR";
    return jsonResponse(500, { error: message });
  }
});
