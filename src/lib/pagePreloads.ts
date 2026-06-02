const pageImports = {
  "/": () => import("@/pages/Dashboard"),
  "/comercial": () => import("@/pages/Comercial"),
  "/logistica": () => import("@/pages/Logistica"),
  "/analisis": () => import("@/pages/Analisis"),
  "/ventas": () => import("@/pages/Ventas"),
  "/productos": () => import("@/pages/Productos"),
  "/clientes": () => import("@/pages/Clientes"),
  "/tendencias": () => import("@/pages/Tendencias"),
  "/comparar": () => import("@/pages/Comparar"),
  "/predicciones": () => import("@/pages/Predicciones"),
  "/datos": () => import("@/pages/Datos"),
  "*": () => import("@/pages/NotFound"),
} satisfies Record<string, () => Promise<{ default: ComponentType<unknown> }>>;

export const pageLoaders = pageImports;
export const pagePreloaders = Object.values(pageImports);
export const criticalPagePreloaders = [
  pageImports["/comercial"],
  pageImports["/analisis"],
  pageImports["/datos"],
];

export function preloadPage(pathname: string) {
  const cleanPath = pathname === "/" ? "/" : `/${pathname.split("/").filter(Boolean)[0] ?? ""}`;
  const load = pageImports[cleanPath as keyof typeof pageImports];
  return load?.().catch(() => undefined);
}
import type { ComponentType } from "react";
