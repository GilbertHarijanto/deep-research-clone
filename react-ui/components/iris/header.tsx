"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { Button } from "@/components/ui/button"
import { AuthButton } from "./auth-button"
import { HistorySidebar } from "./history-sidebar"

export function Header() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <>
      <header className="sticky top-0 z-50 bg-white border-b border-[#E5E5E5] px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setIsSidebarOpen(true)}
              className="h-9 w-9 hover:bg-[#F5F5F5]"
            >
              <Menu className="h-5 w-5" />
            </Button>

            <div className="flex items-center gap-2">
              <span className="text-2xl font-semibold tracking-tight text-[#0A0A0A]">Honda IRIS</span>
              <span className="text-xl text-[#0A0A0A]">◉</span>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <p className="text-sm text-[#666666] tracking-wide hidden sm:block">AI Research Environment</p>
            <AuthButton />
          </div>
        </div>
      </header>

      <HistorySidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
    </>
  )
}
