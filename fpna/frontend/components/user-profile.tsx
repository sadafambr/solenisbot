"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Icons } from "@/components/icons"
import { useMessagesStore } from "@/store/messages"

export default function UserProfile() {
  const { clearMessages } = useMessagesStore()
  const router = useRouter()

  const handleLogout = () => {
    // In a real app, you would handle logout logic here
    clearMessages()
    router.push("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center space-x-2 rounded-full p-1 transition-colors hover:bg-slate-100 focus:outline-none">
          <Avatar className="h-8 w-8">
            <AvatarImage alt="Guest User" />
            <AvatarFallback>GU</AvatarFallback>
          </Avatar>
          <span className="text-sm font-medium">Guest User</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex items-center justify-start gap-2 p-2">
          <div className="flex flex-col space-y-1 leading-none">
            <p className="font-medium">Guest User</p>
            <p className="text-xs text-slate-500">Authentication disabled</p>
          </div>
        </div>
        {/* <DropdownMenuSeparator />
        <DropdownMenuItem>
          <Icons.user className="mr-2 h-4 w-4" />
          <span>Profile</span>
        </DropdownMenuItem>
        <DropdownMenuItem>
          <Icons.settings className="mr-2 h-4 w-4" />
          <span>Settings</span>
        </DropdownMenuItem> */}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <Icons.logout className="mr-2 h-4 w-4" />
          <span>Clear chat</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

