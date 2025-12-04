/**
 * Research Graph - Main LangGraph Definition
 * 
 * This is the core orchestration layer that defines how research flows
 * through different nodes and agents.
 * 
 * Graph Flow:
 * 1. Clarification → Generate questions
 * 2. Query Generation → Create search queries
 * 3. (Optional) Critic → Evaluate query quality
 * 4. Search → Execute web + arXiv searches
 * 5. (Optional) Ideation → Generate creative angles
 * 6. Report Synthesis → Generate final report
 * 7. (Optional) Critic → Evaluate report quality
 * 8. (Optional) Meta → Decide if refinement needed
 */

import { StateGraph, END } from "@langchain/langgraph"
import OpenAI from "openai"
import { ResearchState, GraphConfig } from "./state/types"
import {
  clarificationNode,
  queryGenerationNode,
  searchNode,
  reportSynthesisNode,
} from "./nodes"
import { criticAgent, ideationAgent, metaAgent } from "./agents"

/**
 * Create the research graph
 */
export function createResearchGraph(config: GraphConfig) {
  const openai = new OpenAI({
    apiKey: config.openaiApiKey,
  })

  // Initialize StateGraph with ResearchState type
  const graph = new StateGraph<ResearchState>({
    channels: {
      topic: null,
      action: null,
      clarifyingQuestions: null,
      clarifyingAnswers: null,
      clarificationComplete: null,
      searchQueries: null,
      alternativeQueries: null,
      selectedQueries: null,
      searchResults: null,
      includeArxiv: null,
      report: null,
      chatMessages: null,
      chatResponse: null,
      metaAgentPlan: null,
      criticFeedback: null,
      ideationSuggestions: null,
      refinementIterations: null,
      currentStep: null,
      errors: null,
      warnings: null,
      traceId: null,
      startTime: null,
      endTime: null,
    },
  })

  // ===== DEFINE NODES =====

  // Clarification Node
  graph.addNode("clarify", async (state: ResearchState) => {
    return clarificationNode(state, openai)
  })

  // Query Generation Node
  graph.addNode("generate_queries", async (state: ResearchState) => {
    return queryGenerationNode(state, openai)
  })

  // Search Node
  graph.addNode("search", async (state: ResearchState) => {
    return searchNode(state, { serperApiKey: config.serperApiKey })
  })

  // Report Synthesis Node
  graph.addNode("synthesize_report", async (state: ResearchState) => {
    return reportSynthesisNode(state, openai)
  })

  // ===== AGENT NODES (Optional) =====

  if (config.enableAgentCollaboration) {
    // Critic Agent
    graph.addNode("critic", async (state: ResearchState) => {
      return criticAgent(state, openai)
    })

    // Ideation Agent
    graph.addNode("ideation", async (state: ResearchState) => {
      return ideationAgent(state, openai)
    })

    // Meta Agent
    graph.addNode("meta", async (state: ResearchState) => {
      return metaAgent(state, openai)
    })
  }

  // ===== DEFINE EDGES =====

  // Set entry point
  graph.setEntryPoint("clarify")

  // Basic flow: Clarification → Queries → Search → Report
  graph.addEdge("clarify", "generate_queries")
  graph.addEdge("generate_queries", "search")
  graph.addEdge("search", "synthesize_report")

  if (config.enableAgentCollaboration) {
    // Enhanced flow with agents:
    // After query generation, run critic
    graph.addEdge("generate_queries", "critic")
    graph.addEdge("critic", "ideation")
    graph.addEdge("ideation", "search")

    // After report synthesis, evaluate with critic
    graph.addEdge("synthesize_report", "critic")

    // Meta agent decides next step
    graph.addEdge("critic", "meta")

    // Conditional: Meta decides if we refine or end
    graph.addConditionalEdges(
      "meta",
      async (state: ResearchState) => {
        // Check if we should refine
        const shouldRefine =
          (state.refinementIterations || 0) < 3 &&
          state.criticFeedback?.some((f) =>
            f.toLowerCase().includes("needs_improvement")
          )

        return shouldRefine ? "generate_queries" : "end"
      },
      {
        generate_queries: "generate_queries",
        end: END,
      }
    )
  } else {
    // Simple flow: just end after report
    graph.addEdge("synthesize_report", END)
  }

  // Compile the graph
  return graph.compile()
}

/**
 * Convenience function to invoke the graph
 */
export async function runResearch(
  topic: string,
  config: GraphConfig,
  options?: {
    clarifyingAnswers?: Array<{ question: string; answer: string; weight?: number }>
    includeArxiv?: boolean
  }
): Promise<ResearchState> {
  const graph = createResearchGraph(config)

  const initialState: ResearchState = {
    topic,
    clarifyingAnswers: options?.clarifyingAnswers,
    includeArxiv: options?.includeArxiv ?? config.enableArxiv ?? true,
    startTime: Date.now(),
    currentStep: "init",
    errors: [],
    warnings: [],
    refinementIterations: 0,
  }

  console.log(`[ResearchGraph] Starting research for: "${topic}"`)

  const result = await graph.invoke(initialState)

  return {
    ...result,
    endTime: Date.now(),
  }
}

/**
 * Stream research progress
 */
export async function* streamResearch(
  topic: string,
  config: GraphConfig,
  options?: {
    clarifyingAnswers?: Array<{ question: string; answer: string; weight?: number }>
    includeArxiv?: boolean
  }
): AsyncGenerator<ResearchState, void, unknown> {
  const graph = createResearchGraph(config)

  const initialState: ResearchState = {
    topic,
    clarifyingAnswers: options?.clarifyingAnswers,
    includeArxiv: options?.includeArxiv ?? config.enableArxiv ?? true,
    startTime: Date.now(),
    currentStep: "init",
    errors: [],
    warnings: [],
    refinementIterations: 0,
  }

  console.log(`[ResearchGraph] Streaming research for: "${topic}"`)

  for await (const state of graph.stream(initialState)) {
    yield state
  }
}
