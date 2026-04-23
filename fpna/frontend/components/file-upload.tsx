"use client"

import type React from "react"

import { useState } from "react"
import { Upload, X, FileSpreadsheet, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

interface FileUploadProps {
  onFileSelect: (file: File) => void
  isUploading?: boolean
  progress?: number
  className?: string
  acceptedFileTypes?: string
  maxSizeMB?: number
}

export default function FileUpload({
  onFileSelect,
  isUploading = false,
  progress = 0,
  className,
  acceptedFileTypes = ".xlsx,.xls,.csv",
  maxSizeMB = 10,
}: FileUploadProps) {
  const [dragActive, setDragActive] = useState(false)
  const [fileError, setFileError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const validateFile = (file: File): boolean => {
    // Check file type
    const fileType = file.name.split(".").pop()?.toLowerCase()
    const validTypes = acceptedFileTypes.split(",").map((type) => type.replace(".", "").toLowerCase())

    if (!fileType || !validTypes.includes(fileType)) {
      setFileError(`Invalid file type. Please upload ${acceptedFileTypes} files.`)
      return false
    }

    // Check file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > maxSizeMB) {
      setFileError(`File size exceeds ${maxSizeMB}MB limit.`)
      return false
    }

    setFileError(null)
    return true
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0]
      if (validateFile(file)) {
        setSelectedFile(file)
        onFileSelect(file)
      }
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault()
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      if (validateFile(file)) {
        setSelectedFile(file)
        onFileSelect(file)
      }
    }
  }

  const handleRemoveFile = () => {
    setSelectedFile(null)
    setFileError(null)
  }

  return (
    <div className={cn("w-full", className)}>
      {!selectedFile && !isUploading ? (
        <div
          className={cn(
            "relative flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-6 transition-colors",
            dragActive ? "border-primary bg-primary/5" : "border-gray-300 bg-gray-50 hover:bg-gray-100",
            fileError && "border-red-500 bg-red-50",
          )}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            id="file-upload"
            className="absolute inset-0 cursor-pointer opacity-0"
            accept={acceptedFileTypes}
            onChange={handleChange}
          />

          <div className="flex flex-col items-center justify-center text-center">
            {fileError ? (
              <>
                <AlertCircle className="mb-2 h-10 w-10 text-red-500" />
                <p className="mb-2 text-sm font-medium text-red-500">{fileError}</p>
              </>
            ) : (
              <>
                <Upload className="mb-2 h-10 w-10 text-gray-400" />
                <p className="mb-2 text-sm font-medium text-gray-700">
                  Drag and drop your Excel file, or <span className="text-primary">browse</span>
                </p>
                <p className="text-xs text-gray-500">
                  Supports {acceptedFileTypes.replace(/\./g, "")} files up to {maxSizeMB}MB
                </p>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border bg-white p-4">
          {isUploading ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Uploading...</span>
                <span className="text-xs text-gray-500">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium truncate max-w-[200px]">{selectedFile?.name}</p>
                  <p className="text-xs text-gray-500">
                    {selectedFile?.size ? (selectedFile.size / 1024).toFixed(1) : "0"} KB
                  </p>
                </div>
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" onClick={handleRemoveFile} className="h-8 w-8">
                      <X className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Remove file</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

