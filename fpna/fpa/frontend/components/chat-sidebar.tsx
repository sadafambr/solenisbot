"use client"
 
import { useEffect, useState } from "react"
 
import { Button } from "@/components/ui/button"
 
import { Input } from "@/components/ui/input"
 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Icons } from "@/components/icons"
 
import {
 
  Accordion,
 
  AccordionContent,
 
  AccordionItem,
 
  AccordionTrigger,
 
} from "@/components/ui/accordion"
 
import { BookOpen, ChartBar, LineChart, PieChart } from "lucide-react"
 
import { cn } from "@/lib/utils"
 
import api from "@/lib/axiosInstance"
 
import { useMessagesStore } from "@/store/messages"
 
interface ChatSidebarProps {
 
  isOpen: boolean
 
  onPromptSelect?: (prompt: string, chartType?: string) => void
 
}
 
export default function ChatSidebar({ isOpen, onPromptSelect }: ChatSidebarProps) {
 
  const [searchQuery, setSearchQuery] = useState("")
 
  const [chatHistory, setChatHistory] = useState([])
 
  const { loadChatHistory, clearMessages } = useMessagesStore()
 
  useEffect(() => {
 
    const fetchChatHistory = async () => {
 
      try {
 
        const res = await api.get("/chat/chat_sessions")
 
        setChatHistory(res.data.sessions)
        console.log("Fetched chat history:", res.data)
 
      } catch (error) {
 
        console.log("Error fetching chat history titles:", error)
 
        setChatHistory([])
 
      }
 
    }
 
    fetchChatHistory()
 
  }, [])
 
  const savedPrompts = {
 
    Annual_operating_plan_performance: [
 
      {
 
        id: "1",
 
        title: "what is account<account_name> budget achievement in <TimePeriod> for the deal type<deal_type> ?",
 
        chartType: "bar-chart",
 
        icon: ChartBar,
 
      },
 
      {
 
        id: "2",
 
        title: "what is account<account_name> budget achievement in <TimePeriod> for category<Account category>?",
 
        chartType: "bar-chart",
 
        icon: ChartBar,
 
      },
       {
 
        id: "3",
 
        title: "what is client partner<client_partner_name> budget achievement in <TimePeriod> for the deal type<deal_type> ?",
 
        chartType: "trend-chart",
 
        icon: LineChart,
 
      },
       {
 
        id: "4",
 
        title: "what is client partner<client_partner_name> budget achievement in <TimePeriod> for category<Account category> ?",
 
        chartType: "trend-chart",
 
        icon: LineChart,
 
      },
       {
 
        id: "5",
 
        title: "what is <commercial_bu_name>BU budget achievement in <TimePeriod> for category<Account category> ?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
       {
 
        id: "6",
 
        title: "what is <commercial_bu_name>BU budget achievement in <TimePeriod> for the deal type<deal_type> ?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "7",
 
        title: "What is <Account Name>'s YoY bookings growth in FY25?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "8",
 
        title: "What is <Client Partner>'s YoY bookings growth in FY25?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "9",
 
        title: "What is <Commercial BU>'s YoY bookings growth in FY25?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "10",
 
        title: "What is <Account Name>'s bookings in <Deal Type> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "11",
 
        title: "What is <Account Name>'s bookings in <Customer Type> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "12",
 
        title: "What is <Account Name>'s bookings in <Deal Size> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "13",
 
        title: "What is <Account Name>'s bookings in <Account Category> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },{
 
        id: "14",
 
        title: "What is <Client Partner>'s bookings in <Deal Type> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "15",
 
        title: "What is <Client Partner>'s bookings in <Customer Type> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
       {
 
        id: "16",
 
        title: "What is <Client Partner>'s bookings in <Deal Size> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },  
        {
 
        id: "17",
 
        title: "What is <Client Partner>'s bookings in <Account Category> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "18",
 
        title: "What is <Commercial BU>'s bookings in <Deal Type> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "19",
 
        title: "What is <Commercial BU>'s bookings in <Customer Type> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "20",
 
        title: "What is <Commercial BU>'s bookings in <Deal Size> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
        {
 
        id: "21",
 
        title: "What is <Commercial BU>'s bookings in <Account Category> in FY25 YoY?",
 
        chartType: "bar-chart",
 
        icon: LineChart,
 
      },
    ],
 
    Capability_mix_performance: [
      {
        id: "cap1",
        title: "What is <Commercial BU>'s bookings budget achievement in <time period> by department?",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap2",
        title: "What is <Commercial BU>'s bookings budget achievement in <time period> for <department name> department?",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap3",
        title: "What is <Commercial BU>'s bookings budget achievement in <time period> for <department name> department by account category?",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap4",
        title: "What is Client Partner <Client Partner name> bookings budget achievement in <time period> for <department name> department for <type – New deal/Renewal> deal type?",
        chartType: "bar-chart",
        icon: ChartBar,
      },
      {
        id: "cap5",
        title: "What is Client Partner <Client Partner name> bookings budget achievement in <time period> for <department name> department for <Account category name> Account category?",
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
 
  const filteredHistory = chatHistory?.filter((chat: any) =>
 
    chat.title.toLowerCase().includes(searchQuery.toLowerCase())
 
  )
 
  const filterPrompts = (prompts: any[]) => {
 
    return prompts.filter((prompt) =>
 
      prompt.title.toLowerCase().includes(searchQuery.toLowerCase())
 
    )
 
  }
 
  const selectChat = async (title: any, id: any) => {
 
    try {
 
      clearMessages()
 
      await loadChatHistory(id)
 
    } catch (error) {
 
      console.log(error)
 
      alert("Failed to fetch chat history. Please try again later.")
 
    }
 
  }
  return (
    <div
      className={cn(
        "fixed inset-y-0 left-0 z-30 w-72 transform border-r border-slate-200 bg-white transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
        isOpen ? "translate-x-0" : "-translate-x-full"
      )}
    >
      <div className="flex h-full flex-col">
        {/* Header with Search and New Chat */}
        <div className="p-4 space-y-4">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <BookOpen className="h-4 w-4 text-slate-400 group-focus-within:text-slate-600 transition-colors" />
            </div>
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 bg-slate-50 border-transparent hover:border-slate-200 focus:bg-white focus:border-slate-300 rounded-xl transition-all h-10"
            />
          </div>
          <Button 
            className="w-full bg-slate-900 hover:bg-slate-800 text-white rounded-xl py-6 font-medium shadow-sm transition-all"
            onClick={() => clearMessages()}
          >
            <Icons.add className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>

        {/* Content with Tabs */}
        <Tabs defaultValue="history" className="flex-1 flex flex-col min-h-0">
          <div className="px-4 mb-2">
            <TabsList className="grid w-full grid-cols-2 bg-slate-100/50 p-1 rounded-xl h-10">
              <TabsTrigger 
                value="history" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500 text-xs font-medium transition-all"
              >
                History
              </TabsTrigger>
              <TabsTrigger 
                value="saved" 
                className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm data-[state=active]:text-slate-900 text-slate-500 text-xs font-medium transition-all"
              >
                Saved Prompts
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="history" className="flex-1 overflow-hidden m-0">
            <div className="h-full px-2 overflow-y-auto custom-scrollbar">
              <div className="flex flex-col space-y-1">
                {Array.isArray(filteredHistory) && filteredHistory.length > 0 ? (
                  filteredHistory.map((chat: any) => (
                    <Button
                      key={chat.chat_id}
                      variant="ghost"
                      className="w-full justify-start text-left px-3 py-6 hover:bg-slate-50 rounded-xl group"
                      onClick={() => selectChat(chat.title, chat.chat_id)}
                    >
                      <BookOpen className="mr-3 h-4 w-4 text-slate-400 group-hover:text-slate-600 transition-colors" />
                      <div className="flex flex-1 flex-col overflow-hidden">
                        <span className="truncate text-sm font-medium text-slate-700 group-hover:text-slate-900">{chat.title}</span>
                        <span className="text-[10px] text-slate-400 mt-0.5">
                          {chat.created_at}
                        </span>
                      </div>
                    </Button>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
                    <Icons.chat className="h-8 w-8 text-slate-200 mb-2" />
                    <p className="text-xs text-slate-400 font-medium">No chat history found</p>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="saved" className="flex-1 overflow-hidden m-0">
            <div className="h-full px-2 overflow-y-auto custom-scrollbar">
              <Accordion type="single" collapsible className="w-full space-y-1">
                <AccordionItem value="bookings-budget" className="border-none">
                  <AccordionTrigger className="text-xs font-semibold text-slate-500 hover:text-slate-900 hover:no-underline px-3 py-3 rounded-xl hover:bg-slate-50 transition-all uppercase tracking-wider">
                    Annual operating plan performance
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-2 px-1">
                    <div className="space-y-1">
                      {filterPrompts(savedPrompts.Annual_operating_plan_performance).map((prompt) => (
                        <Button
                          key={prompt.id}
                          variant="ghost"
                          className="w-full justify-start text-left px-4 py-2 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 group"
                          onClick={() => onPromptSelect?.(prompt.title, prompt.chartType)}
                        >
                          <prompt.icon className="mr-3 h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          <span className="truncate">{prompt.title}</span>
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="win-rates" className="border-none">
                  <AccordionTrigger className="text-xs font-semibold text-slate-500 hover:text-slate-900 hover:no-underline px-3 py-3 rounded-xl hover:bg-slate-50 transition-all uppercase tracking-wider">
                    Capability mix performance
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-2 px-1">
                    <div className="space-y-1">
                      {filterPrompts(savedPrompts.Capability_mix_performance).map((prompt) => (
                        <Button
                          key={prompt.id}
                          variant="ghost"
                          className="w-full justify-start text-left px-4 py-2 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 group"
                          onClick={() => onPromptSelect?.(prompt.title, prompt.chartType)}
                        >
                          <prompt.icon className="mr-3 h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          <span className="truncate">{prompt.title}</span>
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="deal-analytics" className="border-none">
                  <AccordionTrigger className="text-xs font-semibold text-slate-500 hover:text-slate-900 hover:no-underline px-3 py-3 rounded-xl hover:bg-slate-50 transition-all uppercase tracking-wider">
                    Sales metrics performance
                  </AccordionTrigger>
                  <AccordionContent className="pt-1 pb-2 px-1">
                    <div className="space-y-1">
                      {filterPrompts(savedPrompts.sales_metrics_performance).map((prompt) => (
                        <Button
                          key={prompt.id}
                          variant="ghost"
                          className="w-full justify-start text-left px-4 py-2 hover:bg-slate-50 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 group"
                          onClick={() => onPromptSelect?.(prompt.title, prompt.chartType)}
                        >
                          <prompt.icon className="mr-3 h-3.5 w-3.5 text-slate-400 group-hover:text-slate-600 transition-colors" />
                          <span className="truncate">{prompt.title}</span>
                        </Button>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100">
          <div className="text-xs text-slate-500">Guest session</div>
        </div>
      </div>
    </div>
  )
}