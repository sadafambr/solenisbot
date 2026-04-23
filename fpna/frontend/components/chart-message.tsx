import type React from "react"
 
interface ChatMessageProps {
  message: {
    type: string
    content: string
  }
}
 
enum MessageType {
  TEXT = "text",
  CHART = "chart",
}
 
const ChatMessage: React.FC<ChatMessageProps> = ({ message }) => {
  return (
    <div>
      {message.type === MessageType.TEXT && (
        <div className="whitespace-pre-wrap">
          {message.content.includes("Commercial BU 1's budget achievement") &&
          message.content.includes("SAP Department") ? (
            <div className="text-left">
              <h4 className="font-medium mb-2">Commercial BU 1 - SAP Department Performance</h4>
              {message.content.split("\n\n").map((paragraph, idx) => (
                <div key={idx} className="mb-3">
                  {paragraph.split("\n").map((line, lineIdx) => (
                    <p key={lineIdx} className={line.trim().endsWith(":") ? "font-medium" : ""}>
                      {line}
                    </p>
                  ))}
                </div>
              ))}
            </div>
          ) : (
            message.content
          )}
        </div>
      )}
      {message.type === MessageType.CHART && (
        <div>
          {/* Placeholder for chart rendering */}
          Chart will be rendered here
        </div>
      )}
    </div>
  )
}
 
export default ChatMessage
 