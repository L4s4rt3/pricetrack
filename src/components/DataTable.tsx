import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DataColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
}

interface DataTableProps<T> {
  rows: T[];
  columns: DataColumn<T>[];
  empty?: ReactNode;
  className?: string;
  getRowKey?: (row: T, index: number) => string | number;
}

export function DataTable<T>({ rows, columns, empty = "Sin datos", className, getRowKey }: DataTableProps<T>) {
  return (
    <div className={cn("data-table-shell overflow-hidden rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)]", className)}>
      <div className="table-scroll overflow-x-auto">
        <table className="w-full min-w-[760px] table-fixed text-left text-sm">
          <thead className="table-head text-[10px] uppercase tracking-wider text-muted-foreground">
            <tr>
              {columns.map((column) => (
                <th key={column.key} className={cn("px-4 py-3 font-semibold", column.className)}>
                  <span>{column.header}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--glass-border)]">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => (
                <tr key={getRowKey ? getRowKey(row, index) : index} className="table-row">
                  {columns.map((column) => (
                    <td key={column.key} className={cn("px-4 py-3 align-top", column.className)}>
                      {column.cell(row)}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
