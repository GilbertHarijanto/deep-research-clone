"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Zap, Loader2 } from "lucide-react"

interface Message {
  id: string
  role: "user" | "assistant"
  content: string
  hasTrace?: boolean
  traceUrl?: string
}

interface ResearchChatProps {
  topic: string
  markdown: string
  structured: any
  isActive: boolean
}

export function ResearchChat({ topic, markdown, structured, isActive }: ResearchChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [loading, setLoading] = useState(false)

  // Initialize chat when activated
  useEffect(() => {
    if (isActive && messages.length === 0) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content: `I've analyzed the research report on "${topic}". I can help you:

- Clarify any findings or concepts
- Explore specific sections in more detail
- Answer questions about the sources
- Discuss implementation strategies
- Compare different approaches mentioned

What would you like to know?`,
          hasTrace: false,
        },
      ])
    }
  }, [isActive, topic])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input,
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setLoading(true)

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          topic,
          markdown,
          structured,
          messages: [...messages, userMessage].map((m) => ({
            role: m.role,
            content: m.content,
          })),
          userQuery: input,
        }),
      })

      if (!res.ok) throw new Error("Failed to get response")

      const data = await res.json()

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: data.response || "I apologize, but I couldn't generate a response.",
        hasTrace: true,
        traceUrl: data.traceUrl,
      }

      setMessages((prev) => [...prev, assistantMessage])
    } catch (error) {
      console.error("Chat error:", error)
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: "I'm sorry, I encountered an error. Please try again.",
        hasTrace: false,
      }
      setMessages((prev) => [...prev, errorMessage])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!isActive) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-[#E5E5E5] z-40">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="space-y-4 mb-4 max-h-[400px] overflow-y-auto">
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
                  <p className="leading-relaxed whitespace-pre-wrap">{message.content}</p>
                  {message.hasTrace && message.traceUrl && (
                    <a
                      href={message.traceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-shrink-0 text-[#666666] hover:text-[#0A0A0A] transition-colors"
                      title="View Langfuse trace"
                    >
                      <Zap className="w-4 h-4" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
          
          {loading && (
            <div className="flex justify-start animate-in fade-in duration-200">
              <div className="max-w-[85%] rounded-xl p-4 bg-[#F8F8F8] text-[#0A0A0A]">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm text-[#666666]">Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your research..."
            className="flex-1 border-[#E5E5E5] focus:border-[#0A0A0A] rounded-xl"
            disabled={loading}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl px-6"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send"}
          </Button>
        </div>
      </div>
    </div>
  )
}