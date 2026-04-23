"use client"

import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"

interface ChatHeaderProps {
  toggleSidebar: () => void
  isSidebarOpen: boolean
}

export default function ChatHeader({ toggleSidebar }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-4">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="h-9 w-9 text-slate-500 hover:bg-slate-50">
          <Icons.menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <h1 className="text-lg font-medium text-slate-800">Sales Insight Assistant</h1>
      </div>
      <div />
    </header>
  )
}

