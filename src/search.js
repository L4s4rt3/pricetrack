import { shared, searchAll } from './data.js'
import { debounce } from './utils.js'

export function initSearch() {
  const topbar = document.querySelector('.topbar')
  if (!topbar) return

  const container = document.createElement('div')
  container.id = 'smart-search'
  container.innerHTML = `
    <div style="position:relative;flex:1;max-width:420px">
      <svg style="position:absolute;left:10px;top:50%;transform:translateY(-50%);width:15px;height:15px;color:var(--color-text-faint)" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
      <input type="text" id="smart-search-input" placeholder="Buscar cliente, producto, palet, documento…" style="width:100%;padding:6px 10px 6px 32px;border:1px solid var(--color-border);border-radius:var(--radius-md);background:var(--color-bg);font-size:var(--text-sm);color:var(--color-text)" autocomplete="off">
      <div id="smart-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--color-surface);border:1px solid var(--color-border);border-radius:var(--radius-md);margin-top:4px;box-shadow:var(--shadow-md);z-index:999;max-height:360px;overflow-y:auto"></div>
    </div>
  `
  container.style.cssText = 'flex:1;max-width:420px;margin:0 var(--space-4)'

  // Insert after brand, before actions
  const brand = topbar.querySelector('.topbar-brand')
  const actions = topbar.querySelector('.topbar-actions')
  if (brand && actions) {
    topbar.insertBefore(container, actions)
  }

  const input = document.getElementById('smart-search-input')
  const results = document.getElementById('smart-search-results')

  if (!input || !results) return

  const doSearch = debounce(() => {
    const q = input.value.trim()
    if (q.length < 2) { results.style.display = 'none'; return }

    const r = searchAll(q)
    const hasAny = r.clientes.length || r.productos.length || r.palets.length || r.docs.length

    if (!hasAny) {
      results.innerHTML = '<div style="padding:var(--space-4);color:var(--color-text-muted);font-size:var(--text-xs);text-align:center">Sin resultados</div>'
      results.style.display = 'block'
      return
    }

    let html = ''
    if (r.clientes.length) {
      html += '<div style="padding:var(--space-2) var(--space-3);font-size:11px;font-weight:600;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:0.05em">Clientes</div>'
      r.clientes.forEach(c => {
        html += `<div class="sr-item" data-type="cliente" data-nombre="${c.nombre.replace(/"/g,'&quot;')}" style="padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:var(--text-xs);border-radius:4px">👤 ${c.nombre}</div>`
      })
    }
    if (r.productos.length) {
      html += '<div style="padding:var(--space-2) var(--space-3);font-size:11px;font-weight:600;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid var(--color-divider)">Productos</div>'
      r.productos.forEach(p => {
        html += `<div class="sr-item" data-type="producto" data-nombre="${p.nombre.replace(/"/g,'&quot;')}" style="padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:var(--text-xs);border-radius:4px">📦 ${p.nombre}</div>`
      })
    }
    if (r.palets.length) {
      html += '<div style="padding:var(--space-2) var(--space-3);font-size:11px;font-weight:600;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid var(--color-divider)">Palets</div>'
      r.palets.forEach(p => {
        html += `<div class="sr-item" data-type="palet" data-id="${p.id}" style="padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:var(--text-xs);border-radius:4px">📋 #${p.nº_palet} — ${(p.producto||'...').slice(0,40)}</div>`
      })
    }
    if (r.docs.length) {
      html += '<div style="padding:var(--space-2) var(--space-3);font-size:11px;font-weight:600;color:var(--color-text-faint);text-transform:uppercase;letter-spacing:0.05em;border-top:1px solid var(--color-divider)">Documentos</div>'
      r.docs.forEach(d => {
        html += `<div class="sr-item" data-type="doc" data-doc="${d.doc.replace(/"/g,'&quot;')}" style="padding:6px 12px;cursor:pointer;display:flex;align-items:center;gap:8px;font-size:var(--text-xs);border-radius:4px">📄 ${d.doc}</div>`
      })
    }
    results.innerHTML = html
    results.style.display = 'block'

    // Click handlers for results
    results.querySelectorAll('.sr-item').forEach(el => {
      el.addEventListener('click', () => {
        const type = el.dataset.type
        input.value = ''
        results.style.display = 'none'
        if (type === 'cliente') {
          navigateToCliente(el.dataset.nombre)
        } else if (type === 'producto') {
          navigateToProducto(el.dataset.nombre)
        } else if (type === 'palet') {
          navigateToPalet(parseInt(el.dataset.id))
        } else if (type === 'doc') {
          navigateToDoc(el.dataset.doc)
        }
      })
      el.addEventListener('mouseenter', () => { el.style.background = 'var(--color-surface-offset)' })
      el.addEventListener('mouseleave', () => { el.style.background = '' })
    })
  }, 200)

  input.addEventListener('input', doSearch)
  input.addEventListener('blur', () => setTimeout(() => { results.style.display = 'none' }, 200))
  input.addEventListener('focus', () => { if (input.value.trim().length >= 2) results.style.display = 'block' })
}

function navigateToCliente(nombre) {
  const btn = document.querySelector('[onclick*="clientes"]')
  if (btn) btn.click()
  // Store the selected client and switch to clientes page
  window.clienteSearch = nombre
  if (typeof window.renderClientes === 'function') window.renderClientes()
}

function navigateToProducto(nombre) {
  const btn = document.querySelector('[onclick*="confeccion"]')
  if (btn) btn.click()
  // Try to set the search
  const searchInput = document.getElementById('conf-search')
  if (searchInput) {
    searchInput.value = nombre
    if (typeof window.debouncedRenderConfeccion === 'function') window.debouncedRenderConfeccion()
  }
}

function navigateToPalet(id) {
  const btn = document.querySelector('[onclick*="confeccion"]')
  if (btn) btn.click()
  // Navigate to confeccion and select the specific palet
  if (typeof window.confGoToPalet === 'function') window.confGoToPalet(id)
}

function navigateToDoc(doc) {
  const btn = document.querySelector('[onclick*="ventas"]')
  if (btn) btn.click()
  const searchInput = document.getElementById('ventas-search')
  if (searchInput) {
    searchInput.value = doc
    if (typeof window.debouncedRenderVentas === 'function') window.debouncedRenderVentas()
  }
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSearch)
} else {
  initSearch()
}
