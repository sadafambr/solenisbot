"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Icons } from "@/components/icons"
import ChatSidebar from "@/components/chat-sidebar"
import ChatHeader from "@/components/chat-header"
import ChatMessage from "@/components/chat-message"
import { type Message, MessageType } from "@/lib/types"
import { askAlgo, transformApiResponseToCharts } from "@/lib/api"
import { useMessagesStore } from "@/store/messages"

export default function ChatInterface() {
  const messagesRaw = useMessagesStore((s) => s.messages)
  const messages = Array.isArray(messagesRaw) ? messagesRaw : []
  const addMessage = useMessagesStore((s) => s.addMessage)
  const currentChatId = useMessagesStore((s) => s.currentChatId)
  const createNewChat = useMessagesStore((s) => s.createNewChat)
  const saveMessage = useMessagesStore((s) => s.saveMessage)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const [generatingPercent, setGeneratingPercent] = useState(0)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isLoading])

  useEffect(() => {
    if (!isLoading) {
      setGeneratingPercent(0)
      return
    }
    setGeneratingPercent(0)
    const start = performance.now()
    const durationMs = 5200
    let raf = 0
    const run = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs)
      const eased = 1 - (1 - t) ** 2.4
      setGeneratingPercent(Math.min(95, Math.round(eased * 95)))
      if (t < 1) raf = requestAnimationFrame(run)
    }
    raf = requestAnimationFrame(run)
    return () => cancelAnimationFrame(raf)
  }, [isLoading])

  const handleInsightfulQuestionClick = (questionText: string) => {
    setInput(questionText)
    inputRef.current?.focus()
  }

  const handlePromptSelect = (promptText: string, _chartType?: string) => {
    setInput(promptText)
    inputRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const userText = input.trim()
    if (!userText) return

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: userText,
      type: MessageType.TEXT,
      role: "user",
      timestamp: new Date(),
    }

    addMessage(userMessage)
    setInput("")
    setIsLoading(true)

    try {
      if (!currentChatId) {
        await createNewChat(userMessage)
      }

      const flattenedHistory = [...messages, userMessage].slice(-12)
      const conversationHistory = flattenedHistory.map((msg) => ({
        user_input: msg.content,
        role: msg.role,
        timestamp: msg.timestamp,
        type: msg.type,
      }))

      const apiResponse = await askAlgo(userText, [conversationHistory])

      if (apiResponse?.error) {
        addMessage({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: apiResponse.message || "Sorry, there was an error processing your request.",
          type: MessageType.TEXT,
          role: "assistant",
          timestamp: new Date(),
        })
        setIsLoading(false)
        return
      }

      const chartMessages = transformApiResponseToCharts(apiResponse, userText)
      if (chartMessages) {
        for (let i = 0; i < chartMessages.length; i++) {
          const message = chartMessages[i]
          const apiMessage: Message = {
            id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: message.content,
            type: message.type,
            role: "assistant",
            chartData: message.chartData ?? undefined,
            tableData: message.tableData ?? undefined,
            chartTitle: message.chartTitle,
            chartType: message.chartType,
            timestamp: new Date(),
            insightful_questions: (() => {
              const iq = message.insightful_questions
              if (Array.isArray(iq)) return iq
              if (typeof iq === "string" && iq.trim()) return [iq]
              return []
            })(),
            clarification_question: message.clarification_question,
            requires_clarification: message.requires_clarification,
          }
          addMessage(apiMessage)
          saveMessage(userMessage, apiMessage)
        }
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Error:", error)
      addMessage({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: "Sorry, there was an error processing your request.",
        type: MessageType.TEXT,
        role: "assistant",
        timestamp: new Date(),
      })
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#F7F7F5] font-sans text-black antialiased">
      <ChatSidebar isOpen={isSidebarOpen} onPromptSelect={handlePromptSelect} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="scrollbar-main mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-6 md:px-8 md:py-8">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">Session</p>
              <h2 className="font-display mt-2 text-2xl font-normal italic tracking-tight text-black md:text-[1.75rem]">
                New Conversation
              </h2>
              <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-neutral-600">
                Query tables, metrics, and charts. Responses render as structured records below.
              </p>
              <ul className="mt-8 space-y-0 border-t border-[#E0E0E0] font-sans text-sm text-neutral-600">
                <li className="border-b border-[#E0E0E0] py-3">List Q1 bookings by region</li>
                <li className="border-b border-[#E0E0E0] py-3">Bar chart — win rate by BU</li>
              </ul>
            </div>
          ) : (
            <div>
              {messages.map((message) => (
                <ChatMessage
                  key={message.id}
                  message={message}
                  onQuestionClick={handleInsightfulQuestionClick}
                />
              ))}
            </div>
          )}

          {isLoading && (
            <div
              className="mb-5 w-full max-w-2xl rounded-2xl border border-black/[0.06] bg-[#EBE6DC] px-5 py-4"
              role="status"
              aria-live="polite"
              aria-label="Generating response"
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-500"
                    aria-hidden
                  />
                  <span className="font-sans text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-600">
                    Generating
                  </span>
                </div>
                <span className="shrink-0 font-mono text-[11px] tabular-nums text-neutral-600">
                  {generatingPercent}%
                </span>
              </div>
              <div
                className="mt-3 h-0.5 w-full overflow-hidden rounded-full bg-neutral-200/90"
                aria-hidden
              >
                <div
                  className="h-full rounded-full bg-neutral-500 transition-[width] duration-150 ease-out"
                  style={{ width: `${generatingPercent}%` }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-px shrink-0" aria-hidden />
        </main>

        <div className="pointer-events-none flex shrink-0 justify-center px-4 pb-5 pt-2">
          <form
            onSubmit={handleSubmit}
            className="pointer-events-auto flex w-full max-w-2xl items-center gap-2 rounded-full border border-[#C8C8C8] bg-transparent px-4 py-1.5 md:px-5"
          >
            <Input
              ref={inputRef}
              type="text"
              placeholder="Message"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="h-10 min-h-0 flex-1 border-0 bg-transparent px-0 text-sm text-black shadow-none placeholder:text-neutral-400 focus-visible:ring-0 focus-visible:ring-offset-0"
              disabled={isLoading}
              aria-label="Message input"
            />
            <Button
              type="submit"
              variant="ghost"
              size="icon"
              disabled={isLoading || !input.trim()}
              title="Send"
              className="h-9 w-9 shrink-0 rounded-full text-neutral-600 hover:bg-black/5 hover:text-black disabled:opacity-30"
            >
              <Icons.send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </div>
    </div>
  )
}
