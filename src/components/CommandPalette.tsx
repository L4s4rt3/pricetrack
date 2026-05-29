import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BarChart3, Database, FileText, GitCompareArrows, LayoutDashboard, LineChart, Package, Table2, TrendingUp, Users } from "lucide-react";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";

const pages = [
  { label: "Resumen", path: "/", icon: LayoutDashboard },
  { label: "Ventas", path: "/ventas", icon: FileText },
  { label: "Productos", path: "/productos", icon: Package },
  { label: "Clientes", path: "/clientes", icon: Users },
  { label: "Confeccion", path: "/confeccion", icon: Table2 },
  { label: "Tendencias", path: "/tendencias", icon: TrendingUp },
  { label: "Comparar", path: "/comparar", icon: GitCompareArrows },
  { label: "Predicciones", path: "/predicciones", icon: LineChart },
  { label: "Datos", path: "/datos", icon: Database },
  { label: "Analisis", path: "/tendencias", icon: BarChart3 },
];

export function useCommandPalette() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "k" && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return { open, setOpen };
}

export function CommandPalette({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const navigate = useNavigate();

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput placeholder="Buscar pagina o accion..." />
      <CommandList>
        <CommandEmpty>No se encontraron resultados.</CommandEmpty>
        <CommandGroup heading="Navegacion">
          {pages.map((page) => {
            const Icon = page.icon;
            return (
              <CommandItem
                key={`${page.label}-${page.path}`}
                value={page.label}
                onSelect={() => {
                  navigate(page.path);
                  onOpenChange(false);
                }}
              >
                <Icon className="h-4 w-4" />
                <span>{page.label}</span>
              </CommandItem>
            );
          })}
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
