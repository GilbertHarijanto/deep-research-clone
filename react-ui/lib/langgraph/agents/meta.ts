/**
 * Meta Agent
 * 
 * Oversees the entire research process and makes high-level decisions.
 * This agent coordinates between other agents, decides when to refine,
 * and determines the overall research strategy.
 */

import OpenAI from "openai"
import { ResearchState } from "../state/types"

export interface MetaPlan {
  strategy: string
  nextSteps: string[]
  shouldUseCritic: boolean
  shouldUseIdeation: boolean
  shouldRefine: boolean
  reasoning: string
}

/**
 * Meta Agent - Coordinates the research process
 */
export async function metaAgent(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  console.log("[MetaAgent] Planning research strategy...")

  try {
    // Analyze current state
    const hasQueries = !!state.searchQueries && state.searchQueries.length > 0
    const hasResults =
      !!state.searchResults && state.searchResults.length > 0
    const hasReport = !!state.report
    const hasCriticFeedback =
      !!state.criticFeedback && state.criticFeedback.length > 0
    const refinementCount = state.refinementIterations || 0

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `You are a meta-level research coordinator. You oversee the entire research process and make strategic decisions.

Your responsibilities:
1. ASSESS: Evaluate the current state of the research
2. DECIDE: Determine what needs to happen next
3. COORDINATE: Decide which agents/tools to use
4. QUALITY CONTROL: Determine if refinement is needed

Decision Criteria:
- Use Critic Agent: When quality assessment is needed (queries, results, report)
- Use Ideation Agent: When creative expansion would help (early stages, gaps identified)
- Refine: If quality is "needs_improvement" or "poor" AND iterations < 3
- Proceed: If quality is "good" or "excellent" OR iterations >= 3

Return JSON:
{
  "strategy": "brief strategy description",
  "nextSteps": ["step 1", "step 2", ...],
  "shouldUseCritic": true|false,
  "shouldUseIdeation": true|false,
  "shouldRefine": true|false,
  "reasoning": "explanation of decisions"
}`,
        },
        {
          role: "user",
          content: `
Topic: ${state.topic}

Current State:
- Has Queries: ${hasQueries} (${state.searchQueries?.length || 0} queries)
- Has Results: ${hasResults} (${state.searchResults?.length || 0} result sets)
- Has Report: ${hasReport}
- Has Critic Feedback: ${hasCriticFeedback}
- Refinement Iterations: ${refinementCount}
- Current Step: ${state.currentStep || "unknown"}

${state.criticFeedback ? `\nCritic Feedback:\n${state.criticFeedback.join("\n")}` : ""}
${state.ideationSuggestions ? `\nIdeation Suggestions:\n${state.ideationSuggestions.slice(0, 3).join("\n")}` : ""}

What should happen next? Provide a strategic plan.
          `,
        },
      ],
      response_format: { type: "json_object" },
    })

    const planText = completion.choices[0]?.message?.content || "{}"
    const plan: MetaPlan = JSON.parse(planText)

    console.log(`[MetaAgent] Strategy: ${plan.strategy}`)
    console.log(
      `[MetaAgent] Next: Critic=${plan.shouldUseCritic}, Ideation=${plan.shouldUseIdeation}, Refine=${plan.shouldRefine}`
    )

    return {
      metaAgentPlan: plan.strategy,
      currentStep: plan.nextSteps[0] || state.currentStep,
    }
  } catch (error) {
    console.error("[MetaAgent] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Meta Agent failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}
