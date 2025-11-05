"use client";

import React, { useMemo, useState, useCallback, useRef } from "react";
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
  NodeProps, 
  OnSelectionChangeParams,
} from "reactflow";
import "reactflow/dist/style.css";
import { Lightbulb, Search, Zap, Book, Plus, Image as ImageIcon, StickyNote } from "lucide-react";

// ---------- Node UIs ----------
const Card = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div className={`rounded-xl shadow-md border bg-white ${className}`}>{children}</div>
);

const TopicNode = ({ data, selected }: NodeProps) => (
  <div className={`px-6 py-4 rounded-xl shadow-lg bg-gradient-to-br from-[#7C3AED] to-[#4F46E5]
    border ${selected ? "ring-4 ring-indigo-300 border-white/20" : "border-white/10"} min-w-[220px]`}>
    <div className="flex items-center gap-2 text-white font-semibold text-base">
      <Lightbulb className="w-5 h-5" />
      <span>Topic</span>
    </div>
    <div className="mt-2 text-white/90 text-sm">{data.label}</div>
  </div>
);

const IdeaNode = ({ data, selected }: NodeProps) => (
  <Card className="px-4 py-3 border-fuchsia-300">
    <div className="text-fuchsia-700 font-semibold text-sm">Ideation Topic</div>
    <div className="mt-1 text-gray-800 text-xs">{data.label}</div>
  </Card>
);

const QueryNode = ({ data, selected }: NodeProps) => (
  <Card className="px-4 py-3 border-emerald-300 min-w-[220px]">
    <div className="flex items-center gap-2 text-emerald-700 font-semibold text-sm">
      <Search className="w-4 h-4" />
      <span>Query</span>
    </div>
    <div className="mt-1 text-gray-800 text-xs">{data.label}</div>
    {data.priority && <div className="mt-1 text-[10px] text-gray-500">Priority: {data.priority}</div>}
  </Card>
);

const EvidenceNode = ({ data, selected }: NodeProps) => (
  <Card className="px-4 py-3 border-orange-300 min-w-[240px] max-w-[320px]">
    <div className="flex items-center gap-2 text-orange-700 font-semibold text-sm">
      <Zap className="w-4 h-4" />
      <span>Finding</span>
    </div>
    <div className="mt-1 text-gray-800 text-xs whitespace-pre-wrap">{data.label}</div>
    {Array.isArray(data.refs) && data.refs.length > 0 && (
      <ul className="mt-2 space-y-1">
        {data.refs.map((r: any, i: number) => (
          <li key={i}>
            <a className="text-[10px] text-blue-600 underline break-all" href={r.url} target="_blank" rel="noreferrer">
              {r.title}
            </a>
          </li>
        ))}
      </ul>
    )}
  </Card>
);

const ReportNode = ({ data, selected }: NodeProps) => (
  <div className="px-5 py-4 rounded-xl shadow-xl bg-gradient-to-br from-emerald-500 to-teal-600 border border-white/10 min-w-[260px] text-white">
    <div className="flex items-center gap-2 font-semibold">
      <Book className="w-5 h-5" />
      <span>Research Report</span>
    </div>
    <div className="mt-2 text-white/90 text-xs">{data.label}</div>
    {data.sections && <div className="mt-1 text-[11px] text-white/80">{data.sections} sections</div>}
  </div>
);

// Simple sticky note node (for quick ideas dropped via +)
const NoteNode = ({ data }: any) => (
  <div className="px-4 py-3 rounded-xl border border-amber-300 bg-amber-50 min-w-[180px] max-w-[260px]">
    <div className="flex items-center gap-2 text-amber-800 font-semibold text-sm">
      <StickyNote className="w-4 h-4" />
      <span>Note</span>
    </div>
    <div className="mt-1 text-gray-800 text-xs whitespace-pre-wrap">{data.label}</div>
  </div>
);

// Simple image node (local previews OK)
const ImageNode = ({ data }: any) => (
  <div className="rounded-xl border border-gray-200 bg-white overflow-hidden shadow-sm max-w-[320px]">
    {data.src ? (
      <img src={data.src} alt={data.label || "Image"} className="w-full h-auto block" />
    ) : (
      <div className="px-4 py-3 text-xs text-gray-500">No image</div>
    )}
    {data.label && <div className="px-3 py-2 text-[11px] text-gray-600 border-t">{data.label}</div>}
  </div>
);

const nodeTypes = {
  topic: TopicNode,
  idea: IdeaNode,
  query: QueryNode,
  evidence: EvidenceNode,
  report: ReportNode,
  note: NoteNode,
  image: ImageNode,
};

// ---------- Props ----------
export interface ResearchCanvasProps {
  topic: string;
  ideation: Array<{ id: string; title: string }>;
  queries: Array<{ id: string; query: string; priority: number }>;
  findings?: Array<{ id: string; text: string; refs?: Array<{ title: string; url: string }> }>;
  reportMarkdown?: string;
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

// ---------- Helpers ----------
const X = (col: number) => 140 + col * 260;
const Y = (row: number) => 40 + row * 160;

function addUniqueEdge(
  list: Edge[],
  keyset: Set<string>,
  def: Omit<Edge, "id"> & { id?: string }
) {
  const key = `${def.source}->${def.target}`;
  if (keyset.has(key)) return;
  keyset.add(key);
  list.push({
    id: def.id ?? `e-${def.source}-${def.target}`,
    ...def,
  });
}

function connectAll(nodes: Node[], existingEdges: Edge[]): Edge[] {
  // Build easy groups
  const byType = (t: string) => nodes.filter((n) => n.type === t);
  const topic = byType("topic")[0];
  const ideas = byType("idea");
  const queries = byType("query");
  const evidences = byType("evidence");
  const report = byType("report")[0];

  const edges: Edge[] = [...existingEdges];
  const keys = new Set(existingEdges.map((e) => `${e.source}->${e.target}`));

  // Connect topic -> ideas
  ideas.forEach((i) =>
    addUniqueEdge(edges, keys, {
      source: topic?.id ?? "topic",
      target: i.id,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#A78BFA" },
      animated: true,
    })
  );

  // Connect each query from nearest idea (by index)
  queries.forEach((q, i) => {
    const parent = ideas.length ? ideas[i % ideas.length].id : topic?.id ?? "topic";
    addUniqueEdge(edges, keys, {
      source: parent,
      target: q.id,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#34D399" },
    });
  });

  // Connect evidences from rotating queries
  evidences.forEach((ev, i) => {
    const parent = queries.length ? queries[i % queries.length].id : ideas[i % ideas.length]?.id ?? topic?.id ?? "topic";
    addUniqueEdge(edges, keys, {
      source: parent,
      target: ev.id,
      markerEnd: { type: MarkerType.ArrowClosed },
      style: { stroke: "#FB923C" },
    });
  });

  // Connect evidences -> report
  if (report) {
    evidences.forEach((ev) =>
      addUniqueEdge(edges, keys, {
        source: ev.id,
        target: report.id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: "#10B981" },
      })
    );
  }

  // Stitch peers horizontally inside each lane for nice flow
  const stitch = (arr: Node[], color: string) => {
    const sorted = [...arr].sort((a, b) => a.position.x - b.position.x);
    for (let i = 0; i < sorted.length - 1; i++) {
      addUniqueEdge(edges, keys, {
        source: sorted[i].id,
        target: sorted[i + 1].id,
        markerEnd: { type: MarkerType.ArrowClosed },
        style: { stroke: color, opacity: 0.4 },
      });
    }
  };
  stitch(ideas, "#A78BFA");
  stitch(queries, "#34D399");
  stitch(evidences, "#FB923C");

  return edges;
}

// ---------- Component ----------
export default function ResearchCanvas({
  topic,
  ideation,
  queries,
  findings = [],
  reportMarkdown,
  onAskFromCanvas,
}: ResearchCanvasProps) {
  // initial seed
  const seeded = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    nodes.push({
      id: "topic",
      type: "topic",
      position: { x: X(2), y: Y(0) },
      data: { label: topic || "Untitled Topic" },
    });

    ideation.forEach((it, i) => {
      nodes.push({
        id: `idea-${it.id}`,
        type: "idea",
        position: { x: X(i % 5), y: Y(1 + Math.floor(i / 5)) },
        data: { label: it.title },
      });
    });

    queries.forEach((q, i) => {
      nodes.push({
        id: `qry-${q.id}`,
        type: "query",
        position: { x: X(i % 5), y: Y(3 + Math.floor(i / 5)) },
        data: { label: q.query, priority: q.priority },
      });
    });

    findings.forEach((f, i) => {
      nodes.push({
        id: `ev-${f.id}`,
        type: "evidence",
        position: { x: X(i % 5), y: Y(5 + Math.floor(i / 5)) },
        data: { label: f.text, refs: f.refs },
      });
    });

    if (reportMarkdown) {
      nodes.push({
        id: "report",
        type: "report",
        position: { x: X(2), y: Y(7) },
        data: {
          label: "Final synthesized report",
          sections: Math.max(4, Math.ceil((findings?.length || 4) / 2)),
        },
      });
    }

    // auto-connect all
    const wired = connectAll(nodes, edges);
    return { nodes, edges: wired };
  }, [topic, ideation, queries, findings, reportMarkdown]);

  const [nodes, setNodes, onNodesChange] = useNodesState(seeded.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(seeded.edges);

  // selection-aware ask
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [askInput, setAskInput] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const onSelectionChange = useCallback((params: OnSelectionChangeParams) => {
    setSelectedIds(params.nodes.map((n) => n.id));
  }, []);

  // clicking a node opens a quick ask for that node
  const onNodeClick = useCallback((_e: any, node: Node) => {
    setSelectedIds([node.id]);
  }, []);

  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) =>
        addEdge({ ...params, markerEnd: { type: MarkerType.ArrowClosed } }, eds)
      ),
    [setEdges]
  );

  // --- Add helpers (via top-left + Panel) ---
  const addNodeNear = (anchorId: string | null, node: Node, edgeColor?: string) => {
    setNodes((prev) => [...prev, node]);

    if (anchorId) {
      setEdges((prev) =>
        [
          ...prev,
          {
            id: `e-${anchorId}-${node.id}`,
            source: anchorId,
            target: node.id,
            markerEnd: { type: MarkerType.ArrowClosed },
            style: { stroke: edgeColor || "#9CA3AF" },
          },
        ]
      );
    }
  };

  const anchorPos = (id: string | null) => {
    if (!id) return { x: X(0), y: Y(1) };
    const base = nodes.find((n) => n.id === id);
    return {
      x: (base?.position.x ?? 100) + 240,
      y: (base?.position.y ?? 100) + 40,
    };
  };

  const addQuickNote = () => {
    const anchor = selectedIds[0] ?? "topic";
    const pos = anchorPos(anchor);
    const id = `note-${Date.now()}`;
    addNodeNear(anchor, {
      id,
      type: "note",
      position: pos,
      data: { label: "New note…" },
    });
  };

  const addQuickQuery = () => {
    const anchor = selectedIds[0] ?? "topic";
    const pos = anchorPos(anchor);
    const id = `qry-${Date.now()}`;
    addNodeNear(
      anchor,
      {
        id,
        type: "query",
        position: pos,
        data: { label: "New query…", priority: 3 },
      },
      "#34D399"
    );
  };

  const addImageFromFile = (file: File) => {
    const url = URL.createObjectURL(file);
    const anchor = selectedIds[0] ?? "topic";
    const pos = anchorPos(anchor);
    const id = `img-${Date.now()}`;
    addNodeNear(anchor, {
      id,
      type: "image",
      position: pos,
      data: { src: url, label: file.name },
    });
  };

  // --- Ask flow: send to onAskFromCanvas and materialize answer as canvas node
  const askAboutSelection = useCallback(async () => {
    if (!onAskFromCanvas || !askInput.trim()) return;

    const anchorId = selectedIds[0] ?? "topic";
    const anchorNode = nodes.find((n) => n.id === anchorId);
    const scopeType = (anchorNode?.type as ResearchCanvasProps["ideation"][number] | any) || "topic";

    const res = await onAskFromCanvas({
      scopeNodeId: anchorId,
      scopeType: (["topic", "report", "idea", "query", "evidence"].includes(scopeType)
        ? (scopeType as any)
        : "topic"),
      question: askInput.trim(),
    });

    const pos = anchorPos(anchorId);

    if (res.type === "idea") {
      const id = `idea-${Date.now()}`;
      addNodeNear(anchorId, { id, type: "idea", position: pos, data: { label: res.title } }, "#A78BFA");
    } else if (res.type === "query") {
      const id = `qry-${Date.now()}`;
      addNodeNear(
        anchorId,
        { id, type: "query", position: pos, data: { label: res.query, priority: res.priority ?? 3 } },
        "#34D399"
      );
    } else if (res.type === "evidence") {
      const id = `ev-${Date.now()}`;
      addNodeNear(
        anchorId,
        { id, type: "evidence", position: pos, data: { label: res.text, refs: res.refs } },
        "#FB923C"
      );
    } else {
      // Fallback: treat as evidence text if some unexpected shape is returned
      const id = `ev-${Date.now()}`;
      addNodeNear(
        anchorId,
        { id, type: "evidence", position: pos, data: { label: String((res as any)?.text || "Result") } },
        "#FB923C"
      );
    }

    setAskInput("");
  }, [onAskFromCanvas, askInput, nodes, selectedIds]);

  return (
    <div className="w-full h-[80vh] bg-gray-50 rounded-2xl overflow-hidden border border-gray-200">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={(chs) => {
          onNodesChange(chs);
        }}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeClick={onNodeClick}
        onSelectionChange={onSelectionChange}
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
              : n.type === "note"
              ? "#FDE68A"
              : "#9CA3AF"
          }
        />
        <Background color="#e5e7eb" gap={16} />

        {/* Header panel */}
        <Panel position="top-left" className="bg-white rounded-xl shadow-lg p-3 m-3 max-w-[520px]">
          <div className="text-sm font-bold text-gray-800">Research Canvas</div>
          <div className="text-xs text-gray-600 mb-2">
            Select any node and ask a follow-up — answers will appear on the canvas as findings.
          </div>
          <div className="flex gap-2">
            <input
              value={askInput}
              onChange={(e) => setAskInput(e.target.value)}
              placeholder={
                selectedIds.length
                  ? `Ask about "${nodes.find((n) => n.id === selectedIds[0])?.type}"`
                  : "Select a node, then ask…"
              }
              className="flex-1 border rounded-md px-2 py-1 text-sm"
            />
            <button
              onClick={askAboutSelection}
              disabled={!askInput.trim()}
              className="px-3 py-1.5 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
            >
              Ask
            </button>
          </div>
        </Panel>

        {/* In-flow add (+) panel */}
        <Panel position="top-right" className="bg-white rounded-xl shadow-lg p-3 m-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-gray-800">
            <Plus className="w-4 h-4" /> Add to board
          </div>
          <div className="mt-2 grid grid-cols-3 gap-2">
            <button
              className="flex items-center justify-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-gray-50"
              onClick={addQuickNote}
              title="Add sticky note near selection"
            >
              <StickyNote className="w-3 h-3" /> Note
            </button>
            <button
              className="flex items-center justify-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-gray-50"
              onClick={addQuickQuery}
              title="Add query near selection"
            >
              <Search className="w-3 h-3" /> Query
            </button>
            <button
              className="flex items-center justify-center gap-1 text-xs border rounded-md px-2 py-1 hover:bg-gray-50"
              onClick={() => fileInputRef.current?.click()}
              title="Upload image near selection"
            >
              <ImageIcon className="w-3 h-3" /> Image
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) addImageFromFile(f);
              if (fileInputRef.current) fileInputRef.current.value = "";
            }}
          />
        </Panel>
      </ReactFlow>
    </div>
  );
}
