import { SpaceSnapshot, SpaceMessage, SpaceAsset } from "./spaceTypes";

type Store = Map<string, SpaceSnapshot>;

const g = globalThis as any;
export const spaceStore: Store = g.__SPACE_STORE__ ?? new Map<string, SpaceSnapshot>();
if (!g.__SPACE_STORE__) g.__SPACE_STORE__ = spaceStore;

export function mustGetSpace(id: string): SpaceSnapshot {
  const s = spaceStore.get(id);
  if (!s) throw new Error("Space not found");
  return s;
}

export function addMessage(id: string, msg: SpaceMessage): SpaceMessage {
  const s = mustGetSpace(id);
  s.messages.push(msg);
  return msg;
}

export function addAsset(id: string, asset: SpaceAsset): SpaceAsset {
  const s = mustGetSpace(id);
  s.assets.unshift(asset);
  return asset;
}