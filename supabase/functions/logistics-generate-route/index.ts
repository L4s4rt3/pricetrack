import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type LogisticsFields = Record<string, string>;
type OutputFormat = "pdf" | "xlsx";

interface GeneratePayload {
  templateId: string;
  fields: LogisticsFields;
  output?: OutputFormat;
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function bytesToBase64(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function safeFilename(value: string, extension: OutputFormat) {
  return `${value}-${Date.now()}.${extension}`.replace(/[<>:"/\\|?*]/g, "-");
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return jsonResponse(405, { error: "Metodo no permitido" });
  }

  try {
    const { templateId, fields, output = "pdf" } = (await request.json()) as GeneratePayload;
    if (!templateId) return jsonResponse(400, { error: "Falta templateId" });
    if (output !== "pdf" && output !== "xlsx") return jsonResponse(400, { error: "Formato no soportado" });

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const rendererUrl = Deno.env.get("LOGISTICS_RENDERER_URL");
    const rendererToken = Deno.env.get("LOGISTICS_RENDERER_TOKEN");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse(500, { error: "Falta configuracion de Supabase" });
    }

    if (!rendererUrl || !rendererToken) {
      return jsonResponse(501, {
        error: "Falta configurar LOGISTICS_RENDERER_URL y LOGISTICS_RENDERER_TOKEN para exportar hojas de ruta.",
      });
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: template, error: templateError } = await supabase
      .from("logistics_templates")
      .select("name, storage_path, extension")
      .eq("id", templateId)
      .eq("kind", "route")
      .single();

    if (templateError) throw templateError;

    const { data: file, error: fileError } = await supabase.storage
      .from("logistics-templates")
      .download(template.storage_path);

    if (fileError) throw fileError;

    const renderResponse = await fetch(`${rendererUrl.replace(/\/$/, "")}/render-route`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${rendererToken}`,
      },
      body: JSON.stringify({
        filename: template.name,
        extension: template.extension,
        output,
        fields: fields ?? {},
        fileBase64: bytesToBase64(await file.arrayBuffer()),
      }),
    });

    if (!renderResponse.ok) {
      const body = (await renderResponse.json().catch(() => null)) as { error?: string } | null;
      return jsonResponse(renderResponse.status, { error: body?.error ?? "No se pudo generar la hoja de ruta." });
    }

    const contentType = renderResponse.headers.get("Content-Type") ??
      (output === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");

    return new Response(await renderResponse.arrayBuffer(), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(safeFilename(template.name, output))}"`,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error generando hoja de ruta";
    return jsonResponse(500, { error: message });
  }
});
