interface ProgressSidebarProps {
  currentStep: "topic" | "clarify" | "queries" | "run" | "report" | "chat"
}

const STEPS = [
  { id: "topic", label: "Topic" },
  { id: "clarify", label: "Clarify" },
  { id: "queries", label: "Queries" },
  { id: "run", label: "Run" },
  { id: "report", label: "Report" },
  { id: "chat", label: "Chat" },
] as const

export function ProgressSidebar({ currentStep }: ProgressSidebarProps) {
  const currentIndex = STEPS.findIndex((step) => step.id === currentStep)

  return (
    <aside className="sticky top-20 h-fit w-48 pr-6 py-8 hidden lg:block">
      <div className="space-y-3">
        {STEPS.map((step, index) => {
          const isComplete = index < currentIndex
          const isCurrent = index === currentIndex
          const isPending = index > currentIndex

          return (
            <div key={step.id} className="flex items-center gap-3">
              <div
                className={`w-2 h-2 rounded-full transition-colors ${
                  isComplete ? "bg-[#0A0A0A]" : isCurrent ? "bg-[#0A0A0A] ring-4 ring-[#E5E5E5]" : "bg-[#E5E5E5]"
                }`}
              />
              <span
                className={`text-sm transition-colors ${
                  isComplete || isCurrent ? "text-[#0A0A0A] font-medium" : "text-[#999999]"
                }`}
              >
                {step.label}
              </span>
            </div>
          )
        })}
      </div>
    </aside>
  )
}
