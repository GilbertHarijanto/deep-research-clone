import { type NextRequest, NextResponse } from "next/server"
import OpenAI from "openai"
import { trackedLLMCall } from "@/lib/langfuse"

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

function safeJsonParse<T = unknown>(text: string, fallback: T): T {
  try {
    return JSON.parse(text) as T
  } catch {
    return fallback
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action, topic } = body ?? {}

    if (!action) {
      return NextResponse.json({ error: "Missing 'action'." }, { status: 400 })
    }

    // Generate initial clarifying questions
    if (action === "generate_questions") {
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: topic,
          instructions: `Generate 3-5 sharp clarifying questions for the research topic as a pure JSON array of strings.`,
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You are a precise research assistant. Return ONLY a JSON array of question strings. No prose.",
              },
              {
                role: "user",
                content: `Topic: "${topic}"\nGenerate 3-5 clarifying questions (JSON array of strings).`,
              },
            ],
          })
          const output = completion.choices[0]?.message?.content ?? "[]"
          return { output, responseId: completion.id }
        }
      )

      const questions = safeJsonParse<string[]>(result.output, [
        `What specific aspect of "${topic}" interests you most?`,
        "What is your primary goal or outcome for this research?",
        "Are there constraints (time, data, tools) we should consider?",
      ])

      return NextResponse.json({ questions })
    }

    // Generate follow-up clarifying question
    if (action === "clarify_followup") {
      const { context } = body as {
        context: Array<{ question: string; answer: string }>
      }

      if (!topic || !Array.isArray(context)) {
        return NextResponse.json(
          { error: "Both 'topic' and 'context' (Q&A array) are required." },
          { status: 400 }
        )
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: { topic, context },
          instructions:
            "Return one concise follow-up clarifying question as plain text (no JSON, no quotes).",
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.5,
            messages: [
              {
                role: "system",
                content:
                  "You are a clarifying agent. Given the topic and prior Q&A context, return ONE next clarifying question. Output must be a single line of plain text, no quotes, no extra commentary.",
              },
              {
                role: "user",
                content:
                  `Topic: ${topic}\n` +
                  `Context (Q&A JSON): ${JSON.stringify(context)}\n` +
                  `Return exactly one follow-up question:`,
              },
            ],
          })
          const output = (completion.choices[0]?.message?.content ?? "").trim()
          return { output, responseId: completion.id }
        }
      )

      const nextQuestion = result.output.replace(/^["']|["']$/g, "").trim()
      return NextResponse.json({ nextQuestion })
    }

    // Generate initial research queries from clarifying answers
    if (action === "generate_queries") {
      const { clarifyingData } = body as {
        clarifyingData: Array<{ question: string; answer: string; weight?: number }>
      }
      
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: { topic, clarifyingData },
          instructions:
            "Generate 5-7 actionable research queries based on the topic and clarifying answers. Return as JSON array of strings.",
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You are a research strategist. Return ONLY a JSON array of query strings. Each query should be specific, actionable, and tailored to the user's clarifying answers. No commentary.",
              },
              {
                role: "user",
                content:
                  `Topic: ${topic}\n` +
                  `Clarifying Q&A with weights: ${JSON.stringify(clarifyingData)}\n` +
                  `Generate 5-7 specific research queries as a JSON array of strings. ` +
                  `Prioritize aspects with higher weights.`,
              },
            ],
          })
          const output = completion.choices[0]?.message?.content ?? "[]"
          return { output, responseId: completion.id }
        }
      )

      const queries = safeJsonParse<string[]>(result.output, [
        `Overview of ${topic}`,
        `Recent developments in ${topic}`,
        `Key challenges in ${topic}`,
      ])

      return NextResponse.json({ queries })
    }

    // Generate alternative research queries
    if (action === "generate_alternative_queries") {
      const { clarifyingData, currentQueries } = body as {
        clarifyingData: Array<{ question: string; answer: string; weight?: number }>
        currentQueries: string[]
      }
      
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      const result = await trackedLLMCall(
        {
          model: "gpt-4o-mini",
          input: { topic, clarifyingData, currentQueries },
          instructions:
            "Generate 5 alternative research queries that explore different angles. Return as JSON array of strings.",
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            temperature: 0.8,
            messages: [
              {
                role: "system",
                content:
                  "You are a creative research strategist. Return ONLY a JSON array of query strings. Generate alternative queries that explore different perspectives from the current ones. No commentary.",
              },
              {
                role: "user",
                content:
                  `Topic: ${topic}\n` +
                  `Current queries: ${JSON.stringify(currentQueries)}\n` +
                  `User context: ${JSON.stringify(clarifyingData)}\n` +
                  `Generate 5 alternative queries that explore different angles as a JSON array of strings.`,
              },
            ],
          })
          const output = completion.choices[0]?.message?.content ?? "[]"
          return { output, responseId: completion.id }
        }
      )

      const queries = safeJsonParse<string[]>(result.output, [
        `Alternative perspective on ${topic}`,
        `Emerging trends in ${topic}`,
        `Best practices for ${topic}`,
        `Common misconceptions about ${topic}`,
        `Future outlook for ${topic}`,
      ])

      return NextResponse.json({ queries })
    }

    // Synthesize final research report
    if (action === "synthesize_report") {
      const { queries } = body as {
        queries: Array<{ id: string; query: string; priority: number }>
      }
      
      if (!topic) {
        return NextResponse.json({ error: "Topic is required" }, { status: 400 })
      }

      // Note: In a real implementation, you would first execute web searches for each query
      // and collect the results. For now, we'll generate a structured report based on the queries.
      
      const result = await trackedLLMCall(
        {
          model: "gpt-4o",
          input: { topic, queries },
          instructions:
            "Generate a comprehensive research report with inline citations in markdown format. Use [n] for citations and include a References section.",
        },
        async () => {
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            temperature: 0.7,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert research report writer. Generate a comprehensive markdown report with:\n" +
                  "1. Clear structure (# headers, ## sections, ### subsections)\n" +
                  "2. Inline citations using [1], [2], etc.\n" +
                  "3. A References section at the end with format: [n] Source Title – URL\n" +
                  "4. Evidence-based claims with proper attribution\n" +
                  "Use real-world knowledge to provide substantive content.",
              },
              {
                role: "user",
                content:
                  `Research Topic: ${topic}\n\n` +
                  `Research Queries (prioritized):\n${queries.map((q, i) => `${i + 1}. [Priority ${q.priority}] ${q.query}`).join("\n")}\n\n` +
                  `Generate a comprehensive research report in markdown format. Include:\n` +
                  `- Executive Summary\n` +
                  `- Key Findings (organized by themes)\n` +
                  `- Detailed Analysis\n` +
                  `- Recommendations (if applicable)\n` +
                  `- Conclusion\n` +
                  `- References (with citations in format: [n] Title – URL)\n\n` +
                  `Use inline citations [1], [2] throughout the text.`,
              },
            ],
          })
          const output = completion.choices[0]?.message?.content ?? ""
          return { output, responseId: completion.id }
        }
      )

      return NextResponse.json({ report: result.output })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error) {
    console.error("[Research API] Error:", error)
    return NextResponse.json(
      { 
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    )
  }
}