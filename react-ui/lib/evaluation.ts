import OpenAI from "openai"
import { trackedLLMCall } from "@/lib/langfuse"

// Define interfaces for clarity
export interface Query {
  id?: string
  query: string
  priority?: number
}

export interface SearchResult {
  title: string
  url: string
  snippet: string
}

export interface EvaluationResult {
  scores: {
    accuracy: number
    completeness: number
    coherence: number
    relevance: number
    actionability: number
    technicalDepth?: number
    novelInsight?: number
  }
  weightedAverage: number
  feedback: string
}

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

/**
 * Evaluate a research report using LLM-as-Judge
 * Returns a structured JSON evaluation (scores + feedback)
 */
export async function evaluateReport(
  topic: string,
  queries: Query[],
  report: string,
  searchResults?: SearchResult[]
): Promise<EvaluationResult> {
  const evidenceText = searchResults && searchResults.length > 0
    ? searchResults.map((r, i) => `[${i + 1}] ${r.title} – ${r.snippet}`).join("\n")
    : "No external sources provided."

  const result = await trackedLLMCall(
    {
      model: "gpt-4o",
      input: { topic, queries, report, evidenceText },
      instructions: "Evaluate the quality of a research report (LLM-as-Judge).",
      metadata: { step: "evaluation", evaluator: "LLM-as-Judge" },
    },
    async () => {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o",
        temperature: 0.1,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: `
You are an expert evaluator of research reports.
Evaluate the report based on the following criteria and return a valid JSON object:

{
  "scores": {
    "accuracy": number (1-5),
    "completeness": number (1-5),
    "coherence": number (1-5),
    "relevance": number (1-5),
    "actionability": number (1-5),
    "technicalDepth": number (1-5),
    "novelInsight": number (1-5)
  },
  "weightedAverage": number,
  "feedback": "string"
}

Scoring Guidelines:
- Accuracy: Are claims properly supported and factual?
- Completeness: Does it address all research queries?
- Coherence: Logical flow and readability.
- Relevance: Focus on the given topic.
- Actionability: Are recommendations useful and clear?
- TechnicalDepth: Level of detail and analytical rigor.
- NovelInsight: Does it offer new or unique perspectives?

Return concise, objective feedback summarizing the key strengths and weaknesses.
            `,
          },
          {
            role: "user",
            content: `
Topic: ${topic}

Queries:
${queries.map((q, i) => `${i + 1}. ${q.query}`).join("\n")}

Report:
${report}

Reference Evidence:
${evidenceText}

Evaluate the above report and return your assessment as valid JSON.
            `,
          },
        ],
      })

      const output = completion.choices[0]?.message?.content || "{}"
      return { output, responseId: completion.id }
    }
  )

  try {
    const parsed = JSON.parse(result.output)
    return parsed as EvaluationResult
  } catch (err) {
    console.error("❌ Failed to parse evaluation output:", err)
    return {
      scores: {
        accuracy: 0,
        completeness: 0,
        coherence: 0,
        relevance: 0,
        actionability: 0,
        technicalDepth: 0,
        novelInsight: 0,
      },
      weightedAverage: 0,
      feedback: "Failed to parse evaluation result. Please check the trace in Langfuse.",
    }
  }
}
