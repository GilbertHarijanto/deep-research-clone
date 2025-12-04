"use client";

import { useEffect, useState, useCallback } from "react";
import ResearchCanvas from "@/components/iris/research-canvas";
import { SpaceSnapshot, SpaceMessage } from "@/lib/spaceTypes";

export default function SpaceView({ id }: { id: string }) {
  const [space, setSpace] = useState<SpaceSnapshot | null>(null);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/spaces/${id}`);
      const data = await res.json();
      setSpace(data as SpaceSnapshot);
    })();
  }, [id]);


  const appendMessage = useCallback((msg: SpaceMessage) => {
    setSpace((s) =>
      s ? { ...s, messages: [...s.messages, msg] } : s
    );
  }, []);


  type AskArgs = {
    scopeNodeId: string;
    scopeType: "query" | "topic" | "report" | "idea" | "evidence";
    question: string;
  };

  const handleAskFromCanvas = useCallback(
    async ({ scopeNodeId, scopeType, question }: AskArgs) => {
      const res = await fetch(`/api/spaces/${id}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: question,
          scope: { nodeId: scopeNodeId, nodeType: scopeType },
        }),
      });

      if (!res.ok) {
        console.error("Message POST failed:", await res.text());
        return;
      }

      const userMsg: SpaceMessage = await res.json();
      appendMessage(userMsg);

      const r2 = await fetch(`/api/spaces/${id}/chat`, {
        method: "POST",
      });

      if (!r2.ok) {
        console.error("Chat POST failed:", await r2.text());
        return;
      }

      const aiMsg: SpaceMessage = await r2.json();
      appendMessage(aiMsg);

      return {
        type: "query" as const,
        query: `Follow-up: ${question}`,
        priority: 3,
      };
    },
    [id, appendMessage]
  );

  if (!space) return <div className="p-6 text-sm">Loading…</div>;

  return (
    <div className="p-6">
      <ResearchCanvas
        topic={space.topic}
        ideation={space.ideation}
        queries={space.queries}
        findings={space.findings}
        reportMarkdown={space.reportMarkdown}
        messages={space.messages}
        onAskFromCanvas={handleAskFromCanvas}
      />
    </div>
  );
}
