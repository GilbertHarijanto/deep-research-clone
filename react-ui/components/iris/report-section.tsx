"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Download, RefreshCw, Loader2, ExternalLink, FileText, FileJson, Copy, Check } from "lucide-react"
import React from "react"

interface ReportSectionProps {
  onComplete: (markdown: string, structured: any) => void // ← 변경
  isActive: boolean
  isComplete: boolean
  queries: Array<{ id: string; query: string; priority: number }>
  topic: string
  clarifyingData?: Array<{
    question: string
    answer: string
    weight?: number
  }>
}

interface Citation {
  number: number
  title: string
  url: string
}

interface StructuredReport {
  title: string
  executiveSummary: string
  keyFindings: Array<{
    theme: string
    findings: string[]
    citations: number[]
  }>
  detailedAnalysis: {
    sections: Array<{
      heading: string
      content: string
      citations: number[]
    }>
  }
  recommendations: Array<{
    title: string
    description: string
    priority: string
    citations: number[]
  }>
  implementationConsiderations: {
    challenges: string[]
    bestPractices: string[]
    pitfalls: string[]
    resourceRequirements: {
      time: string
      cost: string
      skills: string[]
    }
  }
  researchGaps: string[]
  conclusion: string
  references: Array<{
    id: number
    title: string
    url: string
    source: string
  }>
}

export function ReportSection({
  onComplete,
  isActive,
  isComplete,
  queries,
  topic,
  clarifyingData,
}: ReportSectionProps) {
  const [markdown, setMarkdown] = useState("")
  const [structured, setStructured] = useState<StructuredReport | null>(null)
  const [metadata, setMetadata] = useState<any>(null)
  const [citations, setCitations] = useState<Citation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copiedMarkdown, setCopiedMarkdown] = useState(false)
  const [copiedJSON, setCopiedJSON] = useState(false)
  const [showJSON, setShowJSON] = useState(false)

  // Generate report when component becomes active
  useEffect(() => {
    if (isActive && !markdown) {
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
          clarifyingData,
        }),
      })

      if (!res.ok) {
        const errorData = await res.json()
        throw new Error(errorData.error || `Failed to generate report (${res.status})`)
      }

      const data = await res.json()
      
      setMarkdown(data.markdown || "")
      setStructured(data.structured || null)
      setMetadata(data.metadata || null)
      
      if (data.markdown) {
        const extractedCitations = extractCitations(data.markdown)
        setCitations(extractedCitations)
      }
    } catch (e: any) {
      console.error("Report generation error:", e)
      setError(e?.message ?? "Failed to generate report")
      setMarkdown(getFallbackReport())
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
    setMarkdown("")
    setStructured(null)
    setMetadata(null)
    setCitations([])
    generateReport()
  }

  const handleDownloadMarkdown = () => {
    const blob = new Blob([markdown], { type: "text/markdown" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${topic.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleDownloadJSON = () => {
    if (!structured) return
    
    const blob = new Blob([JSON.stringify(structured, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `${topic.replace(/\s+/g, "-").toLowerCase()}-${Date.now()}.json`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown)
      setCopiedMarkdown(true)
      setTimeout(() => setCopiedMarkdown(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  const handleCopyJSON = async () => {
    if (!structured) return
    
    try {
      await navigator.clipboard.writeText(JSON.stringify(structured, null, 2))
      setCopiedJSON(true)
      setTimeout(() => setCopiedJSON(false), 2000)
    } catch (err) {
      console.error("Failed to copy:", err)
    }
  }

  // ✅ Parse inline citations like [1], [2] and make them clickable
  function parseInlineCitations(text: string): React.ReactNode {
    const parts = text.split(/(\[\d+\])/)
    return (
      <React.Fragment>
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
          return <React.Fragment key={index}>{part}</React.Fragment>
        })}
      </React.Fragment>
    )
  }

  // ✅ Render markdown-like content
  function renderReportContent() {
    const lines = markdown.split("\n")
    const elements: React.ReactElement[] = []
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

  if (!isActive && !isComplete) return null

  return (
    <div className="animate-in fade-in duration-200">
      <div className="space-y-6">
        {/* Header with actions */}
        {!isComplete && (
          <div className="flex items-center justify-between sticky top-0 bg-white py-4 z-10 border-b border-[#E5E5E5]">
            <div>
              <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">
                Research Report
              </h2>
              {metadata && (
                <p className="text-xs text-[#999999] mt-1">
                  {metadata.queriesSearched} queries • {metadata.totalSources} sources • {new Date(metadata.timestamp).toLocaleString()}
                </p>
              )}
            </div>

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

              {/* Markdown actions */}
              <Button
                onClick={handleDownloadMarkdown}
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!markdown || loading}
              >
                <FileText className="w-4 h-4 mr-2" />
                Download MD
              </Button>
              <Button
                onClick={handleCopyMarkdown}
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!markdown || loading}
              >
                {copiedMarkdown ? (
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copiedMarkdown ? "Copied!" : "Copy MD"}
              </Button>

              {/* JSON actions */}
              <Button
                onClick={handleDownloadJSON}
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!structured || loading}
              >
                <FileJson className="w-4 h-4 mr-2" />
                Download JSON
              </Button>
              <Button
                onClick={handleCopyJSON}
                variant="outline"
                size="sm"
                className="rounded-xl"
                disabled={!structured || loading}
              >
                {copiedJSON ? (
                  <Check className="w-4 h-4 mr-2 text-green-600" />
                ) : (
                  <Copy className="w-4 h-4 mr-2" />
                )}
                {copiedJSON ? "Copied!" : "Copy JSON"}
              </Button>
            </div>
          </div>
        )}

        {/* Completed state header - more compact */}
        {isComplete && markdown && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">
                Research Report
              </h2>
              <div className="flex gap-2">
                <Button
                  onClick={handleDownloadMarkdown}
                  variant="ghost"
                  size="sm"
                  className="text-[#666666] hover:text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-xl"
                  disabled={!markdown}
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Download MD
                </Button>
                <Button
                  onClick={handleDownloadJSON}
                  variant="ghost"
                  size="sm"
                  className="text-[#666666] hover:text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-xl"
                  disabled={!structured}
                >
                  <FileJson className="w-4 h-4 mr-2" />
                  Download JSON
                </Button>
              </div>
            </div>
            <div className="h-px bg-[#E5E5E5]" />
          </div>
        )}

        {error && (
          <div className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-3">
            {error}
          </div>
        )}

        {loading && !markdown && (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <Loader2 className="w-8 h-8 animate-spin text-[#0A0A0A]" />
            <div className="text-center space-y-2">
              <p className="text-[#0A0A0A] font-medium">Researching your topic...</p>
              <p className="text-sm text-[#666666]">
                Searching {queries.length} queries and analyzing results
              </p>
              <p className="text-xs text-[#999999]">
                This may take 30-60 seconds
              </p>
            </div>
          </div>
        )}

        {markdown && (
          <>
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

            {/* Optional: JSON Preview (collapsible) */}
            {structured && (
              <details 
                className="border border-[#E5E5E5] rounded-xl p-4"
                open={showJSON}
                onToggle={(e) => setShowJSON((e.target as HTMLDetailsElement).open)}
              >
                <summary className="cursor-pointer font-medium text-[#0A0A0A] flex items-center gap-2">
                  <FileJson className="w-4 h-4" />
                  View Structured JSON Data
                  <span className="text-xs text-[#666666] ml-2">
                    (for LLM processing)
                  </span>
                </summary>
                <pre className="mt-4 text-xs bg-[#F8F8F8] p-4 rounded overflow-auto max-h-[500px] border border-[#E5E5E5]">
                  {JSON.stringify(structured, null, 2)}
                </pre>
              </details>
            )}

            {!isComplete && (
              <div className="flex justify-end pt-4">
                <Button
                  onClick={() => onComplete(markdown, structured)}
                  className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl px-8"
                  disabled={loading}
                >
                  Continue to Chat
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}