"use client"
 
import { useEffect, useState } from "react"
 
import { Button } from "@/components/ui/button"
 
import { Input } from "@/components/ui/input"
 
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
 
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
 
        const res = await api.get("/sessions?user_id=1")
 
        setChatHistory(res.data)
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
 
        "fixed inset-y-0 left-0 z-10 w-72 transform border-r bg-white transition-transform duration-200 ease-in-out md:relative md:translate-x-0",
 
        isOpen ? "translate-x-0" : "-translate-x-full"
 
      )}
    >
      <div className="flex h-full flex-col">
        <div className="p-4 h-1/5">
          <div className="relative">
            <Input
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
            <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
              <BookOpen className="h-4 w-4 text-slate-400" />
            </div>
          </div>
          <Button className="mt-4 w-full" onClick={() => clearMessages()}>
 
            New Chat
          </Button>
        </div>
 
        <Tabs defaultValue="history" className="h-4/5 overflow-hidden">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="history">History</TabsTrigger>
            <TabsTrigger value="saved">Saved Prompts</TabsTrigger>
          </TabsList>
 
          <TabsContent value="history" className="flex-1 p-2">
            <div className="flex flex-col flex-1 overflow-y-auto space-y-2" style={{ maxHeight: "calc(100vh - 120px)" }}>
 
              {Array.isArray(filteredHistory) && filteredHistory.length > 0 ? (
                filteredHistory.map((chat: any) => (
                  <Button
 
                    key={chat.chat_id}
 
                    variant="ghost"
 
                    className="w-full justify-start text-left"
 
                    onClick={() => selectChat(chat.title, chat.chat_id)}
                  >
                    <BookOpen className="mr-2 h-4 w-4" />
                    <div className="flex flex-1 flex-col overflow-hidden">
                      <span className="truncate">{chat.title}</span>
                      <span className="text-xs text-slate-500">
 
                        {chat.created_at}
                      </span>
                    </div>
                  </Button>
 
                ))
              ) : (
                <div>No chat history found.</div>
              )}
            </div>
          </TabsContent>
 
          <TabsContent value="saved" className="flex-1 overflow-y-auto p-2">
            <Accordion type="single" collapsible className="w-full">
              <AccordionItem value="bookings-budget">
                <AccordionTrigger className="text-sm font-medium">
 
                  Annual operating plan performance
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2" style={{ maxHeight: "300px", overflowY: "auto" }}>
 
                    {filterPrompts(savedPrompts.Annual_operating_plan_performance).map((prompt) => (
                      <Button
 
                        key={prompt.id}
 
                        variant="ghost"
 
                        className="w-full justify-start text-left"
 
                        onClick={() =>
 
                          onPromptSelect?.(prompt.title, prompt.chartType)
 
                        }
                      >
                        <prompt.icon className="mr-2 h-4 w-4" />
                        <span className="truncate">{prompt.title}</span>
                      </Button>
 
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
 
              <AccordionItem value="win-rates">
                <AccordionTrigger className="text-sm font-medium">
 
                  Capability mix performance
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2" style={{ maxHeight: "200px", overflowY: "auto" }}>
 
                    {filterPrompts(savedPrompts.Capability_mix_performance).map((prompt) => (
                      <Button
 
                        key={prompt.id}
 
                        variant="ghost"
 
                        className="w-full justify-start text-left"
 
                        onClick={() =>
 
                          onPromptSelect?.(prompt.title, prompt.chartType)
 
                        }
                      >
                        <prompt.icon className="mr-2 h-4 w-4" />
                        <span className="truncate">{prompt.title}</span>
                      </Button>
 
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
 
              <AccordionItem value="deal-analytics">
                <AccordionTrigger className="text-sm font-medium">
 
                  sales metrics performance
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-2" style={{ maxHeight: "250px", overflowY: "auto" }}>
 
                    {filterPrompts(savedPrompts.sales_metrics_performance).map((prompt) => (
                      <Button
 
                        key={prompt.id}
 
                        variant="ghost"
 
                        className="w-full justify-start text-left"
 
                        onClick={() =>
 
                          onPromptSelect?.(prompt.title, prompt.chartType)
 
                        }
                      >
                        <prompt.icon className="mr-2 h-4 w-4" />
                        <span className="truncate">{prompt.title}</span>
                      </Button>
 
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </TabsContent>
        </Tabs>
      </div>
    </div>
 
  )
 
}