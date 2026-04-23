import { type Message, MessageType, type ChartData, type ExcelData } from "@/lib/types"
import { analyzeDataForCharts, extractDataForVisualization } from "@/lib/excel-processor"
 
// Sample color schemes for charts using Solenis-bot colors
const colorSchemes = {
  primary: [
    "rgba(74, 163, 177, 0.8)", // Solenis-bot teal
    "rgba(160, 212, 222, 0.8)", // Solenis-bot light teal
    "rgba(44, 125, 139, 0.8)", // Solenis-bot dark teal
    "rgba(26, 74, 82, 0.8)", // Solenis-bot very dark teal
    "rgba(94, 191, 207, 0.8)", // Solenis-bot bright teal
  ],
  secondary: [
    "rgba(74, 163, 177, 0.8)",
    "rgba(64, 143, 157, 0.8)",
    "rgba(54, 123, 137, 0.8)",
    "rgba(44, 103, 117, 0.8)",
    "rgba(34, 83, 97, 0.8)",
  ],
  tertiary: [
    "rgba(160, 212, 222, 0.8)",
    "rgba(140, 202, 212, 0.8)",
    "rgba(120, 192, 202, 0.8)",
    "rgba(100, 182, 192, 0.8)",
    "rgba(80, 172, 182, 0.8)",
  ],
}
 
// Sample data for different chart types
const sampleChartData: Record<MessageType, ChartData> = {
  [MessageType.TEXT]: { labels: [], datasets: [] },
  [MessageType.LINE_CHART]: {
    labels: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],
    datasets: [
      {
        label: "Revenue",
        data: [12, 19, 3, 5, 2, 3],
        borderColor: colorSchemes.primary[0],
        backgroundColor: "rgba(74, 163, 177, 0.1)",
        fill: true,
      },
      {
        label: "Expenses",
        data: [8, 12, 6, 7, 3, 2],
        borderColor: colorSchemes.secondary[0],
        backgroundColor: "rgba(44, 125, 139, 0.1)",
        fill: true,
      },
    ],
  },
  [MessageType.BAR_CHART]: {
    labels: ["Q1", "Q2", "Q3", "Q4"],
    datasets: [
      {
        label: "Sales",
        data: [65, 59, 80, 81],
        backgroundColor: colorSchemes.primary,
      },
    ],
  },
  [MessageType.PIE_CHART]: {
    labels: ["Desktop", "Mobile", "Tablet", "Other"],
    datasets: [
      {
        data: [45, 35, 15, 5],
        backgroundColor: colorSchemes.tertiary,
        borderColor: "white",
      },
    ],
  },
  [MessageType.AREA_CHART]: {
    labels: ["2019", "2020", "2021", "2022", "2023", "2024"],
    datasets: [
      {
        label: "Market Share",
        data: [30, 40, 45, 50, 55, 60],
        borderColor: colorSchemes.primary[0],
        backgroundColor: "rgba(74, 163, 177, 0.2)",
        fill: true,
      },
      {
        label: "Competitor Share",
        data: [70, 60, 55, 50, 45, 40],
        borderColor: colorSchemes.secondary[0],
        backgroundColor: "rgba(44, 125, 139, 0.2)",
        fill: true,
      },
    ],
  },
  [MessageType.DATA_TABLE]: { labels: [], datasets: [] },
}
 
// Sample chart titles
const chartTitles: Record<MessageType, string> = {
  [MessageType.TEXT]: "",
  [MessageType.LINE_CHART]: "Monthly Revenue vs Expenses",
  [MessageType.BAR_CHART]: "Quarterly Sales Performance",
  [MessageType.PIE_CHART]: "User Device Distribution",
  [MessageType.AREA_CHART]: "Market Share Trend",
  [MessageType.DATA_TABLE]: "Data Overview",
}
 
// Sample text responses
const textResponses = [
  "Based on the data analysis, we can see a clear trend in the metrics. The key insights show that there's been a significant improvement in performance over the last quarter.",
  "The analysis indicates several areas for improvement. I recommend focusing on optimizing the conversion funnel and enhancing user engagement strategies.",
  "Looking at the historical data, we can observe cyclical patterns that align with seasonal trends. This suggests that your business is affected by seasonal factors that should be considered in your planning.",
  "The comparison between current and previous periods shows a positive growth trajectory. Your strategies appear to be effective, particularly in the areas of customer acquisition and retention.",
]
 
// Excel data analysis responses
const excelAnalysisResponses = [
  "I've analyzed your Excel file and found some interesting patterns. Here's a visualization that highlights the key trends in your data.",
  "Based on the structure of your Excel data, I've created a chart that best represents the relationships between your variables.",
  "Your Excel file contains {rowCount} rows and {columnCount} columns across {sheetCount} sheets. I've identified {numericCount} numeric columns and {categoricalCount} categorical columns, which are perfect for this visualization.",
  "After examining your Excel data, I've generated this visualization to help you better understand the patterns. The chart shows the relationship between {xAxis} and {yAxis}.",
]
 
export function simulateResponse(query: string, excelData?: ExcelData): Message {
  // Determine response type based on query keywords or Excel data
  let responseType: MessageType
  let content = ""
  let chartData: ChartData | undefined
  let tableData: any = undefined
  let chartTitle: string | undefined
 
  // Special handling for the specific prompt
  if (
    query.includes("Commercial BU 1's budget achievement") &&
    query.includes("SAP Department") &&
    query.includes("bookings YoY")
  ) {
    responseType = MessageType.TEXT
    content = `Based on the analysis of Commercial BU 1's budget achievement in the SAP Department:
 
1. Current Month Performance:
   - Budget Achievement: 87% (Target: $1.2M, Actual: $1.04M)
   - Client Partner breakdown shows John Smith leading with 112% achievement
   - Top performing account is Acme Corp with 125% achievement
 
2. Quarter-to-Date Performance:
   - Budget Achievement: 92% (Target: $3.6M, Actual: $3.31M)
   - All Client Partners are above 85% achievement rate
   - 3 accounts have exceeded 100% of their quarterly targets
 
3. Year-to-Date Performance:
   - Budget Achievement: 95% (Target: $12.5M, Actual: $11.88M)
   - YoY growth of 15% compared to same period last year
   - SAP Department is the second highest performing department in Commercial BU 1
 
The YoY bookings comparison shows a positive trend with 15% growth overall, with particularly strong performance in Q2 (23% YoY growth).`
 
    return {
      id: Date.now().toString(),
      content,
      type: responseType,
      role: "assistant",
      timestamp: new Date(),
    }
  }
 
  // If Excel data is provided, analyze it and suggest appropriate visualizations
  if (excelData) {
    const { suggestedCharts, reason } = analyzeDataForCharts(excelData)
 
    // Choose the first suggested chart type or default to data table
    responseType = suggestedCharts[0] || MessageType.DATA_TABLE
 
    // Generate response content based on Excel data
    let responseTemplate = excelAnalysisResponses[Math.floor(Math.random() * excelAnalysisResponses.length)]
 
    // Replace placeholders with actual data
    if (excelData.summary) {
      responseTemplate = responseTemplate
        .replace("{rowCount}", excelData.summary.rowCount.toString())
        .replace("{columnCount}", excelData.summary.columnCount.toString())
        .replace("{sheetCount}", excelData.summary.sheetCount.toString())
        .replace("{numericCount}", excelData.summary.numericColumns.length.toString())
        .replace("{categoricalCount}", excelData.summary.categoricalColumns.length.toString())
    }
 
    // Extract data for visualization
    const extractedData = extractDataForVisualization(excelData, responseType)
 
    if (responseType === MessageType.DATA_TABLE) {
      tableData = extractedData.tableData
      content = `I've analyzed your Excel file and prepared a data table view. ${reason}`
    } else {
      // For charts
      chartData = extractedData.chartData
 
      // Set chart title based on data
      if (excelData.sheets[0]) {
        chartTitle = `${responseType.replace("-", " ").replace(/\b\w/g, (l) => l.toUpperCase())} - ${excelData.sheets[0].name}`
      } else {
        chartTitle = chartTitles[responseType]
      }
 
      // Generate content
      content = `${responseTemplate} ${reason}`
 
      // Add specific insights based on chart type
      if (responseType === MessageType.LINE_CHART || responseType === MessageType.AREA_CHART) {
        content += " The trend shows changes over time, which can help you identify patterns and make forecasts."
      } else if (responseType === MessageType.BAR_CHART) {
        content += " This comparison allows you to easily see differences between categories."
      } else if (responseType === MessageType.PIE_CHART) {
        content += " This visualization shows the proportion of each category relative to the whole."
      }
    }
  } else {
    // Handle regular text queries without Excel data
    if (query.toLowerCase().includes("line chart") || query.toLowerCase().includes("trend")) {
      responseType = MessageType.LINE_CHART
    } else if (query.toLowerCase().includes("bar chart") || query.toLowerCase().includes("compare")) {
      responseType = MessageType.BAR_CHART
    } else if (query.toLowerCase().includes("pie chart") || query.toLowerCase().includes("distribution")) {
      responseType = MessageType.PIE_CHART
    } else if (query.toLowerCase().includes("area chart") || query.toLowerCase().includes("cumulative")) {
      responseType = MessageType.AREA_CHART
    } else if (query.toLowerCase().includes("table") || query.toLowerCase().includes("raw data")) {
      responseType = MessageType.DATA_TABLE
      tableData = {
        columns: ["Category", "Q1", "Q2", "Q3", "Q4"],
        rows: [
          ["Product A", 120, 150, 180, 210],
          ["Product B", 90, 110, 130, 150],
          ["Product C", 60, 80, 100, 120],
          ["Product D", 30, 50, 70, 90],
          ["Product E", 15, 25, 35, 45],
        ],
      }
    } else {
      // Randomly select a response type with text being more common
      const types = [
        MessageType.TEXT,
        MessageType.TEXT,
        MessageType.TEXT,
        MessageType.LINE_CHART,
        MessageType.BAR_CHART,
        MessageType.PIE_CHART,
        MessageType.AREA_CHART,
      ]
      responseType = types[Math.floor(Math.random() * types.length)]
    }
 
    // Generate response content
    if (responseType === MessageType.TEXT) {
      content = textResponses[Math.floor(Math.random() * textResponses.length)]
    } else if (responseType === MessageType.DATA_TABLE) {
      content = "Here's a table view of the data you requested:"
    } else {
      content = `Here's a ${responseType.replace("-", " ")} visualization of the data:\n\nThe chart shows ${
        responseType === MessageType.LINE_CHART || responseType === MessageType.AREA_CHART
          ? "the trend over time"
          : responseType === MessageType.BAR_CHART
            ? "a comparison between categories"
            : responseType === MessageType.PIE_CHART
              ? "the distribution across segments"
              : "data visualization"
      }. ${
        Math.random() > 0.5
          ? "We can observe some interesting patterns in this data."
          : "This visualization helps identify key insights."
      }`
    }
 
    // Set chart data based on response type
    if (responseType !== MessageType.TEXT && responseType !== MessageType.DATA_TABLE) {
      chartData = sampleChartData[responseType]
      chartTitle = chartTitles[responseType]
    }
  }
 
  return {
    id: Date.now().toString(),
    content,
    type: responseType,
    role: "assistant",
    timestamp: new Date(),
    chartData,
    tableData,
    chartTitle,
  }
}