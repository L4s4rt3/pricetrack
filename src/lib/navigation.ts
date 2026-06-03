export type NavigationIconId =
  | "dashboard"
  | "logistics"
  | "search"
  | "clients"
  | "compare"
  | "data";

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
    subtitle: "Ultimos 6 meses y senales clave",
    icon: "dashboard",
  },
  {
    to: "/logistica",
    label: "Logistica",
    subtitle: "CMR, hojas de ruta, clientes y transportistas",
    icon: "logistics",
  },
  {
    to: "/busqueda",
    label: "Busqueda",
    subtitle: "Consulta por texto o filtros sin cargar historico",
    icon: "search",
  },
  {
    to: "/clientes",
    label: "Clientes",
    subtitle: "Base comercial 360 y evolucion por cliente",
    icon: "clients",
  },
  {
    to: "/comparativas",
    label: "Comparativas",
    subtitle: "Campanas, meses, productos y clientes",
    icon: "compare",
  },
  {
    to: "/datos",
    label: "Datos",
    subtitle: "Importar, modificar, exportar y borrar",
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
