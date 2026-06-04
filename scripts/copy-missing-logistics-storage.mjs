import { createClient } from "@supabase/supabase-js";

const BUCKET = "logistics-templates";
const PAGE_SIZE = 1000;
const MAX_RETRIES = 4;

const sourceUrl = process.env.SOURCE_SUPABASE_URL;
const sourceKey = process.env.SOURCE_SUPABASE_ANON_KEY;
const targetUrl = process.env.TARGET_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const targetKey = process.env.TARGET_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY;

if (!sourceUrl || !sourceKey || !targetUrl || !targetKey) {
  throw new Error("Missing SOURCE_* or TARGET_*/VITE_* Supabase environment variables.");
}

const source = createClient(sourceUrl, sourceKey, { auth: { persistSession: false } });
const target = createClient(targetUrl, targetKey, { auth: { persistSession: false } });

async function withRetries(operation) {
  let lastResult;
  for (let attempt = 0; attempt < MAX_RETRIES; attempt += 1) {
    lastResult = await operation();
    if (!lastResult.error) return lastResult;
    const retryable = /bad gateway|timeout|network|fetch failed|rate limit/i.test(lastResult.error.message ?? "");
    if (!retryable || attempt === MAX_RETRIES - 1) return lastResult;
    await new Promise((resolve) => setTimeout(resolve, 750 * (attempt + 1)));
  }
  return lastResult;
}

async function fetchAllTemplatePaths() {
  const paths = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await target
      .from("logistics_templates")
      .select("storage_path")
      .order("storage_path", { ascending: true })
      .range(from, to);
    if (error) throw error;
    paths.push(...data.map((row) => row.storage_path));
    if (data.length < PAGE_SIZE) return paths;
  }
}

async function listFolder(folder) {
  const paths = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const { data, error } = await target.storage.from(BUCKET).list(folder, {
      limit: PAGE_SIZE,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    paths.push(...data.filter((entry) => entry.id).map((entry) => `${folder}/${entry.name}`));
    if (data.length < PAGE_SIZE) return paths;
  }
}

async function copyObject(storagePath) {
  const downloaded = await withRetries(() => source.storage.from(BUCKET).download(storagePath));
  if (downloaded.error) throw new Error(`${storagePath}: ${downloaded.error.message}`);

  const buffer = Buffer.from(await downloaded.data.arrayBuffer());
  const uploaded = await withRetries(() =>
    target.storage.from(BUCKET).upload(storagePath, buffer, {
      contentType: downloaded.data.type || undefined,
      upsert: true,
    }),
  );
  if (uploaded.error) throw new Error(`${storagePath}: ${uploaded.error.message}`);
}

const templatePaths = await fetchAllTemplatePaths();
const existingPaths = new Set([...(await listFolder("cmr")), ...(await listFolder("route"))]);
const missingPaths = templatePaths.filter((storagePath) => !existingPaths.has(storagePath));

console.log(`Plantillas registradas: ${templatePaths.length}`);
console.log(`Objetos presentes destino: ${existingPaths.size}`);
console.log(`Objetos pendientes de copiar: ${missingPaths.length}`);

let copied = 0;
for (const storagePath of missingPaths) {
  await copyObject(storagePath);
  copied += 1;
  if (copied % 25 === 0 || copied === missingPaths.length) {
    console.log(`${copied}/${missingPaths.length} objetos copiados`);
  }
}

console.log(`Copia completada: ${copied} objetos copiados.`);
