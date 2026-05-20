import { supabase } from './supabase.js'

const CHUNK = 2000
let data = []
let confPage = 0
const PAGE_SIZE = 50
let selectedId = null

function fmtNum(n) {
  return new Intl.NumberFormat('es-ES').format(Math.round(n))
}

function fmtKg(n) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' kg'
}

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtEur(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

async function fetchConfeccion() {
  let all = [], from = 0
  while (true) {
    const { data, error } = await supabase
      .from('ventas_confeccion_detalle')
      .select('*')
      .order('nº_palet', { ascending: false })
      .range(from, from + CHUNK - 1)
    if (error) throw error
    if (!data?.length) break
    all = all.concat(data)
    if (data.length < CHUNK) break
    from += CHUNK
  }
  return all
}

function getFiltered() {
  const q = (document.getElementById('conf-search')?.value || '').toLowerCase()
  const cliente = document.getElementById('conf-cliente')?.value || ''
  const prodBase = document.getElementById('conf-producto-base')?.value || ''
  const variedad = document.getElementById('conf-variedad')?.value || ''
  const calibre = document.getElementById('conf-calibre')?.value || ''
  const tipoCaja = document.getElementById('conf-tipo-caja')?.value || ''
  const situacion = document.getElementById('conf-situacion')?.value || ''
  const fechaFrom = document.getElementById('conf-fecha-from')?.value || ''
  const fechaTo = document.getElementById('conf-fecha-to')?.value || ''

  return data.filter(d => {
    if (q) {
      const searchable = [
        d.cliente_nombre, d.producto_confeccionado, d.producto_base,
        d.variedad, d.calibre, d.lote, d.tipo_caja, String(d.nº_palet || ''),
        d.documento_limpio, d.denominacion_social, d.referencia
      ].filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    if (cliente && d.cliente_nombre !== cliente) return false
    if (prodBase && d.producto_base !== prodBase) return false
    if (variedad && d.variedad !== variedad) return false
    if (calibre && d.calibre !== calibre) return false
    if (tipoCaja && d.tipo_caja !== tipoCaja) return false
    if (situacion && d.situacion !== situacion) return false
    if (fechaFrom && d.fecha_confeccion && d.fecha_confeccion < fechaFrom) return false
    if (fechaTo && d.fecha_confeccion && d.fecha_confeccion > fechaTo) return false
    return true
  })
}

function populateSelects() {
  const uniq = field => [...new Set(data.map(d => d[field]).filter(Boolean))].sort()
  const setOpts = (id, items, allLabel) => {
    const el = document.getElementById(id)
    if (!el) return
    el.innerHTML = `<option value="">${allLabel}</option>` + items.map(i => `<option value="${i}">${i}</option>`).join('')
  }
  setOpts('conf-cliente', uniq('cliente_nombre'), 'Todos los clientes')
  setOpts('conf-producto-base', uniq('producto_base'), 'Todos los productos')
  setOpts('conf-variedad', uniq('variedad'), 'Todas las variedades')
  setOpts('conf-calibre', uniq('calibre'), 'Todos los calibres')
  setOpts('conf-tipo-caja', uniq('tipo_caja'), 'Todos los tipos')
  setOpts('conf-situacion', uniq('situacion'), 'Todas las situaciones')
}

async function initConfeccion() {
  const tbody = document.getElementById('conf-tbody')
  if (tbody) tbody.innerHTML = '<tr><td colspan="12" class="empty-row">Cargando datos de confección...</td></tr>'
  try {
    data = await fetchConfeccion()
  } catch (e) {
    console.error(e)
    if (tbody) tbody.innerHTML = `<tr><td colspan="12" class="empty-row" style="color:var(--color-error)">Error al cargar: ${e.message}</td></tr>`
    return
  }
  populateSelects()
  renderConfeccion()
}

function formatDate(d) {
  if (!d) return '—'
  const parts = d.split('-')
  if (parts.length !== 3) return d
  return `${parts[2]}/${parts[1]}/${parts[0]}`
}

function selectRow(id) {
  selectedId = selectedId === id ? null : id
  renderConfeccion()
}

window.selectRow = selectRow

function renderConfeccion() {
  const rows = getFiltered()
  const total = rows.length
  const start = confPage * PAGE_SIZE
  const pageRows = rows.slice(start, start + PAGE_SIZE)

  const totCajas = pageRows.reduce((s, d) => s + (d.cajas || 0), 0)
  const totKgNetos = pageRows.reduce((s, d) => s + parseFloat(d.kg_netos || 0), 0)
  const totKgFact = pageRows.reduce((s, d) => s + parseFloat(d.kg_facturados || 0), 0)

  document.getElementById('conf-summary').innerHTML = `
    <span class="summary-chip">${fmtNum(total)} palets</span>
    <span class="summary-chip chip-blue">${fmtNum(totCajas)} cajas</span>
    <span class="summary-chip chip-gold">${fmtKg(totKgNetos)} netos</span>
    <span class="summary-chip">${fmtKg(totKgFact)} facturados</span>
  `

  const tbody = document.getElementById('conf-tbody')
  if (!pageRows.length) {
    tbody.innerHTML = '<tr><td colspan="12" class="empty-row">Sin resultados para los filtros aplicados</td></tr>'
  } else {
    const selected = data.find(d => d.id === selectedId)
    tbody.innerHTML = pageRows.map(d => {
      const isSelected = d.id === selectedId
      const hasCalibre = d.calibre && d.calibre !== 'CAL'
      const prodBase = d.producto_base || ''
      const variedad = d.variedad || ''
      const detail = isSelected ? `
        <tr class="detail-row" id="detail-${d.id}">
          <td colspan="12" style="padding:0;background:var(--color-surface-offset)">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-2);padding:var(--space-4);font-size:var(--text-xs)">
              <div>
                <strong style="display:block;margin-bottom:var(--space-2);color:var(--color-primary)">Palet</strong>
                <div>Tipo: ${d.tipo_palet || '—'}</div>
                <div>Fecha conf.: ${formatDate(d.fecha_confeccion)}</div>
                <div>Lote: ${d.lote || '—'}</div>
                <div>Situación: ${d.situacion || '—'}</div>
                <div>Fecha doc.: ${formatDate(d.fecha_documento)}</div>
              </div>
              <div>
                <strong style="display:block;margin-bottom:var(--space-2);color:var(--color-primary)">Venta</strong>
                <div>Documento: ${d.documento_limpio || d.documento_venta_original || '—'}</div>
                <div>Ref.: ${d.referencia || '—'}</div>
                <div>Factura: ${d.factura || '—'}</div>
                <div>Fecha fra.: ${formatDate(d.fecha_fra)}</div>
                <div>Línea: ${d.linea || '—'}</div>
                <div>Artículo venta: ${d.articulo_venta || '—'}</div>
              </div>
              <div>
                <strong style="display:block;margin-bottom:var(--space-2);color:var(--color-primary)">Precios</strong>
                <div>Kilos venta: ${d.kilos_venta ? fmtKg(d.kilos_venta) : '—'}</div>
                <div>Unidades: ${d.unidades || '—'}</div>
                <div>Litros: ${d.litros || '—'}</div>
                <div>PVP: ${d.pvp ? fmtEur(d.pvp) : '—'}</div>
                <div>Tarifa: ${d.tarifa ? fmtEur(d.tarifa) : '—'}</div>
                <div>Base IVA: ${d.base_iva ? fmtEur(d.base_iva) : '—'}</div>
                <div>Coste adic.: ${d.coste_adic ? fmtEur(d.coste_adic) : '—'}</div>
              </div>
            </div>
          </td>
        </tr>` : ''
      return `
        <tr class="cli-row" onclick="selectRow(${d.id})" style="${isSelected ? 'background:var(--color-primary-light)' : ''}">
          <td><strong>#${d.nº_palet || '?'}</strong></td>
          <td class="td-product" title="${d.producto_confeccionado || ''}">${d.producto_confeccionado || '—'}</td>
          <td>${prodBase}${variedad ? ' · ' + variedad : ''}</td>
          <td>${hasCalibre ? d.calibre : '—'}</td>
          <td class="td-num">${d.cajas || 0}</td>
          <td>${d.tipo_caja || '—'}</td>
          <td class="td-num">${d.kg_netos ? fmt(parseFloat(d.kg_netos)) + ' kg' : '—'}</td>
          <td class="td-num">${d.kg_facturados ? fmt(parseFloat(d.kg_facturados)) + ' kg' : '—'}</td>
          <td class="td-client" title="${d.cliente_nombre || ''}">${d.cliente_nombre || '—'}</td>
          <td class="td-doc" title="${d.documento_venta_original || ''}">${d.documento_limpio || d.documento_venta_original || '—'}</td>
          <td class="td-ref">${d.lote || '—'}</td>
          <td>${d.situacion || '—'}</td>
        </tr>${detail}`
    }).join('')
  }

  const totalPages = Math.ceil(total / PAGE_SIZE)
  const pag = document.getElementById('conf-pagination')
  if (pag) {
    pag.innerHTML = totalPages <= 1 ? '' : `
      <button class="btn btn-ghost pag-btn" onclick="confGoPage(0)" ${confPage===0?'disabled':''}>«</button>
      <button class="btn btn-ghost pag-btn" onclick="confGoPage(${confPage-1})" ${confPage===0?'disabled':''}>‹</button>
      <span class="pag-info">Pág. ${confPage+1} de ${totalPages}</span>
      <button class="btn btn-ghost pag-btn" onclick="confGoPage(${confPage+1})" ${confPage>=totalPages-1?'disabled':''}>›</button>
      <button class="btn btn-ghost pag-btn" onclick="confGoPage(${totalPages-1})" ${confPage>=totalPages-1?'disabled':''}>»</button>
    `
  }

  document.getElementById('conf-count').textContent =
    `Mostrando ${start+1}–${Math.min(start+PAGE_SIZE, total)} de ${fmtNum(total)} registros`
}

window.renderConfeccion = renderConfeccion

function confGoPage(p) {
  const total = getFiltered().length
  const maxP = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  confPage = Math.max(0, Math.min(p, maxP))
  selectedId = null
  renderConfeccion()
}
window.confGoPage = confGoPage

initConfeccion()
