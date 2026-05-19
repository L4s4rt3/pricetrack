import {
  fetchAllRecords, addRecord as dbAddRecord, addRecords as dbAddRecords,
  deleteRecord as dbDeleteRecord, deleteAllRecords as dbDeleteAllRecords, subscribeToChanges, normalizeRow
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
  if (n.includes('CARACARA'))   return 'Naranja Caracara'
  if (n.includes('NAVELINA'))   return 'Naranja Navelina'
  if (n.includes('SALUSTIANA')) return 'Naranja Salustiana'
  if (n.includes('NAVEL'))      return 'Naranja Navel'
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
  try {
    data = await fetchAllRecords()
  } catch(e) {
    console.error(e)
    showToast('⚠ Error al cargar datos de Supabase', 'error')
  }
  populateAllSelects()
  renderDashboard()
  renderHistoryView()

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

function rerenderCurrentPage() {
  const active = document.querySelector('.page.active')?.id
  if (!active) return
  populateAllSelects()
  if (active === 'page-dashboard')    { renderDashboard(); renderHistoryView() }
  else if (active === 'page-ventas')  renderVentas()
  else if (active === 'page-clientes') renderClientes()
  else if (active === 'page-tendencias') renderTrends()
  else if (active === 'page-comparar')  renderComparePage()
  else if (active === 'page-predicciones') renderPredictions()
  else if (active === 'page-datos')   renderTable()
  else if (active === 'page-buscar')  initSearch()
}

// =========== NAVIGATION ===========
function navigate(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById('page-' + page).classList.add('active')
  if (btn) btn.classList.add('active')
  // Defer heavy render so the page switch is instant visually
  requestAnimationFrame(() => {
    if (page === 'dashboard')    { renderDashboard(); renderHistoryView() }
    if (page === 'ventas')       { ventasPage = 0; renderVentas() }
    if (page === 'clientes')     { clienteSelected = null; renderClientes() }
    if (page === 'tendencias')   renderTrendCharts()
    if (page === 'comparar')     renderComparePage()
    if (page === 'predicciones') renderPredictions()
    if (page === 'datos')        renderTable()
    if (page === 'buscar')       initSearch()
  })
}
window.navigate = navigate

// =========== POPULATE SELECTS ===========
function populateAllSelects() {
  const years    = getYears()
  const products = getProducts()
  const cats     = getCategories()
  const clientes = getClientes()

  const pd = document.getElementById('product-datalist')
  if (pd) pd.innerHTML = products.map(p => `<option value="${p}">`).join('')
  const cd = document.getElementById('cat-datalist')
  if (cd) cd.innerHTML = cats.map(c => `<option value="${c}">`).join('')

  const dps = document.getElementById('dash-product-select')
  if (dps) dps.innerHTML = products.map(p => `<option value="${p}">${p}</option>`).join('')

  const dys = document.getElementById('dash-year-select')
  if (dys) {
    dys.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('')
    if (years.length) dys.value = years[years.length - 1]
  }

  const yearSel = document.getElementById('history-year')
  const catSel  = document.getElementById('history-category')
  if (yearSel) yearSel.innerHTML = `<option value="">Todos los años</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
  if (catSel)  catSel.innerHTML  = `<option value="">Todas las categorías</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('')

  ;['trend-product','cmp-product','search-product','pred-product'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = `<option value="">Todos los productos</option>` + products.map(p => `<option value="${p}">${p}</option>`).join('')
  })
  ;['trend-year-from','trend-year-to'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = `<option value="">—</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
  })

  const tyf = document.getElementById('table-year-filter')
  if (tyf) tyf.innerHTML = `<option value="">Todos los años</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
  const tcf = document.getElementById('table-cat-filter')
  if (tcf) tcf.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('')

  const sy = document.getElementById('search-year')
  if (sy) sy.innerHTML = `<option value="">Todos</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')

  // Ventas selects
  const setOpts = (id, items, allLabel) => {
    const el = document.getElementById(id)
    if (!el) return
    const prev = el.value
    el.innerHTML = `<option value="">${allLabel}</option>` + items.map(i => `<option value="${i}">${i}</option>`).join('')
    if (items.includes(prev) || items.map(String).includes(prev)) el.value = prev
  }
  setOpts('ventas-year',    years,    'Todos los años')
  setOpts('ventas-cliente', clientes, 'Todos los clientes')

  const vm = document.getElementById('ventas-month')
  if (vm) {
    const pv = vm.value
    vm.innerHTML = `<option value="">Todos los meses</option>` + MONTH_NAMES.map((m,i) => `<option value="${i+1}">${m}</option>`).join('')
    if (pv) vm.value = pv
  }
}

// =========== DASHBOARD ===========
function renderDashboard() {
  const years = getYears()
  if (!years.length) {
    document.getElementById('kpi-grid').innerHTML = '<div class="kpi-card" style="grid-column:1/-1"><div class="kpi-label">Sin datos</div><div class="kpi-value" style="font-size:var(--text-base)">Importa registros para comenzar</div></div>'
    return
  }

  const latestYear  = years[years.length - 1]
  const prevYear    = years[years.length - 2]
  const latestPrices = data.filter(d => d.year === latestYear && d.price > 0).map(d => d.price)
  const prevPrices   = data.filter(d => d.year === prevYear  && d.price > 0).map(d => d.price)
  const avgLatest   = avg(latestPrices)
  const avgPrev     = avg(prevPrices)
  const pctChange   = avgPrev ? ((avgLatest - avgPrev) / avgPrev) * 100 : 0

  const totalRevenue = sum(data.map(d => d.base_iva))
  const hasRevenue   = totalRevenue > 0
  const totalKg      = sum(data.map(d => d.kilos))
  const allPrices    = data.filter(d => d.price > 0).map(d => d.price)

  document.getElementById('dashboard-subtitle').textContent =
    `Datos de ${years[0]} a ${latestYear} · ${data.length.toLocaleString('es')} registros`

  let kpis
  if (hasRevenue) {
    const nClientes = new Set(data.map(d => d.cliente).filter(Boolean)).size || getClientes().length
    kpis = [
      { label: 'Facturación total',      value: fmtEur(totalRevenue),   delta: `${years[0]}–${latestYear}`, flat: true },
      { label: `Precio medio ${latestYear}`, value: fmtEur(avgLatest), delta: fmtPct(pctChange), up: pctChange > 0 },
      { label: 'Kilos vendidos',          value: totalKg > 0 ? fmtKg(totalKg) : '—', delta: 'Total acumulado', flat: true },
      { label: 'Clientes únicos',         value: String(nClientes), delta: 'Cartera activa', flat: true },
    ]
  } else {
    const maxP   = allPrices.length ? Math.max(...allPrices) : 0
    const minP   = allPrices.length ? Math.min(...allPrices) : 0
    const maxRec = data.find(d => d.price === maxP)
    const minRec = data.find(d => d.price === minP)
    kpis = [
      { label: `Precio medio ${latestYear}`, value: `${fmt(avgLatest)} €`, delta: fmtPct(pctChange), up: pctChange > 0 },
      { label: 'Total registros',  value: data.length.toLocaleString('es'), delta: `${years.length} años`, flat: true },
      { label: 'Precio máximo histórico', value: `${fmt(maxP)} €`, delta: `${maxRec?.product} (${maxRec?.year})`, flat: true },
      { label: 'Precio mínimo histórico', value: `${fmt(minP)} €`, delta: `${minRec?.product} (${minRec?.year})`, flat: true },
    ]
  }

  document.getElementById('kpi-grid').innerHTML = kpis.map(k => `
    <div class="kpi-card">
      <div class="kpi-label">${k.label}</div>
      <div class="kpi-value">${k.value}</div>
      <div class="kpi-delta ${k.flat ? 'delta-flat' : (k.up ? 'delta-up' : 'delta-down')}">${k.delta}</div>
    </div>
  `).join('')

  renderDashCharts()
}

function renderDashCharts() {
  const selProduct = document.getElementById('dash-product-select')?.value
  const selYear    = parseInt(document.getElementById('dash-year-select')?.value)
  const years      = getYears()
  const colors     = getChartColors()
  const hasRevenue = data.some(d => d.base_iva > 0)

  destroyChart('annualChart')
  const annualData = years.map(y => {
    const filtered = data.filter(d => d.year === y && (!selProduct || d.product === selProduct))
    return hasRevenue ? sum(filtered.map(d => d.base_iva)) : avg(filtered.filter(d=>d.price>0).map(d => d.price))
  })
  const ctx1 = document.getElementById('annualChart')?.getContext('2d')
  if (ctx1) charts['annualChart'] = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: selProduct || (hasRevenue ? 'Facturación' : 'Precio medio'),
        data: annualData,
        borderColor: '#01696f', backgroundColor: 'rgba(1,105,111,0.08)',
        borderWidth: 2, tension: 0.35, fill: true, pointRadius: 4, pointBackgroundColor: '#01696f',
      }]
    },
    options: baseChartOptions(colors, '€')
  })

  destroyChart('categoryChart')
  const cats = getCategories()
  const yr   = selYear || (years.length ? years[years.length-1] : new Date().getFullYear())
  const catVals = cats.map(c => {
    const rows = data.filter(x => x.category === c && x.year === yr)
    return hasRevenue ? sum(rows.map(x => x.base_iva)) : avg(rows.filter(x=>x.price>0).map(x => x.price))
  })
  const ctx2 = document.getElementById('categoryChart')?.getContext('2d')
  if (ctx2) charts['categoryChart'] = new Chart(ctx2, {
    type: 'doughnut',
    data: { labels: cats, datasets: [{ data: catVals, backgroundColor: CHART_COLORS.slice(0, cats.length), borderWidth: 2, borderColor: colors.bg }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: colors.tick, font:{ size:11 }, boxWidth:12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${hasRevenue ? fmtEur(ctx.raw) : fmt(ctx.raw)+' €'}` } }
      }
    }
  })

  destroyChart('monthlyChart')
  const yr2 = selYear || (years.length ? years[years.length-1] : new Date().getFullYear())
  const monthlyData = Array.from({length:12}, (_,i) => {
    const m = i+1
    const filtered = data.filter(d => d.year === yr2 && d.month === m && (!selProduct || d.product === selProduct))
    return hasRevenue ? sum(filtered.map(d => d.base_iva)) : avg(filtered.filter(d=>d.price>0).map(d => d.price))
  })
  const ctx3 = document.getElementById('monthlyChart')?.getContext('2d')
  if (ctx3) charts['monthlyChart'] = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [{
        label: `${selProduct || (hasRevenue ? 'Facturación' : 'Media')} ${yr2}`,
        data: monthlyData,
        backgroundColor: monthlyData.map(v => v > 0 && v === Math.max(...monthlyData.filter(Boolean)) ? '#da7101' : 'rgba(1,105,111,0.65)'),
        borderRadius: 5, borderSkipped: false,
      }]
    },
    options: baseChartOptions(colors, '€')
  })
}
window.renderDashCharts = renderDashCharts

// =========== HISTORY VIEW ===========
function getHistoryFiltered() {
  const q    = (document.getElementById('history-search')?.value || '').toLowerCase()
  const year = parseInt(document.getElementById('history-year')?.value || '') || null
  const cat  = document.getElementById('history-category')?.value || ''
  let rows = data.filter(r => {
    let ok = true
    if (q)    ok = ok && r.product.toLowerCase().includes(q)
    if (year) ok = ok && r.year === year
    if (cat)  ok = ok && r.category === cat
    return ok
  })
  rows = rows.sort((a,b) => {
    const d = (a.year - b.year) || ((a.month||0) - (b.month||0))
    return (document.getElementById('history-sort')?.value || 'desc') === 'asc' ? d : -d
  })
  return rows
}

function renderHistoryView() {
  const rows = getHistoryFiltered()
  const historyList    = document.getElementById('historyList')
  const historySummary = document.getElementById('historySummary')
  const chartColors    = getChartColors()
  destroyChart('historyChart')

  if (!rows.length) {
    if (historyList)    historyList.innerHTML = '<div class="empty-state"><h3>Sin registros</h3><p>No hay datos para esos filtros.</p></div>'
    if (historySummary) historySummary.innerHTML = '<div class="empty-state"><h3>Sin resumen</h3><p>Selecciona otro producto o quita filtros.</p></div>'
    return
  }

  const grouped = Object.values(rows.reduce((acc, r) => {
    const key = r.product
    if (!acc[key]) acc[key] = { product: key, category: r.category, items: [] }
    acc[key].items.push(r)
    return acc
  }, {}))

  const top    = grouped[0]
  const prices = top.items.map(x => x.price).filter(p => p > 0)
  const first  = top.items[0]
  const last   = top.items[top.items.length - 1]
  const delta  = first && last && first.price > 0 ? ((last.price - first.price) / first.price) * 100 : 0

  if (historySummary) {
    historySummary.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Producto</div><div class="kpi-value" style="font-size:1rem">${top.product}</div><div class="kpi-delta delta-flat">${top.category}</div></div>
      <div class="kpi-card"><div class="kpi-label">Primer precio</div><div class="kpi-value">${fmt(first.price)} €</div></div>
      <div class="kpi-card"><div class="kpi-label">Último precio</div><div class="kpi-value">${fmt(last.price)} €</div><div class="kpi-delta ${delta >= 0 ? 'delta-up' : 'delta-down'}">${fmtPct(delta)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Máximo</div><div class="kpi-value">${prices.length ? fmt(Math.max(...prices)) : '—'} €</div></div>
      <div class="kpi-card"><div class="kpi-label">Mínimo</div><div class="kpi-value">${prices.length ? fmt(Math.min(...prices)) : '—'} €</div></div>
    `
  }

  const ctx = document.getElementById('historyChart')?.getContext('2d')
  if (ctx) {
    charts['historyChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: top.items.map(x => `${MONTHS[(x.month||1)-1]} ${x.year}`),
        datasets: [{
          label: top.product,
          data: top.items.map(x => x.price),
          borderColor: '#01696f', backgroundColor: 'rgba(1,105,111,0.08)',
          borderWidth: 2, tension: 0.3, pointRadius: 3, fill: true
        }]
      },
      options: baseChartOptions(chartColors, '€')
    })
  }

  if (historyList) {
    historyList.innerHTML = grouped.map(g => {
      const vals  = g.items.map(x => x.price).filter(p => p > 0)
      const deltaG = g.items.length > 1 && g.items[0].price > 0
        ? ((g.items[g.items.length-1].price - g.items[0].price) / g.items[0].price) * 100 : 0
      return `
        <div class="history-item">
          <h4>${g.product}</h4>
          <div class="meta"><span>${g.category}</span><span>${g.items.length} registros</span><span>${g.items[0].year} → ${g.items[g.items.length-1].year}</span></div>
          <div class="value">${fmt(g.items[g.items.length-1].price)} €</div>
          <div class="evolution-pill ${deltaG >= 0 ? 'evo-up' : 'evo-down'}">${deltaG >= 0 ? '▲' : '▼'} ${fmtPct(deltaG)}</div>
        </div>
      `
    }).join('')
  }
}
window.renderHistoryView = renderHistoryView

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
  }).sort((a,b) => (b.year - a.year) || ((b.month||0) - (a.month||0)))
}

function renderVentas() {
  const rows     = getVentasFiltered()
  const total    = rows.length
  const start    = ventasPage * ventasPageSize
  const pageRows = rows.slice(start, start + ventasPageSize)

  const hasRev = rows.some(d => d.base_iva > 0)
  const hasKg  = rows.some(d => d.kilos > 0)
  const rev    = sum(rows.map(d => d.base_iva))
  const kg     = sum(rows.map(d => d.kilos))

  document.getElementById('ventas-summary').innerHTML = `
    <span class="summary-chip">${fmtNum(total)} registros</span>
    ${hasRev ? `<span class="summary-chip chip-gold">${fmtEur(rev)} facturado</span>` : ''}
    ${hasKg  ? `<span class="summary-chip chip-blue">${fmtKg(kg)} vendidos</span>` : ''}
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
        <td class="td-total">${d.base_iva !== 0 ? fmtEur(d.base_iva) : '—'}</td>
        <td><button class="btn-delete" onclick="deleteRecord(${d.id})" title="Eliminar">✕</button></td>
      </tr>`
    }).join('')
  }

  const totalPages = Math.ceil(total / ventasPageSize)
  const pag = document.getElementById('ventas-pagination')
  if (pag) {
    pag.innerHTML = totalPages <= 1 ? '' : `
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(0)" ${ventasPage===0?'disabled':''}>«</button>
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(${ventasPage-1})" ${ventasPage===0?'disabled':''}>‹</button>
      <span class="pag-info">Pág. ${ventasPage+1} de ${totalPages}</span>
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(${ventasPage+1})" ${ventasPage>=totalPages-1?'disabled':''}>›</button>
      <button class="btn btn-ghost pag-btn" onclick="ventasGoPage(${totalPages-1})" ${ventasPage>=totalPages-1?'disabled':''}>»</button>
      <select class="form-select" onchange="setVentasPageSize(this.value)" style="width:auto;padding:4px 8px">
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
  if (clienteSelected) { renderClienteDetail(clienteSelected); return }

  const hasRev = data.some(d => d.base_iva > 0)
  const hasKg  = data.some(d => d.kilos > 0)

  const clientMap = {}
  data.forEach(d => {
    const code = d.cliente || ''
    const name = d.denominacion_social || d.cliente || 'Desconocido'
    const key  = code || name
    if (!clientMap[key]) clientMap[key] = { code, name, rev:0, kg:0, n:0, years:new Set(), lastYear:0 }
    clientMap[key].rev += d.base_iva
    clientMap[key].kg  += d.kilos
    clientMap[key].n   += 1
    clientMap[key].years.add(d.year)
    if (d.year > clientMap[key].lastYear) clientMap[key].lastYear = d.year
  })

  const clients = Object.values(clientMap).sort((a,b) => b.rev - a.rev || b.kg - a.kg)
  const totRev  = sum(clients.map(c=>c.rev))
  const totKg   = sum(clients.map(c=>c.kg))

  document.getElementById('cli-kpis').innerHTML = `
    <div class="kpi-card kpi-teal">
      <div class="kpi-label">Clientes totales</div>
      <div class="kpi-value">${clients.length}</div>
    </div>
    ${hasRev ? `<div class="kpi-card kpi-gold">
      <div class="kpi-label">Facturación total</div>
      <div class="kpi-value">${fmtEur(totRev)}</div>
    </div>` : ''}
    ${hasKg ? `<div class="kpi-card kpi-blue">
      <div class="kpi-label">KG totales vendidos</div>
      <div class="kpi-value">${fmtKg(totKg)}</div>
    </div>` : ''}
    ${hasRev ? `<div class="kpi-card">
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

function selectCliente(key) { clienteSelected = key; renderClienteDetail(key) }
window.selectCliente = selectCliente

function backToClientes() { clienteSelected = null; renderClientes() }
window.backToClientes = backToClientes

function renderClienteDetail(key) {
  const cliData = data.filter(d => d.cliente === key || d.denominacion_social === key)
  if (!cliData.length) { backToClientes(); return }

  const name   = cliData[0].denominacion_social || cliData[0].cliente || key
  const rev    = sum(cliData.map(d=>d.base_iva))
  const kg     = sum(cliData.map(d=>d.kilos))
  const years  = [...new Set(cliData.map(d=>d.year))].sort()
  const hasRev = rev > 0
  const hasKg  = kg > 0
  const avgPvp = avg(cliData.filter(d=>d.price>0).map(d=>d.price))

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
      ${hasRev?`<div class="kpi-card kpi-gold"><div class="kpi-label">Facturación total</div><div class="kpi-value">${fmtEur(rev)}</div></div>`:''}
      ${hasKg ?`<div class="kpi-card kpi-blue"><div class="kpi-label">KG totales</div><div class="kpi-value">${fmtKg(kg)}</div></div>`:''}
      <div class="kpi-card"><div class="kpi-label">PVP medio</div><div class="kpi-value">${fmtEur(avgPvp)}/kg</div></div>
      <div class="kpi-card"><div class="kpi-label">Registros</div><div class="kpi-value">${fmtNum(cliData.length)}</div></div>
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

  const colors = getChartColors()
  setTimeout(() => {
    destroyChart('cliAnnualChart')
    const c1 = document.getElementById('cliAnnualChart')?.getContext('2d')
    if (c1) charts['cliAnnualChart'] = new Chart(c1, {
      type: 'bar',
      data: {
        labels: years,
        datasets: [{ label: hasRev?'Facturado (€)':'KG', data: years.map(y=>{ const yd=cliData.filter(d=>d.year===y); return hasRev?sum(yd.map(d=>d.base_iva)):sum(yd.map(d=>d.kilos)) }), backgroundColor:'rgba(1,105,111,0.65)', borderRadius:5 }]
      },
      options: baseChartOptions(colors, hasRev?'€':'kg')
    })

    destroyChart('cliProdChart')
    const c2 = document.getElementById('cliProdChart')?.getContext('2d')
    if (c2) charts['cliProdChart'] = new Chart(c2, {
      type: 'doughnut',
      data: {
        labels: topProds.map(([k]) => k.length>22?k.slice(0,22)+'…':k),
        datasets: [{ data: topProds.map(([,v]) => hasRev?v.rev:v.kg), backgroundColor: CHART_COLORS, borderWidth:2, borderColor: colors.bg }]
      },
      options: { responsive:true, maintainAspectRatio:false, plugins:{ legend:{ position:'bottom', labels:{ color:colors.tick, font:{size:10}, boxWidth:10 } }, tooltip:{ callbacks:{ label: c=>` ${hasRev?fmtEur(c.raw):fmtKg(c.raw)}` } } } }
    })
  }, 50)
}

// =========== TENDENCIAS ===========
function renderTrends() { renderTrendCharts() }
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

  const prices   = filtered.filter(d => d.price > 0).map(d => d.price)
  const totRev   = sum(filtered.map(d => d.base_iva))
  const totKg    = sum(filtered.map(d => d.kilos))
  const hasRev   = totRev > 0
  const hasPrices= prices.length > 0

  // Use revenue per year when no price data; otherwise use avg price
  const yearVals = years.map(y => {
    const yd = filtered.filter(d => d.year === y)
    if (hasPrices) return avg(yd.filter(d => d.price > 0).map(d => d.price))
    return sum(yd.map(d => d.base_iva))
  })
  const varPct = yearVals.map((v, i) => i === 0 ? 0 : yearVals[i-1] ? ((v - yearVals[i-1]) / yearVals[i-1]) * 100 : 0)
  const trend  = yearVals.length >= 2 ? yearVals[yearVals.length-1] - yearVals[0] : 0

  // KPIs
  const kpiLabel = hasPrices ? 'Precio medio período' : 'Facturación total'
  const kpiValue = hasPrices ? fmtEur(avg(prices)) : fmtEur(totRev)
  const maxVal   = hasPrices ? (prices.length ? Math.max(...prices) : 0) : Math.max(...yearVals)
  const minVal   = hasPrices ? (prices.length ? Math.min(...prices) : 0) : Math.min(...yearVals)

  document.getElementById('trend-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">${kpiLabel}</div><div class="kpi-value">${kpiValue}</div></div>
    <div class="kpi-card"><div class="kpi-label">${hasPrices ? 'Precio máximo' : 'Mejor año'}</div><div class="kpi-value">${fmtEur(maxVal)}</div></div>
    <div class="kpi-card"><div class="kpi-label">${hasPrices ? 'Precio mínimo' : 'Año más bajo'}</div><div class="kpi-value">${fmtEur(minVal)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Tendencia general</div><div class="kpi-value">${trend>=0?'+':''}${fmtEur(trend)}</div><div class="kpi-delta ${trend>=0?'delta-up':'delta-down'}">${trend>=0?'▲ Alza':'▼ Baja'}</div></div>
    ${totKg>0?`<div class="kpi-card kpi-blue"><div class="kpi-label">KG totales</div><div class="kpi-value">${fmtKg(totKg)}</div></div>`:''}
  `

  const colors = getChartColors()
  const mainUnit = hasPrices ? '€/kg' : '€'
  const mainLabel= hasPrices ? 'Precio medio' : 'Facturación'

  // Main trend chart: monthly price avg OR monthly revenue
  destroyChart('trendMainChart')
  const allPts = []
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      const yd = filtered.filter(d => d.year === y && d.month === m)
      if (hasPrices) {
        const pts = yd.filter(d => d.price > 0).map(d => d.price)
        if (pts.length) allPts.push({ label: `${MONTHS[m-1]} ${y}`, value: avg(pts) })
      } else {
        const rev = sum(yd.map(d => d.base_iva))
        if (rev > 0) allPts.push({ label: `${MONTHS[m-1]} ${y}`, value: rev })
      }
    }
  }
  const c1 = document.getElementById('trendMainChart')?.getContext('2d')
  if (c1) charts['trendMainChart'] = new Chart(c1, {
    type: 'line',
    data: { labels: allPts.map(p => p.label), datasets: [{ label: mainLabel, data: allPts.map(p => p.value), borderColor: '#01696f', backgroundColor: 'rgba(1,105,111,0.07)', borderWidth: 2, tension: 0.35, fill: true, pointRadius: 2 }] },
    options: baseChartOptions(colors, mainUnit)
  })

  // Max/min by year (price) or top/bottom revenue years
  destroyChart('trendMinMaxChart')
  const c2 = document.getElementById('trendMinMaxChart')?.getContext('2d')
  if (c2) {
    const ds = hasPrices
      ? [
          { label: 'Máximo', data: years.map(y => { const p = filtered.filter(d => d.year===y && d.price>0).map(d=>d.price); return p.length ? Math.max(...p) : 0 }), backgroundColor: 'rgba(218,113,1,0.7)', borderRadius: 4 },
          { label: 'Mínimo', data: years.map(y => { const p = filtered.filter(d => d.year===y && d.price>0).map(d=>d.price); return p.length ? Math.min(...p) : 0 }), backgroundColor: 'rgba(1,105,111,0.5)', borderRadius: 4 },
        ]
      : [{ label: 'Facturación anual', data: yearVals, backgroundColor: 'rgba(1,105,111,0.6)', borderRadius: 4 }]
    charts['trendMinMaxChart'] = new Chart(c2, {
      type: 'bar',
      data: { labels: years, datasets: ds },
      options: { ...baseChartOptions(colors, '€'), plugins: { legend: { display: hasPrices, labels: { color: colors.tick } } } }
    })
  }

  // Variation % year over year
  destroyChart('trendVarChart')
  const c3 = document.getElementById('trendVarChart')?.getContext('2d')
  if (c3 && years.length > 1) charts['trendVarChart'] = new Chart(c3, {
    type: 'bar',
    data: { labels: years.slice(1), datasets: [{ label: 'Variación %', data: varPct.slice(1), backgroundColor: varPct.slice(1).map(v => v >= 0 ? 'rgba(67,122,34,0.7)' : 'rgba(161,44,123,0.7)'), borderRadius: 4 }] },
    options: baseChartOptions(colors, '%')
  })

  // Volume chart
  destroyChart('trendVolChart')
  const c4 = document.getElementById('trendVolChart')?.getContext('2d')
  if (c4 && (hasRev || totKg > 0)) charts['trendVolChart'] = new Chart(c4, {
    type: 'bar',
    data: { labels: years, datasets: [{ label: hasRev ? 'Facturación (€)' : 'KG vendidos', data: years.map(y => { const yd = filtered.filter(d => d.year===y); return hasRev ? sum(yd.map(d=>d.base_iva)) : sum(yd.map(d=>d.kilos)) }), backgroundColor: 'rgba(0,100,148,0.6)', borderRadius: 4 }] },
    options: baseChartOptions(colors, hasRev ? '€' : 'kg')
  })
}
window.renderTrendCharts = renderTrendCharts

// =========== COMPARAR ===========
function renderComparePage() { selectedYears = []; renderYearCards() }
window.renderComparePage = renderComparePage

function renderYearCards() {
  const years  = getYears()
  const hasRev = data.some(d=>d.base_iva>0)
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
  if (i > -1) selectedYears.splice(i,1); else selectedYears.push(y)
  renderYearCards(); renderCompare()
}
window.toggleYear = toggleYear

function renderCompare() {
  const selProduct = document.getElementById('cmp-product')?.value
  const chartCard  = document.getElementById('compare-chart-card')
  const tableCard  = document.getElementById('compare-table-card')
  if (selectedYears.length < 2) { chartCard.style.display='none'; tableCard.style.display='none'; return }
  chartCard.style.display = ''; tableCard.style.display = ''

  const colors = getChartColors()
  const hasRev = data.some(d=>d.base_iva>0)
  destroyChart('compareChart')
  const datasets = selectedYears.sort().map((y,i) => {
    const mdata = Array.from({length:12},(_,mi) => {
      const pts = data.filter(d=>d.year===y && d.month===mi+1 && (!selProduct||d.product===selProduct))
      return hasRev ? sum(pts.map(d=>d.base_iva)) : avg(pts.filter(d=>d.price>0).map(d=>d.price)) || null
    })
    return { label:String(y), data:mdata, borderColor:CHART_COLORS[i%CHART_COLORS.length], backgroundColor:CHART_COLORS[i%CHART_COLORS.length]+'15', borderWidth:2, tension:0.35, fill:false, pointRadius:4 }
  })
  const c = document.getElementById('compareChart')?.getContext('2d')
  if (c) charts['compareChart'] = new Chart(c, {
    type: 'line',
    data: { labels: MONTHS, datasets },
    options: { ...baseChartOptions(colors, hasRev?'€':'€/kg'), plugins:{ legend:{ display:true, labels:{ color:colors.tick, font:{size:12} } } } }
  })

  let prevAvg = null
  const rows = selectedYears.sort().map(y => {
    const pts = data.filter(d=>d.year===y && (!selProduct||d.product===selProduct))
    const a   = avg(pts.filter(d=>d.price>0).map(d=>d.price))
    const rev = sum(pts.map(d=>d.base_iva))
    const kg  = sum(pts.map(d=>d.kilos))
    const mx  = pts.filter(d=>d.price>0).length ? Math.max(...pts.filter(d=>d.price>0).map(d=>d.price)) : 0
    const mn  = pts.filter(d=>d.price>0).length ? Math.min(...pts.filter(d=>d.price>0).map(d=>d.price)) : 0
    const pct = prevAvg && a ? ((a-prevAvg)/prevAvg)*100 : null
    prevAvg = a
    return `<tr>
      <td><strong>${y}</strong></td><td>${fmtEur(a)}/kg</td>
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
  const yearAvgs = years.map(y => ({ year:y, avg: avg(filtered.filter(d=>d.year===y&&d.price>0).map(d=>d.price)) }))
  const growth   = []
  for (let i=1; i<yearAvgs.length; i++) {
    if (yearAvgs[i-1].avg>0) growth.push((yearAvgs[i].avg-yearAvgs[i-1].avg)/yearAvgs[i-1].avg)
  }
  const avgGrowth  = growth.length ? sum(growth)/growth.length : 0
  const months     = [...new Set(filtered.filter(d=>d.month).map(d=>d.month))].sort((a,b)=>a-b)
  const mFactors   = {}
  const overall    = avg(filtered.filter(d=>d.price>0).map(d=>d.price))
  for (const m of months) {
    const mv = avg(filtered.filter(d=>d.month===m && d.price>0).map(d=>d.price))
    mFactors[m] = overall>0 ? mv/overall : 1
  }
  const lastYear    = Math.max(...years)
  const lastYearAvg = yearAvgs.find(y=>y.year===lastYear)?.avg || 0
  const preds       = []
  let lm = Math.max(...(months.length ? months : [12]))
  let py = lastYear
  for (let i=0; i<12; i++) {
    lm++; if (lm>12) { lm=1; py++ }
    const pred = lastYearAvg * (1 + avgGrowth*(py-lastYear)) * (mFactors[lm]||1)
    preds.push({ year:py, month:lm, price: Math.round(pred*1000)/1000 })
  }
  return { preds, avgGrowth, lastYearAvg, lastYear }
}

function renderPredictions() {
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
  const recent   = sorted.filter(d=>d.year>=lastYear-2)
  const allLabels=[]; const allActual=[]; const allPred=[]; const seen=new Set()
  for (const d of recent) {
    const k=`${d.year}-${String(d.month).padStart(2,'0')}`
    if (!seen.has(k)) { seen.add(k); allLabels.push(`${MONTHS[d.month-1]} ${d.year}`); allActual.push(d.price); allPred.push(null) }
  }
  for (const p of preds) {
    const k=`${p.year}-${String(p.month).padStart(2,'0')}`
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
  const ch6 = preds[0]&&mid  ? ((mid.price-preds[0].price)/preds[0].price)*100 : 0
  const ch12= preds[0]&&last ? ((last.price-preds[0].price)/preds[0].price)*100 : 0

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

// =========== DATOS / TABLA ===========
function renderTable() {
  const search = document.getElementById('table-search')?.value.toLowerCase() || ''
  const yearF  = parseInt(document.getElementById('table-year-filter')?.value) || null
  const catF   = document.getElementById('table-cat-filter')?.value || ''

  let rows = data.filter(d => {
    let ok = true
    if (search) ok = ok && (d.product.toLowerCase().includes(search) || d.category.toLowerCase().includes(search) || (d.denominacion_social||'').toLowerCase().includes(search))
    if (yearF) ok = ok && d.year === yearF
    if (catF)  ok = ok && d.category === catF
    return ok
  }).sort((a,b) => b.year - a.year || (a.month||0) - (b.month||0))

  const tbody = document.getElementById('table-body')
  if (!rows.length) {
    tbody.innerHTML = `<tr><td colspan="10" class="empty-row">No se encontraron registros</td></tr>`
  } else {
    tbody.innerHTML = rows.slice(0, 200).map(d => {
      const prevY = data.find(r => r.product === d.product && r.year === d.year - 1 && r.month === d.month)
      let delta = '', badgeCls = 'badge-flat'
      if (prevY && prevY.price > 0 && d.price > 0) {
        const pct = ((d.price - prevY.price) / prevY.price) * 100
        delta = fmtPct(pct)
        badgeCls = pct > 0.5 ? 'badge-up' : pct < -0.5 ? 'badge-down' : 'badge-flat'
      }
      const nombre = d.denominacion_social || d.cliente || '—'
      return `<tr>
        <td><strong>${d.product}</strong></td>
        <td>${d.category}</td>
        <td>${d.year}</td>
        <td>${d.month ? MONTH_NAMES[d.month-1] : '—'}</td>
        <td class="td-num">${d.price > 0 ? fmtEur(d.price) : '—'}</td>
        <td class="td-total">${d.base_iva !== 0 ? fmtEur(d.base_iva) : '—'}</td>
        <td class="td-num">${d.kilos > 0 ? fmtKg(d.kilos) : '—'}</td>
        <td>${nombre.length>25?nombre.slice(0,25)+'…':nombre}</td>
        <td>${delta ? `<span class="badge ${badgeCls}">${delta}</span>` : '—'}</td>
        <td><button class="btn-delete" onclick="deleteRecord(${d.id})" title="Eliminar">✕</button></td>
      </tr>`
    }).join('')
  }
  document.getElementById('table-count').textContent = `Mostrando ${Math.min(rows.length, 200)} de ${rows.length} registros`
}
window.renderTable = renderTable

// =========== BUSCAR ===========
function initSearch() { populateAllSelects() }
window.initSearch = initSearch

function doSearch() {
  const product = document.getElementById('search-product').value
  const year    = parseInt(document.getElementById('search-year').value) || null
  const month   = parseInt(document.getElementById('search-month').value) || null

  let results = data.filter(d => {
    let ok = true
    if (product) ok = ok && d.product === product
    if (year)    ok = ok && d.year === year
    if (month)   ok = ok && d.month === month
    return ok
  })

  const container = document.getElementById('search-results')
  if (!results.length) {
    container.innerHTML = `<div class="card"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>Sin resultados</h3><p>Prueba con otros filtros de búsqueda</p></div></div>`
    return
  }

  const prices  = results.map(d => d.price).filter(p=>p>0)
  const avgPrice= avg(prices)
  const maxPrice= prices.length ? Math.max(...prices) : 0
  const minPrice= prices.length ? Math.min(...prices) : 0

  container.innerHTML = `
    <div class="grid-3" style="margin-bottom: var(--space-6)">
      <div class="kpi-card"><div class="kpi-label">Precio medio</div><div class="kpi-value">${fmtEur(avgPrice)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Precio máximo</div><div class="kpi-value">${fmtEur(maxPrice)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Precio mínimo</div><div class="kpi-value">${minPrice>0?fmtEur(minPrice):'—'}</div></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Producto</th><th>Categoría</th><th>Año</th><th>Mes</th><th>Precio</th><th>Base IVA</th><th>Cliente</th></tr></thead>
        <tbody>
          ${results.sort((a,b)=>b.year-a.year||(a.month||0)-(b.month||0)).slice(0,100).map(d=>`
            <tr>
              <td><strong>${d.product}</strong></td>
              <td>${d.category}</td>
              <td>${d.year}</td>
              <td>${d.month ? MONTH_NAMES[d.month-1] : '—'}</td>
              <td class="td-num">${d.price>0?fmtEur(d.price):'—'}</td>
              <td class="td-total">${d.base_iva!==0?fmtEur(d.base_iva):'—'}</td>
              <td>${d.denominacion_social||d.cliente||'—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">${results.length} resultados encontrados</p>
  `
}
window.doSearch = doSearch

// =========== MODALS ===========
function openAddModal()   { document.getElementById('add-modal').classList.add('open'); document.body.style.overflow='hidden' }
function openImportModal(){ document.getElementById('import-modal').classList.add('open'); document.body.style.overflow='hidden' }
function closeModal(id) {
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

// =========== ADD RECORD ===========
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
    kilos:   parseFloat(get('m-kilos'))  || 0,
    base_iva:parseFloat(get('m-baseiva'))|| 0,
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

async function deleteAllRecords() {
  if (!data.length) { showToast('No hay datos que borrar'); return }
  if (!confirm('¿Borrar TODOS los registros? Esta acción no se puede deshacer.')) return
  if (!confirm(`Confirmación: vas a eliminar ${data.length.toLocaleString('es-ES')} registros. ¿Seguro?`)) return
  try {
    await dbDeleteAllRecords()
    data = []
    populateAllSelects()
    rerenderCurrentPage()
    showToast('✓ Todos los registros eliminados')
  } catch(e) { console.error(e); showToast('⚠ Error al borrar','error') }
}
window.deleteAllRecords = deleteAllRecords

// =========== EXPORT ===========
function exportCSV() {
  const headers = 'fecha,documento,cliente,denominacion_social,referencia,producto,categoria,kilos,pvp,base_iva,ano,mes,notas'
  const rows    = data.map(d =>
    [d.year+(d.month?'/'+d.month:''),d.documento,d.cliente,d.denominacion_social,d.referencia,d.product,d.category,d.kilos,d.price,d.base_iva,d.year,d.month||'',d.notes]
    .map(v => String(v||'').includes(',') ? `"${v}"` : (v||'')).join(',')
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
  let headers = [], rows = []

  try {
    if (['xlsx','xls'].includes(ext) && typeof XLSX !== 'undefined') {
      const buf = await file.arrayBuffer()
      const wb  = XLSX.read(buf, { type:'array' })
      const ws  = wb.Sheets[wb.SheetNames[0]]
      const raw = XLSX.utils.sheet_to_json(ws, { header:1, defval:'' })
      if (raw.length < 2) { showToast('⚠ El archivo no tiene datos','error'); return }
      headers = raw[0].map(h => String(h).trim())
      rows    = raw.slice(1).filter(r=>r.some(c=>String(c).trim())).map(r=>{ while(r.length<headers.length)r.push(''); return r.map(c=>String(c).trim()) })
    } else if (ext === 'csv' && typeof Papa !== 'undefined') {
      const text = await file.text()
      const result = Papa.parse(text, { header: false, skipEmptyLines: true })
      if (!result.data || result.data.length < 2) { showToast('⚠ El archivo no tiene datos','error'); return }
      headers = result.data[0].map(h => String(h).trim().replace(/^"|"$/g,''))
      rows = result.data.slice(1).filter(r => r.some(c => String(c).trim())).map(r => {
        while (r.length < headers.length) r.push('')
        return r.map(c => String(c).trim().replace(/^"|"$/g,''))
      })
    } else {
      const buf  = await file.arrayBuffer()
      const text = await decodeText(buf)
      const lines= text.split('\n').filter(l=>l.trim())
      if (lines.length < 2) { showToast('⚠ El archivo no tiene datos','error'); return }
      const delimiter = detectDelimiter(lines[0])
      headers = lines[0].split(delimiter).map(h=>h.trim().replace(/^"|"$/g,''))
      rows    = lines.slice(1).map(l=>{ const p=l.split(delimiter).map(c=>c.trim().replace(/^"|"$/g,'')); while(p.length<headers.length)p.push(''); return p })
    }
  } catch(err) { console.error(err); showToast('⚠ Error al leer el archivo','error'); return }

  importData = { headers, rows }
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
  Object.keys(COLUMN_AUTO_MAP).forEach(field => {
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
    const product = get(row,'producto')
    if (!product) continue
    const year = extractYear(get(row,'año'))
    if (isNaN(year)) continue
    const price   = parseNumber(get(row,'precio'))
    const base_iva= parseNumber(get(row,'base_iva')) || 0
    const catRaw  = get(row,'categoria')
    records.push({
      product, category: catRaw || detectCategory(product),
      price:    isNaN(price) ? 0 : price,
      unit:     get(row,'unidad') || 'kg',
      year,
      month:    extractMonth(get(row,'mes')),
      notes:    get(row,'notas'),
      cliente:             get(row,'cliente'),
      denominacion_social: get(row,'denominacion_social'),
      referencia:          get(row,'referencia'),
      kilos:     parseNumber(get(row,'kilos'))     || 0,
      unidades:  parseNumber(get(row,'unidades'))  || 0,
      litros:    parseNumber(get(row,'litros'))     || 0,
      tarifa:    parseNumber(get(row,'tarifa'))     || 0,
      coste_adic:parseNumber(get(row,'coste_adic'))|| 0,
      base_iva,
      documento: get(row,'documento'),
      factura:   get(row,'factura'),
      fecha_fra: get(row,'fecha_fra'),
      lin:       parseInt(get(row,'lin'))||0,
    })
  }

  if (!records.length) { showToast('⚠ No hay registros válidos (revisa la asignación de columnas)','error'); return }

  const progressEl  = document.getElementById('import-progress')
  const progressBar = document.getElementById('import-progress-bar')
  const progressTxt = document.getElementById('import-progress-txt')
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
    }, 50)
  })
})()

export { initApp }
