"use client"

import { useState } from "react"
import { Header } from "@/components/iris/header"
import { TopicInput } from "@/components/iris/topic-input"
import { ClarifyingQuestions } from "@/components/iris/clarifying-questions"
import { InitialQueries } from "@/components/iris/initial-queries"
import { ReportSection } from "@/components/iris/report-section"
import { ResearchChat } from "@/components/iris/research-chat"
import { ProgressSidebar } from "@/components/iris/progress-sidebar"

// QA interface with weight
interface QA {
  question: string
  answer: string
  weight?: number
}

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<"topic" | "clarify" | "queries" | "report" | "chat">("topic")
  const [topic, setTopic] = useState("")
  const [clarifyingAnswers, setClarifyingAnswers] = useState<QA[]>([])
  const [queries, setQueries] = useState<Array<{ id: string; query: string; priority: number }>>([])
  
  // Store report data for chat
  const [reportMarkdown, setReportMarkdown] = useState("")
  const [reportStructured, setReportStructured] = useState<any>(null)

  const handleTopicSubmit = (value: string) => {
    setTopic(value)
    setCurrentStep("clarify")
  }

  const handleClarifyingComplete = (answers: QA[]) => {
    setClarifyingAnswers(answers)
    setCurrentStep("queries")
  }

  const handleQueriesComplete = (finalQueries: Array<{ id: string; query: string; priority: number }>) => {
    setQueries(finalQueries)
    setCurrentStep("report")
  }

  const handleReportComplete = (markdown: string, structured: any) => {
    setReportMarkdown(markdown)
    setReportStructured(structured)
    setCurrentStep("chat")
  }

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="flex">
        <main className="flex-1 max-w-4xl mx-auto px-6 py-8 pb-[240px]">
          <div className="space-y-16">
            {/* Topic Input */}
            <TopicInput onSubmit={handleTopicSubmit} isComplete={currentStep !== "topic"} value={topic} />

            {/* Clarifying Questions */}
            {currentStep !== "topic" && (
              <ClarifyingQuestions
                topic={topic}
                onComplete={handleClarifyingComplete}
                isActive={currentStep === "clarify"}
                isComplete={["queries", "report", "chat"].includes(currentStep)}
              />
            )}

            {/* Initial Queries */}
            {["queries", "report", "chat"].includes(currentStep) && (
              <InitialQueries
                onComplete={handleQueriesComplete}
                isActive={currentStep === "queries"}
                isComplete={["report", "chat"].includes(currentStep)}
                clarifyingData={clarifyingAnswers}
                topic={topic}
              />
            )}

            {/* Report Section */}
            {["report", "chat"].includes(currentStep) && (
              <ReportSection
                onComplete={handleReportComplete}
                isActive={currentStep === "report"}
                isComplete={currentStep === "chat"}
                queries={queries}
                topic={topic}
                clarifyingData={clarifyingAnswers}
              />
            )}
          </div>
        </main>

        {/* Progress Sidebar */}
        <ProgressSidebar currentStep={currentStep} />
      </div>

      {/* Research Chat - Only visible in chat step */}
      {currentStep === "chat" && (
        <ResearchChat
          topic={topic}
          markdown={reportMarkdown}
          structured={reportStructured}
          isActive={currentStep === "chat"}
        />
      )}
    </div>
  )
}