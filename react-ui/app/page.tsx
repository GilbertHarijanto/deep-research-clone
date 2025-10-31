"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

import { Header } from "@/components/iris/header";
import { TopicInput } from "@/components/iris/topic-input";
import { ClarifyingQuestions } from "@/components/iris/clarifying-questions";
import { InitialQueries } from "@/components/iris/initial-queries";
import { RunResearch } from "@/components/iris/run-research";
import { ReportSection } from "@/components/iris/report-section";
import { ResearchChat } from "@/components/iris/research-chat";
import { ProgressSidebar } from "@/components/iris/progress-sidebar";

// Client-only (ReactFlow)
const ResearchCanvas = dynamic(() => import("@/components/iris/research-canvas"), {
  ssr: false,
});

interface QA {
  question: string;
  answer: string;
  weight?: number;
}

export default function HomePage() {
  const [currentStep, setCurrentStep] = useState<
    "topic" | "clarify" | "queries" | "run" | "report" | "chat"
  >("topic");

  const [topic, setTopic] = useState("");
  const [clarifyingAnswers, setClarifyingAnswers] = useState<QA[]>([]);
  const [queries, setQueries] = useState<Array<{ id: string; query: string; priority: number }>>([]);

  // Findings collected during the "Run" step (optional if your RunResearch returns them)
  const [findings, setFindings] = useState<string[]>([]);

  // NEW: store the final synthesized report markdown; Canvas appears only when this is set
  const [reportMarkdown, setReportMarkdown] = useState<string>("");

  // --- Step handlers ---
  const handleTopicSubmit = (value: string) => {
    setTopic(value);
    setCurrentStep("clarify");
  };

  const handleClarifyingComplete = (answers: QA[]) => {
    setClarifyingAnswers(answers);
    setCurrentStep("queries");
  };

  const handleQueriesComplete = (
    finalQueries: Array<{ id: string; query: string; priority: number }>
  ) => {
    setQueries(finalQueries);
    setCurrentStep("run");
  };

  // If your RunResearch returns findings, accept them here (optional)
  const handleResearchComplete = (results?: { findings?: string[] }) => {
    if (results?.findings) setFindings(results.findings);
    setCurrentStep("report");
  };

  // When the ReportSection finishes (e.g., user hits Continue)
  const handleReportComplete = () => {
    setCurrentStep("chat");
  };

  // If your ReportSection can expose the generated markdown,
  // call this from inside that component after synthesis succeeds.
  const handleReportReady = (markdown: string) => {
    setReportMarkdown(markdown || "");
  };

  // Canvas props mapping
  const ideation = clarifyingAnswers.map((qa, i) => ({
    id: String(i + 1),
    title: qa.answer?.trim() ? qa.answer : qa.question,
  }));

  const findingObjects = (findings || []).map((text, i) => ({
    id: String(i + 1),
    text,
    refs: [] as Array<{ title: string; url: string }>,
  }));

  // Optional: allow asking from inside the canvas; here we create a new query via your API
  async function onAskFromCanvas({
    scopeNodeId,
    scopeType,
    question,
  }: {
    scopeNodeId: string;
    scopeType: "topic" | "idea" | "query" | "evidence" | "report";
    question: string;
  }) {
    // Simple behavior: turn the asked question into a new "query" node
    // You can route this to /api/research for smarter branching if you like.
    return { type: "query" as const, query: question, priority: 3 };
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
                isComplete={["queries", "run", "report", "chat"].includes(currentStep)}
              />
            )}

            {/* Initial Queries */}
            {["queries", "run", "report", "chat"].includes(currentStep) && (
              <InitialQueries
                onComplete={handleQueriesComplete}
                isActive={currentStep === "queries"}
                isComplete={["run", "report", "chat"].includes(currentStep)}
                clarifyingData={clarifyingAnswers}
                topic={topic}
              />
            )}

            {/* Run Research */}
            {["run", "report", "chat"].includes(currentStep) && (
              <RunResearch
                queries={queries}
                onComplete={handleResearchComplete}
                isActive={currentStep === "run"}
                isComplete={["report", "chat"].includes(currentStep)}
              />
            )}

            {/* Report Section */}
            {["report", "chat"].includes(currentStep) && (
              <ReportSection
                onComplete={handleReportComplete}
                // OPTIONAL: if your ReportSection supports this, call it when the markdown is ready
                // e.g., props.onReportReady?.(markdownString)
                // onReportReady={handleReportReady as any}
                isActive={currentStep === "report"}
                isComplete={currentStep === "chat"}
                queries={queries}
                topic={topic}
              />
            )}

            {/* ---- Canvas appears ONLY once reportMarkdown exists ---- */}
            {reportMarkdown && (
              <section className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-semibold">Interactive Research Canvas</h2>
                  <span className="text-xs text-gray-500">
                    The canvas activates after the research report is generated.
                  </span>
                </div>

                <ResearchCanvas
                  topic={topic}
                  ideation={ideation}
                  queries={queries}
                  findings={findingObjects}
                  reportMarkdown={reportMarkdown}
                  onAskFromCanvas={onAskFromCanvas}
                />
              </section>
            )}
          </div>
        </main>

        {/* Progress Sidebar */}
        <ProgressSidebar currentStep={currentStep} />
      </div>

      {/* Research Chat - Always visible after topic */}
      {currentStep !== "topic" && <ResearchChat />}
    </div>
  );
}
