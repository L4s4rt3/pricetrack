import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { existsSync, readFileSync } from 'fs'
import { basename, resolve } from 'path'
import { fileURLToPath } from 'url'

const TABLE = 'ventas_confeccion_detalle'
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

const VARIEDADES_CONOCIDAS = [
  'VALENCIA EGIPTO', 'VALENCIA MIDKNIGHT', 'VALENCIA DELTA', 'VALENCIA LATE',
  'NAVEL POWELL', 'NAVEL POWEL', 'NAVEL CARACARA', 'LANE LATE',
  'CARACARA', 'NAVELINA', 'SALUSTIANA', 'BARBERINA', 'BARNFIELD',
  'VALENCIA', 'NAVEL', 'ORRI', 'CLEMENTINA', 'TANGO', 'NADORCOTT',
  'NOVA', 'SATSUMA', 'VERNA', 'FINO',
].sort((a, b) => b.length - a.length)

const BASES_CONOCIDAS = new Set(['NAR', 'LIM', 'LIMON', 'MAND', 'POMELO'])

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

function parseIntValue(value) {
  return Number.parseInt(cleanText(value), 10) || 0
}

function parseDate(value) {
  if (!value) return null
  if (typeof value === 'number') {
    const date = new Date((value - 25569) * 86400 * 1000)
    return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10)
  }
  const text = cleanText(value)
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`
  const ymd = text.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
  if (ymd) return `${ymd[1]}-${ymd[2].padStart(2, '0')}-${ymd[3].padStart(2, '0')}`
  return null
}

function normalizeHeader(value) {
  return normalizeText(value).replace(/[^A-Z0-9]+/g, ' ').trim()
}

function getValue(row, names) {
  const normalizedNames = names.map(normalizeHeader)
  for (const [key, value] of Object.entries(row)) {
    const normalizedKey = normalizeHeader(key)
    if (normalizedNames.some(name => normalizedKey === name || normalizedKey.includes(name))) return value
  }
  return ''
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

function readWorkbookRows(file) {
  const bytes = readFileSync(file)
  const repaired = hasPk00Prefix(bytes) ? repairPk00Zip(bytes) : bytes
  const wb = XLSX.read(repaired, { type: 'buffer' })
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
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

function readDelimitedRows(file) {
  const text = readFileSync(file, 'utf8').replace(/^\uFEFF/, '')
  const lines = text.split(/\r?\n/).filter(line => line.trim())
  if (lines.length < 2) return []
  const delimiter = (lines[0].match(/\t/g) || []).length > (lines[0].match(/,/g) || []).length ? '\t' : ','
  const headers = splitDelimitedLine(lines[0], delimiter)
  return lines.slice(1).map(line => {
    const cells = splitDelimitedLine(line, delimiter)
    return Object.fromEntries(headers.map((header, index) => [header, cells[index] ?? '']))
  })
}

function readRows(file) {
  return /\.(xlsx|xls)$/i.test(file) ? readWorkbookRows(file) : readDelimitedRows(file)
}

function cleanDocument(value) {
  return cleanText(value).replace(/^Alb\.?\s*/i, '').trim()
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parseProduct(textValue) {
  const text = normalizeText(textValue)
  const tokens = text.split(/\s+/).filter(Boolean)
  const rest = []
  let calibre = ''
  for (const token of tokens) {
    if (/^CAL/.test(token)) {
      if (!calibre) calibre = token
    } else {
      rest.push(token)
    }
  }

  const restText = rest.join(' ')
  let variedad = ''
  for (const item of VARIEDADES_CONOCIDAS) {
    if (new RegExp(`\\b${escapeRegex(item)}\\b`, 'i').test(restText)) {
      variedad = item
      break
    }
  }

  let producto_base = rest[0] || ''
  if (producto_base && !BASES_CONOCIDAS.has(producto_base)) producto_base = 'NAR'
  return { producto_base, variedad, calibre }
}

function saleFromRow(row) {
  const doc = cleanText(getValue(row, ['Documento']))
  if (!doc) return null
  return {
    documento: doc,
    cliente_id: cleanText(getValue(row, ['Cliente'])),
    cc: cleanText(getValue(row, ['CC'])),
    denominacion_social: cleanText(getValue(row, ['Denominacion social'])),
    matricula: cleanText(getValue(row, ['Matricula'])),
    fecha_fra: parseDate(getValue(row, ['Fecha Fra'])),
    factura: cleanText(getValue(row, ['Factura'])),
    linea: parseIntValue(getValue(row, ['Lin', 'Linea'])),
    referencia: cleanText(getValue(row, ['Referencia'])),
    articulo_venta: cleanText(getValue(row, ['Articulo'])),
    kilos_venta: parseNumber(getValue(row, ['KILOS', 'Kilos'])),
    unidades: parseIntValue(getValue(row, ['UNID', 'Unidades'])),
    litros: parseNumber(getValue(row, ['LITROS', 'Litros'])),
    tarifa: parseNumber(getValue(row, ['Tarifa'])),
    pvp: parseNumber(getValue(row, ['PVP', 'Precio'])),
    coste_adic: parseNumber(getValue(row, ['CosteAdic', 'Coste adic'])),
    base_iva: parseNumber(getValue(row, ['Base Iva'])),
  }
}

function palletFromRow(row, sale) {
  const docOriginal = cleanText(getValue(row, ['DcmtoVta']))
  const docClean = cleanDocument(docOriginal)
  const product = cleanText(getValue(row, ['Denominacion Producto']))
  const parsed = parseProduct(product)
  return {
    tipo_palet: cleanText(getValue(row, ['TipoPalet'])),
    'nº_palet': parseIntValue(getValue(row, ['NºPalet', 'Num Palet'])),
    fecha_confeccion: parseDate(getValue(row, ['Fecha'])),
    producto_confeccionado: product,
    lote: cleanText(getValue(row, ['Lote'])),
    documento_venta_original: docOriginal,
    documento_limpio: docClean,
    fecha_documento: parseDate(getValue(row, ['Fecha'])),
    cliente_nombre: cleanText(getValue(row, ['Cliente'])),
    cajas: parseIntValue(getValue(row, ['Cajas'])),
    tipo_caja: cleanText(getValue(row, ['TipoCaja'])),
    kg_netos: parseNumber(getValue(row, ['Netos'])),
    kg_facturados: parseNumber(getValue(row, ['Fact'])),
    situacion: cleanText(getValue(row, ['Sit'])),
    cliente_id: sale?.cliente_id || '',
    cc: sale?.cc || '',
    denominacion_social: sale?.denominacion_social || '',
    matricula: sale?.matricula || '',
    fecha_fra: sale?.fecha_fra || null,
    factura: sale?.factura || '',
    linea: sale?.linea || null,
    referencia: sale?.referencia || '',
    articulo_venta: sale?.articulo_venta || '',
    kilos_venta: sale?.kilos_venta || 0,
    unidades: sale?.unidades || 0,
    litros: sale?.litros || 0,
    tarifa: sale?.tarifa || 0,
    pvp: sale?.pvp || 0,
    coste_adic: sale?.coste_adic || 0,
    base_iva: sale?.base_iva || 0,
    producto_base: parsed.producto_base,
    variedad: parsed.variedad,
    calibre: parsed.calibre,
  }
}

function keyForPallet(row) {
  return [
    row['nº_palet'] || '',
    normalizeText(row.lote),
    normalizeText(row.documento_venta_original || row.documento_limpio),
    normalizeText(row.producto_confeccionado),
    row.fecha_confeccion || '',
  ].join('|')
}

async function fetchExistingKeys() {
  const keys = new Set()
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('nº_palet,lote,documento_venta_original,documento_limpio,producto_confeccionado,fecha_confeccion')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    for (const row of data || []) keys.add(keyForPallet(row))
    if (!data?.length || data.length < PAGE_SIZE) break
    from += PAGE_SIZE
    if (from % 10000 === 0) console.log(`Confeccion existente leida: ${from.toLocaleString('es-ES')}`)
  }
  return keys
}

async function insertRows(rows, doneStart, total) {
  let done = doneStart
  for (let i = 0; i < rows.length; i += INSERT_CHUNK) {
    const chunk = rows.slice(i, i + INSERT_CHUNK)
    const { error } = await supabase.from(TABLE).insert(chunk, { returning: 'minimal' })
    if (error) throw error
    done += chunk.length
    console.log(`Confeccion insertada ${done.toLocaleString('es-ES')}/${total.toLocaleString('es-ES')}`)
  }
  return done
}

async function main() {
  const args = process.argv.slice(2)
  if (args.length < 2) {
    console.log('Uso: node scripts/importar_confeccion_directo.mjs --ventas ventas.xlsx ventas.csv --palets palets.xlsx palets2.xlsx')
    process.exit(1)
  }

  const split = args.indexOf('--palets')
  const salesStart = args.indexOf('--ventas')
  if (salesStart < 0 || split < 0 || split <= salesStart + 1) throw new Error('Faltan --ventas o --palets.')
  const salesFiles = args.slice(salesStart + 1, split).map(file => resolve(file))
  const palletFiles = args.slice(split + 1).map(file => resolve(file))
  for (const file of [...salesFiles, ...palletFiles]) if (!existsSync(file)) throw new Error(`No existe: ${file}`)

  const salesByDoc = new Map()
  for (const file of salesFiles) {
    const rows = readRows(file)
    console.log(`${basename(file)} ventas: ${rows.length.toLocaleString('es-ES')} filas`)
    for (const row of rows) {
      const sale = saleFromRow(row)
      if (!sale) continue
      if (!salesByDoc.has(sale.documento)) salesByDoc.set(sale.documento, sale)
    }
  }
  console.log(`Documentos de venta enlazables: ${salesByDoc.size.toLocaleString('es-ES')}`)

  console.log('Leyendo claves existentes de confeccion...')
  const existing = await fetchExistingKeys()
  console.log(`Confeccion existente: ${existing.size.toLocaleString('es-ES')}`)

  let totalRows = 0
  let validRows = 0
  let inserted = 0
  let duplicated = 0
  let matchedSales = 0
  let pending = []

  for (const file of palletFiles) {
    const rows = readRows(file)
    console.log(`${basename(file)} palets: ${rows.length.toLocaleString('es-ES')} filas`)
    for (const row of rows) {
      totalRows += 1
      const docClean = cleanDocument(getValue(row, ['DcmtoVta']))
      const sale = docClean ? salesByDoc.get(docClean) : null
      if (sale) matchedSales += 1
      const pallet = palletFromRow(row, sale)
      if (!pallet.producto_confeccionado && !pallet['nº_palet']) continue
      validRows += 1
      const key = keyForPallet(pallet)
      if (existing.has(key)) {
        duplicated += 1
        continue
      }
      existing.add(key)
      pending.push(pallet)
      if (pending.length >= INSERT_CHUNK * 10) {
        inserted = await insertRows(pending, inserted, validRows)
        pending = []
      }
    }
  }

  if (pending.length) inserted = await insertRows(pending, inserted, validRows)
  console.log('\nConfeccion completada.')
  console.log(`Filas leidas: ${totalRows.toLocaleString('es-ES')}`)
  console.log(`Validas: ${validRows.toLocaleString('es-ES')}`)
  console.log(`Insertadas: ${inserted.toLocaleString('es-ES')}`)
  console.log(`Duplicadas: ${duplicated.toLocaleString('es-ES')}`)
  console.log(`Palets enlazados con venta: ${matchedSales.toLocaleString('es-ES')}`)
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
