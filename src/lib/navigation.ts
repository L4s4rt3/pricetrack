export type NavigationIconId =
  | "dashboard"
  | "commercial"
  | "logistics"
  | "analytics"
  | "data"
  | "sales"
  | "products"
  | "clients"
  | "trends"
  | "compare"
  | "predictions";

export type NavigationItem = {
  to: string;
  label: string;
  subtitle: string;
  icon: NavigationIconId;
  children?: NavigationItem[];
};

export const navigationSections = [
  {
    to: "/",
    label: "Dashboard",
    subtitle: "Vision general del negocio",
    icon: "dashboard",
  },
  {
    to: "/comercial",
    label: "Comercial",
    subtitle: "Ventas, productos, clientes y trazabilidad",
    icon: "commercial",
    children: [
      { to: "/ventas", label: "Ventas", subtitle: "Consulta detallada de ventas, facturas y clientes", icon: "sales" },
      { to: "/productos", label: "Productos", subtitle: "Navega por tipo de factura, variedad, calibre y formato", icon: "products" },
      { to: "/clientes", label: "Clientes", subtitle: "Analisis de la cartera de clientes y su historial", icon: "clients" },
    ],
  },
  {
    to: "/logistica",
    label: "Logistica",
    subtitle: "Expediciones, transporte y control operativo",
    icon: "logistics",
  },
  {
    to: "/analisis",
    label: "Analisis",
    subtitle: "Tendencias, comparativas y predicciones",
    icon: "analytics",
    children: [
      { to: "/tendencias", label: "Tendencias", subtitle: "Patrones, maximos, minimos y variaciones en el tiempo", icon: "trends" },
      { to: "/comparar", label: "Comparar", subtitle: "Selecciona campanas para comparar precios directamente", icon: "compare" },
      { to: "/predicciones", label: "Predicciones", subtitle: "Proyeccion estimada para los proximos 12 meses", icon: "predictions" },
    ],
  },
  {
    to: "/datos",
    label: "Datos",
    subtitle: "Consulta, edita y exporta todos los registros de precios",
    icon: "data",
  },
] satisfies NavigationItem[];

export function flattenNavigationItems(items: readonly NavigationItem[] = navigationSections): NavigationItem[] {
  return items.flatMap((item) => [item, ...(item.children ? flattenNavigationItems(item.children) : [])]);
}

export function isNavigationRouteActive(pathname: string, route: string) {
  if (route === "/") return pathname === "/";
  return pathname === route || pathname.startsWith(`${route}/`);
}

export function findNavigationTrail(pathname: string, items: readonly NavigationItem[] = navigationSections): NavigationItem[] {
  for (const item of items) {
    if (item.children) {
      const childTrail = findNavigationTrail(pathname, item.children);
      if (childTrail.length > 0) return [item, ...childTrail];
    }

    if (isNavigationRouteActive(pathname, item.to)) return [item];
  }

  return [];
}
