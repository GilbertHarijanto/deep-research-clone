/**
 * LangGraph Tools Index
 * 
 * Central export point for all tools used in the research graph.
 */

export * from "./webSearch"
export * from "./arxiv"

// Tool registry for easy access
import { webSearchToolDef } from "./webSearch"
import { arxivSearchToolDef } from "./arxiv"

export const AVAILABLE_TOOLS = {
  web_search: webSearchToolDef,
  arxiv_search: arxivSearchToolDef,
} as const

export type ToolName = keyof typeof AVAILABLE_TOOLS
