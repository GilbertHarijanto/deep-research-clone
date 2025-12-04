/**
 * Web Search Tool using Serper API
 * 
 * This tool is used by LangGraph agents to search the web for information.
 */

import { SearchResult } from "../state/types"

export interface WebSearchInput {
  query: string
  numResults?: number
  traceId?: string
}

export interface WebSearchOutput {
  results: SearchResult[]
  query: string
  success: boolean
  error?: string
}

/**
 * Perform web search using Serper API
 */
export async function webSearchTool(
  input: WebSearchInput,
  apiKey: string
): Promise<WebSearchOutput> {
  const { query, numResults = 10, traceId } = input
  const startTime = Date.now()

  console.log(`[WebSearch] Searching: "${query}"`)

  try {
    const response = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        q: query,
        num: numResults,
      }),
    })

    if (!response.ok) {
      console.error(`[WebSearch] Failed: ${response.status}`)
      return {
        results: [],
        query,
        success: false,
        error: `HTTP ${response.status}`,
      }
    }

    const data = await response.json()
    const organic = data.organic || []

    const results: SearchResult[] = organic.map((item: any) => ({
      type: "web" as const,
      title: item.title || "Untitled",
      url: item.link || item.url || "",
      snippet: item.snippet || item.description || "",
    }))

    const duration = Date.now() - startTime
    console.log(
      `[WebSearch] Success: ${results.length} results in ${duration}ms`
    )

    return {
      results,
      query,
      success: true,
    }
  } catch (error) {
    console.error("[WebSearch] Error:", error)
    return {
      results: [],
      query,
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    }
  }
}

/**
 * Tool definition for LangGraph
 */
export const webSearchToolDef = {
  name: "web_search",
  description:
    "Search the web using Google Search API. Returns up to 10 relevant results with titles, URLs, and snippets.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query (1-6 words for best results)",
      },
      numResults: {
        type: "number",
        description: "Number of results to return (default: 10, max: 10)",
        default: 10,
      },
    },
    required: ["query"],
  },
}
