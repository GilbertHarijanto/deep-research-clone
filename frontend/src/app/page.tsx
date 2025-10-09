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
import { ArrowLeft } from "lucide-react";

const steps = [
  { id: "1", label: "Discover Ideas", color: "#FACC15" },
  { id: "2", label: "Market Research", color: "#60A5FA" },
  { id: "3", label: "Competitor Research", color: "#FCA5A5" },
  { id: "4", label: "Audience Research", color: "#E879F9" },
  { id: "5", label: "Define Product", color: "#38BDF8" },
  { id: "6", label: "Validate Product", color: "#FCD34D" },
  { id: "7", label: "Build Product", color: "#A78BFA" },
  { id: "8", label: "Market Product", color: "#34D399" },
];

const edges: Edge[] = [
  { id: "e1-2", source: "1", target: "2" },
  { id: "e2-3", source: "2", target: "3" },
  { id: "e3-4", source: "3", target: "4" },
  { id: "e4-5", source: "4", target: "5" },
  { id: "e5-6", source: "5", target: "6" },
  { id: "e6-7", source: "6", target: "7" },
  { id: "e7-8", source: "7", target: "8" },
];

const initialNodes: Node[] = steps.map((s, i) => ({
  id: s.id,
  data: { label: s.label },
  position: { x: (i % 4) * 220, y: Math.floor(i / 4) * 180 },
  draggable: true,
  style: {
    background: s.color,
    color: "black",
    padding: 14,
    borderRadius: 12,
    fontWeight: "bold",
    textAlign: "center",
    minWidth: 160,
  },
}));

export default function Home() {
  const [nodes, setNodes] = useState<Node[]>(initialNodes);
  const [mode, setMode] = useState<"list" | "chat">("list");
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [conversations, setConversations] = useState<
    Record<string, { role: string; content: string }[]>
  >({});
  const [input, setInput] = useState("");

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => setNodes((nds) => applyNodeChanges(changes, nds)),
    []
  );

  const sendMessage = async () => {
    if (!selectedStep || !input.trim()) return;
    const userMessage = { role: "user", content: input };
    const newHistory = [...(conversations[selectedStep] || []), userMessage];

    setConversations((prev) => ({ ...prev, [selectedStep]: newHistory }));
    setInput("");

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [
            { role: "user", content: input }, // send actual input
          ],
        }),
      });

      const data = await res.json();
      console.log("API response:", data);

      const aiMessage = {
        role: "assistant",
        content: data?.choices?.[0]?.message?.content || "No response received.",
      };

      setConversations((prev) => ({
        ...prev,
        [selectedStep]: [...newHistory, aiMessage],
      }));
    } catch (err) {
      console.error("Chat error:", err);
    }
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar panel - now resizable */}
      <div
        className="bg-slate-950 text-gray-100 flex flex-col resize-x overflow-hidden min-w-[200px] max-w-[500px]"
        style={{ width: "20%" }}
      >
        {mode === "list" && (
          <div className="p-6 overflow-y-auto">
            <h2 className="text-2xl font-bold mb-6 tracking-wide">
              Ideation Steps
            </h2>
            <ul className="space-y-3">
              {steps.map((s, i) => (
                <li
                  key={s.id}
                  className={`p-3 rounded-lg text-lg font-medium cursor-pointer transition-all duration-200 
                      hover:bg-gray-800 hover:translate-x-1 hover:shadow-md
                      ${selectedStep === s.id ? "bg-gray-700" : ""}`}
                  onClick={() => {
                    setSelectedStep(s.id);
                    setMode("chat");
                  }}
                >
                  {i + 1}. {s.label}
                </li>
              ))}
            </ul>
          </div>
        )}

        {mode === "chat" && selectedStep && (
          <div className="flex flex-col h-full">
            {/* Chat header and back button */}
            <div className="flex items-center p-4 bg-gray-800 border-b border-gray-700">
              <button
                onClick={() => setMode("list")}
                className="mr-3 p-2 rounded hover:bg-gray-700"
              >
                <ArrowLeft className="w-5 h-5 text-white" />
              </button>
              <span className="font-semibold text-lg">
                {steps.find((s) => s.id === selectedStep)?.label}
              </span>
            </div>

            {/* Chat messages */}
            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {(conversations[selectedStep] || []).map((msg, idx) => (
                <div
                  key={idx}
                  className={`px-4 py-2 max-w-[80%] rounded-xl shadow
                    ${
                      msg.role === "user"
                        ? "bg-blue-600 text-white ml-auto rounded-br-none"
                        : "bg-gray-200 text-gray-900 mr-auto rounded-bl-none"
                    }`}
                >
                  {msg.content}
                </div>
              ))}
            </div>

            {/* Chat input */}
            <div className="p-3 border-t border-gray-700 flex space-x-2 bg-gray-800">
              <textarea
                className="flex-1 border-none rounded-lg px-3 py-2 text-gray-100 focus:outline-none bg-gray-900 resize-none"
                rows={1}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Type your message..."
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
              />
              <button
                onClick={sendMessage}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
              >
                Send
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          fitView
          snapToGrid
          snapGrid={[20, 20]}
          nodesDraggable
          nodesConnectable
        >
          <Background gap={20} color="#444" />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
