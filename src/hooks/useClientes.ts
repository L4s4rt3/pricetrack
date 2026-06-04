import { useMemo } from "react";
import { usePrecios } from "./usePrecios";
import { useConfeccion } from "./useConfeccion";
import { getClientName, getLineClassification, isCountableSaleRow, isVisibleRow, saleLineValue } from "@/lib/parsers";
import type { ConfeccionRow, PrecioRow } from "@/lib/types";

interface ClienteSummary {
  nombre: string;
  facturacion: number;
  kg: number;
  ventasRegistros: number;
  confeccionKg: number;
  confeccionValor: number;
  confeccionRegistros: number;
  ultimaCompra: string;
  registros: number;
  fuente: "ventas" | "confeccion" | "ambas";
}

function saleNaturalKey(row: PrecioRow) {
  return [
    row.documento,
    row.factura,
    row.lin,
    row.referencia,
    row.product,
    row.kilos,
    row.base_iva,
  ].join("§");
}

export function buildClientes(precios?: PrecioRow[], confeccion?: ConfeccionRow[]) {
    const clientes = new Map<string, ClienteSummary>();

    const seenSales = new Set<string>();

    (precios ?? []).forEach((d) => {
      if (!isVisibleRow(d)) return;
      const key = saleNaturalKey(d);
      if (seenSales.has(key)) return;
      seenSales.add(key);

      const nombre = getClientName(d);
      if (!nombre) return;
      const existing = clientes.get(nombre) ?? {
        nombre,
        facturacion: 0,
        kg: 0,
        ventasRegistros: 0,
        confeccionKg: 0,
        confeccionValor: 0,
        confeccionRegistros: 0,
        ultimaCompra: "",
        registros: 0,
        fuente: "ventas" as const,
      };
      if (isCountableSaleRow(d)) existing.facturacion += saleLineValue(d);
      if (getLineClassification(d).type === "Producto" && isCountableSaleRow(d)) existing.kg += d.kilos;
      existing.registros++;
      existing.ventasRegistros++;
      existing.fuente = existing.fuente === "ventas" ? "ventas" : "ambas";
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
        ventasRegistros: 0,
        confeccionKg: 0,
        confeccionValor: 0,
        confeccionRegistros: 0,
        ultimaCompra: "",
        registros: 0,
        fuente: "confeccion" as const,
      };
      existing.confeccionValor += d.pvp_total || d.kg_netos * d.pvp_kg || 0;
      existing.confeccionKg += d.kg_netos || 0;
      existing.registros++;
      existing.confeccionRegistros++;
      existing.fuente = existing.fuente === "confeccion" ? "confeccion" : "ambas";
      if (d.fecha && d.fecha > existing.ultimaCompra) existing.ultimaCompra = d.fecha;
      clientes.set(nombre, existing);
    });

    return Array.from(clientes.values()).sort((a, b) => b.facturacion - a.facturacion || b.confeccionValor - a.confeccionValor);
}

export function useClientes() {
  const { data: precios } = usePrecios();
  const { data: confeccion } = useConfeccion();

  return useMemo(() => buildClientes(precios, confeccion), [precios, confeccion]);
}
