"use client"

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
import { useUserStore } from "@/store/user"
import { useMessagesStore } from "@/store/messages"
import { cn } from "@/lib/utils"

type UserProfileProps = {
  /** Dark bar (chat header gradient) */
  variant?: "default" | "headerDark"
}

export default function UserProfile({ variant = "default" }: UserProfileProps) {
  const { user } = useUserStore()
  const { clearMessages } = useMessagesStore()
  const router = useRouter()
  const dark = variant === "headerDark"

  const handleLogout = () => {
    clearMessages()
    router.push("/")
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-md px-1.5 py-1 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30",
            dark
              ? "text-white/90 hover:bg-white/10"
              : "text-neutral-900 hover:bg-black/[0.04]"
          )}
        >
          <Avatar className={cn("h-7 w-7", dark && "ring-1 ring-white/20")}>
            <AvatarImage src={user?.image} alt={user?.name} />
            <AvatarFallback
              className={cn(
                "text-[10px] font-medium",
                dark ? "bg-white/15 text-white" : "bg-neutral-900 text-white"
              )}
            >
              {((user?.firstName ?? "")
                .split(" ")
                .filter(Boolean)
                .map((n: string) => n[0])
                .join("") || "U")}
              {((user?.lastName ?? "")
                .split(" ")
                .filter(Boolean)
                .map((n: string) => n[0])
                .join(""))}
            </AvatarFallback>
          </Avatar>
          <span
            className={cn(
              "hidden max-w-[9rem] truncate text-[12px] font-medium sm:inline",
              dark ? "text-white/85" : "text-neutral-900"
            )}
          >
            {user?.firstName} {user?.lastName}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-56 rounded-md border border-[#E0E0E0] bg-[#F7F7F5] p-0 shadow-lg"
      >
        <div className="border-b border-[#E0E0E0] px-3 py-2.5">
          <p className="text-sm font-medium text-black">
            {user?.firstName} {user?.lastName}
          </p>
          <p className="text-[11px] text-neutral-500">{user?.email}</p>
        </div>
        <DropdownMenuSeparator className="m-0 bg-[#E0E0E0]" />
        <DropdownMenuItem
          className="cursor-pointer rounded-none px-3 py-2 text-sm text-black focus:bg-black/[0.04]"
          onClick={handleLogout}
        >
          <Icons.logout className="mr-2 h-4 w-4" />
          Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
