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
  ScatterChart,
  Scatter,
  ZAxis,
  AreaChart,
  Area,
} from "recharts"
 
export function renderChart(message: Message) {
  if (!message.chartData && !message.scatterData) return null
 
  const { chartTitle } = message
 
  switch (message.type) {
    case MessageType.LINE_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="mb-2 text-center text-sm font-medium">{chartTitle}</h4>}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={message.chartData!.labels.map((label, index) => {
                  const dataPoint: Record<string, any> = { name: label }
                  message.chartData!.datasets.forEach((dataset, datasetIndex) => {
                    dataPoint[dataset.label || `Dataset ${datasetIndex + 1}`] = dataset.data[index]
                  })
                  return dataPoint
                })}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    borderColor: "#e2e8f0",
                    borderRadius: "0.375rem",
                  }}
                />
                <Legend />
                {message.chartData!.datasets.map((dataset, index) => (
                  <Line
                    key={index}
                    type="monotone"
                    dataKey={dataset.label || `Dataset ${index + 1}`}
                    stroke={Array.isArray(dataset.borderColor) ? dataset.borderColor[0] : dataset.borderColor}
                    activeDot={{ r: 8 }}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    case MessageType.BAR_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="mb-2 text-center text-sm font-medium">{chartTitle}</h4>}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={message.chartData!.labels.map((label, index) => {
                  const dataPoint: Record<string, any> = { name: label }
                  message.chartData!.datasets.forEach((dataset, datasetIndex) => {
                    dataPoint[dataset.label || `Dataset ${datasetIndex + 1}`] = dataset.data[index]
                  })
                  return dataPoint
                })}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    borderColor: "#e2e8f0",
                    borderRadius: "0.375rem",
                  }}
                />
                <Legend />
                {message.chartData!.datasets.map((dataset, index) => (
                  <Bar
                    key={index}
                    dataKey={dataset.label || `Dataset ${index + 1}`}
                    fill={Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[0] : dataset.backgroundColor}
                    radius={[4, 4, 0, 0]}
                  />
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
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={message.chartData!.labels.map((label, index) => ({
                    name: label,
                    value: message.chartData!.datasets[0].data[index],
                  }))}
                  cx="50%"
                  cy="50%"
                  labelLine={true}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  fontSize={12}
                >
                  {message.chartData!.labels.map((_, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={
                        Array.isArray(message.chartData!.datasets[0].backgroundColor)
                          ? message.chartData!.datasets[0].backgroundColor[
                              index % message.chartData!.datasets[0].backgroundColor.length
                            ]
                          : message.chartData!.datasets[0].backgroundColor
                      }
                    />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    borderColor: "#e2e8f0",
                    borderRadius: "0.375rem",
                  }}
                />
                <Legend layout="horizontal" verticalAlign="bottom" align="center" />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    case MessageType.SCATTER_CHART:
      if (!message.scatterData) return null
      return (
        <div className="w-full">
          {chartTitle && <h4 className="mb-2 text-center text-sm font-medium">{chartTitle}</h4>}
          <div className="h-64 w-full">
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
                    borderColor: "#e2e8f0",
                    borderRadius: "0.375rem",
                  }}
                />
                <Legend />
                {message.scatterData.datasets.map((dataset, index) => (
                  <Scatter key={index} name={dataset.label} data={dataset.data} fill={dataset.backgroundColor} />
                ))}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    case MessageType.AREA_CHART:
      return (
        <div className="w-full">
          {chartTitle && <h4 className="mb-2 text-center text-sm font-medium">{chartTitle}</h4>}
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={message.chartData!.labels.map((label, index) => {
                  const dataPoint: Record<string, any> = { name: label }
                  message.chartData!.datasets.forEach((dataset, datasetIndex) => {
                    dataPoint[dataset.label || `Dataset ${datasetIndex + 1}`] = dataset.data[index]
                  })
                  return dataPoint
                })}
                margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "white",
                    borderColor: "#e2e8f0",
                    borderRadius: "0.375rem",
                  }}
                />
                <Legend />
                {message.chartData!.datasets.map((dataset, index) => (
                  <Area
                    key={index}
                    type="monotone"
                    dataKey={dataset.label || `Dataset ${index + 1}`}
                    stroke={Array.isArray(dataset.borderColor) ? dataset.borderColor[0] : dataset.borderColor}
                    fill={Array.isArray(dataset.backgroundColor) ? dataset.backgroundColor[0] : dataset.backgroundColor}
                    fillOpacity={0.3}
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )
 
    case MessageType.DATA_TABLE:
      // Data table is handled by the DataTable component in chat-message.tsx
      return null
 
    default:
      return null
  }
}