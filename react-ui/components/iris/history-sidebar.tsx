"use client"

import { useState } from "react"
import { X, Clock, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

interface ResearchSession {
  id: string
  topic: string
  timestamp: Date
  status: "completed" | "in-progress"
}

interface HistorySidebarProps {
  isOpen: boolean
  onClose: () => void
  onSelectSession?: (sessionId: string) => void
}

export function HistorySidebar({ isOpen, onClose, onSelectSession }: HistorySidebarProps) {
  const [searchQuery, setSearchQuery] = useState("")

  // Mock data - will be replaced with Supabase data
  const [sessions] = useState<ResearchSession[]>([
    {
      id: "1",
      topic: "Climate change impact on agriculture",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2),
      status: "completed",
    },
    {
      id: "2",
      topic: "Quantum computing applications",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
      status: "completed",
    },
    {
      id: "3",
      topic: "AI ethics and governance",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24 * 3),
      status: "in-progress",
    },
  ])

  const filteredSessions = sessions.filter((session) => session.topic.toLowerCase().includes(searchQuery.toLowerCase()))

  const formatTimestamp = (date: Date) => {
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const hours = Math.floor(diff / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)

    if (hours < 1) return "Just now"
    if (hours < 24) return `${hours}h ago`
    if (days < 7) return `${days}d ago`
    return date.toLocaleDateString()
  }

  return (
    <>
      {/* Overlay */}
      {isOpen && <div className="fixed inset-0 bg-black/20 z-40 transition-opacity" onClick={onClose} />}

      {/* Sidebar */}
      <div
        className={`fixed left-0 top-0 h-full w-80 bg-white border-r border-[#E5E5E5] z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#E5E5E5]">
            <h2 className="text-lg font-semibold text-[#0A0A0A]">Research History</h2>
            <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8">
              <X className="h-4 w-4" />
            </Button>
          </div>

          {/* Search */}
          <div className="px-6 py-4 border-b border-[#E5E5E5]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#666666]" />
              <Input
                type="text"
                placeholder="Search research..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-[#F5F5F5] border-0 focus-visible:ring-1 focus-visible:ring-[#0A0A0A]"
              />
            </div>
          </div>

          {/* Sessions List */}
          <div className="flex-1 overflow-y-auto">
            {filteredSessions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                <Clock className="h-12 w-12 text-[#CCCCCC] mb-3" />
                <p className="text-sm text-[#666666]">No research sessions found</p>
              </div>
            ) : (
              <div className="py-2">
                {filteredSessions.map((session) => (
                  <button
                    key={session.id}
                    onClick={() => {
                      onSelectSession?.(session.id)
                      onClose()
                    }}
                    className="w-full px-6 py-4 text-left hover:bg-[#F5F5F5] transition-colors border-b border-[#F0F0F0] group"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0A0A0A] line-clamp-2 group-hover:text-[#333333]">
                          {session.topic}
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs text-[#999999]">{formatTimestamp(session.timestamp)}</span>
                          {session.status === "in-progress" && (
                            <span className="text-xs px-2 py-0.5 bg-[#F5F5F5] text-[#666666] rounded">In Progress</span>
                          )}
                        </div>
                      </div>
                      <Clock className="h-4 w-4 text-[#CCCCCC] flex-shrink-0 mt-0.5" />
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-[#E5E5E5]">
            <p className="text-xs text-[#999999] text-center">Sessions will be saved to Supabase</p>
          </div>
        </div>
      </div>
    </>
  )
}
