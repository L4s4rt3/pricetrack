import { useLocation } from "react-router-dom";
import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage } from "@/components/ui/breadcrumb";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Badge } from "@/components/ui/badge";
import { Activity, Command, Moon, Search, Sun } from "lucide-react";
import { useTheme } from "@/contexts/ThemeProvider";

const ROUTE_META: Record<string, { label: string; subtitle: string }> = {
  "/": { label: "Dashboard", subtitle: "Vision general del negocio" },
  "/comercial": { label: "Comercial", subtitle: "Ventas, productos, clientes y trazabilidad" },
  "/logistica": { label: "Logistica", subtitle: "Expediciones, transporte y control operativo" },
  "/analisis": { label: "Analisis", subtitle: "Tendencias, comparativas y predicciones" },
  "/ventas": { label: "Ventas", subtitle: "Consulta detallada de ventas, facturas y clientes" },
  "/productos": { label: "Productos", subtitle: "Navega por tipo de factura, variedad, calibre y formato" },
  "/clientes": { label: "Clientes", subtitle: "Analisis de la cartera de clientes y su historial" },
  "/tendencias": { label: "Tendencias", subtitle: "Patrones, maximos, minimos y variaciones en el tiempo" },
  "/comparar": { label: "Comparar", subtitle: "Selecciona campanas para comparar precios directamente" },
  "/predicciones": { label: "Predicciones", subtitle: "Proyeccion estimada para los proximos 12 meses" },
  "/datos": { label: "Datos", subtitle: "Consulta, edita y exporta todos los registros de precios" },
};

export function TopBar({ onCommandOpen }: { onCommandOpen?: () => void }) {
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  const baseRoute = Object.keys(ROUTE_META)
    .filter((route) => location.pathname === route || location.pathname.startsWith(route + "/"))
    .sort((a, b) => b.length - a.length)[0];
  const meta = baseRoute ? ROUTE_META[baseRoute] : null;

  return (
    <header className="topbar-glass z-20 flex min-h-16 shrink-0 items-center gap-3 px-4 py-3 sm:px-6 lg:px-8">
      <SidebarTrigger className="-ml-1 size-9 rounded-lg border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] shadow-[var(--glass-shadow)]" />
      <Separator orientation="vertical" className="hidden h-6 sm:block" />
      <div className="topbar-route min-w-0 flex-1">
        <Breadcrumb className="block">
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbPage>{meta?.label ?? "-"}</BreadcrumbPage>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>
        <p className="mt-0.5 hidden truncate text-xs text-muted-foreground sm:block">{meta?.subtitle ?? "Resumen"}</p>
      </div>
      <button
        onClick={onCommandOpen}
        className="command-search hidden h-9 min-w-[260px] items-center justify-between gap-3 rounded-lg px-3 text-sm leading-none text-muted-foreground lg:flex"
      >
        <span className="flex min-w-0 items-center gap-2"><Search className="h-4 w-4 shrink-0" /> Buscar</span>
        <span className="inline-flex h-6 min-w-9 shrink-0 items-center justify-center gap-1 rounded-md border border-[hsl(var(--glass-border))] bg-[hsl(var(--card)/0.45)] px-1.5 text-[10px] font-semibold leading-none"><Command className="h-3 w-3 shrink-0" /> K</span>
      </button>
      <Badge variant="outline" className="topbar-live hidden rounded-xl px-2.5 py-1 font-medium md:inline-flex">
        <Activity className="mr-1.5 h-3.5 w-3.5" />
        2019/20+
      </Badge>
      <button
        onClick={toggleTheme}
        title={theme === "light" ? "Modo oscuro" : "Modo claro"}
        className="flex h-8 w-8 items-center justify-center rounded-xl border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))] text-muted-foreground shadow-[var(--glass-shadow)] backdrop-blur-sm transition-all hover:bg-[hsl(var(--glass-bg-strong))] active:scale-95"
      >
        {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </button>
    </header>
  );
}
