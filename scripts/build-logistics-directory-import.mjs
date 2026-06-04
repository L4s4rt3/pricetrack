import { readdirSync } from "node:fs";
import path from "node:path";

const TRANSPORT_ROOT = process.env.TRANSPORT_ROOT ?? "D:\\transporte";
const CMR_ROOT = path.join(TRANSPORT_ROOT, "CMR");
const ROUTE_ROOT = path.join(TRANSPORT_ROOT, "HOJAS DE RUTA");
const DEFAULT_GOODS = "PALETS DE NARANJAS";
const SOURCE_LIMIT = 30;

const routeCarrierSuffixes = [
  "SERVICOM",
  "TRANSGUISER",
  "BLAZQUEZ",
  "MONTIEL",
  "VILLASAB",
  "ACOTRAL",
  "GENARO",
  "TRILLO",
  "KIKITO",
  "KINI",
  "HAYA",
  "RLC",
].sort((a, b) => b.length - a.length);

const destinationWords = new Set([
  "ALEMANIA",
  "BILBAO",
  "GRAN BRETAÑA",
  "LILLE",
  "LONDRES",
  "LYON",
  "MADRID",
  "PARIS",
  "POLONIA",
  "PORTUGAL",
  "RUNGIS",
]);

function normalizePath(value) {
  return value.replace(/\\/g, "/");
}

function slug(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 120);
}

function cleanName(value) {
  return String(value ?? "")
    .replace(/\.(pdf|xls|xlsx)$/i, "")
    .replace(/\s+/g, " ")
    .replace(/^-+|-+$/g, "")
    .trim();
}

function stripLeadingCmrCode(value) {
  return cleanName(value)
    .replace(/^CMR[- ]*/i, "")
    .replace(/^\d{1,6}[- ]*/, "")
    .replace(/^0+\d*[- ]*/, "")
    .trim();
}

function stripRouteDateSuffix(value) {
  return value
    .replace(/[- ]+\d{6,8}$/g, "")
    .replace(/[- ]+0?\d{1,2}[.]\d{1,2}[.]\d{2,4}$/g, "")
    .trim();
}

function splitByHyphen(value) {
  return value
    .split("-")
    .map((part) => cleanName(part))
    .filter(Boolean);
}

function parseRouteName(fileName) {
  const base = stripRouteDateSuffix(cleanName(fileName));
  const parts = splitByHyphen(base);
  if (parts.length > 1) {
    const maybeCarrier = routeCarrierSuffixes.find((carrier) => parts.at(-1)?.toUpperCase() === carrier);
    return {
      client: parts[0],
      carrier: maybeCarrier ? maybeCarrier : parts.slice(1).join(" - "),
    };
  }

  const upper = base.toUpperCase();
  for (const carrier of routeCarrierSuffixes) {
    const suffix = ` ${carrier}`;
    if (upper.endsWith(suffix)) {
      const client = base.slice(0, -suffix.length).trim();
      if (client) return { client, carrier };
    }
  }

  return { client: base, carrier: "" };
}

function parseCmrName(fileName) {
  let base = stripLeadingCmrCode(fileName);
  if (/^Gemperle\s+\d+/i.test(base)) base = base.replace(/^Gemperle\s+\d+/i, "Gemperle");
  const parts = splitByHyphen(base);
  if (parts.length === 0) return { client: "", carrier: "" };
  if (parts.length === 1) return { client: parts[0], carrier: "" };

  const last = parts.at(-1) ?? "";
  const carrier = destinationWords.has(last.toUpperCase()) && parts.length > 2 ? parts.at(-2) ?? "" : last;
  return { client: parts[0], carrier };
}

function walkFiles(root, extensions, recursive) {
  const entries = readdirSync(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(root, entry.name);
    if (entry.isDirectory() && recursive) {
      files.push(...walkFiles(entryPath, extensions, recursive));
      continue;
    }
    if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) {
      files.push(entryPath);
    }
  }
  return files;
}

function addRow(map, keyName, name, filePath) {
  const key = slug(name);
  if (!key) return;
  const current = map.get(key) ?? {
    [keyName]: key,
    name,
    occurrences: 0,
    source_files: [],
  };
  current.occurrences += 1;
  if (current.source_files.length < SOURCE_LIMIT) {
    current.source_files.push(normalizePath(filePath));
  }
  map.set(key, current);
}

function collect(kind) {
  const isRoute = kind === "route";
  const root = isRoute ? ROUTE_ROOT : CMR_ROOT;
  const files = walkFiles(root, isRoute ? new Set([".xls", ".xlsx"]) : new Set([".pdf"]), !isRoute);
  const clients = new Map();
  const carriers = new Map();

  for (const filePath of files) {
    const parsed = isRoute ? parseRouteName(path.basename(filePath)) : parseCmrName(path.basename(filePath));
    addRow(clients, "client_key", parsed.client, filePath);
    addRow(carriers, "carrier_key", parsed.carrier, filePath);
  }

  return {
    files: files.length,
    clients: Array.from(clients.values()).sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name, "es")),
    carriers: Array.from(carriers.values()).sort((a, b) => b.occurrences - a.occurrences || a.name.localeCompare(b.name, "es")),
  };
}

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlArray(values) {
  return `array[${values.map(sqlString).join(",")}]::text[]`;
}

function clientValues(row) {
  return `(${sqlString(row.client_key)}, ${sqlString(row.name)}, '', '', '', ${sqlString(DEFAULT_GOODS)}, ${/edeka/i.test(row.name)}, ${sqlArray(row.source_files)}, ${row.occurrences})`;
}

function carrierValues(row) {
  return `(${sqlString(row.carrier_key)}, ${sqlString(row.name)}, ${sqlString(row.name)}, '', ${sqlArray(row.source_files)}, ${row.occurrences})`;
}

function upsertClients(table, rows) {
  if (rows.length === 0) return "";
  if (process.argv.includes("--compact-sql")) {
    return `
insert into public.${table} (client_key, name, default_goods, is_edeka, occurrences)
values
${rows.map((row) => `(${sqlString(row.client_key)}, ${sqlString(row.name)}, ${sqlString(DEFAULT_GOODS)}, ${/edeka/i.test(row.name)}, ${row.occurrences})`).join(",\n")}
on conflict (client_key) do update set
  name = excluded.name,
  default_goods = excluded.default_goods,
  is_edeka = excluded.is_edeka,
  occurrences = excluded.occurrences,
  updated_at = now();
`;
  }
  return `
insert into public.${table} (client_key, name, consignee, transitario, country, default_goods, is_edeka, source_files, occurrences)
values
${rows.map(clientValues).join(",\n")}
on conflict (client_key) do update set
  name = excluded.name,
  default_goods = excluded.default_goods,
  is_edeka = excluded.is_edeka,
  source_files = excluded.source_files,
  occurrences = excluded.occurrences,
  updated_at = now();
`;
}

function upsertCarriers(table, rows) {
  if (rows.length === 0) return "";
  if (process.argv.includes("--compact-sql")) {
    return `
insert into public.${table} (carrier_key, name, details, occurrences)
values
${rows.map((row) => `(${sqlString(row.carrier_key)}, ${sqlString(row.name)}, ${sqlString(row.name)}, ${row.occurrences})`).join(",\n")}
on conflict (carrier_key) do update set
  name = excluded.name,
  details = excluded.details,
  occurrences = excluded.occurrences,
  updated_at = now();
`;
  }
  return `
insert into public.${table} (carrier_key, name, details, country, source_files, occurrences)
values
${rows.map(carrierValues).join(",\n")}
on conflict (carrier_key) do update set
  name = excluded.name,
  details = excluded.details,
  source_files = excluded.source_files,
  occurrences = excluded.occurrences,
  updated_at = now();
`;
}

const cmr = collect("cmr");
const route = collect("route");

if (process.argv.includes("--summary")) {
  console.log(JSON.stringify({
    cmr: { files: cmr.files, clients: cmr.clients.length, carriers: cmr.carriers.length },
    route: { files: route.files, clients: route.clients.length, carriers: route.carriers.length },
    routeClients: route.clients.map(({ name, occurrences }) => ({ name, occurrences })),
    routeCarriers: route.carriers.map(({ name, occurrences }) => ({ name, occurrences })),
  }, null, 2));
  process.exit(0);
}

console.log([
  "begin;",
  upsertClients("cmr_clients", cmr.clients),
  upsertCarriers("cmr_carriers", cmr.carriers),
  upsertClients("route_clients", route.clients),
  upsertCarriers("route_carriers", route.carriers),
  "commit;",
].filter(Boolean).join("\n"));
