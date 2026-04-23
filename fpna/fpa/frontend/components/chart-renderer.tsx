"use client"
 
import { type Message, MessageType } from "@/lib/types"
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  LabelList,
} from "recharts"
 
const SOLENIS_BOT_COLOR = "#42AABD"
 
export function renderChart(message: Message) {
  // --- Begin: Error/No Data Handling ---
  if (
    typeof message.content === "string" &&
    (
      message.content.toLowerCase().includes("no data available for the requested period") ||
      message.content.toLowerCase().includes("error")
    )
  ) {
    return null
  }
  // --- End: Error/No Data Handling ---
 
  // Handle both response_graph and chartData formats
  const chartData = message.response_graph || message.chartData
  if (!chartData) return null
 
  // Determine chart type from chartType, graph_type or existing type
  const chartType = message.chartType
    ? MessageType[message.chartType.toUpperCase().replace("-", "_") as keyof typeof MessageType]
    : message.graph_type
    ? MessageType[message.graph_type.toUpperCase().replace("-", "_") as keyof typeof MessageType]
    : message.type
 
  const { chartTitle } = message
 
  switch (chartType) {
    case MessageType.LINE_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="mb-2 text-center text-sm font-medium">{chartTitle}</h4>}
          <div className="h-[28rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={chartData.labels.map((label: string, index: number) => ({
                  name: label,
                  value: chartData.datasets[0].data[index],
                }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    // Truncate long labels and add ellipsis
                    return value.length > 20 ? value.substring(0, 20) + '...' : value;
                  }}
                />
                <YAxis
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{
                    backgroundColor: "white",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="value"
                  name={chartData.datasets[0].label}
                  stroke={SOLENIS_BOT_COLOR}
                  strokeWidth={2}
                  dot={{ r: 4, fill: SOLENIS_BOT_COLOR }}
                  activeDot={{ r: 8, fill: SOLENIS_BOT_COLOR }}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    style={{
                      textAnchor: "middle",
                      fontSize: "12px",
                      fill: "#374151",
                    }}
                    formatter={(value: number) => value.toFixed(1)}
                  />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    case MessageType.BAR_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="mb-2 text-center text-sm font-medium">{chartTitle}</h4>}
          <div className="h-[28rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.labels.map((label: string, index: number) => ({
                  name: label,
                  value: chartData.datasets[0].data[index],
                }))}
                margin={{ top: 20, right: 30, left: 20, bottom: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => {
                    // Truncate long labels and add ellipsis
                    return value.length > 20 ? value.substring(0, 20) + '...' : value;
                  }}
                />
                <YAxis
                  tickFormatter={(value) => value.toLocaleString()}
                />
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{
                    backgroundColor: "white",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
                {chartData.datasets.map((dataset: any, index: number) => (
                  <Bar
                    key={index}
                    dataKey="value"
                    name={dataset.label || `Dataset ${index + 1}`}
                    fill={SOLENIS_BOT_COLOR}
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey="value"
                      position="top"
                      style={{
                        textAnchor: "middle",
                        fontSize: "12px",
                        fill: "#374151",
                      }}
                      formatter={(value: number) => value.toFixed(1)}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    case MessageType.PIE_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="mb-2 text-center text-sm font-medium">{chartTitle}</h4>}
          <div className="h-[28rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData.labels.map((label: string, index: number) => ({
                    name: label,
                    value: chartData.datasets[0].data[index],
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  outerRadius={80}
                  fill={SOLENIS_BOT_COLOR}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                >
                  {chartData.labels.map((_: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={SOLENIS_BOT_COLOR}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => value.toLocaleString()}
                  contentStyle={{
                    backgroundColor: "white",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "var(--radius)",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    default:
      return null
  }
}