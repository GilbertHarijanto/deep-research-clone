"use client"

import { useState, useEffect } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronUp, ExternalLink } from "lucide-react"

interface Query {
  id: string
  query: string
  priority: number
}

interface RunResearchProps {
  queries: Query[]
  onComplete: () => void
  isActive: boolean
  isComplete: boolean
}

interface SearchResult {
  queryId: string
  title: string
  summary: string
  url: string
}

export function RunResearch({ queries, onComplete, isActive, isComplete }: RunResearchProps) {
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<SearchResult[]>([])
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (isActive && progress < 100) {
      const timer = setInterval(() => {
        setProgress((prev) => {
          const next = prev + 10
          if (next >= 100) {
            clearInterval(timer)
            // Simulate results
            const mockResults: SearchResult[] = queries.flatMap((q) => [
              {
                queryId: q.id,
                title: `Research finding for: ${q.query}`,
                summary:
                  "This is a comprehensive summary of the research findings related to this query. It includes key insights, data points, and relevant context.",
                url: "https://example.com/research",
              },
            ])
            setResults(mockResults)
          }
          return Math.min(next, 100)
        })
      }, 300)
      return () => clearInterval(timer)
    }
  }, [isActive, progress, queries])

  const toggleExpand = (resultId: string) => {
    setExpandedResults((prev) => {
      const next = new Set(prev)
      if (next.has(resultId)) {
        next.delete(resultId)
      } else {
        next.add(resultId)
      }
      return next
    })
  }

  if (isComplete) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">Research Complete</h2>
          <p className="text-[#0A0A0A]">{results.length} results collected</p>
        </div>
        <div className="mt-6 h-px bg-[#E5E5E5]" />
      </div>
    )
  }

  if (!isActive) return null

  return (
    <div className="animate-in fade-in duration-200">
      <div className="space-y-6">
        <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">Running Research</h2>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="h-1 bg-[#F0F0F0] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#0A0A0A] transition-all duration-300 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-sm text-[#666666]">{progress}% complete</p>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="space-y-3">
            {results.map((result, index) => {
              const resultId = `${result.queryId}-${index}`
              const isExpanded = expandedResults.has(resultId)

              return (
                <Card
                  key={resultId}
                  className="border-[#E5E5E5] rounded-xl overflow-hidden hover:border-[#0A0A0A] transition-colors"
                >
                  <button
                    onClick={() => toggleExpand(resultId)}
                    className="w-full p-5 text-left flex items-start justify-between gap-4 hover:bg-[#FAFAFA] transition-colors"
                  >
                    <div className="flex-1 space-y-2">
                      <h3 className="font-medium text-[#0A0A0A]">{result.title}</h3>
                      {isExpanded && (
                        <div className="space-y-3 animate-in fade-in duration-200">
                          <p className="text-sm text-[#666666] leading-relaxed">{result.summary}</p>
                          <a
                            href={result.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-sm text-[#0A0A0A] hover:underline"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View source
                            <ExternalLink className="w-3 h-3" />
                          </a>
                        </div>
                      )}
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-[#666666] flex-shrink-0" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-[#666666] flex-shrink-0" />
                    )}
                  </button>
                </Card>
              )
            })}
          </div>
        )}

        {progress === 100 && (
          <div className="flex justify-end">
            <Button onClick={onComplete} className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl px-8">
              Generate Report
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
