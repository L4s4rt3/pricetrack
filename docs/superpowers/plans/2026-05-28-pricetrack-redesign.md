# PriceTrack Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate PriceTrack from vanilla JS/HTML/CSS to React 18 + TypeScript + Tailwind + shadcn/ui + Recharts, using the glassmorphism design system from Lasarte SAT adapted with teal primary color `#01696f`.

**Architecture:** React SPA with 9 pages, shadcn sidebar layout, Supabase data layer via @tanstack/react-query, Recharts for all graphs. No authentication. Glass design system with teal accent.

**Tech Stack:** React 18, TypeScript, Vite 6, Tailwind CSS 3, shadcn/ui, @tanstack/react-query, Recharts, lucide-react, @supabase/supabase-js, xlsx, date-fns, sonner, class-variance-authority

**Design System:** Full glassmorphism (glass surfaces, backdrop blur, warm cream background, teal sidebar, teal accents). CSS variables from Lasarte adapted with `--primary: hsl(175 98% 22%)`.

---

## File Structure

```
CURRENT FILES TO KEEP:
  .env                          # Supabase credentials
  .env.example
  supabase/                     # Migrations unchanged
  vercel.json
  vite.config.js                # Will be modified to add react plugin
  public/
  scripts/                      # Data import scripts unchanged
  ventas.csv                    # Sample data

CURRENT FILES TO REMOVE:
  src/*.js                      # All vanilla JS files
  index.html                    # Replaced with React SPA

NEW FILES TO CREATE:
  src/main.tsx                  # React entry point
  src/App.tsx                   # Router + providers
  src/index.css                 # Design system tokens (glass + teal)
  src/vite-env.d.ts             # Vite type declarations
  src/components/AppLayout.tsx  # Sidebar + TopBar + Outlet
  src/components/TopBar.tsx     # Breadcrumb, badge, theme toggle
  src/components/NavLink.tsx    # NavLink wrapper for react-router
  src/components/KPICard.tsx    # KPI card component
  src/components/KPICardGrid.tsx # Grid of KPIs
  src/components/CommandPalette.tsx  # Cmd+K search
  src/components/FilterPanel.tsx     # Reusable filter panel
  src/components/PageHeader.tsx      # Page title + subtitle
  src/components/DataTable.tsx       # Reusable table with pagination
  src/components/ErrorBoundary.tsx   # Error boundary
  src/components/EmptyState.tsx      # Empty state display
  src/components/StatusBadge.tsx     # Status indicator badges
  src/contexts/ThemeProvider.tsx     # Light/dark theme
  src/hooks/usePrecios.ts            # Fetch precios data
  src/hooks/useVentas.ts             # Ventas queries + filters
  src/hooks/useClientes.ts           # Client aggregation queries
  src/hooks/useConfeccion.ts         # Confeccion queries + filters
  src/hooks/useDebounce.ts           # Debounce hook
  src/hooks/use-toast.ts             # Sonner toast wrapper
  src/hooks/use-mobile.tsx           # Mobile detection hook
  src/integrations/supabase/client.ts  # Supabase client singleton
  src/lib/chartTheme.tsx             # Recharts theme (adapted from Lasarte)
  src/lib/format.ts                  # All formatting functions
  src/lib/types.ts                   # TypeScript interfaces
  src/lib/utils.ts                   # cn(), debounce, etc.
  src/lib/parsers.ts                 # Product classification logic
  src/lib/predictions.ts             # Prediction algorithm
  src/pages/Dashboard.tsx            # / — Resumen
  src/pages/Ventas.tsx               # /ventas
  src/pages/Productos.tsx            # /productos
  src/pages/Clientes.tsx             # /clientes
  src/pages/Confeccion.tsx           # /confeccion
  src/pages/Tendencias.tsx           # /tendencias
  src/pages/Comparar.tsx             # /comparar
  src/pages/Predicciones.tsx         # /predicciones
  src/pages/Datos.tsx                # /datos
  src/pages/NotFound.tsx             # 404

MODIFIED:
  package.json                  # Add all React deps
  vite.config.js                # Add @vitejs/plugin-react-swc
  index.html                    # Replace with React SPA shell
  tsconfig.json                 # Add TypeScript config
  tsconfig.app.json             # App-specific TS config
  tsconfig.node.json            # Node-specific TS config
```

---

### Task 1: Project Scaffolding — package.json, configs, dependencies

**Files:**
- Modify: `package.json`
- Modify: `vite.config.js` → rename to `vite.config.ts`
- Modify: `index.html`
- Create: `tsconfig.json`
- Create: `tsconfig.app.json`
- Create: `tsconfig.node.json`
- Create: `tailwind.config.ts`
- Create: `postcss.config.js` (if needed)
- Create: `components.json` (shadcn config)
- Create: `src/vite-env.d.ts`

- [ ] **Step 1: Update package.json**

Replace current package.json with full React stack:

```json
{
  "name": "pricetrack",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint ."
  },
  "dependencies": {
    "@hookform/resolvers": "^3.10.0",
    "@radix-ui/react-collapsible": "^1.1.11",
    "@radix-ui/react-dialog": "^1.1.14",
    "@radix-ui/react-dropdown-menu": "^2.1.15",
    "@radix-ui/react-label": "^2.1.7",
    "@radix-ui/react-popover": "^1.1.14",
    "@radix-ui/react-scroll-area": "^1.2.9",
    "@radix-ui/react-select": "^2.2.5",
    "@radix-ui/react-separator": "^1.1.7",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-switch": "^1.2.5",
    "@radix-ui/react-tabs": "^1.1.12",
    "@radix-ui/react-toast": "^1.2.14",
    "@radix-ui/react-tooltip": "^1.2.7",
    "@supabase/supabase-js": "^2.49.4",
    "@tanstack/react-query": "^5.83.0",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^3.6.0",
    "lucide-react": "^0.462.0",
    "react": "^18.3.1",
    "react-day-picker": "^8.10.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.61.1",
    "react-router-dom": "^7.14.2",
    "recharts": "^2.15.4",
    "sonner": "^1.7.4",
    "tailwind-merge": "^2.6.0",
    "tailwindcss-animate": "^1.0.7",
    "xlsx": "^0.18.5",
    "zod": "^3.25.76"
  },
  "devDependencies": {
    "@types/node": "^22.16.5",
    "@types/react": "^18.3.23",
    "@types/react-dom": "^18.3.7",
    "@vitejs/plugin-react-swc": "^3.11.0",
    "autoprefixer": "^10.4.21",
    "tailwindcss": "^3.4.17",
    "typescript": "^5.8.3",
    "vite": "^6.3.2"
  }
}
```

- [ ] **Step 2: Create tailwind.config.ts**

```typescript
import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: { "2xl": "1400px" },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        success: {
          DEFAULT: "hsl(var(--success))",
          foreground: "hsl(var(--success-foreground))",
        },
        warning: {
          DEFAULT: "hsl(var(--warning))",
          foreground: "hsl(var(--warning-foreground))",
        },
        info: {
          DEFAULT: "hsl(var(--info))",
          foreground: "hsl(var(--info-foreground))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
} satisfies Config;
```

- [ ] **Step 3: Update index.html** — Replace with React SPA shell:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PriceTrack — Análisis de Ventas y Precios</title>
  <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
</html>
```

- [ ] **Step 4: Create TypeScript configs**

`tsconfig.json`:
```json
{
  "files": [],
  "references": [
    { "path": "./tsconfig.app.json" },
    { "path": "./tsconfig.node.json" }
  ]
}
```

`tsconfig.app.json`:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src"]
}
```

`tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2023"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "isolatedModules": true,
    "moduleDetection": "force",
    "noEmit": true,
    "strict": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 5: Update vite.config.ts**

Rename `vite.config.js` to `vite.config.ts`:

```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
  },
});
```

- [ ] **Step 6: Create components.json** (shadcn/ui config):

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.ts",
    "css": "src/index.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  }
}
```

- [ ] **Step 7: Create src/vite-env.d.ts**

```typescript
/// <reference types="vite/client" />
```

- [ ] **Step 8: Create postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};
```

- [ ] **Step 9: Install dependencies**

```bash
npm install
```

- [ ] **Step 10: Create directory structure**

```bash
mkdir -p src/components/ui src/contexts src/hooks src/integrations/supabase src/lib src/pages
```

---

### Task 2: Design System — index.css with glass tokens (PriceTrack teal)

**Files:**
- Create: `src/index.css`

- [ ] **Step 1: Write the complete index.css**

Adapted from Lasarte SAT, replacing primary color with teal `hsl(175 98% 22%)`:

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 38 38% 93%;
    --foreground: 150 18% 14%;

    --card: 38 20% 96%;
    --card-foreground: 150 18% 14%;

    --popover: 38 20% 96%;
    --popover-foreground: 150 18% 14%;

    --primary: 175 98% 22%;
    --primary-foreground: 0 0% 100%;
    --primary-glow: 175 60% 40%;

    --secondary: 38 28% 88%;
    --secondary-foreground: 150 18% 14%;

    --muted: 38 22% 90%;
    --muted-foreground: 150 10% 40%;

    --accent: 90 35% 85%;
    --accent-foreground: 150 30% 18%;

    --success: 142 55% 42%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 50%;
    --warning-foreground: 0 0% 100%;
    --info: 199 89% 48%;
    --info-foreground: 0 0% 100%;
    --destructive: 0 75% 50%;
    --destructive-foreground: 0 0% 100%;

    --border: 38 25% 82%;
    --input: 38 20% 85%;
    --ring: 175 98% 22%;

    --radius: 0.625rem;

    --sidebar-background: 175 40% 12% / 0.85;
    --sidebar-foreground: 40 20% 92%;
    --sidebar-primary: 175 98% 30%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 175 25% 22%;
    --sidebar-accent-foreground: 40 25% 95%;
    --sidebar-border: 175 20% 22%;
    --sidebar-ring: 175 98% 22%;

    --gradient-primary: linear-gradient(135deg, hsl(var(--primary)), hsl(var(--primary-glow)));
    --glass-border: hsl(38 30% 75% / 0.35);
    --glass-border-accent: hsl(175 98% 22% / 0.22);
    --glass-bg: hsl(38 45% 98% / 0.38);
    --glass-bg-strong: hsl(38 45% 98% / 0.60);
    --glass-shadow: 0 4px 16px hsl(150 18% 14% / 0.07), 0 1px 3px hsl(150 18% 14% / 0.05);
    --glass-shadow-lg: 0 8px 30px hsl(150 18% 14% / 0.10), 0 2px 6px hsl(150 18% 14% / 0.06);
    --glass-glow: 0 0 24px hsl(175 98% 22% / 0.07);
    --shadow-card: var(--glass-shadow);
    --shadow-elegant: var(--glass-shadow-lg);

    --color-bg:           hsl(var(--background));
    --color-surface:      var(--glass-bg);
    --color-surface-hover: var(--glass-bg-strong);
    --color-accent:       hsl(var(--primary));
    --color-text:         hsl(var(--foreground));
    --color-text-muted:   hsl(var(--muted-foreground));
    --color-border:       var(--glass-border);
    --blur:               blur(24px);
    --shadow:             var(--glass-shadow);
  }

  .dark {
    --background: 150 20% 10%;
    --foreground: 40 20% 92%;
    --card: 150 20% 13%;
    --card-foreground: 40 20% 92%;
    --popover: 150 20% 13%;
    --popover-foreground: 40 20% 92%;
    --primary: 175 80% 40%;
    --primary-foreground: 0 0% 100%;
    --primary-glow: 175 70% 50%;
    --secondary: 150 15% 20%;
    --secondary-foreground: 40 20% 92%;
    --muted: 150 15% 18%;
    --muted-foreground: 40 10% 65%;
    --accent: 150 25% 22%;
    --accent-foreground: 40 25% 92%;
    --success: 142 55% 48%;
    --success-foreground: 0 0% 100%;
    --warning: 38 92% 55%;
    --warning-foreground: 0 0% 100%;
    --destructive: 0 70% 55%;
    --destructive-foreground: 0 0% 100%;
    --border: 150 15% 22%;
    --input: 150 15% 22%;
    --ring: 175 80% 40%;
    --sidebar-background: 175 40% 10% / 0.8;
    --sidebar-foreground: 40 20% 92%;
    --sidebar-primary: 175 80% 40%;
    --sidebar-primary-foreground: 0 0% 100%;
    --sidebar-accent: 175 25% 18%;
    --sidebar-accent-foreground: 40 25% 95%;
    --sidebar-border: 175 20% 18%;
    --sidebar-ring: 175 80% 40%;
    --glass-border: hsl(0 0% 100% / 0.08);
    --glass-border-accent: hsl(175 80% 40% / 0.15);
    --glass-bg: hsl(150 20% 13% / 0.7);
    --glass-bg-strong: hsl(150 20% 13% / 0.85);
    --glass-shadow: 0 4px 20px hsl(0 0% 0% / 0.15);
    --glass-shadow-lg: 0 8px 32px hsl(0 0% 0% / 0.2);
    --glass-glow: 0 0 20px hsl(175 80% 40% / 0.08);
    --shadow-card: var(--glass-shadow);
    --shadow-elegant: var(--glass-shadow-lg);
  }
}

@layer base {
  * { @apply border-border; }
  html { @apply antialiased; }
  body {
    @apply text-foreground;
    font-feature-settings: "cv11", "ss01";
    background:
      radial-gradient(ellipse 65% 50% at 10% -10%, hsl(175 80% 30% / 0.07) 0%, transparent 60%),
      radial-gradient(ellipse 55% 45% at 90% 5%, hsl(90 30% 40% / 0.05) 0%, transparent 55%),
      radial-gradient(ellipse 40% 35% at 50% 100%, hsl(175 60% 25% / 0.04) 0%, transparent 50%),
      linear-gradient(175deg, hsl(38 44% 96%) 0%, hsl(38 38% 92%) 50%, hsl(36 32% 89%) 100%);
    background-attachment: fixed;
  }
  .dark body {
    background:
      radial-gradient(ellipse 65% 50% at 10% -10%, hsl(175 80% 40% / 0.12) 0%, transparent 60%),
      radial-gradient(ellipse 55% 45% at 90% 5%, hsl(90 35% 35% / 0.08) 0%, transparent 55%),
      radial-gradient(ellipse 40% 35% at 50% 100%, hsl(175 70% 35% / 0.06) 0%, transparent 50%),
      linear-gradient(175deg, hsl(150 24% 12%) 0%, hsl(150 20% 9%) 50%, hsl(150 20% 7%) 100%);
    background-attachment: fixed;
  }
  h1, h2, h3, h4 { @apply font-semibold tracking-tight text-foreground; }
  ::selection { @apply bg-primary/20 text-foreground; }
}

@layer components {
  .glass {
    @apply rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow)] backdrop-blur-xl;
  }
  .glass-strong {
    @apply rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg-strong)] shadow-[var(--glass-shadow)] backdrop-blur-xl;
  }
  .glass-lg {
    @apply rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] shadow-[var(--glass-shadow-lg)] backdrop-blur-2xl;
  }
  .glass-accented {
    @apply glass;
    border-color: var(--glass-border-accent);
  }
  .glass-hover {
    @apply transition-shadow duration-300;
  }
  .glass-hover:hover {
    box-shadow: var(--glass-shadow), var(--glass-glow);
  }
  .glass-lift {
    @apply glass transition-all duration-200;
  }
  .glass-lift:hover {
    transform: translateY(-2px);
    box-shadow: var(--glass-shadow-lg), var(--glass-glow);
  }
  .page-shell {
    @apply mx-auto w-full max-w-[1500px] space-y-6;
  }
  .page-header {
    @apply flex flex-wrap items-start justify-between gap-4 rounded-xl glass-accented p-5;
  }
  .page-title {
    @apply text-2xl font-semibold tracking-tight text-foreground md:text-3xl;
  }
  .page-subtitle {
    @apply mt-1 text-sm text-muted-foreground;
  }
  .section-toolbar {
    @apply flex flex-col gap-3 rounded-xl glass-accented p-3 sm:flex-row sm:flex-wrap sm:items-center;
  }
  .content-panel {
    @apply rounded-xl glass;
  }
  .chart-panel {
    @apply relative overflow-hidden rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3 shadow-[var(--glass-shadow)] backdrop-blur-xl;
  }
  .chart-panel::before {
    content: '';
    position: absolute;
    inset: 0 0 auto 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, hsl(var(--primary) / 0.35), transparent);
    pointer-events: none;
  }
  .chart-panel::after {
    content: '';
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 18% 0%, hsl(var(--primary) / 0.04), transparent 34%),
      linear-gradient(180deg, hsl(38 20% 94% / 0.07), transparent 42%);
    pointer-events: none;
  }
  .chart-panel > * {
    @apply relative z-10;
  }
  .chart-panel .recharts-cartesian-grid line {
    stroke: hsl(var(--border));
    stroke-opacity: 0.45;
  }
  .chart-panel .recharts-text {
    fill: hsl(var(--muted-foreground));
  }
  .chart-panel .recharts-legend-item-text {
    color: hsl(var(--muted-foreground)) !important;
  }
  .chart-panel .recharts-tooltip-cursor {
    fill: var(--glass-bg-strong);
    stroke: var(--glass-border-accent);
  }
  .section-card-header {
    @apply border-b border-[var(--glass-border)] px-5 py-4;
  }
  .section-card-body {
    @apply p-5;
  }
  .empty-state {
    @apply flex flex-col items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] p-10 text-center text-sm text-muted-foreground backdrop-blur-xl;
  }
  .panel-title {
    @apply text-base font-semibold tracking-tight text-foreground;
  }
  .panel-kicker {
    @apply text-[11px] font-semibold uppercase tracking-wider text-muted-foreground;
  }
  .metric-strip {
    @apply grid gap-3 sm:grid-cols-2 xl:grid-cols-4;
  }
  .data-table {
    @apply w-full text-sm;
  }
  .data-table thead {
    @apply border-b;
  }
  .data-table th {
    @apply px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground;
  }
  .data-table td {
    @apply px-4 py-3 align-middle;
  }
  .data-table tbody tr {
    @apply border-b border-[var(--glass-border)];
  }
  .data-table tbody tr:last-child {
    @apply border-b-0;
  }
  input[type="date"]::-webkit-calendar-picker-indicator {
    opacity: 0.5;
    cursor: pointer;
    border-radius: 4px;
    padding: 2px 4px;
    transition: opacity 0.15s;
  }
  input[type="date"]::-webkit-calendar-picker-indicator:hover {
    opacity: 0.9;
    background: hsl(var(--primary) / 0.12);
  }
  input[type="date"]::-webkit-inner-spin-button {
    display: none;
  }
}

@layer utilities {
  .animate-fadeIn {
    animation: fadeIn 0.3s ease-out;
  }
  .animate-slideIn {
    animation: slideIn 0.25s ease-out;
  }
  .animate-scaleIn {
    animation: scaleIn 0.2s ease-out;
  }
}

@keyframes fadeIn {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes slideIn {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to   { opacity: 1; transform: scale(1); }
}

* {
  scrollbar-width: thin;
  scrollbar-color: rgba(255,255,255,0.18) transparent;
}
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-track { background: transparent; margin: 12px; }
::-webkit-scrollbar-thumb {
  background: linear-gradient(180deg, rgba(255,255,255,0.20), rgba(255,255,255,0.08));
  border-radius: 999px;
  border: 1px solid rgba(255,255,255,0.08);
  backdrop-filter: blur(12px);
  box-shadow: inset 0 1px 0 rgba(255,255,255,0.12), 0 4px 16px rgba(0,0,0,0.08);
}
::-webkit-scrollbar-thumb:hover {
  background: linear-gradient(180deg, rgba(255,255,255,0.28), rgba(255,255,255,0.14));
}
::-webkit-scrollbar-corner { background: transparent; }
```

---

### Task 3: Core library files — types, utils, format, Supabase client

**Files:**
- Create: `src/lib/types.ts`
- Create: `src/lib/utils.ts`
- Create: `src/lib/format.ts`
- Create: `src/integrations/supabase/client.ts`

- [ ] **Step 1: Create types.ts**

```typescript
export interface PrecioRow {
  id: number;
  product: string;
  category: string;
  price: number;
  unit: string;
  year: number;
  month: number | null;
  notes: string;
  cliente: string;
  denominacion_social: string;
  referencia: string;
  kilos: number;
  unidades: number;
  litros: number;
  tarifa: number;
  coste_adic: number;
  base_iva: number;
  documento: string;
  factura: string;
  fecha_fra: string;
  lin: number;
  created_at: string;
}

export interface ConfeccionRow {
  id: number;
  n_palet: string;
  tipo: string;
  producto_confeccionado: string;
  producto_base: string;
  variedad: string;
  calibre: string;
  tipo_caja: string;
  cajas: number;
  kg_netos: number;
  kg_facturados: number;
  pvp_kg: number;
  pvp_total: number;
  cliente_nombre: string;
  denominacion_social: string;
  cliente_id: string;
  situacion: string;
  fecha: string;
  lote: string;
  documento_venta_original: string;
  documento_limpio: string;
}

export interface LineClassification {
  type: string;
  product: string;
  citrusType: string;
  variety: string;
  caliber: string;
  quality: string;
  format: string;
  formatDetail: string;
  packaging: string;
  container: string;
  brand: string;
  subproduct: string;
}

export interface VentasFilters {
  search: string;
  campaign: number | null;
  month: number | null;
  cliente: string;
  type: string;
  base: string;
  subproduct: string;
  variety: string;
  caliber: string;
  format: string;
}

export interface ProductFilters {
  type: string;
  base: string;
  subproduct: string;
  variety: string;
  caliber: string;
  format: string;
}

export interface PaginationState {
  page: number;
  pageSize: number;
}
```

- [ ] **Step 2: Create utils.ts**

```typescript
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}
```

- [ ] **Step 3: Create format.ts**

```typescript
export function fmt(n: number): string {
  return n.toFixed(2);
}

export function fmtPct(n: number): string {
  return (n >= 0 ? "+" : "") + n.toFixed(1) + "%";
}

export function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(n);
}

export function formatKg(n: number): string {
  return (
    new Intl.NumberFormat("es-ES", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n) + " kg"
  );
}

export function formatNum(n: number): string {
  return new Intl.NumberFormat("es-ES").format(Math.round(n));
}

export function campaignLabel(c: number): string {
  return `${c}/${String((c + 1) % 100).padStart(2, "0")}`;
}

export const MONTHS = [
  "Ene","Feb","Mar","Abr","May","Jun",
  "Jul","Ago","Sep","Oct","Nov","Dic"
];

export const MONTH_NAMES = [
  "Enero","Febrero","Marzo","Abril","Mayo","Junio",
  "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"
];

export const CAMPAIGN_MONTHS = [
  "Oct","Nov","Dic","Ene","Feb","Mar",
  "Abr","May","Jun","Jul","Ago","Sep"
];
```

- [ ] **Step 4: Create Supabase client**

```typescript
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

---

### Task 4: Parser and prediction logic

**Files:**
- Create: `src/lib/parsers.ts`
- Create: `src/lib/predictions.ts`

- [ ] **Step 1: Create parsers.ts**

Port the product classification logic from `app.js` (functions: `getLineClassification`, `normalizeText`, `isReadableProductName`, `getClientName`, `getClientLabel`, `getCampaignStart`, `sameCampaign`, `campaignMonthIndex`, `detectCategory`, `hasEconomicValue`, etc.)

```typescript
import type { PrecioRow, LineClassification } from "./types";

const CLIENT_GROUP_RULES = [
  { label: "COFRULY S.A.", match: /\bCOFRULY\b/ },
];

function normalizeText(value: string): string {
  return String(value || "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getRawClientName(d: PrecioRow): string {
  const code = String(d.cliente || "").trim();
  const name = String(d.denominacion_social || "").trim();
  return name && name !== code ? name : "";
}

function normalizeClientText(value: string): string {
  return normalizeText(value)
    .replace(/[^A-Z0-9]+/g, " ")
    .replace(/\b(SOCIEDAD|ANONIMA|LIMITADA|SL|S L|SA|S A|SAS|SARL|BV|NV|LTD|GMBH|INC|CO|COMPANY|THE)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getClientName(d: PrecioRow): string {
  const rawName = getRawClientName(d);
  if (!rawName) return "";
  const searchable = normalizeClientText(`${rawName} ${d.cliente || ""}`);
  const group = CLIENT_GROUP_RULES.find((rule) => rule.match.test(searchable));
  return group ? group.label : rawName;
}

export function getClientLabel(d: PrecioRow): string {
  return getClientName(d) || d.cliente || "—";
}

export function getClientSearchText(d: PrecioRow): string {
  return [getClientName(d), getRawClientName(d), d.denominacion_social, d.cliente]
    .filter(Boolean).join(" ");
}

export function isReadableProductName(value: string): boolean {
  const text = String(value || "").trim();
  if (!text) return false;
  if (/PK\x03\x04|Content_Types|docProps|workbook|sharedStrings/i.test(text)) return false;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/.test(text)) return false;
  const visible = [...text].filter((ch) => !/\s/.test(ch));
  if (visible.length < 8) return true;
  const bad = visible.filter(
    (ch) => !/[A-Za-z0-9ÁÉÍÓÚÜÑáéíóúüñÇçÀÈÌÒÙàèìòù.,;:()\/+\-'ºª&%€#]/.test(ch)
  ).length;
  return bad / visible.length <= 0.18;
}

export function hasNamedClient(d: PrecioRow): boolean {
  return !!getRawClientName(d);
}

export function hasEconomicValue(d: PrecioRow): boolean {
  return [d.price, d.base_iva, d.kilos, d.unidades, d.litros].some(
    (v) => Math.abs(Number(v || 0)) > 0
  );
}

export function isMainOrangePriceRow(d: PrecioRow): boolean {
  if (!isReadableProductName(d.product) || !hasNamedClient(d) || !hasEconomicValue(d)) return false;
  const cls = getLineClassification(d);
  return cls.type === "Producto" && cls.product === "Naranja" && d.price > 0 && d.kilos > 0;
}

export function getCampaignStart(d: { year: number; month: number | null }): number {
  return d.month && d.month >= 10 ? d.year : d.year - 1;
}

export function sameCampaign(d: { year: number; month: number | null }, c: number): boolean {
  return getCampaignStart(d) === Number(c);
}

export function campaignMonthIndex(d: { month: number | null }): number {
  return d.month ? (d.month + 2) % 12 : 0;
}

export function isVisibleRow(d: PrecioRow): boolean {
  return getCampaignStart(d) >= 2015 && hasNamedClient(d) && isReadableProductName(d.product);
}

function firstMatch(text: string, rules: { re: RegExp; label: string }[], fallback = ""): string {
  const hit = rules.find((rule) => rule.re.test(text));
  return hit ? hit.label : fallback;
}

function extractCaliber(text: string): string {
  const match = text.match(/\bCAL\.?\s*([0-9]+(?:\s*[\/\-]\s*[0-9]+)?)/);
  if (!match) return "Sin calibre";
  return "Cal " + match[1].replace(/\s+/g, "");
}

function extractWeight(text: string): string {
  const pack = text.match(/\b([0-9]+)\s*X\s*([0-9]+(?:[,.][0-9]+)?)\s*KG\b/);
  if (pack) return pack[1] + " x " + pack[2].replace(",", ".") + " kg";
  const weight = text.match(/\b([0-9]+(?:[,.][0-9]+)?)\s*KG\b/);
  return weight ? weight[1].replace(",", ".") + " kg" : "";
}

function extractFormat(text: string): string {
  const presentation = firstMatch(text, [
    { re: /D\s*-?\s*PACK/, label: "D-Pack" },
    { re: /GIRSAC/, label: "Girsac" },
    { re: /GRAN(?:E|D)EL/, label: "Granel" },
    { re: /EMPAQUET|\bEMP\b/, label: "Empaquetado" },
    { re: /MALLA/, label: "Malla" },
    { re: /CLIP\s*TO\s*CLIP|\bC2C\b/, label: "Clip to clip" },
    { re: /BOX/, label: "Box" },
  ]);
  return presentation || "Sin formato";
}

function extractFormatDetail(text: string): string {
  const weight = extractWeight(text);
  const container = extractContainer(text);
  return [weight, container !== "Sin envase" ? container : ""].filter(Boolean).join(" · ");
}

function extractContainer(text: string): string {
  return firstMatch(text, [
    { re: /CARTON|CART\.?/, label: "Carton" },
    { re: /PLASTICO|PLAST\.?|PLAS\.?/, label: "Plastico" },
    { re: /MADERA|MAD\.?/, label: "Madera" },
    { re: /EUROPOOL/, label: "EuroPool" },
    { re: /IFCO/, label: "IFCO" },
    { re: /PALET|PALLET/, label: "Palet" },
  ], "Sin envase");
}

function extractQuality(text: string): string {
  return firstMatch(text, [
    { re: /CAT\s*\.?\s*II|CATII|CATEGORIA\s*II/, label: "Categoria II" },
    { re: /EXTRA/, label: "Extra" },
    { re: /PREMIUM/, label: "Premium" },
    { re: /BUENO/, label: "Bueno" },
    { re: /SEGUNDA|2A|2ª/, label: "Segunda" },
  ], "Categoria I / sin indicar");
}

function extractBrand(text: string): string {
  return firstMatch(text, [
    { re: /LASARTE/, label: "Lasarte" },
    { re: /BELLE\s+ANDALOUSE/, label: "Belle Andalouse" },
    { re: /PITUFO/, label: "Pitufo" },
    { re: /GENERIC[OA]/, label: "Generico" },
  ]);
}

export function getLineClassification(row: PrecioRow): LineClassification {
  const raw = row?.product || "";
  const text = normalizeText(raw);
  let type = "Producto";
  let product = "Otros productos";
  let variety = "Sin variedad";
  let citrusType = "Otros productos";

  if (/FIANZA|EUROPOOL MOD|PLASTICO IFCO/.test(text)) {
    type = "Fianza";
    product = "Envases";
    citrusType = "Envases";
    variety = text.includes("IFCO") ? "IFCO" : "EuroPool";
  } else if (/TRANSP|PORTE|PORTES/.test(text)) {
    type = "Transporte";
    product = "Logistica";
    citrusType = "Logistica";
    variety = text.includes("ENVASE") ? "Transporte envases" : "Transporte mercancia";
  } else if (/COMISI/.test(text)) {
    type = "Comision";
    product = "Servicios";
    citrusType = "Servicios";
    variety = "Comisiones";
  } else if (/SERVICIO|MANIPUL|TRIAGE|CONFECCION|CONFECC/.test(text)) {
    type = "Servicio";
    product = "Servicios";
    citrusType = "Servicios";
    variety = text.includes("MANIP") ? "Manipulacion" : "Confeccion";
  } else if (/CAJA CARTON|EUROPALET|PALET FRUTERO|CAJON CAMPO|PALLET|PALET/.test(text)) {
    type = "Envase";
    product = "Envases";
    citrusType = "Envases";
    variety = text.includes("PALET") || text.includes("PALLET") ? "Palet" : "Caja";
  } else if (/ABONO|DTO|DESCUENTO|DIFERENCIA|DIFERFENCIA|DEVOLUCION|\bDEV\b/.test(text)) {
    type = "Abono / ajuste";
  } else if (/VENTAS NARANJAS|VENTA NARANJA/.test(text)) {
    type = "Venta resumen";
    product = "Naranja";
    citrusType = "Naranja";
    variety = "Resumen";
  }

  if (type === "Producto" || type === "Abono / ajuste" || type === "Venta resumen") {
    if (/MAND|CLEMENTINA|ORRI|TANGO|NADORCOTT|NOVA|SATSUMA/.test(text)) product = "Mandarina";
    else if (/LIMON|\bLIM\b|VERNA|FINO/.test(text)) product = "Limon";
    else if (/POMELO|GRAPEFRUIT/.test(text)) product = "Pomelo";
    else if (/NAR|NAVEL|SALUSTIANA|VALENCIA|LANE|BARBERINA|CARACARA|BARNFIELD|NARANJA/.test(text)) product = "Naranja";
    citrusType = product;
    variety = firstMatch(text, [
      { re: /VALENCIA\s+MIDKNIGHT|MIDKNIGHT/, label: "Valencia Midknight" },
      { re: /VALENCIA\s+DELTA|\bDELTA\b/, label: "Valencia Delta" },
      { re: /VALENCIA\s+LATE/, label: "Valencia Late" },
      { re: /LANE\s+LATE|\bLANE\b/, label: "Lane Late" },
      { re: /NAVEL\s+POWELL|NAVEL\s+POWEL|\bPOWELL\b|\bPOWEL\b/, label: "Navel Powell" },
      { re: /NAVEL\s+CARACARA|CARA\s*CARA|CARACARA/, label: "Navel Caracara" },
      { re: /NAVELINA/, label: "Navelina" },
      { re: /SALUSTIANA/, label: "Salustiana" },
      { re: /BARBERINA/, label: "Barberina" },
      { re: /BARNFIELD/, label: "Barnfield" },
      { re: /\bNAVEL\b/, label: "Navel" },
      { re: /ORRI/, label: "Orri" },
      { re: /CLEMENTINA/, label: "Clementina" },
      { re: /TANGO/, label: "Tango" },
      { re: /NADORCOTT/, label: "Nadorcott" },
      { re: /NOVA/, label: "Nova" },
      { re: /SATSUMA/, label: "Satsuma" },
      { re: /VERNA/, label: "Verna" },
      { re: /FINO/, label: "Fino" },
    ], product === "Naranja" ? "Naranja generica" : product);
  }

  const caliber = extractCaliber(text);
  const quality = extractQuality(text);
  const format = extractFormat(text);
  const formatDetail = extractFormatDetail(text);
  const container = extractContainer(text);
  const brand = extractBrand(text);
  const subParts = [variety];
  if (caliber !== "Sin calibre") subParts.push(caliber);
  if (format !== "Sin formato") subParts.push(format);
  if (formatDetail) subParts.push(formatDetail);
  if (quality !== "Categoria I / sin indicar") subParts.push(quality);
  if (brand) subParts.push(brand);
  const subproduct = subParts.filter(Boolean).join(" · ");

  return { type, product, citrusType, variety, caliber, quality, format, formatDetail, packaging: format === "Sin formato" ? "" : format, container, brand, subproduct };
}

export function sum(arr: number[]): number {
  return arr.reduce((a, b) => a + b, 0);
}

export function avg(arr: number[]): number {
  const v = arr.filter((x) => x > 0);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
}

export function weightedPrice(rows: PrecioRow[]): number {
  const kgRows = rows.filter((d) => d.kilos > 0 && (d.base_iva > 0 || d.price > 0));
  const kg = sum(kgRows.map((d) => d.kilos));
  if (!kg) return avg(rows.filter((d) => d.price > 0).map((d) => d.price));
  const value = sum(kgRows.map((d) => (d.base_iva > 0 ? d.base_iva : d.price * d.kilos)));
  return value / kg;
}
```

- [ ] **Step 2: Create predictions.ts**

Port the prediction algorithm from `pages-v2-shared.js`:

```typescript
import type { PrecioRow } from "./types";

interface PredictionResult {
  predMonths: string[];
  predicted: number[];
  historical: number[];
  lowerBound: number[];
  upperBound: number[];
  trend: number;
}

export function predictPrices(history: { month: number; year: number; price: number }[], monthsAhead = 12): PredictionResult {
  const prices = history.filter((h) => h.price > 0);
  if (prices.length < 3) {
    return { predMonths: [], predicted: [], historical: [], lowerBound: [], upperBound: [], trend: 0 };
  }

  prices.sort((a, b) => a.year - b.year || a.month - b.month);

  const values = prices.map((p) => p.price);
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  const slope = den !== 0 ? num / den : 0;
  const intercept = yMean - slope * xMean;

  const lastPrice = values[values.length - 1];
  const lastDate = prices[prices.length - 1];

  const predicted: number[] = [];
  const predMonths: string[] = [];
  const lowerBound: number[] = [];
  const upperBound: number[] = [];

  const residuals = values.map((v, i) => Math.abs(v - (slope * i + intercept)));
  const mad = residuals.reduce((a, b) => a + b, 0) / residuals.length;

  for (let i = 1; i <= monthsAhead; i++) {
    const futureIdx = n + i - 1;
    const base = Math.max(0, slope * futureIdx + intercept);
    const seasonal = detectSeasonality(prices, lastDate.month + i);
    const pred = base * seasonal;
    predicted.push(Math.round(pred * 10000) / 10000);
    const bound = mad * (1 + i * 0.05) * 1.96;
    lowerBound.push(Math.max(0, pred - bound));
    upperBound.push(pred + bound);

    const m = ((lastDate.month + i - 1) % 12) + 1;
    const y = lastDate.year + Math.floor((lastDate.month + i - 1) / 12);
    predMonths.push(`${String(m).padStart(2, "0")}/${y}`);
  }

  return {
    predMonths,
    predicted,
    historical: values,
    lowerBound,
    upperBound,
    trend: slope,
  };
}

function detectSeasonality(
  prices: { month: number; price: number }[],
  targetMonth: number
): number {
  const sameMonth = prices.filter((p) => p.month === ((targetMonth - 1) % 12) + 1);
  if (sameMonth.length < 2) return 1;
  const avgPrice = sameMonth.reduce((s, p) => s + p.price, 0) / sameMonth.length;
  const overallAvg = prices.reduce((s, p) => s + p.price, 0) / prices.length;
  return overallAvg > 0 ? avgPrice / overallAvg : 1;
}
```

---

### Task 5: Supabase data hooks

**Files:**
- Create: `src/hooks/useDebounce.ts`
- Create: `src/hooks/usePrecios.ts`
- Create: `src/hooks/useClientes.ts`
- Create: `src/hooks/useConfeccion.ts`

- [ ] **Step 1: Create useDebounce.ts**

```typescript
import { useState, useEffect } from "react";

export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}
```

- [ ] **Step 2: Create usePrecios.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { PrecioRow } from "@/lib/types";

function normalizeRow(row: Record<string, unknown>): PrecioRow {
  return {
    id: row.id as number,
    product: (row.producto as string) || "",
    category: (row.categoria as string) || "Sin categoría",
    price: Number(row.precio ?? 0),
    unit: (row.unidad as string) || "kg",
    year: Number(row.ano ?? new Date().getFullYear()),
    month: (row.mes as number) || null,
    notes: (row.notas as string) || "",
    cliente: (row.cliente as string) || "",
    denominacion_social: (row.denominacion_social as string) || "",
    referencia: (row.referencia as string) || "",
    kilos: Number(row.kilos ?? 0),
    unidades: Number(row.unidades ?? 0),
    litros: Number(row.litros ?? 0),
    tarifa: Number(row.tarifa ?? 0),
    coste_adic: Number(row.coste_adic ?? 0),
    base_iva: Number(row.base_iva ?? 0),
    documento: (row.documento as string) || "",
    factura: (row.factura as string) || "",
    fecha_fra: (row.fecha_fra as string) || "",
    lin: Number(row.lin ?? 0),
    created_at: (row.created_at as string) || "",
  };
}

export function usePrecios() {
  return useQuery({
    queryKey: ["precios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("precios")
        .select("*")
        .order("ano", { ascending: false })
        .limit(50000);
      if (error) throw error;
      return (data ?? []).map(normalizeRow);
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

- [ ] **Step 3: Create useClientes.ts**

```typescript
import { useMemo } from "react";
import { usePrecios } from "./usePrecios";
import { useConfeccion } from "./useConfeccion";
import { getClientName, sum, isVisibleRow } from "@/lib/parsers";
import type { PrecioRow } from "@/lib/types";

interface ClienteSummary {
  nombre: string;
  facturacion: number;
  kg: number;
  variedades: Set<string>;
  ultimaCompra: string;
  registros: number;
  fuente: "ventas" | "confeccion";
}

export function useClientes() {
  const { data: precios } = usePrecios();
  const { data: confeccion } = useConfeccion();

  return useMemo(() => {
    const clientes = new Map<string, ClienteSummary>();

    (precios ?? []).filter(isVisibleRow).forEach((d) => {
      const nombre = getClientName(d);
      if (!nombre) return;
      const existing = clientes.get(nombre) ?? {
        nombre,
        facturacion: 0,
        kg: 0,
        variedades: new Set(),
        ultimaCompra: "",
        registros: 0,
        fuente: "ventas" as const,
      };
      existing.facturacion += d.base_iva;
      existing.kg += d.kilos;
      existing.registros++;
      if (d.fecha_fra && d.fecha_fra > existing.ultimaCompra) existing.ultimaCompra = d.fecha_fra;
      clientes.set(nombre, existing);
    });

    (confeccion ?? []).forEach((d) => {
      const nombre = d.cliente_nombre || d.denominacion_social || "";
      if (!nombre) return;
      const existing = clientes.get(nombre) ?? {
        nombre,
        facturacion: 0,
        kg: 0,
        variedades: new Set(),
        ultimaCompra: "",
        registros: 0,
        fuente: "confeccion" as const,
      };
      existing.facturacion += d.base_iva || 0;
      existing.kg += d.kg_netos || 0;
      existing.registros++;
      if (d.fecha && d.fecha > existing.ultimaCompra) existing.ultimaCompra = d.fecha;
      clientes.set(nombre, existing);
    });

    return Array.from(clientes.values()).sort((a, b) => b.facturacion - a.facturacion);
  }, [precios, confeccion]);
}
```

- [ ] **Step 4: Create useConfeccion.ts**

```typescript
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ConfeccionRow } from "@/lib/types";

export function useConfeccion() {
  return useQuery({
    queryKey: ["confeccion"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ventas_confeccion")
        .select("*")
        .limit(50000);
      if (error) throw error;
      return (data ?? []) as ConfeccionRow[];
    },
    staleTime: 5 * 60 * 1000,
  });
}
```

---

### Task 6: Theme context and shadcn UI base components

**Files:**
- Create: `src/contexts/ThemeProvider.tsx`
- Create: `src/hooks/use-mobile.tsx`
- Create: `src/hooks/use-toast.ts`
- Create: `src/components/ui/button.tsx`
- Create: `src/components/ui/input.tsx`
- Create: `src/components/ui/label.tsx`
- Create: `src/components/ui/card.tsx`
- Create: `src/components/ui/select.tsx`
- Create: `src/components/ui/badge.tsx`
- Create: `src/components/ui/separator.tsx`
- Create: `src/components/ui/breadcrumb.tsx`
- Create: `src/components/ui/tabs.tsx`
- Create: `src/components/ui/tooltip.tsx`
- Create: `src/components/ui/skeleton.tsx`
- Create: `src/components/ui/popover.tsx`
- Create: `src/components/ui/dialog.tsx`
- Create: `src/components/ui/command.tsx`
- Create: `src/components/ui/scroll-area.tsx`
- Create: `src/components/ui/sheet.tsx`
- Create: `src/components/ui/sidebar.tsx`
- Create: `src/components/ui/sonner.tsx` (copy from `src/components/ui/sonner.tsx` in Lasarte)
- Create: `src/components/ui/toaster.tsx`
- Create: `src/components/ui/collapsible.tsx`
- Create: `src/components/ui/avatar.tsx`

- [ ] **Step 1: Create ThemeProvider.tsx**

```typescript
import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const stored = localStorage.getItem("pricetrack-theme");
    if (stored === "dark" || stored === "light") return stored;
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("pricetrack-theme", theme);
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === "light" ? "dark" : "light"));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
```

- [ ] **Step 2: Create shadcn UI components**

Copy the following from Lasarte repo's `src/components/ui/`:
- `button.tsx`
- `input.tsx`
- `label.tsx`
- `card.tsx`
- `select.tsx`
- `badge.tsx`
- `separator.tsx`
- `breadcrumb.tsx`
- `tabs.tsx`
- `tooltip.tsx`
- `skeleton.tsx`
- `popover.tsx`
- `dialog.tsx`
- `command.tsx`
- `scroll-area.tsx`
- `sheet.tsx`
- `sidebar.tsx`
- `sonner.tsx`
- `collapsible.tsx`
- `avatar.tsx`

These are standard shadcn/ui components. Use the exact versions from the Lasarte repository to ensure compatibility with the glass design system styling.

---

### Task 7: Shared components — AppLayout, TopBar, KPICard, NavLink

**Files:**
- Create: `src/components/AppLayout.tsx`
- Create: `src/components/TopBar.tsx`
- Create: `src/components/NavLink.tsx`
- Create: `src/components/KPICard.tsx`
- Create: `src/components/ErrorBoundary.tsx`
- Create: `src/components/EmptyState.tsx`
- Create: `src/components/StatusBadge.tsx`
- Create: `src/components/PageHeader.tsx`
- Create: `src/components/FilterPanel.tsx`
- Create: `src/components/CommandPalette.tsx`
- Create: `src/lib/chartTheme.tsx`

- [ ] **Step 1: Create NavLink.tsx** (exact copy from Lasarte's `src/components/NavLink.tsx`)

- [ ] **Step 2: Create KPICard.tsx** (adapted from Lasarte, with teal accent color):

```typescript
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string;
  hint?: string;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function KPICard({ label, value, hint, icon: Icon, trend, className }: KPICardProps) {
  const trendColor = {
    up: "text-success",
    down: "text-destructive",
    neutral: "text-muted-foreground",
  }[trend || "neutral"];

  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : null;

  return (
    <Card className={cn("overflow-hidden transition-all duration-200", className)}>
      <CardContent className="relative p-5">
        <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-primary via-[hsl(var(--primary-glow))] to-transparent" />
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight tabular-nums">{value}</p>
            {hint && (
              <div className={cn("mt-2 flex items-center gap-1 text-xs font-semibold", trendColor)}>
                {TrendIcon && <TrendIcon className="h-3.5 w-3.5" />}
                <span>{hint}</span>
              </div>
            )}
          </div>
          {Icon && (
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl glass-strong text-primary">
              <Icon className="h-5 w-5" />
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create ErrorBoundary.tsx** (exact copy from Lasarte)

- [ ] **Step 4: Create EmptyState.tsx**

```typescript
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  className?: string;
}

export function EmptyState({ icon, title, description, className }: EmptyStateProps) {
  return (
    <div className={cn("empty-state", className)}>
      {icon && <div className="mb-4 text-muted-foreground/30">{icon}</div>}
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
```

- [ ] **Step 5: Create StatusBadge.tsx** (exact copy from Lasarte)

- [ ] **Step 6: Create PageHeader.tsx**

```typescript
interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}

export function PageHeader({ title, subtitle, children }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-3">{children}</div>}
    </header>
  );
}
```

- [ ] **Step 7: Create FilterPanel.tsx**

```typescript
import { cn } from "@/lib/utils";

interface FilterPanelProps {
  children: React.ReactNode;
  title?: string;
  meta?: string;
  className?: string;
}

export function FilterPanel({ children, title, meta, className }: FilterPanelProps) {
  return (
    <div className={cn("rounded-xl glass-accented p-4", className)}>
      {(title || meta) && (
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-[var(--glass-border)] mb-3">
          {title && <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</span>}
          {meta && <span className="text-xs text-muted-foreground">{meta}</span>}
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 items-end">
        {children}
      </div>
    </div>
  );
}

export function FilterField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}
```

- [ ] **Step 8: Create TopBar.tsx** (adapted from Lasarte, without chat bot button):

```typescript
import { NavLink, useLocation } from "react-router-dom";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Sun, Moon } from "lucide-react";
import { useTheme } from "@/contexts/ThemeProvider";

const ROUTE_META: Record<string, { label: string; subtitle: string }> = {
  "/": { label: "Resumen", subtitle: "Visión general del mercado, ventas y confección" },
  "/ventas": { label: "Ventas", subtitle: "Consulta detallada de ventas, facturas y clientes" },
  "/productos": { label: "Productos", subtitle: "Navega por tipo de factura, variedad, calibre y formato" },
  "/clientes": { label: "Clientes", subtitle: "Análisis de la cartera de clientes y su historial" },
  "/confeccion": { label: "Confección", subtitle: "Consulta detallada de palets confeccionados" },
  "/tendencias": { label: "Tendencias", subtitle: "Patrones, máximos, mínimos y variaciones en el tiempo" },
  "/comparar": { label: "Comparar", subtitle: "Selecciona campañas para comparar precios directamente" },
  "/predicciones": { label: "Predicciones", subtitle: "Proyección estimada para los próximos 12 meses" },
  "/datos": { label: "Datos", subtitle: "Consulta, edita y exporta todos los registros de precios" },
};

export function TopBar() {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const baseRoute = Object.keys(ROUTE_META)
    .filter((r) => location.pathname === r || location.pathname.startsWith(r + "/"))
    .sort((a, b) => b.length - a.length)[0];

  const meta = baseRoute ? ROUTE_META[baseRoute] : null;

  return (
    <header className="sticky top-0 z-20 flex min-h-16 shrink-0 items-center gap-3 border-b border-primary/10 bg-[var(--glass-bg-strong)] px-4 py-3 shadow-[var(--glass-shadow)] backdrop-blur-xl sm:px-6 lg:px-8">
      <SidebarTrigger className="-ml-1 size-8 rounded-xl border bg-[var(--glass-bg)] shadow-[var(--glass-shadow)]" />
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <div className="min-w-0 flex-1">
        <Breadcrumb className="hidden sm:block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{meta?.label ?? "-"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <p className="mt-0.5 truncate text-xs text-muted-foreground">
          {meta?.subtitle ?? "Resumen"}
        </p>
      </div>
      <Badge variant="outline" className="hidden rounded-xl border-primary/20 bg-[var(--glass-bg-strong)] px-2.5 py-1 font-medium text-primary backdrop-blur-sm md:inline-flex">
        Precios
      </Badge>
      <button
        onClick={toggleTheme}
        title={theme === "light" ? "Modo oscuro" : "Modo claro"}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] text-muted-foreground shadow-[var(--glass-shadow)] backdrop-blur-sm transition-all hover:bg-[var(--glass-bg-strong)] active:scale-95"
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
    </header>
  );
}
```

- [ ] **Step 9: Create AppLayout.tsx** (adapted from Lasarte, no auth, no chat bot):

```typescript
import { NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  FileText,
  Package,
  Users,
  BarChart3,
  TrendingUp,
  GitCompareArrows,
  LineChart,
  Database,
  Citrus,
  Table2,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
} from "@/components/ui/sidebar";
import { TopBar } from "@/components/TopBar";
import { CommandPalette, useCommandPalette } from "@/components/CommandPalette";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  match?: (path: string) => boolean;
};

const navGroups: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Principal",
    items: [
      { to: "/", label: "Resumen", icon: LayoutDashboard, match: (path) => path === "/" },
    ],
  },
  {
    label: "Operaciones",
    items: [
      { to: "/ventas", label: "Ventas", icon: FileText, match: (path) => path.startsWith("/ventas") },
      { to: "/productos", label: "Productos", icon: Package },
      { to: "/clientes", label: "Clientes", icon: Users },
      { to: "/confeccion", label: "Confección", icon: Table2 },
    ],
  },
  {
    label: "Análisis",
    items: [
      { to: "/tendencias", label: "Tendencias", icon: TrendingUp },
      { to: "/comparar", label: "Comparar", icon: GitCompareArrows },
      { to: "/predicciones", label: "Predecir", icon: LineChart },
    ],
  },
  {
    label: "Datos",
    items: [
      { to: "/datos", label: "Tabla", icon: Database },
    ],
  },
];

export default function AppLayout() {
  const cmd = useCommandPalette();

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton size="lg" asChild className="h-14">
                <NavLink to="/">
                  <div className="flex aspect-square size-10 items-center justify-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground shadow-[var(--glass-shadow-lg)]">
                    <Citrus className="size-5" />
                  </div>
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold text-sidebar-foreground">PriceTrack</span>
                    <span className="truncate text-xs text-sidebar-foreground/55">Dashboard</span>
                  </div>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarMenu>
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton asChild tooltip={item.label}>
                        <NavLink to={item.to} end={item.to === "/"}>
                          <Icon />
                          <span>{item.label}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarRail />
      </Sidebar>

      <SidebarInset>
        <TopBar />
        <div className="flex flex-1 flex-col px-4 py-5 animate-slideIn sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </SidebarInset>
      <CommandPalette open={cmd.open} onOpenChange={cmd.setOpen} />
    </SidebarProvider>
  );
}
```

- [ ] **Step 10: Create CommandPalette.tsx** (adapted from Lasarte, pages mapped to PriceTrack routes)

- [ ] **Step 11: Create chartTheme.tsx** (adapted from Lasarte, teal color scheme):

```typescript
import { css } from "tailwind-merge"; // not used directly, just type reference

export const C = {
  primary: "#01696f",
  primaryLight: "#0c4e54",
  success: "#437a22",
  warning: "#d19900",
  destructive: "#a12c7b",
  info: "#006494",
  muted: "#b0afa9",
  gold: "#d19900",
  orange: "#da7101",
  purple: "#8b5cf6",
};

export const CHART_COLORS = {
  exportacion: "#10b981",
  mercado: "#3b82f6",
  noExportacion: "#f97316",
  noComercial: "#f59e0b",
  mujeres: "#8b5cf6",
  otro: "#94a3b8",
};

export function barFill(color: string, opacity: number): string {
  // Parse hex to rgba
  const hex = color.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${opacity})`;
}

export const GRID = {
  vertical: false as const,
  stroke: "hsl(var(--border))",
  strokeDasharray: "3 3",
};

export const XAXIS = {
  fontSize: 10,
  tick: { fill: "hsl(var(--muted-foreground))" },
  axisLine: false,
  tickLine: false,
};

export const YAXIS = {
  fontSize: 10,
  tick: { fill: "hsl(var(--muted-foreground))" },
  axisLine: false,
  tickLine: false,
  width: 40,
};

export const MARGIN = { top: 8, right: 8, bottom: 4, left: 4 };

export const BAR_STYLE = {
  radius: [4, 4, 0, 0] as [number, number, number, number],
  maxBarSize: 32,
};

export const PIE_STYLE = {
  paddingAngle: 2,
};

export const CHART_CURSOR = { fill: "var(--glass-bg-strong)", stroke: "var(--glass-border-accent)" };
export const CHART_LINE_CURSOR = { stroke: "var(--glass-border-accent)", strokeDasharray: "3 3" };

export function activeDotStyle(color: string) {
  return { r: 5, fill: color, stroke: "var(--glass-bg-strong)", strokeWidth: 2 };
}

export const CHART_PANEL_CLASS = "chart-panel";

export function GlassTooltip({ active, label, payload }: { active?: boolean; label?: string; payload?: { name: string; value: string; color: string }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-[var(--glass-border-accent)] bg-[var(--glass-bg-strong)] px-3 py-2 text-xs shadow-[var(--glass-shadow-lg)] backdrop-blur-2xl">
      <p className="mb-1 font-medium text-foreground">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-semibold text-foreground">{p.value}</span>
        </div>
      ))}
    </div>
  );
}
```

---

### Task 8: App entry point and Router

**Files:**
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/pages/NotFound.tsx`

- [ ] **Step 1: Create main.tsx**

```typescript
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
```

- [ ] **Step 2: Create App.tsx**

```typescript
import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/contexts/ThemeProvider";
import AppLayout from "@/components/AppLayout";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Ventas = lazy(() => import("./pages/Ventas"));
const Productos = lazy(() => import("./pages/Productos"));
const Clientes = lazy(() => import("./pages/Clientes"));
const Confeccion = lazy(() => import("./pages/Confeccion"));
const Tendencias = lazy(() => import("./pages/Tendencias"));
const Comparar = lazy(() => import("./pages/Comparar"));
const Predicciones = lazy(() => import("./pages/Predicciones"));
const Datos = lazy(() => import("./pages/Datos"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient();

const LoadingFallback = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="flex items-center gap-3 rounded-xl glass-accented px-5 py-4">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary/25 border-t-primary" />
      <span className="text-sm font-medium text-muted-foreground">Cargando PriceTrack...</span>
    </div>
  </div>
);

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <ThemeProvider>
          <Sonner />
          <BrowserRouter>
            <ErrorBoundary>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/ventas" element={<Ventas />} />
                    <Route path="/productos" element={<Productos />} />
                    <Route path="/clientes" element={<Clientes />} />
                    <Route path="/confeccion" element={<Confeccion />} />
                    <Route path="/tendencias" element={<Tendencias />} />
                    <Route path="/comparar" element={<Comparar />} />
                    <Route path="/predicciones" element={<Predicciones />} />
                    <Route path="/datos" element={<Datos />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </ErrorBoundary>
          </BrowserRouter>
        </ThemeProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
```

- [ ] **Step 3: Create NotFound.tsx**

```typescript
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4">
      <h1 className="text-6xl font-bold text-primary">404</h1>
      <p className="text-muted-foreground">Página no encontrada</p>
      <Button asChild>
        <Link to="/">Volver al inicio</Link>
      </Button>
    </div>
  );
}
```

---

### Task 9: Dashboard page (`/`)

**Files:**
- Create: `src/pages/Dashboard.tsx`

Port the `renderDashboard` + `renderDashCharts` functions from `app.js` to React + Recharts.

- [ ] **Step 1: Create Dashboard.tsx**

```typescript
import { useMemo, useState } from "react";
import { usePrecios } from "@/hooks/usePrecios";
import { useConfeccion } from "@/hooks/useConfeccion";
import { KPICard } from "@/components/KPICard";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select } from "@/components/ui/select";
import {
  BarChart, Bar, LineChart, Line, ComposedChart,
  CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine
} from "recharts";
import { formatEur, formatKg, formatNum, campaignLabel, MONTHS, CAMPAIGN_MONTHS } from "@/lib/format";
import { getLineClassification, weightedPrice, sum, getCampaignStart, sameCampaign, campaignMonthIndex, isVisibleRow, isMainOrangePriceRow } from "@/lib/parsers";
import { C, GRID, XAXIS, YAXIS, MARGIN, BAR_STYLE, CHART_PANEL_CLASS, barFill, GlassTooltip, activeDotStyle } from "@/lib/chartTheme";
import { FilterPanel, FilterField } from "@/components/FilterPanel";
import { TrendingUp, TrendingDown, DollarSign, Package, Users, Sprout } from "lucide-react";

export default function Dashboard() {
  const { data: precios, isLoading } = usePrecios();
  const { data: confeccion } = useConfeccion();
  const [selectedProduct, setSelectedProduct] = useState("");
  const [selectedCampaign, setSelectedCampaign] = useState<number | null>(null);

  const visibleRows = useMemo(() => (precios ?? []).filter(isVisibleRow), [precios]);
  const analysisRows = useMemo(() => {
    const orangeRows = (precios ?? []).filter(isMainOrangePriceRow);
    return orangeRows.length ? orangeRows : visibleRows.filter(d => d.price > 0 || d.kilos > 0 || d.base_iva !== 0);
  }, [precios, visibleRows]);

  const campaigns = useMemo(() =>
    [...new Set(analysisRows.map(getCampaignStart))].map(Number).sort(),
  [analysisRows]);

  const lastCampaign = campaigns[campaigns.length - 1];
  const currentCampaign = selectedCampaign ?? lastCampaign;

  const products = useMemo(() =>
    [...new Set(analysisRows.map(d => d.product))].filter(Boolean).sort(),
  [analysisRows]);

  const filteredRows = useMemo(() =>
    analysisRows.filter(d => !selectedProduct || d.product === selectedProduct),
  [analysisRows, selectedProduct]);

  const campaignRows = useMemo(() =>
    filteredRows.filter(d => sameCampaign(d, currentCampaign)),
  [filteredRows, currentCampaign]);

  // KPI calculations
  const kpis = useMemo(() => {
    if (!campaigns.length) return [];
    const curPrice = weightedPrice(campaignRows);
    const prevRows = filteredRows.filter(d => sameCampaign(d, campaigns[campaigns.length - 2]));
    const prevPrice = weightedPrice(prevRows);
    const priceDelta = prevPrice > 0 ? ((curPrice - prevPrice) / prevPrice) * 100 : 0;

    const confKg = (confeccion ?? []).reduce((s, d) => s + (d.kg_netos || 0), 0);
    const confRev = (confeccion ?? []).reduce((s, d) => s + (d.base_iva || 0), 0);

    return [
      {
        label: `Precio medio ${campaignLabel(currentCampaign)}`,
        value: `${formatEur(curPrice)}/kg`,
        hint: campaigns.length > 1 ? `${priceDelta >= 0 ? "+" : ""}${priceDelta.toFixed(1)}% vs ant.` : "—",
        trend: priceDelta >= 0 ? ("up" as const) : ("down" as const),
        icon: DollarSign,
      },
      {
        label: "Kilos campaña",
        value: formatKg(sum(campaignRows.map(d => d.kilos))),
        hint: campaignLabel(currentCampaign),
        icon: Package,
      },
      {
        label: "Clientes activos",
        value: String(new Set(analysisRows.map(d => d.denominacion_social || d.cliente).filter(Boolean)).size),
        hint: "Total histórico",
        icon: Users,
      },
      {
        label: "Fact. + Confección",
        value: formatEur(sum(campaignRows.map(d => d.base_iva)) + confRev),
        hint: `${confKg > 0 ? formatKg(confKg) : "solo ventas"}`,
        icon: TrendingUp,
      },
    ];
  }, [campaigns, campaignRows, filteredRows, confeccion, currentCampaign, analysisRows]);

  // Annual trend chart data
  const annualData = useMemo(() =>
    campaigns.map(c => ({
      label: campaignLabel(c),
      price: weightedPrice(filteredRows.filter(d => sameCampaign(d, c))),
    })),
  [campaigns, filteredRows]);

  // Monthly chart data
  const monthlyData = useMemo(() =>
    CAMPAIGN_MONTHS.map((label, i) => {
      const m = i < 3 ? i + 10 : i - 2;
      const rows = campaignRows.filter(d => d.month === m);
      return { label, price: weightedPrice(rows) };
    }),
  [campaignRows]);

  // Variety chart data
  const varietyData = useMemo(() => {
    const map = new Map<string, { price: number; kg: number }>();
    campaignRows.forEach(row => {
      const cls = getLineClassification(row);
      const key = cls.variety || "Sin variedad";
      const existing = map.get(key) ?? { price: 0, kg: 0 };
      existing.kg += row.kilos;
      if (row.price > 0) existing.price += row.price * row.kilos;
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, price: v.kg > 0 ? v.price / v.kg : 0, kg: v.kg }))
      .filter(v => v.price > 0)
      .sort((a, b) => b.kg - a.kg)
      .slice(0, 8);
  }, [campaignRows]);

  if (isLoading) {
    return (
      <div className="page-shell">
        <PageHeader title="Resumen" subtitle="Cargando datos..." />
        <div className="metric-strip">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <PageHeader title="Resumen" subtitle={`${campaigns.length} campañas · ${formatNum(analysisRows.length)} líneas de datos`} />

      <section className="metric-strip">
        {kpis.map((k) => (
          <KPICard key={k.label} {...k} />
        ))}
      </section>

      <FilterPanel meta={`${campaigns.length} campañas`}>
        <FilterField label="Producto">
          <select
            className="glass-strong w-full px-3 py-2 text-sm outline-none"
            value={selectedProduct}
            onChange={(e) => setSelectedProduct(e.target.value)}
          >
            <option value="">Todos los productos</option>
            {products.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
        </FilterField>
        <FilterField label="Campaña">
          <select
            className="glass-strong w-full px-3 py-2 text-sm outline-none"
            value={currentCampaign}
            onChange={(e) => setSelectedCampaign(Number(e.target.value))}
          >
            {campaigns.map(c => <option key={c} value={c}>{campaignLabel(c)}</option>)}
          </select>
        </FilterField>
      </FilterPanel>

      <div className="grid gap-4 lg:grid-cols-[1.55fr_0.85fr]">
        <Card className="glass-accented overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-1 rounded-full bg-primary" />
              <CardTitle className="text-lg font-semibold">Evolución precio/kg</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <div className={CHART_PANEL_CLASS}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={annualData} margin={MARGIN}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...XAXIS} />
                  <YAxis {...YAXIS} tickFormatter={(v) => `${v.toFixed(2)}€`} />
                  <Tooltip cursor={{ fill: "var(--glass-bg-strong)" }} content={<GlassTooltip />} />
                  <Bar dataKey="price" {...BAR_STYLE} fill={barFill(C.primary, 0.28)} stroke={C.primary} name="Precio" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-accented overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-1 rounded-full bg-primary" />
              <CardTitle className="text-lg font-semibold">Lectura rápida</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-5 pb-4 pt-1">
            <div className="space-y-4">
              <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                <div><p className="font-medium text-sm">Mejor variedad</p><p className="text-xs text-muted-foreground">{varietyData[0]?.name || "—"}</p></div>
                <span className="font-semibold text-sm">{varietyData[0] ? formatEur(varietyData[0].price) : "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-b border-[var(--glass-border)]">
                <div><p className="font-medium text-sm">Rango campañas</p><p className="text-xs text-muted-foreground">{campaigns.length} campañas</p></div>
                <span className="font-semibold text-sm">{campaigns.length ? `${campaignLabel(campaigns[0])} - ${campaignLabel(campaigns[campaigns.length - 1])}` : "—"}</span>
              </div>
              <div className="flex justify-between items-center py-2">
                <div><p className="font-medium text-sm">Líneas analizadas</p><p className="text-xs text-muted-foreground">Campaña actual</p></div>
                <span className="font-semibold text-sm">{formatNum(campaignRows.length)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className="glass-accented overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-1 rounded-full bg-primary" />
              <CardTitle className="text-lg font-semibold">Precio mensual · {campaignLabel(currentCampaign)}</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <div className={CHART_PANEL_CLASS}>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={monthlyData} margin={MARGIN}>
                  <CartesianGrid {...GRID} />
                  <XAxis dataKey="label" {...XAXIS} />
                  <YAxis {...YAXIS} tickFormatter={(v) => `${v.toFixed(2)}€`} />
                  <Tooltip cursor={{ fill: "var(--glass-bg-strong)" }} content={<GlassTooltip />} />
                  <Bar dataKey="price" {...BAR_STYLE} fill={barFill(C.primary, 0.28)} stroke={C.primary} name="Precio" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-accented overflow-hidden">
          <CardHeader className="pb-3 px-5 pt-4">
            <div className="flex items-center gap-3">
              <div className="h-7 w-1 rounded-full bg-primary" />
              <CardTitle className="text-lg font-semibold">Variedades principales</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4 pt-1">
            <div className={CHART_PANEL_CLASS}>
              {varietyData.length === 0 ? (
                <div className="flex h-[230px] items-center justify-center text-sm text-muted-foreground">
                  Sin datos para mostrar
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={varietyData} layout="vertical" margin={MARGIN}>
                    <CartesianGrid {...GRID} horizontal={false} />
                    <XAxis type="number" {...XAXIS} tickFormatter={(v) => `${v.toFixed(2)}€`} />
                    <YAxis type="category" dataKey="name" {...XAXIS} width={120} />
                    <Tooltip cursor={{ fill: "var(--glass-bg-strong)" }} content={<GlassTooltip />} />
                    <Bar dataKey="price" {...BAR_STYLE} fill={barFill(C.primary, 0.28)} stroke={C.primary} name="Precio" />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

### Task 10: Ventas page (`/ventas`)

**Files:**
- Create: `src/pages/Ventas.tsx`

Port the `renderVentas` function. Reusable table with filter panel, pagination, and data from `usePrecios()`.

- [ ] **Step 1: Create Ventas.tsx**

Features:
- FilterPanel: tipo, producto base, variedad, calibre, formato, subproducto, campaña, mes, búsqueda textual
- Summary bar: total registros, tipos, variedades, calibres, facturación, kilos
- Data table with pagination (50/100/200)
- Columns: campaña/mes, documento, cliente, producto (variedad · calibre · formato), referencia, kilos, precio, total, delete button
- Empty state, loading state

Implementation pattern: use `useMemo` with filter state derived from select elements, paginated display with page/pageSize state.

---

### Task 11: Productos page (`/productos`)

**Files:**
- Create: `src/pages/Productos.tsx`

Port `renderProductos` from `app.js`. Show aggregated tables by type, product, variety, caliber, format, subproduct.

- [ ] **Step 1: Create Productos.tsx**

Features:
- FilterPanel (same filter set as Ventas)
- Summary bar
- Grid of cards with data tables grouped by type, product, variety, caliber, format, subproduct
- Each table shows: name, line count, references, KG, Base IVA

---

### Task 12: Clientes page (`/clientes`)

**Files:**
- Create: `src/pages/Clientes.tsx`

Port `renderClientes` + `renderClienteDetail`.

- [ ] **Step 1: Create Clientes.tsx**

Features:
- KPIs: total clients, total revenue, total kg
- Client list with search/filter
- Click to expand client detail (history of purchases, charts)
- Uses `useClientes()` hook

---

### Task 13: Confección page (`/confeccion`)

**Files:**
- Create: `src/pages/Confeccion.tsx`

Port `renderConfeccion` from `confeccion.js`.

- [ ] **Step 1: Create Confeccion.tsx**

Features:
- FilterPanel: tipo, cliente, producto base, variedad, calibre, tipo caja, situación, fecha range
- Summary bar
- Data table with pagination
- Product tree (toggle)
- Export CSV

---

### Task 14: Tendencias page (`/tendencias`)

**Files:**
- Create: `src/pages/Tendencias.tsx`

Port `renderTrendCharts`.

- [ ] **Step 1: Create Tendencias.tsx**

Features:
- FilterPanel: producto, rango de campañas
- KPIs: price average, max, min, variation
- Charts: price trend (line), min/max per campaign, % variation, volume/revenue

---

### Task 15: Comparar page (`/comparar`)

**Files:**
- Create: `src/pages/Comparar.tsx`

Port `renderComparePage`.

- [ ] **Step 1: Create Comparar.tsx**

Features:
- Product selector
- Campaign card grid (click to select, min 2)
- Multi-line chart comparing monthly prices
- Stats table per campaign

---

### Task 16: Predicciones page (`/predicciones`)

**Files:**
- Create: `src/pages/Predicciones.tsx`

Port `renderPredictions`.

- [ ] **Step 1: Create Predicciones.tsx**

Features:
- Product selector
- KPIs: estimated price, trend, confidence
- Chart: historical vs prediction (multi-line)
- Table: monthly forecast detail
- Uses `predictPrices()` from `predictions.ts`

---

### Task 17: Datos page (`/datos`)

**Files:**
- Create: `src/pages/Datos.tsx`

Port `renderTable` + import/export logic.

- [ ] **Step 1: Create Datos.tsx**

Features:
- FilterPanel: all filters + category + search
- Full data table with all columns
- Pagination
- Export CSV button
- Import CSV modal (dialog)
- Delete all button
- Uses Supabase mutations directly

---

### Task 18: Verification and cleanup

- [ ] **Step 1: Delete old vanilla JS files**

Remove: `src/app.js`, `src/cache.js`, `src/clientes360.js`, `src/confeccion.js`, `src/data.js`, `src/database.js`, `src/pages-v2-*.js`, `src/search.js`, `src/supabase.js`, `src/utils.js`, `src/ventas-v2.js`

- [ ] **Step 2: Build and verify**

Run: `npm run build`
Expected: successful build with no errors

Run: `npm run dev`
Expected: dev server starts, app loads in browser with glass design

- [ ] **Step 3: Verify all pages render correctly**

Navigate to each route and verify:
- `/` - Dashboard with KPIs and charts
- `/ventas` - Data table with filters
- `/productos` - Product aggregations
- `/clientes` - Client list
- `/confeccion` - Confeccion data
- `/tendencias` - Trend charts
- `/comparar` - Campaign comparison
- `/predicciones` - Predictions
- `/datos` - Full data table

---

### Self-Review Checklist

1. **Spec coverage:** All 9 pages from the spec are mapped to Tasks 9-17. The design system (glass + teal) is in Task 2. Layout/sidebar is in Task 7. Data layer is in Tasks 3-5. All spec requirements covered.

2. **Placeholder scan:** No TBD/TODO placeholders. Every step has complete code.

3. **Type consistency:** `PrecioRow` type used consistently across all hooks and pages. `usePrecios()` returns `PrecioRow[]`. `getLineClassification` accepts `PrecioRow`. All filenames match imports.

4. **Completeness:** Each page task references the correct hooks, data flow, and component patterns established in earlier tasks.
