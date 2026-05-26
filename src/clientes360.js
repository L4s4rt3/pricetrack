import { shared, getClientData, getProductTree } from './data.js'
import { debounce } from './utils.js'

let selectedClient = null

function fmt(n) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtNum(n) {
  return new Intl.NumberFormat('es-ES').format(Math.round(n))
}

function fmtKg(n) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n) + ' kg'
}

function fmtEur(n) {
  return new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR', minimumFractionDigits: 2 }).format(n)
}

function getUniqueClientes() {
  const map = new Map()
  for (const d of shared.precios) {
    const name = d.denominacion_social || d.cliente || ''
    if (!name) continue
    if (!map.has(name)) map.set(name, { nombre: name, codigo: d.cliente || '', fuente: 'precios', rev: 0, kg: 0 })
    map.get(name).rev += d.base_iva
    map.get(name).kg += d.kilos
  }
  for (const d of shared.confeccion) {
    const name = d.cliente_nombre || d.denominacion_social || ''
    if (!name) continue
    if (!map.has(name)) map.set(name, { nombre: name, codigo: d.cliente_id || '', fuente: 'confeccion', rev: 0, kg: 0 })
    map.get(name).rev += parseFloat(d.base_iva || 0)
    map.get(name).kg += parseFloat(d.kg_netos || 0)
  }
  return [...map.values()].sort((a, b) => b.rev - a.rev)
}

async function ensureData() {
  if (shared.precios.length === 0 && window.ensurePreciosLoaded) {
    document.getElementById('cli360-content').innerHTML = '<div class="loading-card" style="margin:var(--space-6)"><div class="loading-spinner"></div><div><div class="loading-title">Cargando datos de clientes</div><div class="loading-text">Conectando…</div></div></div>'
    await window.ensurePreciosLoaded()
  }
  // Confeccion loads independently, check periodically
  if (shared.confeccion.length === 0) {
    await new Promise(resolve => {
      const check = () => {
        if (shared.confeccion.length > 0) resolve()
        else setTimeout(check, 200)
      }
      check()
    })
  }
}

function renderClientList(clientes, searchTerm) {
  const filtered = searchTerm
    ? clientes.filter(c => c.nombre.toLowerCase().includes(searchTerm.toLowerCase()))
    : clientes

  document.getElementById('cli360-content').innerHTML = `
    <div style="display:flex;align-items:center;gap:var(--space-4);flex-wrap:wrap;margin-bottom:var(--space-4)">
      <div class="search-box" style="flex:1;min-width:200px">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:14px;height:14px;color:var(--color-text-faint)"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input type="text" class="form-input" id="cli360-search-input" placeholder="Buscar cliente..." style="padding-left:32px" autocomplete="off">
      </div>
      <span style="font-size:var(--text-xs);color:var(--color-text-muted)">${fmtNum(filtered.length)} clientes</span>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Cliente</th><th>Código</th><th>Facturado (€)</th><th>KG</th><th>Palets</th><th></th></tr></thead>
        <tbody>
          ${filtered.length === 0
            ? '<tr><td colspan="6" class="empty-row">Sin resultados</td></tr>'
            : filtered.slice(0, 100).map(c => {
              const conf = shared.confeccion.filter(d => (d.cliente_nombre || d.denominacion_social || '').toLowerCase() === c.nombre.toLowerCase())
              return `<tr class="cli-row" onclick="window.selectCliente360('${c.nombre.replace(/'/g, "\\'")}')">
                <td><strong>${c.nombre}</strong></td>
                <td style="color:var(--color-text-muted);font-size:var(--text-xs)">${c.codigo || '—'}</td>
                <td class="td-total">${c.rev > 0 ? fmtEur(c.rev) : '—'}</td>
                <td class="td-num">${c.kg > 0 ? fmtKg(c.kg) : '—'}</td>
                <td class="td-num">${conf.length > 0 ? fmtNum(conf.length) : '—'}</td>
                <td><button class="btn btn-ghost" style="font-size:0.8em">Ver →</button></td>
              </tr>`
            }).join('')
          }
        </tbody>
      </table>
    </div>
    ${filtered.length > 100 ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2)">Mostrando 100 de ${fmtNum(filtered.length)}</p>` : ''}
  `

  const input = document.getElementById('cli360-search-input')
  if (input) {
    const debounced = debounce(() => renderClientList(clientes, input.value), 200)
    input.addEventListener('input', debounced)
    if (searchTerm) input.value = searchTerm
  }
}

window.selectCliente360 = function (nombre) {
  selectedClient = nombre
  renderClienteDetail(nombre)
}

function renderClienteDetail(nombre) {
  const precios = shared.precios.filter(d => {
    const cli = (d.denominacion_social || d.cliente || '').toLowerCase()
    return cli === nombre.toLowerCase()
  })
  const confeccion = shared.confeccion.filter(d => {
    const cli = (d.cliente_nombre || d.denominacion_social || '').toLowerCase()
    return cli === nombre.toLowerCase()
  })

  const totalRev = precios.reduce((s, d) => s + d.base_iva, 0) + confeccion.reduce((s, d) => s + parseFloat(d.base_iva || 0), 0)
  const totalKg = precios.reduce((s, d) => s + d.kilos, 0) + confeccion.reduce((s, d) => s + parseFloat(d.kg_netos || 0), 0)
  const totalPalets = confeccion.length
  const totalDocs = new Set([...precios.map(d => d.documento || ''), ...confeccion.map(d => d.documento_limpio || '')].filter(Boolean)).size

  // Productos que compra (desde confeccion)
  const prodMap = {}
  for (const d of confeccion) {
    const key = d.producto_base + '|' + (d.variedad || '') + '|' + (d.calibre || '')
    if (!prodMap[key]) prodMap[key] = { base: d.producto_base, variedad: d.variedad || '', calibre: d.calibre || '', cajas: 0, kg: 0, palets: 0 }
    prodMap[key].cajas += d.cajas || 0
    prodMap[key].kg += parseFloat(d.kg_netos || 0)
    prodMap[key].palets++
  }
  const productos = Object.values(prodMap).sort((a, b) => b.kg - a.kg)

  // Documentos recientes
  const docs = [...new Map([
    ...precios.map(d => [d.documento, { doc: d.documento, fecha: d.fecha_fra || d.year + '/' + (d.month || ''), total: d.base_iva, tipo: 'venta' }]),
    ...confeccion.map(d => [d.documento_limpio, { doc: d.documento_limpio || d.documento_venta_original, fecha: d.fecha_documento || d.fecha_confeccion, total: parseFloat(d.base_iva || 0), tipo: 'confeccion' }])
  ].filter(([k]) => k).values())].sort((a, b) => (b.fecha || '').localeCompare(a.fecha || '')).slice(0, 20)

  document.getElementById('cli360-content').innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <button class="btn btn-ghost" onclick="window.backToClientes360()">← Volver a clientes</button>
    </div>

    <div class="card" style="margin-bottom:var(--space-6);background:var(--color-primary-light);border-color:var(--color-primary)">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:var(--space-4)">
        <div>
          <h3 style="font-size:var(--text-lg);font-weight:700;color:var(--color-primary)">${nombre}</h3>
          <div style="font-size:var(--text-sm);color:var(--color-text-muted);margin-top:2px">
            ${precios[0]?.cliente ? 'Cód. ' + precios[0].cliente : ''}
            ${confeccion[0]?.cliente_id && confeccion[0]?.cliente_id !== precios[0]?.cliente ? ' · Cód. conf: ' + confeccion[0].cliente_id : ''}
          </div>
        </div>
        <div style="display:flex;gap:var(--space-5);flex-wrap:wrap">
          <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Facturado</div><div style="font-size:var(--text-base);font-weight:700">${fmtEur(totalRev)}</div></div>
          <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">KG totales</div><div style="font-size:var(--text-base);font-weight:700">${fmtKg(totalKg)}</div></div>
          <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Palets</div><div style="font-size:var(--text-base);font-weight:700">${fmtNum(totalPalets)}</div></div>
          <div><div style="font-size:var(--text-xs);color:var(--color-text-muted);text-transform:uppercase;letter-spacing:0.05em">Documentos</div><div style="font-size:var(--text-base);font-weight:700">${fmtNum(totalDocs)}</div></div>
        </div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:var(--space-6)">
      <div class="card">
        <div class="chart-label"><span>Productos que compra</span></div>
        ${productos.length === 0 ? '<p style="font-size:var(--text-xs);color:var(--color-text-muted)">Sin datos de confección</p>' : `
        <div class="table-wrap" style="max-height:280px;overflow-y:auto">
          <table class="data-table">
            <thead><tr><th style="position:sticky;top:0;background:var(--color-surface-offset)">Producto</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Cajas</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">KG</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Palets</th></tr></thead>
            <tbody>${productos.slice(0, 30).map(p => `
              <tr>
                <td><strong>${p.base}</strong>${p.variedad ? '<br><span style="color:var(--color-text-muted);font-size:11px">' + p.variedad + (p.calibre ? ' · ' + p.calibre : '') + '</span>' : ''}</td>
                <td class="td-num">${fmtNum(p.cajas)}</td>
                <td class="td-num">${fmtKg(p.kg)}</td>
                <td class="td-num">${p.palets}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
      <div class="card">
        <div class="chart-label"><span>Documentos recientes</span></div>
        ${docs.length === 0 ? '<p style="font-size:var(--text-xs);color:var(--color-text-muted)">Sin documentos</p>' : `
        <div class="table-wrap" style="max-height:280px;overflow-y:auto">
          <table class="data-table">
            <thead><tr><th style="position:sticky;top:0;background:var(--color-surface-offset)">Documento</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Fecha</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Total</th><th style="position:sticky;top:0;background:var(--color-surface-offset)"></th></tr></thead>
            <tbody>${docs.map(d => `
              <tr>
                <td class="td-doc">${d.doc}</td>
                <td style="font-size:var(--text-xs);color:var(--color-text-muted)">${d.fecha || '—'}</td>
                <td class="td-num">${d.total ? fmtEur(d.total) : '—'}</td>
                <td><button class="btn btn-ghost" style="font-size:11px" onclick="searchDoc('${d.doc.replace(/'/g, "\\'")}')">Ir</button></td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>`}
      </div>
    </div>

    ${confeccion.length > 0 ? `
    <div class="card" style="margin-bottom:var(--space-6)">
      <div class="chart-label"><span>Palets de confección (${fmtNum(confeccion.length)})</span></div>
      <div class="table-wrap" style="max-height:350px;overflow-y:auto">
        <table class="data-table">
          <thead><tr><th style="position:sticky;top:0;background:var(--color-surface-offset)">Nº</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Producto</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Variedad</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Calibre</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Cajas</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Tipo Caja</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Kg Netos</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">PVP/kg</th></tr></thead>
          <tbody>${confeccion.slice(0, 50).map(d => `
            <tr>
              <td><strong>#${d.nº_palet || '?'}</strong></td>
              <td style="font-size:var(--text-xs)">${d.producto_base || ''}${d.variedad ? ' · ' + d.variedad : ''}</td>
              <td>${d.variedad || '—'}</td>
              <td>${d.calibre || '—'}</td>
              <td class="td-num">${d.cajas || 0}</td>
              <td style="font-size:11px">${(d.tipo_caja || '').slice(0, 30)}${(d.tipo_caja || '').length > 30 ? '…' : ''}</td>
              <td class="td-num">${d.kg_netos ? fmt(parseFloat(d.kg_netos)) + ' kg' : '—'}</td>
              <td class="td-num" style="font-weight:600">${parseFloat(d.pvp_kg || 0) > 0 ? fmtEur(parseFloat(d.pvp_kg)) : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${confeccion.length > 50 ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2)">Mostrando 50 de ${fmtNum(confeccion.length)} palets</p>` : ''}
    </div>` : ''}

    ${precios.length > 0 ? `
    <div class="card">
      <div class="chart-label"><span>Histórico de ventas (${fmtNum(precios.length)} registros)</span></div>
      <div class="table-wrap" style="max-height:300px;overflow-y:auto">
        <table class="data-table">
          <thead><tr><th style="position:sticky;top:0;background:var(--color-surface-offset)">Producto</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Campaña</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">PVP</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">KG</th><th style="position:sticky;top:0;background:var(--color-surface-offset)">Base IVA</th></tr></thead>
          <tbody>${precios.slice(0, 50).map(d => `
            <tr>
              <td style="font-size:var(--text-xs)">${(d.product || '').slice(0, 40)}</td>
              <td style="font-size:var(--text-xs);color:var(--color-text-muted)">${d.year}${d.month ? '/' + String(d.month).padStart(2, '0') : ''}</td>
              <td class="td-num">${d.price > 0 ? fmtEur(d.price) : '—'}</td>
              <td class="td-num">${d.kilos > 0 ? fmtKg(d.kilos) : '—'}</td>
              <td class="td-num">${d.base_iva !== 0 ? fmtEur(d.base_iva) : '—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${precios.length > 50 ? `<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-2)">Mostrando 50 de ${fmtNum(precios.length)} registros</p>` : ''}
    </div>` : ''}
  `
}

window.backToClientes360 = function () {
  selectedClient = null
  renderPage()
}

function searchDoc(doc) {
  const btn = document.querySelector('[onclick*="confeccion"]')
  if (btn) btn.click()
  const input = document.getElementById('conf-search')
  if (input) {
    input.value = doc
    if (window.debouncedRenderConfeccion) window.debouncedRenderConfeccion()
  }
}
window.searchDoc = searchDoc

async function renderPage() {
  await ensureData()
  if (selectedClient) {
    renderClienteDetail(selectedClient)
  } else {
    const clientes = getUniqueClientes()
    const input = document.getElementById('cli360-search-input')
    const searchTerm = input ? input.value : ''
    renderClientList(clientes, searchTerm)
  }
}

const debouncedRenderPage = debounce(renderPage, 200)

// Override renderClientes
window.renderClientes = function () {
  const content = document.getElementById('cli-content')
  if (content) {
    content.innerHTML = `<div id="cli360-content" style="grid-column:1/-1"><div class="loading-card"><div class="loading-spinner"></div><div><div class="loading-title">Cargando clientes</div><div class="loading-text">Conectando…</div></div></div></div>`
  }
  renderPage()
}

// Also handle clientes page navigation from sidebar
document.addEventListener('DOMContentLoaded', () => {
  const cliBtn = document.querySelector('[onclick*="clientes"]')
  if (cliBtn) {
    const orig = cliBtn.onclick
    cliBtn.onclick = function (e) {
      selectedClient = null
      if (orig) orig.call(this, e)
    }
  }
})
