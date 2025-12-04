/**
 * Clarification Node
 * 
 * Generates clarifying questions to understand user's research intent.
 * This is typically the first step in the research pipeline.
 */

import OpenAI from "openai"
import { ResearchState } from "../state/types"

function safeJsonParse<T>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

/**
 * Generate initial clarifying questions
 */
export async function clarificationNode(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  console.log(`[Clarification] Generating questions for: "${state.topic}"`)

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are an expert research strategist helping to clarify a research topic.

Your goal is to ask insightful questions that will help narrow down the scope and understand the user's specific interests, constraints, and goals.

Ask questions that reveal:
- What specific aspect they're most interested in
- Their concrete goals or intended outcomes
- Practical constraints (time, budget, technical requirements)
- Desired depth and scope
- Context or existing knowledge

Make questions specific and actionable. Avoid vague questions.

Return ONLY a JSON array of question strings.`,
        },
        {
          role: "user",
          content: `Research Topic: "${state.topic}"\n\nGenerate 3-5 clarifying questions as a JSON array of strings.`,
        },
      ],
    })

    const output = completion.choices[0]?.message?.content ?? "[]"
    const questions = safeJsonParse<string[]>(output, [
      `What specific aspect of "${state.topic}" interests you most?`,
      "What is your primary goal or outcome for this research?",
      "Are there constraints (time, data, tools) we should consider?",
    ])

    console.log(`[Clarification] Generated ${questions.length} questions`)

    return {
      clarifyingQuestions: questions,
      currentStep: "clarification",
    }
  } catch (error) {
    console.error("[Clarification] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Clarification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}

/**
 * Generate follow-up clarifying question
 */
export async function followUpNode(
  state: ResearchState,
  openai: OpenAI
): Promise<Partial<ResearchState>> {
  if (!state.clarifyingAnswers || state.clarifyingAnswers.length === 0) {
    return state
  }

  console.log(
    `[FollowUp] Generating question based on ${state.clarifyingAnswers.length} previous answers`
  )

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.7,
      messages: [
        {
          role: "system",
          content: `You are an expert research strategist conducting a clarifying interview.

Based on the research topic and the user's previous answers, generate ONE insightful follow-up question.

Your follow-up question should:
- Build naturally on what they've already said
- Help narrow down or expand the research scope appropriately
- Reveal practical constraints, preferences, or priorities
- Feel conversational and relevant

Output must be a single line of plain text - just the question.`,
        },
        {
          role: "user",
          content:
            `Research Topic: ${state.topic}\n\n` +
            `Previous Q&A:\n${state.clarifyingAnswers.map((qa, i) => `Q${i + 1}: ${qa.question}\nA${i + 1}: ${qa.answer}`).join("\n\n")}\n\n` +
            `Based on their answers, what's ONE relevant follow-up question?`,
        },
      ],
    })

    const nextQuestion = (completion.choices[0]?.message?.content ?? "")
      .trim()
      .replace(/^["']|["']$/g, "")

    console.log(`[FollowUp] Generated: "${nextQuestion.substring(0, 80)}..."`)

    // Append to existing questions
    return {
      clarifyingQuestions: [
        ...(state.clarifyingQuestions || []),
        nextQuestion,
      ],
    }
  } catch (error) {
    console.error("[FollowUp] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Follow-up failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}
