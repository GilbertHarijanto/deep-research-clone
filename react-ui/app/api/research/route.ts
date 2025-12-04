/**
 * Research API Route - LangGraph Version
 * 
 * This is the main API endpoint that now delegates all orchestration
 * to the LangGraph research graph instead of handling logic directly.
 * 
 * Supported actions:
 * - generate_questions: Get initial clarifying questions
 * - generate_queries: Generate search queries from answers
 * - synthesize_report: Run full research pipeline
 * - chat: Interactive Q&A about the report
 */

import { type NextRequest, NextResponse } from "next/server"
import { runResearch, createResearchGraph } from "@/lib/langgraph/graph"
import type { GraphConfig, ResearchState } from "@/lib/langgraph/state/types"
import OpenAI from "openai"

// Initialize OpenAI (for chat only)
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
})

/**
 * Create graph configuration from environment variables
 */
function getGraphConfig(): GraphConfig {
  return {
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    serperApiKey: process.env.SERPER_API_KEY || "",
    langfusePublicKey: process.env.NEXT_PUBLIC_LANGFUSE_PUBLIC_KEY,
    langfuseSecretKey: process.env.LANGFUSE_SECRET_KEY,
    langfuseBaseUrl: process.env.LANGFUSE_BASE_URL,
    maxClarifyingQuestions: 5,
    maxSearchQueries: 7,
    enableArxiv: true,
    enableAgentCollaboration: false, // Set to true to enable Critic/Ideation/Meta agents
  }
}

export async function POST(request: NextRequest) {
  const requestStartTime = Date.now()

  try {
    const body = await request.json()
    const { action, topic } = body ?? {}

    if (!action) {
      return NextResponse.json({ error: "Missing 'action'." }, { status: 400 })
    }

    console.log(`[API] Action: ${action}, Topic: ${topic}`)

    // ===== ACTION: Generate initial clarifying questions =====
    if (action === "generate_questions") {
      if (!topic) {
        return NextResponse.json(
          { error: "Topic is required" },
          { status: 400 }
        )
      }

      const config = getGraphConfig()
      const graph = createResearchGraph(config)

      // Run only the clarification node
      const result = await graph.invoke({
        topic,
        currentStep: "clarification",
      } as ResearchState)

      return NextResponse.json({
        questions: result.clarifyingQuestions || [],
      })
    }

    // ===== ACTION: Generate search queries from clarifying answers =====
    if (action === "generate_queries") {
      const { clarifyingData } = body as {
        clarifyingData: Array<{
          question: string
          answer: string
          weight?: number
        }>
      }

      if (!topic) {
        return NextResponse.json(
          { error: "Topic is required" },
          { status: 400 }
        )
      }

      const config = getGraphConfig()
      const graph = createResearchGraph(config)

      // Run clarification + query generation nodes
      const result = await graph.invoke({
        topic,
        clarifyingAnswers: clarifyingData,
        currentStep: "query_generation",
      } as ResearchState)

      return NextResponse.json({
        queries:
          result.searchQueries?.map((q) => ({
            id: q.id,
            query: q.query,
            priority: q.priority,
          })) || [],
      })
    }

    // ===== ACTION: Generate alternative queries =====
    if (action === "generate_alternative_queries") {
      const { clarifyingData, currentQueries } = body as {
        clarifyingData: Array<{
          question: string
          answer: string
          weight?: number
        }>
        currentQueries: string[]
      }

      if (!topic) {
        return NextResponse.json(
          { error: "Topic is required" },
          { status: 400 }
        )
      }

      // Note: Alternative query generation is handled in the graph
      // For now, return a simple response
      // TODO: Implement alternative query node invocation

      return NextResponse.json({
        queries: [
          `Alternative perspective on ${topic}`,
          `Emerging trends in ${topic}`,
          `Common misconceptions about ${topic}`,
        ],
      })
    }

    // ===== ACTION: Synthesize full research report =====
    if (action === "synthesize_report") {
      const { queries, includeArxiv = true } = body as {
        queries: Array<{ id: string; query: string; priority: number }>
        includeArxiv?: boolean
      }

      if (!topic) {
        return NextResponse.json(
          { error: "Topic is required" },
          { status: 400 }
        )
      }

      // Check API keys
      if (!process.env.SERPER_API_KEY) {
        return NextResponse.json(
          { error: "SERPER_API_KEY not configured" },
          { status: 500 }
        )
      }

      console.log(
        `[API] Starting full research pipeline for: "${topic}" with ${queries.length} queries`
      )

      const config = getGraphConfig()

      // Run the full research pipeline using LangGraph
      const result = await runResearch(topic, config, {
        includeArxiv,
      })

      if (!result.report) {
        return NextResponse.json(
          {
            error: "Failed to generate research report",
            details: result.errors?.join(", ") || "Unknown error",
          },
          { status: 500 }
        )
      }

      return NextResponse.json({
        markdown: result.report.markdown,
        structured: result.report.structured,
        metadata: result.report.metadata,
        searchData: result.searchResults?.map((sr) => ({
          query: sr.query,
          priority: sr.priority,
          sources: [...sr.webResults, ...sr.arxivResults].map((s) => ({
            type: s.type,
            title: s.title,
            url: s.url,
            snippet: s.snippet,
            authors: s.authors,
            published: s.published,
            pdfUrl: s.pdfUrl,
          })),
        })),
      })
    }

    // ===== ACTION: Chat with research context =====
    if (action === "chat") {
      const { markdown, structured, messages, userQuery } = body as {
        markdown: string
        structured: any
        messages: Array<{ role: string; content: string }>
        userQuery: string
      }

      if (!topic) {
        return NextResponse.json(
          { error: "Topic is required" },
          { status: 400 }
        )
      }

      try {
        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          temperature: 0.7,
          messages: [
            {
              role: "system",
              content:
                `You are a helpful research assistant discussing a report about "${topic}".\n\n` +
                `=== RESEARCH CONTEXT ===\n\n` +
                `Full Report:\n${markdown}\n\n` +
                `Structured Data:\n${JSON.stringify(structured, null, 2)}\n\n` +
                `=== YOUR ROLE ===\n` +
                `- Answer questions based on the research report\n` +
                `- Cite specific sections or findings when relevant\n` +
                `- If asked about something not in the report, clearly state that\n` +
                `- Provide additional context or explanations when helpful\n` +
                `- Suggest related questions or areas to explore\n` +
                `- Be conversational but accurate`,
            },
            ...messages.map((m) => ({
              role: m.role as "user" | "assistant",
              content: m.content,
            })),
          ],
        })

        const response =
          completion.choices[0]?.message?.content ??
          "I couldn't generate a response."

        return NextResponse.json({
          response,
        })
      } catch (error) {
        console.error("[Chat] Error:", error)
        return NextResponse.json(
          {
            error: "Failed to generate chat response",
            details: error instanceof Error ? error.message : "Unknown error",
          },
          { status: 500 }
        )
      }
    }

    // Unknown action
    return NextResponse.json(
      { error: `Unknown action: ${action}` },
      { status: 400 }
    )
  } catch (error) {
    console.error("[API] Error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    )
  }
}