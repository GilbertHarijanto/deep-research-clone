/**
 * Chat Node with MCP Tool Execution
 *
 * This node enables interactive chat with the research agent,
 * including the ability to execute MCP tools based on user instructions.
 */

import OpenAI from "openai"
import { ResearchState, Message } from "../state/types"
import { MCPClient, callMCPTool, getAllMCPTools } from "../../mcp/client"

export interface ChatNodeOptions {
  mcpClients?: MCPClient[]
}

/**
 * Chat Node
 *
 * Processes user messages and generates responses, with the ability to
 * execute MCP tools when requested (e.g., "save this to Notion").
 */
export async function chatNode(
  state: ResearchState,
  openai: OpenAI,
  options?: ChatNodeOptions
): Promise<Partial<ResearchState>> {
  console.log("[ChatNode] Processing user message...")

  try {
    const { chatMessages = [], report, topic, searchResults } = state
    const mcpClients = options?.mcpClients || []

    if (chatMessages.length === 0) {
      return {
        errors: [...(state.errors || []), "No chat messages to process"],
      }
    }

    // Get the latest user message
    const latestMessage = chatMessages[chatMessages.length - 1]
    if (latestMessage.role !== "user") {
      return {
        errors: [...(state.errors || []), "Latest message is not from user"],
      }
    }

    // Build context for the chat
    const context = buildChatContext(state)

    // Check if MCP tools are available and build tool definitions
    let tools: any[] = []
    const mcpToolsMap = new Map<string, { serverName: string; tool: any }>()

    if (mcpClients.length > 0) {
      const allMCPTools = getAllMCPTools(mcpClients)

      // Convert MCP tools to OpenAI function calling format
      tools = allMCPTools.map(({ serverName, tool }) => {
        // OpenAI requires function names to match ^[a-zA-Z0-9_-]+$
        // Replace dots and other invalid characters with underscores
        const toolKey = `${serverName}__${tool.name}`.replace(/[^a-zA-Z0-9_-]/g, '_')
        mcpToolsMap.set(toolKey, { serverName, tool })

        return {
          type: "function",
          function: {
            name: toolKey,
            description: `[${serverName}] ${tool.description}`,
            parameters: tool.inputSchema,
          },
        }
      })

      console.log(`[ChatNode] ${tools.length} MCP tools available for chat`)
    }

    // Build messages for OpenAI
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: `You are a research assistant helping the user with their research on "${topic}".

${context}

You can help the user:
1. Answer questions about the research
2. Explain findings and sources
3. Execute actions using available tools (like saving to Notion, creating pages, etc.)

${tools.length > 0 ? `## Available Tools
You have access to ${tools.length} MCP tools for Notion. Use them proactively when the user requests actions.

### When Creating Notion Content:

**IMPORTANT STYLING GUIDELINES:**
- Always use rich formatting when creating pages or adding content
- Use **paragraphs** for body text with proper structure
- Use **bulleted lists** (bulleted_list_item) for key points and findings
- Break content into multiple blocks for better readability
- Each major section should be a separate paragraph block
- Lists should have multiple items, not just one

**Content Structure Best Practices:**
1. **For Research Summaries:**
   - Start with a paragraph introducing the topic
   - Use bulleted lists for key findings (3-5 items minimum)
   - Add paragraphs for detailed explanations
   - Include bulleted lists for recommendations
   - End with a conclusion paragraph

2. **For Saving Research:**
   - Create a descriptive title
   - Add an executive summary paragraph
   - List key findings as bulleted items (be comprehensive)
   - Add detailed sections with paragraphs
   - Include source citations as bulleted items

3. **Text Formatting:**
   - Use proper punctuation and capitalization
   - Write complete sentences
   - Be detailed and thorough (don't be brief)
   - Expand on ideas with context and examples

**Example Structure for Research:**
\`\`\`
Paragraph: Introduction and overview
Bulleted List:
  - Key Finding 1 with details
  - Key Finding 2 with details
  - Key Finding 3 with details
Paragraph: Detailed analysis section
Bulleted List:
  - Recommendation 1
  - Recommendation 2
Paragraph: Conclusion
\`\`\`

**Tool Usage:**
- Use API-post-page to create new pages (requires parent page_id)
- Use API-patch-block-children to add content blocks to existing pages
- Use API-post-search to find existing pages
- Use API-get-self to get user info when needed
- Always provide detailed, well-formatted content - quality over brevity!

When the user asks to save or create content, make it comprehensive and well-structured.` : ""}`,
      },
      ...chatMessages.map((msg) => ({
        role: msg.role as "user" | "assistant" | "system",
        content: msg.content,
      })),
    ]

    // Call OpenAI with or without tools
    const chatParams: OpenAI.Chat.ChatCompletionCreateParams = {
      model: "gpt-4o",
      messages,
      temperature: 0.7,
    }

    if (tools.length > 0) {
      chatParams.tools = tools as any
      chatParams.tool_choice = "auto"
    }

    let response = await openai.chat.completions.create(chatParams)
    let assistantMessage = response.choices[0].message

    // Handle tool calls
    const toolCallResults: Array<{
      toolName: string
      arguments: any
      result: any
    }> = []

    while (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
      console.log(
        `[ChatNode] AI requested ${assistantMessage.tool_calls.length} tool calls`
      )

      // Execute each tool call
      const toolMessages: OpenAI.Chat.ChatCompletionMessageParam[] = []

      for (const toolCall of assistantMessage.tool_calls) {
        const toolKey = toolCall.function.name
        const toolArgs = JSON.parse(toolCall.function.arguments)

        console.log(`[ChatNode] Executing tool: ${toolKey}`)

        const mcpTool = mcpToolsMap.get(toolKey)
        if (!mcpTool) {
          console.error(`[ChatNode] Tool ${toolKey} not found`)
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: "Tool not found" }),
          })
          continue
        }

        try {
          const mcpClient = mcpClients.find(
            (c) => c.serverName === mcpTool.serverName
          )
          if (!mcpClient) {
            throw new Error(`MCP client ${mcpTool.serverName} not found`)
          }

          const result = await callMCPTool(
            mcpClient,
            mcpTool.tool.name,
            toolArgs
          )

          toolCallResults.push({
            toolName: toolKey,
            arguments: toolArgs,
            result,
          })

          // Add tool result to messages
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify(result),
          })

          console.log(`[ChatNode] Tool ${toolKey} executed successfully`)
        } catch (error) {
          console.error(`[ChatNode] Tool ${toolKey} failed:`, error)
          toolMessages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: JSON.stringify({ error: String(error) }),
          })
        }
      }

      // Continue conversation with tool results
      messages.push({
        role: "assistant",
        content: assistantMessage.content,
        tool_calls: assistantMessage.tool_calls as any,
      })
      messages.push(...toolMessages)

      // Get next response
      response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages,
        temperature: 0.7,
        tools: tools.length > 0 ? (tools as any) : undefined,
        tool_choice: tools.length > 0 ? "auto" : undefined,
      })

      assistantMessage = response.choices[0].message
    }

    // Final response
    const finalResponse = assistantMessage.content || ""

    console.log(
      `[ChatNode] Generated response${toolCallResults.length > 0 ? ` with ${toolCallResults.length} tool calls` : ""}`
    )

    // Update chat messages with assistant response
    const updatedMessages: Message[] = [
      ...chatMessages,
      {
        role: "assistant",
        content: finalResponse,
        timestamp: new Date().toISOString(),
      },
    ]

    return {
      chatMessages: updatedMessages,
      chatResponse: finalResponse,
      currentStep: "chat_complete",
    }
  } catch (error) {
    console.error("[ChatNode] Error:", error)
    return {
      errors: [...(state.errors || []), `Chat Error: ${error}`],
      chatResponse: "I encountered an error processing your request. Please try again.",
    }
  }
}

/**
 * Build context summary for the chat
 */
function buildChatContext(state: ResearchState): string {
  const parts: string[] = []

  if (state.report) {
    parts.push("RESEARCH COMPLETED")
    parts.push(`Topic: ${state.topic}`)
    parts.push(
      `\nThe research report has been generated with ${state.report.metadata?.totalSources || 0} sources.`
    )

    if (state.report.structured) {
      parts.push(
        `\nKey findings: ${state.report.structured.keyFindings?.length || 0} themes identified`
      )
    }

    // Include a summary of the report for context
    if (state.report.structured?.executiveSummary) {
      parts.push(`\nExecutive Summary:\n${state.report.structured.executiveSummary}`)
    }
  } else if (state.searchResults) {
    parts.push("RESEARCH IN PROGRESS")
    parts.push(
      `Found ${state.searchResults.reduce((acc, r) => acc + r.webResults.length + r.arxivResults.length, 0)} results`
    )
  }

  return parts.join("\n")
}
