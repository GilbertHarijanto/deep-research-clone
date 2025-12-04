/**
 * Critic Agent
 * 
 * Evaluates research quality and provides constructive feedback.
 * This agent reviews search queries, results, and reports to ensure
 * they meet quality standards and user requirements.
 */

import OpenAI from "openai"
import { ResearchState } from "../state/types"

export interface CriticFeedback {
  overallQuality: "excellent" | "good" | "needs_improvement" | "poor"
  strengths: string[]
  weaknesses: string[]
  suggestions: string[]
  shouldRefine: boolean
}

/**
 * Critic Agent - Evaluates research quality
 */
export async function criticAgent(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  console.log("[CriticAgent] Evaluating research quality...")

  try {
    // Determine what to critique based on current step
    let contentToReview = ""
    let reviewType = ""

    if (state.report) {
      reviewType = "final_report"
      contentToReview = `
Topic: ${state.topic}

Report Summary:
${state.report.structured.executiveSummary}

Key Findings: ${state.report.structured.keyFindings.length} themes
References: ${state.report.structured.references.length} sources
Research Gaps: ${state.report.structured.researchGaps.join(", ")}
      `
    } else if (state.searchQueries) {
      reviewType = "search_queries"
      contentToReview = `
Topic: ${state.topic}

Search Queries:
${state.searchQueries.map((q, i) => `${i + 1}. ${q.query} (priority: ${q.priority})`).join("\n")}
      `
    } else {
      return { criticFeedback: [] }
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `You are an expert research critic. Your job is to evaluate research quality and provide constructive, actionable feedback.

Review Type: ${reviewType}

Evaluation Criteria:
1. RELEVANCE: Does this align with the user's topic and intent?
2. DEPTH: Is the coverage comprehensive enough?
3. QUALITY: Are the sources/queries specific and actionable?
4. COMPLETENESS: Are there obvious gaps or missing perspectives?
5. CLARITY: Is the information well-organized and understandable?

Provide feedback in this JSON format:
{
  "overallQuality": "excellent|good|needs_improvement|poor",
  "strengths": ["strength 1", "strength 2", ...],
  "weaknesses": ["weakness 1", "weakness 2", ...],
  "suggestions": ["suggestion 1", "suggestion 2", ...],
  "shouldRefine": true|false
}

Be specific and actionable in your feedback.`,
        },
        {
          role: "user",
          content: contentToReview,
        },
      ],
      response_format: { type: "json_object" },
    })

    const feedbackText = completion.choices[0]?.message?.content || "{}"
    const feedback: CriticFeedback = JSON.parse(feedbackText)

    console.log(
      `[CriticAgent] Quality: ${feedback.overallQuality}, Refine: ${feedback.shouldRefine}`
    )

    return {
      criticFeedback: [
        `Overall Quality: ${feedback.overallQuality}`,
        ...feedback.strengths.map((s) => `✓ ${s}`),
        ...feedback.weaknesses.map((w) => `✗ ${w}`),
        ...feedback.suggestions.map((s) => `→ ${s}`),
      ],
      refinementIterations: (state.refinementIterations || 0) + 1,
    }
  } catch (error) {
    console.error("[CriticAgent] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Critic Agent failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}
