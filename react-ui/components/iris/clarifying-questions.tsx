"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"

interface QA {
  question: string
  answer: string
  weight?: number  // Priority weight for this answer
}

interface ClarifyingQuestionsProps {
  topic: string
  onComplete: (questions: QA[]) => void
  isActive: boolean
  isComplete: boolean
}

const MAX_QUESTIONS = 5 // Maximum number of clarifying questions

export function ClarifyingQuestions({
  topic,
  onComplete,
  isActive,
  isComplete,
}: ClarifyingQuestionsProps) {
  const [questions, setQuestions] = useState<string[]>([]) 
  const [answers, setAnswers] = useState<QA[]>([])
  const [currentAnswer, setCurrentAnswer] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  
  // Weight assignment phase state
  const [isWeightingPhase, setIsWeightingPhase] = useState(false)
  const [weights, setWeights] = useState<number[]>([])

  const currentIndex = answers.length
  const currentQuestion = questions[currentIndex] ?? ""

  useEffect(() => {
    if (!isActive || !topic) return
    let cancelled = false

    async function bootstrap() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "generate_questions", topic }),
        })
        if (!res.ok) throw new Error(`Failed to generate questions (${res.status})`)
        const data = await res.json()
        if (!cancelled) {
          const list = Array.isArray(data.questions) ? data.questions : []
          // Limit to max 5 questions
          setQuestions(
            list.length > 0
              ? list.slice(0, MAX_QUESTIONS)
              : [
                  "What specific aspect of this topic are you most interested in exploring?",
                  "What would you like to learn or achieve from this research?",
                  "Are there any specific constraints or context I should know about?",
                ].slice(0, MAX_QUESTIONS)
          )
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? "Failed to load clarifying questions.")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    setQuestions([])
    setAnswers([])
    setCurrentAnswer("")
    setIsWeightingPhase(false)
    setWeights([])
    bootstrap()

    return () => {
      cancelled = true
    }
  }, [topic, isActive])

  const canSend = useMemo(() => currentAnswer.trim().length > 0 && !loading, [currentAnswer, loading])

  async function fetchFollowup(nextContext: QA[]) {
    // If we already have 5 questions, don't fetch more follow-ups
    if (questions.length >= MAX_QUESTIONS) return ""
    
    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "clarify_followup",
          topic,
          context: nextContext,
        }),
      })
      if (!res.ok) throw new Error(`Failed to get follow-up (${res.status})`)
      const data = await res.json()
      const nextQuestion: string = (data?.nextQuestion ?? "").trim()
      return nextQuestion
    } catch (e: any) {
      console.error(e)
      return ""
    }
  }

  async function handleSubmitAnswer() {
    if (!canSend) return

    const qa: QA = { question: currentQuestion, answer: currentAnswer.trim() }
    const updatedAnswers = [...answers, qa]
    setAnswers(updatedAnswers)
    setCurrentAnswer("")

    // If there's a next question already loaded, continue
    if (questions[currentIndex + 1]) return

    // If we've asked 5 questions or reached the end, move to weight assignment
    if (questions.length >= MAX_QUESTIONS || currentIndex + 1 >= questions.length) {
      // Move to weight assignment phase
      setIsWeightingPhase(true)
      setWeights(updatedAnswers.map(() => 3)) // Default weight is 3
      return
    }

    // If we haven't reached 5 questions yet, try to fetch a follow-up
    if (!loading) {
      setLoading(true)
      try {
        const nextQ = await fetchFollowup(updatedAnswers)
        if (nextQ && questions.length < MAX_QUESTIONS) {
          setQuestions((prev) => [...prev, nextQ])
        } else {
          // No follow-up available, move to weight assignment
          setIsWeightingPhase(true)
          setWeights(updatedAnswers.map(() => 3))
        }
      } finally {
        setLoading(false)
      }
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      void handleSubmitAnswer()
    }
  }

  function handleFinishEarly() {
    // Early finish also moves to weight assignment phase
    setIsWeightingPhase(true)
    setWeights(answers.map(() => 3))
  }

  function handleWeightChange(index: number, value: number) {
    const newWeights = [...weights]
    newWeights[index] = value
    setWeights(newWeights)
  }

  function handleCompleteWithWeights() {
    // Create QA array with weights included
    const answersWithWeights = answers.map((qa, idx) => ({
      ...qa,
      weight: weights[idx] || 3
    }))
    onComplete(answersWithWeights)
  }

  // Completed state (isComplete)
  if (isComplete) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="space-y-4">
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">Clarifying Questions</h2>
          <div className="space-y-4">
            {answers.map((qa, idx) => (
              <div key={idx} className="space-y-2">
                <div className="text-[#666666]">{qa.question}</div>
                <div className="flex items-start gap-3">
                  <div className="text-[#0A0A0A] flex-1 pl-4 border-l-2 border-[#E5E5E5]">{qa.answer}</div>
                  {qa.weight && (
                    <div className="text-xs text-[#666666] bg-[#F8F8F8] px-2 py-1 rounded">
                      Priority: {qa.weight}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-6 h-px bg-[#E5E5E5]" />
      </div>
    )
  }

  if (!isActive) return null

  // Weight assignment phase
  if (isWeightingPhase) {
    return (
      <div className="animate-in fade-in duration-200">
        <div className="space-y-6">
          <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">
            Set Priority Weights (1-5)
          </h2>
          <p className="text-sm text-[#666666]">
            Assign a priority weight to each answer. Higher weights (5) indicate more important aspects to focus on during research.
          </p>

          <div className="space-y-4">
            {answers.map((qa, index) => (
              <div key={index} className="space-y-2 p-4 bg-[#F8F8F8] rounded-xl">
                <div className="text-sm text-[#666666] font-medium">{qa.question}</div>
                <div className="text-[#0A0A0A] mb-3">{qa.answer}</div>
                <div className="flex items-center gap-4">
                  <Label htmlFor={`weight-${index}`} className="text-sm text-[#666666] min-w-[60px]">
                    Priority:
                  </Label>
                  <Input
                    id={`weight-${index}`}
                    type="number"
                    min={1}
                    max={5}
                    value={weights[index] || 3}
                    onChange={(e) => handleWeightChange(index, parseInt(e.target.value) || 3)}
                    className="w-20 border-[#E5E5E5] rounded-xl"
                  />
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((val) => (
                      <button
                        key={val}
                        onClick={() => handleWeightChange(index, val)}
                        className={`w-8 h-8 rounded-lg border transition-colors ${
                          weights[index] === val
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
            ))}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => setIsWeightingPhase(false)}
              variant="outline"
              className="rounded-xl"
            >
              Back to Questions
            </Button>
            <Button
              onClick={handleCompleteWithWeights}
              className="flex-1 bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl"
            >
              Continue with These Weights
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // Question answering phase
  return (
    <div className="animate-in fade-in duration-200">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-medium text-[#666666] uppercase tracking-wider">
              Clarifying Questions
            </h2>
            <p className="text-xs text-[#666666] mt-1">
              {currentIndex + 1} of {MAX_QUESTIONS} questions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handleFinishEarly}
              variant="outline"
              className="rounded-xl"
              disabled={answers.length === 0 || loading}
              title={answers.length === 0 ? "Answer at least one first" : "Finish clarifying"}
            >
              Finish ({answers.length} answered)
            </Button>
          </div>
        </div>

        {error && (
          <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md p-3">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {answers.map((qa, index) => (
            <div key={index} className="space-y-3">
              <div className="flex">
                <div className="flex-1 bg-[#F8F8F8] rounded-xl p-4 text-[#0A0A0A]">{qa.question}</div>
              </div>
              <div className="flex justify-end">
                <div className="flex-1 max-w-[85%] bg-[#0A0A0A] text-white rounded-xl p-4">
                  {qa.answer}
                </div>
              </div>
            </div>
          ))}
        </div>

        {currentQuestion && (
          <div className="space-y-3">
            <div className="flex">
              <div className="flex-1 bg-[#F8F8F8] rounded-xl p-4 text-[#0A0A0A]">
                {currentQuestion}
              </div>
            </div>

            <div className="flex gap-2">
              <Input
                value={currentAnswer}
                onChange={(e) => setCurrentAnswer(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Type your answer..."
                className="flex-1 border-[#E5E5E5] focus:border-[#0A0A0A] rounded-xl"
                autoFocus
                disabled={loading}
              />
              <Button
                onClick={handleSubmitAnswer}
                disabled={!canSend}
                className="bg-[#0A0A0A] text-white hover:bg-[#333333] rounded-xl px-6"
              >
                {loading ? "Thinking..." : "Send"}
              </Button>
            </div>
          </div>
        )}

        {!currentQuestion && (
          <div className="text-sm text-[#666666]">{loading ? "Loading questions..." : null}</div>
        )}
      </div>
    </div>
  )
}