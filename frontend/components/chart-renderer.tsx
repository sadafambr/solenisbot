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
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
} from "recharts"
 
/** Monochrome enterprise chart palette (no brand/teal accents). */
const CHART_STROKE = "#0a0a0a"
const PIE_SHELL_FILLS = ["#0a0a0a", "#3d3d3d", "#6b6b6b", "#9a9a9a", "#b0b0b0", "#d0d0d0"]
 
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
 
  // Determine chart type from chartType, graph_type or existing type (normalize all hyphens)
  const rawType = (message.chartType || message.graph_type || "").trim()
  const chartType = rawType
    ? (MessageType[rawType.toUpperCase().replace(/-/g, "_") as keyof typeof MessageType] ?? message.type)
    : message.type

  const { chartTitle } = message

  if (chartType === MessageType.SCATTER_CHART) {
    const scatter = message.scatterData
    if (!scatter?.datasets?.length) return null
    return (
      <div className="w-full">
        {chartTitle && (
          <h4 className="font-display mb-2 text-center text-base font-normal text-black">{chartTitle}</h4>
        )}
        <div className="h-[28rem] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" dataKey="x" name="x" />
              <YAxis type="number" dataKey="y" name="y" />
              <ZAxis range={[60, 60]} />
              <Tooltip
                cursor={{ strokeDasharray: "3 3" }}
                contentStyle={{
                  backgroundColor: "white",
                  borderColor: "hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
              />
              <Legend />
              {scatter.datasets.map((dataset, index) => (
                <Scatter
                  key={index}
                  name={dataset.label || `Series ${index + 1}`}
                  data={dataset.data}
                  fill={dataset.backgroundColor || PIE_SHELL_FILLS[index % PIE_SHELL_FILLS.length]}
                />
              ))}
            </ScatterChart>
          </ResponsiveContainer>
        </div>
      </div>
    )
  }

  const chartData = message.response_graph || message.chartData
  if (!chartData) return null

  switch (chartType) {
    case MessageType.LINE_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="font-display mb-2 text-center text-base font-normal text-black">{chartTitle}</h4>}
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
                  stroke={CHART_STROKE}
                  strokeWidth={2}
                  dot={{ r: 4, fill: CHART_STROKE }}
                  activeDot={{ r: 6, fill: CHART_STROKE }}
                >
                  <LabelList
                    dataKey="value"
                    position="top"
                    style={{
                      textAnchor: "middle",
                      fontSize: "12px",
                      fill: "#0a0a0a",
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
          {chartTitle && <h4 className="font-display mb-2 text-center text-base font-normal text-black">{chartTitle}</h4>}
          <div className="h-[28rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData.labels.map((label: string, index: number) => {
                  const row: Record<string, string | number> = { name: label }
                  chartData.datasets.forEach((dataset, j) => {
                    row[dataset.label || `series_${j}`] = dataset.data[index]
                  })
                  return row
                })}
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
                {chartData.datasets.map((dataset: any, index: number) => {
                  const key = dataset.label || `series_${index}`
                  return (
                  <Bar
                    key={index}
                    dataKey={key}
                    name={dataset.label || `Dataset ${index + 1}`}
                    fill={CHART_STROKE}
                    radius={[4, 4, 0, 0]}
                  >
                    <LabelList
                      dataKey={key}
                      position="top"
                      style={{
                        textAnchor: "middle",
                        fontSize: "12px",
                        fill: "#0a0a0a",
                      }}
                      formatter={(value: number) => value.toFixed(1)}
                    />
                  </Bar>
                  )
                })}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    case MessageType.PIE_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="font-display mb-2 text-center text-base font-normal text-black">{chartTitle}</h4>}
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
                  fill={CHART_STROKE}
                  dataKey="value"
                  label={({ name, value }) => `${name}: ${value.toLocaleString()}`}
                >
                  {chartData.labels.map((_: any, index: number) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={PIE_SHELL_FILLS[index % PIE_SHELL_FILLS.length]}
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

    case MessageType.AREA_CHART:
      return (
        <div className="w-full">
          {chartTitle && (
            <h4 className="font-display mb-2 text-center text-base font-normal text-black">{chartTitle}</h4>
          )}
          <div className="h-[28rem] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={chartData.labels.map((label: string, index: number) => {
                  const row: Record<string, string | number> = { name: label }
                  chartData.datasets.forEach((dataset, j) => {
                    row[dataset.label || `Dataset ${j + 1}`] = dataset.data[index]
                  })
                  return row
                })}
                margin={{ top: 10, right: 30, left: 20, bottom: 120 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  interval={0}
                  tick={{ fontSize: 10 }}
                  tickFormatter={(value) => (value.length > 20 ? `${value.substring(0, 20)}...` : value)}
                />
                <YAxis tickFormatter={(value) => value.toLocaleString()} />
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
                  <Area
                    key={index}
                    type="monotone"
                    dataKey={dataset.label || `Dataset ${index + 1}`}
                    stroke={CHART_STROKE}
                    fill={CHART_STROKE}
                    fillOpacity={0.2}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )

    default:
      return null
  }
}