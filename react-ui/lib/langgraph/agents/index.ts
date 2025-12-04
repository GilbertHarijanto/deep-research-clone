/**
 * LangGraph Agents Index
 * 
 * Central export point for all autonomous agents.
 */

export * from "./critic"
export * from "./ideation"
export * from "./meta"

// Agent registry
export const AGENT_ROLES = {
  CRITIC: "critic",
  IDEATION: "ideation",
  META: "meta",
} as const

export type AgentRole = (typeof AGENT_ROLES)[keyof typeof AGENT_ROLES]
