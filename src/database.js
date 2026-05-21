import { supabase } from './supabase.js'

const TABLE = 'precios'
const PAGE_SIZE = 1000

export async function fetchAllRecords(onProgress) {
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from(TABLE)
      .select('*')
      .order('ano', { ascending: false })
      .order('mes', { ascending: true })
      .range(from, from + PAGE_SIZE - 1)
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data)
    if (onProgress) onProgress(all.length)
    if (data.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }
  return all.map(normalizeRow)
}

export function normalizeRow(row) {
  return {
    id: row.id,
    product: row.producto || '',
    category: row.categoria || 'Sin categoría',
    price: Number(row.precio ?? 0),
    unit: row.unidad || 'kg',
    year: Number(row.ano ?? new Date().getFullYear()),
    month: Number(row.mes ?? 0) || null,
    notes: row.notas || '',
    cliente: row.cliente || '',
    denominacion_social: row.denominacion_social || '',
    referencia: row.referencia || '',
    kilos: Number(row.kilos ?? 0),
    unidades: Number(row.unidades ?? 0),
    litros: Number(row.litros ?? 0),
    tarifa: Number(row.tarifa ?? 0),
    coste_adic: Number(row.coste_adic ?? 0),
    base_iva: Number(row.base_iva ?? 0),
    documento: row.documento || '',
    factura: row.factura || '',
    fecha_fra: row.fecha_fra || '',
    lin: Number(row.lin ?? 0),
    created_at: row.created_at || '',
  }
}

function cleanDbText(value) {
  return String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function cleanDbNumber(value) {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

function toDb(r) {
  return {
    producto: cleanDbText(r.product),
    categoria: cleanDbText(r.category || 'Sin categoria'),
    precio: cleanDbNumber(r.price),
    unidad: cleanDbText(r.unit || 'kg'),
    ano: cleanDbNumber(r.year) || new Date().getFullYear(),
    mes: r.month ? cleanDbNumber(r.month) : null,
    notas: cleanDbText(r.notes),
    cliente: cleanDbText(r.cliente),
    denominacion_social: cleanDbText(r.denominacion_social),
    referencia: cleanDbText(r.referencia),
    kilos: cleanDbNumber(r.kilos),
    unidades: cleanDbNumber(r.unidades),
    litros: cleanDbNumber(r.litros),
    tarifa: cleanDbNumber(r.tarifa),
    coste_adic: cleanDbNumber(r.coste_adic),
    base_iva: cleanDbNumber(r.base_iva),
    documento: cleanDbText(r.documento),
    factura: cleanDbText(r.factura),
    fecha_fra: cleanDbText(r.fecha_fra),
    lin: cleanDbNumber(r.lin),
  }
}

export async function addRecord(record) {
  const { data, error } = await supabase.from(TABLE).insert(toDb(record)).select()
  if (error) throw error
  return data ? normalizeRow(data[0]) : null
}

export async function addRecords(records, onProgress) {
  const CHUNK = 500
  let all = []
  for (let i = 0; i < records.length; i += CHUNK) {
    const { data, error } = await supabase
      .from(TABLE)
      .insert(records.slice(i, i + CHUNK).map(toDb))
      .select()
    if (error) throw error
    if (data) all = all.concat(data.map(normalizeRow))
    if (onProgress) onProgress(Math.min(i + CHUNK, records.length), records.length)
  }
  return all
}

export async function updateRecords(records, onProgress) {
  const CHUNK = 200
  let all = []
  for (let i = 0; i < records.length; i += CHUNK) {
    const chunk = records.slice(i, i + CHUNK)
    const updated = await Promise.all(chunk.map(async record => {
      const { data, error } = await supabase
        .from(TABLE)
        .update(toDb(record))
        .eq('id', record.id)
        .select()
        .single()
      if (error) throw error
      return data ? normalizeRow(data) : null
    }))
    all = all.concat(updated.filter(Boolean))
    if (onProgress) onProgress(Math.min(i + CHUNK, records.length), records.length)
  }
  return all
}

export async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export async function deleteAllRecords(onProgress) {
  const { data: deletedCount, error: rpcError } = await supabase.rpc('delete_all_precios')
  if (!rpcError) {
    if (onProgress) onProgress(Number(deletedCount) || 0)
    return
  }

  const canFallback =
    rpcError.code === 'PGRST202' ||
    /schema cache|function .*delete_all_precios|could not find the function/i.test(rpcError.message || '')

  if (!canFallback) throw rpcError

  const CHUNK = 500
  let deleted = 0

  while (true) {
    const { data, error: fetchError } = await supabase
      .from(TABLE)
      .select('id')
      .order('id', { ascending: true })
      .limit(CHUNK)

    if (fetchError) throw fetchError
    if (!data?.length) break

    const { error: deleteError } = await supabase
      .from(TABLE)
      .delete()
      .in('id', data.map(row => row.id))

    if (deleteError) throw deleteError
    deleted += data.length
    if (onProgress) onProgress(deleted)
    if (data.length < CHUNK) break
  }
}

export function subscribeToChanges(onChange) {
  return supabase
    .channel('precios-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: TABLE }, onChange)
    .subscribe()
}
