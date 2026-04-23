"use client"

import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import UserProfile from "@/components/user-profile"

interface ChatHeaderProps {
  toggleSidebar: () => void
}

export default function ChatHeader({ toggleSidebar }: ChatHeaderProps) {
  return (
    <header className="flex items-center justify-between border-b bg-white p-4">
      <div className="flex items-center">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="mr-2">
          <Icons.menu className="h-5 w-5" />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <h1 className="text-xl font-semibold">Sales Insight Assistant</h1>
      </div>
      <UserProfile />
    </header>
  )
}

