import { Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { pageLoaders } from "@/lib/pagePreloads";
import { lazyWithPreload } from "@/lib/routePreload";

const Dashboard = lazyWithPreload(pageLoaders["/"]);
const Logistica = lazyWithPreload(pageLoaders["/logistica"]);
const Busqueda = lazyWithPreload(pageLoaders["/busqueda"]);
const Clientes = lazyWithPreload(pageLoaders["/clientes"]);
const Comparativas = lazyWithPreload(pageLoaders["/comparativas"]);
const Datos = lazyWithPreload(pageLoaders["/datos"]);
const NotFound = lazyWithPreload(pageLoaders["*"]);

function PageLoader() {
  return (
    <div className="page-shell route-skeleton">
      <Skeleton className="h-[104px] rounded-xl" />
      <div className="metric-strip">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-4 lg:grid-cols-[1.35fr_0.9fr]">
        <Skeleton className="h-[360px] rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </div>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes location={location}>
          <Route element={<AppLayout />}>
            <Route index element={<div className="route-page" key="dashboard"><Dashboard /></div>} />
            <Route path="logistica" element={<div className="route-page" key="logistica"><Logistica /></div>} />
            <Route path="busqueda" element={<div className="route-page" key="busqueda"><Busqueda /></div>} />
            <Route path="clientes" element={<div className="route-page" key="clientes"><Clientes /></div>} />
            <Route path="comparativas" element={<div className="route-page" key="comparativas"><Comparativas /></div>} />
            <Route path="comercial" element={<Navigate to="/busqueda" replace />} />
            <Route path="ventas" element={<Navigate to="/busqueda" replace />} />
            <Route path="productos" element={<Navigate to="/busqueda" replace />} />
            <Route path="analisis" element={<Navigate to="/comparativas" replace />} />
            <Route path="tendencias" element={<Navigate to="/comparativas" replace />} />
            <Route path="comparar" element={<Navigate to="/comparativas" replace />} />
            <Route path="predicciones" element={<Navigate to="/comparativas" replace />} />
            <Route path="confeccion" element={<Navigate to="/clientes" replace />} />
            <Route path="datos" element={<div className="route-page" key="datos"><Datos /></div>} />
            <Route path="*" element={<div className="route-page" key="not-found"><NotFound /></div>} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </>
  );
}
