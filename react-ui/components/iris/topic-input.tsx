"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"

interface TopicInputProps {
  onSubmit: (topic: string) => void
  isComplete: boolean
  value: string
}

export function TopicInput({ onSubmit, isComplete, value }: TopicInputProps) {
  const [inputValue, setInputValue] = useState(value)

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && inputValue.trim()) {
      onSubmit(inputValue)
    }
  }

  if (isComplete) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">Research Topic</h2>
          <p className="text-xl text-[#0A0A0A] leading-relaxed">{value}</p>
        </div>
        <div className="mt-6 h-px bg-[#E5E5E5]" />
      </div>
    )
  }

  return (
    <div className="animate-in fade-in duration-200 pt-12">
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-semibold text-[#0A0A0A] tracking-tight">What would you like to research?</h1>
          <p className="text-[#666666]">Enter your research topic to begin</p>
        </div>

        <div className="max-w-2xl mx-auto space-y-2">
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g., The impact of AI on healthcare systems"
            className="h-14 text-lg border-[#E5E5E5] focus:border-[#0A0A0A] rounded-xl transition-colors"
            autoFocus
          />
          <p className="text-sm text-[#999999] text-center">Press Enter to continue</p>
        </div>
      </div>
    </div>
  )
}
