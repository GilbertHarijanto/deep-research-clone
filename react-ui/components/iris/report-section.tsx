"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, RefreshCw, Loader2, ExternalLink } from "lucide-react"
import type { JSX } from "react"

interface ReportSectionProps {
  onComplete: () => void
  isActive: boolean
  isComplete: boolean
  queries: Array<{ id: string; query: string; priority: number }>
  topic: string
}

interface Citation {
  number: number
  title: string
  url: string
}

export function ReportSection({
  onComplete,
  isActive,
  isComplete,
  queries,
  topic,
}: ReportSectionProps) {
  const [report, setReport] = useState("")
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Generate report when component becomes active
  useEffect(() => {
    if (isActive && !report) {
      generateReport()
    }
  }, [isActive])

  async function generateReport() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "synthesize_report",
          topic,
          queries,
        }),
      })

      if (!res.ok) throw new Error(`Failed to generate report (${res.status})`)

      const data = await res.json()
      const reportContent = data.report || ""
      const extractedCitations = extractCitations(reportContent)

      setReport(reportContent)
      setCitations(extractedCitations)
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate report")
      setReport(getFallbackReport())
    } finally {
      setLoading(false)
    }
  }

  function extractCitations(reportText: string): Citation[] {
    // Extract citations in format [n] Title – URL
    const citationRegex = /\[(\d+)\]\s*([^–\n]+)\s*–\s*(https?:\/\/[^\s\n]+)/g
    const matches = [...reportText.matchAll(citationRegex)]
    return matches.map((match) => ({
      number: parseInt(match[1]),
      title: match[2].trim(),
      url: match[3].trim(),
    }))
  }

  function getFallbackReport(): string {
    return `# Research Report: ${topic}

## Executive Summary
This report provides an overview of ${topic} based on available research and current developments.

## Key Findings
### 1. Overview
Research indicates that ${topic} is an emerging area with significant potential for innovation and practical applications.

### 2. Current Applications
Various implementations demonstrate the viability and effectiveness of approaches related to ${topic}.

### 3. Future Directions
Ongoing developments suggest promising opportunities for further exploration and refinement.

## References
Please run the research queries to generate a comprehensive report with proper citations.`
  }

  const handleRegenerate = () => {
    setReport("")
    setCitations([])
    generateReport()
  }

  const handleDownload = () => {
    const blob = new Blob([report], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `research-report-${topic.replace(/\s+/g, "-").toLowerCase()}.md`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ✅ Parse inline citations like [1], [2] and make them clickable
  function parseInlineCitations(text: string) {
    const parts = text.split(/(\[\d+\])/)
    return (
      <>
        {parts.map((part, index) => {
          const match = part.match(/\[(\d+)\]/)
          if (match) {
            const citationNum = parseInt(match[1])
            return (
              <sup key={`cite-${index}`}>
                <a
                  href={`#ref-${citationNum}`}
                  className="text-blue-600 hover:text-blue-800 font-medium"
                  title={`See reference ${citationNum}`}
                >
                  [{citationNum}]
                </a>
              </sup>
            )
          }
          return part
        })}
      </>
    )
  }

  // ✅ Render markdown-like content
  function renderReportContent() {
    const lines = report.split("\n")
    const elements: JSX.Element[] = []
    let currentParagraph = ""
    let inReferenceSection = false

    lines.forEach((line, index) => {
      const trimmed = line.trim()

      // Enter reference section
      if (trimmed.match(/^##\s+References?$/i)) {
        inReferenceSection = true
        if (currentParagraph) {
          elements.push(
            <p key={`p-${index}`} className="leading-relaxed text-[#333333] mb-4">
              {parseInlineCitations(currentParagraph)}
            </p>
          )
          currentParagraph = ""
        }
        elements.push(
          <h2 key={index} className="text-xl font-semibold mt-8 mb-4 text-[#0A0A0A]">
            {trimmed.slice(3)}
          </h2>
        )
        return
      }

      if (inReferenceSection && trimmed.match(/^\[\d+\]/)) return

      if (trimmed.startsWith("# ")) {
        if (currentParagraph) {
          elements.push(
            <p key={`p-${index}`} className="leading-relaxed text-[#333333] mb-4">
              {parseInlineCitations(currentParagraph)}
            </p>
          )
          currentParagraph = ""
        }
        elements.push(
          <h1 key={index} className="text-3xl font-semibold mb-6 text-[#0A0A0A]">
            {trimmed.slice(2)}
          </h1>
        )
      } else if (trimmed.startsWith("## ")) {
        if (currentParagraph) {
          elements.push(
            <p key={`p-${index}`} className="leading-relaxed text-[#333333] mb-4">
              {parseInlineCitations(currentParagraph)}
            </p>
          )
          currentParagraph = ""
        }
        elements.push(
          <h2 key={index} className="text-xl font-semibold mt-8 mb-4 text-[#0A0A0A]">
            {trimmed.slice(3)}
          </h2>
        )
      } else if (trimmed.startsWith("### ")) {
        if (currentParagraph) {
          elements.push(
            <p key={`p-${index}`} className="leading-relaxed text-[#333333] mb-4">
              {parseInlineCitations(currentParagraph)}
            </p>
          )
          currentParagraph = ""
        }
        elements.push(
          <h3 key={index} className="text-lg font-medium mt-6 mb-3 text-[#0A0A0A]">
            {trimmed.slice(4)}
          </h3>
        )
      } else if (trimmed === "") {
        if (currentParagraph) {
          elements.push(
            <p key={`p-${index}`} className="leading-relaxed text-[#333333] mb-4">
              {parseInlineCitations(currentParagraph)}
            </p>
          )
          currentParagraph = ""
        }
      } else {
        currentParagraph += (currentParagraph ? " " : "") + trimmed
      }
    })

    if (currentParagraph) {
      elements.push(
        <p key="p-final" className="leading-relaxed text-[#333333] mb-4">
          {parseInlineCitations(currentParagraph)}
        </p>
      )
    }

    return elements
  }

  // ✅ Completed state
  if (isComplete) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">
            Report Generated
          </h2>
          <p className="text-[#0A0A0A]">
            Research report is ready with {citations.length} citations
          </p>
        </div>
        <div className="mt-6 h-px bg-[#E5E5E5]" />
      </div>
    )
  }

  if (!isActive) return null

  return (
    <div className="animate-in fade-in duration-200">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">
            Research Report
          </h2>
          <div className="flex gap-2">
            <Button
              onClick={handleRegenerate}
              variant="ghost"
              size="sm"
              className="text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-xl"
              disabled={loading}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Regenerate
            </Button>
            <Button
              onClick={handleDownload}
              variant="ghost"
              size="sm"
              className="text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-xl"
              disabled={!report || loading}
            >
              <Download className="w-4 h-4 mr-2" />
              Download
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-3">
            {error}
          </div>
        )}

        {loading && !report && (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-[#666666]" />
            <span className="ml-3 text-[#666666]">
              Generating comprehensive research report...
            </span>
          </div>
        )}

        {report && (
          <Card className="border-[#E5E5E5] rounded-xl p-8">
            <div className="prose prose-sm max-w-none">
              <div className="space-y-2 text-[#0A0A0A]">
                {renderReportContent()}
              </div>

              {/* ✅ Citations Section */}
              {citations.length > 0 && (
                <div className="mt-12 pt-8 border-t border-[#E5E5E5]">
                  <h2 className="text-xl font-semibold mb-6 text-[#0A0A0A]">
                    References
                  </h2>
                  <div className="space-y-3">
                    {citations.map((citation) => (
                      <div
                        key={citation.number}
                        id={`ref-${citation.number}`}
                        className="flex gap-3 text-sm group hover:bg-[#F8F8F8] p-2 rounded-lg transition-colors"
                      >
                        <span className="text-[#666666] font-medium min-w-[30px]">
                          [{citation.number}]
                        </span>
                        <div className="flex-1">
                          <span className="text-[#0A0A0A]">{citation.title}</span>
                          <a
                            href={citation.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:text-blue-800 ml-2 inline-flex items-center gap-1"
                          >
                            <ExternalLink className="w-3 h-3" />
                            <span className="text-xs">
                              {new URL(citation.url).hostname}
                            </span>
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>
        )}

        <div className="flex justify-end">
          <Button
            onClick={onComplete}
            className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl px-8"
            disabled={!report || loading}
          >
            Continue to Chat
          </Button>
        </div>
      </div>
    </div>
  )
}
