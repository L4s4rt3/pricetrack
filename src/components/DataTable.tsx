import { useMemo, useRef, type CSSProperties, type ReactNode } from "react";
import { flexRender, getCoreRowModel, useReactTable, type ColumnDef } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
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

const VIRTUAL_ROW_THRESHOLD = 80;

export function DataTable<T>({ rows, columns, empty = "Sin datos", className, getRowKey }: DataTableProps<T>) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
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
  const tableRows = table.getRowModel().rows;
  const shouldVirtualize = tableRows.length > VIRTUAL_ROW_THRESHOLD;
  const rowVirtualizer = useVirtualizer({
    count: tableRows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => 58,
    overscan: 12,
    getItemKey: (index) => tableRows[index]?.id ?? index,
  });
  const virtualRows = rowVirtualizer.getVirtualItems();
  const visibleRows = shouldVirtualize ? virtualRows : tableRows.map((row, index) => ({ key: row.id, index, start: 0, size: 0 }));

  return (
    <div className={cn("data-table-shell relative isolate overflow-hidden rounded-[8px] border border-[hsl(var(--glass-border))] bg-[hsl(var(--glass-bg))]", className)}>
      <div ref={scrollRef} className="table-scroll max-h-[min(680px,calc(100vh-18rem))] overflow-auto">
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
          <tbody
            className="divide-y divide-[hsl(var(--glass-border))]"
            style={shouldVirtualize ? { height: rowVirtualizer.getTotalSize(), position: "relative" } : undefined}
          >
            {rows.length === 0 ? (
              <tr>
                <td className="px-4 py-10 text-center text-muted-foreground" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              visibleRows.map((virtualRow) => {
                const row = tableRows[virtualRow.index];
                const virtualStyle: CSSProperties | undefined = shouldVirtualize
                  ? {
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      display: "table",
                      tableLayout: "fixed",
                      transform: `translateY(${virtualRow.start}px)`,
                    }
                  : undefined;

                return (
                <tr
                  key={row.id}
                  ref={shouldVirtualize ? rowVirtualizer.measureElement : undefined}
                  data-index={shouldVirtualize ? virtualRow.index : undefined}
                  className="table-row"
                  style={virtualStyle}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className={cn("px-4 py-3 align-top leading-snug", (cell.column.columnDef.meta as DataTableMeta | undefined)?.className)}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
