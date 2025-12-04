/**
 * Search Node
 * 
 * Executes web and arXiv searches for all generated queries.
 * Combines results and structures them for report generation.
 */

import { ResearchState, QuerySearchResults } from "../state/types"
import { webSearchTool } from "../tools/webSearch"
import { arxivSearchTool } from "../tools/arxiv"

/**
 * Execute combined search (Web + arXiv) for a single query
 */
async function executeCombinedSearch(
  query: string,
  priority: number,
  includeArxiv: boolean,
  serperApiKey: string
): Promise<QuerySearchResults> {
  console.log(`[Search] Executing: "${query}"`)

  const webPromise = webSearchTool(
    { query, numResults: 8 },
    serperApiKey
  )

  const arxivPromise = includeArxiv
    ? arxivSearchTool({ query, maxResults: 5 })
    : Promise.resolve({ results: [], query, success: true })

  const [webOutput, arxivOutput] = await Promise.all([webPromise, arxivPromise])

  return {
    query,
    priority,
    webResults: webOutput.results,
    arxivResults: arxivOutput.results,
  }
}

/**
 * Search Node - Execute all searches
 */
export async function searchNode(
  state: ResearchState,
  config: { serperApiKey: string }
): Promise<Partial<ResearchState>> {
  const queries = state.selectedQueries || state.searchQueries || []
  const includeArxiv = state.includeArxiv ?? true

  if (queries.length === 0) {
    console.log("[Search] No queries to search")
    return {
      errors: [...(state.errors || []), "No search queries available"],
    }
  }

  console.log(
    `[Search] Starting ${queries.length} searches (arXiv: ${includeArxiv})`
  )

  try {
    const searchResults: QuerySearchResults[] = []

    for (const query of queries) {
      try {
        const result = await executeCombinedSearch(
          query.query,
          query.priority,
          includeArxiv,
          config.serperApiKey
        )

        if (result.webResults.length > 0 || result.arxivResults.length > 0) {
          searchResults.push(result)
        }

        // Rate limiting - wait 1 second between requests
        await new Promise((resolve) => setTimeout(resolve, 1000))
      } catch (error) {
        console.error(`[Search] Failed for "${query.query}":`, error)
      }
    }

    const totalWebSources = searchResults.reduce(
      (sum, r) => sum + r.webResults.length,
      0
    )
    const totalArxivSources = searchResults.reduce(
      (sum, r) => sum + r.arxivResults.length,
      0
    )

    console.log(
      `[Search] Completed: ${searchResults.length} result sets (Web: ${totalWebSources}, arXiv: ${totalArxivSources})`
    )

    if (searchResults.length === 0) {
      return {
        errors: [
          ...(state.errors || []),
          "No search results found. Check API keys.",
        ],
        searchResults: [],
      }
    }

    return {
      searchResults,
      currentStep: "search_complete",
    }
  } catch (error) {
    console.error("[Search] Error:", error)
    return {
      errors: [
        ...(state.errors || []),
        `Search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      ],
    }
  }
}
