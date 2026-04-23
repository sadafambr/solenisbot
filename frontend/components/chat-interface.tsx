"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Icons } from "@/components/icons"
import ChatSidebar from "@/components/chat-sidebar"
import ChatHeader from "@/components/chat-header"
import ChatMessage from "@/components/chat-message"
import { type Message, MessageType } from "@/lib/types"
import axios from "axios"
import {
  askAlgo,
  buildFallbackAssistantMessages,
  hasMeaningfulApiError,
  transformApiResponseToCharts,
} from "@/lib/api"
import { useMessagesStore } from "@/store/messages"
import api from "@/lib/axiosInstance"
import { useUserStore } from "@/store/user"

export default function ChatInterface() {
  const messagesRaw = useMessagesStore((s) => s.messages)
  const messages = Array.isArray(messagesRaw) ? messagesRaw : []
  const addMessage = useMessagesStore((s) => s.addMessage)
  const currentChatId = useMessagesStore((s) => s.currentChatId)
  const bootstrapSession = useMessagesStore((s) => s.bootstrapSession)
  const createNewChat = useMessagesStore((s) => s.createNewChat)
  const saveMessage = useMessagesStore((s) => s.saveMessage)
  const sessionInitRef = useRef(false)
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
    if (sessionInitRef.current) return
    sessionInitRef.current = true
    void bootstrapSession()
  }, [bootstrapSession])

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

  /**
   * Only include user turns in history. Sending assistant replies (especially large tables)
   * as `user_input` poisons the supervisor and causes context bleed between questions.
   */
  const buildConversationHistoryPayload = () =>
    useMessagesStore
      .getState()
      .messages.filter((msg) => msg.role === "user")
      .slice(-12)
      .map((msg) => ({
        user_input: msg.content,
        role: "user" as const,
        timestamp: msg.timestamp,
        type: msg.type,
      }))

  const sendUserText = async (userText: string) => {
    const trimmed = userText.trim()
    if (!trimmed) return

    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      content: trimmed,
      type: MessageType.TEXT,
      role: "user",
      timestamp: new Date(),
    }

    addMessage(userMessage)
    setIsLoading(true)

    try {
      let chatId = currentChatId
      if (!chatId) {
        chatId = await createNewChat(userMessage)
      }

      let currentUser = useUserStore.getState().user
      if (!currentUser?.id) {
        currentUser = { id: 1, email: "demo@example.com" }
        useUserStore.getState().update(currentUser)
      }

      let apiResponse: any
      if (chatId && !String(chatId).startsWith("local-")) {
        try {
          const { data } = await api.post(`/api/chat/${chatId}/message`, {
            user_id: currentUser.id,
            user_input: trimmed,
          })
          apiResponse = data
        } catch (err) {
          console.warn("/api/chat/.../message failed; retrying via /ask-algo (same as Postman).", err)
          apiResponse = await askAlgo(trimmed, buildConversationHistoryPayload())
        }
      } else {
        apiResponse = await askAlgo(trimmed, buildConversationHistoryPayload())
      }

      if (hasMeaningfulApiError(apiResponse)) {
        addMessage({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content:
            typeof apiResponse.message === "string" && apiResponse.message.trim()
              ? apiResponse.message
              : typeof apiResponse.error === "string"
                ? apiResponse.error
                : "Sorry, there was an error processing your request.",
          type: MessageType.TEXT,
          role: "assistant",
          timestamp: new Date(),
        })
        setIsLoading(false)
        return
      }

      let chartMessages: Message[] | null = null
      try {
        chartMessages = transformApiResponseToCharts(apiResponse, trimmed)
      } catch (e) {
        console.error("transformApiResponseToCharts failed:", e)
      }
      if (!chartMessages) {
        chartMessages = buildFallbackAssistantMessages(apiResponse, trimmed)
      }
      if (chartMessages && chartMessages.length > 0) {
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

      if (!chartMessages || chartMessages.length === 0) {
        console.warn("No assistant payload to render; raw response:", apiResponse)
        addMessage({
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content:
            "No assistant reply was produced for this request. The workflow may have returned an empty payload — try again or check the Network tab for the last API response.",
          type: MessageType.TEXT,
          role: "assistant",
          timestamp: new Date(),
        })
      }

      setIsLoading(false)
    } catch (error) {
      console.error("Error:", error)
      let shown = "Sorry, there was an error processing your request."
      if (axios.isAxiosError(error)) {
        const data = error.response?.data
        if (data && typeof data === "object" && "error" in data) {
          const e = (data as { error?: unknown }).error
          if (typeof e === "string" && e.trim()) shown = e
        } else if (error.message && error.message !== "Network Error") {
          shown = error.message
        }
      } else if (error instanceof Error && error.message) {
        shown = error.message
      }
      addMessage({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        content: shown,
        type: MessageType.TEXT,
        role: "assistant",
        timestamp: new Date(),
      })
      setIsLoading(false)
    }
  }

  const handleInsightfulQuestionClick = (questionText: string) => {
    const cleaned = questionText.replace(/^\d+\.\s*/, "").trim()
    if (!cleaned || isLoading) return
    void sendUserText(cleaned)
  }

  const handlePromptSelect = (promptText: string, _chartType?: string) => {
    setInput(promptText)
    inputRef.current?.focus()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const userText = input.trim()
    if (!userText) return
    setInput("")
    await sendUserText(userText)
  }

  return (
    <div className="flex h-screen min-h-0 overflow-hidden bg-[#F7F7F5] font-sans text-black antialiased">
      <ChatSidebar isOpen={isSidebarOpen} onPromptSelect={handlePromptSelect} />

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <ChatHeader toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} />

        <main className="scrollbar-main mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col overflow-y-auto overscroll-contain px-5 py-6 md:px-8 md:py-8">
          {messages.length === 0 ? (
            <div className="flex flex-1 flex-col justify-center">
              <p className="font-sans text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-500">Welcome Back! Let's get started.</p>
              <h2 className="font-display mt-2 text-2xl font-normal italic tracking-tight text-black md:text-[1.75rem]">
                Start a new conversation
              </h2>
              <p className="mt-3 max-w-md font-sans text-sm leading-relaxed text-neutral-600">
                Query tables, metrics, and charts. Happy working!
              </p>
              {/* <ul className="mt-8 space-y-0 border-t border-[#E0E0E0] font-sans text-sm text-neutral-600">
                <li className="border-b border-[#E0E0E0] py-3">List Q1 bookings by region</li>
                <li className="border-b border-[#E0E0E0] py-3">Bar chart — win rate by BU</li>
              </ul> */}
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
