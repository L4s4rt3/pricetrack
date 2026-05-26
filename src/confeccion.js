import { supabase } from './supabase.js'
import { debounce } from './utils.js'
import { shared } from './data.js'

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
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 3 }).format(n)
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
  const tipo = document.getElementById('conf-tipo')?.value || ''
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
        d.documento_limpio, d.denominacion_social, d.referencia, d.tipo
      ].filter(Boolean).join(' ').toLowerCase()
      if (!searchable.includes(q)) return false
    }
    if (cliente && d.cliente_nombre !== cliente) return false
    if (tipo && d.tipo !== tipo) return false
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
  setOpts('conf-tipo', uniq('tipo'), 'Todos los tipos')
  setOpts('conf-producto-base', uniq('producto_base'), 'Todos los productos')
  setOpts('conf-variedad', uniq('variedad'), 'Todas las variedades')
  setOpts('conf-calibre', uniq('calibre'), 'Todos los calibres')
  setOpts('conf-tipo-caja', uniq('tipo_caja'), 'Todos los tipos')
  setOpts('conf-situacion', uniq('situacion'), 'Todas las situaciones')
}

async function initConfeccion() {
  const tbody = document.getElementById('conf-tbody')
  if (tbody) tbody.innerHTML = '<tr><td colspan="14" class="empty-row">Cargando datos de confección...</td></tr>'
  try {
    data = await fetchConfeccion()
    shared.confeccion = data
  } catch (e) {
    console.error(e)
    if (tbody) tbody.innerHTML = `<tr><td colspan="14" class="empty-row" style="color:var(--color-error)">Error al cargar: ${e.message}</td></tr>`
    return
  }
  populateSelects()
  // Default: solo Producto
  const tipoSel = document.getElementById('conf-tipo')
  if (tipoSel && tipoSel.querySelector('option[value="Producto"]')) tipoSel.value = 'Producto'
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
  const soloProd = document.getElementById('conf-tipo')?.value === 'Producto'

  const totCajas = pageRows.reduce((s, d) => s + (d.cajas || 0), 0)
  const totKgNetos = pageRows.reduce((s, d) => s + parseFloat(d.kg_netos || 0), 0)
  const totKgFact = pageRows.reduce((s, d) => s + parseFloat(d.kg_facturados || 0), 0)
  const totPvp = pageRows.reduce((s, d) => s + parseFloat(d.pvp || 0), 0)
  const totBaseIva = pageRows.reduce((s, d) => s + parseFloat(d.base_iva || 0), 0)
  const avgPvpKg = soloProd ? rows.reduce((s, d) => {
    const pk = parseFloat(d.pvp_kg || 0)
    return pk > 0 ? s + pk : s
  }, 0) / Math.max(1, rows.filter(d => parseFloat(d.pvp_kg || 0) > 0).length) : 0

  const chips = [
    `<span class="summary-chip">${fmtNum(total)} palets</span>`,
    `<span class="summary-chip chip-blue">${fmtNum(totCajas)} cajas</span>`,
    `<span class="summary-chip chip-gold">${fmtKg(totKgNetos)} netos</span>`,
    `<span class="summary-chip">${fmtKg(totKgFact)} facturados</span>`,
  ]
  if (avgPvpKg > 0) chips.push(`<span class="summary-chip" style="background:var(--color-primary-light);color:var(--color-primary)">Ø ${fmtEur(avgPvpKg)}/kg</span>`)
  if (totPvp > 0) chips.push(`<span class="summary-chip">${fmtEur(totPvp)} PVP</span>`)
  if (totBaseIva > 0) chips.push(`<span class="summary-chip chip-gold">${fmtEur(totBaseIva)} base IVA</span>`)

  document.getElementById('conf-summary').innerHTML = chips.join('')

  const tbody = document.getElementById('conf-tbody')
  if (!pageRows.length) {
    tbody.innerHTML = '<tr><td colspan="14" class="empty-row">Sin resultados para los filtros aplicados</td></tr>'
  } else {
    const selected = data.find(d => d.id === selectedId)
    tbody.innerHTML = pageRows.map(d => {
      const isSelected = d.id === selectedId
      const hasCalibre = d.calibre && d.calibre !== 'CAL'
      const prodBase = d.producto_base || ''
      const variedad = d.variedad || ''
      const pvp = parseFloat(d.pvp || 0)
      const pvpKg = parseFloat(d.pvp_kg || 0)
      const baseIva = parseFloat(d.base_iva || 0)
      const detail = isSelected ? `
        <tr class="detail-row" id="detail-${d.id}">
          <td colspan="14" style="padding:0;background:var(--color-surface-offset)">
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:var(--space-2);padding:var(--space-4);font-size:var(--text-xs)">
              <div>
                <strong style="display:block;margin-bottom:var(--space-2);color:var(--color-primary)">Palet</strong>
                <div>Tipo: ${d.tipo_palet || '—'}</div>
                <div>Tipo registro: ${d.tipo || '—'}</div>
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
                <div>PVP/kg: ${pvpKg > 0 ? fmtEur(pvpKg) : '—'}</div>
                <div>PVP: ${pvp > 0 ? fmtEur(pvp) : '—'}</div>
                <div>Tarifa: ${d.tarifa ? fmtEur(d.tarifa) : '—'}</div>
                <div>Base IVA: ${baseIva > 0 ? fmtEur(baseIva) : '—'}</div>
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
          <td class="td-num" style="font-weight:${pvpKg > 0 ? 600 : 400};color:${pvpKg > 0 ? 'var(--color-primary)' : ''}">${pvpKg > 0 ? fmtEur(pvpKg) : '—'}</td>
          <td class="td-total">${pvp > 0 ? fmtEur(pvp) : '—'}</td>
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

const debouncedRenderConfeccion = debounce(() => { confPage = 0; renderConfeccion() }, 200)
window.debouncedRenderConfeccion = debouncedRenderConfeccion

let treeVisible = false
function toggleProductTree() {
  treeVisible = !treeVisible
  const el = document.getElementById('conf-tree')
  if (!el) return
  if (treeVisible) {
    el.innerHTML = buildProductTreeHTML()
    el.style.display = 'block'
    setTimeout(setupTreeClickHandlers, 0)
  } else {
    el.style.display = 'none'
  }
}
window.toggleProductTree = toggleProductTree

function buildProductTreeHTML() {
  const tree = {}
  for (const d of data) {
    if (d.tipo !== 'Producto') continue
    const base = d.producto_base || 'Otros'
    const varKey = d.variedad || 'Sin variedad'
    const calKey = d.calibre || 'Sin calibre'
    if (!tree[base]) tree[base] = { count: 0, kg: 0, variedades: {} }
    tree[base].count++
    tree[base].kg += parseFloat(d.kg_netos || 0)
    if (!tree[base].variedades[varKey]) tree[base].variedades[varKey] = { count: 0, kg: 0, calibres: {} }
    tree[base].variedades[varKey].count++
    tree[base].variedades[varKey].kg += parseFloat(d.kg_netos || 0)
    if (!tree[base].variedades[varKey].calibres[calKey]) tree[base].variedades[varKey].calibres[calKey] = { count: 0, kg: 0 }
    tree[base].variedades[varKey].calibres[calKey].count++
    tree[base].variedades[varKey].calibres[calKey].kg += parseFloat(d.kg_netos || 0)
  }

  const bases = Object.entries(tree).sort((a, b) => b[1].count - a[1].count)
  let html = '<div class="card" style="background:var(--color-surface-offset)"><div style="font-size:var(--text-xs);font-weight:600;color:var(--color-text-muted);margin-bottom:var(--space-3);text-transform:uppercase;letter-spacing:0.05em">Explorar productos</div>'
  for (const [base, bv] of bases) {
    const pct = ((bv.count / data.filter(d => d.tipo === 'Producto').length) * 100).toFixed(0)
    html += `<details style="margin-bottom:4px" ${Object.keys(tree).length <= 1 ? 'open' : ''}>
      <summary style="cursor:pointer;padding:6px 10px;border-radius:4px;font-size:var(--text-sm);font-weight:600;background:var(--color-surface);border:1px solid var(--color-border)">
        ${base} <span style="color:var(--color-text-muted);font-weight:400">— ${bv.count} palets · ${fmtKg(bv.kg)} (${pct}%)</span>
      </summary>
      <div style="padding:4px 0 4px 20px">`
    const variedades = Object.entries(bv.variedades).sort((a, b) => b[1].count - a[1].count)
    for (const [varKey, vv] of variedades) {
      html += `<details style="margin-bottom:2px" open>
        <summary style="cursor:pointer;padding:4px 8px;border-radius:3px;font-size:var(--text-xs);font-weight:500">
          ${varKey} <span style="color:var(--color-text-muted)">— ${vv.count} palets · ${fmtKg(vv.kg)}</span>
        </summary>
        <div style="padding:2px 0 2px 16px">`
      const calibres = Object.entries(vv.calibres).sort((a, b) => b[1].count - a[1].count)
      for (const [calKey, cv] of calibres) {
        html += `<div style="padding:3px 8px;font-size:var(--text-xs);cursor:pointer;border-radius:3px" class="tree-leaf" data-base="${base}" data-variedad="${varKey}" data-calibre="${calKey}">
          ${calKey} <span style="color:var(--color-text-muted)">— ${cv.count} palets · ${fmtKg(cv.kg)}</span>
        </div>`
      }
      html += `</div></details>`
    }
    html += `</div></details>`
  }
  html += '</div>'
  return html
}

function setupTreeClickHandlers() {
  document.querySelectorAll('.tree-leaf').forEach(el => {
    el.addEventListener('click', function () {
      const base = this.dataset.base
      const variedad = this.dataset.variedad
      const calibre = this.dataset.calibre
      const selBase = document.getElementById('conf-producto-base')
      const selVar = document.getElementById('conf-variedad')
      const selCal = document.getElementById('conf-calibre')
      if (selBase) selBase.value = base
      if (selVar) selVar.value = variedad
      if (selCal) selCal.value = calibre
      treeVisible = false
      const treeEl = document.getElementById('conf-tree')
      if (treeEl) treeEl.style.display = 'none'
      confPage = 0
      renderConfeccion()
    })
  })
}

function exportConfeccionCSV() {
  const rows = getFiltered()
  if (!rows.length) { showToastConf('Sin datos para exportar', 'error'); return }
  const headers = ['Nº Palet','Tipo Palet','Fecha','Producto','Lote','Documento','Cliente','Cajas','Tipo Caja','Kg Netos','Kg Facturados','Situación','Producto Base','Variedad','Calibre','PVP/kg','PVP','Referencia','Kilos Venta']
  const csv = [headers.join(';')]
  for (const d of rows) {
    csv.push([
      d.nº_palet || '', d.tipo_palet || '', d.fecha_confeccion || '', d.producto_confeccionado || '',
      d.lote || '', d.documento_limpio || d.documento_venta_original || '', d.cliente_nombre || '',
      d.cajas || 0, d.tipo_caja || '', d.kg_netos || 0, d.kg_facturados || 0, d.situacion || '',
      d.producto_base || '', d.variedad || '', d.calibre || '',
      d.pvp_kg || 0, d.pvp || 0, d.referencia || '', d.kilos_venta || 0,
    ].join(';'))
  }
  const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = 'confeccion_export.csv'; a.click()
  URL.revokeObjectURL(url)
  showToastConf(`Exportadas ${rows.length} filas`)
}
window.exportConfeccionCSV = exportConfeccionCSV

function showToastConf(msg, type) {
  const el = document.getElementById('conf-count')
  if (!el) return
  const orig = el.textContent
  el.textContent = '✓ ' + msg
  el.style.color = type === 'error' ? 'var(--color-error)' : 'var(--color-success)'
  setTimeout(() => { el.textContent = orig; el.style.color = '' }, 2500)
}

function confGoPage(p) {
  const total = getFiltered().length
  const maxP = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1)
  confPage = Math.max(0, Math.min(p, maxP))
  selectedId = null
  renderConfeccion()
}
window.confGoPage = confGoPage

initConfeccion()
