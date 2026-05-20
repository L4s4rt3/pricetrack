import { createClient } from '@supabase/supabase-js'
import XLSX from 'xlsx'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envFile = readFileSync(resolve(__dirname, '..', '.env'), 'utf8')
const env = {}
for (const line of envFile.split('\n')) {
  const m = line.match(/^\s*(\w+)\s*=\s*(.*?)\s*$/)
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)

const desktop = process.env.USERPROFILE + '/Desktop'

function leerExcel(nombre) {
  const wb = XLSX.readFile(desktop + '/' + nombre)
  const ws = wb.Sheets[wb.SheetNames[0]]
  return XLSX.utils.sheet_to_json(ws, { defval: '' })
}

const VARIEDADES_CONOCIDAS = [
  'VALENCIA EGIPTO', 'VALENCIA MIDKNIGHT', 'VALENCIA DELTA', 'VALENCIA LATE',
  'NAVEL POWELL', 'NAVEL POWEL', 'NAVEL CARACARA', 'LANE LATE',
  'CARACARA', 'NAVELINA', 'SALUSTIANA', 'BARBERINA', 'BARNFIELD',
  'VALENCIA', 'NAVEL', 'ORRI', 'CLEMENTINA', 'TANGO', 'NADORCOTT',
  'NOVA', 'SATSUMA', 'VERNA', 'FINO',
].sort((a, b) => b.length - a.length)

const BASES_CONOCIDAS = new Set(['NAR', 'LIM', 'LIMON', 'MAND', 'POMELO'])

function escaparRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function parsearArticulo(art) {
  if (!art) return { producto_base: '', variedad: '', calibre: '' }
  const tokens = art.trim().split(/\s+/)

  // 1. Extraer calibre (cualquier token que empiece con CAL)
  const resto = []
  let calibre = ''
  for (const t of tokens) {
    if (/^CAL/i.test(t)) {
      if (!calibre) calibre = t // primer calibre encontrado
    } else {
      resto.push(t)
    }
  }

  // 2. Detectar variedad conocida en el texto restante
  const restoStr = resto.join(' ')
  let variedad = ''
  for (const v of VARIEDADES_CONOCIDAS) {
    const re = new RegExp('\\b' + escaparRegex(v) + '\\b', 'i')
    if (re.test(restoStr)) {
      variedad = v
      break
    }
  }

  // 3. Producto base = primer token, normalizar si no es conocido
  let producto_base = resto[0] || ''
  if (producto_base && !BASES_CONOCIDAS.has(producto_base.toUpperCase())) {
    // Si el primer token no es una base conocida, asumir NAR
    producto_base = 'NAR'
  }

  return { producto_base, variedad, calibre }
}

function limpiarDocumento(dcmto) {
  if (!dcmto) return ''
  return dcmto.replace(/^Alb\.\s*/i, '').trim()
}

function convertirFecha(val) {
  if (!val) return null
  if (typeof val === 'number') {
    // Serial number de Excel
    const d = new Date((val - 25569) * 86400 * 1000)
    return d.toISOString().split('T')[0]
  }
  const s = String(val).trim()
  // DD/MM/YYYY
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`
  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  return null
}

async function importar() {
  console.log('Leyendo archivos...')

  // mayo 2: líneas de venta
  const ventas = leerExcel('mayo 2.xlsx')
  console.log(`mayo 2.xlsx: ${ventas.length} filas`)

  // Construir lookup por Documento
  const ventasPorDoc = {}
  for (const v of ventas) {
    const doc = (v.Documento || '').toString().trim()
    if (!doc) continue
    if (!ventasPorDoc[doc]) ventasPorDoc[doc] = []
    ventasPorDoc[doc].push({
      cliente_id: String(v.Cliente || ''),
      cc: String(v.CC || ''),
      denominacion_social: v['Denominación social'] || '',
      matricula: v.Matrícula || '',
      fecha_fra: convertirFecha(v['Fecha Fra.']),
      factura: v.Factura || '',
      linea: parseInt(v.Lin) || 0,
      referencia: String(v.Referencia || ''),
      articulo_venta: v.Articulo || '',
      kilos_venta: parseFloat(v.KILOS) || 0,
      unidades: parseInt(v.UNID) || 0,
      litros: parseFloat(v.LITROS) || 0,
      tarifa: parseFloat(v.Tarifa) || 0,
      pvp: parseFloat(v.PVP) || 0,
      coste_adic: parseFloat(v.CosteAdic) || 0,
      base_iva: parseFloat(v['Base Iva']) || 0,
    })
  }

  // mayo 6: confección/palets
  const palets = leerExcel('mayo 6.xlsx')
  console.log(`mayo 6.xlsx: ${palets.length} filas`)

  const registros = []
  let sinDoc = 0, conDoc = 0

  for (const p of palets) {
    const docOriginal = (p.DcmtoVta || '').toString().trim()
    const docLimpio = limpiarDocumento(docOriginal)
    const ventaMatch = docLimpio ? ventasPorDoc[docLimpio] : null
    const venta = ventaMatch?.[0] || {}
    const parsed = parsearArticulo(p['Denominación Producto'] || '')

    registros.push({
      tipo_palet: p.TipoPalet || '',
      nº_palet: parseInt(p['NºPalet']) || null,
      fecha_confeccion: convertirFecha(p.Fecha),
      producto_confeccionado: p['Denominación Producto'] || '',
      lote: p.Lote || '',
      documento_venta_original: docOriginal,
      documento_limpio: docLimpio,
      fecha_documento: convertirFecha(p.Fecha),
      cliente_nombre: p.Cliente || '',
      cajas: parseInt(p.Cajas) || 0,
      tipo_caja: p.TipoCaja || '',
      kg_netos: parseFloat(p.Netos) || 0,
      kg_facturados: parseFloat(p['Fact.']) || 0,
      situacion: p.Sit || '',
      cliente_id: venta.cliente_id || '',
      cc: venta.cc || '',
      denominacion_social: venta.denominacion_social || '',
      matricula: venta.matricula || '',
      fecha_fra: convertirFecha(venta.fecha_fra),
      factura: venta.factura || '',
      linea: venta.linea || null,
      referencia: venta.referencia || '',
      articulo_venta: venta.articulo_venta || '',
      kilos_venta: venta.kilos_venta || 0,
      unidades: venta.unidades || 0,
      litros: venta.litros || 0,
      tarifa: venta.tarifa || 0,
      pvp: venta.pvp || 0,
      coste_adic: venta.coste_adic || 0,
      base_iva: venta.base_iva || 0,
      producto_base: parsed.producto_base,
      variedad: parsed.variedad,
      calibre: parsed.calibre,
    })

    if (docLimpio) conDoc++; else sinDoc++
  }

  console.log(`\nPalets con documento: ${conDoc} | sin documento: ${sinDoc}`)
  console.log(`Total registros a insertar: ${registros.length}`)

  // Insertar en lotes de 500
  const CHUNK = 500
  let total = 0
  for (let i = 0; i < registros.length; i += CHUNK) {
    const lote = registros.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('ventas_confeccion_detalle')
      .insert(lote)
    if (error) {
      console.error(`Error lote ${i / CHUNK + 1}:`, error.message)
      process.exit(1)
    }
    total += lote.length
    console.log(`Insertados ${total}/${registros.length}`)
  }

  console.log(`\n✓ Importación completada: ${total} registros`)
}

importar().catch(e => { console.error(e); process.exit(1) })
