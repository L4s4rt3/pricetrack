import { useMemo, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
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

type DataTableMeta = {
  className?: string;
};

export function DataTable<T>({ rows, columns, empty = "Sin datos", className, getRowKey }: DataTableProps<T>) {
  const tableColumns = useMemo<ColumnDef<T>[]>(
    () => columns.map((column) => ({
      id: column.key,
      header: () => column.header,
      cell: ({ row }) => column.cell(row.original),
      meta: { className: column.className },
    })),
    [columns]
  );

  const table = useReactTable({
    data: rows,
    columns: tableColumns,
    getCoreRowModel: getCoreRowModel(),
    getRowId: getRowKey ? (row, index) => String(getRowKey(row, index)) : undefined,
  });

  return (
    <div className={cn("data-table-shell relative isolate overflow-hidden rounded-[8px] border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]", className)}>
      <div className="table-scroll overflow-x-auto">
        <table className="data-table w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-left text-sm">
          <thead className="table-head text-[10px] uppercase tracking-normal text-muted-foreground">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className={cn("px-4 py-3 font-semibold leading-tight", (header.column.columnDef.meta as DataTableMeta | undefined)?.className)}>
                    <span>{header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}</span>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="divide-y divide-[hsl(var(--glass-border))]">
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr key={row.id} className="table-row">
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn("px-4 py-3 align-top leading-snug", (cell.column.columnDef.meta as DataTableMeta | undefined)?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
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
