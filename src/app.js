import { fetchAllRecords, addRecord as dbAddRecord, addRecords as dbAddRecords, deleteRecord as dbDeleteRecord, subscribeToChanges, normalizeRow } from './database.js'

let data = []
let charts = {}
let selectedYears = []

const MONTHS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
const CHART_COLORS = ['#01696f','#006494','#437a22','#d19900','#da7101','#a12c7b','#964219','#5591c7']

function getUnique(field) { return [...new Set(data.map(d => d[field]))].sort() }
function getYears() { return getUnique('year').map(Number).sort() }
function getProducts() { return getUnique('product') }
function getCategories() { return getUnique('category') }
function avg(arr) { return arr.length ? arr.reduce((a,b)=>a+b,0)/arr.length : 0 }
function fmt(n) { return (+n).toFixed(2) }
function fmtPct(n) { return (n >= 0 ? '+' : '') + n.toFixed(1) + '%' }

function getChartColors() {
  const dark = document.documentElement.getAttribute('data-theme') === 'dark'
  return {
    grid: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
    tick: dark ? '#888785' : '#8a8880',
    bg: dark ? '#1c1b19' : '#f9f8f5'
  }
}

function destroyChart(id) { if (charts[id]) { charts[id].destroy(); delete charts[id] } }

function showToast(msg) {
  const t = document.getElementById('toast')
  t.textContent = msg; t.classList.add('show')
  setTimeout(() => t.classList.remove('show'), 2500)
}

function rerenderCurrentPage() {
  const active = document.querySelector('.page.active')?.id
  if (!active) return
  populateAllSelects()
  if (active === 'page-dashboard') { renderDashboard(); renderHistoryView() }
  else if (active === 'page-tendencias') renderTrends()
  else if (active === 'page-comparar') renderComparePage()
  else if (active === 'page-predicciones') renderPredictions()
  else if (active === 'page-datos') renderTable()
  else if (active === 'page-buscar') initSearch()
}

async function initApp() {
  try {
    data = await fetchAllRecords()
  } catch (e) {
    console.error('Error loading from Supabase:', e)
    showToast('⚠ Error al cargar datos de Supabase')
  }
  populateAllSelects()
  renderDashboard()
  renderHistoryView()

  subscribeToChanges((payload) => {
    const { event_type, new: newRow, old: oldRow } = payload
    if (event_type === 'INSERT' && newRow) {
      data.push(normalizeRow(newRow))
      showToast(`📦 Nuevo registro: ${newRow.producto}`)
    } else if (event_type === 'DELETE' && oldRow) {
      data = data.filter(d => d.id !== oldRow.id)
    } else if (event_type === 'UPDATE' && newRow) {
      const idx = data.findIndex(d => d.id === newRow.id)
      if (idx !== -1) data[idx] = normalizeRow(newRow)
    }
    rerenderCurrentPage()
  })
}

// =================== NAVIGATION ===================
function navigate(page, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'))
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'))
  document.getElementById('page-' + page).classList.add('active')
  btn.classList.add('active')
  if (page === 'dashboard') { renderDashboard(); renderHistoryView() }
  if (page === 'tendencias') renderTrends()
  if (page === 'comparar') renderComparePage()
  if (page === 'predicciones') renderPredictions()
  if (page === 'datos') renderTable()
  if (page === 'buscar') initSearch()
}
window.navigate = navigate

// =================== POPULATE SELECTS ===================
function populateAllSelects() {
  const years = getYears()
  const products = getProducts()
  const cats = getCategories()

  const pd = document.getElementById('product-datalist')
  if (pd) pd.innerHTML = products.map(p => `<option value="${p}">`).join('')
  const cd = document.getElementById('cat-datalist')
  if (cd) cd.innerHTML = cats.map(c => `<option value="${c}">`).join('')

  const dps = document.getElementById('dash-product-select')
  if (dps) dps.innerHTML = products.map(p => `<option value="${p}">${p}</option>`).join('')

  const dys = document.getElementById('dash-year-select')
  if (dys) {
    dys.innerHTML = years.map(y => `<option value="${y}">${y}</option>`).join('')
    if (years.length) dys.value = years[years.length-1]
  }

  ;['trend-product','cmp-product','search-product'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = `<option value="">Todos los productos</option>` + products.map(p => `<option value="${p}">${p}</option>`).join('')
  })
  ;['trend-year-from','trend-year-to'].forEach(id => {
    const el = document.getElementById(id)
    if (el) el.innerHTML = `<option value="">-</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
  })

  const tyf = document.getElementById('table-year-filter')
  if (tyf) tyf.innerHTML = `<option value="">Todos los años</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
  const tcf = document.getElementById('table-cat-filter')
  if (tcf) tcf.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('')

  const sy = document.getElementById('search-year')
  if (sy) sy.innerHTML = `<option value="">Todos</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
}

// =================== DASHBOARD ===================
function renderDashboard() {
  populateAllSelects()
  const years = getYears()
  if (!years.length) {
    document.getElementById('kpi-grid').innerHTML = '<div class="kpi-card" style="grid-column:1/-1"><div class="kpi-label">Sin datos</div><div class="kpi-value" style="font-size:var(--text-base)">Añade registros para ver el resumen</div></div>'
    return
  }
  const allPrices = data.map(d => d.price)
  const latestYear = years[years.length - 1]
  const prevYear = years[years.length - 2]
  const latestPrices = data.filter(d => d.year === latestYear).map(d => d.price)
  const prevPrices = data.filter(d => d.year === prevYear).map(d => d.price)
  const avgLatest = avg(latestPrices)
  const avgPrev = avg(prevPrices)
  const pctChange = avgPrev ? ((avgLatest - avgPrev) / avgPrev) * 100 : 0
  const maxP = Math.max(...allPrices)
  const minP = Math.min(...allPrices)
  const maxRec = data.find(d => d.price === maxP)
  const minRec = data.find(d => d.price === minP)

  document.getElementById('dashboard-subtitle').textContent = `Datos de ${years[0]} a ${latestYear} · ${data.length} registros`

  const kpis = [
    { label: `Precio medio ${latestYear}`, value: `${fmt(avgLatest)} €`, delta: fmtPct(pctChange), up: pctChange > 0 },
    { label: 'Total registros', value: data.length.toLocaleString('es'), delta: `${years.length} años`, flat: true },
    { label: 'Precio máximo histórico', value: `${fmt(maxP)} €`, delta: `${maxRec?.product} (${maxRec?.year})`, flat: true },
    { label: 'Precio mínimo histórico', value: `${fmt(minP)} €`, delta: `${minRec?.product} (${minRec?.year})`, flat: true },
  ]

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
  const selYear = parseInt(document.getElementById('dash-year-select')?.value)
  const years = getYears()
  const colors = getChartColors()

  destroyChart('annualChart')
  const annualData = years.map(y => {
    const filtered = data.filter(d => d.year === y && (!selProduct || d.product === selProduct))
    return avg(filtered.map(d => d.price))
  })
  const ctx1 = document.getElementById('annualChart').getContext('2d')
  charts['annualChart'] = new Chart(ctx1, {
    type: 'line',
    data: {
      labels: years,
      datasets: [{
        label: selProduct || 'Precio medio',
        data: annualData,
        borderColor: '#01696f',
        backgroundColor: 'rgba(1,105,111,0.08)',
        borderWidth: 2,
        tension: 0.35,
        fill: true,
        pointRadius: 4,
        pointBackgroundColor: '#01696f',
      }]
    },
    options: baseChartOptions(colors, '€')
  })

  destroyChart('categoryChart')
  const cats = getCategories()
  const catAvgs = cats.map(c => avg(data.filter(d => d.category === c && d.year === (selYear || years[years.length-1])).map(d => d.price)))
  const ctx2 = document.getElementById('categoryChart').getContext('2d')
  charts['categoryChart'] = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: cats,
      datasets: [{ data: catAvgs, backgroundColor: CHART_COLORS.slice(0, cats.length), borderWidth: 2, borderColor: colors.bg }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'right', labels: { color: colors.tick, font: { size: 11 }, boxWidth: 12 } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${fmt(ctx.raw)} €` } }
      }
    }
  })

  destroyChart('monthlyChart')
  const yr = selYear || (getYears().length ? getYears()[getYears().length-1] : new Date().getFullYear())
  const monthlyData = Array.from({length:12}, (_,i) => {
    const m = i+1
    const filtered = data.filter(d => d.year === yr && d.month === m && (!selProduct || d.product === selProduct))
    return avg(filtered.map(d => d.price))
  })
  const ctx3 = document.getElementById('monthlyChart').getContext('2d')
  charts['monthlyChart'] = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: MONTHS,
      datasets: [{
        label: `${selProduct || 'Media'} ${yr}`,
        data: monthlyData,
        backgroundColor: monthlyData.map(v => v === Math.max(...monthlyData.filter(Boolean)) ? '#da7101' : 'rgba(1,105,111,0.65)'),
        borderRadius: 5,
        borderSkipped: false,
      }]
    },
    options: baseChartOptions(colors, '€')
  })
}

// =================== HISTORY VIEW ===================
function getHistoryFiltered() {
  const q = (document.getElementById('history-search')?.value || '').toLowerCase()
  const year = parseInt(document.getElementById('history-year')?.value || '') || null
  const cat = document.getElementById('history-category')?.value || ''
  let rows = data.filter(r => {
    let ok = true
    if (q) ok = ok && r.product.toLowerCase().includes(q)
    if (year) ok = ok && r.year === year
    if (cat) ok = ok && r.category === cat
    return ok
  })
  rows = rows.sort((a,b) => {
    const d = (a.year - b.year) || (a.month - b.month)
    return (document.getElementById('history-sort')?.value || 'desc') === 'asc' ? d : -d
  })
  return rows
}

function renderHistoryFilters() {
  const years = getYears()
  const cats = getCategories()
  const yearSel = document.getElementById('history-year')
  const catSel = document.getElementById('history-category')
  if (yearSel) yearSel.innerHTML = `<option value="">Todos los años</option>` + years.map(y => `<option value="${y}">${y}</option>`).join('')
  if (catSel) catSel.innerHTML = `<option value="">Todas las categorías</option>` + cats.map(c => `<option value="${c}">${c}</option>`).join('')
}

function renderHistoryView() {
  renderHistoryFilters()
  const rows = getHistoryFiltered()
  const historyList = document.getElementById('historyList')
  const historySummary = document.getElementById('historySummary')
  const chartColors = getChartColors()
  destroyChart('historyChart')

  if (!rows.length) {
    if (historyList) historyList.innerHTML = '<div class="empty-state"><h3>Sin registros</h3><p>No hay datos para esos filtros.</p></div>'
    if (historySummary) historySummary.innerHTML = '<div class="empty-state"><h3>Sin resumen</h3><p>Selecciona otro producto o quita filtros.</p></div>'
    return
  }

  const grouped = Object.values(rows.reduce((acc, r) => {
    const key = r.product
    if (!acc[key]) acc[key] = { product: key, category: r.category, items: [] }
    acc[key].items.push(r)
    return acc
  }, {}))

  const top = grouped[0]
  const prices = top.items.map(x => x.price)
  const first = top.items[0]
  const last = top.items[top.items.length - 1]
  const delta = first && last ? ((last.price - first.price) / first.price) * 100 : 0
  if (historySummary) {
    historySummary.innerHTML = `
      <div class="kpi-card"><div class="kpi-label">Producto</div><div class="kpi-value" style="font-size:1rem">${top.product}</div><div class="kpi-delta delta-flat">${top.category}</div></div>
      <div class="kpi-card"><div class="kpi-label">Primer precio</div><div class="kpi-value">${fmt(first.price)} €</div></div>
      <div class="kpi-card"><div class="kpi-label">Último precio</div><div class="kpi-value">${fmt(last.price)} €</div><div class="kpi-delta ${delta >= 0 ? 'delta-up' : 'delta-down'}">${fmtPct(delta)}</div></div>
      <div class="kpi-card"><div class="kpi-label">Máximo</div><div class="kpi-value">${fmt(Math.max(...prices))} €</div></div>
      <div class="kpi-card"><div class="kpi-label">Mínimo</div><div class="kpi-value">${fmt(Math.min(...prices))} €</div></div>
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
          borderColor: '#01696f',
          backgroundColor: 'rgba(1,105,111,0.08)',
          borderWidth: 2,
          tension: 0.3,
          pointRadius: 3,
          fill: true
        }]
      },
      options: baseChartOptions(chartColors, '€')
    })
  }

  if (historyList) {
    historyList.innerHTML = grouped.map(g => {
      const vals = g.items.map(x => x.price)
      const deltaG = g.items.length > 1 ? ((g.items[g.items.length - 1].price - g.items[0].price) / g.items[0].price) * 100 : 0
      return `
        <div class="history-item">
          <h4>${g.product}</h4>
          <div class="meta"><span>${g.category}</span><span>${g.items.length} registros</span><span>${g.items[0].year} → ${g.items[g.items.length - 1].year}</span></div>
          <div class="value">${fmt(g.items[g.items.length - 1].price)} €</div>
          <div class="evolution-pill ${deltaG >= 0 ? 'evo-up' : 'evo-down'}">${deltaG >= 0 ? '▲' : '▼'} ${fmtPct(deltaG)}</div>
        </div>
      `
    }).join('')
  }
}
window.renderHistoryView = renderHistoryView

// =================== TRENDS ===================
function renderTrends() {
  populateAllSelects()
  renderTrendCharts()
}
window.renderTrends = renderTrends

function renderTrendCharts() {
  const selProduct = document.getElementById('trend-product')?.value
  const yearFrom = parseInt(document.getElementById('trend-year-from')?.value) || null
  const yearTo = parseInt(document.getElementById('trend-year-to')?.value) || null
  let years = getYears()
  if (yearFrom) years = years.filter(y => y >= yearFrom)
  if (yearTo) years = years.filter(y => y <= yearTo)

  const filtered = data.filter(d => {
    let ok = true
    if (selProduct) ok = ok && d.product === selProduct
    if (yearFrom) ok = ok && d.year >= yearFrom
    if (yearTo) ok = ok && d.year <= yearTo
    return ok
  })

  const prices = filtered.map(d => d.price)
  const avgAll = avg(prices)
  const maxAll = prices.length ? Math.max(...prices) : 0
  const minAll = prices.length ? Math.min(...prices) : 0

  const yearAvgs = years.map(y => avg(filtered.filter(d => d.year === y).map(d => d.price)))
  const varPct = yearAvgs.map((v, i) => i === 0 ? 0 : yearAvgs[i-1] ? ((v - yearAvgs[i-1]) / yearAvgs[i-1]) * 100 : 0)

  const trend = yearAvgs.length >= 2 ? yearAvgs[yearAvgs.length-1] - yearAvgs[0] : 0
  document.getElementById('trend-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Precio medio período</div><div class="kpi-value">${fmt(avgAll)} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Precio máximo</div><div class="kpi-value">${fmt(maxAll)} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Precio mínimo</div><div class="kpi-value">${fmt(minAll)} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Tendencia general</div><div class="kpi-value">${trend >= 0 ? '+' : ''}${fmt(trend)} €</div><div class="kpi-delta ${trend >= 0 ? 'delta-up' : 'delta-down'}">${trend >= 0 ? '▲ Alza' : '▼ Baja'}</div></div>
  `

  const colors = getChartColors()

  destroyChart('trendMainChart')
  const allPoints = []
  for (const y of years) {
    for (let m = 1; m <= 12; m++) {
      const pts = filtered.filter(d => d.year === y && d.month === m).map(d => d.price)
      if (pts.length) allPoints.push({ label: `${MONTHS[m-1]} ${y}`, value: avg(pts) })
    }
  }
  const ctx = document.getElementById('trendMainChart').getContext('2d')
  charts['trendMainChart'] = new Chart(ctx, {
    type: 'line',
    data: {
      labels: allPoints.map(p => p.label),
      datasets: [{
        label: selProduct || 'Precio medio',
        data: allPoints.map(p => p.value),
        borderColor: '#01696f', backgroundColor: 'rgba(1,105,111,0.07)',
        borderWidth: 2, tension: 0.35, fill: true, pointRadius: 2
      }]
    },
    options: { ...baseChartOptions(colors, '€'), plugins: { ...baseChartOptions(colors, '€').plugins, tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} €` } } } }
  })

  destroyChart('trendMinMaxChart')
  const maxPerYear = years.map(y => { const pts = filtered.filter(d => d.year === y).map(d => d.price); return pts.length ? Math.max(...pts) : 0 })
  const minPerYear = years.map(y => { const pts = filtered.filter(d => d.year === y).map(d => d.price); return pts.length ? Math.min(...pts) : 0 })
  const ctx2 = document.getElementById('trendMinMaxChart').getContext('2d')
  charts['trendMinMaxChart'] = new Chart(ctx2, {
    type: 'bar',
    data: {
      labels: years,
      datasets: [
        { label: 'Máximo', data: maxPerYear, backgroundColor: 'rgba(218,113,1,0.7)', borderRadius: 4 },
        { label: 'Mínimo', data: minPerYear, backgroundColor: 'rgba(1,105,111,0.5)', borderRadius: 4 },
      ]
    },
    options: baseChartOptions(colors, '€')
  })

  destroyChart('trendVarChart')
  const ctx3 = document.getElementById('trendVarChart').getContext('2d')
  charts['trendVarChart'] = new Chart(ctx3, {
    type: 'bar',
    data: {
      labels: years.slice(1),
      datasets: [{
        label: 'Variación %',
        data: varPct.slice(1),
        backgroundColor: varPct.slice(1).map(v => v >= 0 ? 'rgba(67,122,34,0.7)' : 'rgba(161,44,123,0.7)'),
        borderRadius: 4,
      }]
    },
    options: baseChartOptions(colors, '%')
  })
}
window.renderTrendCharts = renderTrendCharts

// =================== COMPARE ===================
function renderComparePage() {
  populateAllSelects()
  selectedYears = []
  renderYearCards()
}
window.renderComparePage = renderComparePage

function renderYearCards() {
  const years = getYears()
  document.getElementById('cmp-year-cards').innerHTML = years.map(y => `
    <div class="compare-year-card ${selectedYears.includes(y) ? 'selected' : ''}" onclick="toggleYear(${y})">
      <div class="yr">${y}</div>
      <div class="avg">${fmt(avg(data.filter(d=>d.year===y).map(d=>d.price)))} € media</div>
    </div>
  `).join('')
}

function toggleYear(y) {
  const i = selectedYears.indexOf(y)
  if (i > -1) selectedYears.splice(i, 1)
  else selectedYears.push(y)
  renderYearCards()
  renderCompare()
}
window.toggleYear = toggleYear

function renderCompare() {
  const selProduct = document.getElementById('cmp-product')?.value
  const chartCard = document.getElementById('compare-chart-card')
  const tableCard = document.getElementById('compare-table-card')

  if (selectedYears.length < 2) {
    chartCard.style.display = 'none'
    tableCard.style.display = 'none'
    return
  }
  chartCard.style.display = ''
  tableCard.style.display = ''

  const colors = getChartColors()
  destroyChart('compareChart')
  const datasets = selectedYears.sort().map((y, i) => {
    const monthData = Array.from({length:12}, (_,mi) => {
      const pts = data.filter(d => d.year === y && d.month === mi+1 && (!selProduct || d.product === selProduct)).map(d => d.price)
      return avg(pts) || null
    })
    return { label: String(y), data: monthData, borderColor: CHART_COLORS[i % CHART_COLORS.length], backgroundColor: CHART_COLORS[i % CHART_COLORS.length] + '15', borderWidth: 2, tension: 0.35, fill: false, pointRadius: 4 }
  })

  const ctx = document.getElementById('compareChart').getContext('2d')
  charts['compareChart'] = new Chart(ctx, {
    type: 'line',
    data: { labels: MONTHS, datasets },
    options: { ...baseChartOptions(colors, '€'), plugins: { legend: { display: true, labels: { color: colors.tick, font:{size:12} } } } }
  })

  const thead = `<thead><tr><th>Año</th><th>Media</th><th>Máximo</th><th>Mínimo</th><th>Variación vs. anterior</th></tr></thead>`
  let prevAvg = null
  const rows = selectedYears.sort().map(y => {
    const pts = data.filter(d => d.year === y && (!selProduct || d.product === selProduct)).map(d => d.price)
    const a = avg(pts); const mx = Math.max(...pts); const mn = Math.min(...pts)
    const pct = prevAvg ? ((a - prevAvg) / prevAvg) * 100 : null
    prevAvg = a
    return `<tr>
      <td><strong>${y}</strong></td>
      <td>${fmt(a)} €</td><td>${fmt(mx)} €</td><td>${fmt(mn)} €</td>
      <td>${pct !== null ? `<span class="badge ${pct >= 0 ? 'badge-up':'badge-down'}">${fmtPct(pct)}</span>` : '—'}</td>
    </tr>`
  })
  document.getElementById('compare-stats-table').innerHTML = thead + `<tbody>${rows.join('')}</tbody>`
}
window.renderCompare = renderCompare

// =================== PREDICTIONS ===================
function computePrediction(product) {
  const filtered = product ? data.filter(d => d.product === product) : data
  if (filtered.length < 6) return null

  const years = [...new Set(filtered.map(d => d.year))].sort((a,b) => a-b)
  const months = [...new Set(filtered.filter(d => d.month).map(d => d.month))].sort((a,b) => a-b)

  if (years.length < 2 || months.length < 2) return null

  const yearAvgs = years.map(y => {
    const pts = filtered.filter(d => d.year === y).map(d => d.price)
    return { year: y, avg: avg(pts) }
  })

  const growthRates = []
  for (let i = 1; i < yearAvgs.length; i++) {
    if (yearAvgs[i-1].avg > 0) {
      growthRates.push((yearAvgs[i].avg - yearAvgs[i-1].avg) / yearAvgs[i-1].avg)
    }
  }
  const avgGrowth = growthRates.length ? growthRates.reduce((a,b) => a+b, 0) / growthRates.length : 0

  const monthlyFactors = {}
  for (const m of months) {
    const vals = filtered.filter(d => d.month === m).map(d => d.price)
    const monthAvg = avg(vals)
    const valsAll = filtered.map(d => d.price)
    const overallAvg = avg(valsAll)
    monthlyFactors[m] = overallAvg > 0 ? monthAvg / overallAvg : 1
  }

  const lastYear = Math.max(...years)
  const lastYearData = filtered.filter(d => d.year === lastYear)
  const lastYearAvg = yearAvgs.find(y => y.year === lastYear)?.avg || avg(lastYearData.map(d => d.price))

  const predictions = []
  let lastMonth = Math.max(...months)
  let predYear = lastYear
  for (let i = 0; i < 12; i++) {
    lastMonth++
    if (lastMonth > 12) { lastMonth = 1; predYear++ }
    const yearsAhead = predYear - lastYear
    const trendFactor = 1 + avgGrowth * yearsAhead
    const seasonalFactor = monthlyFactors[lastMonth] || 1
    const predPrice = lastYearAvg * trendFactor * seasonalFactor
    predictions.push({ year: predYear, month: lastMonth, price: Math.round(predPrice * 1000) / 1000 })
  }

  return { predictions, avgGrowth, lastYearAvg, lastYear, monthlyFactors }
}

function renderPredictions() {
  const selProduct = document.getElementById('pred-product')?.value

  populateAllSelects();
  ['pred-product'].forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      const products = getProducts()
      el.innerHTML = `<option value="">Todos los productos</option>` + products.map(p => `<option value="${p}">${p}</option>`).join('')
      if (selProduct) el.value = selProduct
    }
  })

  const result = computePrediction(selProduct || null)
  const colors = getChartColors()

  if (!result) {
    document.getElementById('pred-kpis').innerHTML = '<div class="kpi-card" style="grid-column:1/-1"><div class="kpi-label">Sin datos suficientes</div><div class="kpi-value" style="font-size:var(--text-base)">Necesitas al menos 2 años de datos con meses para generar predicciones</div></div>'
    destroyChart('predChart')
    document.getElementById('pred-table').innerHTML = ''
    return
  }

  const { predictions, avgGrowth, lastYearAvg, lastYear } = result

  const monthsToShow = Math.min(24, 12 + predictions.length)
  const filtered = selProduct ? data.filter(d => d.product === selProduct) : data
  const recentMonths = []
  const sorted = [...filtered].filter(d => d.month).sort((a,b) => (a.year - b.year) || (a.month - b.month))
  const cutoffYear = lastYear - 2
  for (const d of sorted) {
    if (d.year > cutoffYear || (d.year === cutoffYear && d.month >= 1)) {
      recentMonths.push(d)
    }
  }

  const labelSet = new Set()
  const allLabels = []
  const allActual = []
  const allPred = []

  for (const d of recentMonths) {
    const key = `${d.year}-${String(d.month).padStart(2,'0')}`
    if (!labelSet.has(key)) {
      labelSet.add(key)
      allLabels.push(`${MONTHS[(d.month||1)-1]} ${d.year}`)
      allActual.push(d.price)
      allPred.push(null)
    }
  }
  for (const p of predictions) {
    const key = `${p.year}-${String(p.month).padStart(2,'0')}`
    if (!labelSet.has(key)) {
      labelSet.add(key)
      allLabels.push(`${MONTHS[p.month-1]} ${p.year}`)
      allActual.push(null)
      allPred.push(p.price)
    }
  }

  destroyChart('predChart')
  const ctx = document.getElementById('predChart')?.getContext('2d')
  if (ctx) {
    charts['predChart'] = new Chart(ctx, {
      type: 'line',
      data: {
        labels: allLabels,
        datasets: [
          {
            label: 'Real',
            data: allActual,
            borderColor: '#01696f',
            backgroundColor: 'rgba(1,105,111,0.08)',
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: '#01696f',
            tension: 0.3,
            fill: true,
            spanGaps: false
          },
          {
            label: 'Predicción',
            data: allPred,
            borderColor: '#da7101',
            backgroundColor: 'rgba(218,113,1,0.06)',
            borderWidth: 2,
            borderDash: [6, 3],
            pointRadius: 3,
            pointBackgroundColor: '#da7101',
            pointStyle: 'rectRot',
            tension: 0.3,
            fill: true,
            spanGaps: true
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: true, labels: { color: colors.tick, font: { size: 12 } } },
          tooltip: { callbacks: { label: ctx => ` ${ctx.dataset.label}: ${fmt(ctx.raw)} €` } }
        },
        scales: {
          x: { grid: { color: colors.grid }, ticks: { color: colors.tick, font: { size: 10 } } },
          y: { grid: { color: colors.grid }, ticks: { color: colors.tick, font: { size: 11 }, callback: v => `${v} €` } }
        }
      }
    })
  }

  const firstPred = predictions[0]
  const lastPred = predictions[predictions.length - 1]
  const midPred = predictions[Math.min(5, predictions.length - 1)]
  const change6 = firstPred && midPred ? ((midPred.price - firstPred.price) / firstPred.price) * 100 : 0
  const change12 = firstPred && lastPred ? ((lastPred.price - firstPred.price) / firstPred.price) * 100 : 0

  document.getElementById('pred-kpis').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">Precio actual (${lastYear})</div><div class="kpi-value">${fmt(lastYearAvg)} €</div></div>
    <div class="kpi-card"><div class="kpi-label">Tendencia anual</div><div class="kpi-value">${fmtPct(avgGrowth)}</div><div class="kpi-delta ${avgGrowth >= 0 ? 'delta-up' : 'delta-down'}">${avgGrowth >= 0 ? '▲' : '▼'} Proyección</div></div>
    <div class="kpi-card"><div class="kpi-label">Estimado 6 meses</div><div class="kpi-value">${fmt(midPred?.price || 0)} €</div><div class="kpi-delta ${change6 >= 0 ? 'delta-up' : 'delta-down'}">${fmtPct(change6)}</div></div>
    <div class="kpi-card"><div class="kpi-label">Estimado 12 meses</div><div class="kpi-value">${fmt(lastPred?.price || 0)} €</div><div class="kpi-delta ${change12 >= 0 ? 'delta-up' : 'delta-down'}">${fmtPct(change12)}</div></div>
  `

  const thead = `<thead><tr><th>Mes</th><th>Precio estimado</th><th>Vs. mes anterior</th><th>Vs. mismo mes año pasado</th></tr></thead>`
  let prevPrice = null
  const sameMonthLastYear = {}
  if (selProduct) {
    for (const p of predictions) {
      const same = data.filter(d => d.product === selProduct && d.year === p.year - 1 && d.month === p.month).map(d => d.price)
      if (same.length) sameMonthLastYear[`${p.month}`] = avg(same)
    }
  }

  const rows = predictions.map(p => {
    const actualPrev = prevPrice
    prevPrice = p.price
    const vsPrev = actualPrev ? ((p.price - actualPrev) / actualPrev) * 100 : null
    const vsYear = sameMonthLastYear[`${p.month}`] || null
    const vsYearPct = vsYear ? ((p.price - vsYear) / vsYear) * 100 : null
    return `<tr>
      <td><strong>${MONTH_NAMES[p.month-1]} ${p.year}</strong></td>
      <td style="font-variant-numeric:tabular-nums; color:var(--color-orange); font-weight:600">${fmt(p.price)} €</td>
      <td>${vsPrev !== null ? `<span class="badge ${vsPrev >= 0 ? 'badge-up' : 'badge-down'}">${fmtPct(vsPrev)}</span>` : '—'}</td>
      <td>${vsYearPct !== null ? `<span class="badge ${vsYearPct >= 0 ? 'badge-up' : 'badge-down'}">${fmtPct(vsYearPct)}</span>` : '—'}</td>
    </tr>`
  }).join('')
  document.getElementById('pred-table').innerHTML = thead + `<tbody>${rows}</tbody>`
}
window.renderPredictions = renderPredictions

// =================== TABLE ===================
function renderTable() {
  const search = document.getElementById('table-search')?.value.toLowerCase() || ''
  const yearF = parseInt(document.getElementById('table-year-filter')?.value) || null
  const catF = document.getElementById('table-cat-filter')?.value || ''

  let rows = data.filter(d => {
    let ok = true
    if (search) ok = ok && (d.product.toLowerCase().includes(search) || d.category.toLowerCase().includes(search))
    if (yearF) ok = ok && d.year === yearF
    if (catF) ok = ok && d.category === catF
    return ok
  })

  rows = rows.sort((a,b) => b.year - a.year || a.month - b.month)

  const tbody = document.getElementById('table-body')
  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding: var(--space-10); color: var(--color-text-muted)">No se encontraron registros</td></tr>`
  } else {
    tbody.innerHTML = rows.slice(0, 200).map(d => {
      const prevY = data.find(r => r.product === d.product && r.year === d.year - 1 && r.month === d.month)
      let delta = '', badgeCls = 'badge-flat'
      if (prevY) {
        const pct = ((d.price - prevY.price) / prevY.price) * 100
        delta = fmtPct(pct)
        badgeCls = pct > 0.5 ? 'badge-up' : pct < -0.5 ? 'badge-down' : 'badge-flat'
      }
      return `<tr>
        <td><strong>${d.product}</strong></td>
        <td>${d.category}</td>
        <td>${d.year}</td>
        <td>${d.month ? MONTH_NAMES[d.month-1] : '—'}</td>
        <td style="font-variant-numeric: tabular-nums">${fmt(d.price)} €</td>
        <td>${d.unit}</td>
        <td>${delta ? `<span class="badge ${badgeCls}">${delta}</span>` : '—'}</td>
        <td><button class="btn-delete" onclick="deleteRecord(${d.id})" title="Eliminar">✕</button></td>
      </tr>`
    }).join('')
  }
  document.getElementById('table-count').textContent = `Mostrando ${Math.min(rows.length, 200)} de ${rows.length} registros`
}
window.renderTable = renderTable

async function deleteRecord(id) {
  try {
    await dbDeleteRecord(id)
    data = data.filter(d => d.id !== id)
    renderTable()
    showToast('Registro eliminado')
  } catch (e) {
    console.error(e)
    showToast('⚠ Error al eliminar')
  }
}
window.deleteRecord = deleteRecord

// =================== SEARCH ===================
function initSearch() {
  populateAllSelects()
}
window.initSearch = initSearch

function doSearch() {
  const product = document.getElementById('search-product').value
  const year = parseInt(document.getElementById('search-year').value) || null
  const month = parseInt(document.getElementById('search-month').value) || null

  let results = data.filter(d => {
    let ok = true
    if (product) ok = ok && d.product === product
    if (year) ok = ok && d.year === year
    if (month) ok = ok && d.month === month
    return ok
  })

  const container = document.getElementById('search-results')
  if (!results.length) {
    container.innerHTML = `<div class="card"><div class="empty-state"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg><h3>Sin resultados</h3><p>Prueba con otros filtros de búsqueda</p></div></div>`
    return
  }

  const avgPrice = avg(results.map(d => d.price))
  const maxPrice = Math.max(...results.map(d => d.price))
  const minPrice = Math.min(...results.map(d => d.price))

  container.innerHTML = `
    <div class="grid-3" style="margin-bottom: var(--space-6)">
      <div class="kpi-card"><div class="kpi-label">Precio medio</div><div class="kpi-value">${fmt(avgPrice)} €</div></div>
      <div class="kpi-card"><div class="kpi-label">Precio máximo</div><div class="kpi-value">${fmt(maxPrice)} €</div></div>
      <div class="kpi-card"><div class="kpi-label">Precio mínimo</div><div class="kpi-value">${fmt(minPrice)} €</div></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Producto</th><th>Categoría</th><th>Año</th><th>Mes</th><th>Precio</th><th>Unidad</th><th>Notas</th></tr></thead>
        <tbody>
          ${results.sort((a,b) => b.year-a.year || a.month-b.month).slice(0, 100).map(d => `
            <tr>
              <td><strong>${d.product}</strong></td>
              <td>${d.category}</td>
              <td>${d.year}</td>
              <td>${d.month ? MONTH_NAMES[d.month-1] : '—'}</td>
              <td style="font-variant-numeric:tabular-nums">${fmt(d.price)} €</td>
              <td>${d.unit}</td>
              <td style="color:var(--color-text-muted)">${d.notes || '—'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
    <p style="font-size:var(--text-xs);color:var(--color-text-muted);margin-top:var(--space-3)">${results.length} resultados encontrados</p>
  `
}
window.doSearch = doSearch

// =================== ADD RECORD ===================
function openAddModal() { document.getElementById('add-modal').classList.add('open') }
function closeModal(id) { document.getElementById(id).classList.remove('open') }
function openImportModal() { document.getElementById('import-modal').classList.add('open') }
window.openAddModal = openAddModal
window.closeModal = closeModal
window.openImportModal = openImportModal

async function addRecord() {
  const product = document.getElementById('m-product').value.trim()
  const category = document.getElementById('m-category').value.trim() || 'Sin categoría'
  const price = parseFloat(document.getElementById('m-price').value)
  const unit = document.getElementById('m-unit').value.trim() || '€/ud'
  const year = parseInt(document.getElementById('m-year').value)
  const month = parseInt(document.getElementById('m-month').value) || null
  const notes = document.getElementById('m-notes').value.trim()

  if (!product || isNaN(price) || isNaN(year)) {
    showToast('⚠ Rellena producto, precio y año'); return
  }
  try {
    const saved = await dbAddRecord({ product, category, price, unit, year, month, notes })
    if (saved) data.push(saved)
    closeModal('add-modal')
    populateAllSelects()
    showToast('✓ Registro añadido')
    ;['m-product','m-category','m-price','m-unit','m-year','m-notes'].forEach(id => document.getElementById(id).value = '')
    document.getElementById('m-month').value = ''
  } catch (e) {
    console.error(e)
    showToast('⚠ Error al guardar')
  }
}
window.addRecord = addRecord

// =================== EXPORT / IMPORT ===================
function exportCSV() {
  const headers = 'producto,categoria,precio,unidad,año,mes,notas'
  const rows = data.map(d => `${d.product},${d.category},${d.price},${d.unit},${d.year},${d.month||''},${d.notes||''}`)
  const csv = [headers, ...rows].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = 'precios.csv'
  a.click()
  showToast('✓ CSV exportado')
}
window.exportCSV = exportCSV

async function importCSV() {
  const raw = document.getElementById('csv-input').value.trim()
  if (!raw) { showToast('⚠ Pega datos CSV primero'); return }
  const lines = raw.split('\n').filter(l => l.trim())
  const records = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || i === 0 && line.toLowerCase().startsWith('producto')) continue
    const parts = line.split(',')
    if (parts.length < 5) continue
    const [product, category, price, unit, year, month, ...rest] = parts
    const p = parseFloat(price), y = parseInt(year)
    if (!product || isNaN(p) || isNaN(y)) continue
    records.push({
      product: product.trim(),
      category: (category||'').trim() || 'Sin categoría',
      price: p,
      unit: (unit||'€/ud').trim(),
      year: y,
      month: parseInt(month)||null,
      notes: rest.join(',').trim()
    })
  }
  if (!records.length) { showToast('⚠ No hay registros válidos'); return }
  try {
    const saved = await dbAddRecords(records)
    data = data.concat(saved)
    closeModal('import-modal')
    populateAllSelects()
    showToast(`✓ ${saved.length} registros importados`)
    document.getElementById('csv-input').value = ''
  } catch (e) {
    console.error(e)
    showToast('⚠ Error al importar')
  }
}
window.importCSV = importCSV

// =================== CHART BASE OPTIONS ===================
function baseChartOptions(colors, unit) {
  return {
    responsive: true, maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: { callbacks: { label: ctx => ` ${fmt(ctx.raw)} ${unit}` } }
    },
    scales: {
      x: { grid: { color: colors.grid }, ticks: { color: colors.tick, font: { size: 11 } } },
      y: { grid: { color: colors.grid }, ticks: { color: colors.tick, font: { size: 11 }, callback: v => `${v} ${unit}` } }
    }
  }
}

// =================== THEME TOGGLE ===================
;(function(){
  const t = document.querySelector('[data-theme-toggle]')
  const r = document.documentElement
  let d = matchMedia('(prefers-color-scheme:dark)').matches ? 'dark' : 'light'
  r.setAttribute('data-theme', d)
  t && t.addEventListener('click', () => {
    d = d === 'dark' ? 'light' : 'dark'
    r.setAttribute('data-theme', d)
    setTimeout(() => {
      const activePage = document.querySelector('.page.active')?.id
      if (activePage === 'page-dashboard') renderDashCharts()
      if (activePage === 'page-tendencias') renderTrendCharts()
      if (activePage === 'page-comparar') renderCompare()
    }, 50)
  })
})()

export { initApp, renderDashboard, renderDashCharts, renderTable, renderTrends, renderTrendCharts, renderComparePage, renderCompare, renderPredictions }
