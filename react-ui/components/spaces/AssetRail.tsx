"use client";

import { SpaceAsset } from "@/types/spaces";

export function AssetRail({
  assets,
  onUpload,
  onInsertToChat,
}: {
  assets: SpaceAsset[];
  onUpload: (file: File) => Promise<void>;
  onInsertToChat: (asset: SpaceAsset) => Promise<void>;
}) {
  return (
    <div className="h-screen flex flex-col">
      <div className="p-4 border-b">
        <div className="font-semibold">Assets</div>
        <div className="text-xs text-gray-500">Images & notes</div>
      </div>

      <div className="p-3">
        <label className="block text-xs font-medium mb-1">Upload image</label>
        <input
          type="file"
          accept="image/*"
          onChange={async (e) => {
            const f = e.target.files?.[0];
            if (f) await onUpload(f);
          }}
        />
      </div>

      <div className="flex-1 overflow-y-auto p-3 grid grid-cols-1 gap-3">
        {assets.map((a) =>
          a.kind === "image" ? (
            <div key={a.id} className="border rounded-lg overflow-hidden">
              <img src={a.url} className="w-full aspect-video object-cover" />
              <button
                className="w-full text-xs py-1.5 border-t hover:bg-gray-50"
                onClick={() => onInsertToChat(a)}
              >
                Insert to chat
              </button>
            </div>
          ) : (
            <div key={a.id} className="border rounded-lg p-2 text-xs">
              <div className="font-semibold">{a.title}</div>
              <div className="text-gray-600">{a.text}</div>
              <button className="mt-2 w-full text-xs py-1.5 border-t hover:bg-gray-50" onClick={() => onInsertToChat(a)}>
                Insert to chat
              </button>
            </div>
          )
        )}
      </div>
    </div>
  );
}
