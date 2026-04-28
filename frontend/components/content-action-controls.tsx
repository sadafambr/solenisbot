"use client"

import { useState, useCallback } from "react"
import { Check, Copy, Download } from "lucide-react"
import type { TableData } from "@/lib/types"
import {
  downloadSummaryCsv,
  downloadSummaryExcel,
  downloadTableCsv,
  downloadTableExcel,
  tableDataToMarkdown,
} from "@/lib/table-export"
import { cn } from "@/lib/utils"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const actionIconBtn =
  "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-black/[0.08] bg-white/35 text-black/70 shadow-none backdrop-blur-sm outline-none transition-all duration-200 hover:border-black/15 hover:bg-white/55 hover:text-black hover:brightness-[1.02] focus-visible:ring-2 focus-visible:ring-black/15 active:brightness-[0.98] disabled:pointer-events-none disabled:opacity-40"

type ContentActionControlsProps =
  | { variant: "summary"; summaryText: string }
  | { variant: "table"; tableData: TableData }

export function ContentActionControls(props: ContentActionControlsProps) {
  const [copied, setCopied] = useState(false)

  const copyPayload = useCallback(async () => {
    let text = ""
    if (props.variant === "summary") {
      text = props.summaryText
    } else {
      text = tableDataToMarkdown(props.tableData)
    }
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      window.prompt("Copy:", text)
    }
  }, [props])

  const onDownloadCsv = () => {
    if (props.variant === "summary") {
      downloadSummaryCsv(props.summaryText)
    } else {
      downloadTableCsv(props.tableData)
    }
  }

  const onDownloadExcel = () => {
    if (props.variant === "summary") {
      downloadSummaryExcel(props.summaryText)
    } else {
      downloadTableExcel(props.tableData)
    }
  }

  return (
    <TooltipProvider delayDuration={250}>
      <div className="flex items-center gap-1.5" role="toolbar" aria-label="Content actions">
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              className={cn(actionIconBtn, copied && "border-teal-700/20 bg-teal-600/12 text-teal-950")}
              onClick={() => void copyPayload()}
              aria-label={copied ? "Copied to clipboard" : "Copy to clipboard"}
            >
              {copied ? (
                <Check className="h-4 w-4" strokeWidth={2} aria-hidden />
              ) : (
                <Copy className="h-4 w-4" strokeWidth={1.75} aria-hidden />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="bottom"
            className="border border-black/10 bg-white/90 font-sans text-xs text-black shadow-md backdrop-blur-md"
          >
            {copied ? "Copied" : "Copy"}
          </TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className={actionIconBtn}
              aria-label="Download"
              aria-haspopup="menu"
            >
              <Download className="h-4 w-4" strokeWidth={1.75} aria-hidden />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            className="min-w-[12rem] rounded-xl border border-white/50 bg-white/88 font-sans shadow-[0_8px_30px_-8px_rgba(0,0,0,0.14)] backdrop-blur-[14px] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2"
          >
            <DropdownMenuItem className="cursor-pointer rounded-lg font-sans text-sm focus:bg-black/[0.06]" onSelect={onDownloadCsv}>
              Download as CSV
            </DropdownMenuItem>
            <DropdownMenuItem
              className="cursor-pointer rounded-lg font-sans text-sm focus:bg-black/[0.06]"
              onSelect={onDownloadExcel}
            >
              Download as Excel
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </TooltipProvider>
  )
}
