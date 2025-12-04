/**
 * ArXiv Search Tool
 * 
 * Searches arXiv.org for academic papers and preprints.
 */

import { SearchResult } from "../state/types"

export interface ArxivSearchInput {
  query: string
  maxResults?: number
  traceId?: string
}

export interface ArxivSearchOutput {
  results: SearchResult[]
  query: string
  success: boolean
  error?: string
}

/**
 * Parse arXiv XML response
 */
function parseArxivXML(xmlText: string): SearchResult[] {
  const entries: SearchResult[] = []

  const entryRegex = /<entry>([\s\S]*?)<\/entry>/g
  const matches = xmlText.matchAll(entryRegex)

  for (const match of matches) {
    const entryXML = match[1]

    // Extract fields
    const title =
      entryXML
        .match(/<title>([\s\S]*?)<\/title>/)?.[1]
        ?.trim()
        .replace(/\s+/g, " ") || ""
    const summary =
      entryXML
        .match(/<summary>([\s\S]*?)<\/summary>/)?.[1]
        ?.trim()
        .replace(/\s+/g, " ") || ""
    const published =
      entryXML.match(/<published>([\s\S]*?)<\/published>/)?.[1]?.trim() || ""
    const id = entryXML.match(/<id>([\s\S]*?)<\/id>/)?.[1]?.trim() || ""

    // Extract authors
    const authorRegex =
      /<author>[\s\S]*?<name>([\s\S]*?)<\/name>[\s\S]*?<\/author>/g
    const authors: string[] = []
    const authorMatches = entryXML.matchAll(authorRegex)
    for (const authorMatch of authorMatches) {
      authors.push(authorMatch[1].trim())
    }

    // Extract PDF link
    const pdfLink =
      entryXML.match(/<link.*?title="pdf".*?href="([\s\S]*?)"/) ||
      entryXML.match(/<link.*?href="([\s\S]*?)".*?title="pdf"/)
    const pdfUrl = pdfLink?.[1]?.trim() || id.replace("/abs/", "/pdf/")

    entries.push({
      type: "arxiv",
      title,
      url: id,
      snippet: summary,
      authors: authors.join(", "),
      published,
      pdfUrl,
    })
  }

  return entries
}

/**
 * Perform arXiv search
 */
export async function arxivSearchTool(
  input: ArxivSearchInput
): Promise<ArxivSearchOutput> {
  const { query, maxResults = 10, traceId } = input
  const startTime = Date.now()

  console.log(`[ArXiv] Searching: "${query}"`)

  try {
    const encodedQuery = encodeURIComponent(query)
    const url = `http://export.arxiv.org/api/query?search_query=all:${encodedQuery}&start=0&max_results=${maxResults}&sortBy=relevance&sortOrder=descending`

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent": "LangGraph-Research-Agent/1.0",
      },
    })

    if (!response.ok) {
      console.error(`[ArXiv] Failed: ${response.status}`)
      return {
        results: [],
        query,
        success: false,
        error: `HTTP ${response.status}`,
      }
    }

    const xmlText = await response.text()
    const results = parseArxivXML(xmlText)

    const duration = Date.now() - startTime
    console.log(`[ArXiv] Success: ${results.length} results in ${duration}ms`)

    return {
      results,
      query,
      success: true,
    }
  } catch (error) {
    console.error("[ArXiv] Error:", error)
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
export const arxivSearchToolDef = {
  name: "arxiv_search",
  description:
    "Search arXiv.org for academic papers and preprints. Returns papers with titles, abstracts, authors, and PDF links.",
  parameters: {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "The search query (academic topic or keywords)",
      },
      maxResults: {
        type: "number",
        description: "Maximum number of papers to return (default: 10)",
        default: 10,
      },
    },
    required: ["query"],
  },
}
