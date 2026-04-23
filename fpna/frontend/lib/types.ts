export enum MessageType {
  TEXT = "text",
  LINE_CHART = "line-chart",
  BAR_CHART = "bar-chart",
  PIE_CHART = "pie-chart",
  AREA_CHART = "area-chart",
  DATA_TABLE = "data-table",
  CLARIFICATION = "clarification",
}

export interface ChartData {
  labels: string[]
  datasets: {
    label?: string
    data: number[]
    backgroundColor?: string | string[]
    borderColor?: string | string[]
    fill?: boolean
    pointBackgroundColor?: string | string[]
    pointBorderColor?: string | string[]
    pointRadius?: number
  }[]
}

export interface TableData {
  columns: string[]
  rows: (string | number)[][]
}

export interface FileAttachment {
  name: string
  size: number
  type: string
}

export interface Message {
  id: string
  content: string
  type: MessageType
  role: "user" | "assistant"
  response?: string
  timestamp: Date
  chartData?: ChartData
  tableData?: TableData
  chartTitle?: string
  fileAttachment?: FileAttachment
  insightful_questions?: string
  clarification_question?: string
  requires_clarification?: boolean
}

export interface ExcelData {
  sheets: {
    name: string
    data: TableData
  }[]
  summary?: {
    rowCount: number
    columnCount: number
    sheetCount: number
    numericColumns: string[]
    categoricalColumns: string[]
    dateColumns: string[]
  }
}

