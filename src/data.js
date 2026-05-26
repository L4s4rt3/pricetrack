// Shared data layer — both app.js and confeccion.js populate this cache
export const shared = {
  precios: [],
  confeccion: [],
}

export function searchAll(q) {
  if (!q || q.length < 2) return { clientes: [], productos: [], palets: [], docs: [] }
  const term = q.toLowerCase()

  const clientesMap = new Map()
  const productosMap = new Map()
  const palets = []
  const docsMap = new Map()

  // Buscar en precios
  for (const d of shared.precios) {
    const cli = d.denominacion_social || d.cliente || ''
    if (cli.toLowerCase().includes(term)) {
      clientesMap.set(cli, { nombre: cli, codigo: d.cliente || '', fuente: 'ventas' })
    }
    const prod = d.product || ''
    if (prod.toLowerCase().includes(term)) {
      productosMap.set(prod, { nombre: prod, tipo: 'Producto' })
    }
    const doc = d.documento || ''
    if (doc.toLowerCase().includes(term)) {
      docsMap.set(doc, { doc, cliente: cli, fuente: 'ventas' })
    }
  }

  // Buscar en confeccion
  for (const d of shared.confeccion) {
    const cli = d.cliente_nombre || d.denominacion_social || ''
    if (cli.toLowerCase().includes(term)) {
      clientesMap.set(cli, { nombre: cli, codigo: d.cliente_id || '', fuente: 'confeccion' })
    }
    const prod = d.producto_confeccionado || ''
    if (prod.toLowerCase().includes(term)) {
      productosMap.set(prod, { nombre: prod, tipo: d.tipo || 'Producto' })
    }
    const nomPalet = String(d.nº_palet || '')
    if (nomPalet.includes(term)) {
      palets.push({ nº_palet: d.nº_palet, producto: d.producto_confeccionado, id: d.id })
    }
    const doc = d.documento_limpio || d.documento_venta_original || ''
    if (doc.toLowerCase().includes(term)) {
      docsMap.set(doc, { doc, cliente: cli, fuente: 'confeccion' })
    }
    const variedad = d.variedad || ''
    if (!productosMap.has(prod) && variedad.toLowerCase().includes(term)) {
      productosMap.set(prod, { nombre: prod, tipo: d.tipo || 'Producto' })
    }
  }

  return {
    clientes: [...clientesMap.values()].slice(0, 8),
    productos: [...productosMap.values()].slice(0, 8),
    palets: palets.slice(0, 8),
    docs: [...docsMap.values()].slice(0, 8),
  }
}

export function getClientData(nombre) {
  const precios = shared.precios.filter(d => {
    const cli = (d.denominacion_social || d.cliente || '').toLowerCase()
    return cli.includes(nombre.toLowerCase())
  })
  const confeccion = shared.confeccion.filter(d => {
    const cli = (d.cliente_nombre || d.denominacion_social || '').toLowerCase()
    return cli.includes(nombre.toLowerCase())
  })
  return { precios, confeccion }
}

export function getProductTree() {
  const tree = {}
  for (const d of shared.confeccion) {
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
    if (!tree[base].variedades[varKey].calibres[calKey]) tree[base].variedades[varKey].calibres[calKey] = { count: 0, kg: 0, palets: [] }
    tree[base].variedades[varKey].calibres[calKey].count++
    tree[base].variedades[varKey].calibres[calKey].kg += parseFloat(d.kg_netos || 0)
    tree[base].variedades[varKey].calibres[calKey].palets.push(d)
  }
  return tree
}
