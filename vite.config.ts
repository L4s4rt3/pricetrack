import { defineConfig, type PluginOption } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "node:path";

const appRoutes = new Set([
  "/comercial",
  "/logistica",
  "/analisis",
  "/ventas",
  "/productos",
  "/clientes",
  "/confeccion",
  "/tendencias",
  "/comparar",
  "/predicciones",
  "/datos",
]);

function spaRouteFallback(): PluginOption {
  const rewrite = (req: { url?: string }, _res: unknown, next: () => void) => {
    const requestUrl = req.url ?? "";
    const [pathname, query] = requestUrl.split("?");

    if (appRoutes.has(pathname)) {
      req.url = `/index.html${query ? `?${query}` : ""}`;
    }

    next();
  };

  return {
    name: "spa-route-fallback",
    configureServer(server) {
      server.middlewares.use(rewrite);
    },
    configurePreviewServer(server) {
      server.middlewares.use(rewrite);
    },
  };
}

export default defineConfig({
  plugins: [spaRouteFallback(), react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    rollupOptions: {
      output: {
        manualChunks: {
          react: ["react", "react-dom", "react-router-dom"],
          charts: ["recharts"],
          pdf: ["pdf-lib"],
          query: ["@tanstack/react-query"],
          supabase: ["@supabase/supabase-js"],
          ui: [
            "@radix-ui/react-avatar",
            "@radix-ui/react-collapsible",
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-label",
            "@radix-ui/react-popover",
            "@radix-ui/react-scroll-area",
            "@radix-ui/react-select",
            "@radix-ui/react-separator",
            "@radix-ui/react-slot",
            "@radix-ui/react-switch",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
            "@radix-ui/react-tooltip",
            "cmdk",
            "lucide-react",
            "sonner",
          ],
        },
      },
    },
  },
});
