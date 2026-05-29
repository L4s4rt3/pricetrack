import { useMemo } from "react";
import { usePrecios } from "./usePrecios";
import { useConfeccion } from "./useConfeccion";
import { getClientName, isVisibleRow } from "@/lib/parsers";
import type { PrecioRow } from "@/lib/types";

interface ClienteSummary {
  nombre: string;
  facturacion: number;
  kg: number;
  ultimaCompra: string;
  registros: number;
  fuente: "ventas" | "confeccion";
}

export function useClientes() {
  const { data: precios } = usePrecios();
  const { data: confeccion } = useConfeccion();

  return useMemo(() => {
    const clientes = new Map<string, ClienteSummary>();

    (precios ?? []).filter(isVisibleRow).forEach((d) => {
      const nombre = getClientName(d);
      if (!nombre) return;
      const existing = clientes.get(nombre) ?? {
        nombre,
        facturacion: 0,
        kg: 0,
        ultimaCompra: "",
        registros: 0,
        fuente: "ventas" as const,
      };
      existing.facturacion += d.base_iva;
      existing.kg += d.kilos;
      existing.registros++;
      if (d.fecha_fra && d.fecha_fra > existing.ultimaCompra) existing.ultimaCompra = d.fecha_fra;
      clientes.set(nombre, existing);
    });

    (confeccion ?? []).forEach((d) => {
      const nombre = d.cliente_nombre || d.denominacion_social || "";
      if (!nombre) return;
      const existing = clientes.get(nombre) ?? {
        nombre,
        facturacion: 0,
        kg: 0,
        ultimaCompra: "",
        registros: 0,
        fuente: "confeccion" as const,
      };
      existing.facturacion += d.pvp_total || 0;
      existing.kg += d.kg_netos || 0;
      existing.registros++;
      if (d.fecha && d.fecha > existing.ultimaCompra) existing.ultimaCompra = d.fecha;
      clientes.set(nombre, existing);
    });

    return Array.from(clientes.values()).sort((a, b) => b.facturacion - a.facturacion);
  }, [precios, confeccion]);
}
