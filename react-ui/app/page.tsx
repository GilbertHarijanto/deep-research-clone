"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Header } from "@/components/iris/header";
import { TopicInput } from "@/components/iris/topic-input";
import { ClarifyingQuestions } from "@/components/iris/clarifying-questions";
import { InitialQueries } from "@/components/iris/initial-queries";
import { ReportSection } from "@/components/iris/report-section";
import { ResearchChat } from "@/components/iris/research-chat";
import { ProgressSidebar } from "@/components/iris/progress-sidebar";
import ResearchCanvas from "@/components/iris/research-canvas";

// ---- Types ----
interface QA {
  question: string;
  answer: string;
  weight?: number;
}
type QueryItem = { id: string; query: string; priority: number };

export default function HomePage() {
  const [currentStep, setCurrentStep] =
    useState<"topic" | "clarify" | "queries" | "report" | "chat">("topic");

  // Single source of truth (no duplicates)
  const [topic, setTopic] = useState<string>("");
  const [clarifyingAnswers, setClarifyingAnswers] = useState<QA[]>([]);
  const [queries, setQueries] = useState<QueryItem[]>([]);
  const [findings, setFindings] = useState<string[]>([]); // keep as strings in page; map for canvas

  const [reportMarkdown, setReportMarkdown] = useState<string>("");
  const [reportStructured, setReportStructured] = useState<any>(null);

  // --- Step handlers ---
  const handleTopicSubmit = (value: string) => {
    setTopic(value);
    setCurrentStep("clarify");
  };

  const handleClarifyingComplete = (answers: QA[]) => {
    setClarifyingAnswers(answers);
    setCurrentStep("queries");
  };

  const handleQueriesComplete = (finalQueries: QueryItem[]) => {
    setQueries(finalQueries);
    setCurrentStep("report");
  };


  const router = useRouter();

  const handleReportComplete = async (markdown: string, structured: any) => {
    setReportMarkdown(markdown);
    setReportStructured(structured);

    // Build payload for Space
    const payload = {
      topic,
      ideation: clarifyingAnswers.map((qa, i) => ({ id: String(i + 1), title: qa.answer?.trim() || qa.question })),
      queries,
      findings: findings.map((txt, i) => ({ id: String(i + 1), text: txt })),
      reportMarkdown: markdown,
      references: structured?.references ?? [], // if present
    };

    const res = await fetch("/api/spaces", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const { id } = await res.json();

    router.push(`/spaces/${id}`);
  };

  // ----- Mappings to satisfy ResearchCanvas prop shapes -----
  const ideation = clarifyingAnswers.map((qa, i) => ({
    id: String(i + 1),
    title: qa.answer?.trim() || qa.question,
  }));

  const findingObjects = findings.map((txt, i) => ({
    id: String(i + 1),
    text: txt,
  }));

  return (
    <div className="min-h-screen bg-white">
      <Header />

      <div className="flex">
        <main className="flex-1 max-w-4xl mx-auto px-6 py-8 pb-[240px]">
          <div className="space-y-16">
            {/* Topic Input */}
            <TopicInput
              onSubmit={handleTopicSubmit}
              isComplete={currentStep !== "topic"}
              value={topic}
            />

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
                // If your ReportSection can also supply findings, set them here:
                // onFindingsReady={(arr: string[]) => setFindings(arr)}
              />
            )}

            {/* Interactive Research Canvas — only after report is generated */}
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
                  onAskFromCanvas={async ({ question }) => {
                    // TODO: Wire this to your backend/LLM. For now, create a follow-up "query".
                    return { type: "query", query: `Follow-up: ${question}`, priority: 3 };
                  }}
                />
              </section>
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
          isActive
        />
      )}
    </div>
  );
}
