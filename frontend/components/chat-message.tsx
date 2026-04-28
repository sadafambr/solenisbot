"use client"

import { useState } from "react"
import { type Message, MessageType } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { renderChart } from "@/components/chart-renderer"
import { FileSpreadsheet, Download } from "lucide-react"
import { DataTable } from "@/components/data-table"
import { ContentActionControls } from "@/components/content-action-controls"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { buildTabularTextSummary } from "@/lib/response-formatting"

const userBubble = "max-w-[min(100%,32rem)] rounded-xl bg-black px-5 py-4 text-white shadow-sm"
const assistantBubble =
  "w-full max-w-full rounded-xl bg-[#EBE6DC] px-5 py-4 text-black shadow-sm"

function resolveAssistantMessageType(message: Message): MessageType {
  const raw = (message.chartType || message.graph_type || "").trim()
  if (raw) {
    const key = raw.toUpperCase().replace(/-/g, "_") as keyof typeof MessageType
    if (MessageType[key] != null) return MessageType[key]
  }
  return message.type
}

function safeFormatDistance(timestamp: Date | string | number | undefined) {
  if (timestamp == null) return ""
  const d = timestamp instanceof Date ? timestamp : new Date(timestamp)
  if (Number.isNaN(d.getTime())) return ""
  try {
    return formatDistanceToNow(d, { addSuffix: true })
  } catch {
    return ""
  }
}

function TableOrTextReply({ message }: { message: Message }) {
  const [mode, setMode] = useState<"summary" | "table">("table")
  if (!message.tableData) {
    return message.content ? (
      <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{message.content}</div>
    ) : null
  }

  const summaryText =
    message.textSummary?.trim() ||
    buildTabularTextSummary(message.tableData) ||
    "No summary available."

  return (
    <Tabs
      value={mode}
      onValueChange={(v) => setMode(v as "summary" | "table")}
      className="w-full"
    >
      <TabsList className="grid h-auto w-full max-w-xs grid-cols-2 gap-0 rounded-none border-0 border-b border-black/10 bg-transparent p-0">
        <TabsTrigger
          value="summary"
          className="rounded-none border-0 border-b-2 border-transparent bg-transparent py-2.5 font-sans text-[11px] font-medium shadow-none data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-black data-[state=active]:shadow-none data-[state=inactive]:text-black/45"
        >
          Summary
        </TabsTrigger>
        <TabsTrigger
          value="table"
          className="rounded-none border-0 border-b-2 border-transparent bg-transparent py-2.5 font-sans text-[11px] font-medium shadow-none data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-black data-[state=active]:shadow-none data-[state=inactive]:text-black/45"
        >
          Table
        </TabsTrigger>
      </TabsList>
      <TabsContent value="summary" className="mt-3 outline-none">
        <div className="overflow-hidden rounded-xl border border-white/40 bg-white/45 font-sans shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] backdrop-blur-[12px]">
          <div className="flex items-center justify-end border-b border-black/10 px-3 py-2">
            <ContentActionControls variant="summary" summaryText={summaryText} />
          </div>
          <div className="px-4 pb-4 pt-3 text-sm leading-relaxed text-neutral-900">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-neutral-500">
              Summary
            </p>
            <div className="mt-2 whitespace-pre-wrap">{summaryText}</div>
          </div>
        </div>
      </TabsContent>
      <TabsContent value="table" className="mt-3 outline-none">
        <div className="space-y-2">
          <div className="flex justify-end">
            <ContentActionControls variant="table" tableData={message.tableData} />
          </div>
          <DataTable data={message.tableData} />
        </div>
      </TabsContent>
    </Tabs>
  )
}

interface ChatMessageProps {
  message: Message
  onQuestionClick?: (questionText: string) => void
}

export default function ChatMessage({ message, onQuestionClick }: ChatMessageProps) {
  const formattedTime = safeFormatDistance(message.timestamp)

  const isNoDataOrError =
    typeof message.content === "string" &&
    (message.content.toLowerCase().includes("no data available for the requested period") ||
      message.content.toLowerCase().includes("error"))

  if (isNoDataOrError) {
    return (
      <div className="mb-5">
        <div className={assistantBubble}>
          <p className="font-sans text-sm leading-relaxed text-neutral-800">{message.content}</p>
          <p className="mt-3 font-sans text-[11px] text-neutral-600">{formattedTime}</p>
        </div>
      </div>
    )
  }

  if (message.role === "user") {
    return (
      <div className="mb-5 flex justify-end">
        <div className={userBubble}>
          {message.fileAttachment && (
            <div className="mb-3 flex items-start gap-3 border-b border-white/20 pb-3">
              <FileSpreadsheet className="mt-0.5 h-4 w-4 shrink-0 text-white/60" />
              <div className="min-w-0 text-left">
                <p className="truncate font-sans text-sm">{message.fileAttachment.name}</p>
                <p className="font-mono text-[11px] text-white/45">
                  {(message.fileAttachment.size / 1024).toFixed(1)} KB
                </p>
              </div>
            </div>
          )}
          <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-white/50">You</p>
          <p className="mt-2 whitespace-pre-wrap text-left font-sans text-sm leading-relaxed">{message.content}</p>
          <p className="mt-3 font-sans text-[11px] text-white/45">{formattedTime}</p>
        </div>
      </div>
    )
  }

  const messageType = resolveAssistantMessageType(message)

  const getProcessedInsightfulQuestions = () => {
    const raw = message.insightful_questions
    if (!raw) return []
    const list = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
        ? raw.split(/\n/).map((s) => s.trim()).filter(Boolean)
        : []
    if (list.length === 0) return []
    const filtered = list.filter((q: string) => {
      const plain = q.replace(/\*/g, "").trim()
      return !/^(\d+\.\s*)?insightful questions[:]?$/i.test(plain)
    })
    return filtered.map((question: string, index: number) => {
      const cleaned = question.replace(/^\s*\d+\.\s*/, "").replace(/\*/g, "").trim()
      return `${index + 1}. ${cleaned}`
    })
  }

  const insightfulQuestionsList = getProcessedInsightfulQuestions()

  return (
    <div className="mb-5">
      <div className={assistantBubble}>
        <p className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600">AI</p>

        <div className="mt-3 space-y-4">
          {messageType === MessageType.CLARIFICATION ? (
            <div>
              <h3 className="font-display text-lg font-normal leading-snug text-black">Clarification</h3>
              <p className="mt-2 font-sans text-sm leading-relaxed">
                {message.clarification_question || message.content}
              </p>
            </div>
          ) : messageType === MessageType.DATA_TABLE ? (
            <TableOrTextReply message={message} />
          ) : (
            message.content && (
              <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed">{message.content}</div>
            )
          )}

          {messageType !== MessageType.CLARIFICATION &&
            messageType !== MessageType.DATA_TABLE &&
            (messageType === MessageType.BAR_CHART ||
              messageType === MessageType.LINE_CHART ||
              messageType === MessageType.PIE_CHART ||
              messageType === MessageType.AREA_CHART ||
              messageType === MessageType.SCATTER_CHART) &&
            (message.chartData || message.response_graph || message.scatterData) && (
              <div className={cn("space-y-3", message.content && "border-t border-black/10 pt-4")}>
                {renderChart(message)}
                <div className="flex justify-end">
                  <button
                    type="button"
                    className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-600 transition-colors hover:text-black"
                    onClick={() => {
                      alert("Chart export functionality would be implemented here")
                    }}
                  >
                    <Download className="mr-1 inline h-3 w-3 align-[-2px]" />
                    Export
                  </button>
                </div>
              </div>
            )}

          {messageType !== MessageType.CLARIFICATION && insightfulQuestionsList.length > 0 && (
            <div className="border-t border-black/10 pt-4">
              <h3 className="font-display text-lg font-normal leading-snug text-black">Follow-up</h3>
              <ul className="mt-2 divide-y divide-black/10">
                {insightfulQuestionsList.map((question, index) => (
                  <li key={index} className="py-2 first:pt-0">
                    <button
                      type="button"
                      className="w-full text-left font-sans text-sm transition-colors hover:text-neutral-600"
                      onClick={() => onQuestionClick?.(question.replace(/^\d+\.\s*/, ""))}
                    >
                      {question}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <p className="mt-4 font-sans text-[11px] text-neutral-600">{formattedTime}</p>
      </div>
    </div>
  )
}
