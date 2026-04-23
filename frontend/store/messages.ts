import { create } from "zustand"
import api from "@/lib/axiosInstance"
import { Message, MessageType } from "@/lib/types"
import { useUserStore } from "./user"

function parseApiTimestamp(value: unknown): Date {
  if (value == null || value === "") return new Date()
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? new Date() : value
  const s = String(value).trim()
  const normalized = s.includes("T") || s.endsWith("Z") ? s : s.replace(" ", "T")
  const d = new Date(normalized)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function ensureUser() {
  let currentUser = useUserStore.getState().user
  if (!currentUser || !currentUser.id) {
    currentUser = { id: 1, email: "demo@example.com" }
    useUserStore.getState().update(currentUser)
  }
  return currentUser
}

interface MessagesState {
  messages: Message[]
  currentChatId: string | null
  sidebarRefreshKey: number
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  /** Clears in-memory messages only (used when switching chats before load). */
  clearMessagesPreserveSession: () => void
  clearMessages: () => void
  /** Bump key so sidebar refetches `/api/chat/list` (sessions + message counts). */
  refreshSessionList: () => void
  startNewChat: () => Promise<void>
  setCurrentChatId: (chatId: string | null) => void
  saveMessage: (message: Message, response: Message) => Promise<void>
  /** @deprecated First message no longer needs this if bootstrapSession ran — kept for compatibility */
  createNewChat: (message: Message) => Promise<string>
  loadChatHistory: (chatId: string) => Promise<void>
  bootstrapSession: () => Promise<void>
  deleteChatSession: (chatId: string) => Promise<void>
}

export const useMessagesStore = create<MessagesState>()((set, get) => ({
  messages: [],
  currentChatId: null,
  sidebarRefreshKey: 0,

  setMessages: (messages) => set({ messages }),

  addMessage: (message) => set((state) => ({ messages: [...state.messages, message] })),

  clearMessagesPreserveSession: () => set({ messages: [] }),

  clearMessages: () => set({ messages: [], currentChatId: null }),

  refreshSessionList: () => set((s) => ({ sidebarRefreshKey: s.sidebarRefreshKey + 1 })),

  bootstrapSession: async () => {
    const user = ensureUser()
    set({ messages: [] })
    try {
      const res = await api.post("/api/chat/new", { user_id: user.id })
      const chatId = res.data?.chat_id
      if (chatId) {
        set((s) => ({
          // Do not overwrite a session another path already adopted (race: first message vs bootstrap).
          currentChatId: s.currentChatId ?? chatId,
          sidebarRefreshKey: s.sidebarRefreshKey + 1,
        }))
        setTimeout(() => get().refreshSessionList(), 350)
      }
    } catch (e) {
      const base = api.defaults.baseURL ?? "(no baseURL)"
      console.error(
        `bootstrapSession failed — is the Flask API running at ${base}?`,
        e
      )
      set({ currentChatId: `local-${Date.now()}` })
    }
  },

  startNewChat: async () => {
    const { messages, currentChatId, sidebarRefreshKey } = get()
    if (messages.length > 0 && currentChatId) {
      try {
        const u = ensureUser()
        await api.post("/chat/refresh_session_title", {
          user_id: u.id,
          chat_id: currentChatId,
        })
      } catch (e) {
        console.warn("refresh_session_title failed:", e)
      }
    }
    const user = ensureUser()
    try {
      const res = await api.post("/api/chat/new", { user_id: user.id })
      const chatId = res.data?.chat_id
      if (chatId) {
        set({
          messages: [],
          currentChatId: chatId,
          sidebarRefreshKey: sidebarRefreshKey + 1,
        })
        setTimeout(() => get().refreshSessionList(), 350)
        return
      }
    } catch (e) {
      console.warn("startNewChat API failed:", e)
    }
    set({
      messages: [],
      currentChatId: `local-${Date.now()}`,
      sidebarRefreshKey: sidebarRefreshKey + 1,
    })
  },

  setCurrentChatId: (chatId) => set({ currentChatId: chatId }),

  saveMessage: async (message, response) => {
    const { currentChatId } = get()
    if (!currentChatId) return

    try {
      const currentUser = ensureUser()
      const responseGraphPayload =
        response?.chartData != null
          ? JSON.stringify(response.chartData)
          : response?.tableData != null
            ? JSON.stringify({
                columns: response.tableData.columns,
                rows: response.tableData.rows,
              })
            : null

      await api.post("/chat/save_message", {
        user_id: currentUser.id,
        chat_id: currentChatId,
        question: message.content,
        response: response?.content ?? "",
        response_graph: responseGraphPayload,
        graph_type:
          response?.type != null ? String(response.type).toLowerCase() : MessageType.TEXT,
        insightful_questions:
          Array.isArray(response.insightful_questions) && response.insightful_questions.length > 0
            ? JSON.stringify(response.insightful_questions)
            : typeof response.insightful_questions === "string" &&
                response.insightful_questions.trim() !== ""
              ? JSON.stringify([response.insightful_questions])
              : null,
      })
      set((state) => ({ sidebarRefreshKey: state.sidebarRefreshKey + 1 }))
    } catch (error) {
      console.error("Error saving message:", error)
    }
  },

  createNewChat: async (message) => {
    try {
      const currentUser = ensureUser()
      try {
        const response = await api.post("/chat/create_chat", {
          user_id: currentUser.id,
          initial_message_content: message.content,
        })

        if (response?.data?.chat_id) {
          const chatId = response.data.chat_id
          set({ currentChatId: chatId })
          return chatId
        }
      } catch (error) {
        console.warn("Falling back to /api/chat/new:", error)
      }
      const res = await api.post("/api/chat/new", { user_id: currentUser.id })
      if (res.data?.chat_id) {
        set({ currentChatId: res.data.chat_id })
        return res.data.chat_id
      }
    } catch (error) {
      console.error("Error creating new chat:", error)
    }
    const localChatId = `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    set({ currentChatId: localChatId })
    return localChatId
  },

  deleteChatSession: async (chatId: string) => {
    try {
      const u = ensureUser()
      await api.delete(`/api/chat/${chatId}?user_id=${u.id}`)
      let needBootstrap = false
      set((state) => {
        if (state.currentChatId === chatId) {
          needBootstrap = true
          return {
            messages: [],
            currentChatId: null,
            sidebarRefreshKey: state.sidebarRefreshKey + 1,
          }
        }
        return { sidebarRefreshKey: state.sidebarRefreshKey + 1 }
      })
      if (needBootstrap) {
        await get().bootstrapSession()
      }
    } catch (e) {
      console.error("deleteChatSession:", e)
      throw e
    }
  },

  loadChatHistory: async (chatId: string) => {
    try {
      const currentUser = ensureUser()
      const apiCallResponse = await api.get(`/api/chat/${encodeURIComponent(chatId)}`, {
        params: { user_id: currentUser.id },
      })

      const conversationHistory = apiCallResponse.data?.conversation_history
      if (!Array.isArray(conversationHistory)) {
        console.error("Invalid conversation history format:", conversationHistory)
        set({ messages: [], currentChatId: chatId })
        return
      }

      const loadedMessages: Message[] = []
      conversationHistory.forEach((item: any, idx: number) => {
        const questionRaw = item.question
        const responseRaw = item.response
        const hasQuestion = questionRaw != null && String(questionRaw).trim() !== ""
        const hasResponse = responseRaw != null && String(responseRaw).trim() !== ""
        if (!hasQuestion && !hasResponse) return

        let chartData = null
        let tableData = null
        const itemTs = parseApiTimestamp(item.timestamp)
        if (item.response_graph) {
          try {
            const parsed =
              typeof item.response_graph === "string" ? JSON.parse(item.response_graph) : item.response_graph
            if (parsed && Array.isArray(parsed.columns) && Array.isArray(parsed.rows)) {
              tableData = {
                columns: parsed.columns,
                rows: parsed.rows,
              }
            } else {
              chartData = parsed
            }
          } catch {
            chartData = null
          }
        }
        if (item.graph_type === "data-table" && !tableData && item.response_graph) {
          try {
            const parsed =
              typeof item.response_graph === "string" ? JSON.parse(item.response_graph) : item.response_graph
            if (parsed?.columns && parsed?.rows) {
              tableData = { columns: parsed.columns, rows: parsed.rows }
              chartData = null
            }
          } catch {
            /* ignore */
          }
        }

        let insightfulQuestions: string[] = []
        if (Array.isArray(item.insightful_questions)) {
          insightfulQuestions = item.insightful_questions.map(String)
        } else if (typeof item.insightful_questions === "string" && item.insightful_questions.trim() !== "") {
          const raw = item.insightful_questions.trim()
          if (raw.startsWith("[")) {
            try {
              const parsed = JSON.parse(raw)
              insightfulQuestions = Array.isArray(parsed) ? parsed.map(String) : [raw]
            } catch {
              insightfulQuestions = raw
                .split(/\n\d+\.\s*/)
                .map((q: string) => q.trim())
                .filter((q: string) => q && !q.toLowerCase().includes("insightful questions"))
            }
          } else {
            insightfulQuestions = raw
              .split(/\n\d+\.\s*/)
              .map((q: string) => q.trim())
              .filter((q: string) => q && !q.toLowerCase().includes("insightful questions"))
          }
        }

        if (hasQuestion) {
          loadedMessages.push({
            id: String(item.id || item.message_id || idx) + "_user",
            content: String(questionRaw),
            type: MessageType.TEXT,
            role: "user",
            timestamp: itemTs,
          })
        }

        if (!hasResponse) return

        const gt = item.graph_type ? String(item.graph_type) : ""
        const normalizedGt = gt.replace(/_/g, "-").toLowerCase()
        const enumKey = normalizedGt
          .split("-")
          .map((w) => w.toUpperCase())
          .join("_") as keyof typeof MessageType
        const resolvedType =
          tableData != null
            ? MessageType.DATA_TABLE
            : enumKey && MessageType[enumKey] != null
              ? MessageType[enumKey]
              : MessageType.TEXT

        const graphPayload = tableData ? undefined : chartData ?? undefined
        loadedMessages.push({
          id: String(item.id || item.message_id || idx) + "_assistant",
          content: String(responseRaw),
          type: resolvedType,
          role: "assistant",
          timestamp: itemTs,
          chartData: graphPayload,
          response_graph: graphPayload,
          tableData: tableData || undefined,
          chartType: item.graph_type ? String(item.graph_type) : undefined,
          graph_type: item.graph_type ? String(item.graph_type) : undefined,
          chartTitle: "",
          insightful_questions: insightfulQuestions,
          response: String(responseRaw),
        })
      })

      loadedMessages.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime())

      set((s) => ({
        messages: loadedMessages,
        currentChatId: chatId,
        sidebarRefreshKey: s.sidebarRefreshKey + 1,
      }))
    } catch (error) {
      console.error("Error loading chat history:", error)
      set({ messages: [], currentChatId: null })
      throw error
    }
  },
}))
