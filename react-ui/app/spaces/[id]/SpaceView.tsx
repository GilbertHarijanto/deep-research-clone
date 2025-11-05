"use client";

import { useEffect, useState, useCallback } from "react";
import ResearchCanvas from "@/components/iris/research-canvas";
import { SpaceSnapshot } from "@/lib/spaceTypes";

export default function SpaceView({ id }: { id: string }) {
  const [space, setSpace] = useState<SpaceSnapshot | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/spaces/${id}`);
      const data = await res.json();
      setSpace(data as SpaceSnapshot);
    })();
  }, [id]);

  const handleAskFromCanvas = useCallback(
    async ({
      scopeNodeId,
      scopeType,
      question,
    }: {
      scopeNodeId: string;
      scopeType: "topic" | "report" | "idea" | "query" | "evidence";
      question: string;
    }) => {
      // append user's message
      const res = await fetch(`/api/spaces/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: question, scope: { nodeId: scopeNodeId, nodeType: scopeType } }),
      });
      const msg = await res.json();
      setSpace((s) => (s ? { ...s, messages: [...s.messages, msg] } : s));

      // get AI reply
      const r2 = await fetch(`/api/spaces/${id}/chat`, { method: "POST" });
      const aiMsg = await r2.json();
      setSpace((s) => (s ? { ...s, messages: [...s.messages, aiMsg] } : s));

      // tell the canvas what node to add
      return { type: "query" as const, query: `Follow-up: ${question}`, priority: 3 };
    },
    [id]
  );

  if (!space) return null;

  return (
    <div className="min-h-screen p-6">
      <ResearchCanvas
        topic={space.topic}
        ideation={space.ideation}
        queries={space.queries}
        findings={space.findings}
        reportMarkdown={space.reportMarkdown}
        onAskFromCanvas={handleAskFromCanvas}
      />
    </div>
  );
}
