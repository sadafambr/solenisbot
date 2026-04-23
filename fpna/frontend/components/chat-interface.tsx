"use client"
 
import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Icons } from "@/components/icons"
import ChatSidebar from "@/components/chat-sidebar"
import ChatHeader from "@/components/chat-header"
import ChatMessage from "@/components/chat-message"
import FileUpload from "@/components/file-upload"
import { type Message, MessageType } from "@/lib/types"
import { askAlgo, transformApiResponseToCharts } from "@/lib/api"
import { Paperclip, X } from "lucide-react"
import { useMessagesStore } from "@/store/messages"
 
export default function ChatInterface() {
  const { messages, addMessage, currentChatId, createNewChat, saveMessage } = useMessagesStore()
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(true)
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
 
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }
 
  useEffect(() => {
    scrollToBottom()
  }, [messages])
 
  useEffect(() => {
    if (isUploading && uploadProgress < 100) {
      const timer = setTimeout(() => {
        setUploadProgress((prev) => {
          const next = prev + 10
          if (next >= 100) {
            setIsUploading(false)
            return 100
          }
          return next
        })
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [isUploading, uploadProgress])
 
  const handleInsightfulQuestionClick = (questionText: string) => {
    setInput(questionText)
    inputRef.current?.focus()
  }
 
  const handlePromptSelect = (promptText: string, chartType?: string) => {
    setInput(promptText);
    inputRef.current?.focus();
  };
 
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() && !currentFile) return
 
    const userMessage: Message = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID
      content: input,
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
 
      // Build conversation history from current messages
      const conversationHistory = messages.map(msg => ({
        user_input: msg.content,
        role: msg.role,
        timestamp: msg.timestamp,
        type: msg.type
      }))
      
      console.log("🔄 Frontend: Sending conversation history:", conversationHistory)
      const apiResponse = await askAlgo(input, conversationHistory, currentChatId || undefined)
      console.log("API Response (debug):", apiResponse)
      const chartMessages = transformApiResponseToCharts(apiResponse)
      if (chartMessages) {
        for (let i = 0; i < chartMessages.length; i++) {
          const message = chartMessages[i]
          const apiMessage: Message = {
            id: message.id || `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            content: message.content,
            type: message.type,
            role: "assistant",
            chartData: message.chartData || null,
            timestamp: new Date(),
            insightful_questions: message.insightful_questions || "",
          }
          console.log(apiMessage)
          addMessage(apiMessage)
          saveMessage(userMessage, apiMessage)
        }
      }
 
      setIsLoading(false)
    } catch (error) {
      console.error('Error:', error)
      addMessage({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Unique ID for error message
        content: "Sorry, there was an error processing your request.",
        type: MessageType.TEXT,
        role: "assistant",
        timestamp: new Date(),
      })
      setIsLoading(false)
    }
  }
 
  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      <ChatSidebar
        isOpen={isSidebarOpen}
        onPromptSelect={handlePromptSelect}
      />
      <div className="flex flex-1 flex-col">
        {/* Sticky header */}
        <div className="sticky top-0 z-20 bg-white">
          <ChatHeader toggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)} isSidebarOpen={isSidebarOpen} />
        </div>
        {/* Scrollable chat area */}
        <main className="flex-1 min-h-0 overflow-y-auto p-6 space-y-4 bg-slate-200/30">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <Icons.chat className="mb-4 h-12 w-12 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-700">Start a new conversation</h3>
              <p className="mt-2 text-slate-500">Ask a question, request a visualization/insights</p>
            </div>
          ) : (
            messages.map((message) => (
              <ChatMessage
                key={message.id}
                message={message}
                onQuestionClick={handleInsightfulQuestionClick}
              />
            ))
          )}
          <div ref={messagesEndRef} />
        </main>
        {/* Input bar flush with bottom */}
        <footer className="border-t bg-white p-4 shadow-sm">
          <form onSubmit={handleSubmit} className="flex items-center space-x-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => setShowFileUpload(!showFileUpload)}
              className={showFileUpload ? "text-primary" : ""}
            >
              <Paperclip className="h-5 w-5" />
              <span className="sr-only">Attach file</span>
            </Button>
            <Input
              ref={inputRef}
              type="text"
              placeholder="Type your message..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1 rounded-full px-4 py-2 focus:ring-2 focus:ring-primary-focus"
              disabled={isLoading}
            />
            <Button type="submit" disabled={isLoading || (!input.trim() && !currentFile)} className="rounded-full p-2 enabled:bg-primary enabled:hover:bg-primary/90">
              {isLoading ? <Icons.spinner className="h-5 w-5 animate-spin" /> : <Icons.send className="h-5 w-5" />}
            </Button>
          </form>
        </footer>
      </div>
    </div>
  )
}