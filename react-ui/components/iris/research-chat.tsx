"use client"

import type React from "react"

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Zap } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  hasTrace?: boolean
}

export function ResearchChat() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "I'm ready to help you explore your research further. Ask me anything about the findings, request clarifications, or dive deeper into specific topics.",
      hasTrace: false,
    },
  ])
  const [input, setInput] = useState("")

  const handleSend = () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    const assistantMessage: Message = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content:
        "This is a simulated response. In a real implementation, this would connect to your AI backend and provide contextual answers based on the research data.",
      hasTrace: true,
    }

    setMessages([...messages, userMessage, assistantMessage])
    setInput("")
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSend()
    }
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] z-40">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="space-y-4 mb-4 max-h-[300px] overflow-y-auto">
          {messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.role === "user" ? "justify-end" : "justify-start"} animate-in fade-in duration-200`}
            >
              <div
                className={`max-w-[85%] rounded-xl p-4 ${
                  message.role === "user" ? "bg-[#0A0A0A] text-white" : "bg-[#F8F8F8] text-[#0A0A0A]"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <p className="leading-relaxed">{message.content}</p>
                  {message.hasTrace && (
                    <button
                      className="flex-shrink-0 text-[#666666] hover:text-[#0A0A0A] transition-colors"
                      title="View Langfuse trace"
                    >
                      <Zap className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your research..."
            className="flex-1 border-[#E5E5E5] focus:border-[#0A0A0A] rounded-xl"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim()}
            className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl px-6"
          >
            Send
          </Button>
        </div>
      </div>
    </div>
  )
}
