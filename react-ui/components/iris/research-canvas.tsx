"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  ReactFlowProvider,
  addEdge,
  Background,
  Controls,
  Node,
  Edge,
  OnSelectionChangeParams,
  useNodesState,
  useEdgesState,
  NodeMouseHandler,
  Connection,
} from "reactflow";

import "reactflow/dist/style.css";
import { nanoid } from "nanoid";
import dagre from "dagre";

import {
  TopicNode,
  IdeationNode,
  QueryNode,
  NoteNode,
  ImageNode,
  PdfNode,
  SummaryNode,
  ChatResponseNode,
  DocumentNode,
} from "./rf-nodes";

import type { SpaceMessage } from "@/lib/spaceTypes";

/* -------------------------------------------------------------------------- */
/*                             NODE TYPES                                      */
/* -------------------------------------------------------------------------- */

const nodeTypes = {
  topic: TopicNode,
  ideation: IdeationNode,
  query: QueryNode,
  note: NoteNode,
  image: ImageNode,
  pdf: PdfNode,
  summary: SummaryNode,
  chatResponse: ChatResponseNode,
  document: DocumentNode,
};

/* -------------------------------------------------------------------------- */
/*                      DAGRE AUTO-LAYOUT HELPERS                             */
/* -------------------------------------------------------------------------- */

function getLayoutedElements(
  nodes: Node[],
  edges: Edge[]
): { nodes: Node[]; edges: Edge[] } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({
  rankdir: "TB",
  ranksep: 150,
  nodesep: 100,
  marginx: 40,
  marginy: 40,
});

  g.setDefaultEdgeLabel(() => ({}));

  nodes.forEach((node) => {
    g.setNode(node.id, { width: 260, height: 100 });
  });

  edges.forEach((e) => {
    g.setEdge(e.source, e.target);
  });

  dagre.layout(g);

  const layoutedNodes = nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - 130,
        y: pos.y - 50,
      },
    };
  });

  return { nodes: layoutedNodes, edges };
}

/* -------------------------------------------------------------------------- */
/*                       MARKDOWN → SECTIONS & REFS                           */
/* -------------------------------------------------------------------------- */

type SectionInfo = {
  id: string;
  heading: string;
  summary: string;
  citationNumbers: number[];
};

type ReferenceInfo = {
  number: number;
  title: string;
  url: string;
};

function makeLocalSummary(text: string): string {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return "";

  const split = cleaned.split(/(?<=[.!?])\s+/);
  return split.slice(0, 2).join(" ").slice(0, 240);
}

function extractSections(markdown: string): SectionInfo[] {
  const lines = markdown.split("\n");
  const sections: SectionInfo[] = [];

  let currentHeading: string | null = null;
  let currentLines: string[] = [];

  function flush() {
    if (!currentHeading) return;
    const body = currentLines.join("\n");

    const summary = makeLocalSummary(body);
    const citationSet = new Set<number>();

    const citationRegex = /\[(\d+)\]/g;
    let m;
    while ((m = citationRegex.exec(body))) {
      citationSet.add(Number(m[1]));
    }

    sections.push({
      id: `section-${sections.length + 1}`,
      heading: currentHeading,
      summary,
      citationNumbers: [...citationSet],
    });

    currentHeading = null;
    currentLines = [];
  }

  for (const raw of lines) {
    const line = raw.trim();

    const h3 = /^###\s+(.+)$/.exec(line);
    if (h3) {
      flush();
      currentHeading = h3[1];
      continue;
    }

    if (currentHeading) currentLines.push(raw);
  }

  flush();
  return sections;
}

function extractReferences(markdown: string): ReferenceInfo[] {
  const refs: ReferenceInfo[] = [];
  const lines = markdown.split("\n");

  let inRefs = false;
  for (const raw of lines) {
    const line = raw.trim();

    if (/^##\s+References/.test(line)) {
      inRefs = true;
      continue;
    }
    if (!inRefs) continue;

    const m = /^\[(\d+)\]\s*(.+?)\s*–\s*(https?:\/\/.+)$/.exec(line);
    if (!m) continue;

    refs.push({
      number: Number(m[1]),
      title: m[2],
      url: m[3],
    });
  }

  return refs;
}

/* -------------------------------------------------------------------------- */
/*                      COMPONENT PROPS                                        */
/* -------------------------------------------------------------------------- */

type ResearchCanvasProps = {
  topic: string;
  ideation: Array<{ id: string; title: string }>;
  queries: Array<{ id: string; query: string; priority: number }>;
  findings: Array<{ id: string; text: string }>;
  reportMarkdown: string;
  messages: SpaceMessage[];

  onAskFromCanvas: (args: {
    question: string;
    scopeNodeId: string;
    scopeType: "topic" | "report" | "idea" | "query" | "evidence" | "image";
    scopeImageUrl?: string;
  }) => Promise<{ type: "query"; query: string; priority: number } | void>;
};

/* -------------------------------------------------------------------------- */
/*                           MAIN CANVAS                                      */
/* -------------------------------------------------------------------------- */

export default function ResearchCanvas({
  topic,
  ideation,
  queries,
  findings,
  reportMarkdown,
  messages = [],
  onAskFromCanvas,
}: ResearchCanvasProps) {
  const [activeNodeId, setActiveNodeId] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  /* --------------------------- Build Graph --------------------------- */

  // Store all nodes data for context passing
  const [allNodesData, setAllNodesData] = useState<Map<string, any>>(new Map());

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodesDataMap = new Map<string, any>();

    const topicId = "topic-1";

    const topicData = { title: topic };
    nodes.push({
      id: topicId,
      type: "topic",
      data: topicData,
      position: { x: 400, y: 40 },
    });
    nodesDataMap.set(topicId, topicData);

    ideation.forEach((i, idx) => {
      const id = `idea-${i.id}`;
      const ideaData = { title: i.title };
      nodes.push({
        id,
        type: "ideation",
        data: ideaData,
        position: { x: 150 + idx * 260, y: 180 },
      });
      nodesDataMap.set(id, ideaData);
      edges.push({
        id: `e-${topicId}-${id}`,
        source: topicId,
        target: id,
        type: "smoothstep",
      });
    });

    queries.forEach((q, idx) => {
      const id = `query-${q.id}`;
      const queryData = { query: q.query, priority: q.priority };
      nodes.push({
        id,
        type: "query",
        data: queryData,
        position: { x: 150 + idx * 240, y: 320 },
      });
      nodesDataMap.set(id, queryData);
      edges.push({
        id: `e-${topicId}-${id}`,
        source: topicId,
        target: id,
        type: "smoothstep",
      });
    });

    const sections = extractSections(reportMarkdown);
    const refs = extractReferences(reportMarkdown);
    const pdfByNum = new Map<number, string>();

    sections.forEach((sec, idx) => {
      const id = `summary-${idx + 1}`;
      const summaryData = { title: sec.heading, text: sec.summary };
      nodes.push({
        id,
        type: "summary",
        data: summaryData,
        position: { x: 150 + idx * 260, y: 480 },
      });
      nodesDataMap.set(id, summaryData);

      edges.push({
        id: `e-${topicId}-${id}`,
        source: topicId,
        target: id,
        type: "smoothstep",
      });
    });

    refs.forEach((ref, i) => {
      const id = `pdf-${ref.number}`;
      pdfByNum.set(ref.number, id);
      const pdfData = { title: ref.title, url: ref.url };
      nodes.push({
        id,
        type: "pdf",
        data: pdfData,
        position: { x: 200 + i * 220, y: 640 },
      });
      nodesDataMap.set(id, pdfData);
    });

    sections.forEach((sec, idx) => {
      const summaryId = `summary-${idx + 1}`;
      sec.citationNumbers.forEach((num) => {
        const pdfId = pdfByNum.get(num);
        if (!pdfId) return;

        edges.push({
          id: `e-${summaryId}-${pdfId}`,
          source: summaryId,
          target: pdfId,
          type: "smoothstep",
        });
      });
    });

    // Store the nodes data map for later use
    setAllNodesData(nodesDataMap);

    return {
      initialNodes: nodes,
      initialEdges: edges,
    };
  }, [topic, ideation, queries, findings, reportMarkdown]);

  /* --------------------------- ReactFlow State --------------------------- */

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [pdfURL, setPdfURL] = useState<string | null>(null);
  const [processedMessageIds, setProcessedMessageIds] = useState<Set<string>>(new Set());

  // Create chat response nodes from new messages
  useEffect(() => {
    const newMessages = messages.filter(
      (m) => m.role === "assistant" && !processedMessageIds.has(m.id)
    );

    if (newMessages.length === 0) return;

    const newChatNodes: Node[] = [];
    const newChatEdges: Edge[] = [];

    // Get existing node IDs to avoid duplicates
    const existingNodeIds = new Set(nodes.map(n => n.id));

    newMessages.forEach((msg, idx) => {
      const nodeId = `chat-${msg.id}`;

      // Skip if node already exists
      if (existingNodeIds.has(nodeId)) return;

      // Find the corresponding user message
      const msgIndex = messages.findIndex((m) => m.id === msg.id);
      const userMsg = msgIndex > 0 ? messages[msgIndex - 1] : null;
      const question = userMsg?.role === "user" ? userMsg.text : "Question";

      // Count existing chat nodes to position new ones correctly
      const existingChatNodeCount = nodes.filter(n => n.id.startsWith('chat-')).length;
      const yOffset = 200 + (existingChatNodeCount + idx) * 140;

      newChatNodes.push({
        id: nodeId,
        type: "chatResponse",
        data: {
          question,
          response: msg.text,
          timestamp: msg.createdAt,
        },
        position: { x: 800, y: yOffset },
      });

      // Connect to the scope node if available
      if (msg.scope?.nodeId) {
        const edgeId = `edge-${msg.scope.nodeId}-to-${nodeId}`;
        newChatEdges.push({
          id: edgeId,
          source: msg.scope.nodeId,
          target: nodeId,
          type: "smoothstep",
          animated: true,
        });
      }
    });

    if (newChatNodes.length > 0) {
      setNodes((nds) => [...nds, ...newChatNodes]);
      setEdges((eds) => [...eds, ...newChatEdges]);
      setProcessedMessageIds((prev) => {
        const newSet = new Set(prev);
        newMessages.forEach((m) => newSet.add(m.id));
        return newSet;
      });
    }
  }, [messages, nodes, processedMessageIds, setNodes, setEdges]);

  /* --------------------------- Event Handlers --------------------------- */

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedIds(params.nodes.map((n) => n.id));
  }, []);

  const onNodeClick: NodeMouseHandler = (_, node) => {
    setActiveNodeId(node.id);

    if (node.type === "pdf" && node.data?.url) {
      setPdfURL(node.data.url);
    }
  };

  const onConnect = useCallback(
    (params: Connection) => {
      setEdges((eds) =>
        addEdge({ ...params, animated: true, type: "smoothstep" }, eds)
      );
    },
    [setEdges]
  );

  const handleTidyLayout = () => {
    const { nodes: nextNodes, edges: nextEdges } = getLayoutedElements(
      nodes,
      edges
    );
    setNodes(nextNodes);
    setEdges(nextEdges);
  };

  const handleDocumentUpload = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);

      // Get spaceId from the URL or context
      const pathParts = window.location.pathname.split("/");
      const spaceId = pathParts[pathParts.length - 1];

      const response = await fetch(`/api/spaces/${spaceId}/assets`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        console.error("Document upload failed");
        return;
      }

      const asset = await response.json();

      // Create a document node on the canvas
      const nodeId = `document-${nanoid()}`;
      setNodes((nds) => [
        ...nds,
        {
          id: nodeId,
          type: "document",
          data: {
            title: asset.title || file.name,
            text: asset.text || "",
            kind: asset.kind,
          },
          position: { x: 480, y: 400 },
        },
      ]);
    } catch (error) {
      console.error("Error uploading document:", error);
    }
  };

  /* --------------------------- Render --------------------------- */

  return (
    <ReactFlowProvider>
      <div className="grid grid-cols-[64px_1fr_360px] grid-rows-[1fr_72px] h-[88vh] bg-neutral-50 border rounded-xl overflow-hidden">

        {/* LEFT TOOLBAR */}
        <aside className="row-span-2 bg-white border-r flex flex-col items-center pt-4 gap-2">

          <ToolButton label="Add Note" onClick={() => {
            const id = `note-${nanoid()}`;
            setNodes((nds) => [
              ...nds,
              {
                id,
                type: "note",
                data: { text: "" },
                position: { x: 480, y: 200 },
              },
            ]);
          }}>
            ▣
          </ToolButton>

          <ToolButton
            label="Add Document"
            onClick={() => fileInputRef.current?.click()}
          >
            📄
          </ToolButton>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg,.gif,.bmp"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) {
                handleDocumentUpload(file);
                e.target.value = ""; // Reset input
              }
            }}
          />

          <ToolButton label="Add Image" onClick={() => {
            const id = `image-${nanoid()}`;
            setNodes((nds) => [
              ...nds,
              {
                id,
                type: "image",
                data: { url: "" },
                position: { x: 480, y: 400 },
              },
            ]);
          }}>
            🖼️
          </ToolButton>

          <ToolButton label="Tidy Layout" onClick={handleTidyLayout}>
            🧹
          </ToolButton>

          <div className="mt-auto pb-3 text-[10px] text-neutral-400">Tools</div>
        </aside>

        {/* CENTER CANVAS */}
        <section className="relative">
          <ReactFlow
            nodeTypes={nodeTypes}
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onSelectionChange={onSelectionChange}
            onNodeClick={onNodeClick}
            onConnect={onConnect}
            panOnScroll
            fitView
          >
            <Controls />
            <Background gap={14} size={1} />
          </ReactFlow>
        </section>

        {/* RIGHT PANEL */}
        <aside className="row-span-2 p-3 bg-white border-l flex flex-col space-y-4 overflow-y-auto">

          {/* PDF VIEWER */}
          <div>
            <div className="font-semibold text-sm mb-1">Document Viewer</div>
            <div className="h-[280px] border rounded-md bg-neutral-50 overflow-hidden">
              {!pdfURL ? (
                <div className="p-4 text-xs text-neutral-500">
                  Select a PDF node to preview its document.
                </div>
              ) : (
                <iframe src={pdfURL} className="w-full h-full" />
              )}
            </div>
          </div>

          {/* CHAT PANEL */}
          <ChatPanel
            activeNodeId={activeNodeId}
            selectedIds={selectedIds}
            allNodesData={allNodesData}
            nodes={nodes}
            messages={messages}
            onSend={async (txt) => {
              // Determine scope based on selection
              let scopeNodeId = "topic-1";
              let scopeType: "topic" | "report" | "idea" | "query" | "evidence" | "image" = "topic";
              let scopeImageUrl: string | undefined;

              if (selectedIds.length > 0) {
                scopeNodeId = selectedIds[0];
                // Determine type from node ID prefix
                if (scopeNodeId.startsWith("idea-")) scopeType = "idea";
                else if (scopeNodeId.startsWith("query-")) scopeType = "query";
                else if (scopeNodeId.startsWith("summary-")) scopeType = "report";
                else if (scopeNodeId.startsWith("pdf-")) scopeType = "evidence";
                else if (scopeNodeId.startsWith("document-")) scopeType = "evidence";
                else if (scopeNodeId.startsWith("image-")) {
                  scopeType = "image";
                  const selectedNode = nodes.find((n) => n.id === scopeNodeId);
                  const nodeUrl =
                    selectedNode && typeof (selectedNode.data as any)?.url === "string"
                      ? (selectedNode.data as any).url
                      : undefined;
                  scopeImageUrl = nodeUrl;
                }
              }

              await onAskFromCanvas({
                question: txt,
                scopeNodeId,
                scopeType,
                scopeImageUrl,
              });
            }}
          />
        </aside>

      </div>
    </ReactFlowProvider>
  );
}

/* -------------------------------------------------------------------------- */
/*                               TOOL BUTTON                                  */
/* -------------------------------------------------------------------------- */
function ToolButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className="w-10 h-10 rounded-xl border hover:bg-neutral-100 flex items-center justify-center"
    >
      {children}
    </button>
  );
}

/* -------------------------------------------------------------------------- */
/*                            BOTTOM CHAT BOX                                 */
/* -------------------------------------------------------------------------- */

function MinimalChatBox({ onAsk }: { onAsk: (text: string) => void }) {
  const [txt, setTxt] = useState("");

  return (
    <>
      <input
        className="flex-1 border rounded-xl px-3 py-2 text-sm"
        placeholder="Ask a question..."
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && txt.trim()) {
            onAsk(txt);
            setTxt("");
          }
        }}
      />
      <button
        onClick={() => {
          if (!txt.trim()) return;
          onAsk(txt);
          setTxt("");
        }}
        className="px-4 py-2 bg-indigo-600 text-white rounded-xl"
      >
        Send
      </button>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*                               CHAT PANEL                                   */
/* -------------------------------------------------------------------------- */

function ChatPanel({
  activeNodeId,
  selectedIds,
  allNodesData,
  nodes,
  messages,
  onSend,
}: {
  activeNodeId: string | null;
  selectedIds: string[];
  allNodesData: Map<string, any>;
  nodes: Node[];
  messages: SpaceMessage[];
  onSend: (txt: string) => void;
}) {
  const [txt, setTxt] = useState("");

  // Build context information about selected nodes
  const getContextInfo = (): string => {
    if (selectedIds.length === 0) {
      // No selection - provide overview of all nodes
      return "Discussing all research content";
    }

    const selectedNodesInfo = selectedIds.map(id => {
      const node = nodes.find(n => n.id === id);
      if (!node) return null;

      let info = `${node.type}: `;
      const data = node.data;

      if (data.title) info += data.title;
      else if (data.query) info += data.query;
      else if (data.text) info += data.text.substring(0, 50) + "...";

      return info;
    }).filter(Boolean);

    return selectedNodesInfo.join(", ");
  };

  const filtered = messages.filter((m) => {
    // If nothing selected → show everything
    if (selectedIds.length === 0) return true;

    if (m.scope?.nodeId && selectedIds.includes(m.scope.nodeId)) return true;

    if (!m.scope?.nodeId) return true;

    return false;
  });

  const contextInfo = getContextInfo();

  return (
    <div className="flex flex-col border rounded-xl p-3 bg-white h-[480px]">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">Chat</div>

        <div className="text-xs border rounded-xl px-2 py-1 bg-neutral-50 text-neutral-600">
          {selectedIds.length === 0
            ? "All nodes"
            : `${selectedIds.length} selected`}
        </div>
      </div>

      {/* Context indicator */}
      {selectedIds.length > 0 && (
        <div className="mb-2 text-[10px] text-neutral-500 bg-indigo-50 rounded-lg px-2 py-1">
          Context: {contextInfo}
        </div>
      )}

      {/* MESSAGE LIST */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1">
        {filtered.map((m) => (
          <div
            key={m.id}
            className={`p-2 rounded-lg text-sm ${
              m.role === "assistant"
                ? "bg-indigo-50 text-indigo-900"
                : "bg-neutral-100 text-neutral-900"
            }`}
          >
            {m.text}
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="text-xs text-neutral-500 mt-4">
            No messages for this selection.
          </div>
        )}
      </div>

      {/* INPUT BAR */}
      <div className="flex gap-2 mt-2">
        <input
          className="flex-1 border rounded-xl px-3 py-2 text-sm"
          placeholder="Ask about this node..."
          value={txt}
          onChange={(e) => setTxt(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && txt.trim()) {
              onSend(txt);
              setTxt("");
            }
          }}
        />
        <button
          onClick={() => {
            if (!txt.trim()) return;
            onSend(txt);
            setTxt("");
          }}
          className="px-4 py-2 bg-indigo-600 text-white rounded-xl"
        >
          Send
        </button>
      </div>
    </div>
  );
}
