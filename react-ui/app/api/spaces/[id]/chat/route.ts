import { NextResponse } from "next/server";
import OpenAI from "openai";
import { mustGetSpace, addMessage, addAsset } from "@/lib/spaceStore";
import { SpaceAsset, SpaceMessage, SpaceSnapshot } from "@/lib/spaceTypes";
import { randomUUID } from "crypto";
import { chatNode } from "@/lib/langgraph/nodes/chat";
import { ResearchState, Message } from "@/lib/langgraph/state/types";
import { connectToAllMCPServers, closeAllMCPConnections } from "@/lib/mcp/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

function log(...args: any[]) {
  console.log("[/api/spaces/[id]/chat]", ...args);
}

/**
 * Analyze image using backend Qwen-VL and PaddleOCR
 */
async function analyzeImage(imageUrl: string, question: string, spaceId: string, spaceTopic: string): Promise<string> {
  try {
    const formData = new FormData();
    formData.append("question", question);
    formData.append("image_urls", imageUrl);
    formData.append("space_id", spaceId);
    formData.append("space_topic", spaceTopic);

    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      log(`Image analysis failed: ${response.statusText}`);
      return "";
    }

    const result = await response.json();
    log("Image analysis result:", result.text.substring(0, 200));
    return result.text;
  } catch (error) {
    log("Error analyzing image:", error);
    return "";
  }
}

/**
 * Build comprehensive context including all nodes when nothing is selected
 */
function buildComprehensiveContext(space: SpaceSnapshot): string {
  const parts: string[] = [];

  parts.push(`## Complete Research Context`);
  parts.push(`Topic: ${space.topic}\n`);

  // Include ideation topics
  if (space.ideation && space.ideation.length > 0) {
    parts.push(`### Ideation Topics (${space.ideation.length}):`);
    space.ideation.forEach((idea, idx) => {
      parts.push(`${idx + 1}. ${idea.title}`);
    });
    parts.push("");
  }

  // Include queries
  if (space.queries && space.queries.length > 0) {
    parts.push(`### Research Queries (${space.queries.length}):`);
    space.queries.forEach((query, idx) => {
      parts.push(`${idx + 1}. "${query.query}" (Priority: ${query.priority}/5)`);
    });
    parts.push("");
  }

  // Include report summary
  if (space.reportMarkdown) {
    const lines = space.reportMarkdown.split("\n").slice(0, 20);
    parts.push(`### Report Summary (first 20 lines):`);
    parts.push(lines.join("\n"));
    parts.push("");
  }

  // Include references
  if (space.references && space.references.length > 0) {
    parts.push(`### References (${space.references.length} sources):`);
    space.references.slice(0, 10).forEach((ref) => {
      parts.push(`[${ref.id}] ${ref.title} - ${ref.url}`);
    });
    if (space.references.length > 10) {
      parts.push(`... and ${space.references.length - 10} more`);
    }
    parts.push("");
  }

  parts.push(`You have access to all research content. Answer questions about any aspect of the research.`);

  return parts.join("\n");
}

/**
 * Build context-specific information based on the selected node
 */
async function buildScopeContext(
  space: SpaceSnapshot,
  scope: NonNullable<SpaceMessage["scope"]>,
  userQuestion: string
): Promise<string> {
  const parts: string[] = [];

  parts.push(`## Current Focus: ${scope.nodeType.toUpperCase()}`);
  parts.push(`Node ID: ${scope.nodeId}\n`);

  // Extract specific context based on node type
  switch (scope.nodeType) {
    case "topic":
    case "image":
      // Check if this is an image node (nodeId starts with 'image-')
      if (scope.nodeId.startsWith("image-")) {
        log(`Detected image node: ${scope.nodeId}`);
        log(`Searching for image in ${space.assets?.length || 0} assets`);

        const imageAsset = space.assets?.find((a) => `image-${a.id}` === scope.nodeId);

        const scopedUrl = scope.imageUrl || imageAsset?.url;

        if (imageAsset) log(`Found image asset:`, { id: imageAsset.id, url: imageAsset.url });
        else if (scope.imageUrl) log(`Image asset not found for node: ${scope.nodeId}, falling back to scoped URL`);
        else log(`Image asset not found for node: ${scope.nodeId}`);

        if (scopedUrl) {
          parts.push(`You are discussing an image from the research.`);
          parts.push(`Image URL: ${scopedUrl}`);

          log(`Calling backend to analyze image: ${scopedUrl}`);

          // Analyze the image using backend
          const analysisResult = await analyzeImage(
            scopedUrl,
            userQuestion || "What is shown in this image? Provide detailed analysis.",
            space.id,
            space.topic
          );

          log(`Analysis result length: ${analysisResult?.length || 0}`);

          if (analysisResult) {
            parts.push(`\n### Image Analysis:`);
            parts.push(analysisResult);
            parts.push(`\n**Important**: Use the image analysis above to answer the user's question accurately. Do not make up information.`);
          } else {
            parts.push(`\nNote: Image analysis was not available. The backend server may not be running. Please acknowledge this limitation and inform the user that the image cannot be analyzed at this time.`);
          }
        } else {
          log(`Image asset has no URL or was not found`);
          parts.push(`You are discussing an image node, but the image data is not available.`);
        }
      } else {
        parts.push(`You are discussing the main research topic: "${space.topic}"`);
      }
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
      // Check if this is a document node
      if (scope.nodeId.startsWith("document-")) {
        log(`Detected document node: ${scope.nodeId}`);
        const documentAsset = space.assets?.find(
          (a) => `document-${a.id}` === scope.nodeId || (a.kind === "doc" || a.kind === "image") && a.text
        );

        if (documentAsset) {
          log(`Found document asset: ${documentAsset.title}, text length: ${documentAsset.text?.length || 0}`);
          parts.push(`You are discussing a document: "${documentAsset.title}"`);

          if (documentAsset.text) {
            parts.push(`\n### Document Content:`);
            parts.push(documentAsset.text);
            parts.push(`\n**Important**: Answer the user's question based on the document content above. Be specific and reference the actual content.`);
          } else {
            parts.push(`\nNote: Document content extraction is in progress or unavailable.`);
          }
        }
      } else {
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

  if (!scope.nodeId.startsWith("image-")) {
    parts.push(
      `\n**Important**: Keep your responses focused on this specific ${scope.nodeType}. Reference the broader research context only when relevant.`
    );
  }

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

    // Get the last user message to extract scope and question
    const lastUserMessage = [...recent].reverse().find((m) => m.role === "user");
    const scope = lastUserMessage?.scope;
    const userQuestion = lastUserMessage?.text || "";

    log("Message scope:", scope);
    log("User question:", userQuestion.substring(0, 100));

    // Ensure canvas image nodes are represented as assets so backend context can resolve them
    if (scope?.nodeId?.startsWith("image-") && scope.imageUrl) {
      const assetId = scope.nodeId.replace(/^image-/, "");
      const existing = space.assets?.find((a) => a.id === assetId);

      if (!existing) {
        const newAsset: SpaceAsset = {
          id: assetId,
          kind: "image",
          url: scope.imageUrl,
          title: "Canvas image",
          createdAt: new Date().toISOString(),
        };
        addAsset(id, newAsset);
        log("Added missing image asset from scope:", { id: newAsset.id, url: newAsset.url });
      } else if (!existing.url) {
        existing.url = scope.imageUrl;
        log("Updated existing image asset URL from scope:", { id: existing.id, url: existing.url });
      }
    }

    // Connect to MCP servers for tool support
    try {
      mcpClients = await connectToAllMCPServers();
      log(`Connected to ${mcpClients.length} MCP servers`);
    } catch (error) {
      log("Warning: Could not connect to MCP servers:", error);
      // Continue without MCP tools
    }

    // Build context - either scope-specific or comprehensive
    let scopeContext = "";
    if (scope) {
      scopeContext = await buildScopeContext(space, scope, userQuestion);
      log("Scope context built:", scopeContext.substring(0, 200));
    } else {
      // No scope means no selection - provide comprehensive context
      scopeContext = buildComprehensiveContext(space);
      log("Comprehensive context built (no selection)");
    }

    // Convert SpaceMessage[] to Message[] for chatNode
    const chatMessages: Message[] = recent.map((m) => ({
      role: m.role,
      content: m.text ?? "",
      timestamp: m.createdAt,
    }));

    // Always add context as a system message (either scope-specific or comprehensive)
    chatMessages.unshift({
      role: "system",
      content: scopeContext,
      timestamp: new Date().toISOString(),
    });

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
