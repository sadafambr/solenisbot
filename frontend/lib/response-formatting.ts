import type { ChartData, TableData } from "./types"

/** Normalize agent / parser output into wide rows (horizontal headers) when possible. */
export function tableDataFromRecords(rows: Record<string, unknown>[]): TableData | null {
  if (!rows?.length) return null
  const first = rows[0]
  if (!first || typeof first !== "object") return null
  const columns = Object.keys(first)
  if (!columns.length) return null
  const outRows = rows.map((row) =>
    columns.map((c) => {
      const v = row[c]
      if (v == null) return ""
      if (typeof v === "number") return v
      const s = String(v).replace(/,/g, "").trim()
      const n = Number(s)
      if (Number.isFinite(n) && /^-?[\d.]+$/.test(s)) return n
      return String(v)
    })
  )
  return { columns, rows: outRows }
}

function coerceScalarCell(s: string): string | number {
  const v = s.replace(/\*+/g, "").trim()
  const cleaned = v.replace(/,/g, "")
  const n = Number(cleaned)
  if (/^-?[\d.]+$/.test(cleaned) && Number.isFinite(n)) return n
  return v
}

/**
 * Vertical "stacked" lines (e.g. TPC-H style): `C_CUSTKEY    60001` → one wide row per record.
 * A repeated column name starts a new record.
 */
export function parseStackedKeyValueLines(text: string): TableData | null {
  const lines = text.split(/\r?\n/)
  type Pair = [string, string | number]
  const records: Pair[][] = []
  let current: Pair[] = []
  const seenInRecord = new Set<string>()

  const parseLine = (raw: string): Pair | null => {
    const t = raw.trim()
    if (!t || t.startsWith("#") || t.startsWith("```") || t.startsWith("|")) return null
    let m = t.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:\s*(.+)$/)
    if (m) return [m[1].trim(), coerceScalarCell(m[2])]
    m = t.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s{2,}(.+)$/)
    if (m) return [m[1].trim(), coerceScalarCell(m[2])]
    m = t.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\t+(.+)$/)
    if (m) return [m[1].trim(), coerceScalarCell(m[2])]
    return null
  }

  for (const raw of lines) {
    const p = parseLine(raw)
    if (!p) continue
    const [k] = p
    if (seenInRecord.has(k) && current.length) {
      records.push(current)
      current = []
      seenInRecord.clear()
    }
    seenInRecord.add(k)
    current.push(p)
  }
  if (current.length) records.push(current)

  if (records.length === 0) return null
  const colOrder: string[] = []
  for (const rec of records) {
    for (const [k] of rec) {
      if (!colOrder.includes(k)) colOrder.push(k)
    }
  }
  const rows = records.map((rec) => {
    const m = new Map(rec)
    return colOrder.map((c) => m.get(c) ?? "")
  })
  return { columns: colOrder, rows }
}

/**
 * Turn two-column Field/Value (or Key/Value) tables into one row per record with horizontal headers.
 */
export function pivotKeyValueRowsToWideTable(data: TableData): TableData {
  if (data.columns.length !== 2) return data
  const c0 = data.columns[0].trim().toLowerCase()
  const c1 = data.columns[1].trim().toLowerCase()
  const isKv =
    (c0 === "field" && c1 === "value") ||
    (c0 === "key" && c1 === "value") ||
    (c0 === "column" && c1 === "value")
  if (!isKv) return data

  type Pair = [string, string | number]
  const records: Pair[][] = []
  let current: Pair[] = []
  const seen = new Set<string>()

  for (const row of data.rows) {
    const k = String(row[0] ?? "").trim()
    if (!k) continue
    const v = row[1]
    if (seen.has(k) && current.length) {
      records.push(current)
      current = []
      seen.clear()
    }
    seen.add(k)
    current.push([k, v ?? ""])
  }
  if (current.length) records.push(current)

  if (records.length === 0) return data

  const colOrder: string[] = []
  for (const rec of records) {
    for (const [k] of rec) {
      if (!colOrder.includes(k)) colOrder.push(k)
    }
  }
  const wideRows = records.map((rec) => {
    const m = new Map(rec)
    return colOrder.map((col) => m.get(col) ?? "")
  })
  return { columns: colOrder, rows: wideRows }
}

export function normalizeTableData(data: TableData | null | undefined): TableData | null {
  if (!data?.columns?.length || !data.rows) return data ?? null
  return pivotKeyValueRowsToWideTable(data)
}

/** First fenced ```json ... ``` array of objects, or a top-level JSON array. */
export function tryParseJsonRecordArray(text: string): TableData | null {
  const trimmed = text.trim()
  let candidate = ""
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidate = fence[1].trim()
  else if (trimmed.startsWith("[")) candidate = trimmed
  else return null
  try {
    const parsed = JSON.parse(candidate) as unknown
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (!parsed.every((x) => x != null && typeof x === "object" && !Array.isArray(x))) return null
    return tableDataFromRecords(parsed as Record<string, unknown>[])
  } catch {
    return null
  }
}

export function wantsBriefResponse(userInput: string): boolean {
  const t = userInput.trim().toLowerCase()
  if (t.length < 2) return false
  return /\b(short|brief|briefly|concise|succinct|tl;dr|tldr|in one line|one sentence|one-line|be quick|just the answer|minimal)\b/i.test(
    userInput
  )
}

/** Short bullet lines for dual Text + Table mode (list/show/retrieve…). */
export function buildTabularTextSummary(data: TableData, maxRows = 5): string {
  const n = data.rows.length
  if (n === 0) return "No rows to show."
  const head = `Found ${n} record${n === 1 ? "" : "s"}.`
  let labelCol = 0
  const nameIdx = data.columns.findIndex((c) => /name|title|label|customer|id|key/i.test(c))
  if (nameIdx >= 0) labelCol = nameIdx
  const secondCol =
    data.columns.length > 1 ? data.columns.findIndex((_, i) => i !== labelCol) : -1
  const lines: string[] = []
  const limit = Math.min(maxRows, n)
  for (let i = 0; i < limit; i++) {
    const row = data.rows[i]
    const primary = row[labelCol] ?? ""
    if (secondCol >= 0 && data.columns[secondCol]) {
      const sec = row[secondCol] ?? ""
      lines.push(`• ${primary} — ${data.columns[secondCol]}: ${sec}`)
    } else {
      lines.push(`• ${String(primary)}`)
    }
  }
  if (n > limit) lines.push(`• … and ${n - limit} more (see table).`)
  return [head, "", ...lines].join("\n")
}

/** User phrasing that suggests a tabular / list result. */
export function wantsTabularQuery(userInput: string): boolean {
  const t = userInput.trim().toLowerCase()
  if (t.length < 2) return false
  return /\b(list|lists|listing|show|show me|get|got|retrieve|retrieving|display|enumerate|table|tabular|rows|records|record|all|every|which|what are|fetch|pull|find|return|print|view|views)\b/i.test(
    userInput
  )
}

/** Assistant text that implies a list/table (e.g. “here is the list of…”). */
export function responseSuggestsTabularDisplay(responseText: string): boolean {
  if (!responseText || responseText.trim().length < 3) return false
  return /\blist(s|ing)?\b/i.test(responseText)
}

/** Prefer table UI when the user asked like “list/view/retrieve…” or the reply mentions “list”. */
export function wantsTabularDisplay(userInput: string, responseText?: string): boolean {
  if (wantsTabularQuery(userInput)) return true
  if (responseText && responseSuggestsTabularDisplay(responseText)) return true
  return false
}

/** User explicitly asked for a chart / visualization. */
export function wantsVisualization(userInput: string): boolean {
  return /\b(visuali[sz]e|visuali[sz]ation|chart\s+this|chart\s+it|as\s+a\s+chart|in\s+a\s+chart|show\s+me\s+a\s+graph|show\s+me\s+a\s+chart|give\s+me\s+a\s+chart|plot|plotting|chart|graph|graphs|plots?|bar\s+chart|pie\s+chart|line\s+chart|histogram|diagram)\b/i.test(
    userInput
  )
}

/**
 * Parse bullet / plain "Key: Value" lines (common for single-record retrieval) into a two-column table.
 */
export function parseKeyValueRecordLines(text: string): TableData | null {
  const lines = text.split(/\r?\n/)
  const rows: (string | number)[][] = []
  const lineRe = /^\s*(?:[-*•]+\s*)?(?:\*\*)?([^:*\n]+?)(?:\*\*)?\s*:\s*(.+)$/

  for (const raw of lines) {
    const line = raw.trim()
    if (!line || line.startsWith("#") || line.startsWith("```")) continue
    const m = line.match(lineRe)
    if (!m) continue
    const key = m[1].replace(/\*+/g, "").trim()
    let val = m[2].replace(/\*+/g, "").trim()
    if (!key || key.length > 120) continue
    const cleaned = val.replace(/,/g, "").trim()
    const n = Number(cleaned)
    if (/^-?[\d.]+$/.test(cleaned) && Number.isFinite(n)) {
      rows.push([key, n])
    } else {
      rows.push([key, val])
    }
  }

  if (rows.length < 2) return null
  return { columns: ["Field", "Value"], rows }
}

const NUMBERED_LIST_ITEM_RE = /^\s*\d+[.)]\s+(.+?)\s*$/

/**
 * Parse numbered lines like `1. Customer#000000001 - MOROCCO` into a two-column table.
 */
export function parseNumberedListTable(text: string): TableData | null {
  const lines = text.split(/\r?\n/)
  const rows: (string | number)[][] = []

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const m = line.match(NUMBERED_LIST_ITEM_RE)
    if (!m) continue
    const body = m[1].trim()
    const dashParts = body.split(/\s+[-–—]\s+/)
    if (dashParts.length >= 2) {
      const left = dashParts[0].trim()
      const right = dashParts.slice(1).join(" - ").trim()
      rows.push([left, right])
    } else {
      rows.push([body])
    }
  }

  if (rows.length < 2) return null

  const twoWide = rows.some((r) => r.length >= 2)
  if (twoWide) {
    const uniform = rows.map((r) => (r.length >= 2 ? r : [r[0], ""]))
    return { columns: ["Item", "Value"], rows: uniform }
  }

  return { columns: ["Item"], rows }
}

/** Text above the first numbered list line (for table + intro). */
export function stripLeadingParagraphBeforeNumberedList(text: string): string {
  const lines = text.split(/\r?\n/)
  const numRe = /^\s*\d+[.)]\s/
  let start = -1
  for (let i = 0; i < lines.length; i++) {
    if (numRe.test(lines[i])) {
      start = i
      break
    }
  }
  if (start <= 0) return text.trim()
  return lines.slice(0, start).join("\n").trim()
}

/** Parse a GitHub-style markdown table from plain text. */
export function parseMarkdownTable(text: string): TableData | null {
  const lines = text.split(/\r?\n/)
  const pipeRows: string[][] = []
  let collecting = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!line.includes("|")) {
      if (collecting && pipeRows.length >= 2) break
      if (collecting) {
        pipeRows.length = 0
        collecting = false
      }
      continue
    }

    const cells = line
      .split("|")
      .map((c) => c.trim())
      .filter((c, i, arr) => !(i === 0 && c === "") && !(i === arr.length - 1 && c === ""))

    if (cells.length === 0) continue

    const isSeparator = cells.every((c) => /^[\s:-]+$/.test(c) && /-/.test(c))
    if (isSeparator) {
      collecting = true
      continue
    }

    collecting = true
    pipeRows.push(cells)
  }

  if (pipeRows.length < 2) return null

  const columns = pipeRows[0]
  const rowCells = pipeRows.slice(1)
  const rows = rowCells.map((r) =>
    r.map((cell) => {
      const cleaned = cell.replace(/,/g, "").trim()
      const n = Number(cleaned)
      if (Number.isFinite(n) && /^-?[\d.]+$/.test(cleaned)) return n
      return cell
    })
  )

  return { columns, rows }
}

/** Remove the first markdown table block from text for a cleaner “text only” view. */
export function stripFirstMarkdownTable(text: string): string {
  const lines = text.split(/\r?\n/)
  const out: string[] = []
  let skipping = false
  let sawTable = false

  for (const raw of lines) {
    const line = raw.trim()
    if (!skipping && line.includes("|") && line.split("|").length >= 3) {
      skipping = true
      sawTable = true
      continue
    }
    if (skipping) {
      if (line.includes("|")) continue
      skipping = false
    }
    out.push(raw)
  }

  return sawTable ? out.join("\n").trim() : text
}

/** Turn graph agent `data` points into a simple table. */
export function graphPointsToTableData(
  data: { label: string; value: number | null }[],
  xLabel?: string,
  yLabel?: string
): TableData {
  return {
    columns: [xLabel || "Item", yLabel || "Value"],
    rows: data.map((d) => [d.label, d.value ?? ""]),
  }
}

/** Extract label: number lines for a minimal bar chart when the API returned text only. */
export function parseMetricLines(text: string): { labels: string[]; values: number[] } | null {
  const labels: string[] = []
  const values: number[] = []
  const re = /^\s*(?:[-*•]\s*)?([^:]+?)\s*[:|\t]\s*([+-]?[\d,]+(?:\.\d+)?)\s*$/gm
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const label = m[1].replace(/\*+/g, "").trim()
    const v = Number(m[2].replace(/,/g, ""))
    if (!label || !Number.isFinite(v)) continue
    if (label.length > 80) continue
    labels.push(label)
    values.push(v)
  }
  if (labels.length < 2) return null
  return { labels, values }
}

/**
 * Split comma-separated inline key:value segments (e.g. TPC-H style row dumps) into separate pairs.
 * Example: "2400001, L_PARTKEY: 119658, L_SUPPKEY: 4681" → pairs including a leading value with empty key.
 */
const INLINE_KV_SPLIT_RE = /,\s+(?=[A-Za-z_][A-Za-z0-9_]*\s*:\s)/

export function inferFieldNameFromLabel(fieldLabel: string): string | null {
  const t = fieldLabel.trim()
  const l = t.match(/\b(L_[A-Z0-9_]+)\b/)
  if (l) return l[1]
  const tokens = t.split(/\s+/).filter(Boolean)
  for (let i = tokens.length - 1; i >= 0; i--) {
    const tok = tokens[i].replace(/^[^A-Za-z0-9_]+|[^A-Za-z0-9_.]+$/g, "")
    if (/^[A-Za-z_][A-Za-z0-9_]*$/.test(tok) && tok.length >= 2) return tok
  }
  return null
}

export function tryParseInlineKeyValueList(raw: string): { key: string; value: string }[] | null {
  const s = String(raw ?? "").trim()
  if (!s || !INLINE_KV_SPLIT_RE.test(s)) return null

  const parts = s.split(INLINE_KV_SPLIT_RE)
    .map((p) => p.trim())
    .filter(Boolean)
  if (parts.length < 2) return null

  const pairs: { key: string; value: string }[] = []
  for (let i = 0; i < parts.length; i++) {
    const part = parts[i]
    const c = part.indexOf(":")
    if (c === -1) {
      if (i === 0) pairs.push({ key: "", value: part })
      else pairs.push({ key: "—", value: part })
    } else {
      pairs.push({
        key: part.slice(0, c).trim(),
        value: part.slice(c + 1).trim(),
      })
    }
  }

  if (pairs.length < 2) return null

  const explicitKeys = pairs.filter((p) => p.key && p.key !== "—").length
  const leadingOrphan = pairs[0]?.key === ""
  if (explicitKeys < 2 && !(leadingOrphan && pairs.length >= 3)) return null

  return pairs
}

export function attachLeadingFieldKey(
  pairs: { key: string; value: string }[],
  fieldLabelHint: string | undefined
): { key: string; value: string }[] {
  if (!pairs.length || pairs[0].key !== "") return pairs
  const inferred = fieldLabelHint ? inferFieldNameFromLabel(fieldLabelHint) : null
  const key = inferred ?? "Value"
  return [{ key, value: pairs[0].value }, ...pairs.slice(1)]
}

export function metricsToBarChartData(labels: string[], values: number[]): ChartData {
  return {
    labels,
    datasets: [
      {
        data: values,
        label: "Value",
        backgroundColor: [
          "hsl(var(--chart-1))",
          "hsl(var(--chart-2))",
          "hsl(var(--chart-3))",
          "hsl(var(--chart-4))",
          "hsl(var(--chart-5))",
        ],
        borderColor: [
          "hsl(var(--chart-1))",
          "hsl(var(--chart-2))",
          "hsl(var(--chart-3))",
          "hsl(var(--chart-4))",
          "hsl(var(--chart-5))",
        ],
      },
    ],
  }
}
