import { lazy, Suspense } from "react";
import { Route, Routes } from "react-router-dom";
import AppLayout from "@/components/AppLayout";
import { Toaster } from "@/components/ui/sonner";
import { Skeleton } from "@/components/ui/skeleton";

const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Ventas = lazy(() => import("@/pages/Ventas"));
const Productos = lazy(() => import("@/pages/Productos"));
const Clientes = lazy(() => import("@/pages/Clientes"));
const Confeccion = lazy(() => import("@/pages/Confeccion"));
const Tendencias = lazy(() => import("@/pages/Tendencias"));
const Comparar = lazy(() => import("@/pages/Comparar"));
const Predicciones = lazy(() => import("@/pages/Predicciones"));
const Datos = lazy(() => import("@/pages/Datos"));
const NotFound = lazy(() => import("@/pages/NotFound"));

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
  return (
    <>
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<Suspense fallback={<PageLoader />}><Dashboard /></Suspense>} />
          <Route path="ventas" element={<Suspense fallback={<PageLoader />}><Ventas /></Suspense>} />
          <Route path="productos" element={<Suspense fallback={<PageLoader />}><Productos /></Suspense>} />
          <Route path="clientes" element={<Suspense fallback={<PageLoader />}><Clientes /></Suspense>} />
          <Route path="confeccion" element={<Suspense fallback={<PageLoader />}><Confeccion /></Suspense>} />
          <Route path="tendencias" element={<Suspense fallback={<PageLoader />}><Tendencias /></Suspense>} />
          <Route path="comparar" element={<Suspense fallback={<PageLoader />}><Comparar /></Suspense>} />
          <Route path="predicciones" element={<Suspense fallback={<PageLoader />}><Predicciones /></Suspense>} />
          <Route path="datos" element={<Suspense fallback={<PageLoader />}><Datos /></Suspense>} />
          <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFound /></Suspense>} />
        </Route>
      </Routes>
      <Toaster position="top-right" richColors />
    </>
  );
}
