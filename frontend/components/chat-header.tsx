"use client"

import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import UserProfile from "@/components/user-profile"

interface ChatHeaderProps {
  toggleSidebar: () => void
}

export default function ChatHeader({ toggleSidebar }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-[#E0E0E0] bg-gradient-to-b from-[#111111] to-[#1A1A1A] px-4 py-2.5 md:px-5">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-9 w-9 rounded-md text-white hover:bg-white/10 hover:text-white"
        >
          <Icons.menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <span className="font-display select-none text-[15px] font-normal tracking-[0.06em] text-white">FP&amp;A</span>
      </div>
      <UserProfile variant="headerDark" />
    </header>
  )
}
