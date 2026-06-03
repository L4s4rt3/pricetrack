import type { ComponentType } from "react";

const pageImports = {
  "/": () => import("@/pages/Dashboard"),
  "/logistica": () => import("@/pages/Logistica"),
  "/busqueda": () => import("@/pages/Busqueda"),
  "/clientes": () => import("@/pages/Clientes"),
  "/comparativas": () => import("@/pages/Comparar"),
  "/datos": () => import("@/pages/Datos"),
  "*": () => import("@/pages/NotFound"),
} satisfies Record<string, () => Promise<{ default: ComponentType<unknown> }>>;

export const pageLoaders = pageImports;
export const pagePreloaders = Object.values(pageImports);
export const criticalPagePreloaders = [pageImports["/"]];

export function preloadPage(pathname: string) {
  const cleanPath = pathname === "/" ? "/" : `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  const load = pageImports[cleanPath as keyof typeof pageImports];
  return load?.().catch(() => undefined);
}
