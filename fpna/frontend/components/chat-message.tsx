"use client"
 
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Card } from "@/components/ui/card"
import { type Message, MessageType } from "@/lib/types"
import { formatDistanceToNow } from "date-fns"
import { renderChart } from "@/components/chart-renderer"
import { FileSpreadsheet, Download } from "lucide-react"
import { Button } from "@/components/ui/button"
import { DataTable } from "@/components/data-table"
 
interface ChatMessageProps {
  message: Message
  onQuestionClick?: (questionText: string) => void
}
 
export default function ChatMessage({ message, onQuestionClick }: ChatMessageProps) {
  const formattedTime = formatDistanceToNow(new Date(message.timestamp), {
    addSuffix: true,
  })
 
  // --- Begin: Error/No Data Handling ---
  const isNoDataOrError =
    typeof message.content === "string" &&
    (
      message.content.toLowerCase().includes("no data available for the requested period") ||
      message.content.toLowerCase().includes("error")
    );
  if (isNoDataOrError) {
    return (
      <div className="mb-6 max-w-5xl mx-auto">
        <div className="flex items-start space-x-2">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src="https://ui-avatars.com/api/?name=AI&background=4AA3B1&color=fff" alt="AI" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Card className="bg-white text-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm">
              <div className="whitespace-pre-wrap text-center text-gray-500">{message.content}</div>
            </Card>
            <div className="mt-1 text-xs text-slate-500">{formattedTime}</div>
          </div>
        </div>
      </div>
    );
  }
  // --- End: Error/No Data Handling ---
 
  const renderContent = () => {
    if (message.role === "assistant") {
      const messageType = message.chartType
        ? MessageType[message.chartType.toUpperCase().replace('-', '_') as keyof typeof MessageType]
        : message.type;
 
      const getProcessedInsightfulQuestions = () => {
        if (!message.insightful_questions || !Array.isArray(message.insightful_questions)) return [];
        // Remove markdown, filter out any heading or non-question entries (like "Insightful Questions")
        const filtered = message.insightful_questions.filter(q => {
          // Remove markdown bold and trim
          const plain = q.replace(/\*/g, '').trim();
          // Filter out if matches "Insightful Questions" (with or without number, any case)
          return !/^(\d+\.\s*)?insightful questions[:]?$/i.test(plain);
        });
        // Remove any leading numbering from the question string and renumber
        return filtered.map((question: string, index: number) => {
          const cleaned = question.replace(/^\s*\d+\.\s*/, "").replace(/\*/g, '').trim();
          return `${index + 1}. ${cleaned}`;
        });
      };
 
      const insightfulQuestionsList = getProcessedInsightfulQuestions();
 
      return (
        <div className="flex items-start space-x-2">
          <Avatar className="h-8 w-8 flex-shrink-0">
            <AvatarImage src="https://ui-avatars.com/api/?name=AI&background=4AA3B1&color=fff" alt="AI" />
            <AvatarFallback>AI</AvatarFallback>
          </Avatar>
          <div className="flex-1">
            <Card className="bg-white text-gray-800 p-3 rounded-2xl rounded-tl-none shadow-sm">
              {messageType === MessageType.CLARIFICATION ? (
                <div className="border-l-4 border-orange-500 bg-orange-50 p-4 rounded-r-lg">
                  <div className="flex items-start">
                    <div className="flex-shrink-0">
                      <svg className="h-5 w-5 text-orange-400" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="ml-3">
                      <h3 className="text-sm font-medium text-orange-800 mb-2">
                        I need more information
                      </h3>
                      <div className="text-sm text-orange-700 whitespace-pre-wrap">
                        {message.clarification_question || message.content}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                message.content && (
                  <div className="whitespace-pre-wrap">{message.content}</div>
                )
              )}
 
              {messageType !== MessageType.CLARIFICATION && (messageType === MessageType.BAR_CHART || messageType === MessageType.LINE_CHART || messageType === MessageType.PIE_CHART) && message.chartData && (
                <div className={`w-full ${message.content ? 'mt-4 pt-4 border-t border-slate-200' : ''}`}>
                  {renderChart(message)}
                  <div className="mt-2 flex justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => {
                        alert("Chart export functionality would be implemented here")
                      }}
                    >
                      <Download className="mr-1 h-3 w-3" />
                      Export
                    </Button>
                  </div>
                </div>
              )}
             
              {messageType !== MessageType.CLARIFICATION && messageType === MessageType.DATA_TABLE && message.tableData && (
                <div className={`w-full overflow-x-auto ${message.content || message.chartData ? 'mt-4 pt-4 border-t border-slate-200' : ''}`}>
                  <DataTable data={message.tableData} />
                </div>
              )}
            </Card>
            <div className="mt-1 text-xs text-slate-500">{formattedTime}</div>
 
            {messageType !== MessageType.CLARIFICATION && insightfulQuestionsList.length > 0 && (
              <div className="mt-3">
                <div className="bg-slate-50 p-3 rounded-xl shadow-sm">
                  <div className="flex flex-row flex-wrap gap-2">
                    {insightfulQuestionsList.map((question, index) => (
                      <Button
                        key={index}
                        variant="outline"
                        className="h-auto whitespace-normal py-1 px-3 text-xs hover:bg-slate-100 active:bg-slate-200 text-slate-700 border-slate-300 text-left"
                        onClick={() => onQuestionClick?.(question.replace(/^\d+\.\s*/, ""))}
                      >
                        {question}
                      </Button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      );
    }
   
    return (
      <div className="flex items-start space-x-2">
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage alt="User" />
          <AvatarFallback>U</AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <Card className="bg-primary text-primary-foreground p-3 rounded-2xl rounded-tr-none">
            <div className="whitespace-pre-wrap">{message.content}</div>
          </Card>
          <div className="mt-1 text-xs text-slate-500">{formattedTime}</div>
        </div>
      </div>
    );
  }
 
  return (
    <div className="mb-6 max-w-5xl mx-auto">
      {message.fileAttachment && (
        <div className="mb-2 flex items-center rounded-md bg-white/20 p-2">
          <FileSpreadsheet className="mr-2 h-5 w-5" />
          <div className="flex-1 overflow-hidden">
            <p className="truncate text-sm font-medium">{message.fileAttachment.name}</p>
            <p className="text-xs opacity-70">{(message.fileAttachment.size / 1024).toFixed(1)} KB</p>
          </div>
        </div>
      )}
      {renderContent()}
    </div>
  )
}
 
 