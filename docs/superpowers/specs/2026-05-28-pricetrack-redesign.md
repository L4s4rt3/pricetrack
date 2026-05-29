# PriceTrack Redesign — Migración a React + Glassmorphism

> Basado en el design system de Lasarte SAT (`Herramienta-Lasarte`)

---

## 1. Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | React 18 + TypeScript |
| Build | Vite 6 |
| Routing | react-router-dom v7 |
| Estilos | Tailwind CSS 3 + shadcn/ui + glassmorphism |
| Datos | Supabase + @tanstack/react-query |
| Gráficos | Recharts |
| Iconos | lucide-react |
| Utilidades | date-fns, xlsx, class-variance-authority, zod |

## 2. Estructura del proyecto

```
PriceTrack/
├── src/
│   ├── components/
│   │   └── ui/              # shadcn/ui components
│   ├── contexts/
│   │   └── ThemeProvider.tsx
│   ├── hooks/
│   │   ├── usePrecios.ts
│   │   ├── useVentas.ts
│   │   ├── useClientes.ts
│   │   └── useConfeccion.ts
│   ├── integrations/
│   │   └── supabase/
│   │       └── client.ts
│   ├── lib/
│   │   ├── chartTheme.tsx    # Adaptado de Lasarte
│   │   ├── format.ts         # formatEur, formatKg, fmt, etc.
│   │   ├── types.ts          # Tipos TypeScript
│   │   └── utils.ts          # cn(), etc.
│   ├── pages/
│   │   ├── Dashboard.tsx     # / — Resumen
│   │   ├── Ventas.tsx        # /ventas
│   │   ├── Productos.tsx     # /productos
│   │   ├── Clientes.tsx      # /clientes
│   │   ├── Confeccion.tsx    # /confeccion
│   │   ├── Tendencias.tsx    # /tendencias
│   │   ├── Comparar.tsx      # /comparar
│   │   ├── Predicciones.tsx  # /predicciones
│   │   └── Datos.tsx         # /datos
│   ├── App.tsx
│   ├── index.css
│   └── main.tsx
├── public/
├── supabase/
│   └── migrations/
├── index.html
├── tailwind.config.ts
└── vite.config.ts
```

## 3. Layout

```
┌─────────────────────────────────────────┐
│  Sidebar (collapsible="icon")           │
│  ┌─────────────────┐  ┌────────────────┐│
│  │ ██ PriceTrack   │  │ TopBar (sticky)││
│  │ ██ Dashboard    │  │ ☰ breadcrumb   ││
│  │                 │  │ badge + theme  ││
│  │ Principal:      │  ├────────────────┤│
│  │   ■ Resumen     │  │ page-shell     ││
│  │ Operaciones:    │  │ ┌─page-header┐ ││
│  │   ■ Ventas      │  │ │ title      │ ││
│  │   ■ Productos   │  │ │ subtitle   │ ││
│  │   ■ Clientes    │  │ └────────────┘ ││
│  │   ■ Confección  │  │ KPIs grid      ││
│  │ Análisis:       │  │ Charts         ││
│  │   ■ Tendencias  │  │ Tables         ││
│  │   ■ Comparar    │  │                ││
│  │   ■ Predecir    │  │                ││
│  │ Datos:          │  │                ││
│  │   ■ Tabla       │  │                ││
│  └─────────────────┘  └────────────────┘│
└─────────────────────────────────────────┘
```

### 3.1 Sidebar (shadcn/ui)
- `collapsible="icon"`, fondo teal oscuro (`--sidebar-background`)
- Header: icono cítrico (lucide `Citrus`) + "PriceTrack" / "Dashboard"
- Grupos de navegación con labels uppercase
- Sin footer de usuario (sin auth)
- Sin ChatBot (no necesario para PriceTrack)

### 3.2 TopBar
- Sticky, glass background (`bg-[var(--glass-bg-strong)]`), `backdrop-blur-xl`
- Sidebar trigger (☰) + Separator + Breadcrumb + subtítulo
- Badge "Precios" con estilo glass
- Botón de cambio de tema (lucide `Sun`/`Moon`)

### 3.3 Content
- Wrapper `.page-shell` (`max-w-[1500px] space-y-6`)
- Animación `animate-slideIn` al cambiar de página

## 4. Design System

### 4.1 Colores base (`:root`)

| Token | Valor | Uso |
|---|---|---|
| `--background` | `38 38% 93%` | Fondo página (crema) |
| `--foreground` | `150 18% 14%` | Texto principal |
| `--primary` | `175 98% 22%` | Teal — acento principal |
| `--primary-glow` | `175 60% 40%` | Teal claro — glow/gradients |
| `--success` | `142 55% 42%` | Verde OK |
| `--warning` | `38 92% 50%` | Ámbar |
| `--destructive` | `0 75% 50%` | Rojo error |
| `--info` | `199 89% 48%` | Azul informativo |

### 4.2 Sidebar (modo oscuro)

| Token | Valor |
|---|---|
| `--sidebar-background` | `175 40% 12% / 0.85` |
| `--sidebar-foreground` | `40 20% 92%` |
| `--sidebar-primary` | `175 98% 30%` |
| `--sidebar-accent` | `175 25% 22%` |
| `--sidebar-border` | `175 20% 22%` |

### 4.3 Superficies glass

| Token | Valor |
|---|---|
| `--glass-bg` | `hsl(38 45% 98% / 0.38)` |
| `--glass-bg-strong` | `hsl(38 45% 98% / 0.60)` |
| `--glass-border` | `hsl(38 30% 75% / 0.35)` |
| `--glass-border-accent` | `hsl(175 98% 22% / 0.22)` — **teal** |
| `--glass-shadow` | `0 4px 16px hsl(150 18% 14% / 0.07)` |
| `--glass-shadow-lg` | `0 8px 30px hsl(150 18% 14% / 0.10)` |
| `--glass-glow` | `0 0 24px hsl(175 98% 22% / 0.07)` — **teal** |

### 4.4 Clases globales (idénticas a Lasarte)
- `.glass`, `.glass-strong`, `.glass-accented`, `.glass-hover`, `.glass-lift`
- `.page-shell`, `.page-header`, `.page-title`, `.page-subtitle`
- `.section-toolbar`, `.data-table`, `.panel-kicker`, `.chart-panel`
- `.empty-state`, `.content-panel`, `.metric-strip`

### 4.5 Fondo de página
```css
background:
  radial-gradient(ellipse 65% 50% at 10% -10%, hsl(175 80% 30% / 0.07) 0%, transparent 60%),
  radial-gradient(ellipse 55% 45% at 90% 5%, hsl(90 30% 40% / 0.05) 0%, transparent 55%),
  radial-gradient(ellipse 40% 35% at 50% 100%, hsl(175 60% 25% / 0.04) 0%, transparent 50%),
  linear-gradient(175deg, hsl(38 44% 96%) 0%, hsl(38 38% 92%) 50%, hsl(36 32% 89%) 100%);
```
(igual que Lasarte pero con tonos teal en vez de naranja)

### 4.6 Modo oscuro
Misma estructura que Lasarte, con todos los tokens adaptados a dark mode.

## 5. Componentes compartidos

| Componente | Fuente | Notas |
|---|---|---|
| `KPICard` | Lasarte | Mismo diseño, trend up/down/neutral, hint |
| `StatusBadge` | Lasarte | Badges semánticos (success/warning/destructive) |
| `CommandPalette` | Lasarte | Cmd+K, búsqueda de páginas |
| `ErrorBoundary` | Lasarte | Mismo patrón |
| `PageSkeleton` | Lasarte | Loading state con glass spinner |
| `GlassTooltip` | Lasarte chartTheme | Tooltip para Recharts |

### 5.1 KPICard
```
┌────────────────┐
│ LABEL (upper)  │
│ 1.234.567 €    │  [icono glass]
│ ▲ +12% vs año  │
└────────────────┘
```

### 5.2 FilterPanel (nuevo para PriceTrack)
Panel de filtros con diseño glass, usado en Ventas, Productos, Tabla:
```
┌─────────────────────────────────────────┐
│ 🔍 Filtros                    X resultados│
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────────┐│
│ │ Tipo │ │Prod. │ │Var.  │ │ Calibre  ││
│ └──────┘ └──────┘ └──────┘ └──────────┘│
│ [Aplicar] [Limpiar]                     │
└─────────────────────────────────────────┘
```

## 6. Gráficas (Recharts)

Mismo patrón que `chartTheme.tsx` de Lasarte:

| Elemento | Regla |
|---|---|
| Fills | `barFill(color, 0.22-0.55)` + `stroke={color}` |
| Tooltip | `GlassTooltip` con glass border |
| Grid | `vertical={false}`, `strokeDasharray="3 3"` |
| Ejes | `fontSize={10}`, tick fill muted |
| Panel | `chart-panel` class con gradient top border |

### Paleta PriceTrack (`CHART_COLORS`)
| Destino | Color |
|---|---|
| Primary (teal) | `#01696f` |
| Gold | `#d19900` |
| Blue | `#006494` |
| Orange | `#da7101` |
| Purple | `#8b5cf6` |
| Green | `#437a22` |

## 7. Páginas y funcionalidad

### 7.1 Dashboard (`/`)
- KPIs: Precio medio última campaña, Kilos campaña, Clientes activos, Variedades
- Gráfico: Evolución precio/kg (línea, por campaña)
- Gráfico: Precio mensual (barras, por mes campaña)
- Gráfico: Variedades principales (barras horizontales)
- Insight panel: último mes, mejor variedad, rango histórico
- Selectores: Producto, Campaña

### 7.2 Ventas (`/ventas`)
- FilterPanel: tipo, producto base, variedad, calibre, formato, subproducto, campaña, mes, cliente
- Tabla: fecha, documento, cliente, producto (variedad + calibre + formato), referencia, kilos, precio, total
- Paginación: 50/100/200 por página, navegación
- Summary bar: total registros, tipos, variedades, calibres, facturación, kilos
- Campo de búsqueda textual

### 7.3 Productos (`/productos`)
- FilterPanel: igual que Ventas
- Tablas agrupadas por: tipo de factura, producto base, variedad, calibre, formato, subproducto
- Columnas: nombre, líneas, referencias, KG, Base IVA
- Summary bar: líneas, facturación, kilos, tipos, variedades, calibres

### 7.4 Clientes (`/clientes`)
- KPIs: clientes totales, facturación total, kilos totales
- Lista de clientes con métricas (facturación, kilos, variedades)
- Click en cliente → detalle con histórico de compras

### 7.5 Confección (`/confeccion`)
- FilterPanel: tipo, cliente, producto base, variedad, calibre, tipo caja, situación, fecha
- Tabla: nº palet, producto, base/variedad, calibre, cajas, tipo caja, kg netos, kg fact., PVP/kg, PVP
- Summary bar
- Paginación
- Árbol de productos (toggle)
- Export CSV

### 7.6 Tendencias (`/tendencias`)
- FilterPanel: producto, rango de campañas (desde/hasta)
- KPIs: precio medio, máximo, mínimo, variación
- Gráfico: tendencia de precios (línea)
- Gráfico: precio máximo y mínimo por campaña
- Gráfico: variación % campaña a campaña
- Gráfico: volumen / facturación anual

### 7.7 Comparar (`/comparar`)
- Selector de producto
- Grid de tarjetas de campaña (clic para seleccionar, mínimo 2)
- Gráfico: comparativa mensual entre campañas seleccionadas
- Tabla: resumen estadístico por campaña

### 7.8 Predicciones (`/predicciones`)
- Selector de producto
- KPIs: precio estimado, tendencia, confianza
- Gráfico: historial real vs predicción (12 meses)
- Tabla: pronóstico mensual detallado

### 7.9 Datos (`/datos`)
- FilterPanel: tipo, producto base, variedad, calibre, formato, subproducto, campaña, categoría
- Búsqueda textual
- Tabla completa con todas las columnas
- Acciones: Exportar CSV, Importar CSV, Borrar todos
- Paginación

## 8. Data Flow

```
Supabase (tabla precios, confeccion)
    ↓
@tanstack/react-query (useQuery + useMutation)
    ↓
Custom hooks (usePrecios, useVentas, useClientes, useConfeccion)
    ↓
Page components
    ↓
Shared components (KPICard, StatusBadge, etc.)
```

### 8.1 Hooks principales

**`usePrecios()`**: Carga todos los registros de precios, con filtros y paginación. Expone: `{ data, isLoading, totals, filters, setFilter, pagination }`.

**`useVentas()`**: Similar pero con filtros específicos para la página de ventas.

**`useClientes()`**: Agrupa por cliente, devuelve métricas agregadas.

**`useConfeccion()`**: Carga datos de confección con filtros.

### 8.2 Funcionalidad offline/realtime
- Igual que Lasarte: `subscribeToChanges` para actualizaciones en tiempo real vía Supabase Realtime
- React Query refetch automático al reconectar

## 9. Funcionalidades adicionales (desde Lasarte)

| Feature | Incluir |
|---|---|
| CommandPalette (Cmd+K) | ✅ Sí |
| Tema claro/oscuro | ✅ Sí (con next-themes o simple context) |
| ChatBot | ❌ No (no aplica a precios) |
| Toast notifications | ✅ Sí (sonner) |
| Glass scrollbar | ✅ Sí |

## 10. Lo que NO cambia

- Lógica de negocio (clasificación de productos, detección de categorías, cálculos de precios ponderados)
- Estructura de datos en Supabase (mismas tablas y columnas)
- Funcionalidad de import/export CSV
- Algoritmo de predicciones (se mantiene igual, solo se migra la UI)

## 11. Migración de Chart.js a Recharts

| Gráfico actual (Chart.js) | Nuevo (Recharts) |
|---|---|
| annualChart (línea anual) | `LineChart` / `ComposedChart` |
| monthlyChart (barras mensual) | `BarChart` |
| categoryChart (barras variedades) | `BarChart` horizontal |
| trendMainChart (línea tendencias) | `LineChart` |
| trendMinMaxChart (barras min/max) | `BarChart` agrupado |
| trendVarChart (barras variación) | `BarChart` |
| trendVolChart (barras volumen) | `BarChart` |
| compareChart (líneas comparativa) | `LineChart` multi-serie |
| predChart (línea real+predicción) | `LineChart` multi-serie |
| historyChart (línea histórico) | `LineChart` |
| pie/donut (distribución) | `PieChart` (si aplica) |

---

*Design document v1 — 2026-05-28*
*Aprobado por usuario.*
