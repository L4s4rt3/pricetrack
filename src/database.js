import { supabase } from './supabase.js'

const TABLE = 'precios'
const FILTER_OPTIONS_VIEW = 'precios_filter_options'
const SELECT_COLUMNS = 'id,producto,categoria,precio,unidad,ano,mes,notas,created_at'
const DEFAULT_PAGE_SIZE = 100

function normalizeList(values) {
  return [...new Set(values.filter(v => v !== null && v !== undefined && String(v).trim() !== '').map(String))].sort((a, b) => a.localeCompare(b, 'es', { numeric: true }))
}

function sanitizeSearchTerm(value) {
  return String(value || '').trim().replace(/[,*()%]/g, ' ').replace(/\s+/g, ' ')
}

function periodKey(row) {
  const month = Number(row.month ?? row.mes ?? 12) || 12
  return Number(row.year ?? row.ano ?? 0) * 100 + month
}

function subtractMonths(year, month, monthsBack) {
  const date = new Date(year, (month || 12) - 1, 1)
  date.setMonth(date.getMonth() - monthsBack)
  return { year: date.getFullYear(), month: date.getMonth() + 1 }
}

export async function fetchRecentRecords({ months = 3, limit = 3000 } = {}) {
  const { data: latestRows, error: latestError } = await supabase
    .from(TABLE)
    .select('ano,mes')
    .order('ano', { ascending: false })
    .order('mes', { ascending: false, nullsFirst: false })
    .limit(1)

  if (latestError) throw latestError
  const latest = latestRows?.[0]
  if (!latest) return []

  const latestYear = Number(latest.ano)
  const latestMonth = Number(latest.mes || 12)
  const from = subtractMonths(latestYear, latestMonth, Math.max(months - 1, 0))
  const minPeriod = from.year * 100 + from.month

  const { data, error } = await supabase
    .from(TABLE)
    .select(SELECT_COLUMNS)
    .or(`ano.gt.${from.year},and(ano.eq.${from.year},mes.gte.${from.month})`)
    .order('ano', { ascending: false })
    .order('mes', { ascending: false, nullsFirst: false })
    .order('id', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data || [])
    .map(normalizeRow)
    .filter(row => periodKey(row) >= minPeriod)
}

export async function fetchRecordsPage({
  search = '',
  product = '',
  year = null,
  month = null,
  category = '',
  page = 0,
  pageSize = DEFAULT_PAGE_SIZE,
  sort = 'desc',
} = {}) {
  const from = Math.max(page, 0) * pageSize
  const to = from + pageSize - 1
  const ascending = sort === 'asc'
  const cleanSearch = sanitizeSearchTerm(search)

  let query = supabase
    .from(TABLE)
    .select(SELECT_COLUMNS, { count: 'exact' })

  if (cleanSearch) {
    query = query.or(`producto.ilike.*${cleanSearch}*,categoria.ilike.*${cleanSearch}*`)
  }
  if (product) query = query.eq('producto', product)
  if (year) query = query.eq('ano', year)
  if (month) query = query.eq('mes', month)
  if (category) query = query.eq('categoria', category)

  const { data, error, count } = await query
    .order('ano', { ascending })
    .order('mes', { ascending, nullsFirst: false })
    .order('id', { ascending })
    .range(from, to)

  if (error) throw error
  return {
    rows: (data || []).map(normalizeRow),
    total: count || 0,
    page,
    pageSize,
  }
}

export async function fetchFilterOptions() {
  const { data: viewRows, error: viewError } = await supabase
    .from(FILTER_OPTIONS_VIEW)
    .select('tipo,valor')
    .order('tipo', { ascending: true })
    .order('valor', { ascending: true })

  if (!viewError && viewRows) {
    return {
      years: normalizeList(viewRows.filter(row => row.tipo === 'ano').map(row => row.valor)).map(Number).sort((a, b) => a - b),
      products: normalizeList(viewRows.filter(row => row.tipo === 'producto').map(row => row.valor)),
      categories: normalizeList(viewRows.filter(row => row.tipo === 'categoria').map(row => row.valor)),
    }
  }

  const { data, error } = await supabase
    .from(TABLE)
    .select('ano,producto,categoria')
    .limit(10000)

  if (error) throw error
  return {
    years: [...new Set((data || []).map(row => Number(row.ano)).filter(Boolean))].sort((a, b) => a - b),
    products: normalizeList((data || []).map(row => row.producto)),
    categories: normalizeList((data || []).map(row => row.categoria)),
  }
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
