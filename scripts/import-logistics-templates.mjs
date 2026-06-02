import { createHash } from "node:crypto";
import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

const TRANSPORT_ROOT = process.env.TRANSPORT_ROOT ?? "D:\\transporte";
const ROUTE_ROOT = path.join(TRANSPORT_ROOT, "HOJAS DE RUTA");
const CMR_ROOT = path.join(TRANSPORT_ROOT, "CMR");
const BUCKET = "logistics-templates";
const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? "https://lhbmxmdjyrbhjcsazhqi.supabase.co";
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_ANON_KEY ??
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxoYm14bWRqeXJiaGpjc2F6aHFpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzc1MDUyMzksImV4cCI6MjA5MzA4MTIzOX0.5__CcpAeARN2A3lIkZqlS_J3FleK7mxMU4pIFqa_y6s";
const BATCH_SIZE = 6;

const mimeTypes = {
  ".pdf": "application/pdf",
  ".xls": "application/vnd.ms-excel",
  ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function stablePrefix(filePath) {
  return createHash("sha1").update(filePath).digest("hex").slice(0, 12);
}

async function walkFiles(root, extensions, recursive) {
  const entries = await readdir(root, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(root, entry.name);
      if (entry.isDirectory()) return recursive ? walkFiles(entryPath, extensions, recursive) : [];
      return extensions.has(path.extname(entry.name).toLowerCase()) ? [entryPath] : [];
    }),
  );
  return nested.flat();
}

async function buildEntries() {
  const routeFiles = await walkFiles(ROUTE_ROOT, new Set([".xls", ".xlsx"]), false);
  const cmrFiles = await walkFiles(CMR_ROOT, new Set([".pdf"]), true);
  const files = [
    ...routeFiles.map((filePath) => ({ filePath, kind: "route", root: ROUTE_ROOT })),
    ...cmrFiles.map((filePath) => ({ filePath, kind: "cmr", root: CMR_ROOT })),
  ];

  const entries = [];
  for (const file of files) {
    const fileStat = await stat(file.filePath);
    const extension = path.extname(file.filePath).toLowerCase();
    const relativePath = normalizePath(path.relative(file.root, file.filePath));
    entries.push({
      kind: file.kind,
      name: path.basename(file.filePath, extension),
      filePath: file.filePath,
      storage_path: `${file.kind}/${stablePrefix(file.filePath)}-${slug(relativePath)}`,
      original_path: file.filePath,
      extension: extension.slice(1).toUpperCase(),
      size_bytes: fileStat.size,
      source_updated_at: fileStat.mtime.toISOString(),
      updated_at: new Date().toISOString(),
      contentType: mimeTypes[extension],
    });
  }
  return entries;
}

async function uploadEntry(supabase, entry) {
  const buffer = await readFile(entry.filePath);
  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(entry.storage_path, buffer, {
    contentType: entry.contentType,
    upsert: true,
  });
  if (uploadError) throw new Error(`${entry.name}: ${uploadError.message}`);

  const { contentType, filePath, ...row } = entry;
  const { error: upsertError } = await supabase.from("logistics_templates").upsert(row, {
    onConflict: "storage_path",
  });
  if (upsertError) throw new Error(`${entry.name}: ${upsertError.message}`);
}

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const entries = await buildEntries();
  const routeCount = entries.filter((entry) => entry.kind === "route").length;
  const cmrCount = entries.filter((entry) => entry.kind === "cmr").length;
  console.log(`Subiendo ${routeCount} hojas de ruta y ${cmrCount} CMR a ${SUPABASE_URL}`);

  let imported = 0;
  for (let index = 0; index < entries.length; index += BATCH_SIZE) {
    const batch = entries.slice(index, index + BATCH_SIZE);
    await Promise.all(batch.map((entry) => uploadEntry(supabase, entry)));
    imported += batch.length;
    if (imported % 60 === 0 || imported === entries.length) {
      console.log(`${imported}/${entries.length} plantillas importadas`);
    }
  }

  console.log(`Importacion completada: ${entries.length} plantillas registradas en Supabase.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
