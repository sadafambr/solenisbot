import type { TableData } from "./types"
import { attachLeadingFieldKey, tryParseInlineKeyValueList } from "./response-formatting"

function formatCellSimple(cell: string | number | undefined | null) {
  if (cell === undefined || cell === null || cell === "") return "—"
  if (typeof cell === "number") {
    return Number.isInteger(cell) ? String(cell) : cell.toFixed(2)
  }
  return cell.toString()
}

export function stringifyCellForExport(cell: string | number | undefined | null): string {
  const raw = String(cell ?? "")
  const expanded = tryParseInlineKeyValueList(raw)
  if (!expanded) return formatCellSimple(cell)
  const pairs = attachLeadingFieldKey(expanded, undefined)
  return pairs.map((p) => `${p.key || "—"}: ${p.value || "—"}`).join("; ")
}

export function escapeCsvField(v: string): string {
  if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`
  return v
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
}

export function tableDataToMarkdown(table: TableData): string {
  const header = `| ${table.columns.join(" | ")} |`
  const sep = `| ${table.columns.map(() => "---").join(" | ")} |`
  const lines = table.rows.map(
    (row) =>
      `| ${row.map((c) => stringifyCellForExport(c).replace(/\|/g, "\\|")).join(" | ")} |`
  )
  return [header, sep, ...lines].join("\n")
}

export function downloadTableCsv(table: TableData, basename = "table-export") {
  const header = table.columns.map((c) => escapeCsvField(String(c))).join(",")
  const body = table.rows.map((row) =>
    row.map((cell) => escapeCsvField(stringifyCellForExport(cell))).join(",")
  )
  const text = [header, ...body].join("\r\n")
  const blob = new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" })
  triggerDownload(blob, `${basename}-${Date.now()}.csv`)
}

export function buildSpreadsheetML(columns: string[], rows: (string | number)[][]): string {
  const headerRow = `<Row>${columns.map((c) => `<Cell><Data ss:Type="String">${escapeXml(String(c))}</Data></Cell>`).join("")}</Row>`
  const dataRows = rows
    .map(
      (row) =>
        `<Row>${row.map((cell) => `<Cell><Data ss:Type="String">${escapeXml(stringifyCellForExport(cell))}</Data></Cell>`).join("")}</Row>`
    )
    .join("")
  return `<?xml version="1.0" encoding="UTF-8"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Data"><Table>${headerRow}${dataRows}</Table></Worksheet></Workbook>`
}

export function downloadTableExcel(table: TableData, basename = "table-export") {
  const xml = buildSpreadsheetML(table.columns, table.rows)
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" })
  triggerDownload(blob, `${basename}-${Date.now()}.xls`)
}

/** Summary as CSV: one row per non-empty line (structured list). */
export function downloadSummaryCsv(summaryText: string, basename = "summary-export") {
  const lines = summaryText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const header = "Index,Line"
  const body = lines.map((line, i) => `${i + 1},${escapeCsvField(line)}`).join("\r\n")
  const text = [header, body].join("\r\n")
  const blob = new Blob(["\ufeff", text], { type: "text/csv;charset=utf-8" })
  triggerDownload(blob, `${basename}-${Date.now()}.csv`)
}

export function downloadSummaryExcel(summaryText: string, basename = "summary-export") {
  const lines = summaryText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const cols = ["Index", "Line"]
  const rows: (string | number)[][] = lines.map((line, i) => [i + 1, line])
  const xml = buildSpreadsheetML(cols, rows)
  const blob = new Blob([xml], { type: "application/vnd.ms-excel;charset=utf-8" })
  triggerDownload(blob, `${basename}-${Date.now()}.xls`)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
