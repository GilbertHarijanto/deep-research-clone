"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Plus, RefreshCw, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"

interface Query {
  id: string
  query: string
  priority: number
}

interface QA {
  question: string
  answer: string
  weight?: number
}

interface InitialQueriesProps {
  onComplete: (queries: Query[]) => void
  isActive: boolean
  isComplete: boolean
  // Receive QA data with weights from ClarifyingQuestions
  clarifyingData?: QA[]
  topic?: string
}

export function InitialQueries({ 
  onComplete, 
  isActive, 
  isComplete, 
  clarifyingData = [],
  topic = ""
}: InitialQueriesProps) {
  const [queries, setQueries] = useState<Query[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editText, setEditText] = useState("")

  // Generate queries when component becomes active and has clarifying data
  useEffect(() => {
    if (isActive && clarifyingData.length > 0 && queries.length === 0) {
      generateQueriesFromAnswers()
    }
  }, [isActive, clarifyingData])

  async function generateQueriesFromAnswers() {
    setLoading(true)
    setError(null)
    
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_queries",
          topic,
          clarifyingData, // Send answers with weights
        }),
      })

      if (!res.ok) throw new Error(`Failed to generate queries (${res.status})`)
      
      const data = await res.json()
      const generatedQueries: Query[] = Array.isArray(data.queries)
        ? data.queries.map((q: any, i: number) => ({
            id: `q-${Date.now()}-${i}`,
            query: typeof q === 'string' ? q : q.query,
            // Use weight from corresponding answer, or default to 3
            priority: clarifyingData[i]?.weight || 3,
          }))
        : []

      setQueries(generatedQueries)
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate queries")
      // Fallback to sample queries
      setQueries([
        { id: "q-1", query: `Research query about ${topic}`, priority: 3 },
        { id: "q-2", query: `Analysis of key aspects of ${topic}`, priority: 3 },
        { id: "q-3", query: `Recent developments in ${topic}`, priority: 3 },
      ])
    } finally {
      setLoading(false)
    }
  }

  async function generateAlternatives() {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate_alternative_queries",
          topic,
          clarifyingData,
          currentQueries: queries.map(q => q.query),
        }),
      })

      if (!res.ok) throw new Error(`Failed to generate alternatives (${res.status})`)
      
      const data = await res.json()
      const altQueries: Query[] = Array.isArray(data.queries)
        ? data.queries.map((q: any, i: number) => ({
            id: `q-alt-${Date.now()}-${i}`,
            query: typeof q === 'string' ? q : q.query,
            priority: 3,
          }))
        : []

      setQueries(altQueries)
    } catch (e: any) {
      setError(e?.message ?? "Failed to generate alternatives")
    } finally {
      setLoading(false)
    }
  }

  const updatePriority = (id: string, priority: number) => {
    setQueries(queries.map((q) => (q.id === id ? { ...q, priority } : q)))
  }

  const addQuery = () => {
    const newQuery: Query = {
      id: `q-${Date.now()}`,
      query: "",
      priority: 3,
    }
    setQueries([...queries, newQuery])
    setEditingId(newQuery.id)
    setEditText("")
  }

  const startEdit = (query: Query) => {
    setEditingId(query.id)
    setEditText(query.query)
  }

  const saveEdit = (id: string) => {
    if (editText.trim()) {
      setQueries(queries.map((q) => (q.id === id ? { ...q, query: editText.trim() } : q)))
    }
    setEditingId(null)
    setEditText("")
  }

  const deleteQuery = (id: string) => {
    setQueries(queries.filter((q) => q.id !== id))
  }

  // Completed state (isComplete)
  if (isComplete) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">Research Queries</h2>
          <div className="space-y-3">
            {queries.map((query) => (
              <div key={query.id} className="flex items-center gap-3 text-sm">
                <span className="text-[#999999] min-w-[80px]">Priority {query.priority}</span>
                <span className="text-[#0A0A0A]">{query.query}</span>
              </div>
            ))}
          </div>
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
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">Initial Queries</h2>
          <div className="flex gap-2">
            <Button
              onClick={generateAlternatives}
              variant="ghost"
              size="sm"
              className="text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-xl"
              disabled={loading || queries.length === 0}
            >
              {loading ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4 mr-2" />
              )}
              Generate Alternatives
            </Button>
            <Button 
              onClick={addQuery} 
              variant="ghost" 
              size="sm" 
              className="text-[#0A0A0A] hover:bg-[#F8F8F8] rounded-xl"
              disabled={loading}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Query
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-amber-600 text-sm bg-amber-50 border border-amber-200 rounded-md p-3">
            {error}
          </div>
        )}

        {loading && queries.length === 0 && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-[#666666]" />
            <span className="ml-3 text-[#666666]">Generating queries based on your answers...</span>
          </div>
        )}

        <div className="space-y-4">
          {queries.map((query, index) => (
            <Card key={query.id} className="p-5 border-[#E5E5E5] rounded-xl hover:border-[#0A0A0A] transition-colors">
              <div className="space-y-4">
                {editingId === query.id ? (
                  <div className="space-y-2">
                    <Input
                      value={editText}
                      onChange={(e) => setEditText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(query.id)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      placeholder="Enter your research query..."
                      className="border-[#E5E5E5] focus:border-[#0A0A0A] rounded-xl"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <Button
                        onClick={() => saveEdit(query.id)}
                        size="sm"
                        className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl"
                      >
                        Save
                      </Button>
                      <Button
                        onClick={() => setEditingId(null)}
                        size="sm"
                        variant="outline"
                        className="rounded-xl"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-[#0A0A0A] leading-relaxed flex-1">
                      {query.query || <span className="text-[#999999] italic">Empty query - click Edit to add text</span>}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => startEdit(query)}
                        size="sm"
                        variant="ghost"
                        className="text-[#666666] hover:text-[#0A0A0A] h-8 px-3"
                      >
                        Edit
                      </Button>
                      <Button
                        onClick={() => deleteQuery(query.id)}
                        size="sm"
                        variant="ghost"
                        className="text-[#666666] hover:text-red-600 h-8 px-3"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-4">
                  <span className="text-sm text-[#666666] min-w-[80px]">Priority: {query.priority}</span>
                  <Slider
                    value={[query.priority]}
                    onValueChange={([value]) => updatePriority(query.id, value)}
                    min={1}
                    max={5}
                    step={1}
                    className="flex-1"
                    disabled={loading}
                  />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => updatePriority(query.id, val)}
                        disabled={loading}
                        className={`w-7 h-7 rounded-lg border text-xs transition-colors ${
                          query.priority === val
                            ? 'bg-[#0A0A0A] text-white border-[#0A0A0A]'
                            : 'bg-white text-[#666666] border-[#E5E5E5] hover:border-[#0A0A0A]'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {queries.length === 0 && !loading && (
          <div className="text-center py-8 text-[#666666]">
            <p>No queries yet. They will be generated automatically from your answers.</p>
          </div>
        )}

        <div className="flex justify-end">
          <Button
            onClick={() => onComplete(queries)}
            className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl px-8"
            disabled={queries.length === 0 || queries.some(q => !q.query.trim()) || loading}
          >
            Run Research
          </Button>
        </div>
      </div>
    </div>
  )
}