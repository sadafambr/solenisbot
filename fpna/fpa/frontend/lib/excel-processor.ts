import * as XLSX from "xlsx"
import type { ExcelData, TableData } from "@/lib/types"

// Define MessageType enum
export enum MessageType {
  DATA_TABLE = "DATA_TABLE",
  BAR_CHART = "BAR_CHART",
  PIE_CHART = "PIE_CHART",
  LINE_CHART = "LINE_CHART",
  AREA_CHART = "AREA_CHART",
}

/**
 * Process an Excel file and extract its data
 */
export async function processExcelFile(file: File): Promise<ExcelData> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()

    reader.onload = (e) => {
      try {
        const data = e.target?.result
        const workbook = XLSX.read(data, { type: "array" })

        const sheets: ExcelData["sheets"] = []
        let totalRows = 0
        let totalColumns = 0
        const numericColumns: string[] = []
        const categoricalColumns: string[] = []
        const dateColumns: string[] = []

        // Process each sheet
        workbook.SheetNames.forEach((sheetName) => {
          const worksheet = workbook.Sheets[sheetName]
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 })

          if (jsonData.length > 0) {
            // Extract column headers (first row)
            const columns = jsonData[0] as string[]

            // Extract data rows
            const rows = jsonData.slice(1).map((row) => {
              // Convert row to array if it's not already
              return Array.isArray(row) ? row : [row]
            })

            // Analyze column types
            columns.forEach((col, index) => {
              let isNumeric = true
              let isCategorical = true
              let isDate = true

              for (const row of rows) {
                if (row[index] === undefined) continue

                // Check if numeric
                if (isNumeric && isNaN(Number(row[index]))) {
                  isNumeric = false
                }

                // Check if date
                if (isDate) {
                  const dateValue = new Date(row[index])
                  if (isNaN(dateValue.getTime())) {
                    isDate = false
                  }
                }

                // If it's neither numeric nor date, it's categorical
                if (!isNumeric && !isDate) {
                  isCategorical = true
                  break
                }
              }

              if (isNumeric) numericColumns.push(col)
              else if (isDate) dateColumns.push(col)
              else categoricalColumns.push(col)
            })

            totalRows += rows.length
            totalColumns = Math.max(totalColumns, columns.length)

            sheets.push({
              name: sheetName,
              data: {
                columns,
                rows: rows as (string | number)[][],
              },
            })
          }
        })

        resolve({
          sheets,
          summary: {
            rowCount: totalRows,
            columnCount: totalColumns,
            sheetCount: sheets.length,
            numericColumns,
            categoricalColumns,
            dateColumns,
          },
        })
      } catch (error) {
        reject(error)
      }
    }

    reader.onerror = () => {
      reject(new Error("Failed to read the file"))
    }

    reader.readAsArrayBuffer(file)
  })
}

/**
 * Analyze Excel data and suggest appropriate chart types
 */
export function analyzeDataForCharts(data: ExcelData): {
  suggestedCharts: MessageType[]
  reason: string
} {
  const { summary } = data

  if (!summary) {
    return {
      suggestedCharts: [MessageType.DATA_TABLE],
      reason: "Unable to analyze data structure",
    }
  }

  const suggestedCharts: MessageType[] = []
  let reason = ""

  // If we have numeric and categorical columns
  if (summary.numericColumns.length > 0 && summary.categoricalColumns.length > 0) {
    // Bar chart is good for comparing categories
    suggestedCharts.push(MessageType.BAR_CHART)

    // Pie chart is good for showing distribution (if not too many categories)
    if (summary.categoricalColumns.length <= 7) {
      suggestedCharts.push(MessageType.PIE_CHART)
    }

    reason = "Your data contains categories and numeric values, suitable for comparison charts"
  }

  // If we have date columns and numeric columns, time series is appropriate
  if (summary.dateColumns.length > 0 && summary.numericColumns.length > 0) {
    suggestedCharts.push(MessageType.LINE_CHART)
    suggestedCharts.push(MessageType.AREA_CHART)

    if (reason) reason += " and "
    reason += "time series analysis"
  }

  // Always include data table as a fallback
  if (!suggestedCharts.includes(MessageType.DATA_TABLE)) {
    suggestedCharts.push(MessageType.DATA_TABLE)
  }

  return {
    suggestedCharts,
    reason: reason || "Basic data visualization",
  }
}

/**
 * Extract a subset of data for visualization
 */
export function extractDataForVisualization(
  data: ExcelData,
  chartType: MessageType,
  options?: {
    xAxis?: string
    yAxis?: string | string[]
    categoryField?: string
    limit?: number
  },
): {
  chartData?: any
  tableData?: TableData
} {
  // Default to first sheet if not specified
  const sheet = data.sheets[0]
  if (!sheet) return {}

  const { columns, rows } = sheet.data
  const limit = options?.limit || 20

  // For simple table display
  if (chartType === MessageType.DATA_TABLE) {
    return {
      tableData: {
        columns,
        rows: rows.slice(0, limit),
      },
    }
  }

  // For charts that need x and y axes
  const xAxis = options?.xAxis || data.summary?.categoricalColumns[0] || data.summary?.dateColumns[0] || columns[0]
  const yAxis = options?.yAxis || data.summary?.numericColumns[0] || columns[1]

  const xAxisIndex = columns.indexOf(xAxis)
  const yAxisIndices = Array.isArray(yAxis) ? yAxis.map((y) => columns.indexOf(y)) : [columns.indexOf(yAxis)]

  if (xAxisIndex === -1 || yAxisIndices.some((idx) => idx === -1)) {
    return { tableData: sheet.data }
  }

  switch (chartType) {
    case MessageType.BAR_CHART:
    case MessageType.LINE_CHART:
    case MessageType.AREA_CHART:
      const labels = rows.slice(0, limit).map((row) => row[xAxisIndex]?.toString() || "")
      const datasets = yAxisIndices.map((yIdx, i) => {
        const label = columns[yIdx]
        return {
          label,
          data: rows.slice(0, limit).map((row) => Number(row[yIdx]) || 0),
          backgroundColor: getColorForIndex(i),
          borderColor: getColorForIndex(i),
          fill: chartType === MessageType.AREA_CHART,
        }
      })

      return {
        chartData: { labels, datasets },
      }

    case MessageType.PIE_CHART:
      const pieLabels = rows.slice(0, Math.min(7, limit)).map((row) => row[xAxisIndex]?.toString() || "")
      const pieData = rows.slice(0, Math.min(7, limit)).map((row) => Number(row[yAxisIndices[0]]) || 0)

      return {
        chartData: {
          labels: pieLabels,
          datasets: [
            {
              data: pieData,
              backgroundColor: pieLabels.map((_, i) => getColorForIndex(i)),
              borderColor: "white",
            },
          ],
        },
      }

    default:
      return { tableData: sheet.data }
  }
}

// Helper function to get colors for chart elements
function getColorForIndex(index: number): string {
  const colors = [
    "rgba(74, 163, 177, 0.8)", // Solenis-bot teal
    "rgba(160, 212, 222, 0.8)", // Solenis-bot light teal
    "rgba(44, 125, 139, 0.8)", // Solenis-bot dark teal
    "rgba(26, 74, 82, 0.8)", // Solenis-bot very dark teal
    "rgba(94, 191, 207, 0.8)", // Solenis-bot bright teal
    "rgba(64, 143, 157, 0.8)", // Additional teal shade
    "rgba(114, 203, 217, 0.8)", // Additional light teal
  ]

  return colors[index % colors.length]
}

