import { NextResponse } from "next/server";
import OpenAI from "openai";
import { mustGetSpace, addMessage } from "@/lib/spaceStore";
import { SpaceMessage, SpaceSnapshot } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";
import { chatNode } from "@/lib/langgraph/nodes/chat";
import { ResearchState, Message } from "@/lib/langgraph/state/types";
import { connectToAllMCPServers, closeAllMCPConnections } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function log(...args: any[]) {
  console.log("[/api/spaces/[id]/chat]", ...args);
}

/**
 * Build context-specific information based on the selected node
 */
function buildScopeContext(
  space: SpaceSnapshot,
  scope: { nodeId: string; nodeType: string }
): string {
  const parts: string[] = [];

  parts.push(`## Current Focus: ${scope.nodeType.toUpperCase()}`);
  parts.push(`Node ID: ${scope.nodeId}\n`);

  // Extract specific context based on node type
  switch (scope.nodeType) {
    case "topic":
      parts.push(`You are discussing the main research topic: "${space.topic}"`);
      break;

    case "idea":
    case "ideation":
      const idea = space.ideation?.find((i) => `idea-${i.id}` === scope.nodeId);
      if (idea) {
        parts.push(`You are discussing the ideation topic: "${idea.title}"`);
        parts.push(
          `Focus your responses on this specific aspect of the broader research topic.`
        );
      }
      break;

    case "query":
      const query = space.queries?.find((q) => `query-${q.id}` === scope.nodeId);
      if (query) {
        parts.push(`You are discussing the search query: "${query.query}"`);
        parts.push(`Priority: ${query.priority}/5`);
        parts.push(
          `Focus on this specific research question and its findings.`
        );
      }
      break;

    case "evidence":
      const finding = space.findings?.find((f) => f.id === scope.nodeId);
      if (finding) {
        parts.push(`You are discussing this specific evidence:`);
        parts.push(`"${finding.text.substring(0, 200)}..."`);
        if (finding.refs && finding.refs.length > 0) {
          parts.push(`\nSources:`);
          finding.refs.forEach((ref) => {
            parts.push(`- ${ref.title}: ${ref.url}`);
          });
        }
      }
      break;

    case "report":
      parts.push(`You are discussing the final research report.`);
      parts.push(
        `The user is asking about the overall findings and synthesis.`
      );
      break;

    default:
      parts.push(`You are discussing: ${scope.nodeId}`);
  }

  parts.push(
    `\n**Important**: Keep your responses focused on this specific ${scope.nodeType}. Reference the broader research context only when relevant.`
  );

  return parts.join("\n");
}

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  let mcpClients: any[] = [];

  try {
    const { id } = await ctx.params;

    log("Incoming chat POST for space:", id);

    const space = mustGetSpace(id);
    log("Loaded space:", space.topic);

    const recent = space.messages.slice(-20);
    log("Recent messages count:", recent.length);

    // Get the last user message to extract scope
    const lastUserMessage = [...recent].reverse().find((m) => m.role === "user");
    const scope = lastUserMessage?.scope;

    log("Message scope:", scope);

    // Connect to MCP servers for tool support
    try {
      mcpClients = await connectToAllMCPServers();
      log(`Connected to ${mcpClients.length} MCP servers`);
    } catch (error) {
      log("Warning: Could not connect to MCP servers:", error);
      // Continue without MCP tools
    }

    // Build scope-specific context
    let scopeContext = "";
    if (scope) {
      scopeContext = buildScopeContext(space, scope);
      log("Scope context built:", scopeContext.substring(0, 200));
    }

    // Convert SpaceMessage[] to Message[] for chatNode
    const chatMessages: Message[] = recent.map((m) => ({
      role: m.role,
      content: m.text ?? "",
      timestamp: m.createdAt,
    }));

    // Add scope context as a system message if available
    if (scopeContext) {
      chatMessages.unshift({
        role: "system",
        content: scopeContext,
        timestamp: new Date().toISOString(),
      });
    }

    // Build research state for chatNode
    const state: ResearchState = {
      topic: space.topic,
      chatMessages,
      // Include report markdown if available (chatNode uses this for context)
      report: space.reportMarkdown
        ? ({
            markdown: space.reportMarkdown,
          } as any) // Use type assertion since we don't have full structured report
        : undefined,
    };

    log("Calling chatNode with MCP tools...");

    // Use the chatNode with MCP support
    const result = await chatNode(state, openai, {
      mcpClients,
    });

    log("ChatNode response:", result.chatResponse);

    const text = result.chatResponse || "";

    const aiMsg: SpaceMessage = {
      id: randomUUID(),
      role: "assistant",
      text,
      createdAt: new Date().toISOString(),
      // Preserve scope from the user's question for conversation threading
      scope: scope,
    };

    addMessage(id, aiMsg);

    log("AI message saved:", aiMsg);

    return NextResponse.json(aiMsg);
  } catch (err) {
    log("ERROR OCCURRED:", err);
    return NextResponse.json(
      { error: (err as Error).message ?? "Chat failed" },
      { status: 500 }
    );
  } finally {
    // Clean up MCP connections
    if (mcpClients.length > 0) {
      try {
        await closeAllMCPConnections(mcpClients);
        log("MCP connections closed");
      } catch (error) {
        log("Error closing MCP connections:", error);
      }
    }
  }
}
