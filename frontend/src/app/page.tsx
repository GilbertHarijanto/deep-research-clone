"use client";

import React, { useState, useCallback } from "react";
import ReactFlow, {
  Background,
  Controls,
  Node,
  Edge,
  OnNodesChange,
  applyNodeChanges,
} from "reactflow";
import "reactflow/dist/style.css";
import { ArrowLeft, Play } from "lucide-react";

interface SectionData {
  title: string;
  summary: string[];
  full_text: string;
}

export default function ResearchPage() {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const onNodesChange: OnNodesChange = useCallback(
  (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
  []
);

  const [selectedSection, setSelectedSection] = useState<SectionData | null>(
    null
  );
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [summary, setSummary] = useState<string>("");

  // 🔹 Fetch research summary from FastAPI backend
  const fetchResearchData = async (topic: string) => {
    const res = await fetch("http://localhost:8000/research/summarize", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic }),
    });
    if (!res.ok) throw new Error("Failed to fetch research data");
    return await res.json();
  };

  // 🔹 Generate nodes dynamically from backend output
  const handleGenerateMap = async () => {
    if (!topic.trim()) return;
    setLoading(true);
    try {
      const data = await fetchResearchData(topic);

      setSummary(data.report_markdown || "");

      const sections: SectionData[] = data.sections || [];

      // Root node (main research goal)
      const rootNode: Node = {
        id: "root",
        data: { label: "Research Goal" },
        position: { x: 400, y: 50 },
        style: {
          background: "#60A5FA",
          color: "white",
          padding: 14,
          borderRadius: 12,
          fontWeight: "bold",
          textAlign: "center",
          minWidth: 180,
        },
      };

      // Child nodes (sections)
      const generatedNodes: Node[] = sections.map((s, i) => ({
        id: `n${i}`,
        data: {
          label: s.title,
          summary: s.summary,
          full_text: s.full_text,
        },
        position: { x: (i % 3) * 320 + 100, y: Math.floor(i / 3) * 220 + 200 },
        style: {
          background: "#E2E8F0",
          color: "#1E293B",
          padding: 12,
          borderRadius: 12,
          fontWeight: "600",
          cursor: "pointer",
          minWidth: 200,
        },
      }));

      // Edges connecting sections to root
      const generatedEdges: Edge[] = generatedNodes.map((n) => ({
        id: `e-root-${n.id}`,
        source: "root",
        target: n.id,
        type: "smoothstep",
      }));

      setNodes([rootNode, ...generatedNodes]);
      setEdges(generatedEdges);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // 🔹 Node click handler
  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.id !== "root") {
      setSelectedSection(node.data);
    } else {
      setSelectedSection(null);
    }
  }, []);

  return (
    <div className="flex h-screen">
      {/* Sidebar panel */}
      <div className="bg-slate-950 text-gray-100 flex flex-col w-1/3 min-w-[280px] p-6 overflow-y-auto">
        {!selectedSection ? (
          <>
            <h2 className="text-2xl font-bold mb-4">Research Summarizer</h2>
            <p className="text-sm text-gray-400 mb-4">
              Enter a topic to generate a structured research map.
            </p>
            <div className="flex mb-4 space-x-2">
              <input
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="flex-1 px-3 py-2 rounded bg-gray-900 border border-gray-700 text-gray-100 focus:outline-none"
                placeholder="Enter topic..."
              />
              <button
                onClick={handleGenerateMap}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center space-x-1"
              >
                <Play className="w-4 h-4" />
                <span>{loading ? "Loading..." : "Generate"}</span>
              </button>
            </div>

            {summary && (
              <div className="mt-4">
                <h3 className="text-lg font-semibold mb-2">Research Overview</h3>
                <p className="text-sm text-gray-300 whitespace-pre-wrap">
                  {summary.slice(0, 300)}...
                </p>
              </div>
            )}

            <div className="mt-6 text-gray-400 text-sm">
              <p>Click on a node in the graph to see its detailed content.</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center mb-4">
              <button
                onClick={() => setSelectedSection(null)}
                className="mr-3 p-2 rounded hover:bg-gray-800"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <h2 className="text-xl font-semibold">
                {selectedSection.title}
              </h2>
            </div>

            <div className="space-y-2 mb-4">
              {selectedSection.summary?.map((point, idx) => (
                <p key={idx} className="text-gray-300 text-sm">
                  • {point}
                </p>
              ))}
            </div>

            <div className="bg-gray-800 p-3 rounded overflow-y-auto max-h-[60vh]">
              <pre className="whitespace-pre-wrap text-sm">
                {selectedSection.full_text}
              </pre>
            </div>
          </>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-gray-100">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onNodeClick={onNodeClick}
          fitView
          snapToGrid
        >
          <Background gap={20} color="#cbd5e1" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}