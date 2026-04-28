"use client"

import { Button } from "@/components/ui/button"
import { Icons } from "@/components/icons"
import UserProfile from "@/components/user-profile"

interface ChatHeaderProps {
  toggleSidebar: () => void
}

export default function ChatHeader({ toggleSidebar }: ChatHeaderProps) {
  return (
    <header className="flex shrink-0 items-center justify-between border-b border-black/10 bg-[#EBE6DC] px-4 py-2.5 md:px-5">
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleSidebar}
          className="h-9 w-9 rounded-md text-neutral-900 hover:bg-black/[0.06] hover:text-black"
        >
          <Icons.menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
          <span className="sr-only">Toggle sidebar</span>
        </Button>
        <span className="select-none font-sans text-[15px] font-semibold tracking-[0.06em] text-black">
          FP&amp;A
        </span>
      </div>
      <UserProfile variant="headerLight" />
    </header>
  )
}
