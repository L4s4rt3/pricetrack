import { supabase } from './supabase.js'

const TABLE = 'precios'

export async function fetchAllRecords() {
  const { data, error } = await supabase
    .from(TABLE)
    .select('*')
    .order('ano', { ascending: false })
    .order('mes', { ascending: true })
  if (error) throw error
  return (data || []).map(normalizeRow)
}

export function normalizeRow(row) {
  return {
    id: row.id,
    product: row.producto || row.product || '',
    category: row.categoria || row.category || 'Sin categoría',
    price: Number(row.precio ?? row.price ?? 0),
    unit: row.unidad || row.unit || '€/ud',
    year: Number(row.ano ?? row.year ?? new Date().getFullYear()),
    month: Number(row.mes ?? row.month ?? 0) || null,
    notes: row.notas || row.notes || '',
  }
}

function toDb(record) {
  return {
    producto: record.product,
    categoria: record.category,
    precio: record.price,
    unidad: record.unit,
    ano: record.year,
    mes: record.month || null,
    notas: record.notes || '',
  }
}

export async function addRecord(record) {
  const db = toDb(record)
  const { data, error } = await supabase.from(TABLE).insert(db).select()
  if (error) throw error
  return data ? normalizeRow(data[0]) : null
}

export async function addRecords(records) {
  const db = records.map(toDb)
  const { data, error } = await supabase.from(TABLE).insert(db).select()
  if (error) throw error
  return (data || []).map(normalizeRow)
}

export async function deleteRecord(id) {
  const { error } = await supabase.from(TABLE).delete().eq('id', id)
  if (error) throw error
}

export function subscribeToChanges(onChange) {
  return supabase
    .channel('precios-changes')
    .on('postgres_changes',
      { event: '*', schema: 'public', table: TABLE },
      (payload) => {
        onChange(payload)
      }
    )
    .subscribe()
}
