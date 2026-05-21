import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve } from 'path'
import { fileURLToPath } from 'url'

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)))
const TABLE = 'precios'
const PAGE_SIZE = 1000
const DELETE_CHUNK = 500

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
  return String(value ?? '').replace(/\u0000/g, '').trim()
}

function isUnreadableProductName(value) {
  const text = cleanText(value)
  if (!text) return true
  if (/PK\x03\x04|Content_Types|docProps|workbook|sharedStrings/i.test(text)) return true
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(text)) return true
  const visible = [...text].filter(ch => !/\s/.test(ch))
  if (visible.length < 8) return false
  const bad = visible.filter(ch => !/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÇçÀÈÌÒÙàèìòù.,;:()\/+\-'ºª&%€#]/.test(ch)).length
  return bad / visible.length > 0.18
}

function isBinaryProductName(value) {
  const text = cleanText(value)
  if (/PK\x03\x04|Content_Types|docProps|workbook|sharedStrings/i.test(text)) return true
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(text)) return true
  const visible = [...text].filter(ch => !/\s/.test(ch))
  if (visible.length < 8) return false
  const bad = visible.filter(ch => !/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÇçÀÈÌÒÙàèìòù.,;:()\/+\-'ºª&%€#]/.test(ch)).length
  return bad / visible.length > 0.35
}

function hasNoEconomicValue(row) {
  return ['precio', 'base_iva', 'kilos', 'unidades', 'litros', 'tarifa', 'coste_adic']
    .every(field => Math.abs(Number(row[field] || 0)) === 0)
}

function shouldDelete(row) {
  return hasNoEconomicValue(row) && (isUnreadableProductName(row.producto) || isBinaryProductName(row.producto))
}

async function fetchCorruptRows() {
  const rows = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('id,producto,categoria,precio,base_iva,kilos,unidades,litros,tarifa,coste_adic,ano,mes')
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    for (const row of data) if (shouldDelete(row)) rows.push(row)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
    if (from % 25000 === 0) console.log(`Revisados ${from.toLocaleString('es-ES')} registros...`)
  }
  return rows
}

async function deleteRows(rows) {
  let deleted = 0
  for (let i = 0; i < rows.length; i += DELETE_CHUNK) {
    const ids = rows.slice(i, i + DELETE_CHUNK).map(row => row.id)
    const { error } = await supabase.from(TABLE).delete().in('id', ids)
    if (error) throw error
    deleted += ids.length
    console.log(`Borrados ${deleted.toLocaleString('es-ES')}/${rows.length.toLocaleString('es-ES')}`)
  }
}

async function main() {
  const apply = process.argv.includes('--apply')
  const corrupt = await fetchCorruptRows()
  console.log(`Filas corruptas detectadas: ${corrupt.length.toLocaleString('es-ES')}`)
  for (const row of corrupt.slice(0, 10)) {
    console.log(`#${row.id} ${String(row.producto || '').slice(0, 120)}`)
  }
  if (!apply) {
    console.log('Vista previa solamente. Ejecuta con --apply para borrar.')
    return
  }
  await deleteRows(corrupt)
  console.log('Limpieza completada.')
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
