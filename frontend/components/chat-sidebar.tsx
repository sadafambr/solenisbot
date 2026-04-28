"use client"
 
import { useEffect, useState } from "react"
 
import { Input } from "@/components/ui/input"
 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
 
import {
 
  Accordion,
 
  AccordionContent,
 
  AccordionItem,
 
  AccordionTrigger,
 
} from "@/components/ui/accordion"
 
import { BookOpen, ChartBar, LineChart, Trash2 } from "lucide-react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
 
import { cn } from "@/lib/utils"
 
import api from "@/lib/axiosInstance"
 
import { useMessagesStore } from "@/store/messages"
 
import { useUserStore } from "@/store/user"
 
interface ChatSidebarProps {
 
  isOpen: boolean
 
  onPromptSelect?: (prompt: string, chartType?: string) => void
 
}
 
export default function ChatSidebar({ isOpen, onPromptSelect }: ChatSidebarProps) {
 
  const [searchQuery, setSearchQuery] = useState("")

  const [chatIdPendingDelete, setChatIdPendingDelete] = useState<string | null>(null)
 
  const [chatHistory, setChatHistory] = useState<
    {
      chat_id: string
      title?: string | null
      created_at?: string
      updated_at?: string
      message_count?: number
    }[]
  >([])

  const { loadChatHistory, clearMessagesPreserveSession, startNewChat, deleteChatSession } =
    useMessagesStore()
  const activeChatId = useMessagesStore((s) => s.currentChatId)
  const sidebarRefreshKey = useMessagesStore((s) => s.sidebarRefreshKey)
 
  const { user } = useUserStore()
 
  useEffect(() => {
 
    const fetchChatHistory = async () => {
 
      try {
 
        if (!user || !user.id) {
 
          console.log("User not available for fetching chat history titles.")
 
          setChatHistory([])
 
          return
 
        }
 
        const res = await api.get(`/api/chat/list?user_id=${user.id}`)
        const sessions = Array.isArray(res.data) ? res.data : res.data?.sessions
        const normalized = Array.isArray(sessions)
          ? sessions.map((s: any) => ({
              chat_id: s.chat_id || s.id,
              title: s.title,
              created_at: s.created_at,
              updated_at: s.updated_at,
              message_count: s.message_count,
            }))
          : []
        setChatHistory(normalized)
 
      } catch (error) {
 
        console.log("Error fetching chat history titles:", error)
 
        setChatHistory([])
 
      }
 
    }
 
    if (user?.id) {
 
      fetchChatHistory()
 
    } else {
 
      setChatHistory([])
 
    }
 
  }, [user?.id, sidebarRefreshKey])
 
  const savedPrompts = {
 
    Annual_operating_plan_performance: [
 
      {
 
        id: "1",
 
        title: "Find total number of orders per customer.",
 
        chartType: "bar-chart",
 
        icon: ChartBar,
 
      },
 
      {
 
        id: "2",
 
        title: "List customers along with their nation name.",
 
        chartType: "bar-chart",
 
        icon: ChartBar,
 
      },
       {
 
        id: "3",
 
        title: "Get all parts with size greater than 30.",
 
        chartType: "trend-chart",
 
        icon: LineChart,
 
      },
       {
 
        id: "4",
 
        title: "Find total number of orders per region.",
 
        chartType: "trend-chart",
 
        icon: LineChart,
 
      },

    ],
 
    Capability_mix_performance: [
      {
        id: "cap1",
        title: "Retrieve 3 records from the customer table",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap2",
        title: "List all regions available in the REGION table.",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap3",
        title: "Display the first 5 rows from the LINEITEM table.",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap4",
        title: "Find customers who have placed more than 5 orders.",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap5",
        title: "...",
        chartType: "bar-chart",
        icon: ChartBar,
      },
    ],
 
    sales_metrics_performance: [
 
      {
 
        id: "sales1",
 
        title: "What is the opening pipeline conversion ratio for <commercial bu name> BU in <Time period>? ",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
 
      {
 
        id: "sales2",
 
        title: "What is the Win ratio for <commercial bu name> BU in <Time period>? ",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
 
      {
 
        id: "sales3",
 
        title: "What is the Win rate for client partner <client partner name>  in <Time period>? ",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
 
      {
 
        id: "sales4",
 
        title: "What is the average deal velocity for <commercial bu name> bu in <time period> by account category? ",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
 
      {
 
        id: "sales5",
 
        title: "What is the average deal velocity for  <commercial bu name>  BU in <time period> by deal type? ",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
 
      {
 
        id: "sales6",
 
        title: "What is the average deal size for  <commercial bu name>  BU in <time period> by deal type? ",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
    ],
 
  }
 
  const filteredHistory = (Array.isArray(chatHistory) ? chatHistory : []).filter((chat: any) =>
    String(chat?.title ?? "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  )
 
  const filterPrompts = (prompts: any[]) => {
 
    return prompts.filter((prompt) =>
      String(prompt?.title ?? "")
        .toLowerCase()
        .includes(searchQuery.toLowerCase())
    )
 
  }
 
  const selectChat = async (_title: unknown, id: string) => {
    try {
      clearMessagesPreserveSession()
      await loadChatHistory(id)
    } catch (error) {
      console.log(error)
      alert("Failed to fetch chat history. Please try again later.")
    }
  }

  const requestDeleteChat = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    setChatIdPendingDelete(id)
  }

  const runDeleteChat = (id: string) => {
    setChatIdPendingDelete(null)
    void (async () => {
      try {
        await deleteChatSession(id)
      } catch {
        alert("Could not delete chat.")
      }
    })()
  }
 
  return (
    <aside
      className={cn(
        "relative z-10 h-full shrink-0 overflow-hidden border-r border-black/10 bg-[#EBE6DC] transition-[width] duration-300 ease-in-out motion-reduce:transition-none",
        isOpen ? "w-[240px]" : "w-0 border-r-0"
      )}
      aria-hidden={!isOpen}
    >
      <div
        className={cn(
          "flex h-full w-[240px] min-w-[240px] flex-col px-3.5 py-4 font-sans",
          !isOpen && "pointer-events-none"
        )}
      >
        <div className="flex shrink-0 flex-col gap-3">
          <div className="relative">
            <Input
              placeholder="Search…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 rounded-md border border-black/12 bg-white/60 py-2 pl-8 pr-2.5 text-[12px] text-black shadow-none placeholder:text-black/40 focus-visible:border-black/25 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center">
              <BookOpen className="h-3.5 w-3.5 text-black/40" strokeWidth={1.5} />
            </div>
          </div>
          <button
            type="button"
            className="w-full rounded-md py-2 pl-1 text-left text-[12px] font-medium text-black/80 transition-colors hover:bg-black/[0.05] hover:text-black"
            onClick={() => void startNewChat()}
          >
            + New chat
          </button>
        </div>

        <Tabs defaultValue="history" className="mt-5 flex min-h-0 flex-1 flex-col overflow-hidden">
          <TabsList className="grid h-auto w-full shrink-0 grid-cols-2 gap-0 rounded-none border-0 border-b border-black/10 bg-transparent p-0">
            <TabsTrigger
              value="history"
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-black/45 shadow-none data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-black data-[state=active]:shadow-none"
            >
              History
            </TabsTrigger>
            <TabsTrigger
              value="saved"
              className="rounded-none border-0 border-b-2 border-transparent bg-transparent py-2.5 text-[10px] font-medium uppercase tracking-[0.12em] text-black/45 shadow-none data-[state=active]:border-black data-[state=active]:bg-transparent data-[state=active]:text-black data-[state=active]:shadow-none"
            >
              Saved
            </TabsTrigger>
          </TabsList>

          <div className="relative min-h-0 flex-1">
            <TabsContent
              forceMount
              value="history"
              className="scrollbar-sidebar absolute inset-0 mt-0 overflow-y-auto overscroll-contain p-0 pr-1 pt-4 outline-none transition-opacity duration-300 ease-in-out data-[state=inactive]:pointer-events-none data-[state=inactive]:z-0 data-[state=inactive]:opacity-0 data-[state=active]:z-10 data-[state=active]:opacity-100"
            >
              <div className="flex flex-col pb-2">
                {Array.isArray(filteredHistory) && filteredHistory.length > 0 ? (
                  filteredHistory.map((chat: any) => (
                    <div
                      key={chat.chat_id}
                      className={cn(
                        "group flex items-stretch gap-0.5 border-b border-black/[0.08]",
                        activeChatId === chat.chat_id &&
                          "border-l-2 border-l-black bg-black/[0.06] pl-1"
                      )}
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 rounded-md py-2.5 pl-1 text-left transition-colors hover:bg-black/[0.04]"
                        onClick={() => selectChat(chat.title, chat.chat_id)}
                      >
                        <span className="line-clamp-2 text-[12px] leading-snug text-black/90">
                          {chat.title?.trim() ? chat.title : "Untitled chat"}
                        </span>
                        <span className="mt-0.5 block truncate font-sans text-[10px] tabular-nums text-black/45">
                          {chat.message_count != null ? `${chat.message_count} msgs · ` : ""}
                          {chat.updated_at || chat.created_at}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="shrink-0 px-1 text-black/35 opacity-0 transition-opacity hover:text-red-600 group-hover:opacity-100"
                        title="Delete chat"
                        aria-label="Delete chat"
                        onClick={(e) => requestDeleteChat(e, chat.chat_id)}
                      >
                        <Trash2 className="mx-auto h-3.5 w-3.5" strokeWidth={1.5} />
                      </button>
                    </div>
                  ))
                ) : (
                  <p className="border-b border-black/10 py-6 text-center text-[11px] text-black/45">No history</p>
                )}
              </div>
            </TabsContent>

            <TabsContent
              forceMount
              value="saved"
              className="scrollbar-sidebar absolute inset-0 mt-0 overflow-y-auto overscroll-contain p-0 pr-1 pt-4 outline-none transition-opacity duration-300 ease-in-out data-[state=inactive]:pointer-events-none data-[state=inactive]:z-0 data-[state=inactive]:opacity-0 data-[state=active]:z-10 data-[state=active]:opacity-100"
            >
            <Accordion type="single" collapsible className="w-full pb-2">
              <AccordionItem value="bookings-budget" className="border-black/10">
                <AccordionTrigger className="rounded-md px-1 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-black/60 hover:bg-black/[0.04] hover:no-underline hover:text-black [&>svg]:text-black/40 [&[data-state=open]]:no-underline">
                  Group 1
                </AccordionTrigger>
                <AccordionContent>
                  <div className="scrollbar-sidebar max-h-[300px] overflow-y-auto overscroll-contain pr-0.5">
                    {filterPrompts(savedPrompts.Annual_operating_plan_performance).map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        className="flex w-full items-start gap-2 border-b border-black/[0.08] py-2 text-left text-[12px] text-black/85 transition-colors hover:bg-black/[0.04] hover:text-black"
                        onClick={() => onPromptSelect?.(prompt.title, prompt.chartType)}
                      >
                        <prompt.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/40" strokeWidth={1.5} />
                        <span className="line-clamp-3 leading-snug">{prompt.title}</span>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="win-rates" className="border-black/10">
                <AccordionTrigger className="rounded-md px-1 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-black/60 hover:bg-black/[0.04] hover:no-underline hover:text-black [&>svg]:text-black/40 [&[data-state=open]]:no-underline">
                  Group 2
                </AccordionTrigger>
                <AccordionContent>
                  <div className="scrollbar-sidebar max-h-[200px] overflow-y-auto overscroll-contain pr-0.5">
                    {filterPrompts(savedPrompts.Capability_mix_performance).map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        className="flex w-full items-start gap-2 border-b border-black/[0.08] py-2 text-left text-[12px] text-black/85 transition-colors hover:bg-black/[0.04] hover:text-black"
                        onClick={() => onPromptSelect?.(prompt.title, prompt.chartType)}
                      >
                        <prompt.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/40" strokeWidth={1.5} />
                        <span className="line-clamp-3 leading-snug">{prompt.title}</span>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="deal-analytics" className="border-black/10">
                <AccordionTrigger className="rounded-md px-1 py-2.5 text-[11px] font-medium uppercase tracking-[0.1em] text-black/60 hover:bg-black/[0.04] hover:no-underline hover:text-black [&>svg]:text-black/40 [&[data-state=open]]:no-underline">
                  Group 3
                </AccordionTrigger>
                <AccordionContent>
                  <div className="scrollbar-sidebar max-h-[250px] overflow-y-auto overscroll-contain pr-0.5">
                    {filterPrompts(savedPrompts.sales_metrics_performance).map((prompt) => (
                      <button
                        key={prompt.id}
                        type="button"
                        className="flex w-full items-start gap-2 border-b border-black/[0.08] py-2 text-left text-[12px] text-black/85 transition-colors hover:bg-black/[0.04] hover:text-black"
                        onClick={() => onPromptSelect?.(prompt.title, prompt.chartType)}
                      >
                        <prompt.icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-black/40" strokeWidth={1.5} />
                        <span className="line-clamp-3 leading-snug">{prompt.title}</span>
                      </button>
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
            </TabsContent>
          </div>
        </Tabs>

        <div className="shrink-0 border-t border-black/10 pt-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-black/40">FP&amp;A</p>
        </div>
      </div>

      <AlertDialog
        open={chatIdPendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setChatIdPendingDelete(null)
        }}
      >
        <AlertDialogContent className="border border-black/10 bg-[#EBE6DC] text-black sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-black">Delete this chat?</AlertDialogTitle>
            <AlertDialogDescription className="text-black/65">
              This will remove the chat from your history. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-black/15 bg-white/50 text-black hover:bg-white/80">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 text-white hover:bg-red-600/90"
              onClick={() => {
                if (chatIdPendingDelete) runDeleteChat(chatIdPendingDelete)
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  )
 
}