"use client"

import { useState } from "react"
import type { TableData } from "@/lib/types"
import {
  attachLeadingFieldKey,
  tryParseInlineKeyValueList,
} from "@/lib/response-formatting"
import { cn } from "@/lib/utils"

interface DataTableProps {
  data: TableData
}

function formatCell(cell: string | number | undefined) {
  if (cell === undefined || cell === null) return "—"
  if (typeof cell === "number") {
    return Number.isInteger(cell) ? String(cell) : cell.toFixed(2)
  }
  return cell.toString()
}

function fieldColumnIndex(columns: string[]): number {
  return columns.findIndex((c) => /^field$/i.test(c.trim()))
}

function ExpandedInlineKeyValues({ pairs }: { pairs: { key: string; value: string }[] }) {
  return (
    <dl className="space-y-0">
      {pairs.map((p, i) => (
        <div
          key={`${p.key}-${i}`}
          className="grid grid-cols-1 gap-1 border-t border-[#E8E8E6] py-2 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(6rem,9rem)_1fr] sm:items-baseline sm:gap-4"
        >
          <dt className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-500">
            {p.key}
          </dt>
          <dd className="break-words font-mono text-[13px] leading-relaxed text-black tabular-nums">
            {p.value || "—"}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function renderCell(
  cell: string | number | undefined,
  opts: { fieldLabelHint?: string }
) {
  const raw = String(cell ?? "")
  const expanded = tryParseInlineKeyValueList(raw)
  if (!expanded) {
    return <span className="break-words">{formatCell(cell)}</span>
  }
  const pairs = attachLeadingFieldKey(expanded, opts.fieldLabelHint)
  return <ExpandedInlineKeyValues pairs={pairs} />
}

export function DataTable({ data }: DataTableProps) {
  const [page, setPage] = useState(1)
  const rowsPerPage = 5
  const totalPages = Math.max(1, Math.ceil(data.rows.length / rowsPerPage))
  const paginatedRows = data.rows.slice((page - 1) * rowsPerPage, page * rowsPerPage)

  return (
    <div className="text-black">
      <div className="divide-y divide-[#E0E0E0]">
        {paginatedRows.map((row, rowIndex) => {
          const fieldIdx = fieldColumnIndex(data.columns)
          return (
            <article key={rowIndex} className="py-4 first:pt-0">
              <p className="font-display mb-3 text-base font-normal text-black">
                Record {(page - 1) * rowsPerPage + rowIndex + 1}
              </p>
              <dl className="space-y-0">
                {data.columns.map((col, ci) => (
                  <div
                    key={ci}
                    className="grid grid-cols-1 gap-1 border-t border-[#E0E0E0] py-2.5 first:border-t-0 first:pt-0 sm:grid-cols-[minmax(7rem,10rem)_1fr] sm:items-baseline sm:gap-8"
                  >
                    <dt className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
                      {col}
                    </dt>
                    <dd className="min-w-0 font-mono text-[13px] leading-relaxed text-black tabular-nums">
                      {renderCell(row[ci], {
                        fieldLabelHint:
                          fieldIdx >= 0 && ci !== fieldIdx
                            ? String(row[fieldIdx] ?? "")
                            : undefined,
                      })}
                    </dd>
                  </div>
                ))}
              </dl>
            </article>
          )
        })}
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between border-t border-[#E0E0E0] pt-3 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className={cn(
              "transition-opacity hover:text-black",
              page === 1 && "pointer-events-none opacity-30"
            )}
          >
            Prev
          </button>
          <span className="font-mono text-[11px] normal-case tracking-normal text-neutral-600">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className={cn(
              "transition-opacity hover:text-black",
              page === totalPages && "pointer-events-none opacity-30"
            )}
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
