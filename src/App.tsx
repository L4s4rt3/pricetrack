import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { pageLoaders, pagePreloaders } from "@/lib/pagePreloads";
import { lazyWithPreload, scheduleRoutePreload } from "@/lib/routePreload";

const Dashboard = lazyWithPreload(pageLoaders["/"]);
const Comercial = lazyWithPreload(pageLoaders["/comercial"]);
const Logistica = lazyWithPreload(pageLoaders["/logistica"]);
const Analisis = lazyWithPreload(pageLoaders["/analisis"]);
const Ventas = lazyWithPreload(pageLoaders["/ventas"]);
const Productos = lazyWithPreload(pageLoaders["/productos"]);
const Clientes = lazyWithPreload(pageLoaders["/clientes"]);
const Tendencias = lazyWithPreload(pageLoaders["/tendencias"]);
const Comparar = lazyWithPreload(pageLoaders["/comparar"]);
const Predicciones = lazyWithPreload(pageLoaders["/predicciones"]);
const Datos = lazyWithPreload(pageLoaders["/datos"]);
const NotFound = lazyWithPreload(pageLoaders["*"]);

function PageLoader() {
  return (
    <div className="page-shell">
      <Skeleton className="h-24 rounded-xl" />
      <div className="metric-strip">
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-80 rounded-xl" />
    </div>
  );
}

export default function App() {
  const location = useLocation();

  useEffect(() => {
    scheduleRoutePreload(pagePreloaders);
  }, []);

  return (
    <>
      <Suspense fallback={<PageLoader />}>
        <Routes location={location}>
          <Route element={<AppLayout />}>
            <Route index element={<div className="route-page" key="dashboard"><Dashboard /></div>} />
            <Route path="comercial" element={<div className="route-page" key="comercial"><Comercial /></div>} />
            <Route path="logistica" element={<div className="route-page" key="logistica"><Logistica /></div>} />
            <Route path="analisis" element={<div className="route-page" key="analisis"><Analisis /></div>} />
            <Route path="ventas" element={<div className="route-page" key="ventas"><Ventas /></div>} />
            <Route path="productos" element={<div className="route-page" key="productos"><Productos /></div>} />
            <Route path="clientes" element={<div className="route-page" key="clientes"><Clientes /></div>} />
            <Route path="confeccion" element={<Navigate to="/comercial" replace />} />
            <Route path="tendencias" element={<div className="route-page" key="tendencias"><Tendencias /></div>} />
            <Route path="comparar" element={<div className="route-page" key="comparar"><Comparar /></div>} />
            <Route path="predicciones" element={<div className="route-page" key="predicciones"><Predicciones /></div>} />
            <Route path="datos" element={<div className="route-page" key="datos"><Datos /></div>} />
            <Route path="*" element={<div className="route-page" key="not-found"><NotFound /></div>} />
          </Route>
        </Routes>
      </Suspense>
      <Toaster position="top-right" richColors />
    </>
  );
}
