"use client";

import React, { useMemo, useState, useCallback } from "react";
import ReactFlow, {
  MiniMap,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  addEdge,
  Panel,
  Node,
  Edge,
  MarkerType,
} from "reactflow";
import "reactflow/dist/style.css";
import dynamic from "next/dynamic";
import { Lightbulb, Search, Zap, Book, Link as LinkIcon } from "lucide-react";

// ---- Node UIs ----
const TopicNode = ({ data }: any) => (
  <div className="px-6 py-4 rounded-xl shadow-lg bg-gradient-to-br from-[#7C3AED] to-[#4F46E5] border border-white/10 min-w-[220px]">
    <div className="flex items-center gap-2 text-white font-semibold text-base">
      <Lightbulb className="w-5 h-5" />
      <span>Topic</span>
    </div>
    <div className="mt-2 text-white/90 text-sm">{data.label}</div>
  </div>
);

const IdeaNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-xl shadow-md bg-white border-2 border-fuchsia-300 min-w-[200px]">
    <div className="text-fuchsia-700 font-semibold text-sm">Ideation Topic</div>
    <div className="mt-1 text-gray-800 text-xs">{data.label}</div>
  </div>
);

const QueryNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-xl shadow-md bg-white border-2 border-emerald-300 min-w-[220px]">
    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
      <Search className="w-4 h-4" />
      <span>Query</span>
    </div>
    <div className="mt-1 text-gray-800 text-xs">{data.label}</div>
    {data.priority && (
      <div className="mt-1 text-[10px] text-gray-500">Priority: {data.priority}</div>
    )}
  </div>
);

const EvidenceNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-xl shadow-md bg-white border-2 border-orange-300 min-w-[240px] max-w-[280px]">
    <div className="flex items-center gap-2 text-orange-700 font-semibold text-sm">
      <Zap className="w-4 h-4" />
      <span>Finding</span>
    </div>
    <div className="mt-1 text-gray-800 text-xs line-clamp-3">{data.label}</div>
  </div>
);

const ReportNode = ({ data }: any) => (
  <div className="px-5 py-4 rounded-xl shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 border border-white/10 min-w-[260px]">
    <div className="flex items-center gap-2 text-white font-semibold">
      <Book className="w-5 h-5" />
      <span>Research Report</span>
    </div>
    <div className="mt-2 text-white/90 text-xs">{data.label}</div>
    {data.sections && (
      <div className="mt-1 text-[11px] text-white/80">{data.sections} sections</div>
    )}
  </div>
);

const nodeTypes = {
  topic: TopicNode,
  idea: IdeaNode,
  query: QueryNode,
  evidence: EvidenceNode,
  report: ReportNode,
};

// ---- Props ----
export interface QA {
  question: string;
  answer: string;
  weight?: number;
}

export interface ResearchCanvasProps {
  topic: string;
  // ideation topics derived from clarifying answers, or computed upstream
  ideation: Array<{ id: string; title: string }>;
  queries: Array<{ id: string; query: string; priority: number }>;
  findings?: Array<{ id: string; text: string; refs?: Array<{ title: string; url: string }> }>;
  reportMarkdown?: string; // final report markdown (optional)
  onAskFromCanvas?: (payload: {
    scopeNodeId: string;
    scopeType: "topic" | "idea" | "query" | "evidence" | "report";
    question: string;
  }) => Promise<
    | { type: "idea"; title: string }
    | { type: "query"; query: string; priority?: number }
    | { type: "evidence"; text: string; refs?: Array<{ title: string; url: string }> }
  >;
}

// ---- Drawer (simple) ----
function Drawer({
  open,
  onClose,
  title,
  body,
  refs,
  onAsk,
  loading,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  body: React.ReactNode;
  refs?: Array<{ title: string; url: string }>;
  onAsk?: (q: string) => void;
  loading?: boolean;
}) {
  const [q, setQ] = useState("");
  return (
    <div
      className={`fixed top-0 right-0 h-full w-[380px] bg-white shadow-2xl border-l border-gray-200 transition-transform ${
        open ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <div className="font-semibold">{title}</div>
        <button className="text-gray-500 hover:text-gray-700" onClick={onClose}>
          ✕
        </button>
      </div>
      <div className="p-4 space-y-4 overflow-y-auto h-[calc(100%-56px)]">
        <div className="text-sm text-gray-800">{body}</div>

        {refs && refs.length > 0 && (
          <div>
            <div className="text-xs uppercase text-gray-500 font-semibold mb-1">References</div>
            <ul className="space-y-1">
              {refs.map((r, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <LinkIcon className="w-3 h-3 mt-0.5 text-gray-500" />
                  <a className="text-blue-600 hover:underline break-all" href={r.url} target="_blank" rel="noreferrer">
                    {r.title}
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}

        {onAsk && (
          <div className="pt-2">
            <label className="text-xs font-semibold text-gray-600">Ask about this</label>
            <div className="flex gap-2 mt-1">
              <input
                className="flex-1 border rounded-md px-2 py-1 text-sm"
                placeholder="Ask a follow-up..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                onClick={() => q.trim() && onAsk(q.trim())}
                className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
                disabled={!q.trim() || loading}
              >
                {loading ? "Thinking..." : "Ask"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---- Main Canvas ----
export default function ResearchCanvas({
  topic,
  ideation,
  queries,
  findings = [],
  reportMarkdown,
  onAskFromCanvas,
}: ResearchCanvasProps) {
  // Seed graph
  const seeded = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // helper layout grid
    const X = (col: number) => 140 + col * 260;
    const Y = (row: number) => 40 + row * 160;

    nodes.push({
      id: "topic",
      type: "topic",
      position: { x: X(2), y: Y(0) },
      data: { label: topic || "Untitled Topic" },
    });

    ideation.forEach((it, i) => {
      const id = `idea-${it.id}`;
      nodes.push({
        id,
        type: "idea",
        position: { x: X(i % 5), y: Y(1 + Math.floor(i / 5)) },
        data: { label: it.title },
      });
      edges.push({
        id: `e-topic-${id}`,
        source: "topic",
        target: id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#A78BFA" },
        animated: true,
      });
    });

    queries.forEach((q, i) => {
      const id = `qry-${q.id}`;
      nodes.push({
        id,
        type: "query",
        position: { x: X(i % 5), y: Y(3 + Math.floor(i / 5)) },
        data: { label: q.query, priority: q.priority },
      });
      // Connect each query to nearest ideation node (or topic if none)
      const parent =
        ideation.length > 0 ? `idea-${ideation[i % ideation.length].id}` : "topic";
      edges.push({
        id: `e-${parent}-${id}`,
        source: parent,
        target: id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#34D399" },
      });
    });

    findings.forEach((f, i) => {
      const id = `ev-${f.id}`;
      nodes.push({
        id,
        type: "evidence",
        position: { x: X(i % 5), y: Y(5 + Math.floor(i / 5)) },
        data: { label: f.text, refs: f.refs },
      });
      if (queries.length > 0) {
        const qid = `qry-${queries[i % queries.length].id}`;
        edges.push({
          id: `e-${qid}-${id}`,
          source: qid,
          target: id,
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#FB923C" },
        });
      }
    });

    if (reportMarkdown) {
      nodes.push({
        id: "report",
        type: "report",
        position: { x: X(2), y: Y(7) },
        data: { label: "Final synthesized report", sections: Math.max(4, Math.ceil((findings?.length || 4) / 2)) },
      });
      findings.forEach((f) => {
        edges.push({
          id: `e-ev-${f.id}-report`,
          source: `ev-${f.id}`,
          target: "report",
          markerEnd: { type: MarkerType.ArrowClosed },
          style: { stroke: "#10B981" },
        });
      });
    }

    return { nodes, edges };
  }, [topic, ideation, queries, findings, reportMarkdown]);

  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);

  // Drawer state
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTitle, setDrawerTitle] = useState("");
  const [drawerBody, setDrawerBody] = useState<React.ReactNode>(null);
  const [drawerRefs, setDrawerRefs] = useState<Array<{ title: string; url: string }> | undefined>(undefined);
  const [asking, setAsking] = useState(false);
  const [askCtx, setAskCtx] = useState<{ id: string; type: ResearchCanvasProps["ideation"][number] | any } | null>(null);

  // Click handler -> open drawer with content + ask box
  const onNodeClick = useCallback((_e: any, node: Node) => {
    setDrawerOpen(true);
    setAskCtx({ id: node.id, type: node.type });

    if (node.type === "topic") {
      setDrawerTitle("Topic");
      setDrawerBody(<div className="text-sm">{(node.data as any)?.label}</div>);
      setDrawerRefs(undefined);
      return;
    }
    if (node.type === "idea") {
      setDrawerTitle("Ideation Topic");
      setDrawerBody(<div className="text-sm">{(node.data as any)?.label}</div>);
      setDrawerRefs(undefined);
      return;
    }
    if (node.type === "query") {
      setDrawerTitle("Query");
      const d = node.data as any;
      setDrawerBody(
        <div className="space-y-2">
          <div className="text-sm">{d.label}</div>
          {d.priority && <div className="text-xs text-gray-500">Priority: {d.priority}</div>}
        </div>
      );
      setDrawerRefs(undefined);
      return;
    }
    if (node.type === "evidence") {
      setDrawerTitle("Finding");
      const d = node.data as any;
      setDrawerBody(<div className="text-sm whitespace-pre-wrap">{d.label}</div>);
      setDrawerRefs(d.refs);
      return;
    }
    if (node.type === "report") {
      setDrawerTitle("Research Report (Markdown)");
      setDrawerBody(
        <pre className="text-xs bg-gray-50 p-3 rounded-md whitespace-pre-wrap border">{(node.data as any)?.markdown || "Loaded from props"}</pre>
      );
      setDrawerRefs(undefined);
      return;
    }
  }, []);

  const onConnect = useCallback(
    (params: any) => setEdges((eds) => addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)),
    [setEdges]
  );

  // Ask from drawer -> add new node + edge
  const handleAsk = useCallback(
    async (question: string) => {
      if (!onAskFromCanvas || !askCtx) return;
      try {
        setAsking(true);
        const res = await onAskFromCanvas({
          scopeNodeId: askCtx.id,
          // map ReactFlow type -> our scope type
          scopeType:
            askCtx.type === "topic" || askCtx.type === "report" || askCtx.type === "idea" || askCtx.type === "query" || askCtx.type === "evidence"
              ? askCtx.type
              : "topic",
          question,
        });

        // Create the new node near the clicked node
        const base = nodes.find((n) => n.id === askCtx.id);
        const nx = (base?.position?.x ?? 100) + 240;
        const ny = (base?.position?.y ?? 100) + 40;

        if (res.type === "idea") {
          const id = `idea-${Date.now()}`;
          const newNode: Node = { id, type: "idea", position: { x: nx, y: ny }, data: { label: res.title } };
          setNodes((prev) => [...prev, newNode]);
          setEdges((prev) => [
            ...prev,
            {
              id: `e-${askCtx.id}-${id}`,
              source: askCtx.id,
              target: id,
              markerEnd: { type: MarkerType.ArrowClosed },
              style: { stroke: "#A78BFA" },
              animated: true,
            },
          ]);
        } else if (res.type === "query") {
          const id = `qry-${Date.now()}`;
          const newNode: Node = {
            id,
            type: "query",
            position: { x: nx, y: ny },
            data: { label: res.query, priority: res.priority ?? 3 },
          };
          setNodes((prev) => [...prev, newNode]);
          setEdges((prev) => [
            ...prev,
            { id: `e-${askCtx.id}-${id}`, source: askCtx.id, target: id, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#34D399" } },
          ]);
        } else if (res.type === "evidence") {
          const id = `ev-${Date.now()}`;
          const newNode: Node = {
            id,
            type: "evidence",
            position: { x: nx, y: ny },
            data: { label: res.text, refs: res.refs },
          };
          setNodes((prev) => [...prev, newNode]);
          setEdges((prev) => [
            ...prev,
            { id: `e-${askCtx.id}-${id}`, source: askCtx.id, target: id, markerEnd: { type: MarkerType.ArrowClosed }, style: { stroke: "#FB923C" } },
          ]);
        }
      } finally {
        setAsking(false);
      }
    },
    [askCtx, nodes, onAskFromCanvas, setNodes, setEdges]
  );

  return (
    <div className="w-full h-[80vh] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        nodeTypes={nodeTypes}
        fitView
        className="bg-gray-50"
      >
        <Controls className="bg-white/90 backdrop-blur border border-gray-200 rounded-lg" />
        <MiniMap
          className="bg-white/90 backdrop-blur border border-gray-200 rounded-lg"
          nodeColor={(n) =>
            n.type === "topic"
              ? "#7C3AED"
              : n.type === "idea"
              ? "#F0ABFC"
              : n.type === "query"
              ? "#6EE7B7"
              : n.type === "evidence"
              ? "#FDBA74"
              : "#34D399"
          }
        />
        <Background color="#e5e7eb" gap={16} />

        <Panel position="top-left" className="bg-white rounded-xl shadow-lg p-3 m-3">
          <div className="text-sm font-bold text-gray-800">Research Canvas</div>
          <div className="text-xs text-gray-600">Interactive whiteboard for ideation → queries → findings → report</div>
        </Panel>
      </ReactFlow>

      <Drawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={drawerTitle}
        body={drawerBody}
        refs={drawerRefs}
        onAsk={onAskFromCanvas ? handleAsk : undefined}
        loading={asking}
      />
    </div>
  );
}