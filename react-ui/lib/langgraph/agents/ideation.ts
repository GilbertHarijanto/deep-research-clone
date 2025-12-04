/**
 * Ideation Agent
 * 
 * Generates creative research directions and alternative perspectives.
 * This agent helps expand the research scope by suggesting novel angles,
 * related topics, and unconventional approaches.
 */

import OpenAI from "openai"
import { ResearchState } from "../state/types"

export interface IdeationSuggestion {
  category: string
  ideas: string[]
  rationale: string
}

/**
 * Ideation Agent - Generates creative research directions
 */
export async function ideationAgent(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  console.log("[IdeationAgent] Generating creative research directions...")

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.8, // Higher temperature for creativity
      messages: [
        {
          role: "system",
          content: `You are a creative research strategist who thinks outside the box.

Your job is to generate UNCONVENTIONAL and CREATIVE research directions that expand beyond the obvious.

For the given topic, suggest:
1. INTERDISCIPLINARY CONNECTIONS: How does this relate to other fields?
2. CONTRARIAN PERSPECTIVES: What if the common assumptions are wrong?
3. EDGE CASES: What unusual scenarios or applications exist?
4. EMERGING TRENDS: What future developments might impact this?
5. HIDDEN INSIGHTS: What non-obvious questions should be explored?

Return JSON format:
{
  "suggestions": [
    {
      "category": "Interdisciplinary",
      "ideas": ["idea 1", "idea 2", ...],
      "rationale": "why this matters"
    },
    ...
  ]
}

Be creative but practical. Each suggestion should open new research avenues.`,
        },
        {
          role: "user",
          content: `
Topic: ${state.topic}

Current Context:
${state.clarifyingAnswers ? `User Intent: ${state.clarifyingAnswers.map((qa) => qa.answer).join("; ")}` : ""}
${state.searchQueries ? `Current Queries: ${state.searchQueries.map((q) => q.query).join(", ")}` : ""}
${state.criticFeedback ? `Critic Feedback: ${state.criticFeedback.join("; ")}` : ""}

Generate 3-5 creative research directions that go beyond the obvious.
          `,
        },
      ],
      response_format: { type: "json_object" },
    })

    const responseText = completion.choices[0]?.message?.content || "{}"
    const response: { suggestions: IdeationSuggestion[] } =
      JSON.parse(responseText)

    const flattenedSuggestions = response.suggestions.flatMap((s) =>
      s.ideas.map((idea) => `[${s.category}] ${idea}`)
    )

    console.log(
      `[IdeationAgent] Generated ${flattenedSuggestions.length} creative suggestions`
    )

    return {
      ideationSuggestions: flattenedSuggestions,
    }
  } catch (error) {
    console.error("[IdeationAgent] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Ideation Agent failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}
