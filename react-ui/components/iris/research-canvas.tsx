"use client";

import React, { useCallback, useMemo, useState } from "react";
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
    scopeType: "topic" | "report" | "idea" | "query" | "evidence";
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

  /* --------------------------- Build Graph --------------------------- */

  const { initialNodes, initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    const topicId = "topic-1";

    nodes.push({
      id: topicId,
      type: "topic",
      data: { title: topic },
      position: { x: 400, y: 40 },
    });

    ideation.forEach((i, idx) => {
      const id = `idea-${i.id}`;
      nodes.push({
        id,
        type: "ideation",
        data: { title: i.title },
        position: { x: 150 + idx * 260, y: 180 },
      });
      edges.push({
        id: `e-${topicId}-${id}`,
        source: topicId,
        target: id,
        type: "smoothstep",
      });
    });

    queries.forEach((q, idx) => {
      const id = `query-${q.id}`;
      nodes.push({
        id,
        type: "query",
        data: { query: q.query, priority: q.priority },
        position: { x: 150 + idx * 240, y: 320 },
      });
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
      nodes.push({
        id,
        type: "summary",
        data: { title: sec.heading, text: sec.summary },
        position: { x: 150 + idx * 260, y: 480 },
      });

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
      nodes.push({
        id,
        type: "pdf",
        data: { title: ref.title, url: ref.url },
        position: { x: 200 + i * 220, y: 640 },
      });
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

          <ToolButton label="Add Query" onClick={() => {
            const id = `query-${nanoid()}`;
            setNodes((nds) => [
              ...nds,
              {
                id,
                type: "query",
                data: { query: "New query", priority: 3 },
                position: { x: 480, y: 300 },
              },
            ]);
          }}>
            🔎
          </ToolButton>

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
            messages={messages}
            onSend={async (txt) => {
              await onAskFromCanvas({
                question: txt,
                scopeNodeId: selectedIds[0] ?? "topic-1",
                scopeType: "query",
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
  messages,
  onSend,
}: {
  activeNodeId: string | null;
  selectedIds: string[];
  messages: SpaceMessage[];
  onSend: (txt: string) => void;
}) {
  const [txt, setTxt] = useState("");

  const filtered = messages.filter((m) => {
    // If nothing selected → show everything
    if (selectedIds.length === 0) return true;

    if (m.scope?.nodeId && selectedIds.includes(m.scope.nodeId)) return true;

    if (!m.scope?.nodeId) return true;

    return false;
  });

  return (
    <div className="flex flex-col border rounded-xl p-3 bg-white h-[480px]">
      <div className="flex items-center justify-between mb-2">
        <div className="font-semibold text-sm">Chat</div>

        <div className="text-xs border rounded-xl px-2 py-1 bg-neutral-50 text-neutral-600">
          {selectedIds.length === 0
            ? "All messages"
            : `${selectedIds.length} selected`}
        </div>
      </div>

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
