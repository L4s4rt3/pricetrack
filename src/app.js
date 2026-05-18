import {
  fetchAllRecords, addRecord as dbAddRecord, addRecords as dbAddRecords,
  deleteRecord as dbDeleteRecord, subscribeToChanges, normalizeRow
} from './database.js'

// =========== GLOBALS ===========
let data = []
let charts = {}
let selectedYears = []
let ventasPage = 0
let ventasPageSize = 50
let clienteSelected = null

const MONTHS      = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CHART_COLORS = ['#01696f','#006494','#437a22','#d19900','#da7101','#a12c7b','#964219','#5591c7','#2d8650','#8b5cf6']

// =========== UTILITIES ===========
function getUnique(field) { return [...new Set(data.map(d => d[field]).filter(Boolean))].sort() }
function getYears() { return [...new Set(data.map(d => d.year))].map(Number).sort() }
function getProducts() { return getUnique('product') }
function getCategories() { return getUnique('category') }
function getClientes() { return [...new Set(data.map(d => d.denominacion_social || d.cliente).filter(Boolean))].sort() }
function avg(arr) { const v = arr.filter(x => x > 0); return v.length ? v.reduce((a,b)=>a+b,0)/v.length : 0 }
function sum(arr) { return arr.reduce((a,b)=>a+b,0) }
function fmt(n) { return (+n).toFixed(2) }
function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%' }
function fmtEur(n) {
  return new Intl.NumberFormat('es-ES', { style:'currency', currency:'EUR', minimumFractionDigits:2 }).format(n)
}
function fmtKg(n) {
  return new Intl.NumberFormat('es-ES', { minimumFractionDigits:0, maximumFractionDigits:0 }).format(n) + ' kg'
}
function fmtNum(n) {
  return new Intl.NumberFormat('es-ES').format(Math.round(n))
}

function detectCategory(name) {
  const n = (name || '').toUpperCase()
  if (n.includes('CARACARA'))  return 'Naranja Caracara'
  if (n.includes('NAVELINA'))  return 'Naranja Navelina'
  if (n.includes('SALUSTIANA')) return 'Naranja Salustiana'
  if (n.includes('NAVEL'))     return 'Naranja Navel'
  if (n.startsWith('NAR ') || n.includes(' NAR ')) return 'Naranja'
  if (n.includes('LIMON') || n.includes('LIMÓN') || n.includes('LIM ')) return 'Limón'
  if (n.includes('MAND') || n.includes('CLEMENTINA')) return 'Mandarina'
  return 'Sin categoría'
}

function getChartColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    tick: dark ? '#888785' : '#8a8880',
    bg:   dark ? '#1c1b19' : '#f9f8f5'
  }
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id] } }

function showToast(msg, type = '') {
  const t = document.getElementById('toast')
  t.textContent = msg
  t.className = 'toast show' + (type ? ' toast-' + type : '')
  setTimeout(() => t.className = 'toast', 3000)
}

function baseChartOptions(colors, unit = '€') {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} ${unit}` } }
    },
    scales: {
      x: { grid: { color: colors.grid }, ticks: { color: colors.tick, font:{ size:11 } } },
      y: { grid: { color: colors.grid }, ticks: { color: colors.tick, font:{ size:11 }, callback: v => `${v} ${unit}` } }
    }
  }
}

// =========== INIT ===========
async function initApp() {
  showLoading(true)
  try {
    data = await fetchAllRecords()
  } catch(e) {
    console.error(e)
    showToast('⚠ Error al cargar datos de Supabase', 'error')
  }
  showLoading(false)
  populateAllSelects()
  renderDashboard()

  subscribeToChanges((payload) => {
    const { event_type, new: nr, old: or } = payload
    if (event_type === 'INSERT' && nr)  { data.push(normalizeRow(nr)); showToast(`✓ Nuevo: ${nr.producto}`) }
    else if (event_type === 'DELETE' && or) data = data.filter(d => d.id !== or.id)
    else if (event_type === 'UPDATE' && nr) {
      const i = data.findIndex(d => d.id === nr.id)
      if (i !== -1) data[i] = normalizeRow(nr)
    }
    rerenderCurrentPage()
  })
}

function showLoading(on) {
  const el = document.getElementById('loading-overlay')
  if (el) el.style.display = on ? 'flex' : 'none'
}

function rerenderCurrentPage() {
  const active = document.querySelector('.page.active')?.id
  if (!active) return
  populateAllSelects()
  if (active === 'page-dashboard')    renderDashboard()
  else if (active === 'page-ventas')  renderVentas()
  else if (active === 'page-clientes') renderClientes()
  else if (active === 'page-precios') renderPrecios()
  else if (active === 'page-tendencias') renderTrends()
  else if (active === 'page-comparar')  renderComparePage()
  else if (active === 'page-predicciones') renderPredictions()
}

// =========== NAVIGATION ===========
function navigate(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById('page-' + page).classList.add('active')
  if (btn) btn.classList.add('active')
  if (page === 'dashboard')    renderDashboard()
  if (page === 'ventas')       { ventasPage = 0; renderVentas() }
  if (page === 'clientes')     { clienteSelected = null; renderClientes() }
  if (page === 'precios')      renderPrecios()
  if (page === 'tendencias')   renderTrends()
  if (page === 'comparar')     renderComparePage()
  if (page === 'predicciones') renderPredictions()
}
window.navigate = navigate

// =========== POPULATE SELECTS ===========
function populateAllSelects() {
  const years    = getYears()
  const products = getProducts()
  const cats     = getCategories()
  const clientes = getClientes()

  const setOpts = (id, items, allLabel = 'Todos') => {
    const el = document.getElementById(id)
    if (!el) return
    const prev = el.value
    el.innerHTML = `<option value="">${allLabel}</option>` + items.map(i => `<option value="${i}">${i}</option>`).join('')
    if (items.includes(prev)) el.value = prev
  }

  setOpts('ventas-year',    years,    'Todos los años')
  setOpts('ventas-month',   MONTH_NAMES.map((_,i)=>i+1), 'Todos los meses')
  setOpts('ventas-cliente', clientes, 'Todos los clientes')
  setOpts('trend-product',  products, 'Todos los productos')
  setOpts('cmp-product',    products, 'Todos los productos')
  setOpts('pred-product',   products, 'Todos los productos')
  setOpts('search-product', products, 'Todos los productos')
  setOpts('precios-product',products, '— Selecciona producto —')

  const setYearsRange = (from, to) => {
    [from, to].forEach(id => {
      const el = document.getElementById(id)
      if (el) el.innerHTML = `<option value="">—</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
    })
  }
  setYearsRange('trend-year-from','trend-year-to')

  const pd = document.getElementById('product-datalist')
  if (pd) pd.innerHTML = products.map(p => `<option value="${p}">`).join('')
  const cd = document.getElementById('cat-datalist')
  if (cd) cd.innerHTML = cats.map(c => `<option value="${c}">`).join('')

  // month select for ventas (re-init with month names not numbers)
  const vm = document.getElementById('ventas-month')
  if (vm) {
    const pv = vm.value
    vm.innerHTML = `<option value="">Todos los meses</option>` + MONTH_NAMES.map((m,i) => `<option value="${i+1}">${m}</option>`).join('')
    if (pv) vm.value = pv
  }
}

// =========== DASHBOARD ===========
function renderDashboard() {
  populateAllSelects()
  const years = getYears()
  if (!years.length) {
    document.getElementById('dash-kpis').innerHTML = `
      <div class="kpi-card kpi-wide">
        <div class="kpi-label">Sin datos</div>
        <div class="kpi-value" style="font-size:1rem">Importa un archivo para comenzar</div>
      </div>`
    return
  }

  const latestYear  = years[years.length - 1]
  const prevYear    = years[years.length - 2]
  const allPrices   = data.filter(d => d.price > 0).map(d => d.price)
  const latestPrices = data.filter(d => d.year === latestYear && d.price > 0).map(d => d.price)
  const prevPrices   = data.filter(d => d.year === prevYear  && d.price > 0).map(d => d.price)
  const avgLatest   = avg(latestPrices)
  const avgPrev     = avg(prevPrices)
  const pctChange   = avgPrev ? ((avgLatest - avgPrev) / avgPrev) * 100 : 0

  const totalRevenue = sum(data.map(d => d.base_iva))
  const totalKg      = sum(data.map(d => d.kilos))
  const hasRevenue   = totalRevenue > 0
  const hasKg        = totalKg > 0
  const nClientes    = new Set(data.map(d => d.cliente).filter(Boolean)).size

  document.getElementById('dash-subtitle').textContent =
    `Datos de ${years[0]} a ${latestYear} · ${fmtNum(data.length)} registros`

  const kpis = hasRevenue ? [
    { label: 'Facturación total', value: fmtEur(totalRevenue), sub: `${years[0]}–${latestYear}`, icon: '💰', cls: 'kpi-gold' },
    { label: 'Kilos vendidos', value: hasKg ? fmtKg(totalKg) : '—', sub: 'Total acumulado', icon: '⚖️', cls: 'kpi-blue' },
    { label: `Precio medio ${latestYear}`, value: fmtEur(avgLatest), delta: fmtPct(pctChange), up: pctChange > 0, icon: '🏷️', cls: '' },
    { label: 'Clientes únicos', value: nClientes || getClientes().length, sub: 'Cartera activa', icon: '👥', cls: 'kpi-teal' },
  ] : [
    { label: `Precio medio ${latestYear}`, value: fmtEur(avgLatest), delta: fmtPct(pctChange), up: pctChange > 0, icon: '🏷️', cls: '' },
    { label: 'Total registros', value: fmtNum(data.length), sub: `${years.length} años`, icon: '📋', cls: 'kpi-blue' },
    { label: 'Precio máximo', value: fmtEur(Math.max(...allPrices)), sub: 'Histórico', icon: '↑', cls: 'kpi-gold' },
    { label: 'Precio mínimo', value: fmtEur(Math.min(...allPrices.filter(p=>p>0))), sub: 'Histórico', icon: '↓', cls: '' },
  ]

  document.getElementById('dash-kpis').innerHTML = kpis.map(k => `
    <div class="kpi-card ${k.cls || ''}">
      <div class="kpi-icon">${k.icon}</div>
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      ${k.delta
        ? `<div class="kpi-delta ${k.up ? 'delta-up':'delta-down'}">${k.delta} vs año anterior</div>`
        : k.sub ? `<div class="kpi-delta delta-flat">${k.sub}</div>` : ''}
    </div>
  `).join('')

  renderDashCharts()
}

function renderDashCharts() {
  const colors = getChartColors()
  const years  = getYears()

  // Facturación/precio anual
  destroyChart('dashAnnualChart')
  const hasRevenue = data.some(d => d.base_iva > 0)
  const annualLabels = years
  const annualData = years.map(y => {
    const yd = data.filter(d => d.year === y)
    return hasRevenue ? sum(yd.map(d => d.base_iva)) : avg(yd.filter(d=>d.price>0).map(d => d.price))
  })
  const ctx1 = document.getElementById('dashAnnualChart')?.getContext('2d')
  if (ctx1) {
    charts['dashAnnualChart'] = new Chart(ctx1, {
      type: 'bar',
      data: {
        labels: annualLabels,
        datasets: [{
          label: hasRevenue ? 'Facturación (€)' : 'Precio medio (€)',
          data: annualData,
          backgroundColor: annualData.map((v,i) => i === annualData.length-1 ? '#da7101' : 'rgba(1,105,111,0.65)'),
          borderRadius: 6, borderSkipped: false,
        }]
      },
      options: baseChartOptions(colors, hasRevenue ? '€' : '€/kg')
    })
  }

  // Top clientes por facturación
  destroyChart('dashClientChart')
  const ctx2 = document.getElementById('dashClientChart')?.getContext('2d')
  if (ctx2) {
    const clienteMap = {}
    data.forEach(d => {
      const k = d.denominacion_social || d.cliente || 'Desconocido'
      if (!clienteMap[k]) clienteMap[k] = 0
      clienteMap[k] += hasRevenue ? d.base_iva : d.price
    })
    const sorted = Object.entries(clienteMap).sort((a,b)=>b[1]-a[1]).slice(0,10)
    charts['dashClientChart'] = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: sorted.map(([k]) => k.length > 22 ? k.slice(0,22)+'…' : k),
        datasets: [{
          label: hasRevenue ? 'Facturado (€)' : 'Precio (€)',
          data: sorted.map(([,v]) => v),
          backgroundColor: CHART_COLORS.slice(0,sorted.length),
          borderRadius: 4,
        }]
      },
      options: {
        indexAxis: 'y',
        responsive: true, maintainAspectRatio: false,
        plugins: { legend: { display:false }, tooltip:{ callbacks:{ label: c => ` ${fmtEur(c.raw)}` } } },
        scales: {
          x: { grid:{ color: colors.grid }, ticks:{ color: colors.tick, font:{ size:10 }, callback: v => fmtEur(v) } },
          y: { grid:{ display:false }, ticks:{ color: colors.tick, font:{ size:11 } } }
        }
      }
    })
  }

  // Evolución mensual (último año)
  destroyChart('dashMonthlyChart')
  const ctx3 = document.getElementById('dashMonthlyChart')?.getContext('2d')
  if (ctx3) {
    const latestYear = years[years.length-1]
    const monthly = Array.from({length:12}, (_,i) => {
      const yd = data.filter(d => d.year === latestYear && d.month === i+1)
      return hasRevenue ? sum(yd.map(d=>d.base_iva)) : avg(yd.filter(d=>d.price>0).map(d=>d.price))
    })
    charts['dashMonthlyChart'] = new Chart(ctx3, {
      type: 'line',
      data: {
        labels: MONTHS,
        datasets: [{
          label: hasRevenue ? 'Facturación' : 'Precio medio',
          data: monthly,
          borderColor: '#01696f', backgroundColor: 'rgba(1,105,111,0.08)',
          borderWidth: 2, tension: 0.35, fill: true, pointRadius: 4,
          pointBackgroundColor: '#01696f',
        }]
      },
      options: baseChartOptions(colors, hasRevenue ? '€' : '€/kg')
    })
  }
}
window.renderDashCharts = renderDashCharts

// =========== VENTAS PAGE ===========
function getVentasFiltered() {
  const q    = (document.getElementById('ventas-search')?.value || '').toLowerCase()
  const year = parseInt(document.getElementById('ventas-year')?.value) || null
  const month= parseInt(document.getElementById('ventas-month')?.value) || null
  const cli  = (document.getElementById('ventas-cliente')?.value || '').toLowerCase()

  return data.filter(d => {
    if (year  && d.year  !== year)  return false
    if (month && d.month !== month) return false
    if (cli   && !(d.denominacion_social || d.cliente || '').toLowerCase().includes(cli)) return false
    if (q     && !d.product.toLowerCase().includes(q) && !(d.referencia||'').toLowerCase().includes(q)) return false
    return true
  }).sort((a,b) => (b.year - a.year) || (b.month||0) - (a.month||0))
}

function renderVentas() {
  populateAllSelects()
  const rows   = getVentasFiltered()
  const total  = rows.length
  const start  = ventasPage * ventasPageSize
  const pageRows = rows.slice(start, start + ventasPageSize)

  // Summary bar
  const hasRev = rows.some(d => d.base_iva > 0)
  const hasKg  = rows.some(d => d.kilos > 0)
  const rev    = sum(rows.map(d => d.base_iva))
  const kg     = sum(rows.map(d => d.kilos))

  document.getElementById('ventas-summary').innerHTML = `
    <span class="summary-chip">${fmtNum(total)} registros</span>
    ${hasRev ? `<span class="summary-chip chip-gold">${fmtEur(rev)} facturado</span>` : ''}
    ${hasKg  ? `<span class="summary-chip chip-blue">${fmtKg(kg)} vendidos</span>`    : ''}
  `

  const tbody = document.getElementById('ventas-tbody')
  if (!pageRows.length) {
    tbody.innerHTML = `<tr><td colspan="9" class="empty-row">Sin resultados para los filtros aplicados</td></tr>`
  } else {
    tbody.innerHTML = pageRows.map(d => {
      const nombre = d.denominacion_social || d.cliente || '—'
      return `<tr>
        <td class="td-date">${d.year}${d.month ? '/'+ String(d.month).padStart(2,'0') : ''}</td>
        <td class="td-doc">${d.documento || '—'}</td>
        <td class="td-client" title="${nombre}">${nombre.length>28?nombre.slice(0,28)+'…':nombre}</td>
        <td class="td-product" title="${d.product}">${d.product.length>32?d.product.slice(0,32)+'…':d.product}</td>
        <td class="td-ref">${d.referencia || '—'}</td>
        <td class="td-num">${d.kilos > 0 ? fmtKg(d.kilos) : d.unidades > 0 ? fmtNum(d.unidades)+' ud' : '—'}</td>
        <td class="td-num">${d.price > 0 ? fmtEur(d.price) : '—'}</td>
        <td class="td-num td-total">${d.base_iva !== 0 ? fmtEur(d.base_iva) : '—'}</td>
        <td><button class="btn-delete" onclick="deleteRecord(${d.id})" title="Eliminar">✕</button></td>
      </tr>`
    }).join('')
  }

  // Pagination
  const totalPages = Math.ceil(total / ventasPageSize)
  const pag = document.getElementById('ventas-pagination')
  if (pag) {
    pag.innerHTML = totalPages <= 1 ? '' : `
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(0)" ${ventasPage===0?'disabled':''}>«</button>
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(${ventasPage-1})" ${ventasPage===0?'disabled':''}>‹</button>
      <span class="pag-info">Pág. ${ventasPage+1} de ${totalPages}</span>
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(${ventasPage+1})" ${ventasPage>=totalPages-1?'disabled':''}>›</button>
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(${totalPages-1})" ${ventasPage>=totalPages-1?'disabled':''}>»</button>
      <select class="form-select pag-size" onchange="setVentasPageSize(this.value)" style="width:auto;padding:4px 8px">
        <option value="50"  ${ventasPageSize===50?'selected':''}>50/pág</option>
        <option value="100" ${ventasPageSize===100?'selected':''}>100/pág</option>
        <option value="200" ${ventasPageSize===200?'selected':''}>200/pág</option>
      </select>
    `
  }

  document.getElementById('ventas-count').textContent =
    `Mostrando ${start+1}–${Math.min(start+ventasPageSize,total)} de ${fmtNum(total)} registros`
}
window.renderVentas = renderVentas

function ventasGoPage(p) {
  const total = getVentasFiltered().length
  const maxP  = Math.max(0, Math.ceil(total/ventasPageSize) - 1)
  ventasPage  = Math.max(0, Math.min(p, maxP))
  renderVentas()
}
window.ventasGoPage = ventasGoPage

function setVentasPageSize(sz) {
  ventasPageSize = parseInt(sz) || 50
  ventasPage = 0
  renderVentas()
}
window.setVentasPageSize = setVentasPageSize

// =========== CLIENTES PAGE ===========
function renderClientes() {
  populateAllSelects()
  if (clienteSelected) { renderClienteDetail(clienteSelected); return }

  const hasRev = data.some(d => d.base_iva > 0)
  const hasKg  = data.some(d => d.kilos  > 0)

  // Build client map
  const clientMap = {}
  data.forEach(d => {
    const code  = d.cliente || ''
    const name  = d.denominacion_social || d.cliente || 'Desconocido'
    const key   = code || name
    if (!clientMap[key]) {
      clientMap[key] = { code, name, rev:0, kg:0, n:0, years: new Set(), lastYear:0 }
    }
    clientMap[key].rev  += d.base_iva
    clientMap[key].kg   += d.kilos
    clientMap[key].n    += 1
    clientMap[key].years.add(d.year)
    if (d.year > clientMap[key].lastYear) clientMap[key].lastYear = d.year
  })

  const clients = Object.values(clientMap).sort((a,b) => b.rev - a.rev || b.kg - a.kg)
  const totRev  = sum(clients.map(c=>c.rev))
  const totKg   = sum(clients.map(c=>c.kg))

  document.getElementById('cli-kpis').innerHTML = `
    <div class="kpi-card kpi-teal">
      <div class="kpi-icon">👥</div>
      <div class="kpi-label">Clientes totales</div>
      <div class="kpi-value">${clients.length}</div>
    </div>
    ${hasRev ? `<div class="kpi-card kpi-gold">
      <div class="kpi-icon">💰</div>
      <div class="kpi-label">Facturación total</div>
      <div class="kpi-value">${fmtEur(totRev)}</div>
    </div>` : ''}
    ${hasKg ? `<div class="kpi-card kpi-blue">
      <div class="kpi-icon">⚖️</div>
      <div class="kpi-label">KG totales vendidos</div>
      <div class="kpi-value">${fmtKg(totKg)}</div>
    </div>` : ''}
    ${hasRev ? `<div class="kpi-card">
      <div class="kpi-icon">📊</div>
      <div class="kpi-label">Media por cliente</div>
      <div class="kpi-value">${clients.length ? fmtEur(totRev/clients.length) : '—'}</div>
    </div>` : ''}
  `

  const cols = hasRev
    ? `<th>Nombre cliente</th><th>Código</th><th>Facturado (€)</th>${hasKg?'<th>KG totales</th>':''}<th>Registros</th><th>Último año</th><th></th>`
    : `<th>Nombre cliente</th><th>Código</th>${hasKg?'<th>KG totales</th>':''}<th>Registros</th><th>Último año</th><th></th>`

  const rows = clients.map(c => `
    <tr class="cli-row" onclick="selectCliente('${(c.code||c.name).replace(/'/g,"\\'")}')">
      <td><strong>${c.name}</strong></td>
      <td><code style="font-size:0.8em;color:var(--color-text-muted)">${c.code||'—'}</code></td>
      ${hasRev ? `<td class="td-total">${fmtEur(c.rev)}</td>` : ''}
      ${hasKg  ? `<td class="td-num">${fmtKg(c.kg)}</td>` : ''}
      <td>${fmtNum(c.n)}</td>
      <td>${c.lastYear||'—'}</td>
      <td><button class="btn btn-ghost" style="font-size:0.8em">Ver →</button></td>
    </tr>
  `).join('')

  document.getElementById('cli-content').innerHTML = `
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr>${cols}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `
}
window.renderClientes = renderClientes

function selectCliente(key) {
  clienteSelected = key
  renderClienteDetail(key)
}
window.selectCliente = selectCliente

function backToClientes() {
  clienteSelected = null
  renderClientes()
}
window.backToClientes = backToClientes

function renderClienteDetail(key) {
  const cliData = data.filter(d => (d.cliente || d.denominacion_social || '') === key || d.denominacion_social === key || d.cliente === key)
  if (!cliData.length) { backToClientes(); return }

  const name   = cliData[0].denominacion_social || cliData[0].cliente || key
  const rev    = sum(cliData.map(d=>d.base_iva))
  const kg     = sum(cliData.map(d=>d.kilos))
  const years  = [...new Set(cliData.map(d=>d.year))].sort()
  const hasRev = rev > 0
  const hasKg  = kg > 0
  const avgPvp = avg(cliData.filter(d=>d.price>0).map(d=>d.price))

  // Top products
  const prodMap = {}
  cliData.forEach(d => {
    if (!prodMap[d.product]) prodMap[d.product] = { rev:0, kg:0, n:0 }
    prodMap[d.product].rev += d.base_iva
    prodMap[d.product].kg  += d.kilos
    prodMap[d.product].n   += 1
  })
  const topProds = Object.entries(prodMap).sort((a,b)=>b[1].rev-a[1].rev).slice(0,5)

  document.getElementById('cli-content').innerHTML = `
    <div style="margin-bottom:var(--space-4)">
      <button class="btn btn-ghost" onclick="backToClientes()">← Volver a clientes</button>
    </div>
    <h3 style="font-size:var(--text-lg);font-weight:700;margin-bottom:var(--space-6)">${name}</h3>
    <div class="grid-4" style="margin-bottom:var(--space-6)">
      ${hasRev?`<div class="kpi-card kpi-gold"><div class="kpi-icon">💰</div><div class="kpi-label">Facturación total</div><div class="kpi-value">${fmtEur(rev)}</div></div>`:''}
      ${hasKg ?`<div class="kpi-card kpi-blue"><div class="kpi-icon">⚖️</div><div class="kpi-label">KG totales</div><div class="kpi-value">${fmtKg(kg)}</div></div>`:''}
      <div class="kpi-card"><div class="kpi-icon">🏷️</div><div class="kpi-label">PVP medio</div><div class="kpi-value">${fmtEur(avgPvp)}/kg</div></div>
      <div class="kpi-card"><div class="kpi-icon">📋</div><div class="kpi-label">Registros</div><div class="kpi-value">${fmtNum(cliData.length)}</div></div>
    </div>
    <div class="grid-2" style="margin-bottom:var(--space-6)">
      <div class="card">
        <div class="chart-label"><span>${hasRev?'Facturación anual':'KG anuales'}</span></div>
        <div class="chart-wrap" style="height:240px"><canvas id="cliAnnualChart"></canvas></div>
      </div>
      <div class="card">
        <div class="chart-label"><span>Top 5 productos</span></div>
        <div class="chart-wrap" style="height:240px"><canvas id="cliProdChart"></canvas></div>
      </div>
    </div>
    <div class="card">
      <div class="section-title">Historial de compras</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Fecha</th><th>Documento</th><th>Producto</th><th>KG</th><th>PVP (€/kg)</th><th>Base IVA (€)</th></tr></thead>
          <tbody>
            ${cliData.slice(0,100).map(d=>`<tr>
              <td>${d.year}${d.month?'/'+String(d.month).padStart(2,'0'):''}</td>
              <td>${d.documento||d.factura||'—'}</td>
              <td title="${d.product}">${d.product.length>35?d.product.slice(0,35)+'…':d.product}</td>
              <td class="td-num">${d.kilos>0?fmtKg(d.kilos):'—'}</td>
              <td class="td-num">${d.price>0?fmtEur(d.price):'—'}</td>
              <td class="td-total">${d.base_iva!==0?fmtEur(d.base_iva):'—'}</td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${cliData.length>100?`<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">Mostrando 100 de ${fmtNum(cliData.length)} registros</p>`:''}
    </div>
  `

  // Charts
  const colors = getChartColors()
  setTimeout(() => {
    destroyChart('cliAnnualChart')
    const c1 = document.getElementById('cliAnnualChart')?.getContext('2d')
    if (c1) {
      charts['cliAnnualChart'] = new Chart(c1, {
        type: 'bar',
        data: {
          labels: years,
          datasets: [{
            label: hasRev ? 'Facturado (€)' : 'KG',
            data: years.map(y => {
              const yd = cliData.filter(d=>d.year===y)
              return hasRev ? sum(yd.map(d=>d.base_iva)) : sum(yd.map(d=>d.kilos))
            }),
            backgroundColor: 'rgba(1,105,111,0.65)', borderRadius: 5,
          }]
        },
        options: baseChartOptions(colors, hasRev ? '€' : 'kg')
      })
    }

    destroyChart('cliProdChart')
    const c2 = document.getElementById('cliProdChart')?.getContext('2d')
    if (c2) {
      charts['cliProdChart'] = new Chart(c2, {
        type: 'doughnut',
        data: {
          labels: topProds.map(([k]) => k.length>22?k.slice(0,22)+'…':k),
          datasets: [{ data: topProds.map(([,v]) => hasRev?v.rev:v.kg), backgroundColor: CHART_COLORS, borderWidth: 2, borderColor: colors.bg }]
        },
        options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color: colors.tick, font:{size:10}, boxWidth:10 } }, tooltip:{ callbacks:{ label: c => ` ${hasRev?fmtEur(c.raw):fmtKg(c.raw)}` } } } }
      })
    }
  }, 50)
}

// =========== PRECIOS PAGE (Product price history) ===========
function renderPrecios() {
  populateAllSelects()
  const product = document.getElementById('precios-product')?.value
  const container = document.getElementById('precios-content')

  if (!product) {
    container.innerHTML = `<div class="empty-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="48" height="48"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      <h3>Selecciona un producto</h3>
      <p>Elige un producto en el selector superior para ver su histórico de precios</p>
    </div>`
    destroyChart('precioChart'); destroyChart('precioKgChart')
    return
  }

  const rows = data.filter(d => d.product === product).sort((a,b) => (a.year-b.year)||(a.month||0)-(b.month||0))
  if (!rows.length) { container.innerHTML = `<div class="empty-state"><h3>Sin datos para ese producto</h3></div>`; return }

  const prices  = rows.filter(d=>d.price>0).map(d=>d.price)
  const revenues= rows.map(d=>d.base_iva)
  const kgs     = rows.map(d=>d.kilos)
  const avgP    = avg(prices)
  const maxP    = prices.length ? Math.max(...prices) : 0
  const minP    = prices.length ? Math.min(...prices) : 0
  const totRev  = sum(revenues)
  const totKg   = sum(kgs)
  const cat     = rows[0]?.category || '—'

  container.innerHTML = `
    <div class="grid-4" style="margin-bottom:var(--space-6)">
      <div class="kpi-card"><div class="kpi-icon">🏷️</div><div class="kpi-label">Precio medio</div><div class="kpi-value">${fmtEur(avgP)}/kg</div><div class="kpi-delta delta-flat">${cat}</div></div>
      <div class="kpi-card"><div class="kpi-icon">↑</div><div class="kpi-label">Precio máximo</div><div class="kpi-value">${fmtEur(maxP)}</div></div>
      <div class="kpi-card"><div class="kpi-icon">↓</div><div class="kpi-label">Precio mínimo</div><div class="kpi-value">${minP>0?fmtEur(minP):'—'}</div></div>
      ${totRev>0?`<div class="kpi-card kpi-gold"><div class="kpi-icon">💰</div><div class="kpi-label">Facturación total</div><div class="kpi-value">${fmtEur(totRev)}</div></div>`
               :`<div class="kpi-card kpi-blue"><div class="kpi-icon">⚖️</div><div class="kpi-label">KG totales</div><div class="kpi-value">${fmtKg(totKg)}</div></div>`}
    </div>
    <div class="grid-2" style="margin-bottom:var(--space-6)">
      <div class="card"><div class="chart-label"><span>Evolución del precio (€/kg)</span></div><div class="chart-wrap" style="height:260px"><canvas id="precioChart"></canvas></div></div>
      <div class="card"><div class="chart-label"><span>${totKg>0?'Volumen vendido (kg)':'Registros por año'}</span></div><div class="chart-wrap" style="height:260px"><canvas id="precioKgChart"></canvas></div></div>
    </div>
    <div class="card">
      <div class="section-title">Historial completo de precios</div>
      <div class="table-wrap">
        <table class="data-table">
          <thead><tr><th>Año</th><th>Mes</th><th>PVP (€/kg)</th><th>KG</th><th>Base IVA (€)</th><th>Cliente</th><th>Referencia</th></tr></thead>
          <tbody>
            ${rows.slice(0,200).map(d=>`<tr>
              <td>${d.year}</td>
              <td>${d.month?MONTH_NAMES[d.month-1]:'—'}</td>
              <td class="td-num">${d.price>0?fmtEur(d.price):'—'}</td>
              <td class="td-num">${d.kilos>0?fmtKg(d.kilos):'—'}</td>
              <td class="td-total">${d.base_iva!==0?fmtEur(d.base_iva):'—'}</td>
              <td>${d.denominacion_social||d.cliente||'—'}</td>
              <td><code style="font-size:0.8em">${d.referencia||'—'}</code></td>
            </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${rows.length>200?`<p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">Mostrando 200 de ${fmtNum(rows.length)} registros</p>`:''}
    </div>
  `

  const colors = getChartColors()
  setTimeout(() => {
    // Price chart
    destroyChart('precioChart')
    const points = []
    const seen   = new Set()
    rows.filter(d=>d.price>0).forEach(d => {
      const k = `${d.year}-${d.month||0}`
      if (!seen.has(k)) { seen.add(k); points.push({ label:`${d.month?MONTHS[d.month-1]+' ':''}${d.year}`, price: d.price }) }
    })
    const c1 = document.getElementById('precioChart')?.getContext('2d')
    if (c1) {
      charts['precioChart'] = new Chart(c1, {
        type: 'line',
        data: {
          labels: points.map(p=>p.label),
          datasets: [{ label: 'PVP (€/kg)', data: points.map(p=>p.price), borderColor:'#01696f', backgroundColor:'rgba(1,105,111,0.08)', borderWidth:2, tension:0.3, fill:true, pointRadius:3 }]
        },
        options: baseChartOptions(colors, '€/kg')
      })
    }

    // KG chart by year
    destroyChart('precioKgChart')
    const years2 = [...new Set(rows.map(d=>d.year))].sort()
    const c2 = document.getElementById('precioKgChart')?.getContext('2d')
    if (c2) {
      charts['precioKgChart'] = new Chart(c2, {
        type: 'bar',
        data: {
          labels: years2,
          datasets: [{
            label: totKg>0 ? 'KG vendidos' : 'Registros',
            data: years2.map(y => {
              const yd = rows.filter(d=>d.year===y)
              return totKg>0 ? sum(yd.map(d=>d.kilos)) : yd.length
            }),
            backgroundColor: 'rgba(0,100,148,0.6)', borderRadius: 5,
          }]
        },
        options: baseChartOptions(colors, totKg>0 ? 'kg' : '')
      })
    }
  }, 50)
}
window.renderPrecios = renderPrecios

// =========== TENDENCIAS ===========
function renderTrends() {
  populateAllSelects()
  renderTrendCharts()
}
window.renderTrends = renderTrends

function renderTrendCharts() {
  const selProduct = document.getElementById('trend-product')?.value
  const yearFrom   = parseInt(document.getElementById('trend-year-from')?.value) || null
  const yearTo     = parseInt(document.getElementById('trend-year-to')?.value)   || null
  let years        = getYears()
  if (yearFrom) years = years.filter(y => y >= yearFrom)
  if (yearTo)   years = years.filter(y => y <= yearTo)

  const filtered = data.filter(d => {
    if (selProduct && d.product !== selProduct) return false
    if (yearFrom   && d.year < yearFrom)        return false
    if (yearTo     && d.year > yearTo)          return false
    return true
  })

  const prices  = filtered.filter(d=>d.price>0).map(d => d.price)
  const revenues= filtered.map(d=>d.base_iva)
  const kgs     = filtered.map(d=>d.kilos)
  const avgAll  = avg(prices)
  const maxAll  = prices.length ? Math.max(...prices) : 0
  const minAll  = prices.length ? Math.min(...prices) : 0
  const totRev  = sum(revenues)
  const totKg   = sum(kgs)
  const hasRev  = totRev > 0

  const yearAvgs = years.map(y => avg(filtered.filter(d=>d.year===y && d.price>0).map(d=>d.price)))
  const varPct   = yearAvgs.map((v,i) => i===0 ? 0 : yearAvgs[i-1] ? ((v-yearAvgs[i-1])/yearAvgs[i-1])*100 : 0)
  const trend    = yearAvgs.length >= 2 ? yearAvgs[yearAvgs.length-1] - yearAvgs[0] : 0

  document.getElementById('trend-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Precio medio período</div><div class="kpi-value">${fmtEur(avgAll)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Precio máximo</div><div class="kpi-value">${fmtEur(maxAll)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Precio mínimo</div><div class="kpi-value">${minAll>0?fmtEur(minAll):'—'}</div></div>
    <div class="kpi-card"><div class="kpi-label">Tendencia general</div><div class="kpi-value">${trend>=0?'+':''}${fmt(trend)} €</div><div class="kpi-delta ${trend>=0?'delta-up':'delta-down'}">${trend>=0?'▲ Alza':'▼ Baja'}</div></div>
    ${hasRev?`<div class="kpi-card kpi-gold"><div class="kpi-label">Facturación total</div><div class="kpi-value">${fmtEur(totRev)}</div></div>`:''}
    ${totKg>0?`<div class="kpi-card kpi-blue"><div class="kpi-label">KG totales</div><div class="kpi-value">${fmtKg(totKg)}</div></div>`:''}
  `

  const colors = getChartColors()

  destroyChart('trendMainChart')
  const allPts = []
  for (const y of years) {
    for (let m=1; m<=12; m++) {
      const pts = filtered.filter(d=>d.year===y && d.month===m && d.price>0).map(d=>d.price)
      if (pts.length) allPts.push({ label:`${MONTHS[m-1]} ${y}`, value: avg(pts) })
    }
  }
  const c1 = document.getElementById('trendMainChart')?.getContext('2d')
  if (c1) charts['trendMainChart'] = new Chart(c1, {
    type: 'line',
    data: { labels: allPts.map(p=>p.label), datasets:[{ label:'Precio medio', data: allPts.map(p=>p.value), borderColor:'#01696f', backgroundColor:'rgba(1,105,111,0.07)', borderWidth:2, tension:0.35, fill:true, pointRadius:2 }] },
    options: baseChartOptions(colors,'€/kg')
  })

  destroyChart('trendMinMaxChart')
  const c2 = document.getElementById('trendMinMaxChart')?.getContext('2d')
  if (c2) charts['trendMinMaxChart'] = new Chart(c2, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label:'Máximo', data: years.map(y=>{ const p=filtered.filter(d=>d.year===y&&d.price>0).map(d=>d.price); return p.length?Math.max(...p):0 }), backgroundColor:'rgba(218,113,1,0.7)', borderRadius:4 },
        { label:'Mínimo', data: years.map(y=>{ const p=filtered.filter(d=>d.year===y&&d.price>0).map(d=>d.price); return p.length?Math.min(...p):0 }), backgroundColor:'rgba(1,105,111,0.5)', borderRadius:4 },
      ]
    },
    options: { ...baseChartOptions(colors,'€'), plugins:{ legend:{ display:true, labels:{ color: colors.tick } } } }
  })

  destroyChart('trendVarChart')
  const c3 = document.getElementById('trendVarChart')?.getContext('2d')
  if (c3) charts['trendVarChart'] = new Chart(c3, {
    type: 'bar',
    data: {
      labels: years.slice(1),
      datasets: [{ label:'Variación %', data: varPct.slice(1), backgroundColor: varPct.slice(1).map(v=>v>=0?'rgba(67,122,34,0.7)':'rgba(161,44,123,0.7)'), borderRadius:4 }]
    },
    options: baseChartOptions(colors,'%')
  })

  // Volume (KG) per year
  if (hasRev || totKg>0) {
    destroyChart('trendVolChart')
    const c4 = document.getElementById('trendVolChart')?.getContext('2d')
    if (c4) charts['trendVolChart'] = new Chart(c4, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [{
          label: hasRev ? 'Facturación (€)' : 'KG vendidos',
          data: years.map(y => {
            const yd = filtered.filter(d=>d.year===y)
            return hasRev ? sum(yd.map(d=>d.base_iva)) : sum(yd.map(d=>d.kilos))
          }),
          backgroundColor: 'rgba(0,100,148,0.6)', borderRadius:4,
        }]
      },
      options: baseChartOptions(colors, hasRev?'€':'kg')
    })
  }
}
window.renderTrendCharts = renderTrendCharts

// =========== COMPARAR ===========
function renderComparePage() {
  populateAllSelects()
  selectedYears = []
  renderYearCards()
}
window.renderComparePage = renderComparePage

function renderYearCards() {
  const years   = getYears()
  const hasRev  = data.some(d=>d.base_iva>0)
  document.getElementById('cmp-year-cards').innerHTML = years.map(y => {
    const yd  = data.filter(d=>d.year===y)
    const val = hasRev ? sum(yd.map(d=>d.base_iva)) : avg(yd.filter(d=>d.price>0).map(d=>d.price))
    return `<div class="compare-year-card ${selectedYears.includes(y)?'selected':''}" onclick="toggleYear(${y})">
      <div class="yr">${y}</div>
      <div class="avg">${hasRev ? fmtEur(val) : fmtEur(val)+' media'}</div>
    </div>`
  }).join('')
}

function toggleYear(y) {
  const i = selectedYears.indexOf(y)
  if (i > -1) selectedYears.splice(i,1)
  else selectedYears.push(y)
  renderYearCards()
  renderCompare()
}
window.toggleYear = toggleYear

function renderCompare() {
  const selProduct   = document.getElementById('cmp-product')?.value
  const chartCard    = document.getElementById('compare-chart-card')
  const tableCard    = document.getElementById('compare-table-card')
  if (selectedYears.length < 2) { chartCard.style.display='none'; tableCard.style.display='none'; return }
  chartCard.style.display = ''; tableCard.style.display = ''

  const colors  = getChartColors()
  const hasRev  = data.some(d=>d.base_iva>0)
  destroyChart('compareChart')
  const datasets = selectedYears.sort().map((y,i) => {
    const mdata = Array.from({length:12},(_,mi) => {
      const pts = data.filter(d=>d.year===y && d.month===mi+1 && (!selProduct||d.product===selProduct))
      return hasRev ? sum(pts.map(d=>d.base_iva)) : avg(pts.filter(d=>d.price>0).map(d=>d.price)) || null
    })
    return { label: String(y), data:mdata, borderColor:CHART_COLORS[i%CHART_COLORS.length], backgroundColor:CHART_COLORS[i%CHART_COLORS.length]+'15', borderWidth:2, tension:0.35, fill:false, pointRadius:4 }
  })
  const c = document.getElementById('compareChart')?.getContext('2d')
  if (c) charts['compareChart'] = new Chart(c, {
    type: 'line',
    data: { labels: MONTHS, datasets },
    options: { ...baseChartOptions(colors, hasRev?'€':'€/kg'), plugins:{ legend:{ display:true, labels:{ color: colors.tick, font:{size:12} } } } }
  })

  let prevAvg = null
  const rows  = selectedYears.sort().map(y => {
    const pts = data.filter(d=>d.year===y && (!selProduct||d.product===selProduct))
    const a   = avg(pts.filter(d=>d.price>0).map(d=>d.price))
    const rev = sum(pts.map(d=>d.base_iva))
    const kg  = sum(pts.map(d=>d.kilos))
    const mx  = pts.filter(d=>d.price>0).length ? Math.max(...pts.filter(d=>d.price>0).map(d=>d.price)) : 0
    const mn  = pts.filter(d=>d.price>0).length ? Math.min(...pts.filter(d=>d.price>0).map(d=>d.price)) : 0
    const pct = prevAvg && a ? ((a-prevAvg)/prevAvg)*100 : null
    prevAvg = a
    return `<tr>
      <td><strong>${y}</strong></td>
      <td>${fmtEur(a)}/kg</td>
      <td>${fmtEur(mx)}</td><td>${mn>0?fmtEur(mn):'—'}</td>
      ${hasRev?`<td class="td-total">${fmtEur(rev)}</td>`:''}
      ${kg>0?`<td class="td-num">${fmtKg(kg)}</td>`:''}
      <td>${pct!==null?`<span class="badge ${pct>=0?'badge-up':'badge-down'}">${fmtPct(pct)}</span>`:'—'}</td>
    </tr>`
  })
  const thead = `<thead><tr><th>Año</th><th>Precio medio</th><th>Máximo</th><th>Mínimo</th>${hasRev?'<th>Facturación</th>':''}${data.some(d=>d.kilos>0)?'<th>KG</th>':''}<th>Variación</th></tr></thead>`
  document.getElementById('compare-stats-table').innerHTML = thead + `<tbody>${rows.join('')}</tbody>`
}
window.renderCompare = renderCompare

// =========== PREDICCIONES ===========
function computePrediction(product) {
  const filtered = product ? data.filter(d=>d.product===product) : data
  if (filtered.length < 6) return null
  const years = [...new Set(filtered.map(d=>d.year))].sort((a,b)=>a-b)
  if (years.length < 2) return null
  const yearAvgs  = years.map(y => ({ year:y, avg: avg(filtered.filter(d=>d.year===y&&d.price>0).map(d=>d.price)) }))
  const growth    = []
  for (let i=1; i<yearAvgs.length; i++) {
    if (yearAvgs[i-1].avg>0) growth.push((yearAvgs[i].avg-yearAvgs[i-1].avg)/yearAvgs[i-1].avg)
  }
  const avgGrowth = growth.length ? sum(growth)/growth.length : 0
  const months    = [...new Set(filtered.filter(d=>d.month).map(d=>d.month))].sort((a,b)=>a-b)
  const mFactors  = {}
  const overall   = avg(filtered.filter(d=>d.price>0).map(d=>d.price))
  for (const m of months) {
    const mv = avg(filtered.filter(d=>d.month===m && d.price>0).map(d=>d.price))
    mFactors[m] = overall>0 ? mv/overall : 1
  }
  const lastYear    = Math.max(...years)
  const lastYearAvg = yearAvgs.find(y=>y.year===lastYear)?.avg || 0
  const preds       = []
  let lm = Math.max(...months.length ? months : [12])
  let py = lastYear
  for (let i=0; i<12; i++) {
    lm++; if (lm>12) { lm=1; py++ }
    const yearsAhead = py - lastYear
    const pred = lastYearAvg * (1 + avgGrowth*yearsAhead) * (mFactors[lm]||1)
    preds.push({ year:py, month:lm, price: Math.round(pred*1000)/1000 })
  }
  return { preds, avgGrowth, lastYearAvg, lastYear }
}

function renderPredictions() {
  populateAllSelects()
  const selProduct = document.getElementById('pred-product')?.value
  const result     = computePrediction(selProduct||null)
  const colors     = getChartColors()

  if (!result) {
    document.getElementById('pred-kpis').innerHTML = `<div class="kpi-card" style="grid-column:1/-1"><div class="kpi-label">Sin datos suficientes</div><div class="kpi-value" style="font-size:var(--text-base)">Necesitas al menos 2 años de datos para generar predicciones</div></div>`
    destroyChart('predChart')
    document.getElementById('pred-table').innerHTML = ''
    return
  }

  const { preds, avgGrowth, lastYearAvg, lastYear } = result
  const filtered = selProduct ? data.filter(d=>d.product===selProduct) : data
  const sorted   = [...filtered].filter(d=>d.month&&d.price>0).sort((a,b)=>(a.year-b.year)||(a.month-b.month))
  const cutoff   = lastYear - 2
  const recent   = sorted.filter(d=>d.year>=cutoff)
  const allLabels=[]; const allActual=[]; const allPred=[]
  const seen = new Set()
  for (const d of recent) {
    const k = `${d.year}-${String(d.month).padStart(2,'0')}`
    if (!seen.has(k)) { seen.add(k); allLabels.push(`${MONTHS[d.month-1]} ${d.year}`); allActual.push(d.price); allPred.push(null) }
  }
  for (const p of preds) {
    const k = `${p.year}-${String(p.month).padStart(2,'0')}`
    if (!seen.has(k)) { seen.add(k); allLabels.push(`${MONTHS[p.month-1]} ${p.year}`); allActual.push(null); allPred.push(p.price) }
  }

  destroyChart('predChart')
  const c = document.getElementById('predChart')?.getContext('2d')
  if (c) charts['predChart'] = new Chart(c, {
    type: 'line',
    data: {
      labels: allLabels,
      datasets: [
        { label:'Real', data:allActual, borderColor:'#01696f', backgroundColor:'rgba(1,105,111,0.08)', borderWidth:2, pointRadius:3, tension:0.3, fill:true, spanGaps:false },
        { label:'Predicción', data:allPred, borderColor:'#da7101', backgroundColor:'rgba(218,113,1,0.06)', borderWidth:2, borderDash:[6,3], pointRadius:3, tension:0.3, fill:true, spanGaps:true }
      ]
    },
    options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ display:true, labels:{ color:colors.tick, font:{size:12} } }, tooltip:{ callbacks:{ label: c=>`${c.dataset.label}: ${fmtEur(c.raw)}` } } }, scales:{ x:{ grid:{color:colors.grid}, ticks:{color:colors.tick,font:{size:10}} }, y:{ grid:{color:colors.grid}, ticks:{color:colors.tick,font:{size:11}, callback:v=>`${v} €`} } } }
  })

  const mid = preds[Math.min(5,preds.length-1)]
  const last= preds[preds.length-1]
  const ch6 = preds[0]&&mid ? ((mid.price-preds[0].price)/preds[0].price)*100 : 0
  const ch12= preds[0]&&last? ((last.price-preds[0].price)/preds[0].price)*100 : 0

  document.getElementById('pred-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Precio actual (${lastYear})</div><div class="kpi-value">${fmtEur(lastYearAvg)}/kg</div></div>
    <div class="kpi-card"><div class="kpi-label">Tendencia anual</div><div class="kpi-value">${fmtPct(avgGrowth*100)}</div><div class="kpi-delta ${avgGrowth>=0?'delta-up':'delta-down'}">${avgGrowth>=0?'▲':'▼'} Proyección</div></div>
    <div class="kpi-card"><div class="kpi-label">Estimado 6 meses</div><div class="kpi-value">${fmtEur(mid?.price||0)}/kg</div><div class="kpi-delta ${ch6>=0?'delta-up':'delta-down'}">${fmtPct(ch6)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Estimado 12 meses</div><div class="kpi-value">${fmtEur(last?.price||0)}/kg</div><div class="kpi-delta ${ch12>=0?'delta-up':'delta-down'}">${fmtPct(ch12)}</div></div>
  `

  let prevP = null
  const rows = preds.map(p => {
    const vsPrev = prevP ? ((p.price-prevP)/prevP)*100 : null
    prevP = p.price
    return `<tr>
      <td><strong>${MONTH_NAMES[p.month-1]} ${p.year}</strong></td>
      <td style="color:var(--color-orange);font-weight:600">${fmtEur(p.price)}/kg</td>
      <td>${vsPrev!==null?`<span class="badge ${vsPrev>=0?'badge-up':'badge-down'}">${fmtPct(vsPrev)}</span>`:'—'}</td>
    </tr>`
  }).join('')
  document.getElementById('pred-table').innerHTML = `<thead><tr><th>Mes</th><th>Precio estimado</th><th>Vs. mes anterior</th></tr></thead><tbody>${rows}</tbody>`
}
window.renderPredictions = renderPredictions

// =========== ADD RECORD ===========
function openAddModal()  { document.getElementById('add-modal').classList.add('open'); document.body.style.overflow='hidden' }
function openImportModal(){ document.getElementById('import-modal').classList.add('open'); document.body.style.overflow='hidden' }
function closeModal(id)  {
  document.getElementById(id).classList.remove('open')
  document.body.style.overflow = ''
  if (id === 'import-modal') {
    importData = null
    document.getElementById('column-mapping').style.display = 'none'
    document.getElementById('preview-section').style.display = 'none'
    document.getElementById('file-name').textContent = ''
    document.getElementById('file-input').value = ''
    document.getElementById('import-progress').style.display = 'none'
  }
}
window.openAddModal = openAddModal
window.openImportModal = openImportModal
window.closeModal = closeModal

async function addRecord() {
  const get = id => document.getElementById(id)?.value?.trim() || ''
  const product  = get('m-product')
  const category = get('m-category') || detectCategory(product) || 'Sin categoría'
  const price    = parseFloat(get('m-price').replace(',','.'))
  const year     = parseInt(get('m-year'))
  const month    = parseInt(get('m-month')) || null
  if (!product || isNaN(price) || isNaN(year)) { showToast('⚠ Rellena producto, precio y año','error'); return }

  const record = {
    product, category, price, unit: get('m-unit')||'kg', year, month,
    notes: get('m-notes'),
    cliente: get('m-cliente'), denominacion_social: get('m-denso'),
    referencia: get('m-ref'),
    kilos: parseFloat(get('m-kilos'))||0,
    base_iva: parseFloat(get('m-baseiva'))||0,
    documento: get('m-doc'), factura: get('m-factura'),
  }
  try {
    const saved = await dbAddRecord(record)
    if (saved) data.push(saved)
    closeModal('add-modal')
    populateAllSelects()
    showToast('✓ Registro añadido')
    document.querySelectorAll('#add-modal .form-input, #add-modal .form-select').forEach(el => el.value='')
  } catch(e) { console.error(e); showToast('⚠ Error al guardar','error') }
}
window.addRecord = addRecord

async function deleteRecord(id) {
  try {
    await dbDeleteRecord(id)
    data = data.filter(d => d.id !== id)
    rerenderCurrentPage()
    showToast('Registro eliminado')
  } catch(e) { console.error(e); showToast('⚠ Error al eliminar','error') }
}
window.deleteRecord = deleteRecord

// =========== EXPORT ===========
function exportCSV() {
  const headers = 'fecha,documento,cliente,denominacion_social,referencia,producto,categoria,kilos,pvp,base_iva,ano,mes,notas'
  const rows    = data.map(d =>
    [d.year+(d.month?'/'+d.month:''),d.documento,d.cliente,d.denominacion_social,d.referencia,d.product,d.category,d.kilos,d.price,d.base_iva,d.year,d.month||'',d.notes]
    .map(v=>String(v).includes(',')?`"${v}"`:v).join(',')
  )
  const blob = new Blob([[headers,...rows].join('\n')], { type:'text/csv;charset=utf-8;' })
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download='ventas_export.csv'; a.click()
  showToast('✓ CSV exportado')
}
window.exportCSV = exportCSV

// =========== IMPORT ===========
const COLUMN_AUTO_MAP = {
  producto:            ['articulo','artículo','producto','product','descripcion','descripción','nombre producto'],
  categoria:           ['categoria','categoría','category','familia','tipo','departamento'],
  precio:              ['pvp','precio','price','precio unitario'],
  unidad:              ['unidad','unit','um','medida'],
  año:                 ['año','ano','year','ejercicio','fecha','fecha albarán'],
  mes:                 ['mes','month','fecha'],
  notas:               ['notas','notes','observaciones','comentarios','matrícula','matricula'],
  cliente:             ['cliente','client','cod. cliente','código cliente','codigo cliente'],
  denominacion_social: ['denominación social','denominacion social','empresa','razon social','razón social','nombre cliente','nombre empresa'],
  referencia:          ['referencia','ref.','ref','cod. articulo','código artículo','codigo articulo'],
  kilos:               ['kilos','kg','kgs','peso','kilos netos'],
  unidades:            ['unid','unidades','units','cantidad','bultos'],
  litros:              ['litros','litres','liters','lts'],
  base_iva:            ['base iva','baseiva','importe total','total','base imponible'],
  tarifa:              ['tarifa','rate'],
  coste_adic:          ['costeadic','coste adic','coste adicional'],
  documento:           ['documento','doc.','doc','albarán','albaran'],
  factura:             ['factura','invoice','nº factura','num. factura'],
  fecha_fra:           ['fecha fra.','fecha fra','fecha factura','fechafra'],
  lin:                 ['lin','línea','linea','nº línea'],
}

let importData = null

function detectDelimiter(line) {
  const tabs   = (line.match(/\t/g)||[]).length
  const commas = (line.match(/,/g)||[]).length
  return tabs > commas ? '\t' : ','
}

function parseNumber(str) {
  const s = String(str).trim().replace(/\s/g,'')
  if (!s) return NaN
  if (s.includes(',') && !s.includes('.')) return parseFloat(s.replace(',','.'))
  if (s.includes(',') && s.includes('.'))  return parseFloat(s.replace(/\./g,'').replace(',','.'))
  return parseFloat(s)
}

function extractYear(val) {
  const s = String(val).trim()
  const m = s.match(/(\d{4})/)
  return m ? parseInt(m[1]) : NaN
}

function extractMonth(val) {
  const s = String(val).trim()
  // DD/MM/YYYY → month is second part
  const d = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})/)
  if (d) return parseInt(d[2])
  const n = parseInt(s)
  if (!isNaN(n) && n>=1 && n<=12 && s.length<=2) return n
  return null
}

async function decodeText(buf) {
  let text = new TextDecoder('utf-8',{fatal:false}).decode(buf)
  if (text.includes('�')) text = new TextDecoder('windows-1252').decode(buf)
  return text
}

async function handleFileSelect(e) {
  const file = e.target.files[0]
  if (!file) return
  document.getElementById('file-name').textContent = file.name
  document.getElementById('column-mapping').style.display  = 'none'
  document.getElementById('preview-section').style.display = 'none'

  const ext = file.name.split('.').pop().toLowerCase()
  let headers = [], rows = [], delimiter = ','

  try {
    if (['xlsx','xls'].includes(ext) && typeof XLSX !== 'undefined') {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type:'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
      if (raw.length < 2) { showToast('⚠ El archivo no tiene datos','error'); return }
      headers = raw[0].map(h => String(h).trim())
      rows    = raw.slice(1).filter(r=>r.some(c=>String(c).trim())).map(r=>{ while(r.length<headers.length)r.push(''); return r.map(c=>String(c).trim()) })
    } else {
      const buf  = await file.arrayBuffer()
      const text = await decodeText(buf)
      const lines= text.split('\n').filter(l=>l.trim())
      if (lines.length < 2) { showToast('⚠ El archivo no tiene datos','error'); return }
      delimiter = detectDelimiter(lines[0])
      headers   = lines[0].split(delimiter).map(h=>h.trim().replace(/^"|"$/g,''))
      rows      = lines.slice(1).map(l=>{ const p=l.split(delimiter).map(c=>c.trim().replace(/^"|"$/g,'')); while(p.length<headers.length)p.push(''); return p })
    }
  } catch(err) { console.error(err); showToast('⚠ Error al leer el archivo','error'); return }

  importData = { headers, rows, delimiter }
  showPreview(importData)
  const map = buildMapping(headers)
  applyMappingToUI(map, headers)

  if (map.producto !== null && (map.precio !== null || map.base_iva !== null)) {
    await executeImport()
  } else {
    document.getElementById('column-mapping').style.display = 'block'
  }
}
window.handleFileSelect = handleFileSelect

function buildMapping(headers) {
  const fields = Object.keys(COLUMN_AUTO_MAP)
  const map    = {}
  for (const field of fields) {
    const syns = COLUMN_AUTO_MAP[field] || []
    const idx  = headers.findIndex(h => {
      const hl = h.toLowerCase().trim()
      return syns.some(s => hl === s.toLowerCase() || hl.includes(s.toLowerCase()))
    })
    map[field] = idx >= 0 ? idx : null
  }
  // Date fallback: map año/mes from 'fecha' col
  if (map.año === null || map.mes === null) {
    const dateIdx = headers.findIndex(h => {
      const hl = h.toLowerCase().trim()
      return ['fecha','date','fecha albarán','fecha tra.'].some(s=>hl===s||hl.startsWith(s))
    })
    if (dateIdx >= 0) { if(map.año===null) map.año=dateIdx; if(map.mes===null) map.mes=dateIdx }
  }
  return map
}

function applyMappingToUI(map, headers) {
  const fields = Object.keys(COLUMN_AUTO_MAP)
  fields.forEach(field => {
    const el = document.getElementById(`map-${field}`)
    if (!el) return
    el.innerHTML = `<option value="">-- No importar --</option>` + headers.map((h,i)=>`<option value="${i}">${h}</option>`).join('')
    if (map[field] !== null) el.value = String(map[field])
  })
}

function showPreview(d) {
  const maxRows = Math.min(4, d.rows.length)
  const thead   = `<thead><tr>${d.headers.map(h=>`<th>${h}</th>`).join('')}</tr></thead>`
  const tbody   = `<tbody>${d.rows.slice(0,maxRows).map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>`
  document.getElementById('preview-table').innerHTML = thead + tbody
  document.getElementById('preview-info').textContent = `${d.rows.length.toLocaleString('es-ES')} filas · ${d.headers.length} columnas`
  document.getElementById('preview-section').style.display = 'block'
}

async function executeImport() {
  if (!importData?.rows?.length) { showToast('⚠ No hay datos para importar','error'); return }
  const { headers, rows } = importData

  const map = {}
  Object.keys(COLUMN_AUTO_MAP).forEach(field => {
    const el  = document.getElementById(`map-${field}`)
    const val = el?.value
    map[field] = (val && val !== '') ? parseInt(val) : null
  })

  const get = (row, field) => map[field] !== null ? (row[map[field]]||'') : ''

  const records = []
  for (const row of rows) {
    const product  = get(row,'producto')
    if (!product) continue
    const priceRaw = get(row,'precio')
    const baseRaw  = get(row,'base_iva')
    const price    = parseNumber(priceRaw)
    const base_iva = parseNumber(baseRaw) || 0
    const year     = extractYear(get(row,'año'))
    if (isNaN(year)) continue

    const catRaw  = get(row,'categoria')
    const category= catRaw || detectCategory(product)

    records.push({
      product, category,
      price:  isNaN(price) ? 0 : price,
      unit:   get(row,'unidad') || 'kg',
      year,
      month:  extractMonth(get(row,'mes')),
      notes:  get(row,'notas'),
      cliente:            get(row,'cliente'),
      denominacion_social:get(row,'denominacion_social'),
      referencia:         get(row,'referencia'),
      kilos:    parseNumber(get(row,'kilos'))  || 0,
      unidades: parseNumber(get(row,'unidades'))|| 0,
      litros:   parseNumber(get(row,'litros'))  || 0,
      tarifa:   parseNumber(get(row,'tarifa'))  || 0,
      coste_adic:parseNumber(get(row,'coste_adic'))||0,
      base_iva,
      documento: get(row,'documento'),
      factura:   get(row,'factura'),
      fecha_fra: get(row,'fecha_fra'),
      lin:       parseInt(get(row,'lin'))||0,
    })
  }

  if (!records.length) { showToast('⚠ No hay registros válidos (revisa la asignación de columnas)','error'); return }

  const progressEl = document.getElementById('import-progress')
  const progressBar= document.getElementById('import-progress-bar')
  const progressTxt= document.getElementById('import-progress-txt')
  progressEl.style.display = 'block'

  try {
    const saved = await dbAddRecords(records, (done, total) => {
      const pct = Math.round((done/total)*100)
      progressBar.style.width = pct + '%'
      progressTxt.textContent = `Importando… ${done.toLocaleString('es-ES')}/${total.toLocaleString('es-ES')} (${pct}%)`
    })
    data = data.concat(saved)
    closeModal('import-modal')
    populateAllSelects()
    showToast(`✓ ${saved.length.toLocaleString('es-ES')} registros importados`)
    rerenderCurrentPage()
  } catch(e) {
    console.error(e)
    showToast('⚠ Error al importar: ' + (e.message||''), 'error')
    progressEl.style.display = 'none'
  }
}

async function importCSV() {
  if (!importData) { showToast('⚠ Selecciona un archivo primero','error'); return }
  const mappingEl = document.getElementById('column-mapping')
  if (mappingEl.style.display === 'block') { await executeImport(); return }
  const map = buildMapping(importData.headers)
  applyMappingToUI(map, importData.headers)
  if (map.producto !== null && (map.precio !== null || map.base_iva !== null)) { await executeImport(); return }
  mappingEl.style.display = 'block'
  showToast('⚠ Asigna las columnas y pulsa Importar de nuevo')
}
window.importCSV = importCSV

// =========== THEME TOGGLE ===========
;(function(){
  const t = document.querySelector('[data-theme-toggle]')
  const r = document.documentElement
  let d   = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'
  r.setAttribute('data-theme', d)
  if (t) t.addEventListener('click', () => {
    d = d==='dark'?'light':'dark'
    r.setAttribute('data-theme', d)
    setTimeout(() => {
      const pg = document.querySelector('.page.active')?.id
      if (pg==='page-dashboard')    renderDashCharts()
      if (pg==='page-tendencias')   renderTrendCharts()
      if (pg==='page-comparar')     renderCompare()
      if (pg==='page-precios')      renderPrecios()
    }, 50)
  })
})()

export { initApp }
