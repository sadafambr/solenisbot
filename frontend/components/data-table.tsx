"use client"

import { useMemo, useState } from "react"
import type { TableData } from "@/lib/types"
import { stringifyCellForExport } from "@/lib/table-export"
import { cn } from "@/lib/utils"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

interface DataTableProps {
  data: TableData
}

function isMetricColumn(name: string) {
  return /\b(total|sum|avg|count|balance|amount|revenue|qty|quantity|price|value)\b/i.test(name)
}

type SortDir = "asc" | "desc" | null

export function DataTable({ data }: DataTableProps) {
  const [search, setSearch] = useState("")
  const [sortCol, setSortCol] = useState<number | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>(null)

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data.rows
    return data.rows.filter((row) =>
      row.some((cell) => stringifyCellForExport(cell).toLowerCase().includes(q))
    )
  }, [data.rows, search])

  const sortedRows = useMemo(() => {
    if (sortCol == null || !sortDir) return filteredRows
    const col = sortCol
    const copy = [...filteredRows]
    copy.sort((a, b) => {
      const va = a[col]
      const vb = b[col]
      const na = typeof va === "number" ? va : Number(String(va).replace(/,/g, ""))
      const nb = typeof vb === "number" ? vb : Number(String(vb).replace(/,/g, ""))
      const bothNum =
        Number.isFinite(na) &&
        Number.isFinite(nb) &&
        String(va).trim() !== "" &&
        String(vb).trim() !== ""
      if (bothNum) return sortDir === "asc" ? na - nb : nb - na
      const sa = stringifyCellForExport(va).toLowerCase()
      const sb = stringifyCellForExport(vb).toLowerCase()
      if (sa < sb) return sortDir === "asc" ? -1 : 1
      if (sa > sb) return sortDir === "asc" ? 1 : -1
      return 0
    })
    return copy
  }, [filteredRows, sortCol, sortDir])

  const toggleSort = (ci: number) => {
    if (sortCol !== ci) {
      setSortCol(ci)
      setSortDir("asc")
      return
    }
    if (sortDir === "asc") {
      setSortDir("desc")
    } else if (sortDir === "desc") {
      setSortCol(null)
      setSortDir(null)
    } else {
      setSortDir("asc")
    }
  }

  return (
    <div className="space-y-3 text-black">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <Input
          placeholder="Search rows…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs rounded-lg border-black/12 bg-white/55 text-sm backdrop-blur-sm"
          aria-label="Filter table rows"
        />
      </div>

      <div className="max-h-[min(70vh,28rem)] overflow-auto rounded-xl border border-black/10 bg-white/50 backdrop-blur-sm">
        <Table>
          <TableHeader className="sticky top-0 z-10 [&_tr]:border-black/10 [&_tr]:shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
            <TableRow className="border-black/10 bg-white/90 backdrop-blur-sm hover:bg-black/[0.03]">
              {data.columns.map((col, ci) => (
                <TableHead
                  key={ci}
                  className={cn(
                    "h-11 bg-white/90 px-3 text-left text-xs font-semibold text-neutral-700 backdrop-blur-sm",
                    isMetricColumn(col) && "text-black"
                  )}
                >
                  <button
                    type="button"
                    className="inline-flex items-center gap-1 rounded-md px-1 py-0.5 text-left hover:bg-black/5"
                    onClick={() => toggleSort(ci)}
                  >
                    {col}
                    {sortCol !== ci && <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />}
                    {sortCol === ci && sortDir === "asc" && <ArrowUp className="h-3.5 w-3.5" />}
                    {sortCol === ci && sortDir === "desc" && <ArrowDown className="h-3.5 w-3.5" />}
                  </button>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedRows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={data.columns.length}
                  className="py-8 text-center text-sm text-neutral-500"
                >
                  No rows match your filter.
                </TableCell>
              </TableRow>
            ) : (
              sortedRows.map((row, ri) => (
                <TableRow key={ri} className="border-black/10 hover:bg-black/[0.03]">
                  {row.map((cell, ci) => (
                    <TableCell
                      key={ci}
                      className={cn(
                        "max-w-[min(24rem,40vw)] px-3 py-2 align-top font-sans text-[13px] leading-snug text-black tabular-nums",
                        isMetricColumn(data.columns[ci] ?? "") && "font-semibold"
                      )}
                    >
                      <span className="break-words">{stringifyCellForExport(cell)}</span>
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
