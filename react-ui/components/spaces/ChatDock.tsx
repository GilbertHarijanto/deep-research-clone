"use client";

import { useRef, useState } from "react";
import { SpaceMessage, SpaceAsset } from "@/types/spaces";

export function ChatDock({
  spaceId,
  messages,
  onSend,
}: {
  spaceId: string;
  messages: SpaceMessage[];
  onSend: (text: string, attachments: SpaceAsset[]) => Promise<void>;
}) {
  const [text, setText] = useState("");
  const [pending, setPending] = useState(false);
  const [attached, setAttached] = useState<SpaceAsset[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePaste = async (e: React.ClipboardEvent) => {
    const file = e.clipboardData.files?.[0];
    if (file && file.type.startsWith("image/")) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/spaces/${spaceId}/assets`, { method: "POST", body: form });
      const asset = await res.json();
      setAttached((a) => [...a, asset]);
    }
  };

  return (
    <div className="flex flex-col h-screen">
      <div className="p-4 border-b">
        <div className="font-semibold">Assistant</div>
        <div className="text-xs text-gray-500">Discuss & annotate your research</div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div key={m.id} className={`max-w-[80%] ${m.role === "assistant" ? "" : "ml-auto"}`}>
            <div className={`rounded-2xl px-3 py-2 text-sm ${m.role === "assistant" ? "bg-gray-100" : "bg-indigo-600 text-white"}`}>
              {m.text || (m.attachments?.length ? "(attachment)" : "")}
            </div>
            {!!m.attachments?.length && (
              <div className="mt-2 flex gap-2 flex-wrap">
                {m.attachments.map((a) =>
                  a.kind === "image" ? (
                    <img key={a.id} src={a.url} className="w-24 h-24 object-cover rounded-md border" />
                  ) : (
                    <div key={a.id} className="text-xs text-gray-600">{a.title || a.url}</div>
                  )
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {!!attached.length && (
        <div className="px-4 pb-2 flex gap-2 flex-wrap">
          {attached.map((a) => (
            <img key={a.id} src={a.url} className="w-14 h-14 object-cover rounded-md border" />
          ))}
        </div>
      )}

      <div className="p-3 border-t">
        <div
          className="flex items-center gap-2"
          onPaste={handlePaste}
        >
          <input
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            placeholder="Ask about your research..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.append("file", file);
              const res = await fetch(`/api/spaces/${spaceId}/assets`, { method: "POST", body: form });
              const asset = await res.json();
              setAttached((a) => [...a, asset]);
            }}
          />
          <button className="px-3 py-2 text-sm rounded-md border" onClick={() => fileRef.current?.click()}>
            Upload
          </button>
          <button
            className="px-3 py-2 text-sm rounded-md bg-indigo-600 text-white disabled:opacity-50"
            disabled={!text.trim() && attached.length === 0 || pending}
            onClick={async () => {
              setPending(true);
              await onSend(text.trim(), attached);
              setText("");
              setAttached([]);
              setPending(false);
            }}
          >
            {pending ? "Sending..." : "Send"}
          </button>
        </div>
        <div className="text-[11px] text-gray-500 mt-1">Tip: paste an image directly into the box.</div>
      </div>
    </div>
  );
}
