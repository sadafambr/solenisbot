export enum MessageType {
  TEXT = "text",
  LINE_CHART = "line-chart",
  BAR_CHART = "bar-chart",
  PIE_CHART = "pie-chart",
  AREA_CHART = "area-chart",
  SCATTER_CHART = "scatter-chart",
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

export interface ScatterChartData {
  datasets: {
    label?: string
    data: { x: number; y: number }[]
    backgroundColor?: string
  }[]
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
  /** Same shape as chartData; used when hydrating from API `response_graph`. */
  response_graph?: ChartData
  tableData?: TableData
  chartType?: string
  chartTitle?: string
  graph_type?: string
  scatterData?: ScatterChartData
  fileAttachment?: FileAttachment
  insightful_questions?: string | string[]
  clarification_question?: string
  requires_clarification?: boolean
}

