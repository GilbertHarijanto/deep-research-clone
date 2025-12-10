/**
 * MCP Tools Node
 *
 * This node integrates MCP (Model Context Protocol) servers into the LangGraph workflow.
 * It can call tools from connected MCP servers and incorporate their results into the research.
 */

import OpenAI from "openai"
import { ResearchState } from "../state/types"
import { MCPClient, callMCPTool, getAllMCPTools } from "../../mcp/client"

export interface MCPToolCall {
  serverName: string
  toolName: string
  arguments: Record<string, any>
  result: any
  timestamp: string
}

/**
 * MCP Tools Node
 *
 * Uses AI to determine which MCP tools to call based on the research context,
 * then executes those tools and stores results in the state.
 */
export async function mcpToolsNode(
  state: ResearchState,
  openai: OpenAI,
  mcpClients: MCPClient[]
): Promise<Partial<ResearchState>> {
  console.log("[MCPToolsNode] Analyzing research context for MCP tool usage...")

  try {
    // Get all available tools
    const availableTools = getAllMCPTools(mcpClients)

    if (availableTools.length === 0) {
      console.log("[MCPToolsNode] No MCP tools available, skipping...")
      return {
        warnings: [
          ...(state.warnings || []),
          "No MCP tools available for this research",
        ],
      }
    }

    // Build context about the research
    const researchContext = buildResearchContext(state)

    // Ask AI which tools to use and how
    const toolCalls = await determineToolCalls(
      openai,
      researchContext,
      availableTools
    )

    if (toolCalls.length === 0) {
      console.log("[MCPToolsNode] No relevant MCP tools identified for this research")
      return {}
    }

    // Execute the tool calls
    const results: MCPToolCall[] = []
    for (const toolCall of toolCalls) {
      try {
        const client = mcpClients.find((c) => c.serverName === toolCall.serverName)
        if (!client) {
          console.error(`[MCPToolsNode] Client ${toolCall.serverName} not found`)
          continue
        }

        const result = await callMCPTool(client, toolCall.toolName, toolCall.arguments)

        results.push({
          serverName: toolCall.serverName,
          toolName: toolCall.toolName,
          arguments: toolCall.arguments,
          result,
          timestamp: new Date().toISOString(),
        })

        console.log(`[MCPToolsNode] Successfully called ${toolCall.toolName}`)
      } catch (error) {
        console.error(`[MCPToolsNode] Error calling ${toolCall.toolName}:`, error)
      }
    }

    // Store results in state (you might want to add this to ResearchState type)
    return {
      currentStep: "mcp_tools_executed",
      // You can extend ResearchState to include mcpToolResults if needed
      warnings: [
        ...(state.warnings || []),
        `Executed ${results.length} MCP tool calls`,
      ],
    }
  } catch (error) {
    console.error("[MCPToolsNode] Error:", error)
    return {
      errors: [...(state.errors || []), `MCP Tools Error: ${error}`],
    }
  }
}

/**
 * Build research context summary for AI decision-making
 */
function buildResearchContext(state: ResearchState): string {
  const parts: string[] = []

  parts.push(`Research Topic: ${state.topic}`)

  if (state.clarifyingAnswers && state.clarifyingAnswers.length > 0) {
    parts.push("\nClarifying Context:")
    state.clarifyingAnswers.forEach((qa) => {
      parts.push(`- ${qa.question}: ${qa.answer}`)
    })
  }

  if (state.searchQueries && state.searchQueries.length > 0) {
    parts.push("\nSearch Queries:")
    state.searchQueries.forEach((q) => {
      parts.push(`- ${q.query} (priority: ${q.priority})`)
    })
  }

  if (state.searchResults && state.searchResults.length > 0) {
    const totalResults = state.searchResults.reduce(
      (acc, r) => acc + r.webResults.length + r.arxivResults.length,
      0
    )
    parts.push(`\nSearch Results: ${totalResults} total results found`)
  }

  return parts.join("\n")
}

/**
 * Use AI to determine which MCP tools to call
 */
async function determineToolCalls(
  openai: OpenAI,
  researchContext: string,
  availableTools: Array<{ serverName: string; tool: any }>
): Promise<Array<{ serverName: string; toolName: string; arguments: Record<string, any> }>> {
  const toolsDescription = availableTools
    .map(
      ({ serverName, tool }) =>
        `- ${serverName}.${tool.name}: ${tool.description}\n  Schema: ${JSON.stringify(tool.inputSchema, null, 2)}`
    )
    .join("\n\n")

  const prompt = `You are analyzing a research project to determine if any external tools should be used.

Research Context:
${researchContext}

Available MCP Tools:
${toolsDescription}

Based on the research context, determine if any of these MCP tools would be helpful. For example:
- If researching something that could be stored/organized in Notion, use Notion API tools
- If the research involves data that should be saved to a database, use database tools
- If the research could benefit from external APIs, use those tools

Return a JSON array of tool calls to make. Each tool call should have:
{
  "serverName": "name of the MCP server",
  "toolName": "name of the tool to call",
  "arguments": { /* tool arguments based on the schema */ },
  "reasoning": "why this tool is relevant"
}

If no tools are relevant, return an empty array [].

IMPORTANT: Only suggest tools that are directly relevant to enhancing this specific research. Don't suggest tools just because they exist.`

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      {
        role: "system",
        content:
          "You are a research assistant that determines which external tools to use. Always respond with valid JSON.",
      },
      { role: "user", content: prompt },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  })

  const content = response.choices[0]?.message?.content
  if (!content) {
    return []
  }

  try {
    const parsed = JSON.parse(content)
    // Handle both { toolCalls: [...] } and direct array formats
    const toolCalls = Array.isArray(parsed) ? parsed : parsed.toolCalls || []
    return toolCalls
  } catch (error) {
    console.error("[MCPToolsNode] Failed to parse AI response:", error)
    return []
  }
}
