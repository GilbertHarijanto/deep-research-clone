"use client";

import React, { useEffect, useState } from "react";
import { NodeProps, Handle, Position } from "reactflow";
import { useReactFlow } from "reactflow";

/* -------------------------------------------------------------------------- */
/*                                  TOPIC NODE                                */
/* -------------------------------------------------------------------------- */

function TopicNode({ data, selected }: NodeProps<{ title: string }>) {
  return (
    <div
      className={[
        "rounded-2xl text-white bg-indigo-600 shadow-md w-fit max-w-[200px] whitespace-pre-wrap break-words overflow-hidden",
        selected ? "ring-2 ring-indigo-300" : "",
      ].join(" ")}
    >
      <div
        className="px-4 py-2 text-sm font-medium cursor-grab"
        data-drag-handle
      >
        💡 Topic
      </div>
      <div className="px-4 pb-3 text-base font-semibold">{data.title}</div>

      {/* Flowchart Handles */}
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-indigo-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               IDEATION NODE                                */
/* -------------------------------------------------------------------------- */

function IdeationNode({
  data,
  selected,
}: NodeProps<{ title: string }>) {
  return (
    <div
      className={[
        "rounded-2xl border bg-white shadow-sm w-fit max-w-[200px] whitespace-pre-wrap break-words overflow-hidden",
        selected
          ? "ring-2 ring-fuchsia-300 border-fuchsia-300"
          : "border-fuchsia-200",
      ].join(" ")}
    >
      <div
        className="px-4 py-2 text-xs font-semibold text-fuchsia-600 cursor-grab"
        data-drag-handle
      >
        Ideation Topic
      </div>
      <div className="px-4 pb-3 text-sm text-neutral-800">{data.title}</div>

      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-fuchsia-400"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-fuchsia-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                QUERY NODE                                  */
/* -------------------------------------------------------------------------- */
function QueryNode({
  data,
  selected,
}: NodeProps<{ query: string; priority: number }>) {
  return (
    <div
      className={[
        "rounded-2xl border bg-white shadow-sm w-fit max-w-[200px] whitespace-pre-wrap break-words overflow-hidden",
        selected
          ? "ring-2 ring-emerald-300 border-emerald-300"
          : "border-emerald-200",
      ].join(" ")}
    >
      <div
        className="px-4 py-2 text-xs font-semibold text-emerald-700 cursor-grab"
        data-drag-handle
      >
        🔎 Query
        <span className="ml-2 text-[10px] text-emerald-600/70">
          Priority: {data.priority}
        </span>
      </div>

      <div className="px-4 pb-3 text-sm text-neutral-800">{data.query}</div>

      <Handle
        type="target"
        position={Position.Top}
        className="w-2 h-2 bg-emerald-400"
      />
      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2 h-2 bg-emerald-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                  NOTE NODE                                 */
/* -------------------------------------------------------------------------- */

function NoteNode({ data, selected }: NodeProps<{ text: string }>) {
  const [val, setVal] = useState(data.text ?? "");
  useEffect(() => setVal(data.text ?? ""), [data.text]);

  return (
    <div
      className={[
        "rounded-xl border bg-amber-50 shadow-sm w-fit max-w-[200px] whitespace-pre-wrap break-words overflow-hidden",
        selected
          ? "ring-2 ring-indigo-400 border-indigo-300"
          : "border-amber-200",
      ].join(" ")}
    >
      <div
        className="px-3 py-2 text-sm font-medium text-amber-900 border-b cursor-grab"
        data-drag-handle
      >
        ▣ Note
      </div>

      <div className="p-3">
        <textarea
          value={val}
          onChange={(e) => setVal(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-lg border bg-white px-2 py-1 text-sm focus:ring-2 focus:ring-indigo-300"
          onPointerDown={(e) => e.stopPropagation()}
        />
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-amber-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-amber-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                 IMAGE NODE                                 */
/* -------------------------------------------------------------------------- */

function ImageNode({
  data,
  selected,
  id,
}: NodeProps<{ url?: string }>) {
  const [url, setUrl] = useState(data.url || "");
  const { setNodes } = useReactFlow();

  useEffect(() => {
    setUrl(data.url || "");
  }, [data.url]);

  const handleUrlChange = (next: string) => {
    setUrl(next);
    setNodes((nds) =>
      nds.map((n) =>
        n.id === id ? { ...n, data: { ...n.data, url: next } } : n
      )
    );
  };

  return (
    <div
      className={[
        "rounded-xl border bg-white shadow-sm w-fit max-w-[200px] whitespace-pre-wrap break-words overflow-hidden",
        selected ? "ring-2 ring-sky-400 border-sky-300" : "border-sky-200",
      ].join(" ")}
    >
      <div className="px-3 py-2 text-xs text-sky-700 font-semibold" data-drag-handle>
        🖼️ Image
      </div>

      <div className="p-2">
        <input
          value={url}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="Paste image URL"
          className="w-full rounded border px-2 py-1 text-xs focus:ring-2 focus:ring-sky-300"
          onPointerDown={(e) => e.stopPropagation()}
        />
        <div className="mt-2 h-[140px] bg-neutral-100 rounded overflow-hidden flex items-center justify-center">
          {url ? (
            <img src={url} className="object-cover w-full h-full" />
          ) : (
            <span className="text-[10px] text-neutral-500">No image</span>
          )}
        </div>
      </div>

      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-sky-400" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-sky-400" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               PDF NODE (NEW)                               */
/* -------------------------------------------------------------------------- */

function PdfNode({
  data,
  selected,
}: NodeProps<{ title: string; url: string }>) {
  const titleShort =
    data.title?.length > 70 ? data.title.slice(0, 67) + "…" : data.title;

  return (
    <div
      className={[
        "rounded-2xl border bg-white shadow-sm w-fit max-w-[200px] whitespace-pre-wrap break-words overflow-hidden",
        selected ? "ring-2 ring-blue-300 border-blue-300" : "border-blue-200",
      ].join(" ")}
    >

      <div className="px-3 py-2 text-xs text-blue-700 font-semibold" data-drag-handle>
        📄 Research Paper
      </div>

      <div className="px-3 pb-2 text-sm text-neutral-900">
        {titleShort}
      </div>

      <div className="px-3 pb-3 text-[10px] text-neutral-500">
        Select to preview →
      </div>

      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-blue-400" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-blue-400" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            SUMMARY NODE (NEW)                               */
/* -------------------------------------------------------------------------- */

function SummaryNode({
  data,
  selected,
}: NodeProps<{ text: string }>) {
  const short =
    data.text.length > 200 ? data.text.slice(0, 197) + "…" : data.text;

  return (
    <div
      className={[
        "rounded-2xl border bg-amber-50 shadow-sm w-fit max-w-[200px] whitespace-pre-wrap break-words overflow-hidden px-3 py-2",
        selected
          ? "ring-2 ring-amber-300 border-amber-300"
          : "border-amber-200",
      ].join(" ")}>
      <div className="flex items-center gap-2 mb-1 cursor-grab" data-drag-handle>
        <div className="w-7 h-7 rounded-xl bg-amber-200 flex items-center justify-center text-xs">
          ✨
        </div>
        <div className="text-xs font-semibold text-amber-800">
          Key Insight
        </div>
      </div>

      <div className="text-[11px] text-neutral-900 whitespace-pre-line">
        {short}
      </div>

      <Handle type="target" position={Position.Left} className="w-2 h-2 bg-amber-500" />
      <Handle type="source" position={Position.Right} className="w-2 h-2 bg-amber-500" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            CHAT RESPONSE NODE                              */
/* -------------------------------------------------------------------------- */

function ChatResponseNode({
  data,
  selected,
}: NodeProps<{ question: string; response: string; timestamp: string }>) {
  return (
    <div
      className={[
        "rounded-2xl border bg-gradient-to-br from-purple-50 to-blue-50 shadow-md w-fit max-w-[320px] whitespace-pre-wrap break-words overflow-hidden",
        selected
          ? "ring-2 ring-purple-400 border-purple-300"
          : "border-purple-200",
      ].join(" ")}
    >
      <div
        className="px-3 py-2 text-xs font-semibold text-purple-700 border-b border-purple-200 bg-white/50 cursor-grab"
        data-drag-handle
      >
        💬 Chat Response
      </div>

      <div className="p-3 max-h-[400px] overflow-y-auto">
        {/* Question */}
        <div className="mb-3">
          <div className="text-[9px] font-semibold text-purple-600 uppercase mb-1">
            Question:
          </div>
          <div className="text-[11px] text-neutral-700 italic">
            "{data.question}"
          </div>
        </div>

        {/* Response */}
        <div>
          <div className="text-[9px] font-semibold text-purple-600 uppercase mb-1">
            Response:
          </div>
          <div className="text-[11px] text-neutral-900 leading-relaxed">
            {data.response}
          </div>
        </div>

        {/* Timestamp */}
        <div className="mt-3 pt-2 border-t border-purple-100 text-[9px] text-neutral-400">
          {new Date(data.timestamp).toLocaleTimeString()}
        </div>
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-purple-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-purple-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                            DOCUMENT NODE                                   */
/* -------------------------------------------------------------------------- */

function DocumentNode({
  data,
  selected,
}: NodeProps<{ title: string; text: string; kind: "doc" | "image" }>) {
  const textPreview =
    data.text && data.text.length > 200
      ? data.text.slice(0, 197) + "..."
      : data.text || "Processing...";

  const icon = data.kind === "doc" ? "📄" : "🖼️";

  return (
    <div
      className={[
        "rounded-2xl border bg-white shadow-sm w-fit max-w-[240px] whitespace-pre-wrap break-words overflow-hidden",
        selected
          ? "ring-2 ring-teal-300 border-teal-300"
          : "border-teal-200",
      ].join(" ")}
    >
      <div
        className="px-3 py-2 text-xs font-semibold text-teal-700 border-b border-teal-200 cursor-grab"
        data-drag-handle
      >
        {icon} Document
      </div>

      <div className="p-3">
        {/* Title */}
        <div className="mb-2 text-xs font-semibold text-teal-800">
          {data.title}
        </div>

        {/* Extracted Text Preview */}
        <div className="text-[10px] text-neutral-600 leading-relaxed bg-neutral-50 rounded p-2 max-h-[120px] overflow-y-auto">
          {textPreview}
        </div>

        {data.text && data.text.length > 200 && (
          <div className="mt-1 text-[9px] text-neutral-400">
            {data.text.length} characters extracted
          </div>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="w-2 h-2 bg-teal-400"
      />
      <Handle
        type="source"
        position={Position.Right}
        className="w-2 h-2 bg-teal-400"
      />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               EXPORT ALL NODES                             */
/* -------------------------------------------------------------------------- */

export {
  TopicNode,
  IdeationNode,
  QueryNode,
  NoteNode,
  ImageNode,
  PdfNode,
  SummaryNode,
  ChatResponseNode,
  DocumentNode,
};
