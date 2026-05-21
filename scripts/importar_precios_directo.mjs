import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { existsSync, readdirSync, readFileSync, statSync } from 'fs'
import { basename, extname, join, resolve } from 'path'
import { fileURLToPath } from 'url'

const TABLE = 'precios'
const PAGE_SIZE = 1000
const INSERT_CHUNK = 1000

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))

function readEnv() {
  const raw = readFileSync(resolve(ROOT, '.env'), 'utf8')
  const env = {}
  for (const line of raw.split(/\r?\n/)) {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*?)\s*$/)
    if (match) env[match[1]] = match[2].replace(/^["']|["']$/g, '')
  }
  return env
}

const env = readEnv()
const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

function cleanText(value) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeText(value) {
  return cleanText(value)
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function parseNumber(value) {
  const text = cleanText(value).replace(/\s/g, '')
  if (!text) return 0
  if (text.includes(',') && !text.includes('.')) return Number.parseFloat(text.replace(',', '.')) || 0
  if (text.includes(',') && text.includes('.')) return Number.parseFloat(text.replace(/\./g, '').replace(',', '.')) || 0
  return Number.parseFloat(text) || 0
}

function extractYear(value) {
  const match = cleanText(value).match(/(\d{4})/)
  return match ? Number.parseInt(match[1], 10) : new Date().getFullYear()
}

function extractMonth(value) {
  const text = cleanText(value)
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (match) return Number.parseInt(match[2], 10)
  const number = Number.parseInt(text, 10)
  return number >= 1 && number <= 12 && text.length <= 2 ? number : null
}

function detectCategory(name) {
  const n = normalizeText(name)
  if (n.includes('CARACARA')) return 'Naranja Caracara'
  if (n.includes('NAVELINA')) return 'Naranja Navelina'
  if (n.includes('SALUSTIANA')) return 'Naranja Salustiana'
  if (n.includes('NAVEL')) return 'Naranja Navel'
  if (n.startsWith('NAR ') || n.includes(' NAR ')) return 'Naranja'
  if (n.includes('LIMON') || n.includes('LIM ')) return 'Limon'
  if (n.includes('MAND') || n.includes('CLEMENTINA')) return 'Mandarina'
  return 'Sin categoria'
}

function normalizeHeader(value) {
  return normalizeText(value)
    .replace(/[^A-Z0-9]+/g, ' ')
    .trim()
}

function findHeader(headers, names) {
  const normalized = headers.map(normalizeHeader)
  const wanted = names.map(normalizeHeader)
  return normalized.findIndex(header => wanted.some(name => header === name || header.includes(name)))
}

function buildMapping(headers) {
  return {
    fecha: findHeader(headers, ['Fecha']),
    documento: findHeader(headers, ['Documento', 'Doc']),
    cliente: findHeader(headers, ['Cliente', 'Codigo cliente', 'Cod cliente']),
    denominacion_social: findHeader(headers, ['Denominacion social', 'Razon social', 'Nombre cliente']),
    factura: findHeader(headers, ['Factura', 'Num factura']),
    lin: findHeader(headers, ['Lin', 'Linea']),
    referencia: findHeader(headers, ['Referencia', 'Ref', 'Codigo articulo']),
    producto: findHeader(headers, ['Articulo', 'Producto', 'Descripcion']),
    kilos: findHeader(headers, ['Kilos', 'KILOS', 'Kg']),
    unidades: findHeader(headers, ['UNID', 'Unidades', 'Cantidad']),
    litros: findHeader(headers, ['Litros']),
    tarifa: findHeader(headers, ['Tarifa']),
    precio: findHeader(headers, ['PVP', 'Precio']),
    coste_adic: findHeader(headers, ['CosteAdic', 'Coste adic']),
    base_iva: findHeader(headers, ['Base Iva', 'Base IVA', 'Importe']),
    fecha_fra: findHeader(headers, ['Fecha Fra', 'Fecha factura']),
  }
}

function getCell(row, map, field) {
  const index = map[field]
  return index >= 0 ? row[index] : ''
}

function splitDelimitedLine(line, delimiter) {
  const out = []
  let value = ''
  let quoted = false
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        value += '"'
        i += 1
      } else {
        quoted = !quoted
      }
    } else if (char === delimiter && !quoted) {
      out.push(value)
      value = ''
    } else {
      value += char
    }
  }
  out.push(value)
  return out
}

function readDelimited(file) {
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  const delimiter = (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length ? '\t' : ','
  return lines.map(line => splitDelimitedLine(line, delimiter))
}

function readWorkbook(file) {
  const bytes = readFileSync(file)
  const repaired = hasPk00Prefix(bytes)
    ? repairPk00Zip(bytes)
    : bytes
  const wb = XLSX.read(repaired, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' })
}

function hasPk00Prefix(bytes) {
  return bytes[0] === 0x50 && bytes[1] === 0x4B && bytes[2] === 0x30 && bytes[3] === 0x30 && bytes[4] === 0x50 && bytes[5] === 0x4B
}

function repairPk00Zip(bytes) {
  const out = Buffer.from(bytes.subarray(4))
  for (let i = 0; i < out.length - 46; i += 1) {
    if (out[i] === 0x50 && out[i + 1] === 0x4B && out[i + 2] === 0x01 && out[i + 3] === 0x02) {
      const offset = out.readUInt32LE(i + 42)
      if (offset >= 4) out.writeUInt32LE(offset - 4, i + 42)
      i += 45
    }
  }
  for (let i = out.length - 22; i >= 0 && i > out.length - 65580; i -= 1) {
    if (out[i] === 0x50 && out[i + 1] === 0x4B && out[i + 2] === 0x05 && out[i + 3] === 0x06) {
      const offset = out.readUInt32LE(i + 16)
      if (offset >= 4) out.writeUInt32LE(offset - 4, i + 16)
      break
    }
  }
  return out
}

function tableFromFile(file) {
  const ext = extname(file).toLowerCase()
  const rows = ext === '.xlsx' || ext === '.xls' ? readWorkbook(file) : readDelimited(file)
  if (rows.length < 2) return { headers: [], rows: [] }
  const headers = rows[0].map(cleanText)
  return { headers, rows: rows.slice(1) }
}

function toRecord(row, map) {
  if (map.precio < 0 && map.base_iva < 0 && map.referencia < 0) return null
  const product = cleanText(getCell(row, map, 'producto') || getCell(row, map, 'referencia'))
  if (!product) return null
  if (!cleanText(getCell(row, map, 'documento')) && !cleanText(getCell(row, map, 'fecha')) && !cleanText(getCell(row, map, 'fecha_fra'))) return null
  const baseIva = parseNumber(getCell(row, map, 'base_iva'))
  const kilos = parseNumber(getCell(row, map, 'kilos'))
  let price = parseNumber(getCell(row, map, 'precio'))
  if (!price && baseIva > 0 && kilos > 0) price = baseIva / kilos
  const fecha = getCell(row, map, 'fecha')
  const fechaFra = getCell(row, map, 'fecha_fra')
  return {
    producto: product,
    categoria: detectCategory(product),
    precio: price,
    unidad: 'kg',
    ano: extractYear(fecha || fechaFra),
    mes: extractMonth(fecha || fechaFra),
    notas: '',
    cliente: cleanText(getCell(row, map, 'cliente')),
    denominacion_social: cleanText(getCell(row, map, 'denominacion_social')),
    referencia: cleanText(getCell(row, map, 'referencia')),
    kilos,
    unidades: parseNumber(getCell(row, map, 'unidades')),
    litros: parseNumber(getCell(row, map, 'litros')),
    tarifa: parseNumber(getCell(row, map, 'tarifa')),
    coste_adic: parseNumber(getCell(row, map, 'coste_adic')),
    base_iva: baseIva,
    documento: cleanText(getCell(row, map, 'documento')),
    factura: cleanText(getCell(row, map, 'factura')),
    fecha_fra: cleanText(fechaFra),
    lin: Number.parseInt(cleanText(getCell(row, map, 'lin')), 10) || 0,
  }
}

function keyForRecord(record) {
  const doc = normalizeText(record.documento || record.factura).replace(/[^A-Z0-9]+/g, ' ').trim()
  const ref = normalizeText(record.referencia).replace(/[^A-Z0-9]+/g, ' ').trim()
  const client = normalizeText(record.cliente).replace(/[^A-Z0-9]+/g, ' ').trim()
  const product = normalizeText(record.producto).replace(/[^A-Z0-9]+/g, ' ').trim()
  const line = String(record.lin || '').trim()
  const date = `${record.ano || ''}-${String(record.mes || '').padStart(2, '0')}`

  if (doc && line) return `doc-line|${doc}|${line}`
  if (doc && ref && client) return `doc-ref-client|${doc}|${ref}|${client}`
  if (doc && product && client) return `doc-product-client|${doc}|${product}|${client}`
  return [
    'exact', date, client, ref, product, line,
    Number(record.kilos || 0).toFixed(3),
    Number(record.unidades || 0).toFixed(3),
    Number(record.base_iva || 0).toFixed(2),
    Number(record.precio || 0).toFixed(4),
  ].join('|')
}

async function fetchExistingKeys() {
  const keys = new Set()
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('ano,mes,documento,factura,referencia,cliente,producto,lin,kilos,unidades,base_iva,precio')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    for (const row of data || []) keys.add(keyForRecord(row))
    if (!data?.length || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
    if (from % 10000 === 0) console.log(`Existentes leidos: ${from.toLocaleString('es-ES')}`)
  }
  return keys
}

function collectFiles(inputPaths) {
  const files = []
  for (const input of inputPaths) {
    const path = resolve(input)
    if (!existsSync(path)) throw new Error(`No existe: ${input}`)
    if (statSync(path).isDirectory()) {
      for (const name of readdirSync(path)) {
        const full = join(path, name)
        if (/\.(csv|tsv|txt|file|xlsx|xls)$/i.test(name)) files.push(full)
      }
    } else if (/\.(csv|tsv|txt|file|xlsx|xls)$/i.test(path)) {
      files.push(path)
    }
  }
  return files
}

async function insertRows(rows, doneStart, total) {
  let done = doneStart
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from(TABLE).insert(chunk, { returning: 'minimal' })
    if (error) throw error
    done += chunk.length
    console.log(`Insertadas ${done.toLocaleString('es-ES')}/${total.toLocaleString('es-ES')}`)
  }
  return done
}

async function main() {
  const inputs = process.argv.slice(2)
  if (!inputs.length) {
    console.log('Uso: node scripts/importar_precios_directo.mjs ventas.csv importar/')
    process.exit(1)
  }

  const files = collectFiles(inputs)
  if (!files.length) throw new Error('No hay archivos importables.')
  console.log(`Archivos: ${files.map(file => basename(file)).join(', ')}`)

  console.log('Leyendo claves ya existentes en Supabase...')
  const existing = await fetchExistingKeys()
  console.log(`Existentes: ${existing.size.toLocaleString('es-ES')}`)

  let totalRows = 0
  let validRows = 0
  let skipped = 0
  let inserted = 0
  let pending = []

  for (const file of files) {
    const table = tableFromFile(file)
    const map = buildMapping(table.headers)
    console.log(`${basename(file)}: ${table.rows.length.toLocaleString('es-ES')} filas`)
    for (const row of table.rows) {
      totalRows += 1
      const record = toRecord(row, map)
      if (!record) {
        skipped += 1
        continue
      }
      validRows += 1
      const key = keyForRecord(record)
      if (existing.has(key)) {
        skipped += 1
        continue
      }
      existing.add(key)
      pending.push(record)
      if (pending.length >= INSERT_CHUNK * 10) {
        inserted = await insertRows(pending, inserted, validRows)
        pending = []
      }
    }
  }

  if (pending.length) inserted = await insertRows(pending, inserted, validRows)
  console.log(`\nCompletado.`)
  console.log(`Filas leidas: ${totalRows.toLocaleString('es-ES')}`)
  console.log(`Validas: ${validRows.toLocaleString('es-ES')}`)
  console.log(`Insertadas: ${inserted.toLocaleString('es-ES')}`)
  console.log(`Saltadas/duplicadas: ${skipped.toLocaleString('es-ES')}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
